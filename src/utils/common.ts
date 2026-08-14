/**
 * 公共工具（TypeScript 版）
 *
 * 提供文件状态、容量转换、URL 拼接、用户名/密码校验等基础能力
 */

'use strict'

/** 文件上传状态枚举值 */
export const EFileStatus = {
  PARSING: { code: 1, text: '解析中' },
  WAITING: { code: 2, text: '等待上传' },
  UPLOADING: { code: 3, text: '正在上传' },
  PAUSE: { code: 4, text: '暂停上传' },
  SUCCESS: { code: 5, text: '上传成功' },
  FAIL: { code: 6, text: '上传失败' },
  MERGE: { code: 7, text: '服务器处理中' }
} as const

export type FileStatusCode = (typeof EFileStatus)[keyof typeof EFileStatus]['code']

export type IconName =
  | 'Folder'
  | 'Box'
  | 'Grid'
  | 'Document'
  | 'Tickets'
  | 'Notebook'
  | 'Picture'
  | 'Headset'
  | 'VideoCamera'
  | 'DataAnalysis'
  | 'Cpu'

const KB_STR = 'K'
const MB_STR = 'M'
const GB_STR = 'G'
const UNIT = 1024

interface PanUtil {
  translateFileSize(fileSize: number): string
  translateSpeed(byteSpeed: number): string
  translateTime(timeRemaining: number | undefined | null): string
  checkUsername(username: string): boolean
  checkPassword(password: string): boolean
  getFileFontElement(type: number): IconName
  getPreviewUrl(fileId: string): string
  getUrlPrefix(): string
  getChunkSize(): number
  getMaxFileSize(): number
  getChunkUploadSwitch(): boolean
  goHome(): void
  handleId(id: string): string
}

const panUtil: PanUtil = {
  translateFileSize(fileSize: number): string {
    let size = fileSize / UNIT
    let suffix = KB_STR
    if (size >= UNIT) {
      size = size / UNIT
      suffix = MB_STR
    }
    if (size >= UNIT) {
      size = size / UNIT
      suffix = GB_STR
    }
    return size.toFixed(2) + suffix
  },

  translateSpeed(byteSpeed: number): string {
    return this.translateFileSize(byteSpeed) + '/s'
  },

  translateTime(timeRemaining: number | undefined | null): string {
    if (!timeRemaining || timeRemaining === Number.POSITIVE_INFINITY) return '--:--:--'
    const t = parseInt(String(timeRemaining), 10)
    if (Number.isNaN(t)) return '--:--:--'
    const hNum = Math.floor(t / 3600)
    const mNum = Math.floor((t / 60) % 60)
    const sNum = Math.floor(t % 60)
    const pad = (n: number) => (n < 10 ? '0' + n : String(n))
    return `${pad(hNum)}:${pad(mNum)}:${pad(sNum)}`
  },

  checkUsername(username: string): boolean {
    return !!username && /^[0-9A-Za-z]{6,16}$/.test(username)
  },

  checkPassword(password: string): boolean {
    return !!password && password.length >= 8 && password.length <= 16
  },

  getFileFontElement(type: number): IconName {
    let iconName: IconName = 'Document'
    switch (type) {
      case 0:
        iconName = 'Folder'
        break
      case 2:
        iconName = 'Box'
        break
      case 3:
        iconName = 'Grid'
        break
      case 4:
        iconName = 'Document'
        break
      case 5:
        iconName = 'Tickets'
        break
      case 6:
        iconName = 'Notebook'
        break
      case 7:
        iconName = 'Picture'
        break
      case 8:
        iconName = 'Headset'
        break
      case 9:
        iconName = 'VideoCamera'
        break
      case 10:
        iconName = 'DataAnalysis'
        break
      case 11:
        iconName = 'Cpu'
        break
      default:
        break
    }
    return iconName
  },

  getPreviewUrl(fileId: string): string {
    // 不再把 token 拼进 URL query（后端已支持从 Cookie 读取登录 token，
    // 浏览器原生标签跳转会自动携带同源 Cookie，避免 token 泄露到日志/Referer）。
    return this.getUrlPrefix() + '/file/preview?fileId=' + this.handleId(fileId)
  },

  getUrlPrefix(): string {
    // 优先读取构建期注入的环境变量 VITE_API_BASE_URL（兼容 .env 配置）
    // 支持两种形式：
    //   1. 完整地址，如 http://localhost:8081
    //   2. 相对路径（nginx 反代场景），如 /api
    // 均缺失时回退到相对路径 /api（由 nginx 反代到后端 8081，避免写死端口）
    const env = import.meta.env?.VITE_API_BASE_URL
    if (env) return env
    return '/api'
  },

  getChunkSize(): number {
    // 分片大小设为 5MB：MinIO composeObject 合并要求除最后一块外每块必须 >= 5MB，
    // 故开启分片上传时固定使用 5MB 分片（对齐百度网盘 / 夸克等主流网盘的合并方式）。
    return this.getChunkUploadSwitch() ? 1024 * 1024 * 5 : this.getMaxFileSize()
  },

  getMaxFileSize(): number {
    return 1024 * 1024 * 1024 * 3
  },

  getChunkUploadSwitch(): boolean {
    return true
  },

  goHome(): void {
    window.location.href = '/'
  },

  handleId(id: string): string {
    return id.replace(/\+/g, '%2B').replace(/\//g, '%2F')
  }
}

export default panUtil

/** 压缩包后缀（后端当前仅支持 ZIP，其余仅做识别展示） */
export const ARCHIVE_EXTS = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2']

/** 判断文件是否为压缩包（供右键菜单/详情面板共用） */
export function isArchive(file: Record<string, any> | null | undefined): boolean {
  if (!file || file.fileType === 0) return false
  const fn = (file.filename || '').toLowerCase()
  return ARCHIVE_EXTS.some((ext) => fn.endsWith(ext))
}
