<script setup lang="ts">
/**
 * MarkdownPreviewer —— 基于 Vditor 'ir' 模式（替换之前 markdown-it）
 * - 支持 GFM、数学公式、Mermaid、代码高亮
 * - 主题跟随 dark/light
 * - 大文件截断展示
 * - 左侧目录（TOC）：从源文本解析标题，点击滚动定位，阅读位置高亮
 */
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { useTheme } from '@/composables/useTheme'
import { getPreviewUrl } from '@/utils/preview'

const props = defineProps({
  fileId: { type: [String, Number], required: true },
  /** 外部已解析好的预览 URL（优先于本地拼接） */
  url: { type: String, default: '' }
})

const resolvedUrl = () => props.url || getPreviewUrl(props.fileId)

const { isDark } = useTheme()
const containerRef = ref(null)
const loading = ref(true)
const error = ref('')
let vditor = null

// 目录数据：{ level, text, index }，index 用于映射到渲染后的第 N 个标题节点
const headings = ref<{ level: number; text: string; index: number }[]>([])
const activeIndex = ref(-1)

const MAX_CHARS = 200_000

let loadSeq = 0
let abortCtrl: AbortController | null = null
let observer: IntersectionObserver | null = null
let ro: ResizeObserver | null = null

/** 将 Vditor 高度钉死为内容区可视高度，使长文档在 Vditor 内部滚动，
 *  避免 Vditor 按内容撑高父容器导致整页滚动、左侧目录跟随滚动。
 *  注意：当前 Vditor 版本无 setHeight 方法，直接设置 .vditor 容器像素高度。 */
function syncHeight() {
  if (!vditor || !containerRef.value) return
  const h = containerRef.value.clientHeight
  if (h <= 0) return
  const vd = containerRef.value.querySelector<HTMLElement>('.vditor')
  if (vd) vd.style.height = h + 'px'
}

/** 从 markdown 源文本解析标题（支持 ATX 风格 #~######，以及 setext 风格下划线标题） */
function parseHeadings(src: string): { level: number; text: string; index: number }[] {
  const lines = src.split(/\r?\n/)
  const result: { level: number; text: string; index: number }[] = []
  let i = 0
  let order = 0
  while (i < lines.length) {
    const line = lines[i]
    const m = /^(#{1,6})\s+(.*)$/.exec(line)
    if (m) {
      result.push({ level: m[1].length, text: m[2].trim(), index: order++ })
      i++
      continue
    }
    // setext 二级/一级标题：下一行是 === 或 ---
    const next = lines[i + 1]
    if (next && /^\s*([=-])+\s*$/.test(next) && line.trim()) {
      const level = /^\s*=+\s*$/.test(next) ? 1 : 2
      result.push({ level, text: line.trim(), index: order++ })
      i += 2
      continue
    }
    i++
  }
  return result
}

/** 返回渲染后第 index 个标题 DOM 节点（Vditor IR 模式下为 .vditor-ir__node[data-marker="#"]） */
function getHeadingEl(index: number): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(
    '.vditor-ir__node[data-marker="#"], .vditor-reset > h1, .vditor-reset > h2, .vditor-reset > h3, .vditor-reset > h4, .vditor-reset > h5, .vditor-reset > h6'
  )
  return nodes[index] || null
}

function setupObserver() {
  observer?.disconnect()
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.vditor-ir__node[data-marker="#"], .vditor-reset > h1, .vditor-reset > h2, .vditor-reset > h3, .vditor-reset > h4, .vditor-reset > h5, .vditor-reset > h6'
    )
  )
  if (!nodes.length) return
  observer = new IntersectionObserver(
    (entries) => {
      // 选取当前视口内最靠上的可见标题
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible.length) {
        const idx = nodes.indexOf(visible[0].target as HTMLElement)
        if (idx >= 0) activeIndex.value = idx
      }
    },
    // 以 Vditor 内部实际滚动节点（.vditor-ir > pre.vditor-reset）为 root
    {
      root: document.querySelector('.vditor-ir > .vditor-reset') || document.querySelector('.vditor-ir'),
      rootMargin: '0px 0px -70% 0px',
      threshold: 0
    }
  )
  nodes.forEach((n) => observer!.observe(n))
}

