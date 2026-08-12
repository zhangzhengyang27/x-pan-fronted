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
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  FileOutput,
  LoaderCircle
} from '@lucide/vue'
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

// ─── P2-5 PDF 工具：视觉旋转 + pdf-lib 保存旋转 / 提取页面 ──────────────────
const rotation = ref(0) // 视觉旋转角度（0/90/180/270）
const processing = ref(false) // pdf-lib 处理中

const zoomStyle = computed(() => ({
  transform: `scale(${zoom.value / 100}) rotate(${rotation.value}deg)`,
  transformOrigin: 'top center',
  transition: 'transform 0.15s ease'
}))

function rotateLeft() {
  rotation.value = (rotation.value + 270) % 360
}
function rotateRight() {
  rotation.value = (rotation.value + 90) % 360
}
function resetRotation() {
  rotation.value = 0
}

function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = u
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(u), 30000)
}

// 解析页码范围 "1-3,5,7-9" → 0-based 索引数组
function parsePageRanges(input: string, maxPage: number): number[] {
  const result: number[] = []
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean)
  for (const part of parts) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map((n) => parseInt(n.trim(), 10))
      if (isNaN(a) || isNaN(b)) continue
      const lo = Math.max(1, Math.min(a, b))
      const hi = Math.min(maxPage, Math.max(a, b))
      for (let i = lo; i <= hi; i++) result.push(i - 1)
    } else {
      const n = parseInt(part, 10)
      if (!isNaN(n) && n >= 1 && n <= maxPage) result.push(n - 1)
    }
  }
  return [...new Set(result)].sort((a, b) => a - b)
}

async function fetchPdfBytes(): Promise<ArrayBuffer> {
  const res = await fetch(url.value)
  if (!res.ok) throw new Error('PDF 下载失败（' + res.status + '）')
  return res.arrayBuffer()
}

// 应用当前视觉旋转到 PDF 每页并下载
async function saveRotated() {
  if (processing.value) return
  if (rotation.value === 0) {
    ElMessage.info('当前未旋转，无需保存')
    return
  }
  processing.value = true
  try {
    const { PDFDocument, degrees } = await import('pdf-lib')
    const buf = await fetchPdfBytes()
    const doc = await PDFDocument.load(buf)
    for (const page of doc.getPages()) {
      const cur = page.getRotation().angle
      page.setRotation(degrees((cur + rotation.value) % 360))
    }
    const bytes = await doc.save()
    downloadPdfBytes(bytes, `pdf-rotated-${Date.now()}.pdf`)
    ElMessage.success('已保存旋转后的 PDF')
  } catch (e) {
    ElMessage.error('旋转保存失败：' + ((e as Error)?.message || ''))
  } finally {
    processing.value = false
  }
}

// 提取指定页面到新 PDF 并下载
const extractOpen = ref(false)
const extractRange = ref('')

async function confirmExtract() {
  const input = extractRange.value.trim()
  if (!input) {
    ElMessage.warning('请输入页码范围')
    return
  }
  if (processing.value) return
  processing.value = true
  try {
    const { PDFDocument } = await import('pdf-lib')
    const buf = await fetchPdfBytes()
    const srcDoc = await PDFDocument.load(buf)
    const maxPage = srcDoc.getPageCount()
    const indices = parsePageRanges(input, maxPage)
    if (indices.length === 0) {
      ElMessage.warning('未解析到有效页码')
      return
    }
    const newDoc = await PDFDocument.create()
    const copied = await newDoc.copyPages(srcDoc, indices)
    copied.forEach((p) => newDoc.addPage(p))
    const bytes = await newDoc.save()
    downloadPdfBytes(bytes, `pdf-extracted-${Date.now()}.pdf`)
    ElMessage.success(`已提取 ${indices.length} 页`)
    extractOpen.value = false
    extractRange.value = ''
  } catch (e) {
    ElMessage.error('提取失败：' + ((e as Error)?.message || ''))
  } finally {
    processing.value = false
  }
}

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
      <!-- P2-5 PDF 工具：旋转 / 保存旋转 / 提取页面 -->
      <span class="mx-2 h-4 w-px bg-[var(--color-border)]" />
      <BaseButton variant="ghost" size="sm" title="逆时针旋转 90°" @click="rotateLeft">
        <RotateCcw :size="14" />
      </BaseButton>
      <BaseButton variant="ghost" size="sm" title="顺时针旋转 90°" @click="rotateRight">
        <RotateCw :size="14" />
      </BaseButton>
      <span v-if="rotation !== 0" class="text-xs font-mono tabular-nums text-[var(--color-text-muted)]">{{ rotation }}°</span>
      <BaseButton
        v-if="rotation !== 0"
        variant="ghost"
        size="sm"
        title="保存旋转到新 PDF 文件"
        :disabled="processing"
        @click="saveRotated"
      >
        <LoaderCircle v-if="processing" :size="14" class="animate-spin" />
        <span v-else>保存旋转</span>
      </BaseButton>
      <BaseButton
        variant="ghost"
        size="sm"
        title="提取指定页面到新 PDF"
        :disabled="processing"
        @click="extractOpen = true"
      >
        <FileOutput :size="14" />
        提取页面
      </BaseButton>
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

    <!-- P2-5 提取页面弹窗 -->
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="extractOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="extractOpen = false"
      >
        <div class="w-[420px] max-w-[90vw] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xl">
          <h3 class="text-base font-medium mb-3 text-[var(--color-text)]">提取页面到新 PDF</h3>
          <p class="text-xs text-[var(--color-text-muted)] mb-3 leading-relaxed">
            输入页码范围，用逗号分隔。例如
            <code class="px-1 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-primary-500)]">1-3,5,7-9</code>
            将提取第 1-3 页、第 5 页、第 7-9 页。
          </p>
          <BaseInput
            v-model="extractRange"
            placeholder="1-3,5,7-9"
            @enter="confirmExtract"
          />
          <div class="flex justify-end gap-2 mt-4">
            <BaseButton variant="ghost" size="sm" @click="extractOpen = false">取消</BaseButton>
            <BaseButton variant="primary" size="sm" :disabled="processing" @click="confirmExtract">
              <LoaderCircle v-if="processing" :size="14" class="animate-spin" />
              <span v-else>提取并下载</span>
            </BaseButton>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
