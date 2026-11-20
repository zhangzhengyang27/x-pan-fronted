/**
 * E2EE 加密分享（Web）
 *
 * 文件格式 v2：MAGIC + 4 字节 header 长度 + JSON header + 若干 chunk。
 * 每个 chunk 独立 AES-256-GCM 加密，chunk 序号与 header 原始字节作为 AAD，
 * 因此重排、截断、篡改 header 都会在解密时失败。
 *
 * 为什么分块：
 * - WebCrypto 的 AES-GCM 没有流式 API，整文件 `arrayBuffer()` 装不下 20GB；
 * - 每个 chunk 只驻留 8MB 明文/密文，前端可以按 File.slice 逐段处理；
 * - chunk 之间的认证靠 AAD 中的序号绑定，避免把第 2 块挪到第 1 块。
 *
 * 边界：
 * - 只在 secure context（HTTPS / localhost）可用；
 * - 超过 256MB 的加密要求浏览器支持 OPFS（Chrome/Edge），否则直接报错，
 *   不退回整文件内存，避免 20GB 文件把标签页 OOM；
 * - 解密下载同理：超过内存阈值的文件必须支持 File System Access API。
 */

const MAGIC_V1 = new TextEncoder().encode('XPAN-E2EE-1')
const MAGIC_V2 = new TextEncoder().encode('XPAN-E2EE-2')
const HEADER_LEN_BYTES = 4
const GCM_IV_BYTES = 12
const GCM_TAG_BYTES = 16
const MAX_HEADER_BYTES = 64 * 1024
const MIN_CHUNK_BYTES = 64 * 1024
const MAX_CHUNK_BYTES = 16 * 1024 * 1024

/** 明文上限与后端 FileConstants 保持一致：20GB 减去密文 framing 的少量余量 */
export const E2EE_MAX_PLAINTEXT_BYTES = 20 * 1024 * 1024 * 1024 - 1024 * 1024
/** 超过该大小不再把整个文件交给 Blob 内存；Web 端改用 OPFS 落盘 */
export const E2EE_MEMORY_LIMIT_BYTES = 256 * 1024 * 1024
export const E2EE_CHUNK_SIZE = 8 * 1024 * 1024

export interface E2eeCipherResult {
  /** 待上传的密文（可能是 OPFS 支撑的 File，也可能是内存 Blob） */
  blob: Blob
  /** base64url 编码的原始 AES 密钥 */
  key: string
  /** base64url 编码的 12 字节基础 IV */
  iv: string
  /** 服务端保存用的文件名，必须以 .xpan 结尾 */
  filename: string
  /** OPFS 临时文件清理函数；内存 Blob 时为 undefined */
  cleanup?: () => Promise<void>
}

interface E2eeHeader {
  v: number
  name: string
  type: string
  size: number
  createdAt: string
  /** v2 专属：每块明文长度（最后一块可能更短） */
  chunkSize?: number
  /** v2 专属：块数量，用于防截断 */
  chunkCount?: number
}

export interface E2eeDecryptedFile {
  blob: Blob
  name: string
  type: string
  size: number
}

interface EncryptOptions {
  /** 测试与未来调优用；默认 8MB */
  chunkSize?: number
  /** 0~1，用于大文件加密进度提示 */
  onProgress?: (ratio: number) => void
}

interface WritableSink {
  write: (bytes: Uint8Array) => Promise<void>
  close: () => Promise<void>
  abort: () => Promise<void>
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

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(a.length + b.length))
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

function uint32BE(value: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(4))
  new DataView(out.buffer).setUint32(0, value, false)
  return out
}

/** 每个 chunk 的 IV = 基础 IV 的最后 4 字节 + 块序号（大端）；基础 IV 随机，密钥每分享唯一 */
function deriveChunkIv(baseIv: Uint8Array, index: number): Uint8Array<ArrayBuffer> {
  const iv = new Uint8Array(new ArrayBuffer(baseIv.length))
  iv.set(baseIv, 0)
  const view = new DataView(iv.buffer)
  const next = (view.getUint32(8, false) + index) >>> 0
  view.setUint32(8, next, false)
  return iv
}

/** header 原始字节 + 4 字节块序号；服务端改不了密文，改 header/换块顺序都会认证失败 */
function chunkAad(headerBytes: Uint8Array, index: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(headerBytes.length + 4))
  out.set(headerBytes, 0)
  new DataView(out.buffer).setUint32(headerBytes.length, index, false)
  return out
}

function normalizeChunkSize(value: number | undefined): number {
  if (!value) return E2EE_CHUNK_SIZE
  if (value < MIN_CHUNK_BYTES || value > MAX_CHUNK_BYTES) {
    throw new Error('加密分块大小不合法')
  }
  return value
}

