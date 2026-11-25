import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUploadHistory } from '@/composables/useUploadHistory'

describe('useUploadHistory', () => {
  beforeEach(() => {
    localStorage.clear()
    useUploadHistory().clear()
  })

  it('记录上传并按最近时间倒序，同名同目录去重', () => {
    const now = vi.spyOn(Date, 'now')
    const base = Date.now()
    now.mockReturnValueOnce(base)
    useUploadHistory().add({ filename: 'a.txt', parentId: '', fileSizeDesc: '1 KB' })
    now.mockReturnValueOnce(base + 1000)
    useUploadHistory().add({ filename: 'b.txt', parentId: 'folder-1', fileSizeDesc: '2 KB' })
    now.mockReturnValueOnce(base + 2000)
    // 同名同目录再次上传应把旧记录提到最前，而不是保留两条
    useUploadHistory().add({ filename: 'a.txt', parentId: '', fileSizeDesc: '1 KB' })
    now.mockRestore()

    const { recentUploads } = useUploadHistory()
    expect(recentUploads.value.map((i) => i.filename)).toEqual(['a.txt', 'b.txt'])
    expect(recentUploads.value[1].parentId).toBe('folder-1')
  })

  it('模块级单例：不同调用方共享同一份记录', () => {
    useUploadHistory().add({ filename: 'shared.txt', parentId: '' })
    expect(useUploadHistory().recentUploads.value[0].filename).toBe('shared.txt')
  })

  it('clear 会移除记录并清空本地存储', () => {
    useUploadHistory().add({ filename: 'a.txt', parentId: '' })
    useUploadHistory().clear()
    expect(useUploadHistory().recentUploads.value).toEqual([])
    expect(localStorage.getItem('x-pan:upload-history')).toBe('[]')
  })
})
