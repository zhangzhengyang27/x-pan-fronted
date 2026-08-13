/**
 * 收藏（星标）API —— 对接后端 P4 FavoriteController
 * - POST /favorite/add     批量收藏   body: { fileIdList: string[] }
 * - POST /favorite/remove  批量取消收藏 body: { fileIdList: string[] }
 * - GET  /favorite/list    收藏列表
 *
 * fileIdList 为后端加密文件ID数组（原样透传，后端内部解密）
 */
'use strict'

import http, { type ApiResponse } from '@/utils/http'

type Callback<T> = (res: ApiResponse<T>) => void

export interface IFavoriteFileVO {
  fileId: string
  parentId: string
  filename: string
  fileSizeDesc: string
  folderFlag: 0 | 1
  fileType: number
  favoriteTime: string
}

const favoriteService = {
  /** 批量收藏 */
  add(fileIdList: string[], resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<unknown>>('/favorite/add', { fileIdList })
      .then(resolve)
      .catch(reject)
  },

  /** 批量取消收藏 */
  remove(fileIdList: string[], resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<unknown>>('/favorite/remove', { fileIdList })
      .then(resolve)
      .catch(reject)
  },

  /** 收藏列表 */
  list(resolve: Callback<IFavoriteFileVO[]>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<IFavoriteFileVO[]>>('/favorite/list').then(resolve).catch(reject)
  }
}

export default favoriteService
