/**
 * Cookie 工具 - TypeScript 版
 *
 * 登录 token 由后端写入 HttpOnly Cookie，前端 JavaScript 无法读取；
 * 前端仅读写非敏感的登录标记与 CSRF Token。
 */

'use strict'

import Cookies from 'js-cookie'

const LOGIN_TOKEN = 'login_token'
const LOGIN_MARKER = 'xpan_logged_in'
const CSRF_COOKIE = 'XSRF-TOKEN'
const SHARE_TOKEN = 'share_token'
const CLIENT_ID_KEY = 'client_id'
const EMPTY_STR = ''

/**
 * 生成一个随机的 clientId（多端并存登录时用于区分当前会话）。
 * 存储于 cookie（长期有效），与登录 token 独立，登录/登出不清除。
 */
function genClientId(): string {
  const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  return 'web-' + rand
}

/** 读取本端稳定 clientId；不存在则生成并持久化 */
export function getClientId(): string {
  let id = Cookies.get(CLIENT_ID_KEY)
  if (!id) {
    id = genClientId()
    Cookies.set(CLIENT_ID_KEY, id, { expires: 365, sameSite: 'Lax' })
  }
  return id
}

/**
 * 是否存在登录态标记。
 * 真正的 token 在 HttpOnly Cookie 中，前端只读取这个非敏感标记；
 * 标记存在但会话已失效时，由 `/user/` 接口返回 code=10 触发重新登录。
 */
export function hasLoginSession(): boolean {
  return Cookies.get(LOGIN_MARKER) === '1'
}

/**
 * 读取 CSRF Token（非 HttpOnly，双提交校验用）。
 */
export function getXsrfToken(): string {
  return Cookies.get(CSRF_COOKIE) ?? EMPTY_STR
}

/**
 * 清除前端可读的登录标记与 CSRF Token。
 * HttpOnly 的 login_token 由后端在登出响应中清除。
 */
export function clearSession(): void {
  Cookies.remove(LOGIN_MARKER)
  Cookies.remove(CSRF_COOKIE)
  // 兼容旧版本前端写入的非 HttpOnly token
  Cookies.remove(LOGIN_TOKEN)
}

/** 写入分享 token */
export function setShareToken(token: string): void {
  Cookies.set(SHARE_TOKEN, token, { expires: 1, sameSite: 'Lax' })
}

/** 读取分享 token */
export function getShareToken(): string {
  return Cookies.get(SHARE_TOKEN) ?? EMPTY_STR
}

/** 清除分享 token */
export function clearShareToken(): void {
  Cookies.remove(SHARE_TOKEN)
}
