/**
 * useFavorites —— 收藏夹（对接后端 P4 /favorite/* 接口）
 *
 * 交互策略：
 * - 首次进入时从后端拉取收藏列表（ensureLoaded），本地缓存一份 fileId 集合用于快速 isFavorite 判断
 * - toggle 时乐观更新本地缓存 + 调后端 add/remove；失败回滚
 * - 收藏列表页调 refresh() 从后端拿完整数据
 */
import { computed, ref } from 'vue'
import favoriteService from '@/api/favorite'
import { ElMessage } from '@/composables/useToast'

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

/** 收藏列表（后端数据，含 favoriteTime） */
const favorites = ref<FavoriteItem[]>([])
/** 已加载标记 */
let loaded = false

export function useFavorites() {
  const isFavorite = (fileId: string | number) => favorites.value.some((f) => f.fileId === fileId)
  const count = computed(() => favorites.value.length)

  /** 从后端拉取收藏列表（用于初始化 / 刷新） */
  function refresh() {
    favoriteService.list(
      (res) => {
        favorites.value = (res.data || []).map((it) => ({
          fileId: it.fileId,
          filename: it.filename,
          name: it.filename,
          fileType: it.fileType,
          fileSizeDesc: it.fileSizeDesc,
          updateTime: it.favoriteTime,
          addedAt: it.favoriteTime
        }))
        loaded = true
      },
      () => {
        loaded = true
      }
    )
  }

  /** 确保已初始化（首次调用时拉取） */
  function ensureLoaded() {
    if (!loaded) refresh()
  }

  function toggle(file: FavoriteItem) {
    if (!file || !file.fileId) return
    const idx = favorites.value.findIndex((f) => f.fileId === file.fileId)
    const idStr = String(file.fileId)

    if (idx >= 0) {
      // 取消收藏：乐观移除 + 调后端
      const removed = favorites.value.splice(idx, 1)
      favoriteService.remove(
        [idStr],
        () => {
          /* 成功 */
        },
        () => {
          // 失败回滚
          favorites.value.splice(idx, 0, ...removed)
          ElMessage.error('取消收藏失败')
        }
      )
    } else {
      // 收藏：乐观加入 + 调后端
      favorites.value.unshift({
        fileId: file.fileId,
        filename: file.filename || file.name,
        fileType: file.fileType,
        fileSizeDesc: file.fileSizeDesc,
        updateTime: file.updateTime,
        addedAt: new Date().toISOString()
      })
      favoriteService.add(
        [idStr],
        () => {
          /* 成功 */
        },
        () => {
          favorites.value = favorites.value.filter((f) => f.fileId !== file.fileId)
          ElMessage.error('收藏失败')
        }
      )
    }
  }

  function remove(fileId: string | number) {
    const idx = favorites.value.findIndex((f) => f.fileId === fileId)
    if (idx >= 0) favorites.value.splice(idx, 1)
  }

  function clear() {
    favorites.value = []
  }

  return { favorites, count, isFavorite, toggle, remove, clear, refresh, ensureLoaded }
}
