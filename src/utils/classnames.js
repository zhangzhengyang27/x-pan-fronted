/**
 * cn —— 类名拼接（clsx 风格，自实现零依赖）
 *  - 跳过 falsy 值
 *  - 对象 key 作为类名，truthy 值则加入
 *  - 数组递归展平
 */
export function cn(...args) {
  const out = []
  for (const item of args) {
    if (!item) continue
    if (typeof item === 'string' || typeof item === 'number') {
      out.push(String(item))
    } else if (Array.isArray(item)) {
      const sub = cn(...item)
      if (sub) out.push(sub)
    } else if (typeof item === 'object') {
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key) && item[key]) {
          out.push(key)
        }
      }
    }
  }
  return out.join(' ')
}

export default cn