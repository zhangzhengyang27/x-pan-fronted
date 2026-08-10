/**
 * useToast —— 全局提示/确认/加载的轻量封装（TypeScript 版）
 */

type ToastLevel = 'success' | 'error' | 'warning' | 'info'

interface ToastColors {
  bg: string
  icon: string
}

const COLORS: Record<ToastLevel, ToastColors> = {
  success: { bg: '#22c55e', icon: '✓' },
  error: { bg: '#ef4444', icon: '✕' },
  warning: { bg: '#f59e0b', icon: '!' },
  info: { bg: '#3b82f6', icon: 'i' }
}

function fmt(args: unknown[]): string {
  return args
    .map((a) =>
      typeof a === 'string' ? a : ((a as { message?: string })?.message ?? JSON.stringify(a))
    )
    .join(' ')
}

function log(level: ToastLevel, args: unknown[]): void {
  const tag = `[${level.toUpperCase()}]`
  if (level === 'error') console.error(tag, ...args)
  else if (level === 'warning') console.warn(tag, ...args)
  else console.log(tag, ...args)
}

let _container: HTMLElement | null = null

function ensureContainer(): HTMLElement {
  if (_container && document.body.contains(_container)) return _container
  const el = document.createElement('div')
  el.id = '__x_pan_toast_container'
  el.style.cssText =
    'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;'
  document.body.appendChild(el)
  _container = el
  return el
}

function showToast(level: ToastLevel, msg: string): void {
  const container = ensureContainer()
  const c = COLORS[level]
  const el = document.createElement('div')
  el.style.cssText = `pointer-events:auto;display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:10px;background:${c.bg};color:#fff;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,.12);opacity:0;transform:translateY(-8px);transition:opacity .18s,transform .18s;max-width:420px;`
  el.innerHTML = `<span style="font-weight:700;flex-shrink:0">${c.icon}</span><span style="line-height:1.4"></span>`
  const textSpan = el.querySelector('span:last-child') as HTMLElement | null
  if (textSpan) textSpan.textContent = msg
  container.appendChild(el)
  requestAnimationFrame(() => {
    el.style.opacity = '1'
    el.style.transform = 'translateY(0)'
  })
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(-8px)'
    setTimeout(() => el.remove(), 220)
  }, 2400)
}

export const ElMessage = {
  success: (...args: unknown[]) => {
    const m = fmt(args)
    showToast('success', m)
    log('success', [m])
  },
  error: (...args: unknown[]) => {
    const m = fmt(args)
    showToast('error', m)
    log('error', [m])
  },
  warning: (...args: unknown[]) => {
    const m = fmt(args)
    showToast('warning', m)
    log('warning', [m])
  },
  info: (...args: unknown[]) => {
    const m = fmt(args)
    showToast('info', m)
    log('info', [m])
  },
  closeAll: () => {
    /* noop */
  }
}

interface NotificationOpts {
  title?: string
  message?: string
}

export const ElNotification = {
  success: (opts: NotificationOpts) => ElMessage.success(opts?.message || opts?.title || ''),
  error: (opts: NotificationOpts) => ElMessage.error(opts?.message || opts?.title || ''),
  warning: (opts: NotificationOpts) => ElMessage.warning(opts?.message || opts?.title || ''),
  info: (opts: NotificationOpts) => ElMessage.info(opts?.message || opts?.title || '')
}

export interface ConfirmItem {
  title: string
  message: string
  danger: boolean
  confirmText: string
  cancelText: string
  hideClose: boolean
}

const _confirmQueue: ConfirmItem[] = []
const _confirmResolvers: ((v: boolean) => void)[] = []

function pushConfirm(item: ConfirmItem): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    _confirmQueue.push(item)
    _confirmResolvers.push(resolve)
    drainConfirm()
  })
}

function drainConfirm(): void {
  window.dispatchEvent(new CustomEvent('x-pan:confirm-push'))
}

export function answerConfirm(action: 'confirm' | 'cancel' | 'close'): void {
  if (_confirmResolvers.length === 0) return
  const resolve = _confirmResolvers.shift()
  _confirmQueue.shift()
  if (resolve) resolve(action === 'confirm')
}

export function getConfirmQueue(): ConfirmItem[] {
  return _confirmQueue
}

export interface ConfirmOptions {
  confirmButtonText?: string
  cancelButtonText?: string
  type?: 'warning' | 'danger' | 'info'
  danger?: boolean
  hideClose?: boolean
}

export const ElMessageBox = {
  confirm: (
    msg: string | { message?: string },
    title = '提示',
    opts: ConfirmOptions = {}
  ): Promise<boolean> => {
    const message = typeof msg === 'string' ? msg : (msg?.message ?? '')
    return pushConfirm({
      title,
      message,
      danger: opts.type === 'danger' || opts.danger === true,
      confirmText: opts.confirmButtonText || '确定',
      cancelText: opts.cancelButtonText || '取消',
      hideClose: opts.hideClose === true
    })
  },
  alert: (msg: string | { message?: string }, title = '提示') => {
    window.alert(`${title}\n${typeof msg === 'string' ? msg : (msg?.message ?? '')}`)
  },
  prompt: async (): Promise<{ value: string | null; action: 'confirm' | 'cancel' }> => ({
    value: null,
    action: 'cancel'
  })
}

export const ElLoading = {
  service: (): { close: () => void } => ({
    close: () => {
      /* noop */
    }
  }),
  directive: {}
}

export default ElMessage
