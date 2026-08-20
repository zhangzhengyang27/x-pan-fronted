/**
 * useDrivePreview —— 预览状态机（参考 html5-examples useDrivePreview）
 * - 维护预览开关 / 当前文件 / 预览类型 / 画廊索引
 * - resolvePreviewUrl: 带缓存 + 并发去重
 * - openPreview: 收集同目录图片组建画廊
 */
import { reactive, computed } from 'vue'
import {
  resolvePreviewUrl as resolvePreviewUrlUtil,
  resolvePreviewKind,
  isPreviewable
} from '@/utils/preview'

/**
 * 预览文件项，字段与后端 XPanUserFileVO 对齐。
 * 文件ID 用 fileId、文件名用 filename；后端没有 id / name / type 字段，已移除。
 * 文件夹统一用 fileType === 0 判断。
 */
export interface PreviewItem {
  fileId?: string | number
  filename?: string
  mimeType?: string
  extension?: string
  fileType?: number
  [key: string]: unknown
}

export interface DrivePreviewState {
  open: boolean
  item: PreviewItem | null
  kind: string
  galleryItems: PreviewItem[]
  galleryIndex: number
}

export function useDrivePreview(getSiblingItems: () => PreviewItem[]) {
  const state = reactive<DrivePreviewState>({
    open: false,
    item: null,
    kind: 'unsupported',
    galleryItems: [],
    galleryIndex: 0
  })

  const isOpen = computed(() => state.open)
  const isImage = computed(() => state.kind === 'image')

  /**
   * 打开预览
   * @param item 待预览文件
   * @returns 是否成功打开（unsupported 时返回 false，由调用方降级）
   */
  function openPreview(item: PreviewItem): boolean {
    if (item.fileType === 0) return false

    const kind = resolvePreviewKind({
      filename: item.filename,
      mimeType: item.mimeType,
      extension: item.extension,
      fileType: item.fileType
    })
    if (!isPreviewable(kind)) return false

    state.item = item
    state.kind = kind
    state.open = true

    if (kind === 'image') {
      const siblings = getSiblingItems() || []
      state.galleryItems = siblings.filter((s) => {
        if (s.fileType === 0) return false
        const k = resolvePreviewKind({
          filename: s.filename,
          mimeType: s.mimeType,
          extension: s.extension,
          fileType: s.fileType
        })
        return k === 'image'
      })
      const idx = state.galleryItems.findIndex(
        (s) => s.fileId === item.fileId
      )
      state.galleryIndex = idx >= 0 ? idx : 0
    } else {
      state.galleryItems = []
      state.galleryIndex = 0
    }
    return true
  }

  function closePreview() {
    state.open = false
  }

  function setGalleryIndex(i: number) {
    state.galleryIndex = i
  }

  function resolvePreviewUrl(item: PreviewItem) {
    return resolvePreviewUrlUtil(item.fileId)
  }

  return {
    state,
    isOpen,
    isImage,
    openPreview,
    closePreview,
    setGalleryIndex,
    resolvePreviewUrl
  }
}
