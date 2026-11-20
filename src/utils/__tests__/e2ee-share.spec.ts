import { describe, expect, it } from 'vitest'
import {
  buildE2eeShareUrl,
  decryptE2eeBlob,
  decryptE2eeToWritable,
  encryptFileForShare,
  parseE2eeFragment
} from '@/utils/e2ee-share'

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** 手工构造 v1 密文，锁住“已发出的旧分享仍能解密” */
async function buildLegacyV1(file: File): Promise<{ blob: Blob; key: string; iv: string }> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt'])
  const header = new TextEncoder().encode(
    JSON.stringify({ v: 1, name: file.name, type: file.type, size: file.size, createdAt: '' })
  )
  const payload = new Uint8Array(await file.arrayBuffer())
  const magic = new TextEncoder().encode('XPAN-E2EE-1')
  const plain = new Uint8Array(magic.length + 4 + header.length + payload.length)
  plain.set(magic, 0)
  new DataView(plain.buffer).setUint32(magic.length, header.length, false)
  const headerStart = magic.length + 4
  plain.set(header, headerStart)
  plain.set(payload, headerStart + header.length)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
  return { blob: new Blob([encrypted]), key: base64Url(keyBytes), iv: base64Url(iv) }
}

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

  it('v2 多分块按顺序还原，并能流式写入 sink', async () => {
    const source = new Uint8Array(180 * 1024)
    for (let i = 0; i < source.length; i++) source[i] = i % 251
    const plain = new File([source], 'chunked.bin', { type: 'application/octet-stream' })
    const cipher = await encryptFileForShare(plain, { chunkSize: 64 * 1024 })

    const chunks: Uint8Array[] = []
    const meta = await decryptE2eeToWritable(cipher.blob, cipher.key, cipher.iv, {
      write: async (bytes) => {
        chunks.push(bytes)
      },
      close: async () => undefined,
      abort: async () => undefined
    })
    const restored = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0))
    let offset = 0
    for (const chunk of chunks) {
      restored.set(chunk, offset)
      offset += chunk.length
    }
    expect(meta.size).toBe(source.length)
    expect(restored).toEqual(source)
  })

  it('v2 密文被截断时解密失败，不会返回残缺文件', async () => {
    const cipher = await encryptFileForShare(
      new File([new Uint8Array(100 * 1024)], 'broken.bin'),
      { chunkSize: 64 * 1024 }
    )
    const truncated = cipher.blob.slice(0, cipher.blob.size - 10)
    await expect(decryptE2eeBlob(truncated, cipher.key, cipher.iv)).rejects.toBeTruthy()
  })

  it('v1 旧密文仍可通过内存兜底解密', async () => {
    const legacy = await buildLegacyV1(new File(['legacy content'], 'old.txt', { type: 'text/plain' }))
    const restored = await decryptE2eeBlob(legacy.blob, legacy.key, legacy.iv)
    expect(restored.name).toBe('old.txt')
    expect(await restored.blob.text()).toBe('legacy content')
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
