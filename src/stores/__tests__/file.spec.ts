import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFileStore } from '@/stores/file'

describe('file store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('分类视图下 parentId=-1 透传给后端', () => {
    const store = useFileStore()
    store.setParentId('-1')
    store.setFileTypes('2,3')

    expect(store.paramParentId).toBe('-1')
  })

  it('全部文件视图下 parentId=-1 回退根目录', () => {
    const store = useFileStore()
    store.setDefaultParentId('root-id')
    store.setParentId('-1')
    store.setFileTypes('-1')

    expect(store.paramParentId).toBe('root-id')
  })

  it('切换排序字段时重置为升序，同字段在升/降之间循环', () => {
    const store = useFileStore()

    store.toggleSort('fileSize')
    expect(store.sortProp).toBe('fileSize')
    expect(store.sortOrder).toBe('ascending')

    store.toggleSort('fileSize')
    expect(store.sortOrder).toBe('descending')

    store.toggleSort('updateTime')
    expect(store.sortProp).toBe('updateTime')
    expect(store.sortOrder).toBe('ascending')
  })

  it('排序字段映射为后端安全白名单字段', () => {
    const store = useFileStore()

    store.toggleSort('fileSize')
    expect(store.getOrderBy()).toBe('file_size')
    expect(store.getOrder()).toBe('asc')

    store.toggleSort('fileSize')
    expect(store.getOrder()).toBe('desc')
  })

  it('sortItems 支持数字与字符串混合排序', () => {
    const store = useFileStore()
    store.toggleSort('fileSize')

    const list = [{ fileSize: 3 }, { fileSize: 1 }, { fileSize: 2 }]
    expect(store.sortItems(list).map((item) => item.fileSize)).toEqual([1, 2, 3])
  })
})
