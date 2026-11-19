import { beforeEach, describe, expect, it } from 'vitest'
import { clearVideoProgress, loadVideoProgress, saveVideoProgress } from '@/utils/video-progress'

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
})
