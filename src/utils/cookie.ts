/**
 * Cookie 工具 - TypeScript 版
 */

'use strict'

import Cookies from 'js-cookie'

const LOGIN_TOKEN = 'login_token'
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
