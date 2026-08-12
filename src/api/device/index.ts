/**
 * 设备管理 API（P3-5）
 *
 * 对接后端 DeviceController：
 * - GET  /device/list    → 当前账号登录设备列表（后端依据 UA + IP 标记 isCurrent）
 * - POST /device/logout  → 远程下线指定设备（body: { deviceId }）
 */
'use strict'

import http, { type ApiResponse } from '@/utils/http'

type Callback<T> = (res: ApiResponse<T>) => void

export interface DeviceInfo {
  deviceId: string
  deviceName: string
  browser: string
  os: string
  ip: string
  location: string
  lastLoginTime: string
  isCurrent: boolean
}

const deviceService = {
  /** 获取当前用户登录设备列表 */
  list(resolve: Callback<DeviceInfo[]>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<DeviceInfo[]>>('/device/list').then(resolve).catch(reject)
  },

  /** 远程下线指定设备 */
  logout(deviceId: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<unknown>>('/device/logout', { deviceId })
      .then(resolve)
      .catch(reject)
  }
}

export default deviceService
