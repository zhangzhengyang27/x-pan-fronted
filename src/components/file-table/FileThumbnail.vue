<script setup lang="ts">
/**
 * FileThumbnail —— 智能文件缩略图
 * 1. 图片 (fileType=7)：真实预览 + 加载中骨架 + 失败回落
 * 2. 文件夹 (fileType=0)：渐变背景 + 文件夹 icon
 * 3. 其他类型：彩色背景 + 大图标
 *
 * 后端若提供 thumbnail 字段（image/video），优先用 thumbnail；
 * 当前无后端支持，图片直接走 preview URL。
 */
import { ref, computed, watchEffect, onScopeDispose, onMounted, onBeforeUnmount } from 'vue'
import {
  Folder,
  FileText,
  FileArchive,
  FileSpreadsheet,
  FileImage,
  FileAudio,
  FileVideo,
  FileCode,
  FileBarChart2,
  File,
  LoaderCircle,
  Eye
} from '@lucide/vue'
import { resolvePreviewUrl, invalidatePreviewUrl } from '@/utils/preview'
import {
  getThumbnailFromMemory,
  getThumbnailFromCache,
  putThumbnailToCache
} from '@/utils/thumbnail-cache'
import { useVideoCover } from '@/composables/useVideoCover'
import { cn } from '@/utils/classnames'
import panUtil from '@/utils/common'

const props = defineProps({
  file: { type: Object, required: true },
  size: { type: Number, default: 56 }, // 缩略图正方形边长
  rounded: { type: String, default: 'rounded-sm' },
  // 是否请求缩略图（列表场景默认 true）；预览/详情传入 false 走原图
  thumbnail: { type: Boolean, default: true }
})

const imageLoaded = ref(false)
const imageErrored = ref(false)

const visual = computed(() => {
  const t = props.file.fileType
  if (t === 0) {
    return {
      bg: 'bg-linear-to-br from-primary-100 to-primary-200 dark:from-primary-900/40 dark:to-primary-800/40',
      icon: Folder,
      text: 'text-primary-700',
      label: '文件夹'
    }
  }
  return {
    bg:
      {
        2: 'bg-amber-50 dark:bg-amber-900/20',
        3: 'bg-emerald-50 dark:bg-emerald-900/20',
        4: 'bg-blue-50 dark:bg-blue-900/20',
        5: 'bg-slate-50 dark:bg-slate-800/40',
        6: 'bg-slate-50 dark:bg-slate-800/40',
        7: 'bg-pink-50 dark:bg-pink-900/20',
        8: 'bg-rose-50 dark:bg-rose-900/20',
        9: 'bg-violet-50 dark:bg-violet-900/20',
        10: 'bg-cyan-50 dark:bg-cyan-900/20',
        11: 'bg-orange-50 dark:bg-orange-900/20'
      }[t] || 'bg-slate-50 dark:bg-slate-800/40',
    icon:
      {
        2: FileArchive,
        3: FileSpreadsheet,
        4: FileText,
        5: FileBarChart2,
        6: FileBarChart2,
        7: FileImage,
        8: FileAudio,
        9: FileVideo,
        10: FileBarChart2,
        11: FileCode
      }[t] || File,
    text:
      {
        2: 'text-amber-600 dark:text-amber-400',
        3: 'text-emerald-600 dark:text-emerald-400',
        4: 'text-blue-600 dark:text-blue-400',
        5: 'text-slate-600 dark:text-slate-400',
        6: 'text-slate-600 dark:text-slate-400',
        7: 'text-pink-600 dark:text-pink-400',
        8: 'text-rose-600 dark:text-rose-400',
        9: 'text-violet-600 dark:text-violet-400',
        10: 'text-cyan-600 dark:text-cyan-400',
        11: 'text-orange-600 dark:text-orange-400'
      }[t] || 'text-slate-500',
    label: ''
  }
})

const isImage = computed(() => props.file.fileType === 7)
const isVideo = computed(() => props.file.fileType === 9)
const showImage = computed(() => isImage.value && !imageErrored.value)

// ─── 视频封面（fileType=9）：后端 FFmpeg 封面优先，降级 canvas 采样 ──────────
const videoCover = ref<string | null>(null)
const { watch: watchVideoCover } = useVideoCover()

function resolveVideoCover() {
  if (!isVideo.value || !inViewport.value || videoCover.value) return
  if (rootEl.value) {
    watchVideoCover(props.file.fileId, rootEl.value, (url) => {
      if (!disposed && url) videoCover.value = url
    })
  }
}

// 后端预览直链（图片直出预览流）；后端 thumbnail 字段（P1.8）优先
// 使用 resolvePreviewUrl 获取带短期签名 token 的预览流，避免 /file/thumbnail 返回空
// 列表缩略图场景：请求带 width/height 的缩放流（缩略图），避免加载原图占用带宽；
// 预览/详情场景：thumbnail=false 时请求原图。
const previewUrl = ref<string | null>(null)
let disposed = false
onScopeDispose(() => {
  disposed = true
})

// 进入视口才发起请求：解决 loading="lazy" 仍会触发首屏外图片请求的问题
const inViewport = ref(false)
// 注意：模板 ref 必须用 ref() 定义，普通变量（let rootEl = null）无法被模板赋值，
// 会导致 IntersectionObserver 永不启动、缩略图永不请求。
const rootEl = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

function observe() {
  if ((!isImage.value && !isVideo.value) || typeof IntersectionObserver === 'undefined') {
    inViewport.value = true
    return
  }
  if (!rootEl.value) return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        inViewport.value = true
        observer?.disconnect()
        observer = null
      }
    },
    { rootMargin: '200px' } // 提前 200px 预加载，滚动更顺滑
  )
  observer.observe(rootEl.value)
}

