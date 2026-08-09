/**
 * useFavorites —— 收藏夹
 * P1.9 增强：基于 localStorage 的轻量收藏功能
 * 后端 is_favorite / star 字段可后续接入
 */
import { computed, ref, watch } from 'vue'

const STORAGE_KEY = 'x-pan:favorites'

export interface FavoriteItem {
  fileId: string | number
  filename?: string
  name?: string
  fileType?: number
  fileSizeDesc?: string
  updateTime?: string
  addedAt: string
  [key: string]: unknown
}

function loadAll(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as FavoriteItem[]
  } catch {
    return []
  }
}

const favorites = ref<FavoriteItem[]>(loadAll())

watch(
  favorites,
  (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    } catch {
      /* quota exceeded */
    }
  },
  { deep: true }
)

export function useFavorites() {
  const isFavorite = (fileId: string | number) => favorites.value.some((f) => f.fileId === fileId)
  const count = computed(() => favorites.value.length)

  function toggle(file: FavoriteItem) {
    if (!file || !file.fileId) return
    const idx = favorites.value.findIndex((f) => f.fileId === file.fileId)
    if (idx >= 0) {
      favorites.value.splice(idx, 1)
    } else {
      favorites.value.unshift({
        fileId: file.fileId,
        filename: file.filename || file.name,
        fileType: file.fileType,
        fileSizeDesc: file.fileSizeDesc,
        updateTime: file.updateTime,
        addedAt: new Date().toISOString()
      })
    }
  }

  function remove(fileId: string | number) {
    const idx = favorites.value.findIndex((f) => f.fileId === fileId)
    if (idx >= 0) favorites.value.splice(idx, 1)
  }

  function clear() {
    favorites.value = []
  }

  return { favorites, count, isFavorite, toggle, remove, clear }
}
