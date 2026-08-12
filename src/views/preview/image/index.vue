<script setup lang="ts">
/**
 * PreviewImage —— 图片画廊
 * - 同目录多图翻页（左右键 / 按钮）
 * - 缩略图栏 + 当前激活高亮
 * - 滚轮缩放
 * - 失败占位
 */
import { computed, onMounted, ref, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronLeft, ChevronRight, X, Download, ZoomIn, ZoomOut, RotateCcw } from '@lucide/vue'
import fileService from '@/api/file'
import panUtil from '@/utils/common'
import { ElMessage } from '@/composables/useToast'
import { getPreviewUrl, getDownloadUrl } from '@/utils/preview'

const route = useRoute()
const items = ref([])
const activeIdx = ref(0)
const loading = ref(true)
const scale = ref(1)
const rotation = ref(0)
const showList = ref(true)

const activeItem = computed(() => items.value[activeIdx.value] || null)
const src = computed(() => (activeItem.value ? getPreviewUrl(activeItem.value.fileId) : ''))
const downloadUrl = computed(() =>
  activeItem.value ? getDownloadUrl(activeItem.value.fileId) : ''
)

function next() {
  if (activeIdx.value < items.value.length - 1) {
    activeIdx.value++
    resetView()
  }
}
function prev() {
  if (activeIdx.value > 0) {
    activeIdx.value--
    resetView()
  }
}
function pick(i) {
  activeIdx.value = i
  resetView()
}
function close() {
  window.close()
}
function resetView() {
  scale.value = 1
  rotation.value = 0
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
}

onMounted(() => {
  // 加载同目录全部图片
  fileService.list(
    { parentId: panUtil.handleId(route.params.parentId || ''), fileTypes: '7' },
    (res) => {
      items.value = res.data || []
      const idx = items.value.findIndex((x) => x.fileId === route.params.fileId)
      activeIdx.value = idx === -1 ? 0 : idx
      loading.value = false
    },
    (res) => {
      ElMessage.error(res.message)
      loading.value = false
    }
  )
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="fixed inset-0 bg-black text-white flex flex-col">
    <!-- 顶部工具条 -->
    <header
      class="h-14 px-5 flex items-center justify-between bg-black/60 backdrop-blur border-b border-white/5 z-10"
    >
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <span class="text-sm font-medium truncate">{{ activeItem?.filename || '' }}</span>
        <span v-if="items.length" class="text-xs text-white/50 tabular-nums shrink-0"
          >{{ activeIdx + 1 }} / {{ items.length }}</span
        >
      </div>
      <div class="flex items-center gap-1">
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
        <a
          :href="downloadUrl"
          target="_blank"
          class="size-9 rounded-sm hover:bg-white/10 flex items-center justify-center"
          aria-label="下载"
        >
          <Download :size="16" />
        </a>
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

    <!-- 主区域 -->
    <div class="flex-1 flex min-h-0">
      <!-- 缩略图栏 -->
      <aside
        class="shrink-0 border-r border-white/5 bg-black/40 overflow-y-auto transition-all"
        :class="showList ? 'w-28' : 'w-0'"
        style="height: calc(100vh - 3.5rem - 6rem)"
      >
        <button
          v-for="(it, i) in items"
          :key="it.fileId"
          type="button"
          class="block w-full aspect-square p-1 transition-opacity"
          :class="i === activeIdx ? '' : 'opacity-50 hover:opacity-100'"
          :aria-label="it.filename"
          @click="pick(i)"
        >
          <img
            :src="getPreviewUrl(it.fileId)"
            :alt="it.filename"
            class="w-full h-full object-cover rounded border-2"
            :class="i === activeIdx ? 'border-[var(--color-primary-400)]' : 'border-transparent'"
          />
        </button>
      </aside>

      <!-- 画布 -->
      <main
        class="flex-1 flex items-center justify-center relative overflow-hidden"
        @wheel="onWheel"
      >
        <button
          type="button"
          v-if="activeIdx > 0"
          class="absolute left-4 top-1/2 -translate-y-1/2 z-10 size-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur flex items-center justify-center transition-colors"
          aria-label="上一张"
          @click="prev"
        >
          <ChevronLeft :size="22" />
        </button>
        <button
          type="button"
          v-if="activeIdx < items.length - 1"
          class="absolute right-4 top-1/2 -translate-y-1/2 z-10 size-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur flex items-center justify-center transition-colors"
          aria-label="下一张"
          @click="next"
        >
          <ChevronRight :size="22" />
        </button>

        <div v-if="loading" class="size-10 rounded-xl bg-white/10 animate-pulse" />
        <div v-else-if="!items.length" class="text-sm text-white/60">暂无图片</div>
        <img
          v-else
          :src="src"
          :alt="activeItem.filename"
          class="max-w-full max-h-full select-none transition-transform duration-200"
          :style="{ transform: `scale(${scale}) rotate(${rotation}deg)` }"
          draggable="false"
        />
      </main>
    </div>

    <!-- 底部 -->
    <footer
      class="h-24 px-5 flex items-center gap-2 overflow-x-auto border-t border-white/5 bg-black/60 backdrop-blur"
    >
      <button
        v-for="(it, i) in items"
        :key="it.fileId"
        type="button"
        class="shrink-0 h-20 w-20 rounded-sm overflow-hidden border-2 transition-all"
        :class="
          i === activeIdx
            ? 'border-[var(--color-primary-400)] opacity-100 scale-105'
            : 'border-transparent opacity-60 hover:opacity-100'
        "
        :aria-label="it.filename"
        @click="pick(i)"
      >
        <img
          :src="getPreviewUrl(it.fileId)"
          :alt="it.filename"
          class="w-full h-full object-cover"
        />
      </button>
    </footer>
  </div>
</template>
