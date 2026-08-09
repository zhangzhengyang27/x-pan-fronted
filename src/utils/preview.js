/**
 * 文件预览工具（参考 html5-examples utils/drive-preview）
 * - resolvePreviewKind: 11 种预览类型（image/video/audio/pdf/docx/excel/pptx/markdown/code/text/unsupported）
 * - URL 缓存（10min TTL + 并发去重，参考 useDrivePreview）
 * - Shiki 语言归一化
 */
import {getToken} from '@/utils/cookie'
import panUtil from '@/utils/common'

// ─── 预览类型 ──────────────────────────────────────────────────────────────
export const PREVIEW_KINDS = [
  'image', 'video', 'audio', 'pdf', 'docx', 'excel', 'pptx',
  'markdown', 'code', 'text', 'unsupported',
]

export const IMAGE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico', 'tif', 'tiff',
]
export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'm4v', 'mkv', 'avi', 'm3u8']
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma', 'opus']
export const DOCX_EXTENSIONS = ['docx', 'doc']
export const EXCEL_EXTENSIONS = ['xlsx', 'xls', 'csv']
export const PPTX_EXTENSIONS = ['pptx', 'ppt']
export const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mdown', 'mkd']
export const CODE_EXTENSIONS = [
  'js', 'mjs', 'cjs', 'ts', 'jsx', 'tsx', 'vue', 'html', 'htm', 'css', 'scss', 'less',
  'json', 'jsonc', 'xml', 'yaml', 'yml', 'toml', 'py', 'java', 'go', 'rs', 'c', 'h',
  'cpp', 'hpp', 'cs', 'php', 'rb', 'swift', 'kt', 'sh', 'bash', 'zsh', 'sql',
  'graphql', 'proto', 'dockerfile',
]
export const TEXT_EXTENSIONS = [
  'txt', 'log', 'ini', 'conf', 'cfg', 'env', 'properties', 'srt', 'lrc', 'vtt',
]

// ─── 签名 URL 缓存 ──────────────────────────────────────────────────────────
const URL_CACHE_TTL = 10 * 60 * 1000
const urlCache = new Map()
const pendingRequests = new Map()

function buildPreviewUrl(fileId) {
  const fid = typeof fileId === 'string' ? fileId : panUtil.handleId(fileId)
  const token = encodeURIComponent(getToken() || '')
  return `${panUtil.getUrlPrefix()}/file/preview?fileId=${encodeURIComponent(fid)}&Authorization=${token}`
}

function buildDownloadUrl(fileId) {
  const fid = typeof fileId === 'string' ? fileId : panUtil.handleId(fileId)
  const token = encodeURIComponent(getToken() || '')
  return `${panUtil.getUrlPrefix()}/file/download?fileId=${encodeURIComponent(fid)}&Authorization=${token}`
}

/**
 * 获取预览 URL（带 10min 缓存 + 并发去重）
 * @param {string|number} fileId
 * @returns {Promise<string>}
 */
export async function resolvePreviewUrl(fileId) {
  const key = String(fileId)
  const cached = urlCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.url

  const pending = pendingRequests.get(key)
  if (pending) return pending

  const request = new Promise((resolve, reject) => {
    try {
      const url = buildPreviewUrl(fileId)
      urlCache.set(key, {url, expiresAt: Date.now() + URL_CACHE_TTL})
      resolve(url)
    } catch (e) {
      reject(e)
    }
  }).finally(() => {
    pendingRequests.delete(key)
  })

  pendingRequests.set(key, request)
  return request
}

/** 同步获取预览 URL（不缓存）—— 给 <img>/<video>/<audio> 直接用 */
export function getPreviewUrl(fileId) {
  return buildPreviewUrl(fileId)
}

/** 同步获取下载 URL */
export function getDownloadUrl(fileId) {
  return buildDownloadUrl(fileId)
}

// ─── 类型检测 ──────────────────────────────────────────────────────────────
export function getFileExtension(name = '') {
  const index = name.lastIndexOf('.')
  if (index <= 0 || index === name.length - 1) return ''
  return name.slice(index + 1).toLowerCase()
}

/**
 * 判定文件预览类型
 * @param {object} source {name, mimeType, extension, fileType}
 * @returns {string} preview kind
 */
export function resolvePreviewKind(source) {
  const isFolder = source.fileType === 0 || source.type === 'folder'
  if (isFolder) return 'unsupported'

  const ext = (source.extension || getFileExtension(source.name)).replace(/^\./, '').toLowerCase()
  const mime = (source.mimeType || '').toLowerCase()

  if (IMAGE_EXTENSIONS.includes(ext)) return 'image'
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video'
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio'
  if (ext === 'pdf' || mime.includes('pdf')) return 'pdf'
  if (DOCX_EXTENSIONS.includes(ext)) return 'docx'
  if (EXCEL_EXTENSIONS.includes(ext)) return 'excel'
  if (PPTX_EXTENSIONS.includes(ext)) return 'pptx'
  if (MARKDOWN_EXTENSIONS.includes(ext)) return 'markdown'
  if (CODE_EXTENSIONS.includes(ext)) return 'code'
  if (TEXT_EXTENSIONS.includes(ext)) return 'text'

  // mimeType 兜底
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('text/')) return 'text'

  return 'unsupported'
}

export function isPreviewable(kind) {
  return kind !== 'unsupported'
}

export function isOffice(kind) {
  return kind === 'docx' || kind === 'excel' || kind === 'pptx'
}

// ─── Shiki 语言归一化 ──────────────────────────────────────────────────────
export function resolveShikiLanguage(ext) {
  const map = {
    htm: 'html',
    dockerfile: 'bash',
    proto: 'json',
    toml: 'yaml',
    mjs: 'javascript',
    cjs: 'javascript',
  }
  return map[ext] || ext
}

// ─── 格式化 ────────────────────────────────────────────────────────────────
export function formatFileSize(value) {
  const bytes = typeof value === 'string' ? Number(value) : value ?? 0
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let i = 0
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(size >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
