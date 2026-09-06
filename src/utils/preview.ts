/**
 * preview —— 预览能力判定与预览 URL 拼接（P1.6）
 * 支持图片 / 视频 / 音频 / PDF / 文本 / Office / 其它
 */
import panUtil from '@/utils/common'
import { getToken } from '@/utils/cookie'
import { resolvePreviewPlugin } from '@/utils/preview-plugin'

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
  | 'csv'
  | 'archive'
  | 'xmind'
  | 'unsupported'

/**
 * 预览文件输入，字段与后端 XPanUserFileVO 对齐。
 * 文件ID 用 fileId、文件名用 filename；后端没有 name / type 字段，已移除。
 * 文件夹统一用 fileType === 0 判断（type === 'folder' 为前端臆造的冗余字段）。
 */
export interface PreviewInput {
  filename?: string
  mimeType?: string
  extension?: string
  fileType?: number
}

export const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'heic', 'avif']
export const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'wmv', 'flv', 'ogv']
export const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma']
export const PDF_EXTS = ['pdf']
export const CODE_EXTS = [
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
  if (input.fileType === 0) return 'unsupported'
  // 插件化重构：查注册表（内置插件在 plugins/preview/index.ts 注册）。
  // 注册表为空（尚未注册）时回退旧 if/else 判定，保证调用方在任何时机都可用。
  const plugin = resolvePreviewPlugin(input)
  if (plugin) return plugin.id as PreviewKind
  return legacyResolvePreviewKind(input)
}

/** 旧的 if/else 判定（保留作为「注册表为空」时的兜底，行为与重构前一致） */
function legacyResolvePreviewKind(input: PreviewInput): PreviewKind {
  const ext = (input.extension || extOf(input.filename || '')).toLowerCase()
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

// 缓存条目带写入时间戳：ptoken 约 5 分钟有效，命中时若超过 TTL 则视为失效重新申请
//（预留 1 分钟余量，避免把临期 URL 发给 img/video 后中途过期）
interface UrlCacheEntry {
  promise: Promise<string>
  ts: number
}
const urlCache = new Map<string, UrlCacheEntry>()
// 缓存容量上限：避免长时间浏览大量文件导致内存无界增长
const URL_CACHE_MAX = 500
// ptoken 有效期约 5 分钟，缓存 4 分钟即失效
const URL_CACHE_TTL_MS = 4 * 60 * 1000

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
  const hit = urlCache.get(cacheKey)
  if (hit) {
    // 未过 TTL：直接复用在途/已解析的 URL（并发去重）
    if (Date.now() - hit.ts < URL_CACHE_TTL_MS) return hit.promise
    // 已超时：旧 ptoken 可能即将过期，弃用旧条目重新申请
    urlCache.delete(cacheKey)
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
  urlCache.set(cacheKey, { promise: p, ts: Date.now() })
  return p
}

/**
 * 解析视频封面直链（后端 FFmpeg 抽帧生成的 JPEG）。
 *
 * 复用 resolvePreviewUrl 签发的 ptoken（绑定 PREVIEW_FILE_ID，任意预览端点通用），
 * 把 stream 直链中的 ptoken 抽取出来拼成 /file/video-cover?fileId=xxx&ptoken=yyy。
 * 后端 FFmpeg 不可用时会返回 404，调用方应降级为前端 canvas 采样。
 *
 * @param fileId 文件 id
 */
export async function resolveVideoCoverUrl(
  fileId: string | number | undefined
): Promise<string | null> {
  if (fileId === undefined) return null
  try {
    const streamUrl = await resolvePreviewUrl(fileId)
    // 从 stream 直链抽取 ptoken（URL 形如 /file/preview/stream?fileId=xxx&ptoken=yyy）
    const parsed = new URL(streamUrl, window.location.origin)
    const ptoken = parsed.searchParams.get('ptoken')
    if (!ptoken) return null
    return `${panUtil.getUrlPrefix()}/file/video-cover?fileId=${encodeURIComponent(String(fileId))}&ptoken=${encodeURIComponent(ptoken)}`
  } catch {
    return null
  }
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

/**
 * 按编码解码文件内容为文本（用于 Markdown/代码/文本预览）。
 * <p>
 * 后端预览流默认未声明 charset，且中文文本文件常见 GBK/GB2312 编码，
 * 直接 res.text()（强制 UTF-8）会乱码。这里：
 * 1. 有 BOM 时按 BOM 识别（UTF-8/UTF-16LE/BE）；
 * 2. 否则优先 UTF-8 严格解码，出现非法字节序列则回退 GBK（TextDecoder('gbk')，现代浏览器均支持）；
 * 3. 仍失败则按 UTF-8 宽松解码兜底（丢弃非法字节，尽量不抛错）。
 *
 * @param buffer 响应体字节
 * @param declaredCharset 响应头声明的 charset（可能为空）
 */
export function decodeTextContent(buffer: ArrayBuffer, declaredCharset?: string): string {
  const bytes = new Uint8Array(buffer)

  // 1. BOM 识别
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  }

  // 2. 响应头显式声明了非 UTF-8 的 charset
  const declared = declaredCharset?.trim().toLowerCase()
  if (declared && declared !== 'utf-8' && declared !== 'utf8') {
    try {
      return new TextDecoder(declared).decode(bytes)
    } catch {
      /* 不支持的编码标签，继续走自动检测 */
    }
  }

  // 3. 优先 UTF-8 严格解码（失败说明存在 GBK 等非 UTF-8 字节）
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    /* fallthrough */
  }

  // 4. 回退 GBK（中文文本最常见非 UTF-8 编码）
  try {
    return new TextDecoder('gbk').decode(bytes)
  } catch {
    /* fallthrough */
  }

  // 5. 最终兜底：UTF-8 宽松解码（丢弃非法字节）
  return new TextDecoder('utf-8').decode(bytes)
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
