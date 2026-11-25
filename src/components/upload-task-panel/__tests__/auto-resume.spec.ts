import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'

// 上传器打桩：自动恢复只需要验证 File 被重新交给 addFile，不构造真实分片上传
const uploaderInstances: Array<{ addFile: ReturnType<typeof vi.fn> }> = []
vi.mock('simple-uploader.js', () => {
  class FakeUploader {
    support = true
    files: unknown[] = []
    on() {
      /* noop */
    }
    off() {
      /* noop */
    }
    cancel() {
      /* noop */
    }
    addFile = vi.fn()
    constructor() {
      uploaderInstances.push(this as never)
    }
  }
  return { default: FakeUploader }
})

// 直接模拟 IndexedDB 命中，避免 jsdom 没有 indexedDB 导致自动恢复走降级分支
vi.mock('@/utils/upload-blob-store', () => ({
  AUTO_RESUME_MAX_BYTES: 256 * 1024 * 1024,
  saveUploadFile: vi.fn(() => Promise.resolve(true)),
  deleteUploadFile: vi.fn(() => Promise.resolve()),
  loadUploadFile: vi.fn()
}))

import { useTaskStore } from '@/stores/task'
import { EFileStatus } from '@/utils/common'
import { loadUploadFile } from '@/utils/upload-blob-store'
import TaskPanel from '@/components/upload-task-panel/index.vue'

describe('upload-task-panel IndexedDB 自动恢复', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(loadUploadFile).mockReset()
  })

  it('缓存命中时刷新后自动把原文件交回上传器', async () => {
    localStorage.setItem(
      'x-pan-upload-tasks-v1',
      JSON.stringify([
        {
          id: 'auto-1',
          filename: 'movie.mp4',
          uniqueIdentifier: 'abc123',
          fileSizeBytes: 4,
          fileSize: '4 B',
          uploadedSize: '1 B',
          status: EFileStatus.UPLOADING.code,
          statusText: EFileStatus.UPLOADING.text,
          timeRemaining: '-',
          speed: '-',
          percentage: 25,
          parentId: 'root'
        }
      ])
    )
    vi.mocked(loadUploadFile).mockResolvedValue(new File(['test'], 'movie.mp4'))

    const store = useTaskStore()
    mount(TaskPanel, { global: { stubs: { teleport: true } } })
    // autoResumePersistedTasks 会先 read IndexedDB 再 addFile，必须等 Promise 链走完
    await flushPromises()
    await flushPromises()

    expect(uploaderInstances[0].addFile).toHaveBeenCalledTimes(1)
    // 旧中断任务已被新任务替换，避免面板同时显示“已中断”和“解析中”
    expect(store.getUploadTask('auto-1')).toBeUndefined()
  })
})
