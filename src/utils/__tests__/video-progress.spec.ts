import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearVideoProgress,
  listVideoProgress,
  loadVideoProgress,
  saveVideoProgress
} from '@/utils/video-progress'

describe('video-progress', () => {
  beforeEach(() => localStorage.clear())

  it('保存后可恢复，且按 fileId 隔离', () => {
    saveVideoProgress('f1', 30, 100)
    saveVideoProgress('f2', 70, 100)
    expect(loadVideoProgress('f1')).toBe(30)
    expect(loadVideoProgress('f2')).toBe(70)
  })

  it('太短或接近结尾的位置不保存', () => {
    saveVideoProgress('f1', 2, 100)
    expect(loadVideoProgress('f1')).toBeNull()
    saveVideoProgress('f1', 97, 100)
    expect(loadVideoProgress('f1')).toBeNull()
  })

  it('损坏数据返回 null 并清理', () => {
    localStorage.setItem('x-pan:video-progress:f1', '{bad')
    expect(loadVideoProgress('f1')).toBeNull()
    expect(localStorage.getItem('x-pan:video-progress:f1')).toBeNull()
  })

  it('clear 会移除记录', () => {
    saveVideoProgress('f1', 30, 100)
    clearVideoProgress('f1')
    expect(loadVideoProgress('f1')).toBeNull()
  })

  it('继续观看列表带标题且按最近播放倒序，过滤无效进度', () => {
    const now = vi.spyOn(Date, 'now')
    const base = Date.now()
    now.mockReturnValueOnce(base)
    now.mockReturnValueOnce(base + 1_000)
    saveVideoProgress('f1', 30, 100, { title: '旧视频.mp4', fileType: 9 })
    saveVideoProgress('f2', 40, 100, { title: '新视频.mp4', fileType: 9 })
    // 这条已接近片尾，不应出现在继续观看列表
    saveVideoProgress('f3', 99, 100)
    now.mockRestore()
    const items = listVideoProgress(8)
    expect(items.map((i) => i.fileId)).toEqual(['f2', 'f1'])
    expect(items[0].title).toBe('新视频.mp4')
    expect(items[0].fileType).toBe(9)
  })
})
