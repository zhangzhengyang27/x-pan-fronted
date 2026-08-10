/**
 * Cookie 工具 - TypeScript 版
 */

'use strict'

import Cookies from 'js-cookie'

const LOGIN_TOKEN = 'login_token'
const SHARE_TOKEN = 'share_token'
const EMPTY_STR = ''

/** 写入登录 token（默认 1 天，SameSite=Lax 防 CSRF） */
export function setToken(token: string): void {
  Cookies.set(LOGIN_TOKEN, token, { expires: 1, sameSite: 'Lax' })
}

/** 读取登录 token；无则返回空串（保持调用方逻辑兼容） */
export function getToken(): string {
  const token = Cookies.get(LOGIN_TOKEN)
  return token ?? EMPTY_STR
}

/** 清除登录 token */
export function clearToken(): void {
  Cookies.remove(LOGIN_TOKEN)
}

/** 写入分享 token */
export function setShareToken(token: string): void {
  Cookies.set(SHARE_TOKEN, token, { expires: 1, sameSite: 'Lax' })
}

/** 读取分享 token */
export function getShareToken(): string {
  const token = Cookies.get(SHARE_TOKEN)
  return token ?? EMPTY_STR
}

/** 清除分享 token */
export function clearShareToken(): void {
  Cookies.remove(SHARE_TOKEN)
}
