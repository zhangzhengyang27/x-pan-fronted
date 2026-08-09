/**
 * useToast —— 临时替换 ElMessage / ElMessageBox / ElNotification
 * 用最小控制台实现保证 M1 阶段构建可过 + 运行时无 EP 依赖
 * M2 阶段会替换为完整 <BaseToast> + <BaseDialog> 组件
 */
function fmt(args) {
  return Array.from(args)
    .map((a) => (typeof a === 'string' ? a : a?.message ?? JSON.stringify(a)))
    .join(' ')
}

function log(level, args) {
  // eslint-disable-next-line no-console
  const tag = `[${level.toUpperCase()}]`
  if (level === 'error') console.error(tag, ...args)
  else if (level === 'warning') console.warn(tag, ...args)
  else console.log(tag, ...args)
}

export const ElMessage = {
  success: (...args) => log('success', [fmt(args)]),
  error: (...args) => log('error', [fmt(args)]),
  warning: (...args) => log('warning', [fmt(args)]),
  info: (...args) => log('info', [fmt(args)]),
  // 链式：ElMessage.success('x') 在原代码常被丢弃返回值，这里也丢
  closeAll: () => {},
}

export const ElNotification = {
  success: (opts) => log('success', [opts?.title, opts?.message]),
  error: (opts) => log('error', [opts?.title, opts?.message]),
  warning: (opts) => log('warning', [opts?.title, opts?.message]),
  info: (opts) => log('info', [opts?.title, opts?.message]),
}

export const ElMessageBox = {
  confirm: async (msg, title = '提示', opts = {}) => {
    // eslint-disable-next-line no-alert
    const ok = window.confirm(`${title}\n${typeof msg === 'string' ? msg : msg?.message ?? ''}`)
    return ok ? {value: 'confirm', action: 'confirm'} : {value: 'cancel', action: 'cancel'}
  },
  alert: async (msg, title = '提示') => {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n${typeof msg === 'string' ? msg : msg?.message ?? ''}`)
  },
  prompt: async () => ({value: null, action: 'cancel'}),
}

export const ElLoading = {
  service: () => ({close: () => {}}),
  directive: {},
}

// 默认导出也支持 `import ElMessage from '@/composables/useToast'`
export default ElMessage