import { beforeEach, describe, expect, it } from 'vitest'
import { useRecent } from '@/composables/useRecent'

function item(fileId: string) {
  return {
    fileId,
    filename: `${fileId}.txt`,
    extension: 'txt',
    fileType: 3,
    parentId: 'root'
  }
}

describe('useRecent', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('多个调用方共享同一份最近访问，新增后立即可见', () => {
    const a = useRecent()
    const b = useRecent()
    a.clear()
    a.add(item('f1'))
    expect(a.recent.value.map((i) => i.fileId)).toEqual(['f1'])
    expect(b.recent.value.map((i) => i.fileId)).toEqual(['f1'], '同一模块内的调用方必须看到更新')
  })

  it('同一文件重复访问只保留一条并置顶，最多 20 条', () => {
    const { add, recent, clear } = useRecent()
    clear()
    add(item('f1'))
    add(item('f2'))
    add(item('f1'))
    expect(recent.value[0].fileId).toBe('f1')
    expect(recent.value.filter((i) => i.fileId === 'f1')).toHaveLength(1)
    for (let i = 0; i < 25; i++) add(item(`x${i}`))
    expect(recent.value).toHaveLength(20)
  })

  it('clear 会清空列表并写回 localStorage', () => {
    const { add, clear, recent } = useRecent()
    add(item('f1'))
    clear()
    expect(recent.value).toEqual([])
    expect(localStorage.getItem('x-pan:recent')).toBe('[]')
  })
})
