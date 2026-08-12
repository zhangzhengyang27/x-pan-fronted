<script setup lang="ts">
/**
 * PreviewIframe —— 通用预览（Markdown / PDF 独立路由）
 * 1:1 复用独立 Previewer 组件
 * 注：file-table 双击已经走 DrivePreviewModal 弹窗；
 * 此路由保留主要为了兼容外部链接直接打开。
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Download } from '@lucide/vue'
import { getDownloadUrl, resolvePreviewKind, resolvePreviewUrl } from '@/utils/preview'
import BaseButton from '@/components/base/BaseButton.vue'
import PdfPreviewer from '@/components/preview/pdf-previewer.vue'
import MarkdownPreviewer from '@/components/preview/markdown-previewer.vue'
import CodePreviewer from '@/components/preview/code-previewer.vue'

const route = useRoute()
const fileId = computed(() => route.params.fileId)
const filename = computed(() => route.query.filename || route.params.filename || 'preview')
const kind = computed(() => resolvePreviewKind({ name: filename.value, fileType: null }))
const downloadUrl = computed(() => getDownloadUrl(fileId.value))

// 统一走签名 URL（与 DrivePreviewModal 一致），避免长期 token 进 URL
const previewUrl = ref('')
watch(
  fileId,
  (id) => {
    previewUrl.value = ''
    if (id) resolvePreviewUrl(id).then((u) => (previewUrl.value = u)).catch(() => {})
  },
  { immediate: true }
)
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden bg-[var(--color-bg)]">
    <header
      class="h-14 px-6 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div class="flex items-center gap-2 min-w-0">
        <h1 class="text-base font-medium truncate">{{ filename }}</h1>
      </div>
      <a :href="downloadUrl" target="_blank">
        <BaseButton variant="ghost" size="sm">
          <span class="inline-flex items-center gap-1.5">
            <Download :size="14" />
            下载
          </span>
        </BaseButton>
      </a>
    </header>
    <main class="flex-1 min-h-0 overflow-hidden">
      <PdfPreviewer v-if="kind === 'pdf'" :url="previewUrl || undefined" :file-id="fileId" />
      <MarkdownPreviewer v-else-if="kind === 'markdown'" :url="previewUrl || undefined" :file-id="fileId" />
      <CodePreviewer
        v-else-if="kind === 'code' || kind === 'text'"
        :url="previewUrl || undefined"
        :file-id="fileId"
        :filename="filename"
      />
      <div
        v-else
        class="flex h-full items-center justify-center text-sm text-[var(--color-text-muted)]"
      >
        此文件类型暂不支持预览
      </div>
    </main>
  </div>
</template>
