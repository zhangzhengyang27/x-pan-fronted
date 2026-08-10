/**
 * 公共工具（TypeScript 版）
 *
 * 提供文件状态、容量转换、URL 拼接、用户名/密码校验等基础能力
 */

'use strict'

import { getToken } from '@/utils/cookie'

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
  showOperation(dom: HTMLElement): void
  hiddenOperation(dom: HTMLElement): void
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

  showOperation(dom: HTMLElement): void {
    const parentDiv = dom.firstElementChild
    if (parentDiv && parentDiv.classList.contains('el-tooltip')) {
      const div = parentDiv.lastElementChild as HTMLElement | null
      if (div) div.style.display = 'inline-block'
    }
  },

  hiddenOperation(dom: HTMLElement): void {
    const parentDiv = dom.firstElementChild
    if (parentDiv && parentDiv.classList.contains('el-tooltip')) {
      const div = parentDiv.lastElementChild as HTMLElement | null
      if (div) div.style.display = 'none'
    }
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
    return (
      this.getUrlPrefix() +
      '/file/preview?fileId=' +
      this.handleId(fileId) +
      '&authorization=' +
      getToken()
    )
  },

  getUrlPrefix(): string {
    // 优先读取构建期注入的环境变量 VITE_API_BASE_URL（兼容 .env 配置）
    // 支持两种形式：
    //   1. 完整地址，如 http://localhost:8081
    //   2. 相对路径（nginx 反代场景），如 /api
    // 均缺失时回退到本地默认后端地址
    const env = import.meta.env?.VITE_API_BASE_URL
    if (env) return env
    return 'http://127.0.0.1:8081'
  },

  getChunkSize(): number {
    return this.getChunkUploadSwitch() ? 1024 * 1024 * 1 : this.getMaxFileSize()
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
