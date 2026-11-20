/**
 * E2EE 加密分享（Web MVP）
 *
 * 设计要点：
 * - 浏览器生成 AES-256-GCM 密钥，服务端只接触密文；
 * - 明文封装为 MAGIC + 4 字节 header 长度 + JSON header + 原文件字节，
 *   header 里保留文件名/MIME/大小，接收方解密后可直接还原下载名；
 * - 密钥与 IV 只放在分享 URL 的 fragment（# 后），fragment 不会进入 HTTP 请求、
 *   服务端日志或 Referer；复制链接时整段复制即可。
 *
 * 边界：MVP 只在 secure context（https / localhost）可用；整文件读入内存，
 * 因此分享侧限制 200MB，超过时直接拒绝而不是让浏览器 OOM。
 */

const MAGIC = new TextEncoder().encode('XPAN-E2EE-1')
const HEADER_LEN_BYTES = 4
const GCM_IV_BYTES = 12
export const E2EE_MAX_PLAINTEXT_BYTES = 200 * 1024 * 1024

export interface E2eeCipherResult {
  /** 待上传的密文文件（application/octet-stream） */
  blob: Blob
  /** base64url 编码的原始 AES 密钥 */
  key: string
  /** base64url 编码的 12 字节 IV */
  iv: string
  /** 服务端保存用的文件名，必须以 .xpan 结尾 */
  filename: string
}

interface E2eeHeader {
  v: number
  name: string
  type: string
  size: number
  createdAt: string
}

function assertWebCrypto(): SubtleCrypto {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('当前浏览器不支持 WebCrypto，请使用 HTTPS 或 localhost 打开')
  }
  return crypto.subtle
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 服务端文件名校验只接受 .xpan，且不能含路径分隔符；这里同步清洗，避免上传被拒 */
function toCipherFilename(name: string): string {
  const base = (name || 'file').replace(/[\\/:*?"<>|]/g, '_')
  const maxBase = 200
  return (base.length > maxBase ? base.slice(0, maxBase) : base) + '.xpan'
}

export async function encryptFileForShare(file: File): Promise<E2eeCipherResult> {
  if (file.size > E2EE_MAX_PLAINTEXT_BYTES) {
    throw new Error('加密分享暂支持 200MB 以内文件')
  }
  const subtle = assertWebCrypto()
  const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt'
  ])
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES))
  const header: E2eeHeader = {
    v: 1,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    createdAt: new Date().toISOString()
  }
  const headerBytes = new TextEncoder().encode(JSON.stringify(header))
  const fileBytes = new Uint8Array(await file.arrayBuffer())
  const plain = new Uint8Array(
    MAGIC.length + HEADER_LEN_BYTES + headerBytes.length + fileBytes.length
  )
  plain.set(MAGIC, 0)
  new DataView(plain.buffer).setUint32(MAGIC.length, headerBytes.length, false)
  plain.set(headerBytes, MAGIC.length + HEADER_LEN_BYTES)
  plain.set(fileBytes, MAGIC.length + HEADER_LEN_BYTES + headerBytes.length)

  const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
  const rawKey = new Uint8Array(await subtle.exportKey('raw', key))

  return {
    blob: new Blob([encrypted], { type: 'application/octet-stream' }),
    key: toBase64Url(rawKey),
    iv: toBase64Url(iv),
    filename: toCipherFilename(file.name)
  }
}

export interface E2eeDecryptedFile {
  blob: Blob
  name: string
  type: string
  size: number
}

export async function decryptE2eeBlob(
  cipher: Blob,
  keyBase64Url: string,
  ivBase64Url: string
): Promise<E2eeDecryptedFile> {
  const subtle = assertWebCrypto()
  const rawKey = fromBase64Url(keyBase64Url)
  const iv = fromBase64Url(ivBase64Url)
  const key = await subtle.importKey('raw', rawKey as BufferSource, { name: 'AES-GCM' }, false, ['decrypt'])
  const decrypted = new Uint8Array(
    await subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, await cipher.arrayBuffer())
  )
  if (decrypted.length < MAGIC.length + HEADER_LEN_BYTES) {
    throw new Error('密文格式不正确')
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (decrypted[i] !== MAGIC[i]) throw new Error('密文格式不正确')
  }
  const headerLen = new DataView(decrypted.buffer).getUint32(MAGIC.length, false)
  const headerStart = MAGIC.length + HEADER_LEN_BYTES
  const headerEnd = headerStart + headerLen
  if (headerLen <= 0 || headerEnd > decrypted.length) throw new Error('密文头部损坏')
  const header = JSON.parse(
    new TextDecoder().decode(decrypted.subarray(headerStart, headerEnd))
  ) as E2eeHeader
  const payload = decrypted.subarray(headerEnd)
  // GCM 已保证密文未被篡改；这里再校验 header 声明的大小，防分享者/工具构造出截断明文
  if (Number(header.size) !== payload.length) throw new Error('明文长度与头部声明不一致')
  return {
    blob: new Blob([payload], { type: header.type || 'application/octet-stream' }),
    name: header.name || 'download',
    type: header.type || 'application/octet-stream',
    size: payload.length
  }
}

/** 分享 URL 的 fragment 形如 #k=<key>&iv=<iv>；不接受空值，避免用户拿到坏链接还以为能解密 */
export function parseE2eeFragment(hash: string): { key: string; iv: string } | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  const key = params.get('k') || ''
  const iv = params.get('iv') || ''
  if (!key || !iv) return null
  return { key, iv }
}

export function buildE2eeShareUrl(baseUrl: string, key: string, iv: string): string {
  return `${baseUrl}#k=${encodeURIComponent(key)}&iv=${encodeURIComponent(iv)}`
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 立即 revoke 会让部分浏览器取消下载，延迟释放更稳
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
