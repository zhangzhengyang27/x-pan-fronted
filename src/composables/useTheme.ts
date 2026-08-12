/**
 * useTheme —— 主题切换（light/dark）
 * 支持跟随系统 + 手动切换，持久化到 localStorage
 */
import { computed, onMounted, ref, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'x-pan:theme'

function getPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function useTheme() {
  const mode = ref<ThemeMode>(readInitial())
  const isDark = computed(
    () => mode.value === 'dark' || (mode.value === 'system' && getPrefersDark())
  )

  function readInitial(): ThemeMode {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  }

  function apply() {
    const root = document.documentElement
    root.classList.toggle('dark', isDark.value)
    root.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
  }

  function setMode(next: ThemeMode) {
    mode.value = next
    localStorage.setItem(STORAGE_KEY, next)
  }

  function toggle() {
    setMode(isDark.value ? 'light' : 'dark')
  }

  watch([isDark, mode], apply)
  onMounted(apply)

  return { mode, isDark, setMode, toggle, toggleTheme: toggle }
}

/**
 * 在应用挂载前同步初始化主题（避免 FOUC）
 */
export function initTheme(): void {
  const saved = localStorage.getItem(STORAGE_KEY)
  const mode: ThemeMode =
    saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
  const isDark = mode === 'dark' || (mode === 'system' && getPrefersDark())
  const root = document.documentElement
  root.classList.toggle('dark', isDark)
  root.setAttribute('data-theme', isDark ? 'dark' : 'light')
}
