/**
 * 回收站 API（TypeScript 版）
 */

'use strict'

import http, { type ApiResponse } from '@/utils/http'
import type { IFileVO } from '@/types'

type Callback<T> = (res: ApiResponse<T>) => void

export interface IRecycleStatVO {
  fileCount: number
  sizeBytes: number
  sizeDesc: string
}

const recycleService = {
  recycles(resolve: Callback<IFileVO[]>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<IFileVO[]>>('/recycles').then(resolve).catch(reject)
  },

  /** 回收站统计（文件数、占用空间） */
  stat(resolve: Callback<IRecycleStatVO>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<IRecycleStatVO>>('/stat').then(resolve).catch(reject)
  },

  restoreRecycle(
    data: { fileIds: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http.put<unknown, ApiResponse<unknown>>('/recycle/restore', data).then(resolve).catch(reject)
  },

  deleteRecycle(
    data: { fileIds: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http.delete<unknown, ApiResponse<unknown>>('/recycle', { data }).then(resolve).catch(reject)
  }
}

export default recycleService
