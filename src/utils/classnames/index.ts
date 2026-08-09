/**
 * classnames —— 简化版 classnames 工具
 * 支持字符串 / 对象 / 数组形式
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | Record<string, boolean | undefined | null>
  | ClassValue[]

export function classNames(...args: ClassValue[]): string {
  const classes: string[] = []

  for (const arg of args) {
    if (!arg) continue

    if (typeof arg === 'string' || typeof arg === 'number') {
      classes.push(String(arg))
    } else if (Array.isArray(arg)) {
      const inner = classNames(...arg)
      if (inner) classes.push(inner)
    } else if (typeof arg === 'object') {
      for (const key in arg) {
        if (arg[key]) classes.push(key)
      }
    }
  }

  return classes.join(' ')
}

export default classNames
