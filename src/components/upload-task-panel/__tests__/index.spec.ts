import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'

// 上传器打桩：避免在测试环境构造真实 Uploader（FileReader/slice 依赖）
const uploaderInstances: Array<{ support: boolean; on: unknown; addFile: unknown }> = []
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
    addFile() {
      /* noop */
    }
    constructor() {
      uploaderInstances.push(this as never)
    }
  }
  return { default: FakeUploader }
})

import { useTaskStore } from '@/stores/task'
import { EFileStatus } from '@/utils/common'
import TaskPanel from '@/components/upload-task-panel/index.vue'
import TaskListBadge from '@/components/task-list/index.vue'

function fakeTarget() {
  return {
    resume: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn()
  } as never
}

function makeTask(id: string, status: number, filename = `f-${id}.txt`) {
  return {
    id,
    target: fakeTarget(),
    filename,
    fileSize: '1 KB',
    uploadedSize: '0 KB',
    status,
    statusText: 'x',
    timeRemaining: '-',
    speed: '-',
    percentage: 0,
    parentId: 'root'
  }
}

describe('upload-task-panel 重试 / 移除', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('失败任务渲染重试按钮，点击后恢复任务并续传', async () => {
    const store = useTaskStore()
    store.add(makeTask('t1', EFileStatus.FAIL.code))
    const wrapper = mount(TaskPanel, { global: { stubs: { teleport: true } } })

    const retryBtn = wrapper.find('[aria-label="重试 f-t1.txt"]')
    expect(retryBtn.exists()).toBe(true, '失败任务必须提供"重试"入口')

    const task = store.getUploadTask('t1')
    await retryBtn.trigger('click')
    expect(task?.target.resume).toHaveBeenCalled()
    expect(task?.status).toBe(EFileStatus.WAITING.code)
  })

  it('上传中任务可暂停，底层 pause 被调用且状态变为暂停', async () => {
    const store = useTaskStore()
    store.add(makeTask('t4', EFileStatus.UPLOADING.code))
    const wrapper = mount(TaskPanel, { global: { stubs: { teleport: true } } })

    const task = store.getUploadTask('t4')
    await wrapper.find('[aria-label="暂停 f-t4.txt"]').trigger('click')
    expect(task?.target.pause).toHaveBeenCalled()
    expect(task?.status).toBe(EFileStatus.PAUSE.code)
    expect(store.getUploadTask('t4')?.statusText).toBe(EFileStatus.PAUSE.text)
  })

  it('暂停任务可继续，底层 resume 被调用并回到等待上传', async () => {
    const store = useTaskStore()
    store.add(makeTask('t5', EFileStatus.PAUSE.code))
    const wrapper = mount(TaskPanel, { global: { stubs: { teleport: true } } })

    const task = store.getUploadTask('t5')
    await wrapper.find('[aria-label="继续 f-t5.txt"]').trigger('click')
    expect(task?.target.resume).toHaveBeenCalled()
    expect(task?.status).toBe(EFileStatus.WAITING.code)
  })

  it('移除非终态任务时取消底层上传，不再白耗流量', async () => {
    const store = useTaskStore()
    store.add(makeTask('t2', EFileStatus.UPLOADING.code))
    const wrapper = mount(TaskPanel, { global: { stubs: { teleport: true } } })

    const target = store.getUploadTask('t2')?.target
    await wrapper.find('[aria-label="移除 f-t2.txt"]').trigger('click')
    expect(target?.cancel).toHaveBeenCalled()
    expect(store.getUploadTask('t2')).toBeUndefined()
  })

  it('终态任务移除不调用 cancel', async () => {
    const store = useTaskStore()
    store.add(makeTask('t3', EFileStatus.SUCCESS.code))
    const wrapper = mount(TaskPanel, { global: { stubs: { teleport: true } } })

    const target = store.getUploadTask('t3')?.target
    await wrapper.find('[aria-label="移除 f-t3.txt"]').trigger('click')
    expect(target?.cancel).not.toHaveBeenCalled()
  })
})

describe('task-list 徽标统计', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('徽标统计所有进行中状态（解析/等待/上传/服务器处理），而不仅是解析中', async () => {
    const store = useTaskStore()
    store.add(makeTask('a', EFileStatus.PARSING.code))
    store.add(makeTask('b', EFileStatus.UPLOADING.code))
    const wrapper = mount(TaskListBadge)

    expect(wrapper.find('span').text()).toBe('2', '进行中任务数为 2，徽标应显示 2（旧实现只统计解析中会消失）')
  })
})
