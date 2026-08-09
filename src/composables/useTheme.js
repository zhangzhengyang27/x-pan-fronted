/**
 * useTheme —— 主题切换 composable
 * - 持久化到 localStorage('r-pan-theme')
 * - 系统偏好 fallback
 * - 与 index.html 内联脚本协同（防 FOUC）
 */
import {ref, watch} from 'vue'

const STORAGE_KEY = 'r-pan-theme'
const DARK_CLASS = 'dark'

const isDark = ref(false)

function applyTheme(dark) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle(DARK_CLASS, dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

function readInitial() {
  if (typeof window === 'undefined') return false
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark') return true
    if (stored === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/** 在 main.js 挂载前同步调用，避免 FOUC */
export function initTheme() {
  isDark.value = readInitial()
  applyTheme(isDark.value)
  watch(isDark, (v) => {
    applyTheme(v)
    try {
      localStorage.setItem(STORAGE_KEY, v ? 'dark' : 'light')
    } catch {}
  })
}

export function toggleTheme() {
  isDark.value = !isDark.value
}

export function setTheme(dark) {
  isDark.value = !!dark
}

export function useTheme() {
  return {isDark, toggleTheme, setTheme}
}