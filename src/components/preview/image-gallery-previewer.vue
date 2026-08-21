<script setup lang="ts">
/**
 * ImageGalleryPreviewer —— 全屏图片画廊
 * 1:1 复现 html5-examples ImageGalleryPreviewer 行为：
 * - 同目录多图翻页（←→ 键）
 * - 缩略图栏
 * - 循环浏览
 * - 每张图片 URL 缓存（避免重复请求）
 * - 加载态占位
 */
import { onMounted, ref, watch, onBeforeUnmount, computed } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Play,
  Pause
} from '@lucide/vue'
import { resolvePreviewUrl } from '@/utils/preview'

interface GalleryItem {
  fileId: string | number
  filename?: string
  source?: string
  [key: string]: unknown
}

const props = withDefaults(
  defineProps<{
    items: GalleryItem[]
    activeIndex?: number
    /** 'inline' 显示在 modal 内 / 'fullscreen' 浮层 */
    mode?: string
  }>(),
  { items: () => [], activeIndex: 0, mode: 'fullscreen' }
)

const emit = defineEmits(['update:activeIndex', 'close', 'download'])

// fileId → URL 缓存（避免重复请求）
const urlMap = ref({})
const loadingIds = ref(new Set())
const scale = ref(1)
const rotation = ref(0)

// ─── P1.10：幻灯片自动播放 ─────────────────────────────────────────────────
const isPlaying = ref(false)
const intervalMs = 3000
let slideTimer = null

function startSlideshow() {
  if (slideTimer) return
  isPlaying.value = true
  slideTimer = setInterval(() => {
    if (props.items.length > 1) next()
  }, intervalMs)
}

function stopSlideshow() {
  if (slideTimer) {
    clearInterval(slideTimer)
    slideTimer = null
  }
  isPlaying.value = false
}

function toggleSlideshow() {
  if (isPlaying.value) stopSlideshow()
  else startSlideshow()
}

const currentItem = computed(() => props.items[props.activeIndex] || null)
const currentSrc = computed(() => {
  const c = currentItem.value
  return c && urlMap.value[c.fileId] ? urlMap.value[c.fileId] : ''
})

async function loadUrls(items) {
  await Promise.all(
    items.map(async (it) => {
      if (urlMap.value[it.fileId] || loadingIds.value.has(it.fileId)) return
      loadingIds.value.add(it.fileId)
      try {
        const url = await resolvePreviewUrl(it.fileId)
        urlMap.value = { ...urlMap.value, [it.fileId]: url }
      } catch {
        // 单张失败不阻断画廊
      } finally {
        const next = new Set(loadingIds.value)
        next.delete(it.fileId)
        loadingIds.value = next
      }
    })
  )
}

function resetView() {
  scale.value = 1
  rotation.value = 0
}

function next() {
  if (props.items.length === 0) return
  const i = (props.activeIndex + 1) % props.items.length
  emit('update:activeIndex', i)
  resetView()
}
function prev() {
  if (props.items.length === 0) return
  const i = (props.activeIndex - 1 + props.items.length) % props.items.length
  emit('update:activeIndex', i)
  resetView()
}
function pick(i) {
  emit('update:activeIndex', i)
  resetView()
}
function close() {
  emit('close')
}
function zoomIn() {
  scale.value = Math.min(4, scale.value + 0.25)
}
function zoomOut() {
  scale.value = Math.max(0.25, scale.value - 0.25)
}
function rotate() {
  rotation.value = (rotation.value + 90) % 360
}
function download() {
  if (currentItem.value) emit('download', currentItem.value)
}

function onWheel(e) {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  if (e.deltaY < 0) zoomIn()
  else zoomOut()
}

function onKey(e) {
  if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'Escape') close()
  else if (e.key === '+' || e.key === '=') zoomIn()
  else if (e.key === '-') zoomOut()
  else if (e.key === ' ') {
    e.preventDefault()
    toggleSlideshow()
  }
}

onMounted(() => {
  loadUrls(props.items)
  window.addEventListener('keydown', onKey)
})

watch(
  () => props.items,
  (items) => loadUrls(items)
)
watch(() => props.activeIndex, resetView)
watch(isPlaying, () => {
  // 播放时如果用户手动切换也保持
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  stopSlideshow()
})
</script>

