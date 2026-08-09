/**
 * 文件预览相关工具
 * - getPreviewUrl(fileId): 给 <img>/<video>/<audio> 用的预览流 URL（带 token）
 * - getDownloadUrl(fileId): 下载 URL
 * - getPreviewKind(filename, fileType): 判断预览类型 image/video/audio/code/markdown/pdf/office/unsupported
 * - getCodeLanguage(filename): 从扩展名映射 shiki 语言
 * - formatFileSize(bytes): 人类可读
 */
import {getToken} from '@/utils/cookie'
import panUtil from '@/utils/common'

export function getPreviewUrl(fileId) {
  const fid = typeof fileId === 'string' ? fileId : panUtil.handleId(fileId)
  const token = getToken() || ''
  return `${panUtil.getUrlPrefix()}/file/preview?fileId=${encodeURIComponent(fid)}&Authorization=${encodeURIComponent(token)}`
}

export function getDownloadUrl(fileId) {
  const fid = typeof fileId === 'string' ? fileId : panUtil.handleId(fileId)
  const token = getToken() || ''
  return `${panUtil.getUrlPrefix()}/file/download?fileId=${encodeURIComponent(fid)}&Authorization=${encodeURIComponent(token)}`
}

const IMG_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif']
const VIDEO_EXT = ['mp4', 'webm', 'ogg', 'mov', 'm4v', 'mkv']
const AUDIO_EXT = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a']
const CODE_EXT = [
  'js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css', 'scss', 'sass', 'less',
  'vue', 'svelte', 'py', 'java', 'kt', 'go', 'rs', 'c', 'cpp', 'h', 'hpp',
  'cs', 'php', 'rb', 'swift', 'm', 'mm', 'sh', 'bash', 'zsh', 'sql', 'xml',
  'yaml', 'yml', 'toml', 'ini', 'conf', 'log', 'md', 'txt',
]
const MD_EXT = ['md', 'markdown']
const PDF_EXT = ['pdf']

export function getExt(name = '') {
  const m = String(name).match(/\.([a-zA-Z0-9]+)$/)
  return m ? m[1].toLowerCase() : ''
}

/**
 * 根据 filename/fileType 推断预览类型
 * 后端 fileType 约定（参考 file-table）：
 *   0=文件夹 3/4=文档 5/6=iframe(pdf/office) 7=image 8=audio 9=video 10=office 11=code
 */
export function getPreviewKind(filename, fileType) {
  const ext = getExt(filename)
  if (IMG_EXT.includes(ext)) return 'image'
  if (VIDEO_EXT.includes(ext)) return 'video'
  if (AUDIO_EXT.includes(ext)) return 'audio'
  if (PDF_EXT.includes(ext)) return 'pdf'
  if (MD_EXT.includes(ext)) return 'markdown'
  if (CODE_EXT.includes(ext)) return 'code'

  // 退化按 fileType 推断
  if (fileType === 7) return 'image'
  if (fileType === 8) return 'audio'
  if (fileType === 9) return 'video'
  if (fileType === 11) return 'code'
  return 'unsupported'
}

const CODE_LANG_MAP = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  json: 'json', html: 'html', css: 'css', scss: 'scss', sass: 'sass', less: 'less',
  vue: 'vue', svelte: 'svelte',
  py: 'python', java: 'java', kt: 'kotlin', go: 'go', rs: 'rust',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  cs: 'csharp', php: 'php', rb: 'ruby', swift: 'swift',
  m: 'objc', mm: 'objc',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  sql: 'sql', xml: 'xml', yaml: 'yaml', yml: 'yaml',
  toml: 'toml', ini: 'ini', conf: 'ini', log: 'log',
  md: 'markdown', txt: 'plaintext',
}

export function getCodeLanguage(filename) {
  return CODE_LANG_MAP[getExt(filename)] || 'plaintext'
}

export function formatFileSize(bytes) {
  if (!bytes || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return v.toFixed(v >= 100 || i === 0 ? 0 : 1) + ' ' + units[i]
}