/**
 * useMediaQuery —— 响应式断点 composable（P1.15）
 *
 * 用法：
 * const isMobile = useMediaQuery('(max-width: 768px)')
 * const isDesktop = useMediaQuery('(min-width: 1024px)')
 */
import {onBeforeUnmount, onMounted, ref} from 'vue'

const QUERIES = {
  sm: '(max-width: 640px)',
  md: '(max-width: 768px)',
  lg: '(max-width: 1024px)',
  xl: '(max-width: 1280px)',
  mobile: '(max-width: 768px)',
  tablet: '(min-width: 769px) and (max-width: 1024px)',
  desktop: '(min-width: 1025px)',
  portrait: '(orientation: portrait)',
  landscape: '(orientation: landscape)',
}

export function useMediaQuery(query) {
  const matches = ref(false)
  let mql = null
  const update = () => {
    if (mql) matches.value = mql.matches
  }

  onMounted(() => {
    const q = QUERIES[query] || query
    if (typeof window === 'undefined' || !window.matchMedia) return
    mql = window.matchMedia(q)
    matches.value = mql.matches
    if (mql.addEventListener) mql.addEventListener('change', update)
    else mql.addListener(update)
  })

  onBeforeUnmount(() => {
    if (!mql) return
    if (mql.removeEventListener) mql.removeEventListener('change', update)
    else mql.removeListener(update)
  })

  return matches
}

export function useDevice() {
  const isMobile = useMediaQuery('mobile')
  const isTablet = useMediaQuery('tablet')
  const isDesktop = useMediaQuery('desktop')
  return {isMobile, isTablet, isDesktop}
}