/**
 * useUploader —— 通用分片上传 composable
 * - 内部持有 simple-uploader 实例（单例）
 * - 上传进度同步到 useTaskStore
 * - 自动调用 secUpload / chunk-upload / merge 三段流程
 * - 暴露 addFiles()，供按钮点击 / 拖拽两种入口使用
 */
import { onUnmounted, ref } from 'vue'
import Uploader from 'simple-uploader.js'
import type { UploaderFile, UploaderChunk } from 'simple-uploader.js'
import { MD5 } from '@/utils/md5'
import { getXsrfToken } from '@/utils/cookie'
import { deleteUploadFile, loadUploadFile, saveUploadFile } from '@/utils/upload-blob-store'
import panUtil, { EFileStatus } from '@/utils/common'
import fileService from '@/api/file'
import { ElMessage } from '@/composables/useToast'
import { useFileStore } from '@/stores/file'
import { useTaskStore } from '@/stores/task'
import { useUploadHistory } from '@/composables/useUploadHistory'
import { useUserStore } from '@/stores/user'

let _uploader: Uploader | null = null
let _attachCount = 0
// 自动恢复只允许执行一次：多个页面同时调用 useUploader 时不能重复把任务喂给上传器
let _autoResumeStarted = false

export function useUploader() {
  const fileStore = useFileStore()
  const taskStore = useTaskStore()
  const { add: addUploadHistory } = useUploadHistory()
  const ready = ref(false)

  /** 记录最近上传（P3-1）：必须在任务被移除前读取文件名/大小/目录快照 */
  function recordUploadSuccess(fileId: string) {
    const task = taskStore.getUploadTask(fileId)
    if (!task) return
    addUploadHistory({
      filename: task.filename,
      fileSizeDesc: task.fileSize,
      fileSizeBytes: task.fileSizeBytes,
      parentId: task.parentId
    })
  }

  function ensureUploader(): Uploader {
    if (_uploader) return _uploader

    const fileOptions = {
      target: () => {
        if (panUtil.getChunkUploadSwitch()) {
          return panUtil.getUrlPrefix() + '/file/chunk-upload'
        }
        return panUtil.getUrlPrefix() + '/file/upload'
      },
      singleFile: false,
      chunkSize: panUtil.getChunkSize(),
      testChunks: panUtil.getChunkUploadSwitch(),
      // 强制按 chunkSize 切片（除最后一块外均严格 >= 5MB），满足 MinIO composeObject 合并限制
      forceChunkSize: true,
      simultaneousUploads: 3,
      fileParameterName: 'file',
      // 用文件 add 时快照的 parentId，避免上传过程中切换目录导致分片落到错误目录
      query: (file: UploaderFile) => ({
        parentId: (file as unknown as { __uploadParentId?: string }).__uploadParentId ?? fileStore.paramParentId
      }),
      // 登录态由同源 HttpOnly Cookie 自动携带；这里只补充 CSRF 双提交头
      withCredentials: true,
      headers: () => {
        const xsrf = getXsrfToken()
        return xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}
      },
      checkChunkUploadedByResponse: (chunk: UploaderChunk, message: string) => {
        let obj: { data?: { uploadedChunks?: number[] } } = {}
        try {
          obj = JSON.parse(message)
        } catch {
          /* noop */
        }
        // 仅当接口明确返回 uploadedChunks 且包含当前分片时才视为「已上传」；
        // 响应异常/字段缺失时返回 false，强制重传该分片，避免误判跳过导致合并出损坏文件
        if (obj.data && Array.isArray(obj.data.uploadedChunks)) {
          return obj.data.uploadedChunks.indexOf(chunk.offset + 1) >= 0
        }
        return false
      },
      // 分片失败自动重试：一次网络抖动就判死整个上传的体验不可接受（500 可能是
      // 服务端瞬时错误，也移出永久错误列表；404/415/501 仍是协议级不可恢复错误）
      maxChunkRetries: 3,
      chunkRetryInterval: 2000,
      progressCallbacksInterval: 500,
      successStatuses: [200, 201, 202],
      permanentErrors: [404, 415, 501],
      initialPaused: false
    }

    _uploader = new Uploader(fileOptions as never)
    if (!_uploader.support) {
      ElMessage.error('本浏览器不支持 simple-uploader，请更换浏览器重试')
    }

    _uploader.on('filesAdded', onFilesAdded)
    _uploader.on('fileProgress', onFileProgress)
    _uploader.on('fileSuccess', onFileUploaded)
    _uploader.on('fileError', onUploadError)
    return _uploader
  }

  function onFilesAdded(files: UploaderFile[]): boolean {
    try {
      files.forEach((f) => {
        f.pause()
        // 绑定 add 时刻的目标目录，上传分片时以它为准，避免切换目录导致落错位置。
        // 续传场景 resumePersistedTask 已经写入原任务快照，不能被当前目录覆盖。
        const markedParentId = (f as unknown as { __uploadParentId?: string }).__uploadParentId
        const uploadParentId = markedParentId ?? fileStore.paramParentId
        ;(f as unknown as { __uploadParentId?: string }).__uploadParentId = uploadParentId
        if (f.size > panUtil.getMaxFileSize()) {
          // 单个文件超限：只移除该文件并提示，不中断同批其它正常文件。
          // 直接 cancel() 会将该文件从上传器 files 中移除，避免其永久卡在暂停态残留。
          ElMessage.error(
            '文件：' +
              f.name +
              ' 大小超过了最大上传限制（' +
              panUtil.translateFileSize(panUtil.getMaxFileSize()) +
              '）'
          )
          f.cancel()
          return
        }
        taskStore.add({
          id: f.id,
          target: f,
          filename: f.name,
          uniqueIdentifier: f.uniqueIdentifier,
          fileSizeBytes: f.size,
          fileSize: panUtil.translateFileSize(f.size),
          uploadedSize: panUtil.translateFileSize(0),
          status: EFileStatus.PARSING.code,
          statusText: EFileStatus.PARSING.text,
          timeRemaining: panUtil.translateTime(Number.POSITIVE_INFINITY),
          speed: panUtil.translateSpeed(f.averageSpeed),
          percentage: 0,
          parentId: uploadParentId
        })

        // 把原文件副本写入 IndexedDB（仅元数据仍走 localStorage）：
        // 刷新后可在配额允许范围内自动恢复；超限/隐私模式失败会被静默忽略，
        // 用户仍可通过面板“重新选择文件”续传，不影响本次上传主链路。
        void saveUploadFile(f.id, f.file)

        MD5(f.file, (e, md5) => {
          if (e || !md5) {
            // 指纹计算失败属正常降级，静默转入普通上传，无需弹错误提示
            resumeWaiting(f.id)
            return
          }
          // P2-11 续传：用户重新选择了原任务文件时，先用 MD5 确认内容一致，
          // 不一致就明确提示并按新文件上传，绝不能复用旧 identifier 合并出错误内容。
          const resumeIdentifier = (f as unknown as { __resumeIdentifier?: string }).__resumeIdentifier
          if (resumeIdentifier && resumeIdentifier !== md5) {
            ElMessage.error('文件内容与原上传任务不一致，已按新文件重新上传')
          }
          f.uniqueIdentifier = md5
          // 立即把 identifier 写回任务元数据，刷新后才能按同一 identifier 续传
          taskStore.updateIdentifier(f.id, md5)
          fileService.secUpload(
            {
              filename: f.name,
              identifier: md5,
              // 用 add 时刻快照的 __uploadParentId（与分片 query / merge 的 item.parentId
              // 同源），MD5 计算是异步的，期间用户可能已切换目录，不能用实时 paramParentId，
              // 否则秒传命中时文件会落进切换后的目录
              parentId:
                (f as unknown as { __uploadParentId?: string }).__uploadParentId ??
                fileStore.paramParentId
            },
            (res) => {
              if (res.code === 0 && res.data) {
                ElMessage.success('上传成功：' + f.name)
                f.cancel()
                recordUploadSuccess(f.id)
                taskStore.remove(f.id)
                // 任务成功后原文件副本不再需要，及时释放 IndexedDB 配额
                void deleteUploadFile(f.id)
                fileStore.loadFileList()
                if (_uploader && _uploader.files.length === 0) {
                  taskStore.updateViewFlag(false)
                }
              } else {
                // 业务未命中秒传：转入普通分片上传
                resumeWaiting(f.id)
              }
            },
            () => {
              // 网络/接口异常：千万不要静默 return，否则文件会永久卡在暂停态
              // 秒传校验失败属正常回退，静默转入普通上传，无需提示用户
              resumeWaiting(f.id)
            }
          )
        })
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ElMessage.error(message)
      _uploader?.cancel()
      taskStore.clear()
      return false
    }
    taskStore.updateViewFlag(true)
    return true
  }

  function resumeWaiting(id: string) {
    const task = taskStore.getUploadTask(id)
    if (task?.target) task.target.resume()
    taskStore.updateStatus({
      id,
      status: EFileStatus.WAITING.code,
      statusText: EFileStatus.WAITING.text
    })
  }

  /**
   * 暂停正在上传的任务：simple-uploader 会停止后续分片请求；
   * 只对 UPLOADING 开放，解析中/等待中由 MD5 回调自动 resume，提前标暂停会被覆盖。
   */
  function pauseUpload(id: string) {
    const task = taskStore.getUploadTask(id)
    if (!task?.target || task.status !== EFileStatus.UPLOADING.code) return
    task.target.pause()
    taskStore.updateStatus({
      id,
      status: EFileStatus.PAUSE.code,
      statusText: EFileStatus.PAUSE.text
    })
  }

  /** 终态（成功/失败）任务不需要 cancel 底层上传 */
  function isTerminalStatus(status: number): boolean {
    return status === EFileStatus.SUCCESS.code || status === EFileStatus.FAIL.code
  }

  /**
   * 从面板移除任务：非终态任务同时取消底层上传，否则移除后分片仍在后台传输、
   * 白耗流量且完成后还会触发成功提示
   */
  function cancelUpload(id: string) {
    const task = taskStore.getUploadTask(id)
    if (task?.target && !isTerminalStatus(task.status)) task.target.cancel()
    taskStore.remove(id)
    // 用户主动移除任务后不再自动恢复，删除 IndexedDB 副本避免成为孤儿数据
    void deleteUploadFile(id)
  }

  function onFileProgress(rootFile: UploaderFile, file: UploaderFile) {
    // 不再用 file.isUploading() 过滤：文件 resume 后可能短暂未置位，
    // 导致前几次进度事件被跳过，只剩 0% 和 100%
    const progress = Number(file.progress()) || 0
    const item = taskStore.getUploadTask(file.id)
    // 用户主动暂停后仍可能收到一个在途进度事件；不能把 PAUSE 覆盖回 UPLOADING，
    // 否则面板会立刻从“继续”变回“暂停”，暂停状态看起来失效。
    if (
      item &&
      item.status !== EFileStatus.UPLOADING.code &&
      item.status !== EFileStatus.PAUSE.code &&
      progress > 0 &&
      progress < 1
    ) {
      taskStore.updateStatus({
        id: file.id,
        status: EFileStatus.UPLOADING.code,
        statusText: EFileStatus.UPLOADING.text
      })
    }
    taskStore.updateProcess({
      id: file.id,
      speed: panUtil.translateSpeed(Number(file.averageSpeed) || 0),
      percentage: Math.min(Math.floor(progress * 100), 99),
      uploadedSize: panUtil.translateFileSize(Number(file.sizeUploaded()) || 0),
      timeRemaining: panUtil.translateTime(file.timeRemaining())
    })
  }

  function onFileUploaded(rootFile: UploaderFile, file: UploaderFile, message: string) {
    let res: { code?: number; data?: { mergeFlag?: boolean; uploadedChunks?: number[] } } = {}
    try {
      res = JSON.parse(message)
    } catch {
      /* noop */
    }
    if (res.code === 0) {
      if (res.data) {
        if (res.data.mergeFlag) {
          doMerge(file)
        } else if (
          res.data.uploadedChunks &&
          res.data.uploadedChunks.length === file.chunks.length
        ) {
          doMerge(file)
        }
      } else {
        finishFile(file)
      }
    } else {
      file.pause()
      taskStore.updateStatus({
        id: file.id,
        status: EFileStatus.FAIL.code,
        statusText: EFileStatus.FAIL.text
      })
      ElMessage.error(`上传失败：${file.name}`)
    }
  }

  function doMerge(file: UploaderFile) {
    const item = taskStore.getUploadTask(file.id)
    taskStore.updateStatus({
      id: file.id,
      status: EFileStatus.MERGE.code,
      statusText: EFileStatus.MERGE.text
    })
    taskStore.updateProcess({
      id: file.id,
      speed: panUtil.translateSpeed(file.averageSpeed),
      percentage: 99,
      uploadedSize: panUtil.translateFileSize(file.sizeUploaded()),
      timeRemaining: panUtil.translateTime(file.timeRemaining())
    })
    if (!item) return
    fileService.merge(
      {
        filename: item.filename,
        identifier: item.target.uniqueIdentifier,
        parentId: item.parentId,
        totalSize: item.target.size
      },
      () => {
        ElMessage.success('上传成功：' + file.name)
        _uploader?.removeFile(file)
        try {
          useUserStore().usedSpace += file.size || 0
        } catch {
          /* noop */
        }
        fileStore.loadFileList()
        recordUploadSuccess(file.id)
        taskStore.updateStatus({
          id: file.id,
          status: EFileStatus.SUCCESS.code,
          statusText: EFileStatus.SUCCESS.text
        })
        taskStore.remove(file.id)
        void deleteUploadFile(file.id)
        if (_uploader && _uploader.files.length === 0) taskStore.updateViewFlag(false)
      },
      () => {
        file.pause()
        taskStore.updateStatus({
          id: file.id,
          status: EFileStatus.FAIL.code,
          statusText: EFileStatus.FAIL.text
        })
      }
    )
  }

  function finishFile(file: UploaderFile) {
    ElMessage.success('上传成功：' + file.name)
    _uploader?.removeFile(file)
    // 累计已用空间（前端估算；后端 UserInfoVO 暂未暴露字段）
    try {
      useUserStore().usedSpace += file.size || 0
    } catch {
      /* noop */
    }
    fileStore.loadFileList()
    recordUploadSuccess(file.id)
    taskStore.updateStatus({
      id: file.id,
      status: EFileStatus.SUCCESS.code,
      statusText: EFileStatus.SUCCESS.text
    })
    taskStore.remove(file.id)
    void deleteUploadFile(file.id)
    if (_uploader && _uploader.files.length === 0) taskStore.updateViewFlag(false)
  }

  function onUploadError(rootFile: UploaderFile, file: UploaderFile) {
    taskStore.updateStatus({
      id: file.id,
      status: EFileStatus.FAIL.code,
      statusText: EFileStatus.FAIL.text
    })
    taskStore.updateProcess({
      id: file.id,
      speed: panUtil.translateSpeed(0),
      percentage: 0,
      uploadedSize: panUtil.translateFileSize(0),
      timeRemaining: panUtil.translateTime(Number.POSITIVE_INFINITY)
    })
    ElMessage.error(`上传失败：${file.name}`)
  }

  /**
   * P2-11：用户从本地重新选择原文件后续传。
   *
   * 只持久化任务元数据、不持久化 File/Blob：刷新后浏览器已拿不到原 File 句柄，
   * 让用户重新选择同一文件是跨浏览器可行的方案。设置 __resumeIdentifier 后，
   * onFilesAdded 会先用 MD5 校验内容，再复用原 identifier 让 simple-uploader 跳过已传分片。
   *
   * @param auto 自动恢复时静默处理，不弹“缺少 identifier”之类的提示
   * @returns 是否已把文件交给上传器；名称/大小不符直接拒绝，原任务保留
   */
  function resumePersistedTask(taskId: string, file: File, auto = false): boolean {
    const task = taskStore.getUploadTask(taskId)
    if (!task) {
      if (!auto) ElMessage.error('上传任务已不存在')
      return false
    }
    if (file.name !== task.filename) {
      if (!auto) ElMessage.error('请选择原任务对应的文件：' + task.filename)
      return false
    }
    if (task.fileSizeBytes != null && file.size !== task.fileSizeBytes) {
      if (!auto) ElMessage.error('文件大小与原任务不一致，请选择原文件')
      return false
    }
    if (file.size > panUtil.getMaxFileSize()) {
      if (!auto) {
        ElMessage.error('文件大小超过最大上传限制（' + panUtil.translateFileSize(panUtil.getMaxFileSize()) + '）')
      }
      return false
    }
    const marked = file as File & {
      __uploadParentId?: string
      __resumeIdentifier?: string
      __resumeTaskId?: string
    }
    // parentId 与 identifier 均来自原任务快照，避免用户当前已切换目录导致落错位置
    marked.__uploadParentId = task.parentId
    if (task.uniqueIdentifier) {
      marked.__resumeIdentifier = task.uniqueIdentifier
    } else if (!auto) {
      // 刷新发生在 MD5 计算完成前时没有 identifier，无法定位服务端分片；降级为完整新上传
      ElMessage.warning('原任务尚未生成上传标识，将重新完整上传')
    }
    marked.__resumeTaskId = task.id
    // 旧中断任务先移除；新任务由 filesAdded 重新建立，失败时用户可重新选择。
    // 旧任务对应的 IndexedDB 副本也一并删除，避免同一个文件在库里存两份。
    taskStore.remove(task.id)
    void deleteUploadFile(task.id)
    ensureUploader()
    _uploader?.addFile(file)
    ready.value = true
    return true
  }

  /**
   * P2-11 自动恢复：页面启动时把 IndexedDB 里仍有原文件副本的中断任务重新入队。
   *
   * 只在缓存命中的任务上自动执行；缓存缺失（超 256MB、隐私模式、配额不足）
   * 的任务保持“已中断”，用户仍可点“重新选择文件”手动续传。
   */
  async function autoResumePersistedTasks() {
    const interrupted = taskStore.uploadTaskList.filter((t) => t.interrupted && t.filename)
    let restored = 0
    for (const task of interrupted) {
      try {
        const cached = await loadUploadFile(task.id)
        if (!cached) continue
        // 缓存记录与任务元数据必须一致；大小不符说明缓存已损坏，宁可降级手动选择
        if (cached.name !== task.filename) continue
        if (task.fileSizeBytes != null && cached.size !== task.fileSizeBytes) continue
        if (resumePersistedTask(task.id, cached, true)) restored++
      } catch {
        // 单个任务恢复失败不能影响其它任务；保留原任务供用户手动选择
      }
    }
    if (restored > 0) {
      ElMessage.success(`已自动恢复 ${restored} 个上传任务`)
    }
  }

  /**
   * 把 FileList / File[] / 单个 File 喂给上传器
   */
  function addFiles(fileList: FileList | File[] | File | null | undefined) {
    if (!fileList) return
    const arr: File[] = Array.isArray(fileList)
      ? fileList
      : fileList instanceof File
        ? [fileList]
        : Array.from(fileList as FileList)
    ensureUploader()
    arr.forEach((f) => _uploader?.addFile(f))
    ready.value = true
  }

  _attachCount++
  if (!_uploader) ensureUploader()
  // 每次应用加载只跑一次自动恢复；IndexedDB 不可用时会立即返回，不影响页面启动
  if (!_autoResumeStarted) {
    _autoResumeStarted = true
    void autoResumePersistedTasks()
  }

  onUnmounted(() => {
    _attachCount = Math.max(0, _attachCount - 1)
  })

  return { addFiles, ready, resumeWaiting, pauseUpload, cancelUpload, resumePersistedTask }
}
