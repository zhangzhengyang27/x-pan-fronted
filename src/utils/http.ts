/**
 * http —— 主 axios 实例（需要登录）
 *
 * P3+P4：
 * - 注入 X-Pan-Trace-Id
 * - 网络错误返回标准化
 * - 全类型化（响应、请求、错误）
 */

'use strict'

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig
} from 'axios'
import { clearToken, getToken, setToken } from '@/utils/cookie'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import panUtil from '@/utils/common'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import { useFileStore } from '@/stores/file'
import { useNavbarStore } from '@/stores/navbar'
import { useUserStore } from '@/stores/user'
import type { ApiResponse } from '@/types'

function toLogin(): void {
  const breadcrumbStore = useBreadcrumbStore()
  const fileStore = useFileStore()
  const navbarStore = useNavbarStore()
  const userStore = useUserStore()
  // 先清空 token，避免路由守卫陷入「有 token → Login → Index → ...」的死循环
  clearToken()
  fileStore.clear()
  breadcrumbStore.clear()
  navbarStore.clear()
  userStore.clear()
  ElMessageBox.confirm('您需要重新登陆', '确认退出登录', {
    confirmButtonText: '重新登陆',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    // 用户确认：刷新页面（清空状态后重新加载）
    window.location.reload()
  }).catch(() => {
    // 用户取消：跳转到登录页
    window.location.href = '/login'
  })
}

function genTraceId(): string {
  return 'web-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

const http: AxiosInstance = axios.create({
  baseURL: panUtil.getUrlPrefix(),
  timeout: 1000 * 60,
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
})

http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (config.data && typeof config.data !== 'string') {
      config.data = JSON.stringify(config.data)
    }
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

/**
 * 响应拦截器：返回 res.data（直接给业务代码用），同时处理 401 / 5xx
 *
 * 说明：axios 拦截器链的 FulFilled 期望返回 AxiosResponse<T>，但我们
 * 业务代码想直接拿到 ApiResponse<T>。这里用类型断言绕过泛型约束，
 * 实际运行期返回的就是后端的业务 JSON。
 */
http.interceptors.response.use(
  (res: AxiosResponse<ApiResponse>) => {
    // token 续期：后端在过半续期时通过响应头下发新 token，这里更新本地 cookie
    const newToken = res.headers?.['new-access-token'] as string | undefined
    if (newToken) setToken(newToken)
    if (res.data && res.data.code === 10) {
      toLogin()
      return Promise.reject(res.data) as unknown as AxiosResponse
    }
    if (res.data && res.data.code !== 0) {
      return Promise.reject(res.data) as unknown as AxiosResponse
    }
    return res.data as unknown as AxiosResponse
  },
  (error) => {
    let msg = '请求失败'
    if (error.response) {
      const status = error.response.status
      if (status === 401) msg = '请重新登录'
      else if (status === 403) msg = '无权访问'
      else if (status === 413) msg = '文件过大'
      else if (status >= 500) msg = '服务器错误，请稍后重试'
      else if (error.response.data?.message) msg = error.response.data.message
      const tid = error.response.headers?.['x-pan-trace-id']
      if (tid) msg += `（追踪码: ${tid}）`
    } else if (error.code === 'ECONNABORTED') {
      msg = '请求超时'
    } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
      msg = '网络已断开'
    }
    ElMessage.error(msg)
    return Promise.reject(error)
  }
)

export default http
export type { AxiosRequestConfig, ApiResponse }
