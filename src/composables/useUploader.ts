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
import { getToken } from '@/utils/cookie'
import panUtil, { EFileStatus } from '@/utils/common'
import fileService from '@/api/file'
import { ElMessage } from '@/composables/useToast'
import { useFileStore } from '@/stores/file'
import { useTaskStore } from '@/stores/task'
import { useUserStore } from '@/stores/user'

let _uploader: Uploader | null = null
let _attachCount = 0

export function useUploader() {
  const fileStore = useFileStore()
  const taskStore = useTaskStore()
  const ready = ref(false)

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
        parentId: (file as unknown as { __uploadParentId?: string }).__uploadParentId || fileStore.paramParentId
      }),
      headers: { Authorization: getToken() },
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
      maxChunkRetries: 0,
      chunkRetryInterval: null,
      progressCallbacksInterval: 500,
      successStatuses: [200, 201, 202],
      permanentErrors: [404, 415, 500, 501],
      initialPaused: false
    }

    _uploader = new Uploader(fileOptions)
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
        // 绑定 add 时刻的目标目录，上传分片时以它为准，避免切换目录导致落错位置
        ;(f as unknown as { __uploadParentId?: string }).__uploadParentId = fileStore.paramParentId
        if (f.size > panUtil.getMaxFileSize()) {
          throw new Error(
            '文件：' +
              f.name +
              ' 大小超过了最大上传限制（' +
              panUtil.translateFileSize(panUtil.getMaxFileSize()) +
              '）'
          )
        }
        taskStore.add({
          id: f.id,
          target: f,
          filename: f.name,
          uniqueIdentifier: f.uniqueIdentifier,
          fileSize: panUtil.translateFileSize(f.size),
          uploadedSize: panUtil.translateFileSize(0),
          status: EFileStatus.PARSING.code,
          statusText: EFileStatus.PARSING.text,
          timeRemaining: panUtil.translateTime(Number.POSITIVE_INFINITY),
          speed: panUtil.translateSpeed(f.averageSpeed),
          percentage: 0,
          parentId: fileStore.paramParentId
        })

        MD5(f.file, (e, md5) => {
          if (e || !md5) {
            // 指纹计算失败属正常降级，静默转入普通上传，无需弹错误提示
            resumeWaiting(f.id)
            return
          }
          f.uniqueIdentifier = md5
          fileService.secUpload(
            { filename: f.name, identifier: md5, parentId: fileStore.paramParentId },
            (res) => {
              if (res.code === 0 && res.data) {
                ElMessage.success('上传成功：' + f.name)
                f.cancel()
                taskStore.remove(f.id)
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

  function onFileProgress(rootFile: UploaderFile, file: UploaderFile) {
    // 不再用 file.isUploading() 过滤：文件 resume 后可能短暂未置位，
    // 导致前几次进度事件被跳过，只剩 0% 和 100%
    const progress = Number(file.progress()) || 0
    const item = taskStore.getUploadTask(file.id)
    if (item && item.status !== EFileStatus.UPLOADING.code && progress > 0 && progress < 1) {
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
        taskStore.updateStatus({
          id: file.id,
          status: EFileStatus.SUCCESS.code,
          statusText: EFileStatus.SUCCESS.text
        })
        taskStore.remove(file.id)
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
    taskStore.updateStatus({
      id: file.id,
      status: EFileStatus.SUCCESS.code,
      statusText: EFileStatus.SUCCESS.text
    })
    taskStore.remove(file.id)
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

  onUnmounted(() => {
    _attachCount = Math.max(0, _attachCount - 1)
  })

  return { addFiles, ready }
}
