import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UploaderFile } from 'simple-uploader.js'

export interface UploadTask {
  target: UploaderFile
  filename: string
  // 基于文件内容 hash + 大小生成的唯一标识，用于区分同名文件
  uniqueIdentifier?: string
  fileSize: string
  uploadedSize: string
  status: number
  statusText: string
  timeRemaining: string
  speed: string
  percentage: number
  parentId: string
}

export const useTaskStore = defineStore('task', () => {
  const uploadTaskList = ref<UploadTask[]>([])
  const viewFlag = ref(false)
  const panelVisible = ref(true)

  // 唯一 key：优先用文件内容 hash，避免同名文件同时上传时串扰；filename 兜底
  // 查找/去重统一以文件名为基准（所有调用方传入的 key 均为文件名），
  // 避免 uniqueIdentifier 在 MD5 计算前后变化导致的匹配失败。
  const keyOf = (task: Pick<UploadTask, 'filename' | 'uniqueIdentifier'>) => task.filename

  const add = (task: UploadTask) => {
    const key = keyOf(task)
    const idx = uploadTaskList.value.findIndex((i) => keyOf(i) === key)
    if (idx >= 0) uploadTaskList.value[idx] = task
    else uploadTaskList.value.unshift(task)
  }

  const remove = (filename: string) => {
    const idx = uploadTaskList.value.findIndex((i) => keyOf(i) === filename)
    if (idx >= 0) uploadTaskList.value.splice(idx, 1)
  }

  const getUploadTask = (filename: string) =>
    uploadTaskList.value.find((i) => keyOf(i) === filename)

  const updateStatus = (task: { filename: string; status: number; statusText: string }) => {
    const t = uploadTaskList.value.find((i) => keyOf(i) === task.filename)
    if (t) {
      t.status = task.status
      t.statusText = task.statusText
    }
  }

  const updateProcess = (task: {
    filename: string
    speed: string
    percentage: number
    uploadedSize: string
    timeRemaining: string
  }) => {
    const t = uploadTaskList.value.find((i) => keyOf(i) === task.filename)
    if (t) {
      t.speed = task.speed
      t.percentage = task.percentage
      t.uploadedSize = task.uploadedSize
      t.timeRemaining = task.timeRemaining
    }
  }

  const clear = () => {
    uploadTaskList.value = []
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
    clear,
    updateViewFlag,
    togglePanel,
    showPanel,
    hidePanel
  }
})
