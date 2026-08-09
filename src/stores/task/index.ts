import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UploaderFile } from 'simple-uploader.js'

export interface UploadTask {
  target: UploaderFile
  filename: string
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

  const add = (task: UploadTask) => {
    uploadTaskList.value.unshift(task)
  }

  const remove = (filename: string) => {
    const idx = uploadTaskList.value.findIndex((i) => i.filename === filename)
    if (idx >= 0) uploadTaskList.value.splice(idx, 1)
  }

  const getUploadTask = (filename: string) =>
    uploadTaskList.value.find((i) => i.filename === filename)

  const updateStatus = (task: { filename: string; status: number; statusText: string }) => {
    const t = uploadTaskList.value.find((i) => i.filename === task.filename)
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
    const t = uploadTaskList.value.find((i) => i.filename === task.filename)
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

  return {
    uploadTaskList,
    viewFlag,
    add,
    remove,
    getUploadTask,
    updateStatus,
    updateProcess,
    clear,
    updateViewFlag
  }
})