/** OPFS 句柄的最小结构，避免依赖不同 TS lib 对 FileSystem* 的类型声明 */
interface OpfsWritable {
  write: (data: Uint8Array) => Promise<void>
  close: () => Promise<void>
  abort: () => Promise<void>
}

interface OpfsFileHandle {
  createWritable: () => Promise<OpfsWritable>
  getFile: () => Promise<File>
}

interface OpfsDirectory {
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<OpfsFileHandle>
  removeEntry: (name: string) => Promise<void>
}

interface CipherSink {
  write: (bytes: Uint8Array) => Promise<void>
  finish: () => Promise<{ blob: Blob; cleanup?: () => Promise<void> }>
  abort: () => Promise<void>
}

async function createCipherSink(fileSize: number): Promise<CipherSink> {
  if (fileSize <= E2EE_MEMORY_LIMIT_BYTES) {
    const parts: BlobPart[] = []
    return {
      write: async (bytes) => {
        parts.push(bytes)
      },
      finish: async () => ({ blob: new Blob(parts, { type: 'application/octet-stream' }) }),
      abort: async () => {
        parts.length = 0
      }
    }
  }

  const storage = navigator.storage as unknown as {
    getDirectory?: () => Promise<OpfsDirectory>
  }
  if (!storage?.getDirectory) {
    throw new Error('当前浏览器不支持大文件加密（需要 OPFS），请使用 Chrome/Edge')
  }
  const dir = await storage.getDirectory()
  const name = `e2ee-${Date.now()}-${Math.random().toString(36).slice(2)}.xpan`
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  let closed = false
  return {
    write: async (bytes) => {
      await writable.write(bytes)
    },
    finish: async () => ({
      blob: await handle.getFile(),
      cleanup: async () => {
        await dir.removeEntry(name).catch(() => undefined)
      }
    }),
    abort: async () => {
      if (closed) return
      closed = true
      await writable.abort().catch(() => undefined)
    }
  }
}

/**
 * 将原文件加密为 v2 密文。
 *
 * 不把 `file.arrayBuffer()` 一次读入：每块只读 8MB，超过 256MB 时密文写入 OPFS，
 * 最后返回一个磁盘支撑的 File；调用方上传完必须调用 `cleanup()` 删除临时文件。
 */
export async function encryptFileForShare(
  file: File,
  options: EncryptOptions = {}
): Promise<E2eeCipherResult> {
  if (!file.size) throw new Error('空文件不能加密分享')
  if (file.size > E2EE_MAX_PLAINTEXT_BYTES) {
    throw new Error('加密分享暂支持 20GB 以内文件')
  }
  const subtle = assertWebCrypto()
  const chunkSize = normalizeChunkSize(options.chunkSize)
  const chunkCount = Math.ceil(file.size / chunkSize)
  if (chunkCount > 1_000_000) throw new Error('文件分块数量过多')

  const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt'
  ])
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(GCM_IV_BYTES)))
  const header: E2eeHeader = {
    v: 2,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    createdAt: new Date().toISOString(),
    chunkSize,
    chunkCount
  }
  const headerBytes = new TextEncoder().encode(JSON.stringify(header))
  if (headerBytes.length > MAX_HEADER_BYTES) throw new Error('文件元数据过大')

  const prefix = concatBytes(
    concatBytes(MAGIC_V2, uint32BE(headerBytes.length)),
    headerBytes
  )

  const sink = await createCipherSink(file.size)
  try {
    await sink.write(prefix)
    let offset = 0
    for (let index = 0; index < chunkCount; index++) {
      const end = Math.min(offset + chunkSize, file.size)
      const plain = new Uint8Array(await file.slice(offset, end).arrayBuffer())
      const encrypted = await subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: deriveChunkIv(iv, index) as BufferSource,
          additionalData: chunkAad(headerBytes, index) as BufferSource
        },
        key,
        plain as BufferSource
      )
      await sink.write(concatBytes(uint32BE(encrypted.byteLength), new Uint8Array(encrypted)))
      offset = end
      options.onProgress?.(offset / file.size)
    }
    const result = await sink.finish()
    const rawKey = new Uint8Array(await subtle.exportKey('raw', key))
    return {
      blob: result.blob,
      key: toBase64Url(rawKey),
      iv: toBase64Url(iv),
      filename: toCipherFilename(file.name),
      cleanup: result.cleanup
    }
  } catch (error) {
    await sink.abort()
    throw error
  }
}

interface ParsedHeader {
  header: E2eeHeader
  headerBytes: Uint8Array
}

