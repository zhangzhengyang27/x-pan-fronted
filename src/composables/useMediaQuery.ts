import { onMounted, onUnmounted, ref } from 'vue'

/**
 * useMediaQuery —— 响应式媒体查询（SSR 安全）
 * @param query 媒体查询字符串，例如 '(max-width: 768px)'
 * @returns 是否为匹配状态
 */
export function useMediaQuery(query: string) {
  const matches = ref(false)
  let mql: MediaQueryList | null = null
  let handler: ((e: MediaQueryListEvent) => void) | null = null

  onMounted(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    mql = window.matchMedia(query)
    matches.value = mql.matches
    handler = (e: MediaQueryListEvent) => {
      matches.value = e.matches
    }
    mql.addEventListener('change', handler)
  })

  onUnmounted(() => {
    if (mql && handler) {
      mql.removeEventListener('change', handler)
    }
  })

  return { matches }
}
