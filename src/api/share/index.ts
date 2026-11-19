/**
 * 分享相关 API（TypeScript 版）
 */

'use strict'

import http, { type ApiResponse } from '@/utils/http'
import simpleHttp, { type ApiResponse as SA } from '@/utils/simple-http'
import type { IShareCreateReq, IShareVO, IFileVO, IShareStatsVO, PageVO } from '@/types'

type Callback<T> = (res: ApiResponse<T>) => void
type SimpleCallback<T> = (res: SA<T>) => void

const shareService = {
  getShareDetail(resolve: SimpleCallback<IShareVO>) {
    simpleHttp.get<unknown, SA<IShareVO>>('/share').then(resolve)
  },

  createShare(data: IShareCreateReq, resolve: Callback<IShareVO>, reject: Callback<unknown>) {
    http.post<unknown, ApiResponse<IShareVO>>('/share', data).then(resolve).catch(reject)
  },

  cancelShare(data: { shareIds: string[] }, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.delete<unknown, ApiResponse<unknown>>('/share', { data }).then(resolve).catch(reject)
  },

  checkShareCode(data: { shareId: string; shareCode: string }, resolve: SimpleCallback<unknown>) {
    simpleHttp.post<unknown, SA<unknown>>('/share/code/check', data).then(resolve)
  },

  getShareFiles(
    params: { parentId: string; pageNum?: number; pageSize?: number },
    resolve: SimpleCallback<PageVO<IFileVO>>
  ) {
    simpleHttp.get<unknown, SA<PageVO<IFileVO>>>('/share/file/list', { params }).then(resolve)
  },

  saveShareFiles(
    data: { fileIds: string[]; targetParentId: string },
    resolve: SimpleCallback<unknown>
  ) {
    simpleHttp.post<unknown, SA<unknown>>('/share/save', data).then(resolve)
  },

  getShares(
    resolve: Callback<{ shares: IShareVO[]; stats: IShareStatsVO }>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<{ shares: IShareVO[]; stats: IShareStatsVO }>>('/shares')
      .then(resolve)
      .catch(reject)
  },

  getSimpleShareDetail(params: { shareId: string }, resolve: SimpleCallback<IShareVO>) {
    simpleHttp.get<unknown, SA<IShareVO>>('/share/simple', { params }).then(resolve)
  },

  collectShare(
    file: File,
    resolve: SimpleCallback<unknown>,
    reject: SimpleCallback<unknown> = () => {}
  ) {
    // 文件收集接口走 Share-Token（@NeedShareCode），simpleHttp 会自动带 token；
    // 不把 shareId 放请求体，避免伪造 IDOR，后端只认 token 中的分享 ID。
    const form = new FormData()
    form.append('file', file)
    simpleHttp
      .post<unknown, SA<unknown>>('/share/collect', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      .then(resolve)
      .catch(reject)
  },

  /** 修改已有分享的文件收集开关；开启只对“单个文件夹分享”生效，后端会再次校验 */
  setShareCollect(
    shareId: string,
    enabled: boolean,
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .put<unknown, ApiResponse<unknown>>(`/share/${encodeURIComponent(shareId)}/collect`, null, {
        params: { enabled }
      })
      .then(resolve)
      .catch(reject)
  },

  reportShare(
    data: { shareId: string; reason: string },
    resolve: SimpleCallback<unknown>,
    reject: SimpleCallback<unknown> = () => {}
  ) {
    // 举报要求登录：后端会绑定 userId 做限流与追溯；未登录时由页面先弹登录框
    simpleHttp.post<unknown, SA<unknown>>('/share/report', data).then(resolve).catch(reject)
  }
}

export default shareService
