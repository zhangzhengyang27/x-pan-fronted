<script setup>
/**
 * CodePreviewer —— Shiki 代码高亮（markdown / 纯文本 复用）
 * 1:1 复现 html5-examples CodePreviewer
 * - 主题跟随 dark/light
 * - 200K 字符截断（超大文件）
 * - 按文件扩展名推断 Shiki 语言
 */
import {onMounted, ref, watch, computed} from 'vue'
import {getPreviewUrl, resolveShikiLanguage, getFileExtension} from '@/utils/preview'
import {useTheme} from '@/composables/useTheme'
import {createHighlighter} from 'shiki'

const props = defineProps({
  fileId: {type: [String, Number], required: true},
  filename: {type: String, required: true},
  /** 'ir' 模式（行内渲染） */
  mode: {type: String, default: 'block'},
})

const {isDark} = useTheme()
const html = ref('')
const loading = ref(true)
const error = ref('')
const truncated = ref(false)

const MAX_CHARS = 200_000

let highlighterPromise = null
async function getHighlighter(lang) {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: [lang],
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
    const h = await getHighlighter(lang.value)
    html.value = h.codeToHtml(text, {
      lang: lang.value,
      theme: isDark.value ? 'github-dark' : 'github-light',
    })
  } catch (e) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => [props.fileId, isDark.value], load)
</script>

<template>
  <div class="h-full flex flex-col bg-[var(--color-surface-2)]">
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="size-10 rounded-xl bg-[var(--color-surface)] animate-pulse"/>
    </div>
    <div v-else-if="error" class="flex-1 flex items-center justify-center text-sm text-[var(--color-danger)]">
      {{ error }}
    </div>
    <template v-else>
      <div class="flex-1 overflow-auto">
        <div class="shiki-host text-sm" v-html="html"/>
      </div>
      <div v-if="truncated" class="px-4 py-2 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)] bg-[var(--color-surface)]">
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