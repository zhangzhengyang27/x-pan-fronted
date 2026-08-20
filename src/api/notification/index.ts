/**
 * 通知相关 API
 */

'use strict'

import http, { type ApiResponse } from '@/utils/http'

type Callback<T> = (res: ApiResponse<T>) => void

export interface INotificationVO {
  id: string
  type: string
  title: string
  content: string
  payload?: string
  readFlag: 0 | 1
  createTime: string
}

const notificationService = {
  list(limit: number, resolve: Callback<INotificationVO[]>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<INotificationVO[]>>('/notification/list', { params: { limit } })
      .then(resolve)
      .catch(reject)
  },

  unreadCount(resolve: Callback<number>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<number>>('/notification/unread/count')
      .then(resolve)
      .catch(reject)
  },

  markRead(id: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.put<unknown, ApiResponse<unknown>>(`/notification/read/${id}`).then(resolve).catch(reject)
  },

  markAllRead(resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.put<unknown, ApiResponse<unknown>>('/notification/read/all').then(resolve).catch(reject)
  }
}

export default notificationService