function scrollToHeading(index: number) {
  const el = getHeadingEl(index)
  if (!el) return
  const scroller = document.querySelector<HTMLElement>('.vditor-ir > .vditor-reset')
  if (scroller) {
    // 滚动节点是 Vditor 内部的 <pre>，直接按标题偏移量定位
    scroller.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  activeIndex.value = index
}

async function load() {
  const seq = ++loadSeq
  // 取消上一次未完成的请求，避免切文件时旧响应覆盖新内容
  abortCtrl?.abort()
  abortCtrl = new AbortController()
  loading.value = true
  error.value = ''
  headings.value = []
  activeIndex.value = -1
  try {
    const res = await fetch(resolvedUrl(), { signal: abortCtrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    let text = await res.text()
    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS) + `\n\n> 文件过大，仅展示前 ${MAX_CHARS / 1000}K 字符。`
    }
    if (seq !== loadSeq) return
    await nextTick()
    if (!containerRef.value) return
    if (vditor) {
      vditor.setValue(text)
    } else {
      vditor = new Vditor(containerRef.value, {
        value: text,
        mode: 'ir',
        readonly: true,
        toolbar: [],
        theme: isDark.value ? 'dark' : 'classic',
        cache: { enable: false },
        // 高度由 syncHeight 钉死为容器可视高度，避免撑高整页
        after: () => {
          if (seq !== loadSeq) return
          syncHeight()
          // 监听容器尺寸变化（窗口缩放、布局变动）同步 Vditor 高度
          ro?.disconnect()
          ro = new ResizeObserver(() => syncHeight())
          if (containerRef.value) ro.observe(containerRef.value)
          setupObserver()
        }
      })
    }
    if (seq !== loadSeq) return
    headings.value = parseHeadings(text)
    await nextTick()
    setupObserver()
  } catch (e) {
    if (e?.name === 'AbortError') return
    if (seq !== loadSeq) return
    error.value = e?.message || 'Markdown 加载失败'
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

onMounted(load)
// 同时监听 fileId 与外部签名 URL：父组件异步拿到预览直链后需重新加载
watch(() => props.fileId, load)
watch(() => props.url, load)
watch(
  () => isDark.value,
  () => {
    if (vditor)
      vditor.setTheme(isDark.value ? 'dark' : 'classic', isDark.value ? 'dark' : 'classic')
  }
)

onBeforeUnmount(() => {
  abortCtrl?.abort()
  abortCtrl = null
  observer?.disconnect()
  observer = null
  ro?.disconnect()
  ro = null
  if (vditor) {
    try {
      vditor.destroy()
    } catch {
      /* noop */
    }
    vditor = null
  }
})
</script>

<template>
  <div class="relative flex h-full overflow-hidden bg-[var(--color-surface)]">
    <!-- 左侧目录 -->
    <aside
      v-if="headings.length"
      class="hidden w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex"
    >
      <div
        class="px-4 py-3 text-xs font-semibold tracking-wide text-[var(--color-text-muted)]"
      >
        目录
      </div>
      <nav class="flex-1 overflow-y-auto px-2 pb-4">
        <button
          v-for="h in headings"
          :key="h.index"
          type="button"
          class="block w-full truncate rounded-md px-2 py-1.5 text-left text-[13px] leading-relaxed transition-colors"
          :class="[
            h.index === activeIndex
              ? 'bg-[var(--color-accent-soft)] font-semibold text-[var(--color-primary)]'
              : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
            h.level === 1 ? 'pl-2' : h.level === 2 ? 'pl-4' : h.level === 3 ? 'pl-6' : h.level === 4 ? 'pl-8' : 'pl-10'
          ]"
          :title="h.text"
          @click="scrollToHeading(h.index)"
        >
          {{ h.text }}
        </button>
      </nav>
    </aside>

    <!-- 内容容器（始终挂载，避免 load 拿到文本时容器不存在而丢弃内容）。
         overflow-hidden：Vditor 高度已被钉死为可视高度，长文档在 Vditor 内部滚动，
         左侧目录因此保持固定、不跟随内容滚动 -->
    <div ref="containerRef" class="h-full min-w-0 flex-1 overflow-hidden vditor-host" />

    <div
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center bg-[var(--color-surface)]"
    >
      <div class="size-10 rounded-xl bg-[var(--color-surface-2)] animate-pulse" />
    </div>
    <div
      v-else-if="error"
      class="absolute inset-0 flex items-center justify-center text-sm text-[var(--color-danger)]"
    >
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
/* Vditor IR 模式会在 <pre class="vditor-reset"> 上加内联 style="padding: 10px 233.5px"，
   导致正文被大幅挤压；用 !important 覆盖为合适的内边距 */
.vditor-host :deep(.vditor-ir pre.vditor-reset) {
  padding: 24px 80px !important;
}

/* 分割线改细：覆盖 Vditor 默认较粗的 hr */
.vditor-host :deep(.vditor-reset hr) {
  height: 0;
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 18px 0;
}
</style>
