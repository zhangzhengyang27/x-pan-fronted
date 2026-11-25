import { afterEach, describe, expect, it } from 'vitest'
import { getDownloadUrl } from '@/utils/preview'

describe('getDownloadUrl', () => {
  afterEach(() => localStorage.clear())

  it('个人空间不追加 spaceId，保持原下载链路', () => {
    expect(getDownloadUrl('abc+/=')).toBe('/api/file/download?fileId=abc%2B%2F=')
  })

  it('团队空间把 spaceId 放到 query，供后端重新校验成员资格', () => {
    localStorage.setItem('xpan_space_id', '2124480656674127872')
    expect(getDownloadUrl('abc')).toBe(
      '/api/file/download?fileId=abc&spaceId=2124480656674127872'
    )
  })

  it('spaceId 做 URL 编码，不拼出额外的查询参数', () => {
    localStorage.setItem('xpan_space_id', '1&admin=1')
    expect(getDownloadUrl('abc')).toBe('/api/file/download?fileId=abc')
  })

  it('localStorage 残留非数字空间 ID 时按个人空间下载，不能把坏值传给后端', () => {
    localStorage.setItem('xpan_space_id', 'null')
    expect(getDownloadUrl('abc')).toBe('/api/file/download?fileId=abc')
  })
})
