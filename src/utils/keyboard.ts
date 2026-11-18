/**
 * 全局键盘操作守卫
 *
 * 背景：列表页（file-table）与预览器（视频/图片）都在 window 上监听 keydown。
 * 预览弹窗打开时两者对同一事件都执行——按 → 快进视频的同时会"打开当前高亮行"、
 * 按 ← 快退的同时会跳回上一级目录。
 *
 * 契约：事件已被其它处理器处理（defaultPrevented）、或存在打开的原生 dialog
 * （BaseModal/确认弹窗均基于 showModal）时，列表页的键盘操作应跳过。
 */
export function shouldSkipGlobalKeydown(e: KeyboardEvent): boolean {
  if (e.defaultPrevented) return true
  if (typeof document !== 'undefined' && document.querySelector('dialog[open]')) return true
  return false
}
