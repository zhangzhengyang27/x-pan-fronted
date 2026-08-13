/**
 * 文件相关 API（TypeScript 版）
 */

'use strict'

import http, { type ApiResponse } from '@/utils/http'
import type { IFileVO, IFileVersionVO, PageVO } from '@/types'

type Callback<T> = (res: ApiResponse<T>) => void

const fileService = {
  list(
    params: {
      parentId: string
      fileTypes?: string
      pageNum?: number
      pageSize?: number
      keyword?: string
      orderBy?: string
      order?: string
    },
    resolve: Callback<PageVO<IFileVO>>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<PageVO<IFileVO>>>('/files', { params })
      .then(resolve)
      .catch(reject)
  },

  createFolder(
    data: { parentId: string; filename: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http.post<unknown, ApiResponse<unknown>>('/file/folder', data).then(resolve).catch(reject)
  },

  update(
    data: { fileId: string; filename?: string; parentId?: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http.put<unknown, ApiResponse<unknown>>('/file', data).then(resolve).catch(reject)
  },

  delete(data: { fileIds: string }, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.delete<unknown, ApiResponse<unknown>>('/file', { data }).then(resolve).catch(reject)
  },

  getFolderTree(resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<unknown>>('/file/folder/tree').then(resolve).catch(reject)
  },

  transfer(
    data: { fileIds: string; targetParentId: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http.post<unknown, ApiResponse<unknown>>('/file/transfer', data).then(resolve).catch(reject)
  },

  copy(
    data: { fileIds: string; targetParentId: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http.post<unknown, ApiResponse<unknown>>('/file/copy', data).then(resolve).catch(reject)
  },

  search(
    params: {
      keyword: string
      fileTypes?: string
      extensions?: string
      dateFrom?: string
      dateTo?: string
    },
    resolve: Callback<IFileVO[]>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<IFileVO[]>>('/file/search', { params })
      .then(resolve)
      .catch(reject)
  },

  /** 搜索联想（P4-5 后端 suggest，基于用户历史 + 文件名前缀） */
  suggest(
    prefix: string,
    resolve: Callback<string[]>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<string[]>>('/file/search/suggest', { params: { prefix } })
      .then(resolve)
      .catch(reject)
  },

  /** 热搜榜（P4-5 全站聚合） */
  hot(limit: number, resolve: Callback<string[]>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<string[]>>('/file/search/hot', { params: { limit } })
      .then(resolve)
      .catch(reject)
  },

  getBreadcrumbs(
    params: { fileId: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<unknown>>('/file/breadcrumbs', { params })
      .then(resolve)
      .catch(reject)
  },

  secUpload(
    data: { filename: string; identifier: string; parentId: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http.post<unknown, ApiResponse<unknown>>('/file/sec-upload', data).then(resolve).catch(reject)
  },

  merge(
    data: { identifier: string; filename: string; parentId: string; totalSize: number },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http.post<unknown, ApiResponse<unknown>>('/file/merge', data).then(resolve).catch(reject)
  },

  archiveDownload(
    data: { fileIds: string; zipName?: string },
    resolve: Callback<Blob>,
    reject: Callback<unknown>
  ) {
    http
      .post<unknown, ApiResponse<Blob>>('/file/archive-download', data, { responseType: 'blob' })
      .then(resolve)
      .catch(reject)
  },

  // 文件版本历史
  listVersions(
    params: { fileId: string },
    resolve: Callback<IFileVersionVO[]>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<IFileVersionVO[]>>('/file/versions', { params })
      .then(resolve)
      .catch(reject)
  },

  getVersion(params: { id: string }, resolve: Callback<IFileVersionVO>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<IFileVersionVO>>('/file/version', { params })
      .then(resolve)
      .catch(reject)
  },

  rollback(
    params: { id: string; fileId: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .post<unknown, ApiResponse<unknown>>('/file/rollback', null, { params })
      .then(resolve)
      .catch(reject)
  },

  deleteVersion(
    params: { id: string; fileId: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .delete<unknown, ApiResponse<unknown>>('/file/version', { params })
      .then(resolve)
      .catch(reject)
  }
}

export default fileService
