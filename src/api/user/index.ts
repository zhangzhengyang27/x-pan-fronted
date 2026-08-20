/**
 * 用户相关 API（TypeScript 版）
 */

'use strict'

import http, { type ApiResponse } from '@/utils/http'
import simpleHttp from '@/utils/simple-http'
import type { ILoginReq, IRegisterReq, IUserInfo } from '@/types'

type Callback<T> = (res: ApiResponse<T>) => void

const userService = {
  login(data: ILoginReq, resolve: Callback<IUserInfo>, reject: Callback<unknown>) {
    http.post<unknown, ApiResponse<IUserInfo>>('/user/login', data).then(resolve).catch(reject)
  },

  register(data: IRegisterReq, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.post<unknown, ApiResponse<unknown>>('/user/register', data).then(resolve).catch(reject)
  },

  info(resolve: Callback<IUserInfo>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<IUserInfo>>('/user/').then(resolve).catch(reject)
  },

  checkUsername(data: { username: string }, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<unknown>>('/user/username/check', data)
      .then(resolve)
      .catch(reject)
  },

  checkAnswer(
    data: { username: string; answer: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http.post<unknown, ApiResponse<unknown>>('/user/answer/check', data).then(resolve).catch(reject)
  },

  resetPassword(
    data: { username: string; answer: string; newPassword: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .post<unknown, ApiResponse<unknown>>('/user/password/reset', data)
      .then(resolve)
      .catch(reject)
  },

  changePassword(
    data: { oldPassword: string; newPassword: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .post<unknown, ApiResponse<unknown>>('/user/password/change', data)
      .then(resolve)
      .catch(reject)
  },

  exit(resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.post<unknown, ApiResponse<unknown>>('/user/exit').then(resolve).catch(reject)
  },

  checkUserLoginStatus(
    params: Record<string, unknown>,
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<unknown>>('/user/login/status', { params })
      .then(resolve)
      .catch(reject)
  },

  infoWithoutPageJump(resolve: Callback<IUserInfo>) {
    simpleHttp.get<unknown, ApiResponse<IUserInfo>>('/user').then(resolve)
  },

  updateQuota(data: { totalSize: number }, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.put<unknown, ApiResponse<unknown>>('/user/quota', data).then(resolve).catch(reject)
  },

  setAvatar(data: { fileId: string }, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.put<unknown, ApiResponse<unknown>>('/user/avatar', data).then(resolve).catch(reject)
  },

  uploadAvatar(file: File, resolve: Callback<string>, reject: Callback<unknown>) {
    const form = new FormData()
    form.append('file', file)
    http
      .post<unknown, ApiResponse<string>>('/user/avatar/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      .then(resolve)
      .catch(reject)
  }
}

export default userService
