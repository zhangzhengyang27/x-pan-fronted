<script setup lang="ts">
/**
 * CodePreviewer —— Shiki 代码高亮 + 搜索 + 行号跳转
 * - 文本搜索（关键字高亮 + 跳转到下一处）
 * - 行号跳转（Ctrl+G / 输入行号）
 * - 200K 字符截断
 */
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import {
  getPreviewUrl,
  resolveShikiLanguage,
  getFileExtension,
  isShikiLangSupported,
  decodeTextContent
} from '@/utils/preview'
import { useTheme } from '@/composables/useTheme'
import { createHighlighterCore, type HighlighterCore, type LanguageInput } from '@shikijs/core'
import { createOnigurumaEngine } from '@shikijs/engine-oniguruma'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { Search, X, ChevronUp, ChevronDown, Hash } from '@lucide/vue'

// 按需导入常用语言 grammar（fine-grained bundle），避免把 shiki 全量语言打包进 vendor chunk。
// 仅覆盖前端 / Java / Python / Linux 运维常用语言；其余语言回退纯文本高亮。
import javascript from '@shikijs/langs/javascript'
import typescript from '@shikijs/langs/typescript'
import tsx from '@shikijs/langs/tsx'
import jsx from '@shikijs/langs/jsx'
import vue from '@shikijs/langs/vue'
import htmlLang from '@shikijs/langs/html'
import css from '@shikijs/langs/css'
import scss from '@shikijs/langs/scss'
import less from '@shikijs/langs/less'
import json from '@shikijs/langs/json'
import java from '@shikijs/langs/java'
import python from '@shikijs/langs/python'
import bash from '@shikijs/langs/bash'
import yaml from '@shikijs/langs/yaml'
import dockerfile from '@shikijs/langs/docker'
import toml from '@shikijs/langs/toml'
import ini from '@shikijs/langs/ini'
import githubLight from '@shikijs/themes/github-light'
import githubDark from '@shikijs/themes/github-dark'

const langRegistry: Record<string, LanguageInput> = {
  javascript,
  typescript,
  tsx,
  jsx,
  vue,
  html: htmlLang,
  css,
  scss,
  less,
  json,
  java,
  python,
  bash,
  yaml,
  dockerfile,
  toml,
  ini
}

const props = defineProps({
  fileId: { type: [String, Number], required: true },
  filename: { type: String, required: true },
  mode: { type: String, default: 'block' },
  /** 外部已解析好的预览 URL（优先于本地拼接） */
  url: { type: String, default: '' }
})

const resolvedUrl = () => props.url || getPreviewUrl(props.fileId)

const { isDark } = useTheme()
const html = ref('')
const rawText = ref('')
const loading = ref(true)
const error = ref('')
const truncated = ref(false)
const scrollContainerRef = ref<HTMLElement | null>(null)

const MAX_CHARS = 200_000

// 按语言缓存 highlighter 实例，避免切换语言时复用首个语言的实例导致高亮错误，
// 也避免重复 createHighlighter 造成的内存与 CPU 浪费。
const highlighterCache = new Map<string, Promise<HighlighterCore>>()
async function getHighlighter(lang: string): Promise<HighlighterCore> {
  if (highlighterCache.has(lang)) return highlighterCache.get(lang)!
  // 未覆盖的语言回退为纯文本（shiki 内置，无需 grammar）
  const langs = isShikiLangSupported(lang) ? [langRegistry[lang]] : []
  const p = createHighlighterCore({
    themes: [githubLight, githubDark],
    langs,
    engine: createOnigurumaEngine()
  })
  highlighterCache.set(lang, p)
  return p
}

const lang = computed(() => resolveShikiLanguage(getFileExtension(props.filename)))

let loadSeq = 0
let abortCtrl: AbortController | null = null

