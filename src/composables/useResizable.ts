/**
 * useResizable —— 让任意元素可拖拽调整宽度
 * - 持久化宽度到 localStorage
 * - 支持 min/max 约束
 * - 鼠标 hover 显示拖拽手柄光标
 */
import { onBeforeUnmount, ref } from 'vue'

export interface ResizableOptions {
  min?: number
  max?: number
  defaultWidth?: number
}

export function useResizable(
  storageKey: string,
  { min = 200, max = 480, defaultWidth = 240 }: ResizableOptions = {}
) {
  const width = ref(loadWidth())
  const isDragging = ref(false)

  function loadWidth(): number {
    const v = parseInt(localStorage.getItem(storageKey) || '', 10)
    if (Number.isFinite(v) && v >= min && v <= max) return v
    return defaultWidth
  }

  function saveWidth() {
    localStorage.setItem(storageKey, String(width.value))
  }

  function startDrag(e: MouseEvent) {
    if (e.button !== 0) return
    isDragging.value = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', stopDrag)
  }

  function onMove(e: MouseEvent) {
    if (!isDragging.value) return
    const next = Math.max(min, Math.min(max, e.clientX))
    width.value = next
  }

  function stopDrag() {
    if (!isDragging.value) return
    isDragging.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', stopDrag)
    saveWidth()
  }

  function reset() {
    width.value = defaultWidth
    saveWidth()
  }

  // 注意：不 watch width 持久化（拖拽过程中每次 mousemove 都会写 localStorage），
  // 宽度仅在 stopDrag / reset 时落盘

  onBeforeUnmount(() => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', stopDrag)
  })

  return { width, isDragging, startDrag, reset }
}
