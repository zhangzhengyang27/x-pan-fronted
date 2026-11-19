import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UploaderFile } from 'simple-uploader.js'
import { EFileStatus } from '@/utils/common'

export interface UploadTask {
  // simple-uploader 为每个文件生成的唯一 id，跨同名文件绝不冲突，作为去重主键
  id: string
  target: UploaderFile
  filename: string
  uniqueIdentifier?: string
  /** P2-11：原始字节数，用于用户重新选择文件时的快速一致性校验 */
  fileSizeBytes?: number
  fileSize: string
  uploadedSize: string
  status: number
  statusText: string
  timeRemaining: string
  speed: string
  percentage: number
  parentId: string
  /**
   * P2-11：页面刷新后从本地存储恢复的任务没有原始 File 句柄，标记为中断，
   * 只允许移除/重新选择文件，不能点"继续/重试"造成无反馈的假操作。
   */
  interrupted?: boolean
}

type TaskKey = Pick<UploadTask, 'id' | 'filename'>

// 只持久化元数据（不存 File/Blob：大文件会复制一份到浏览器配额，且句柄刷新后不可用）。
const UPLOAD_TASK_STORAGE_KEY = 'x-pan-upload-tasks-v1'

type PersistedUploadTask = Omit<UploadTask, 'target'>

function loadPersistedTasks(): UploadTask[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(UPLOAD_TASK_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PersistedUploadTask[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((t) => t && typeof t.id === 'string' && t.status !== EFileStatus.SUCCESS.code)
      .map((t) => ({
        ...t,
        // 刷新后 simple-uploader 实例和 File 都不存在，恢复为"已中断"；
        // target 占位为 undefined，交互层统一用 target 判空，禁止直接调用上传器。
        target: undefined as unknown as UploaderFile,
        status: EFileStatus.FAIL.code,
        statusText: '已中断，请重新选择文件',
        interrupted: true
      }))
  } catch {
    // 本地存储损坏/配额不足不能阻塞应用启动
    return []
  }
}

function persistTasks(tasks: UploadTask[]) {
  if (typeof window === 'undefined') return
  try {
    const snapshot: PersistedUploadTask[] = tasks
      .filter((t) => t.status !== EFileStatus.SUCCESS.code)
      .map(({ target: _target, ...rest }) => rest)
    window.localStorage.setItem(UPLOAD_TASK_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    /* 隐私模式/配额满时静默降级，上传仍可正常进行 */
  }
}

export const useTaskStore = defineStore('task', () => {
  const uploadTaskList = ref<UploadTask[]>(loadPersistedTasks())
  const viewFlag = ref(false)
  const panelVisible = ref(true)

  // 唯一 key 优先用 simple-uploader 的 file.id，避免同名文件（不同目录）同时上传时互相覆盖；
  // MD5/uniqueIdentifier 在生命周期内会变化，且不能区分同名文件，故不作为主键。
  const keyOf = (task: TaskKey) => task.id

  const add = (task: UploadTask) => {
    const key = keyOf(task)
    const idx = uploadTaskList.value.findIndex((i) => keyOf(i) === key)
    if (idx >= 0) uploadTaskList.value[idx] = task
    else uploadTaskList.value.unshift(task)
    persistTasks(uploadTaskList.value)
  }

  const remove = (id: string) => {
    const idx = uploadTaskList.value.findIndex((i) => keyOf(i) === id)
    if (idx >= 0) uploadTaskList.value.splice(idx, 1)
    persistTasks(uploadTaskList.value)
  }

  const getUploadTask = (id: string) => uploadTaskList.value.find((i) => keyOf(i) === id)

  /**
   * P2-11：MD5 计算完成后把 identifier 写回任务并持久化。
   * 否则刷新后恢复的任务只有文件名/大小，无法让 simple-uploader 定位已上传分片。
   */
  const updateIdentifier = (id: string, uniqueIdentifier: string) => {
    const t = uploadTaskList.value.find((i) => keyOf(i) === id)
    if (t) {
      t.uniqueIdentifier = uniqueIdentifier
      persistTasks(uploadTaskList.value)
    }
  }

  const updateStatus = (task: { id: string; status: number; statusText: string }) => {
    const t = uploadTaskList.value.find((i) => keyOf(i) === task.id)
    if (t) {
      t.status = task.status
      t.statusText = task.statusText
      persistTasks(uploadTaskList.value)
    }
  }

  const updateProcess = (task: {
    id: string
    speed: string
    percentage: number
    uploadedSize: string
    timeRemaining: string
  }) => {
    const t = uploadTaskList.value.find((i) => keyOf(i) === task.id)
    if (t) {
      t.speed = task.speed
      t.percentage = task.percentage
      t.uploadedSize = task.uploadedSize
      t.timeRemaining = task.timeRemaining
      persistTasks(uploadTaskList.value)
    }
  }

  const clear = () => {
    uploadTaskList.value = []
    persistTasks(uploadTaskList.value)
  }

  const updateViewFlag = (flag: boolean) => {
    viewFlag.value = flag
  }

  const togglePanel = () => {
    panelVisible.value = !panelVisible.value
  }

  const showPanel = () => {
    panelVisible.value = true
  }

  const hidePanel = () => {
    panelVisible.value = false
  }

  return {
    uploadTaskList,
    viewFlag,
    panelVisible,
    add,
    remove,
    getUploadTask,
    updateStatus,
    updateProcess,
    updateIdentifier,
    clear,
    updateViewFlag,
    togglePanel,
    showPanel,
    hidePanel
  }
})
