<script setup lang="ts">
/**
 * PdfPreviewer —— 基于 @vue-office/pdf
 * 1:1 复现 html5-examples PdfPreviewer
 * P1.10：缩放比例持久化
 * P1.11：PDF 文本搜索（pdfjs-dist）
 */
import { computed, ref, watch } from 'vue'
import VueOfficePdf from '@vue-office/pdf'
import { getPreviewUrl } from '@/utils/preview'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import { ZoomIn, ZoomOut, RotateCcw, Search, X, ChevronUp, ChevronDown } from '@lucide/vue'
import { usePdfSearch } from '@/composables/usePdfSearch'

const props = defineProps({
  fileId: { type: [String, Number], required: true }
})

const rendered = ref(false)
const url = ref(getPreviewUrl(props.fileId))

const handleRendered = () => {
  rendered.value = true
}

// ─── 缩放持久化 ─────────────────────────────────────────────────────────────
const ZOOM_KEY = 'x-pan:pdf-zoom'
const DEFAULT_ZOOM = 100
const zoom = ref(Number(localStorage.getItem(ZOOM_KEY) || DEFAULT_ZOOM))

watch(zoom, (v) => {
  try {
    localStorage.setItem(ZOOM_KEY, String(v))
  } catch {
    // 忽略持久化失败
  }
})

function zoomIn() {
  zoom.value = Math.min(zoom.value + 25, 200)
}
function zoomOut() {
  zoom.value = Math.max(zoom.value - 25, 50)
}
function resetZoom() {
  zoom.value = DEFAULT_ZOOM
}

const zoomStyle = computed(() => ({
  transform: `scale(${zoom.value / 100})`,
  transformOrigin: 'top center',
  transition: 'transform 0.15s ease'
}))

// ─── PDF 搜索 ───────────────────────────────────────────────────────────────
const searchOpen = ref(false)
const searchKeyword = ref('')
const searchResults = ref([])
const searchIdx = ref(0)
const { load: loadPdfDoc, search: pdfSearch } = usePdfSearch()

async function doSearch() {
  if (!searchKeyword.value.trim()) {
    searchResults.value = []
    return
  }
  if (!pdfDoc.value) await loadPdfDoc(url.value)
  searchResults.value = await pdfSearch(searchKeyword.value.trim())
  searchIdx.value = 0
  if (searchResults.value.length > 0) {
    ElMessage?.success?.(`找到 ${searchResults.value.length} 处匹配`)
  }
}

import { ElMessage } from '@/composables/useToast'
const pdfDoc = ref(null)

function nextResult() {
  if (searchResults.value.length === 0) return
  searchIdx.value = (searchIdx.value + 1) % searchResults.value.length
}
function prevResult() {
  if (searchResults.value.length === 0) return
  searchIdx.value = (searchIdx.value - 1 + searchResults.value.length) % searchResults.value.length
}
function closeSearch() {
  searchOpen.value = false
  searchKeyword.value = ''
  searchResults.value = []
}
</script>

<template>
  <div class="relative h-full w-full overflow-auto bg-[var(--color-surface-2)]">
    <!-- 工具栏 -->
    <div
      class="sticky top-0 z-10 flex items-center justify-center gap-2 py-2 bg-[var(--color-surface)]/90 backdrop-blur border-b border-[var(--color-border)] flex-wrap"
    >
      <BaseButton variant="ghost" size="sm" @click="zoomOut" :disabled="zoom <= 50">
        <ZoomOut :size="14" />
      </BaseButton>
      <span class="text-xs font-mono tabular-nums min-w-[50px] text-center text-[var(--color-text)]"
        >{{ zoom }}%</span
      >
      <BaseButton variant="ghost" size="sm" @click="zoomIn" :disabled="zoom >= 200">
        <ZoomIn :size="14" />
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="resetZoom">
        <RotateCcw :size="14" />
        重置
      </BaseButton>
      <span class="mx-2 h-4 w-px bg-[var(--color-border)]" />
      <BaseButton
        variant="ghost"
        size="sm"
        @click="searchOpen = !searchOpen"
        :class="searchOpen && 'bg-[var(--color-primary-50)]'"
      >
        <Search :size="14" />
        搜索
      </BaseButton>
      <span v-if="searchResults.length" class="text-xs text-[var(--color-text-muted)] tabular-nums">
        {{ searchIdx + 1 }} / {{ searchResults.length }}
      </span>
    </div>

    <!-- 搜索框 -->
    <div
      v-if="searchOpen"
      class="sticky top-12 z-10 mx-auto mt-1 w-fit max-w-2xl flex items-center gap-1 px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md shadow-sm"
    >
      <Search :size="14" class="text-[var(--color-text-muted)]" />
      <BaseInput
        v-model="searchKeyword"
        size="sm"
        placeholder="搜索 PDF 内容（最多前 50 页）"
        @enter="doSearch"
      />
      <button
        v-if="searchResults.length"
        type="button"
        class="size-6 rounded hover:bg-[var(--color-surface-2)] flex items-center justify-center"
        title="上一个"
        @click="prevResult"
      >
        <ChevronUp :size="14" />
      </button>
      <button
        v-if="searchResults.length"
        type="button"
        class="size-6 rounded hover:bg-[var(--color-surface-2)] flex items-center justify-center"
        title="下一个"
        @click="nextResult"
      >
        <ChevronDown :size="14" />
      </button>
      <button
        type="button"
        class="size-6 rounded hover:bg-[var(--color-surface-2)] flex items-center justify-center"
        title="关闭"
        @click="closeSearch"
      >
        <X :size="14" />
      </button>
    </div>

    <div :style="zoomStyle" class="origin-top">
      <VueOfficePdf :src="url" style="height: 100%; width: 100%" @rendered="handleRendered" />
    </div>
  </div>
</template>