async function load() {
  const seq = ++loadSeq
  // 取消上一次未完成的请求，避免切文件/切主题时旧响应覆盖新内容
  abortCtrl?.abort()
  abortCtrl = new AbortController()
  loading.value = true
  error.value = ''
  truncated.value = false
  try {
    const res = await fetch(resolvedUrl(), { signal: abortCtrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    // 按编码解码（GBK/UTF-8 自适应），避免中文代码/文本乱码
    const buffer = await res.arrayBuffer()
    const declaredCharset = res.headers.get('content-type')?.match(/charset=([\w-]+)/i)?.[1]
    let text = decodeTextContent(buffer, declaredCharset)
    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS)
      truncated.value = true
    }
    const h = await getHighlighter(lang.value)
    // 仅在本次请求仍是最新时更新 UI，避免竞态
    if (seq !== loadSeq) return
    rawText.value = text
    // 未覆盖的语言回退纯文本高亮
    const renderLang = isShikiLangSupported(lang.value) ? lang.value : 'text'
    html.value = h.codeToHtml(text, {
      lang: renderLang,
      theme: isDark.value ? 'github-dark' : 'github-light'
    })
  } catch (e) {
    // 主动取消（abort）不视为错误，忽略即可
    if (e instanceof Error && e.name === 'AbortError') return
    if (seq !== loadSeq) return
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

onBeforeUnmount(() => {
  abortCtrl?.abort()
  abortCtrl = null
})

// ─── 搜索 ──────────────────────────────────────────────────────────────────
interface SearchMatch {
  line: number
  col: number
  snippet: string
}

const searchOpen = ref(false)
const searchKeyword = ref('')
const searchResults = ref<SearchMatch[]>([])
const searchIdx = ref(0)

function doSearch() {
  if (!searchKeyword.value.trim()) {
    searchResults.value = []
    return
  }
  const results: SearchMatch[] = []
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

function scrollToLine(line: number) {
  // shiki 渲染的 pre 中没原生行号；用 scrollTop 估算（每行约 21.45px = 1.65 line-height × 13px font）
  const container = scrollContainerRef.value
  if (!container) return
  const lineHeight = 21.45
  container.scrollTo({ top: (line - 1) * lineHeight - 100, behavior: 'smooth' })
}

onMounted(load)
// 同时监听 fileId / 主题 / 外部签名 URL：父组件异步拿到预览直链后需重新加载
watch(() => [props.fileId, isDark.value, props.url], load)
</script>

<template>
  <div class="relative h-full flex flex-col bg-(--color-surface-2)">
    <!-- 工具栏 -->
    <div
      class="flex items-center justify-center gap-2 py-2 bg-(--color-surface)/90 backdrop-blur border-b border-(--color-border)"
    >
      <BaseButton
        variant="ghost"
        size="sm"
        @click="searchOpen = !searchOpen"
        :class="searchOpen && 'bg-primary-50'"
      >
        <Search :size="14" />
        搜索
      </BaseButton>
      <span v-if="searchResults.length" class="text-xs text-(--color-text-muted) tabular-nums">
        {{ searchIdx + 1 }} / {{ searchResults.length }}
      </span>
      <span class="mx-2 h-4 w-px bg-(--color-border)" />
      <BaseButton
        variant="ghost"
        size="sm"
        @click="gotoOpen = !gotoOpen"
        :class="gotoOpen && 'bg-primary-50'"
      >
        <Hash :size="14" />
        行号跳转
      </BaseButton>
    </div>

    <!-- 搜索行 -->
    <div
      v-if="searchOpen"
      class="flex items-center gap-1 px-3 py-1 bg-(--color-surface) border-b border-(--color-border)"
    >
      <Search :size="14" class="text-(--color-text-muted)" />
      <BaseInput v-model="searchKeyword" size="sm" placeholder="搜索关键字" @enter="doSearch" />
      <button
        v-if="searchResults.length"
        type="button"
        class="size-6 rounded hover:bg-(--color-surface-2) flex items-center justify-center"
        @click="prevResult"
      >
        <ChevronUp :size="14" />
      </button>
      <button
        v-if="searchResults.length"
        type="button"
        class="size-6 rounded hover:bg-(--color-surface-2) flex items-center justify-center"
        @click="nextResult"
      >
        <ChevronDown :size="14" />
      </button>
      <button
        type="button"
        class="size-6 rounded hover:bg-(--color-surface-2) flex items-center justify-center"
        @click="closeSearch"
      >
        <X :size="14" />
      </button>
    </div>

    <!-- 行号跳转行 -->
    <div
      v-if="gotoOpen"
      class="flex items-center gap-1 px-3 py-1 bg-(--color-surface) border-b border-(--color-border)"
    >
      <Hash :size="14" class="text-(--color-text-muted)" />
      <BaseInput
        v-model.number="gotoLine"
        type="number"
        size="sm"
        placeholder="跳转到第 N 行"
        @enter="doGotoLine"
      />
      <button
        type="button"
        class="size-6 rounded hover:bg-(--color-surface-2) flex items-center justify-center"
        @click="gotoOpen = false"
      >
        <X :size="14" />
      </button>
    </div>

    <!-- 代码容器始终渲染，避免 load() 拿到文本时容器尚未挂载而被丢弃 -->
    <div ref="scrollContainerRef" class="flex-1 overflow-auto code-scroll-container">
      <div class="shiki-host text-sm" v-html="html" />
    </div>
    <div
      v-if="truncated"
      class="px-4 py-2 text-xs text-(--color-text-muted) border-t border-(--color-border) bg-(--color-surface)"
    >
      文件过大，仅展示前 {{ MAX_CHARS / 1000 }}K 字符。请下载完整文件查看。
    </div>
    <div
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center bg-(--color-surface-2)"
    >
      <div class="size-10 rounded-xl bg-(--color-surface) animate-pulse" />
    </div>
    <div
      v-else-if="error"
      class="absolute inset-0 flex items-center justify-center text-sm text-danger"
    >
      {{ error }}
    </div>
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
