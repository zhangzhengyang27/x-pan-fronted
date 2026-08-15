/**
 * preview —— 预览能力判定与预览 URL 拼接（P1.6）
 * 支持图片 / 视频 / 音频 / PDF / 文本 / Office / 其它
 */
import panUtil from '@/utils/common'
import { getToken } from '@/utils/cookie'

export type PreviewKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'code'
  | 'office'
  | 'docx'
  | 'excel'
  | 'pptx'
  | 'markdown'
  | 'text'
  | 'unsupported'

interface PreviewInput {
  name?: string
  filename?: string
  mimeType?: string
  extension?: string
  fileType?: number
  type?: string
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'heic', 'avif']
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'wmv', 'flv', 'ogv']
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
  'txt',
  'log',
  'sql'
]
const OFFICE_EXTS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
const DOCX_EXTS_OFFICE = ['doc', 'docx']
const EXCEL_EXTS_OFFICE = ['xls', 'xlsx']
const PPTX_EXTS_OFFICE = ['ppt', 'pptx']

/**
 * 细分 Office 类型为 docx / excel / pptx，供 @vue-office 系列组件区分渲染。
 */
export function resolveOfficeKind(ext = ''): 'docx' | 'excel' | 'pptx' | 'office' {
  const e = ext.toLowerCase()
  if (PPTX_EXTS_OFFICE.includes(e)) return 'pptx'
  if (EXCEL_EXTS_OFFICE.includes(e)) return 'excel'
  if (DOCX_EXTS_OFFICE.includes(e)) return 'docx'
  return 'office'
}

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
  if (ext === 'md') return 'markdown'
  if (CODE_EXTS.includes(ext)) return 'code'
  if (OFFICE_EXTS.includes(ext)) {
    const officeKind = resolveOfficeKind(ext)
    return officeKind === 'office' ? 'docx' : officeKind
  }
  if (ext === 'txt' || ext === 'log') return 'text'
  if (input.mimeType && input.mimeType.startsWith('image/')) return 'image'
  if (input.mimeType && input.mimeType.startsWith('video/')) return 'video'
  if (input.mimeType && input.mimeType.startsWith('audio/')) return 'audio'
  return 'unsupported'
}

export function isPreviewable(kind: PreviewKind): boolean {
  return kind !== 'unsupported'
}

const urlCache = new Map<string, Promise<string>>()
// 缓存容量上限：避免长时间浏览大量文件导致内存无界增长
const URL_CACHE_MAX = 500

/**
 * 缩略图尺寸档位：列表瓦片用小图（带宽友好），预览/详情用原图。
 * 图片类型（fileType=7）列表缩略图固定走 256 档，2x 屏也能清晰。
 */
export type ThumbnailSize = number | 'original'

/**
 * 解析预览资源 URL（带缓存 + 并发去重）
 *
 * 向后端 POST /file/preview/url 申请带短期签名 token（ptoken）的预览直链。
 * 后端返回相对路径（如 /file/preview/stream?fileId=密文&ptoken=JWT），
 * 这里用 getUrlPrefix() 拼接成完整 URL。该 URL 由浏览器原生标签（img/video/iframe）
 * 直接访问，无需再携带 Authorization 请求头，避免长期登录 token 泄露到 URL/日志/Referer。
 *
 * @param fileId 文件 id
 * @param size   缩略图边长（像素）。传 'original' 或不传则返回原图流；
 *               传数字则向后端追加 width/height 缩放参数（后端按需缩放 + 缓存）。
 *               列表瓦片务必传数字，避免加载原图占用带宽。
 *
 * 失败时降级为 getPreviewUrl 直链（authorization query 鉴权），保证可用性。
 */
