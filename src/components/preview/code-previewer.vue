<script setup>
/**
 * CodePreviewer —— Shiki 代码高亮 + 搜索 + 行号跳转
 * 1:1 复现 html5-examples CodePreviewer
 * P1.11 增强：
 * - 文本搜索（关键字高亮 + 跳转到下一处）
 * - 行号跳转（Ctrl+G / 输入行号）
 * - 200K 字符截断
 */
import { onMounted, ref, watch, computed, nextTick } from 'vue'
import { getPreviewUrl, resolveShikiLanguage, getFileExtension } from '@/utils/preview'
import { useTheme } from '@/composables/useTheme'
import { createHighlighter } from 'shiki'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { Search, X, ChevronUp, ChevronDown, Hash } from '@lucide/vue'

const props = defineProps({
  fileId: { type: [String, Number], required: true },
  filename: { type: String, required: true },
  mode: { type: String, default: 'block' }
})

const { isDark } = useTheme()
const html = ref('')
const rawText = ref('')
const loading = ref(true)
const error = ref('')
const truncated = ref(false)

const MAX_CHARS = 200_000

let highlighterPromise = null
async function getHighlighter(lang) {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: [lang]
    })
  }
  return highlighterPromise
}

const lang = computed(() => resolveShikiLanguage(getFileExtension(props.filename)))

async function load() {
  loading.value = true
  error.value = ''
  truncated.value = false
  try {
    const res = await fetch(getPreviewUrl(props.fileId))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    let text = await res.text()
    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS)
      truncated.value = true
    }
    rawText.value = text
    const h = await getHighlighter(lang.value)
    html.value = h.codeToHtml(text, {
      lang: lang.value,
      theme: isDark.value ? 'github-dark' : 'github-light'
    })
  } catch (e) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

// ─── 搜索 ──────────────────────────────────────────────────────────────────
const searchOpen = ref(false)
const searchKeyword = ref('')
const searchResults = ref([])
const searchIdx = ref(0)

function doSearch() {
  if (!searchKeyword.value.trim()) {
    searchResults.value = []
    return
  }
  const results = []
  const lines = rawText.value.split('\n')
  const kw = searchKeyword.value
  lines.forEach((line, i) => {
    let idx = line.indexOf(kw)
    while (idx !== -1) {
      results.push({ line: i + 1, col: idx, snippet: line.trim().slice(0, 100) })
      idx = line.indexOf(kw, idx + kw.length)
    }
  })
  searchResults.value = results
  searchIdx.value = 0
  if (results.length > 0) scrollToLine(results[0].line)
  else if (kw) alert('未找到匹配')
}

function nextResult() {
  if (!searchResults.value.length) return
  searchIdx.value = (searchIdx.value + 1) % searchResults.value.length
  scrollToLine(searchResults.value[searchIdx.value].line)
}
function prevResult() {
  if (!searchResults.value.length) return
  searchIdx.value = (searchIdx.value - 1 + searchResults.value.length) % searchResults.value.length
  scrollToLine(searchResults.value[searchIdx.value].line)
}
function closeSearch() {
  searchOpen.value = false
  searchKeyword.value = ''
  searchResults.value = []
}

// ─── 行号跳转 ──────────────────────────────────────────────────────────────
const gotoOpen = ref(false)
const gotoLine = ref('')
function doGotoLine() {
  const n = parseInt(gotoLine.value, 10)
  if (!n || n < 1) return
  scrollToLine(n)
  gotoOpen.value = false
  gotoLine.value = ''
}

function scrollToLine(line) {
  // shiki 渲染的 pre 中没原生行号；用 scrollTop 估算（每行约 21.45px = 1.65 line-height × 13px font）
  const container = document.querySelector('.code-scroll-container')
  if (!container) return
  const lineHeight = 21.45
  container.scrollTo({ top: (line - 1) * lineHeight - 100, behavior: 'smooth' })
}

onMounted(load)
watch(() => [props.fileId, isDark.value], load)
</script>

<template>
  <div class="h-full flex flex-col bg-[var(--color-surface-2)]">
    <!-- 工具栏 -->
    <div
      class="flex items-center justify-center gap-2 py-2 bg-[var(--color-surface)]/90 backdrop-blur border-b border-[var(--color-border)]"
    >
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
      <span class="mx-2 h-4 w-px bg-[var(--color-border)]" />
      <BaseButton
        variant="ghost"
        size="sm"
        @click="gotoOpen = !gotoOpen"
        :class="gotoOpen && 'bg-[var(--color-primary-50)]'"
      >
        <Hash :size="14" />
        行号跳转
      </BaseButton>
    </div>

    <!-- 搜索行 -->
    <div
      v-if="searchOpen"
      class="flex items-center gap-1 px-3 py-1 bg-[var(--color-surface)] border-b border-[var(--color-border)]"
    >
      <Search :size="14" class="text-[var(--color-text-muted)]" />
      <BaseInput v-model="searchKeyword" size="sm" placeholder="搜索关键字" @enter="doSearch" />
      <button
        v-if="searchResults.length"
        type="button"
        class="size-6 rounded hover:bg-[var(--color-surface-2)] flex items-center justify-center"
        @click="prevResult"
      >
        <ChevronUp :size="14" />
      </button>
      <button
        v-if="searchResults.length"
        type="button"
        class="size-6 rounded hover:bg-[var(--color-surface-2)] flex items-center justify-center"
        @click="nextResult"
      >
        <ChevronDown :size="14" />
      </button>
      <button
        type="button"
        class="size-6 rounded hover:bg-[var(--color-surface-2)] flex items-center justify-center"
        @click="closeSearch"
      >
        <X :size="14" />
      </button>
    </div>

    <!-- 行号跳转行 -->
    <div
      v-if="gotoOpen"
      class="flex items-center gap-1 px-3 py-1 bg-[var(--color-surface)] border-b border-[var(--color-border)]"
    >
      <Hash :size="14" class="text-[var(--color-text-muted)]" />
      <BaseInput
        v-model.number="gotoLine"
        type="number"
        size="sm"
        placeholder="跳转到第 N 行"
        @enter="doGotoLine"
      />
      <button
        type="button"
        class="size-6 rounded hover:bg-[var(--color-surface-2)] flex items-center justify-center"
        @click="gotoOpen = false"
      >
        <X :size="14" />
      </button>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="size-10 rounded-xl bg-[var(--color-surface)] animate-pulse" />
    </div>
    <div
      v-else-if="error"
      class="flex-1 flex items-center justify-center text-sm text-[var(--color-danger)]"
    >
      {{ error }}
    </div>
    <template v-else>
      <div class="flex-1 overflow-auto code-scroll-container">
        <div class="shiki-host text-sm" v-html="html" />
      </div>
      <div
        v-if="truncated"
        class="px-4 py-2 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)] bg-[var(--color-surface)]"
      >
        文件过大，仅展示前 {{ MAX_CHARS / 1000 }}K 字符。请下载完整文件查看。
      </div>
    </template>
  </div>
</template>

<style scoped>
.shiki-host :deep(pre) {
  margin: 0;
  padding: 16px;
  font-size: 13px;
  line-height: 1.65;
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
}
.shiki-host :deep(code) {
  font-family: inherit;
  background: transparent !important;
}
</style>
