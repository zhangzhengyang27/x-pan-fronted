/**
 * simple-http —— 匿名 axios 实例（用于分享/公开接口）
 */

'use strict'

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig
} from 'axios'
import { ElMessage } from '@/composables/useToast'
import { getShareToken, getToken } from '@/utils/cookie'
import panUtil from '@/utils/common'
import type { ApiResponse } from '@/types'

function genTraceId(): string {
  return 'web-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

const simpleHttp: AxiosInstance = axios.create({
  baseURL: panUtil.getUrlPrefix(),
  timeout: 1000 * 60,
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
})

simpleHttp.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (config.data && typeof config.data !== 'string') {
      config.data = JSON.stringify(config.data)
    }
    // 分享页凭证：自动携带 Share-Token，供后端 @NeedShareCode 切面校验，
    // 避免提取码校验成功后详情/文件列表/保存仍被拦截。token 缺失或过期时由页面引导重新输入提取码。
    const shareToken = getShareToken()
    if (shareToken) config.headers['Share-Token'] = shareToken
    // 若已登录（如"保存到我的网盘"），顺带携带登录凭证；对 @LoginIgnore 的公开接口无副作用
    const token = getToken()
    if (token) config.headers['Authorization'] = token
    config.headers['X-Pan-Trace-Id'] = genTraceId()
    return config
  },
  (error: unknown) => {
    ElMessage.error('请求发送失败')
    return Promise.reject(error)
  }
)

simpleHttp.interceptors.response.use(
  (res: AxiosResponse<ApiResponse>) => {
    if (res.data && res.data.code !== 0) {
      return Promise.reject(res.data) as unknown as AxiosResponse
    }
    return res.data as unknown as AxiosResponse
  },
  (error) => {
    let msg = '请求失败'
    // 业务层失败（code !== 0）时，上一拦截器 reject 的是业务体 res.data（含 message），
    // 它没有 error.response，需优先从 error.message 读取业务提示
    if (error?.message && error.message !== 'Network Error') msg = error.message
    else if (error.response?.data?.message) msg = error.response.data.message
    else if (error.code === 'ECONNABORTED') msg = '请求超时'
    else if (typeof navigator !== 'undefined' && !navigator.onLine) msg = '网络已断开'
    ElMessage.error(msg)
    return Promise.reject(error)
  }
)

export default simpleHttp
export type { AxiosRequestConfig, ApiResponse }
