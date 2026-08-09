/**
 * Created by rubin on 2020/6/4.
 */

'use strict'

import Cookies from 'js-cookie'

const LOGIN_TOKEN = 'login_token',
    SHARE_TOKEN = 'share_token',
    EMPTY_STR = ''

export function setToken(token) {
    Cookies.set(LOGIN_TOKEN, token, {expires: 1, sameSite: 'Lax'})
}

export function getToken() {
    let token = Cookies.get(LOGIN_TOKEN)
    if (token) {
        return token
    }
    return EMPTY_STR
}

export function clearToken() {
    Cookies.remove(LOGIN_TOKEN)
}

export function setShareToken(token) {
    Cookies.set(SHARE_TOKEN, token, {expires: 1, sameSite: 'Lax'})
}

export function getShareToken() {
    let token = Cookies.get(SHARE_TOKEN)
    if (token) {
        return token
    }
    return EMPTY_STR
}

export function clearShareToken() {
    Cookies.remove(SHARE_TOKEN)
}
