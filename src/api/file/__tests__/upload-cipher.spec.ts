import { beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.hoisted(() => vi.fn())

vi.mock('@/utils/http', () => ({
  default: { post }
}))

import fileService from '@/api/file'

describe('fileService.uploadCipher', () => {
  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({ code: 0, message: 'SUCCESS', data: 'cipher-file-id' })
  })

  it('显式声明 multipart，避免 FormData 被实例默认的 JSON Content-Type 吞掉', async () => {
    const res = await new Promise<{ code: number; data: string }>((resolve, reject) =>
      fileService.uploadCipher(new Blob(['cipher']), 'demo.xpan', resolve, reject)
    )

    expect(res.data).toBe('cipher-file-id')
    const [url, body, config] = post.mock.calls[0]
    expect(url).toBe('/file/upload-cipher')
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('filename')).toBe('demo.xpan')
    expect(body.get('totalSize')).toBe('6')
    expect(body.get('identifier')).toMatch(/^[0-9a-f]{32}$/)
    expect(config.timeout).toBe(0)
    expect(config.headers).toEqual({ 'Content-Type': 'multipart/form-data' })
  })
})
