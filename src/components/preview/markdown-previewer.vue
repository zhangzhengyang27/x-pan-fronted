<script setup>
/**
 * MarkdownPreviewer —— 基于 Vditor 'ir' 模式（替换之前 markdown-it）
 * - 支持 GFM、数学公式、Mermaid、代码高亮
 * - 主题跟随 dark/light
 * - 大文件截断展示
 */
import {onMounted, onBeforeUnmount, ref, watch, nextTick} from 'vue'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import {useTheme} from '@/composables/useTheme'
import {getPreviewUrl} from '@/utils/preview'

const props = defineProps({
  fileId: {type: [String, Number], required: true},
})

const {isDark} = useTheme()
const containerRef = ref(null)
const loading = ref(true)
const error = ref('')
let vditor = null

const MAX_CHARS = 200_000

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(getPreviewUrl(props.fileId))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    let text = await res.text()
    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS) + `\n\n> 文件过大，仅展示前 ${MAX_CHARS / 1000}K 字符。`
    }
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
        cache: {enable: false},
        height: '100%',
      })
    }
  } catch (e) {
    error.value = e?.message || 'Markdown 加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.fileId, load)
watch(() => isDark.value, () => {
  if (vditor) vditor.setTheme(isDark.value ? 'dark' : 'classic', isDark.value ? 'dark' : 'classic')
})

onBeforeUnmount(() => {
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
  <div class="h-full overflow-hidden bg-[var(--color-surface)]">
    <div v-if="loading" class="flex h-full items-center justify-center">
      <div class="size-10 rounded-xl bg-[var(--color-surface-2)] animate-pulse"/>
    </div>
    <div v-else-if="error" class="flex h-full items-center justify-center text-sm text-[var(--color-danger)]">
      {{ error }}
    </div>
    <div v-else ref="containerRef" class="h-full vditor-host"/>
  </div>
</template>

<style scoped>
.vditor-host :deep(.vditor-reset) {
  padding: 20px 24px;
}
</style>