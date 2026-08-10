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
      forceChunkSize: false,
      simultaneousUploads: 3,
      fileParameterName: 'file',
      query: () => ({ parentId: fileStore.paramParentId }),
      headers: { Authorization: getToken() },
      checkChunkUploadedByResponse: (chunk: UploaderChunk, message: string) => {
        let obj: { data?: { uploadedChunks?: number[] } } = {}
        try {
          obj = JSON.parse(message)
        } catch {
          /* noop */
        }
        if (obj.data) {
          return (obj.data.uploadedChunks || []).indexOf(chunk.offset + 1) >= 0
        }
        return true
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
          target: f,
          filename: f.name,
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
            resumeWaiting(f.name)
            return
          }
          f.uniqueIdentifier = md5
          fileService.secUpload(
            { filename: f.name, identifier: md5, parentId: fileStore.paramParentId },
            (res) => {
              if (res.code === 0) {
                ElMessage.success('⚡ 秒传成功：' + f.name)
                f.cancel()
                taskStore.remove(f.name)
                fileStore.loadFileList()
                if (_uploader && _uploader.files.length === 0) {
                  taskStore.updateViewFlag(false)
                }
              } else {
                resumeWaiting(f.name)
              }
            },
            () => resumeWaiting(f.name)
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

  function resumeWaiting(filename: string) {
    const task = taskStore.getUploadTask(filename)
    if (task?.target) task.target.resume()
    taskStore.updateStatus({
      filename,
      status: EFileStatus.WAITING.code,
      statusText: EFileStatus.WAITING.text
    })
  }

  function onFileProgress(rootFile: UploaderFile, file: UploaderFile) {
    if (!file.isUploading()) return
    const item = taskStore.getUploadTask(file.name)
    if (item?.status !== EFileStatus.UPLOADING.code) {
      taskStore.updateStatus({
        filename: file.name,
        status: EFileStatus.UPLOADING.code,
        statusText: EFileStatus.UPLOADING.text
      })
    }
    taskStore.updateProcess({
      filename: file.name,
      speed: panUtil.translateSpeed(file.averageSpeed),
      percentage: Math.floor(file.progress() * 100),
      uploadedSize: panUtil.translateFileSize(file.sizeUploaded()),
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
        filename: file.name,
        status: EFileStatus.FAIL.code,
        statusText: EFileStatus.FAIL.text
      })
    }
  }

  function doMerge(file: UploaderFile) {
    const item = taskStore.getUploadTask(file.name)
    taskStore.updateStatus({
      filename: file.name,
      status: EFileStatus.MERGE.code,
      statusText: EFileStatus.MERGE.text
    })
    taskStore.updateProcess({
      filename: file.name,
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
        ElMessage.success('文件：' + file.name + ' 上传完成')
        _uploader?.removeFile(file)
        try {
          useUserStore().usedSpace += file.size || 0
        } catch {
          /* noop */
        }
        fileStore.loadFileList()
        taskStore.updateStatus({
          filename: file.name,
          status: EFileStatus.SUCCESS.code,
          statusText: EFileStatus.SUCCESS.text
        })
        taskStore.remove(file.name)
        if (_uploader && _uploader.files.length === 0) taskStore.updateViewFlag(false)
      },
      () => {
        file.pause()
        taskStore.updateStatus({
          filename: file.name,
          status: EFileStatus.FAIL.code,
          statusText: EFileStatus.FAIL.text
        })
      }
    )
  }

  function finishFile(file: UploaderFile) {
    ElMessage.success('文件：' + file.name + ' 上传完成')
    _uploader?.removeFile(file)
    // 累计已用空间（前端估算；后端 UserInfoVO 暂未暴露字段）
    try {
      useUserStore().usedSpace += file.size || 0
    } catch {
      /* noop */
    }
    fileStore.loadFileList()
    taskStore.updateStatus({
      filename: file.name,
      status: EFileStatus.SUCCESS.code,
      statusText: EFileStatus.SUCCESS.text
    })
    taskStore.remove(file.name)
    if (_uploader && _uploader.files.length === 0) taskStore.updateViewFlag(false)
  }

  function onUploadError(rootFile: UploaderFile, file: UploaderFile) {
    taskStore.updateStatus({
      filename: file.name,
      status: EFileStatus.FAIL.code,
      statusText: EFileStatus.FAIL.text
    })
    taskStore.updateProcess({
      filename: file.name,
      speed: panUtil.translateSpeed(0),
      percentage: 0,
      uploadedSize: panUtil.translateFileSize(0),
      timeRemaining: panUtil.translateTime(Number.POSITIVE_INFINITY)
    })
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
