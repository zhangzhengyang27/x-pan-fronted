<script setup>
/**
 * PdfPreviewer —— pdfjs-dist 渲染
 * - 手动控制 worker（pdfjs 4+ worker 用 import）
 * - 翻页 / 缩放 / 下载
 */
import {onBeforeUnmount, onMounted, ref} from 'vue'
import {getPreviewUrl} from '@/utils/preview'
import {ZoomIn, ZoomOut, ChevronLeft, ChevronRight} from '@lucide/vue'

const props = defineProps({
  fileId: {type: [String, Number], required: true},
})

const canvasRef = ref(null)
const loading = ref(true)
const error = ref('')
const pageNum = ref(1)
const pageCount = ref(0)
const scale = ref(1.2)
let pdfDoc = null

async function ensurePdf() {
  const pdfjs = await import('pdfjs-dist')
  // worker 用 ESM import（Vite 自动 bundle）
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  return pdfjs
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const pdfjs = await ensurePdf()
    const loadingTask = pdfjs.getDocument({url: getPreviewUrl(props.fileId), withCredentials: false})
    pdfDoc = await loadingTask.promise
    pageCount.value = pdfDoc.numPages
    pageNum.value = 1
    await renderPage()
  } catch (e) {
    error.value = e?.message || 'PDF 加载失败'
  } finally {
    loading.value = false
  }
}

async function renderPage() {
  if (!pdfDoc || !canvasRef.value) return
  const page = await pdfDoc.getPage(pageNum.value)
  const viewport = page.getViewport({scale: scale.value})
  const canvas = canvasRef.value
  canvas.height = viewport.height
  canvas.width = viewport.width
  const ctx = canvas.getContext('2d')
  await page.render({canvasContext: ctx, viewport}).promise
}

async function nextPage() {
  if (pageNum.value < pageCount.value) {
    pageNum.value++
    await renderPage()
  }
}
async function prevPage() {
  if (pageNum.value > 1) {
    pageNum.value--
    await renderPage()
  }
}
async function zoomIn() {
  scale.value = Math.min(3, scale.value + 0.2)
  await renderPage()
}
async function zoomOut() {
  scale.value = Math.max(0.5, scale.value - 0.2)
  await renderPage()
}

onMounted(load)
onBeforeUnmount(() => {
  if (pdfDoc) {
    pdfDoc.destroy()
    pdfDoc = null
  }
})
</script>

<template>
  <div class="h-full flex flex-col bg-[var(--color-surface-2)]">
    <!-- 工具条 -->
    <div class="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div class="flex items-center gap-1">
        <button type="button" class="size-8 rounded-md hover:bg-[var(--color-surface-2)] flex items-center justify-center disabled:opacity-30" :disabled="pageNum <= 1" aria-label="上一页" @click="prevPage">
          <ChevronLeft :size="16"/>
        </button>
        <span class="text-xs text-[var(--color-text-muted)] tabular-nums px-2">{{ pageNum }} / {{ pageCount || '–' }}</span>
        <button type="button" class="size-8 rounded-md hover:bg-[var(--color-surface-2)] flex items-center justify-center disabled:opacity-30" :disabled="pageNum >= pageCount" aria-label="下一页" @click="nextPage">
          <ChevronRight :size="16"/>
        </button>
      </div>
      <div class="flex items-center gap-1">
        <button type="button" class="size-8 rounded-md hover:bg-[var(--color-surface-2)] flex items-center justify-center" aria-label="缩小" @click="zoomOut">
          <ZoomOut :size="16"/>
        </button>
        <span class="text-xs text-[var(--color-text-muted)] tabular-nums px-2">{{ Math.round(scale * 100) }}%</span>
        <button type="button" class="size-8 rounded-md hover:bg-[var(--color-surface-2)] flex items-center justify-center" aria-label="放大" @click="zoomIn">
          <ZoomIn :size="16"/>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto flex items-start justify-center p-6">
      <div v-if="loading" class="flex h-full items-center justify-center w-full">
        <div class="size-10 rounded-xl bg-[var(--color-surface)] animate-pulse"/>
      </div>
      <div v-else-if="error" class="flex h-full items-center justify-center text-sm text-[var(--color-danger)]">
        {{ error }}
      </div>
      <canvas v-show="!loading && !error" ref="canvasRef" class="shadow-md rounded"/>
    </div>
  </div>
</template>