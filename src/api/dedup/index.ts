/**
 * 文件去重 / 占用分析 API —— 对接后端 P4 FileDedupController
 * - GET  /file/dedup/list     重复文件分组
 * - GET  /file/dedup/stat     去重统计（可释放字节）
 * - POST /file/dedup/release  释放冗余引用 body: { keepFileIds: string[] }
 *
 * 所有 id 均为后端加密字符串，前端原样透传。
 */
'use strict'

import http, { type ApiResponse } from '@/utils/http'

type Callback<T> = (res: ApiResponse<T>) => void

export interface IDedupItemVO {
  fileId: string
  filename: string
  parentId: string
}

export interface IDedupGroupVO {
  realFileId: string
  fileSize: number
  fileSizeDesc: string
  refCount: number
  releasableBytes: number
  items: IDedupItemVO[]
}

export interface IDedupStatVO {
  groupCount: number
  redundantCount: number
  releasableBytes: number
  releasableDesc: string
}

const dedupService = {
  /** 查询重复文件分组 */
  list(resolve: Callback<IDedupGroupVO[]>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<IDedupGroupVO[]>>('/file/dedup/list').then(resolve).catch(reject)
  },

  /** 去重统计 */
  stat(resolve: Callback<IDedupStatVO>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<IDedupStatVO>>('/file/dedup/stat').then(resolve).catch(reject)
  },

  /** 释放冗余引用（保留指定文件，其余去重；每组至少保留一个） */
  release(keepFileIds: string[], resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<unknown>>('/file/dedup/release', { keepFileIds })
      .then(resolve)
      .catch(reject)
  }
}

export default dedupService