function resolve() {
  if (!isImage.value || !inViewport.value) {
    return
  }
  // 后端已返回缩略图直链（相对路径，如 /file/thumbnail?fileId=xxx），拼服务前缀
  if (props.file.thumbnail) {
    const t = props.file.thumbnail
    previewUrl.value = t.startsWith('http') ? t : panUtil.getUrlPrefix() + t
    return
  }
  const size = props.thumbnail ? 256 : 'original'

  // 优先命中内存缓存（同步，避免闪烁）
  const memHit = getThumbnailFromMemory(props.file.fileId, size)
  if (memHit) {
    previewUrl.value = memHit
    imageLoaded.value = true
    imageErrored.value = false
    return
  }

  resolvePreviewUrl(props.file.fileId, size)
    .then(async (url) => {
      if (disposed) return
      // 缩略图场景：先从 IndexedDB 读取位图缓存，命中则用 blob URL（跳过拉流）
      if (props.thumbnail) {
        const cached = await getThumbnailFromCache(props.file.fileId, size)
        if (!disposed && cached) {
          previewUrl.value = cached
          imageLoaded.value = true
          imageErrored.value = false
          return
        }
      }
      if (!disposed) previewUrl.value = url
    })
    .catch(() => {
      if (!disposed) previewUrl.value = null
    })
}

onMounted(() => {
  if (rootEl.value) observe()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

watchEffect(() => {
  if (isVideo.value) {
    // 视频：触发封面解析（后端 FFmpeg 优先，降级 canvas 采样）
    resolveVideoCover()
    return
  }
  if (!isImage.value) {
    previewUrl.value = null
    return
  }
  resolve()
})

const iconSize = computed(() => Math.max(20, Math.round(props.size * 0.45)))

// ptoken 过期重试：图片加载失败（如 ptoken 5 分钟过期返回 403）时，
// 失效缓存并重新申请一次，最多重试 1 次，避免无限循环。
let retryCount = 0

function onImageLoad() {
  imageLoaded.value = true
  // 缩略图加载成功后，把已拉取的位图写入 IndexedDB 缓存，供后续复用（避免 ptoken 变化导致重复拉流）
  if (props.thumbnail && previewUrl.value) {
    cacheCurrentPreview()
  }
}

/**
 * 把当前预览 URL 对应的图片位图写入缓存。
 * 用 fetch 拉取 Blob（浏览器会命中后端/浏览器缓存），成功后存入 IndexedDB。
 * 失败静默忽略，不影响主流程。
 */
function cacheCurrentPreview() {
  const url = previewUrl.value
  if (!url) return
  // 已经是 blob URL（来自缓存），无需再缓存
  if (url.startsWith('blob:')) return
  const size = props.thumbnail ? 256 : 'original'
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`http ${res.status}`)
      return res.blob()
    })
    .then((blob) => putThumbnailToCache(props.file.fileId, size, blob))
    .catch(() => {
      /* 忽略：缓存写入失败不影响展示 */
    })
}

function onImageError() {
  if (retryCount >= 1) {
    imageErrored.value = true
    return
  }
  retryCount++
  const size = props.thumbnail ? 256 : 'original'
  invalidatePreviewUrl(props.file.fileId, size)
  imageLoaded.value = false
  resolvePreviewUrl(props.file.fileId, size)
    .then((url) => {
      if (!disposed) previewUrl.value = url
    })
    .catch(() => {
      if (!disposed) imageErrored.value = true
    })
}
</script>

<template>
  <div
    ref="rootEl"
    :class="
      cn('relative overflow-hidden flex items-center justify-center shrink-0', rounded, visual.bg)
    "
    :style="{ width: `${size}px`, height: `${size}px` }"
    :aria-label="visual.label || file.filename"
  >
    <!-- 图片：真实预览 -->
    <template v-if="showImage">
      <img
        v-if="previewUrl"
        :src="previewUrl"
        :alt="file.filename"
        class="w-full h-full object-cover"
        :class="imageLoaded ? 'opacity-100' : 'opacity-0'"
        loading="lazy"
        decoding="async"
        @load="onImageLoad"
        @error="onImageError"
      />
      <!-- 加载中骨架 -->
      <LoaderCircle
        v-if="!imageLoaded"
        :size="iconSize * 0.6"
        class="absolute inset-0 m-auto animate-spin text-pink-400"
      />
      <!-- 图片类型徽标 -->
      <span
        v-if="imageLoaded"
        class="absolute bottom-1 right-1 px-1.5 h-4 rounded bg-black/60 text-white text-[10px] leading-4 inline-flex items-center gap-0.5"
      >
        <Eye :size="10" /> 图
      </span>
    </template>

    <!-- 视频：封面缩略图（后端 FFmpeg 优先，降级 canvas 采样；失败回退图标） -->
    <template v-else-if="isVideo">
      <img
        v-if="videoCover"
        :src="videoCover"
        :alt="file.filename"
        class="w-full h-full object-cover"
        loading="lazy"
        decoding="async"
      />
      <component
        v-else
        :is="visual.icon"
        :size="iconSize"
        class="transition-transform group-hover:scale-110"
        :class="visual.text"
      />
    </template>

    <!-- 其他类型：图标 -->
    <component
      v-else
      :is="visual.icon"
      :size="iconSize"
      class="transition-transform group-hover:scale-110"
      :class="visual.text"
    />
  </div>
</template>