export function resolvePreviewUrl(
  fileId: string | number | undefined,
  size: ThumbnailSize = 'original'
): Promise<string> {
  if (fileId === undefined) return Promise.reject(new Error('fileId is required'))

  // 缓存 key 区分尺寸档位：同一文件的缩略图与原图不可复用
  const cacheKey = `${fileId}::${size}`
  if (urlCache.has(cacheKey)) {
    return urlCache.get(cacheKey) as Promise<string>
  }

  // 尺寸参数：原图不带；缩略图追加 width/height（后端按需缩放）
  const sizeQuery =
    size !== 'original' && typeof size === 'number'
      ? `&width=${size}&height=${size}`
      : ''

  // 并发去重：同一 key 的在途请求共享一个 Promise，避免重复请求后端
  const p = fetch(
    `${panUtil.getUrlPrefix()}/file/preview/url?fileId=${encodeURIComponent(String(fileId))}${sizeQuery}`,
    {
      method: 'POST',
      headers: {
        Authorization: getToken()
      }
    }
  )
    .then((r) => r.json())
    .then((res) => {
      if (res && res.code === 0 && res.data) {
        return panUtil.getUrlPrefix() + res.data
      }
      throw new Error('preview url resolve failed')
    })
    // 降级：返回 getPreviewUrl 直链，并立即从缓存移除（不长期缓存降级 URL），
    // 保证后续请求能重新尝试 ptoken 路径（后端恢复/ptoken 续期后可自愈）。
    .catch(() => {
      urlCache.delete(cacheKey)
      return getPreviewUrl(fileId)
    })
  // 容量控制：超过上限时淘汰最旧条目
  if (urlCache.size >= URL_CACHE_MAX) {
    const oldest = urlCache.keys().next().value
    if (oldest !== undefined) urlCache.delete(oldest)
  }
  urlCache.set(cacheKey, p)
  return p
}

/**
 * 使指定文件的预览 URL 缓存失效（用于 ptoken 过期导致加载失败后重试）。
 * 失效后再次调用 resolvePreviewUrl 会向后端重新申请带新 ptoken 的 URL。
 *
 * @param fileId 文件 id
 * @param size   尺寸档位（需与 resolvePreviewUrl 调用时一致）
 */
export function invalidatePreviewUrl(
  fileId: string | number | undefined,
  size: ThumbnailSize = 'original'
): void {
  if (fileId === undefined) return
  urlCache.delete(`${fileId}::${size}`)
}

/**
 * 直接构造预览页路由（用于无需鉴权的静态资源场景）
 */
export function buildPreviewRoute(fileId: string | number): string {
  return `${panUtil.getUrlPrefix()}/preview/${fileId}`
}

/**
 * 同步构造预览资源 URL（与 panUtil.getPreviewUrl 保持一致）
 */
export function getPreviewUrl(fileId: string | number): string {
  return panUtil.getPreviewUrl(String(fileId))
}

/**
 * 同步构造下载资源 URL（不含 token）。
 * 鉴权由后端从同源 Cookie（login_token）读取，浏览器原生跳转自动携带，
 * 无需把长期登录 token 拼进 URL，避免泄露到日志/Referer/浏览器历史。
 */
export function getDownloadUrl(fileId: string | number): string {
  return (
    panUtil.getUrlPrefix() +
    '/file/download?fileId=' +
    panUtil.handleId(String(fileId))
  )
}

/**
 * 判断扩展名是否为 Office 文档
 */
export function isOffice(ext: string): boolean {
  return OFFICE_EXTS.includes(ext.toLowerCase())
}

/**
 * 判断预览类型是否为 Office 文档（细分类型）
 */
export function isOfficeKind(kind: PreviewKind): boolean {
  return kind === 'docx' || kind === 'excel' || kind === 'pptx' || kind === 'office'
}

/**
 * 从文件名中提取小写扩展名（不含点）
 */
export function getFileExtension(filename = ''): string {
  const i = filename.lastIndexOf('.')
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : ''
}

const SHIKI_LANG_MAP: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'tsx',
  jsx: 'jsx',
  vue: 'vue',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
  java: 'java',
  py: 'python',
  go: 'go',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  sh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  xml: 'xml',
  md: 'markdown',
  sql: 'sql',
  txt: 'text',
  log: 'text'
}

/**
 * 将扩展名映射为 shiki 高亮语言 id（未知回退 text）
 */
export function resolveShikiLanguage(ext: string): string {
  return SHIKI_LANG_MAP[ext.toLowerCase()] || 'text'
}

/**
 * 已内置 grammar 的 shiki 语言集合（与 code-previewer 的 langRegistry 必须保持一致）。
 * 仅覆盖前端 / Java / Python / Linux 运维常用语言，其余语言回退纯文本高亮，
 * 以避免把 shiki 全量语言打包进 vendor chunk。
 */
export const SUPPORTED_SHIKI_LANGS = new Set<string>([
  'javascript',
  'typescript',
  'tsx',
  'jsx',
  'vue',
  'html',
  'css',
  'scss',
  'less',
  'json',
  'java',
  'python',
  'bash',
  'yaml',
  'dockerfile',
  'toml',
  'ini'
])

export function isShikiLangSupported(lang: string): boolean {
  return SUPPORTED_SHIKI_LANGS.has(lang)
}

export const DOCX_EXTENSIONS = ['doc', 'docx']
export const EXCEL_EXTENSIONS = ['xls', 'xlsx']
export const PPTX_EXTENSIONS = ['ppt', 'pptx']