<template>
  <!-- 全屏模式：固定铺满 -->
  <div v-if="mode === 'fullscreen'" class="fixed inset-0 bg-black text-white flex flex-col z-50">
    <header
      class="h-14 px-5 flex items-center justify-between bg-black/60 backdrop-blur border-b border-white/5 z-10"
    >
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <span class="text-sm font-medium truncate">{{ currentItem?.filename || '' }}</span>
        <span v-if="items.length" class="text-xs text-white/50 tabular-nums shrink-0"
          >{{ activeIndex + 1 }} / {{ items.length }}</span
        >
      </div>
      <div class="flex items-center gap-1">
        <button
          v-if="items.length > 1"
          type="button"
          class="size-9 rounded-sm hover:bg-white/10 flex items-center justify-center"
          :aria-label="isPlaying ? '暂停' : '播放'"
          :title="isPlaying ? '暂停 (空格)' : '播放 (空格)'"
          @click="toggleSlideshow"
        >
          <Pause v-if="isPlaying" :size="16" />
          <Play v-else :size="16" />
        </button>
        <button
          type="button"
          class="size-9 rounded-sm hover:bg-white/10 flex items-center justify-center"
          aria-label="缩小"
          @click="zoomOut"
        >
          <ZoomOut :size="16" />
        </button>
        <span class="text-xs tabular-nums text-white/70 px-1 w-12 text-center"
          >{{ Math.round(scale * 100) }}%</span
        >
        <button
          type="button"
          class="size-9 rounded-sm hover:bg-white/10 flex items-center justify-center"
          aria-label="放大"
          @click="zoomIn"
        >
          <ZoomIn :size="16" />
        </button>
        <button
          type="button"
          class="size-9 rounded-sm hover:bg-white/10 flex items-center justify-center"
          aria-label="旋转"
          @click="rotate"
        >
          <RotateCcw :size="16" />
        </button>
        <button
          type="button"
          class="size-9 rounded-sm hover:bg-white/10 flex items-center justify-center"
          aria-label="下载"
          @click="download"
        >
          <Download :size="16" />
        </button>
        <button
          type="button"
          class="size-9 rounded-sm hover:bg-white/10 flex items-center justify-center"
          aria-label="关闭"
          @click="close"
        >
          <X :size="18" />
        </button>
      </div>
    </header>

    <main class="flex-1 flex items-center justify-center relative overflow-hidden" @wheel="onWheel">
      <button
        v-if="items.length > 1"
        type="button"
        class="absolute left-4 top-1/2 -translate-y-1/2 z-10 size-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur flex items-center justify-center transition-colors"
        aria-label="上一张"
        @click="prev"
      >
        <ChevronLeft :size="22" />
      </button>
      <button
        v-if="items.length > 1"
        type="button"
        class="absolute right-4 top-1/2 -translate-y-1/2 z-10 size-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur flex items-center justify-center transition-colors"
        aria-label="下一张"
        @click="next"
      >
        <ChevronRight :size="22" />
      </button>

      <div v-if="!currentItem" class="text-sm text-white/60">暂无图片</div>
      <img
        v-else-if="currentSrc"
        :src="currentSrc"
        :alt="currentItem.filename"
        class="max-w-full max-h-full select-none transition-transform duration-200"
        :style="{ transform: `scale(${scale}) rotate(${rotation}deg)` }"
        draggable="false"
      />
      <div v-else class="size-10 rounded-xl bg-white/10 animate-pulse" />
    </main>

    <footer
      v-if="items.length > 1"
      class="h-24 px-5 flex items-center gap-2 overflow-x-auto border-t border-white/5 bg-black/60 backdrop-blur"
    >
      <button
        v-for="(it, i) in items"
        :key="it.fileId"
        type="button"
        class="shrink-0 h-20 w-20 rounded-sm overflow-hidden border-2 transition-all"
        :class="
          i === activeIndex
            ? 'border-primary-400 opacity-100 scale-105'
            : 'border-transparent opacity-60 hover:opacity-100'
        "
        :aria-label="it.filename"
        @click="pick(i)"
      >
        <img
          v-if="urlMap[it.fileId]"
          :src="urlMap[it.fileId]"
          :alt="it.filename"
          class="w-full h-full object-cover"
        />
        <div v-else class="w-full h-full bg-white/10 animate-pulse" />
      </button>
    </footer>
  </div>

  <!-- inline 模式：嵌入弹窗（保留供 DrivePreviewModal 使用） -->
  <div
    v-else
    class="relative w-full h-full flex items-center justify-center bg-(--color-surface-2)"
  >
    <button
      v-if="items.length > 1"
      type="button"
      class="absolute left-3 top-1/2 -translate-y-1/2 z-10 size-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur text-white flex items-center justify-center transition-colors"
      aria-label="上一张"
      @click="prev"
    >
      <ChevronLeft :size="20" />
    </button>
    <button
      v-if="items.length > 1"
      type="button"
      class="absolute right-3 top-1/2 -translate-y-1/2 z-10 size-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur text-white flex items-center justify-center transition-colors"
      aria-label="下一张"
      @click="next"
    >
      <ChevronRight :size="20" />
    </button>
    <img
      v-if="currentSrc"
      :src="currentSrc"
      :alt="currentItem?.filename"
      class="max-h-full max-w-full object-contain"
    />
    <div v-else class="size-10 rounded-xl bg-(--color-surface) animate-pulse" />
  </div>
</template>
