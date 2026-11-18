import { beforeEach, describe, expect, it } from 'vitest'
import Cookies from 'js-cookie'
import {
  clearSession,
  clearShareToken,
  getShareToken,
  getXsrfToken,
  hasLoginSession,
  setShareToken
} from '@/utils/cookie'

function clearAllCookies() {
  document.cookie.split(';').forEach((item) => {
    const name = item.split('=')[0].trim()
    if (name) Cookies.remove(name)
  })
}

describe('cookie utils', () => {
  beforeEach(() => {
    clearAllCookies()
  })

  it('未写入标记时视为未登录', () => {
    expect(hasLoginSession()).toBe(false)
  })

  it('登录标记存在时视为已登录，clearSession 后恢复未登录', () => {
    Cookies.set('xpan_logged_in', '1')
    expect(hasLoginSession()).toBe(true)

    clearSession()
    expect(hasLoginSession()).toBe(false)
  })

  it('读取 CSRF Token，缺失时返回空串', () => {
    expect(getXsrfToken()).toBe('')

    Cookies.set('XSRF-TOKEN', 'csrf-token')
    expect(getXsrfToken()).toBe('csrf-token')
  })

  it('分享 token 可写入、读取、清除', () => {
    setShareToken('share-token')
    expect(getShareToken()).toBe('share-token')

    clearShareToken()
    expect(getShareToken()).toBe('')
  })
})
