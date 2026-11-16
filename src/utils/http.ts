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
import { clearSession, getClientId, getXsrfToken } from '@/utils/cookie'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import panUtil from '@/utils/common'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import { useFileStore } from '@/stores/file'
import { useNavbarStore } from '@/stores/navbar'
import { useUserStore } from '@/stores/user'
import { useSpaceStore } from '@/stores/space'
import { useFavorites } from '@/composables/useFavorites'
import { useRecent } from '@/composables/useRecent'
import type { ApiResponse } from '@/types'

function toLogin(): void {
  const breadcrumbStore = useBreadcrumbStore()
  const fileStore = useFileStore()
  const navbarStore = useNavbarStore()
  const userStore = useUserStore()
  // 先清空前端登录标记，避免路由守卫陷入「有标记 → Login → Index → ...」的死循环
  clearSession()
  fileStore.clear()
  breadcrumbStore.clear()
  navbarStore.clear()
  userStore.clear()
  useSpaceStore().reset()
  // 收藏（模块级内存缓存）/最近访问（localStorage）跨页面共享，登出/登录失效时
  // 一并清空并重置加载标记，避免切换账号后看到上一个账号的数据
  useFavorites().clear()
  useRecent().clear()
  ElMessageBox.confirm('您需要重新登陆', '确认退出登录', {
    confirmButtonText: '重新登陆',
    cancelButtonText: '取消',
    type: 'warning'
  }).then((ok) => {
    // confirm 永不 reject：resolve(true)=确认重新登录；取消仅关闭弹窗，不 reload
    if (ok) window.location.reload()
  })
}

function genTraceId(): string {
  return 'web-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

const http: AxiosInstance = axios.create({
  baseURL: panUtil.getUrlPrefix(),
  timeout: 1000 * 60,
  // 登录态在 HttpOnly Cookie 中，跨域/同源请求都需要显式携带
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
})

http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // FormData 必须原样交给浏览器序列化（自动携带 multipart boundary），不能 JSON.stringify
    if (config.data && typeof config.data !== 'string' && !(config.data instanceof FormData)) {
      config.data = JSON.stringify(config.data)
    }
    // 登录态由 HttpOnly Cookie 自动携带，前端不再读取/注入 Authorization
    // 多端并存登录：每端带稳定 clientId，后端按 userId_clientId 隔离会话
    config.headers['X-Client-Id'] = getClientId()
    // 团队空间：当前选中的空间 ID（空表示个人空间），后端据此切换文件归属与权限
    try {
      const spaceId = localStorage.getItem('xpan_space_id')
      if (spaceId) config.headers['X-Space-Id'] = spaceId
    } catch {
      /* 隐私模式下读取失败：按个人空间处理 */
    }
    // CSRF 双提交：状态变更请求回传非 HttpOnly 的 XSRF-TOKEN
    const method = (config.method || 'get').toLowerCase()
    if (!['get', 'head', 'options'].includes(method)) {
      const xsrf = getXsrfToken()
      if (xsrf) config.headers['X-XSRF-TOKEN'] = xsrf
    }
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
/**
 * blob 响应处理：真文件流（zip 等）原样放行；业务错误（HTTP 200 + JSON 业务体）走统一错误路径。
 *
 * 背景：后端对业务失败（会话过期 code=10、无权访问等）返回 HTTP 200 + JSON，
 * 若不嗅探 Content-Type，错误 JSON 会被当成下载内容存成损坏的 zip，且 code=10 不触发重登录。
 * 注：用户下载真实的 .json 文件时 Content-Type 也是 application/json——无 code 字段即放行，
 * 仅当解析出数字 code 才视为业务错误（当前 axios blob 下载仅打包下载 zip 一种，风险可控）。
 */
export async function resolveBlobResponse(res: AxiosResponse): Promise<unknown> {
  const blob = res.data as unknown as Blob
  const contentType =
    ((res.headers?.['content-type'] as string) || blob?.type || '').toLowerCase()
  if (contentType.includes('application/json') && blob?.text) {
    const text = await blob.text()
    let parsed: unknown = null
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
    if (parsed && typeof (parsed as ApiResponse).code === 'number') {
      const payload = parsed as ApiResponse
      if (payload.code === 10) {
        toLogin()
      }
      return Promise.reject(payload) as unknown as AxiosResponse
    }
  }
  // 与 JSON 路径一样返回 res.data，调用方拿到的就是 Blob 本体
  return blob as unknown as AxiosResponse
}

http.interceptors.response.use(
  (res: AxiosResponse<ApiResponse>) => {
    // token 续期：后端会在响应中同步刷新 HttpOnly Cookie；
    // New-Access-Token 响应头仅保留给非浏览器客户端，前端不再写入可读 Cookie
    if (res.config.responseType === 'blob' || res.data instanceof Blob) {
      return resolveBlobResponse(res)
    }
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
