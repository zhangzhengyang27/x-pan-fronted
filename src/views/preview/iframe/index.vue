<script setup>
/**
 * PreviewIframe —— 通用预览（Markdown / PDF）
 * 后端预览流 + 文件名后缀路由到对应渲染器
 */
import {computed} from 'vue'
import {useRoute} from 'vue-router'
import {Download} from '@lucide/vue'
import {getDownloadUrl, getPreviewUrl, getPreviewKind} from '@/utils/preview'
import BaseButton from '@/components/base/BaseButton.vue'
import PdfPreviewer from '@/components/preview/pdf-previewer.vue'
import MarkdownPreviewer from '@/components/preview/markdown-previewer.vue'

const route = useRoute()
const fileId = computed(() => route.params.fileId)
const filename = computed(() => route.query.filename || route.params.filename || 'preview')
const kind = computed(() => getPreviewKind(filename.value))
const downloadUrl = computed(() => getDownloadUrl(fileId.value))
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[var(--color-bg)]">
    <header class="h-14 px-6 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div class="flex items-center gap-2 min-w-0">
        <h1 class="text-base font-medium truncate">{{ filename }}</h1>
      </div>
      <a :href="downloadUrl" target="_blank">
        <BaseButton variant="ghost" size="sm">
          <span class="inline-flex items-center gap-1.5">
            <Download :size="14"/>
            下载
          </span>
        </BaseButton>
      </a>
    </header>
    <main class="flex-1 min-h-0">
      <PdfPreviewer v-if="kind === 'pdf'" :file-id="fileId"/>
      <MarkdownPreviewer v-else-if="kind === 'markdown'" :file-id="fileId"/>
      <div v-else class="flex h-full items-center justify-center text-sm text-[var(--color-text-muted)]">
        此文件类型暂不支持预览
      </div>
    </main>
  </div>
</template>