/**
 * 回收站 API（TypeScript 版）
 */

'use strict'

import http, { type ApiResponse } from '@/utils/http'
import type { IFileVO } from '@/types'

type Callback<T> = (res: ApiResponse<T>) => void

const recycleService = {
  recycles(resolve: Callback<IFileVO[]>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<IFileVO[]>>('/recycles').then(resolve).catch(reject)
  },

  restoreRecycle(
    data: { fileIds: string[] },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http.put<unknown, ApiResponse<unknown>>('/recycle/restore', data).then(resolve).catch(reject)
  },

  deleteRecycle(
    data: { fileIds: string[] },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http.delete<unknown, ApiResponse<unknown>>('/recycle', { data }).then(resolve).catch(reject)
  }
}

export default recycleService
