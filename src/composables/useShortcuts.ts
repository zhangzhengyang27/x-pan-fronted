/**
 * useShortcuts —— 全局快捷键
 *
 * 真实生效的快捷键（与 ShortcutsPanel 面板展示保持一致）：
 * - Ctrl/Cmd+K        聚焦搜索框（全局）
 * - ? / Shift+/       打开快捷键面板（由 ShortcutsPanel 自身处理）
 * - G 然后 H          跳转「首页」文件列表
 * - G 然后 I          跳转「图片」
 * - G 然后 D          跳转「文档」
 * - G 然后 S          跳转「我的分享」
 * - G 然后 R          跳转「回收站」
 * - Ctrl/Cmd+U        上传文件（仅文件页）
 * - Ctrl/Cmd+Shift+N  新建文件夹（仅文件页）
 * - Ctrl/Cmd+1        列表视图（仅文件页）
 * - Ctrl/Cmd+2        网格视图（仅文件页）
 * - F5                刷新当前文件列表（仅文件页）
 * - F2                重命名选中文件（仅文件页）
 * - Ctrl/Cmd+D        下载选中文件（仅文件页）
 *
 * 设计：导航类（Ctrl+K、G 系列）在此处直接处理；文件操作类通过
 * window.dispatchEvent(new CustomEvent('xpan:shortcut', { detail })) 派发给
 * 当前文件列表页，页面存在时才响应。
 */
import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { getToken } from '@/utils/cookie'

// 已登录才执行需要鉴权的导航
function requireAuth(): boolean {
  return !!getToken()
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target) return false
  const el = target as HTMLElement
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable === true
  )
}

export function useShortcuts() {
  const router = useRouter()
  // 「G」前缀模式的待定状态，2 秒内未输入第二个键则失效
  let gPending = false
  let gTimer: ReturnType<typeof setTimeout> | null = null

  function clearGPending() {
    gPending = false
    if (gTimer) {
      clearTimeout(gTimer)
      gTimer = null
    }
  }

  function dispatch(name: string) {
    window.dispatchEvent(new CustomEvent('xpan:shortcut', { detail: { name } }))
  }

  function onKeydown(e: KeyboardEvent) {
    // 输入框内不拦截（除 Esc 交给组件处理），避免干扰正常输入
    const editing = isEditableTarget(e.target)

    const mod = e.ctrlKey || e.metaKey

    // G 前缀模式：先按 G，再按目标键
    if (gPending) {
      const k = e.key.toLowerCase()
      clearGPending()
      if (k === 'h') {
        e.preventDefault()
        if (requireAuth()) router.push({ name: 'Index' })
        return
      }
      if (k === 'i') {
        e.preventDefault()
        if (requireAuth()) router.push({ name: 'Imgs' })
        return
      }
      if (k === 'd') {
        e.preventDefault()
        if (requireAuth()) router.push({ name: 'Docs' })
        return
      }
      if (k === 's') {
        e.preventDefault()
        if (requireAuth()) router.push({ name: 'Shares' })
        return
      }
      if (k === 'r') {
        e.preventDefault()
        if (requireAuth()) router.push({ name: 'Recycles' })
        return
      }
      // 其他键不作为 G 序列，落到下面的正常判断
    }

    // Ctrl/Cmd 组合
    if (mod) {
      const lower = e.key.toLowerCase()
      // Ctrl+K 聚焦搜索（全局，输入框内也允许）
      if (lower === 'k') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('xpan:focus-search'))
        return
      }
      if (editing) return
      if (lower === 'u') {
        e.preventDefault()
        dispatch('upload')
        return
      }
      if (lower === 'n' && e.shiftKey) {
        e.preventDefault()
        dispatch('createFolder')
        return
      }
      if (lower === '1') {
        e.preventDefault()
        dispatch('view-list')
        return
      }
      if (lower === '2') {
        e.preventDefault()
        dispatch('view-grid')
        return
      }
      if (lower === 'd') {
        e.preventDefault()
        dispatch('download')
        return
      }
      return
    }

    // 单键（输入框内不触发）
    if (editing) return

    // F5 刷新
    if (e.key === 'F5') {
      e.preventDefault()
      dispatch('refresh')
      return
    }
    // F2 重命名
    if (e.key === 'F2') {
      e.preventDefault()
      dispatch('rename')
      return
    }
    // G 进入前缀模式
    if (e.key.toLowerCase() === 'g') {
      gPending = true
      if (gTimer) clearTimeout(gTimer)
      gTimer = setTimeout(clearGPending, 1500)
      return
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
    clearGPending()
  })

  return { onKeydown }
}
