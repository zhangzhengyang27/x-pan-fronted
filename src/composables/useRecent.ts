/**
 * useRecent —— 最近访问（P3-1）
 *
 * localStorage 存储最近访问文件（最多 20 条，按访问时间倒序）。
 * 用模块级 ref 而不是 computed+localStorage：文件列表双击记录后，首页“最近访问”
 * 区块要能立即刷新；多个组件各自 new 一个 computed 会各自缓存、互相看不到更新。
 */
import { computed, ref } from 'vue'

export interface RecentItem {
  fileId: string
  filename: string
  extension: string
  fileType: number
  fileSizeDesc?: string
  parentId?: string
  visitTime: number
}

const STORAGE_KEY = 'x-pan:recent'
const MAX = 20

function load(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as RecentItem[]) : []
  } catch {
    return []
  }
}

function save(list: RecentItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* ignore quota */
  }
}

// 模块级单例：所有 useRecent 调用方共享同一份响应式数据
const recentItems = ref<RecentItem[]>(load())

export function useRecent() {
  // 对外仍给只读 computed，避免调用方直接改数组绕过 persist
  const recent = computed<RecentItem[]>(() => recentItems.value)

  function add(item: Omit<RecentItem, 'visitTime'>) {
    if (!item || !item.fileId) return
    const list = recentItems.value.filter((i) => i.fileId !== item.fileId)
    list.unshift({ ...item, visitTime: Date.now() } as RecentItem)
    recentItems.value = list.slice(0, MAX)
    save(recentItems.value)
  }

  function remove(fileId: string) {
    recentItems.value = recentItems.value.filter((i) => i.fileId !== fileId)
    save(recentItems.value)
  }

  function clear() {
    recentItems.value = []
    save([])
  }

  return { recent, add, remove, clear }
}
