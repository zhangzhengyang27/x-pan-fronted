/**
 * useToast —— ElMessage / ElNotification / ElMessageBox 的兼容层
 * - ElMessage: 顶部居中浮窗（M6 之后可替换为 <BaseToast>）
 * - ElMessageBox.confirm: 全局 <ConfirmHost>，支持 danger / 自定义按钮文案
 * - ElNotification / ElLoading: 占位
 */
function fmt(args) {
  return Array.from(args)
    .map((a) => (typeof a === 'string' ? a : a?.message ?? JSON.stringify(a)))
    .join(' ')
}

function log(level, args) {
  const tag = `[${level.toUpperCase()}]`
  if (level === 'error') console.error(tag, ...args)
  else if (level === 'warning') console.warn(tag, ...args)
  else console.log(tag, ...args)
}

let _toastId = 0
let _container = null

function ensureContainer() {
  if (_container && document.body.contains(_container)) return _container
  const el = document.createElement('div')
  el.id = '__x_pan_toast_container'
  el.style.cssText =
    'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;'
  document.body.appendChild(el)
  _container = el
  return el
}

function showToast(level, msg) {
  const container = ensureContainer()
  const id = ++_toastId
  const colors = {
    success: {bg: '#22c55e', icon: '✓'},
    error: {bg: '#ef4444', icon: '✕'},
    warning: {bg: '#f59e0b', icon: '!'},
    info: {bg: '#3b82f6', icon: 'i'},
  }
  const c = colors[level] || colors.info
  const el = document.createElement('div')
  el.style.cssText = `pointer-events:auto;display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:10px;background:${c.bg};color:#fff;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,.12);opacity:0;transform:translateY(-8px);transition:opacity .18s,transform .18s;max-width:420px;`
  el.innerHTML = `<span style="font-weight:700;flex-shrink:0">${c.icon}</span><span style="line-height:1.4"></span>`
  el.querySelector('span:last-child').textContent = msg
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
  success: (...args) => {
    showToast('success', fmt(args))
    log('success', [fmt(args)])
  },
  error: (...args) => {
    showToast('error', fmt(args))
    log('error', [fmt(args)])
  },
  warning: (...args) => {
    showToast('warning', fmt(args))
    log('warning', [fmt(args)])
  },
  info: (...args) => {
    showToast('info', fmt(args))
    log('info', [fmt(args)])
  },
  closeAll: () => {},
}

export const ElNotification = {
  success: (opts) => ElMessage.success(opts?.message || opts?.title || ''),
  error: (opts) => ElMessage.error(opts?.message || opts?.title || ''),
  warning: (opts) => ElMessage.warning(opts?.message || opts?.title || ''),
  info: (opts) => ElMessage.info(opts?.message || opts?.title || ''),
}

/**
 * Confirm 队列（模块级）。
 * ConfirmHost 在挂载时接管本队列，confirm() 入队一项并返回 Promise。
 */
const _confirmQueue = []
let _confirmResolvers = []

function pushConfirm(item) {
  return new Promise((resolve) => {
    _confirmQueue.push(item)
    _confirmResolvers.push(resolve)
    drainConfirm()
  })
}

function drainConfirm() {
  // 当前实现：ConfirmHost 监听 queue，并在用户操作时调用 answerConfirm
  // 这里只负责入队；ConfirmHost 通过 answerConfirm 反向通知
  window.dispatchEvent(new CustomEvent('x-pan:confirm-push'))
}

export function answerConfirm(action) {
  if (_confirmResolvers.length === 0) return
  const resolve = _confirmResolvers.shift()
  _confirmQueue.shift()
  resolve(action === 'confirm')
}

export function getConfirmQueue() {
  return _confirmQueue
}

export const ElMessageBox = {
  confirm: (msg, title = '提示', opts = {}) => {
    const message = typeof msg === 'string' ? msg : msg?.message ?? ''
    return pushConfirm({
      title,
      message,
      danger: opts.type === 'danger' || opts.danger === true,
      confirmText: opts.confirmButtonText || '确定',
      cancelText: opts.cancelButtonText || '取消',
      hideClose: opts.hideClose === true,
    })
  },
  alert: (msg, title = '提示') => {
    window.alert(`${title}\n${typeof msg === 'string' ? msg : msg?.message ?? ''}`)
  },
  prompt: async () => ({value: null, action: 'cancel'}),
}

export const ElLoading = {
  service: () => ({close: () => {}}),
  directive: {},
}

export default ElMessage