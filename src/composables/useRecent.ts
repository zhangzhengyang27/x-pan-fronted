/**
 * useRecent —— 最近访问（P1.8）
 * localStorage 存储最近访问文件（最多 20 条，按访问时间倒序）
 */
import { computed } from 'vue'

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

export function useRecent() {
  const recent = computed<RecentItem[]>(() => load())

  function add(item: Omit<RecentItem, 'visitTime'>) {
    if (!item || !item.fileId) return
    const list = load().filter((i) => i.fileId !== item.fileId)
    list.unshift({ ...item, visitTime: Date.now() } as RecentItem)
    save(list.slice(0, MAX))
  }

  function remove(fileId: string) {
    save(load().filter((i) => i.fileId !== fileId))
  }

  function clear() {
    save([])
  }

  return { recent, add, remove, clear }
}
