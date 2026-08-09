<script setup>
/**
 * PreviewOffice —— Office 文档预览（依赖 office online viewer）
 */
import {computed, onMounted, ref} from 'vue'
import {useRoute} from 'vue-router'
import {FileSpreadsheet, ExternalLink} from '@lucide/vue'
import panUtil from '@/utils/common'
import BaseButton from '@/components/base/BaseButton.vue'

const route = useRoute()
const src = ref('')

onMounted(() => {
  const raw = panUtil.getPreviewUrl(route.params.fileId)
  // 简单代理：直接 iframe 显示 pdf/excel
  src.value = raw
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[var(--color-bg)]">
    <header class="h-14 px-6 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div class="flex items-center gap-2">
        <FileSpreadsheet :size="20" class="text-[var(--color-primary-600)]"/>
        <h1 class="text-base font-medium">Office 预览</h1>
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