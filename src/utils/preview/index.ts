/**
 * preview —— 预览能力判定与预览 URL 拼接（P1.6）
 * 支持图片 / 视频 / 音频 / PDF / 文本 / Office / 其它
 */
import panUtil from '@/utils/common'

export type PreviewKind =
  'image' | 'video' | 'audio' | 'pdf' | 'code' | 'office' | 'text' | 'unsupported'

interface PreviewInput {
  name?: string
  filename?: string
  mimeType?: string
  extension?: string
  fileType?: number
  type?: string
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'heic', 'avif']
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'wmv', 'flv', 'm3u8', 'ogv']
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma']
const PDF_EXTS = ['pdf']
const CODE_EXTS = [
  'js',
  'ts',
  'tsx',
  'jsx',
  'vue',
  'html',
  'css',
  'scss',
  'less',
  'json',
  'java',
  'py',
  'go',
  'c',
  'cpp',
  'h',
  'sh',
  'yml',
  'yaml',
  'xml',
  'md',
  'txt',
  'log',
  'sql'
]
const OFFICE_EXTS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']

function extOf(name = ''): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function resolvePreviewKind(input: PreviewInput): PreviewKind {
  if (input.fileType === 0 || input.type === 'folder') return 'unsupported'
  const ext = (input.extension || extOf(input.name || input.filename || '')).toLowerCase()
  if (IMAGE_EXTS.includes(ext)) return 'image'
  if (VIDEO_EXTS.includes(ext)) return 'video'
  if (AUDIO_EXTS.includes(ext)) return 'audio'
  if (PDF_EXTS.includes(ext)) return 'pdf'
  if (CODE_EXTS.includes(ext)) return 'code'
  if (OFFICE_EXTS.includes(ext)) return 'office'
  if (ext === 'txt' || ext === 'md' || ext === 'log') return 'text'
  if (input.mimeType && input.mimeType.startsWith('image/')) return 'image'
  if (input.mimeType && input.mimeType.startsWith('video/')) return 'video'
  if (input.mimeType && input.mimeType.startsWith('audio/')) return 'audio'
  return 'unsupported'
}

export function isPreviewable(kind: PreviewKind): boolean {
  return kind !== 'unsupported'
}

const urlCache = new Map<string | number, Promise<string>>()

/**
 * 解析预览资源 URL（带缓存 + 并发去重）
 * 通过 /api/file/preview 获取真实预览地址
 */
export function resolvePreviewUrl(fileId: string | number | undefined): Promise<string> {
  if (fileId === undefined) return Promise.reject(new Error('fileId is required'))
  if (urlCache.has(fileId)) {
    return urlCache.get(fileId) as Promise<string>
  }
  const p = fetch(panUtil.getUrlPrefix() + '/file/preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: ''
    },
    body: JSON.stringify({ fileId })
  })
    .then((r) => r.json())
    .then((res) => {
      if (res && res.code === 0 && res.data) return res.data
      throw new Error('preview url resolve failed')
    })
  urlCache.set(fileId, p)
  return p
}

/**
 * 直接构造预览页路由（用于无需鉴权的静态资源场景）
 */
export function buildPreviewRoute(fileId: string | number): string {
  return `${panUtil.getUrlPrefix()}/preview/${fileId}`
}