function parseHeader(magic: Uint8Array, headerBytes: Uint8Array): ParsedHeader {
  const isV2 = magic.every((b, i) => b === MAGIC_V2[i])
  if (!isV2) throw new Error('密文格式不正确')
  if (!headerBytes.length || headerBytes.length > MAX_HEADER_BYTES) {
    throw new Error('密文头部损坏')
  }
  let header: E2eeHeader
  try {
    header = JSON.parse(new TextDecoder().decode(headerBytes)) as E2eeHeader
  } catch {
    throw new Error('密文头部损坏')
  }
  if (!header || typeof header.size !== 'number' || header.size < 0) {
    throw new Error('密文头部损坏')
  }
  if (
    !Number.isInteger(header.chunkSize) ||
    Number(header.chunkSize) < MIN_CHUNK_BYTES ||
    Number(header.chunkSize) > MAX_CHUNK_BYTES ||
    !Number.isInteger(header.chunkCount) ||
    Number(header.chunkCount) < 1
  ) {
    throw new Error('密文头部分块信息损坏')
  }
  const expectedChunks = Math.ceil(header.size / Number(header.chunkSize))
  if (Number(header.chunkCount) !== expectedChunks) throw new Error('密文分块数量不一致')
  return { header, headerBytes }
}

/** 顺序读取 Blob 或 fetch body；大文件解密时不能把全部密文放进内存 */
class ByteReader {
  private offset = 0
  private pending = new Uint8Array(0)
  private readonly stream?: ReadableStreamDefaultReader<Uint8Array>

  constructor(private readonly blob?: Blob, stream?: ReadableStream<Uint8Array>) {
    if (stream) this.stream = stream.getReader()
  }

  async read(count: number): Promise<Uint8Array> {
    if (count <= 0) return new Uint8Array(0)
    if (this.blob) {
      const buffer = await this.blob.slice(this.offset, this.offset + count).arrayBuffer()
      if (buffer.byteLength !== count) throw new Error('密文被截断')
      this.offset += count
      return new Uint8Array(buffer)
    }
    while (this.pending.length < count) {
      if (!this.stream) throw new Error('密文读取失败')
      const { done, value } = await this.stream.read()
      if (done) throw new Error('密文被截断')
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer)
      this.pending = this.pending.length
        ? concatBytes(this.pending, bytes)
        : new Uint8Array(bytes)
    }
    const out = this.pending.slice(0, count)
    this.pending = this.pending.slice(count)
    return out
  }

  async readRemaining(): Promise<Uint8Array> {
    if (this.blob) {
      const buffer = await this.blob.slice(this.offset).arrayBuffer()
      this.offset = this.blob.size
      return new Uint8Array(buffer)
    }
    if (!this.stream) throw new Error('密文读取失败')
    const chunks: Uint8Array[] = []
    if (this.pending.length) chunks.push(this.pending)
    this.pending = new Uint8Array(0)
    while (true) {
      const { done, value } = await this.stream.read()
      if (done) break
      chunks.push(value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer))
    }
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const out = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      out.set(chunk, offset)
      offset += chunk.length
    }
    return out
  }
}

async function readParsedHeader(reader: ByteReader): Promise<ParsedHeader> {
  const prefix = await reader.read(MAGIC_V2.length)
  const headerLenBytes = await reader.read(HEADER_LEN_BYTES)
  const headerLen = new DataView(headerLenBytes.buffer).getUint32(0, false)
  const headerBytes = await reader.read(headerLen)
  return parseHeader(prefix, headerBytes)
}

async function decryptV2(
  reader: ByteReader,
  parsed: ParsedHeader,
  key: CryptoKey,
  baseIv: Uint8Array,
  write: (bytes: Uint8Array) => Promise<void>
): Promise<void> {
  const { header, headerBytes } = parsed
  const chunkSize = Number(header.chunkSize)
  const chunkCount = Number(header.chunkCount)
  let written = 0
  for (let index = 0; index < chunkCount; index++) {
    const cipherLenBytes = await reader.read(4)
    const cipherLen = new DataView(cipherLenBytes.buffer).getUint32(0, false)
    const expectedPlainLen = Math.min(chunkSize, header.size - written)
    if (cipherLen !== expectedPlainLen + GCM_TAG_BYTES) {
      throw new Error('密文分块长度不一致')
    }
    const cipher = await reader.read(cipherLen)
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: deriveChunkIv(baseIv, index) as BufferSource,
          additionalData: chunkAad(headerBytes, index) as BufferSource
        },
        key,
        cipher as BufferSource
      )
    )
    if (plain.length !== expectedPlainLen) throw new Error('密文分块长度不一致')
    written += plain.length
    await write(plain)
  }
  if (written !== header.size) throw new Error('明文长度与头部声明不一致')
}

/**
 * 解密并逐块写入 sink。
 *
 * 分享页把 fetch 的 `response.body` 直接传进来，避免先把 20GB 密文变成 Blob；
 * 不传 sink 时收集成 Blob（只适合小文件）。
 */
