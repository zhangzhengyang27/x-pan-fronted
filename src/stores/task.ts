import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UploaderFile } from 'simple-uploader.js'

export interface UploadTask {
  // simple-uploader 为每个文件生成的唯一 id，跨同名文件绝不冲突，作为去重主键
  id: string
  target: UploaderFile
  filename: string
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

type TaskKey = Pick<UploadTask, 'id' | 'filename'>

export const useTaskStore = defineStore('task', () => {
  const uploadTaskList = ref<UploadTask[]>([])
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
  }

  const remove = (id: string) => {
    const idx = uploadTaskList.value.findIndex((i) => keyOf(i) === id)
    if (idx >= 0) uploadTaskList.value.splice(idx, 1)
  }

  const getUploadTask = (id: string) => uploadTaskList.value.find((i) => keyOf(i) === id)

  const updateStatus = (task: { id: string; status: number; statusText: string }) => {
    const t = uploadTaskList.value.find((i) => keyOf(i) === task.id)
    if (t) {
      t.status = task.status
      t.statusText = task.statusText
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
