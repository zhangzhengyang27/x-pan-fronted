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

/* ============= 统一断点体系 =============
 * 手机  : <= 768px   (isMobile)  —— 与既有 useMediaQuery('(max-width: 768px)') 对齐
 * 平板  : 769~1024px (isTablet)
 * 桌面  : >= 1025px  (isDesktop)
 */
export const MOBILE_MAX = 768
export const TABLET_MAX = 1024

export function useBreakpoint() {
  const mobileQuery = useMediaQuery(`(max-width: ${MOBILE_MAX}px)`)
  const tabletQuery = useMediaQuery(`(min-width: ${MOBILE_MAX + 1}px) and (max-width: ${TABLET_MAX}px)`)
  const desktopQuery = useMediaQuery(`(min-width: ${TABLET_MAX + 1}px)`)
  // 返回直接 ref，避免调用方写 `isMobile.matches`；模板里直接 `v-if="isMobile"`
  return {
    isMobile: mobileQuery.matches,
    isTablet: tabletQuery.matches,
    isDesktop: desktopQuery.matches,
  }
}
