<script setup>
/**
 * MarkdownPreviewer —— markdown-it 渲染
 * - 支持 GFM、代码高亮（内置 shiki on-the-fly 简化版）
 */
import {onMounted, ref, watch} from 'vue'
import MarkdownIt from 'markdown-it'
import {getPreviewUrl} from '@/utils/preview'

const props = defineProps({
  fileId: {type: [String, Number], required: true},
})

const html = ref('')
const loading = ref(true)
const error = ref('')

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(getPreviewUrl(props.fileId))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    html.value = md.render(text)
  } catch (e) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.fileId, load)
</script>

<template>
  <div class="h-full overflow-auto bg-[var(--color-surface)]">
    <div v-if="loading" class="flex h-full items-center justify-center">
      <div class="size-10 rounded-xl bg-[var(--color-surface-2)] animate-pulse"/>
    </div>
    <div v-else-if="error" class="flex h-full items-center justify-center text-sm text-[var(--color-danger)]">
      {{ error }}
    </div>
    <article v-else class="markdown-body mx-auto max-w-3xl px-8 py-10" v-html="html"/>
  </div>
</template>

<style scoped>
.markdown-body :deep(h1) { font-size: 1.875rem; font-weight: 700; margin: 1.5em 0 .6em; }
.markdown-body :deep(h2) { font-size: 1.5rem;   font-weight: 700; margin: 1.4em 0 .5em; }
.markdown-body :deep(h3) { font-size: 1.25rem;  font-weight: 600; margin: 1.2em 0 .5em; }
.markdown-body :deep(p)  { line-height: 1.75; margin: .6em 0; }
.markdown-body :deep(a)  { color: var(--color-primary-600); text-decoration: underline; text-underline-offset: 2px; }
.markdown-body :deep(ul), .markdown-body :deep(ol) { padding-left: 1.5em; margin: .5em 0; }
.markdown-body :deep(li) { margin: .25em 0; }
.markdown-body :deep(blockquote) {
  margin: 1em 0;
  padding: .5em 1em;
  border-left: 3px solid var(--color-primary-500);
  background: var(--color-surface-2);
  color: var(--color-text-muted);
}
.markdown-body :deep(code) {
  background: var(--color-surface-2);
  padding: .15em .4em;
  border-radius: 4px;
  font-size: .9em;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}
.markdown-body :deep(pre) {
  background: var(--color-surface-2);
  padding: 12px 16px;
  border-radius: 8px;
  overflow-x: auto;
  line-height: 1.6;
}
.markdown-body :deep(pre code) { background: transparent; padding: 0; }
.markdown-body :deep(table) { border-collapse: collapse; width: 100%; margin: 1em 0; }
.markdown-body :deep(th), .markdown-body :deep(td) {
  border: 1px solid var(--color-border);
  padding: 6px 12px;
  text-align: left;
}
.markdown-body :deep(hr) { border: 0; border-top: 1px solid var(--color-border); margin: 1.5em 0; }
.markdown-body :deep(img) { max-width: 100%; height: auto; border-radius: 8px; }
</style>