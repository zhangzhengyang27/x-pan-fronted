<script setup>
/**
 * PreviewIframe —— 通用 iframe 预览（PDF/文本等）
 */
import {computed, onMounted, ref} from 'vue'
import {useRoute} from 'vue-router'
import {FileText, ExternalLink} from '@lucide/vue'
import panUtil from '@/utils/common'
import BaseButton from '@/components/base/BaseButton.vue'

const route = useRoute()
const src = ref('')

onMounted(() => {
  src.value = panUtil.getPreviewUrl(route.params.fileId)
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[var(--color-bg)]">
    <header class="h-14 px-6 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div class="flex items-center gap-2">
        <FileText :size="20" class="text-[var(--color-primary-600)]"/>
        <h1 class="text-base font-medium">文档预览</h1>
      </div>
      <BaseButton variant="secondary" size="sm" @click="window.open(src, '_blank')">
        <span class="inline-flex items-center gap-1.5"><ExternalLink :size="14"/>新窗口打开</span>
      </BaseButton>
    </header>
    <div class="flex-1 p-4">
      <iframe :src="src" class="w-full h-full min-h-[calc(100vh-7rem)] rounded-xl border border-[var(--color-border)] bg-white"/>
    </div>
  </div>
</template>