export async function decryptE2eeToWritable(
  source: Blob | ReadableStream<Uint8Array>,
  keyBase64Url: string,
  ivBase64Url: string,
  sink?: WritableSink
): Promise<Omit<E2eeDecryptedFile, 'blob'>> {
  const subtle = assertWebCrypto()
  const key = await subtle.importKey(
    'raw',
    fromBase64Url(keyBase64Url) as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  const parser = new ByteReader(
    source instanceof Blob ? source : undefined,
    source instanceof Blob ? undefined : source
  )
  const parsed = await readParsedHeader(parser)
  const { header } = parsed
  const baseIv = fromBase64Url(ivBase64Url)
  if (baseIv.length !== GCM_IV_BYTES) throw new Error('解密 IV 长度不正确')

  if (!sink) throw new Error('大文件解密需要可写文件流')
  await decryptV2(parser, parsed, key, baseIv, sink.write)
  return {
    name: header.name || 'download',
    type: header.type || 'application/octet-stream',
    size: header.size
  }
}

/**
 * 兼容 v1 密文：v1 没有外层 header，整段密文解出来才是 MAGIC+header+文件。
 * v1 明文上限 200MB，因此只需在内存兜底路径调用，不影响 20GB 流式下载。
 */
async function decryptLegacyV1(
  cipher: Blob,
  keyBase64Url: string,
  ivBase64Url: string
): Promise<E2eeDecryptedFile> {
  const subtle = assertWebCrypto()
  const key = await subtle.importKey(
    'raw',
    fromBase64Url(keyBase64Url) as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  const iv = fromBase64Url(ivBase64Url)
  const decrypted = new Uint8Array(
    await subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      (await cipher.arrayBuffer()) as BufferSource
    )
  )
  if (decrypted.length < MAGIC_V1.length + HEADER_LEN_BYTES) throw new Error('密文格式不正确')
  for (let i = 0; i < MAGIC_V1.length; i++) {
    if (decrypted[i] !== MAGIC_V1[i]) throw new Error('密文格式不正确')
  }
  const headerLen = new DataView(decrypted.buffer).getUint32(MAGIC_V1.length, false)
  const headerStart = MAGIC_V1.length + HEADER_LEN_BYTES
  const headerEnd = headerStart + headerLen
  if (headerLen <= 0 || headerEnd > decrypted.length) throw new Error('密文头部损坏')
  const header = JSON.parse(
    new TextDecoder().decode(decrypted.subarray(headerStart, headerEnd))
  ) as E2eeHeader
  const payload = decrypted.subarray(headerEnd)
  if (Number(header.size) !== payload.length) throw new Error('明文长度与头部声明不一致')
  return {
    blob: new Blob([payload], { type: header.type || 'application/octet-stream' }),
    name: header.name || 'download',
    type: header.type || 'application/octet-stream',
    size: payload.length
  }
}

export async function decryptE2eeBlob(
  cipher: Blob,
  keyBase64Url: string,
  ivBase64Url: string
): Promise<E2eeDecryptedFile> {
  try {
    const chunks: Uint8Array[] = []
    const meta = await decryptE2eeToWritable(cipher, keyBase64Url, ivBase64Url, {
      write: async (bytes) => {
        chunks.push(bytes)
      },
      close: async () => undefined,
      abort: async () => undefined
    })
    return {
      ...meta,
      blob: new Blob(chunks, { type: meta.type })
    }
  } catch (error) {
    // v1 没有外层 MAGIC，无法在解析阶段可靠识别；用一次 v1 解密尝试兜底。
    // 如果 v2 只是被篡改/截断，v1 解密也会失败，此时保留 v2 的原始错误。
    try {
      return await decryptLegacyV1(cipher, keyBase64Url, ivBase64Url)
    } catch {
      throw error
    }
  }
}

/** 创建“写入用户选择的目标文件”的 sink；调用方负责 showSaveFilePicker */
export interface E2eeFileWriteHandle {
  write: (bytes: Uint8Array) => Promise<void>
  close: () => Promise<void>
  abort: () => Promise<void>
}

/**
 * File System Access API 的轻包装。
 * 不支持该 API 的浏览器返回 null，由调用方提示用户改用 Chrome/Edge。
 */
export async function pickE2eeSaveHandle(
  suggestedName: string
): Promise<E2eeFileWriteHandle | null> {
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (options: { suggestedName?: string }) => Promise<{
        createWritable: () => Promise<{
          write: (data: Uint8Array) => Promise<void>
          close: () => Promise<void>
          abort: () => Promise<void>
        }>
      }>
    }
  ).showSaveFilePicker
  if (!picker) return null
  const handle = await picker({ suggestedName })
  const writable = await handle.createWritable()
  return {
    write: async (bytes) => writable.write(bytes),
    close: async () => writable.close(),
    abort: async () => writable.abort()
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
