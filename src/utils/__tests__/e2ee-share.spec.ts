import { describe, expect, it } from 'vitest'
import {
  buildE2eeShareUrl,
  decryptE2eeBlob,
  encryptFileForShare,
  parseE2eeFragment
} from '@/utils/e2ee-share'

describe('e2ee-share', () => {
  it('加密后能按链接 fragment 解密并还原文件名/内容', async () => {
    const plain = new File(['hello x-pan e2ee'], '说明.txt', { type: 'text/plain' })
    const cipher = await encryptFileForShare(plain)
    expect(cipher.filename.endsWith('.xpan')).toBe(true)
    expect(cipher.key.length).toBeGreaterThan(20)

    const url = buildE2eeShareUrl('https://pan.example.com/share/abc', cipher.key, cipher.iv)
    const fragment = parseE2eeFragment(url.slice(url.indexOf('#')))
    expect(fragment).not.toBeNull()

    const restored = await decryptE2eeBlob(cipher.blob, fragment!.key, fragment!.iv)
    expect(restored.name).toBe('说明.txt')
    expect(restored.type).toBe('text/plain')
    expect(restored.size).toBe(plain.size)
    expect(await restored.blob.text()).toBe('hello x-pan e2ee')
  })

  it('密文被篡改时解密失败，而不是返回错误明文', async () => {
    const cipher = await encryptFileForShare(new File(['abc'], 'a.txt'))
    const bytes = new Uint8Array(await cipher.blob.arrayBuffer())
    bytes[0] ^= 1
    await expect(
      decryptE2eeBlob(new Blob([bytes]), cipher.key, cipher.iv)
    ).rejects.toBeTruthy()
  })

  it('缺少 key/iv 的 fragment 返回 null', () => {
    expect(parseE2eeFragment('')).toBeNull()
    expect(parseE2eeFragment('#k=only-key')).toBeNull()
  })
})
