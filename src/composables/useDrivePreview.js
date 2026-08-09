/**
 * useDrivePreview —— 预览状态机（参考 html5-examples useDrivePreview）
 * - 维护预览开关 / 当前文件 / 预览类型 / 画廊索引
 * - resolvePreviewUrl: 带缓存 + 并发去重
 * - openPreview: 收集同目录图片组建画廊
 */
import {reactive, computed} from 'vue'
import {resolvePreviewUrl as resolvePreviewUrlUtil, resolvePreviewKind, isPreviewable} from '@/utils/preview'

export function useDrivePreview(getSiblingItems) {
  const state = reactive({
    open: false,
    item: null,
    kind: 'unsupported',
    galleryItems: [],
    galleryIndex: 0,
  })

  const isOpen = computed(() => state.open)
  const isImage = computed(() => state.kind === 'image')

  /**
   * 打开预览
   * @param {object} item
   * @returns {boolean} 是否成功打开（unsupported 时返回 false，由调用方降级）
   */
  function openPreview(item) {
    if (item.fileType === 0 || item.type === 'folder') return false

    const kind = resolvePreviewKind({
      name: item.name || item.filename,
      mimeType: item.mimeType,
      extension: item.extension,
      fileType: item.fileType,
      type: item.type,
    })
    if (!isPreviewable(kind)) return false

    state.item = item
    state.kind = kind
    state.open = true

    if (kind === 'image') {
      const siblings = getSiblingItems() || []
      state.galleryItems = siblings.filter((s) => {
        if (s.fileType === 0 || s.type === 'folder') return false
        const k = resolvePreviewKind({
          name: s.name || s.filename,
          mimeType: s.mimeType,
          extension: s.extension,
          fileType: s.fileType,
          type: s.type,
        })
        return k === 'image'
      })
      const idx = state.galleryItems.findIndex((s) => (s.fileId || s.id) === (item.fileId || item.id))
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

  function setGalleryIndex(i) {
    state.galleryIndex = i
  }

  function resolvePreviewUrl(item) {
    return resolvePreviewUrlUtil(item.fileId || item.id)
  }

  return {
    state,
    isOpen,
    isImage,
    openPreview,
    closePreview,
    setGalleryIndex,
    resolvePreviewUrl,
  }
}