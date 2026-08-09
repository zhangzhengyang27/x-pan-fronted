/**
 * 分享相关 API（TypeScript 版）
 */

'use strict'

import http, { type ApiResponse } from '@/utils/http'
import simpleHttp, { type ApiResponse as SA } from '@/utils/simple-http'
import type { IShareCreateReq, IShareVO, IFileVO, IShareStatsVO } from '@/types'

type Callback<T> = (res: ApiResponse<T>) => void
type SimpleCallback<T> = (res: SA<T>) => void

const shareService = {
  getShareDetail(resolve: SimpleCallback<IShareVO>) {
    simpleHttp.get<unknown, SA<IShareVO>>('/share')
      .then(resolve)
  },

  createShare(data: IShareCreateReq, resolve: Callback<IShareVO>, reject: Callback<unknown>) {
    http.post<unknown, ApiResponse<IShareVO>>('/share', data)
      .then(resolve).catch(reject)
  },

  cancelShare(data: { shareId: string }, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.delete<unknown, ApiResponse<unknown>>('/share', { data })
      .then(resolve).catch(reject)
  },

  checkShareCode(data: { shareId: string; code: string }, resolve: SimpleCallback<unknown>) {
    simpleHttp.post<unknown, SA<unknown>>('/share/code/check', data)
      .then(resolve)
  },

  getShareFiles(params: { shareId: string }, resolve: SimpleCallback<IFileVO[]>) {
    simpleHttp.get<unknown, SA<IFileVO[]>>('/share/file/list', { params })
      .then(resolve)
  },

  saveShareFiles(data: { shareId: string; fileIds: string[]; targetParentId: string }, resolve: SimpleCallback<unknown>) {
    simpleHttp.post<unknown, SA<unknown>>('/share/save', data)
      .then(resolve)
  },

  getShares(resolve: Callback<{ shares: IShareVO[]; stats: IShareStatsVO }>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<{ shares: IShareVO[]; stats: IShareStatsVO }>>('/shares')
      .then(resolve).catch(reject)
  },

  getSimpleShareDetail(params: { shareId: string }, resolve: SimpleCallback<IShareVO>) {
    simpleHttp.get<unknown, SA<IShareVO>>('/share/simple', { params })
      .then(resolve)
  }
}

export default shareService