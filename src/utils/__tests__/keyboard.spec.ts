import { beforeEach, describe, expect, it } from 'vitest'
import { shouldSkipGlobalKeydown } from '@/utils/keyboard'

/**
 * 全局键盘守卫回归测试
 *
 * 背景：file-table 在 window 上监听 keydown（方向键导航/打开/删除），
 * 视频预览器也监听 window keydown（快进/快退）。预览弹窗打开时两个处理器
 * 对同一事件都执行——按 → 快进的同时会"打开当前高亮行"，按 ← 会跳回上一级目录。
 */
describe('keyboard shouldSkipGlobalKeydown', () => {
  beforeEach(() => {
    // 清理 happy-dom 中可能残留的 dialog
    document.querySelectorAll('dialog').forEach((d) => d.remove())
  })

  function makeKey(key: string, defaultPrevented = false): KeyboardEvent {
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    if (defaultPrevented) e.preventDefault()
    return e
  }

  it('事件已被其它处理器 preventDefault 时跳过', () => {
    expect(shouldSkipGlobalKeydown(makeKey('ArrowRight', true))).toBe(true)
  })

  it('存在打开的原生 dialog（预览/确认弹窗）时跳过', () => {
    const dialog = document.createElement('dialog')
    dialog.setAttribute('open', '')
    document.body.appendChild(dialog)
    expect(shouldSkipGlobalKeydown(makeKey('ArrowRight'))).toBe(true)
    dialog.remove()
  })

  it('dialog 存在但未打开时不跳过', () => {
    const dialog = document.createElement('dialog')
    document.body.appendChild(dialog)
    expect(shouldSkipGlobalKeydown(makeKey('ArrowRight'))).toBe(false)
    dialog.remove()
  })

  it('干净状态下（无弹窗、事件未被处理）不跳过', () => {
    expect(shouldSkipGlobalKeydown(makeKey('ArrowRight'))).toBe(false)
    expect(shouldSkipGlobalKeydown(makeKey('Enter'))).toBe(false)
  })
})
