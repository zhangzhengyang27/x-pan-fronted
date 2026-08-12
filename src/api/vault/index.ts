/**
 * 隐私保险箱 API（P3-4）
 *
 * 对接后端 VaultController：
 * - GET    /vault/status             → 查询保险箱状态（是否已设置密码、是否已解锁）
 * - POST   /vault/setup              → 首次设置保险箱密码（body: { password }）
 * - POST   /vault/unlock             → 解锁保险箱（body: { password }，缓存 30 分钟）
 * - POST   /vault/lock               → 锁定保险箱（清除解锁状态）
 * - GET    /vault/files              → 保险箱文件列表（需已解锁）
 * - POST   /vault/move               → 移入保险箱（body: { fileIds }，逗号分隔加密ID）
 * - POST   /vault/file/{fileId}/out  → 移出保险箱到原目录
 * - DELETE /vault/file/{fileId}      → 永久删除保险箱文件
 *
 * 说明：后端 unlock 成功返回 R<Void>（data 为 null），
 * 因此 resolve 被调用即代表解锁成功，业务方无需判断 res.data。
 */
'use strict'

import http, { type ApiResponse } from '@/utils/http'
import type { IFileVO } from '@/types'

type Callback<T> = (res: ApiResponse<T>) => void

export interface VaultStatus {
  hasPassword: boolean
  unlocked: boolean
}

const vaultService = {
  /** 查询保险箱状态 */
  status(resolve: Callback<VaultStatus>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<VaultStatus>>('/vault/status').then(resolve).catch(reject)
  },

  /** 首次设置保险箱密码 */
  setup(password: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<unknown>>('/vault/setup', { password })
      .then(resolve)
      .catch(reject)
  },

  /** 解锁保险箱（resolve 被调用即成功，密码错误走 reject 并携带 message） */
  unlock(password: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<unknown>>('/vault/unlock', { password })
      .then(resolve)
      .catch(reject)
  },

  /** 锁定保险箱 */
  lock(resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.post<unknown, ApiResponse<unknown>>('/vault/lock').then(resolve).catch(reject)
  },

  /** 获取保险箱文件列表 */
  list(resolve: Callback<IFileVO[]>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<IFileVO[]>>('/vault/files').then(resolve).catch(reject)
  },

  /** 移入保险箱（fileIds 为逗号分隔的加密文件ID串，与后端 COMMON_SEPARATOR 约定一致） */
  move(fileIds: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<unknown>>('/vault/move', { fileIds })
      .then(resolve)
      .catch(reject)
  },

  /** 移出保险箱到原目录 */
  moveOut(fileId: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<unknown>>(`/vault/file/${fileId}/out`)
      .then(resolve)
      .catch(reject)
  },

  /** 永久删除保险箱文件 */
  destroy(fileId: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .delete<unknown, ApiResponse<unknown>>(`/vault/file/${fileId}`)
      .then(resolve)
      .catch(reject)
  }
}

export default vaultService
