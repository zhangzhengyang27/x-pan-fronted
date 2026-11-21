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

/* ============= Web 端桌面断点 =============
 * x-pan-fronted 只服务桌面场景，移动端由 x-pan-mobile 承载。
 * 这里固定返回桌面断点，而不是读取视口宽度：小屏浏览器不再触发
 * Header 手机版、导航抽屉、移动端上传 FAB、卡片列表等降级分支，
 * 避免同一套桌面布局在窄视口下被拆成互相冲突的移动样式。
 * 窗口窄于 1280px 时由全局 min-width 提供横向滚动，而不是压缩布局。
 */
export function useBreakpoint() {
  // 返回 ref 保持既有调用方 `isMobile.value` / 模板 `v-if="isMobile"` 的契约
  return {
    isMobile: ref(false),
    isTablet: ref(false),
    isDesktop: ref(true)
  }
}
