/**
 * 文件直链 API（P0-1）
 *
 * 对接后端 DirectLinkController：
 * - POST /direct-link/create  body: { fileId }              → 创建直链（返回 token）
 * - GET  /direct-link/list                                → 当前用户直链列表
 * - POST /direct-link/toggle  body: { id, enableFlag }    → 启停（id 为加密字符串）
 * - POST /direct-link/delete  body: { id }                → 删除（id 为加密字符串）
 * - GET  /direct-link/stream?token=xxx                     → 免登录流输出（直链本体）
 *
 * 直链 URL 形如 `${origin}/direct-link/stream?token=<64位hex>`，
 * 前端在展示/复制时拼接 origin 即可。
 */
'use strict'

import http, { type ApiResponse } from '@/utils/http'

type Callback<T> = (res: ApiResponse<T>) => void

/** 对齐后端 XPanDirectLinkVO（id/fileId 为加密字符串，防 JS 精度丢失） */
export interface IDirectLinkVO {
  id: string
  fileId: string
  filename: string
  /** 64 位随机 hex */
  token: string
  enableFlag: number
  expireTime: string | null
  createTime: string
}

const directLinkService = {
  /**
   * 创建直链
   * @param fileId  加密用户文件 ID
   * @param resolve 成功回调，data 为 IDirectLinkVO（含 token）
   * @param reject  失败回调
   */
  create(fileId: string, resolve: Callback<IDirectLinkVO>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<IDirectLinkVO>>('/direct-link/create', { fileId })
      .then(resolve)
      .catch(reject)
  },

  /**
   * 查询当前用户直链列表
   */
  list(resolve: Callback<IDirectLinkVO[]>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<IDirectLinkVO[]>>('/direct-link/list')
      .then(resolve)
      .catch(reject)
  },

  /**
   * 启停直链
   * @param id        直链加密 ID
   * @param enableFlag 1 启用 0 停用
   */
  toggle(id: string, enableFlag: number, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<unknown>>('/direct-link/toggle', { id, enableFlag })
      .then(resolve)
      .catch(reject)
  },

  /**
   * 删除直链
   * @param id 直链加密 ID
   */
  remove(id: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<unknown>>('/direct-link/delete', { id })
      .then(resolve)
      .catch(reject)
  }
}

export default directLinkService
