/**
 * 离线下载 API（TypeScript 版）
 */

'use strict'

import http, { type ApiResponse } from '@/utils/http'
import type { IOfflineTaskVO } from '@/types'

type Callback<T> = (res: ApiResponse<T>) => void

export default {
  create(
    data: { url: string; targetFolderId?: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http.post<unknown, ApiResponse<unknown>>('/offline/create', data).then(resolve).catch(reject)
  },

  list(
    params: { status?: string } | undefined,
    resolve: Callback<IOfflineTaskVO[]>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<IOfflineTaskVO[]>>('/offline/list', { params })
      .then(resolve)
      .catch(reject)
  },

  cancel(taskId: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<unknown>>('/offline/cancel', null, { params: { taskId } })
      .then(resolve)
      .catch(reject)
  },

  delete(taskId: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .delete<unknown, ApiResponse<unknown>>('/offline', { params: { taskId } })
      .then(resolve)
      .catch(reject)
  }
}
