/**
 * useRecent —— 最近访问列表
 * P1.9 增强：点击文件时记录，保留最近 50 条
 */
import {ref, watch} from 'vue'

const STORAGE_KEY = 'x-pan:recent'
const MAX_ITEMS = 50

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

const recent = ref(loadAll())

watch(
  recent,
  (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    } catch {
      /* quota exceeded */
    }
  },
  {deep: true},
)

export function useRecent() {
  function visit(file) {
    if (!file || !file.fileId) return
    const idx = recent.value.findIndex((f) => f.fileId === file.fileId)
    if (idx >= 0) recent.value.splice(idx, 1)
    recent.value.unshift({
      fileId: file.fileId,
      filename: file.filename || file.name,
      fileType: file.fileType,
      fileSizeDesc: file.fileSizeDesc,
      visitedAt: new Date().toISOString(),
    })
    if (recent.value.length > MAX_ITEMS) {
      recent.value = recent.value.slice(0, MAX_ITEMS)
    }
  }

  function clear() {
    recent.value = []
  }

  return {recent, visit, clear}
}