<script setup lang="ts">
/**
 * PreviewOffice —— Office 文档预览（独立路由页）
 * 1:1 复用 OfficePreviewer（@vue-office 系列）
 * 注：file-table 双击已经走 DrivePreviewModal 弹窗；
 * 此路由保留主要为了兼容外部链接直接打开。
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Download } from '@lucide/vue'
import {
  getDownloadUrl,
  getFileExtension,
  resolvePreviewUrl,
  DOCX_EXTENSIONS,
  EXCEL_EXTENSIONS,
  PPTX_EXTENSIONS
} from '@/utils/preview'
import BaseButton from '@/components/base/BaseButton.vue'
import OfficePreviewer from '@/components/preview/office-previewer.vue'

const route = useRoute()
const fileId = computed(() => route.params.fileId)
const filename = computed(() => route.query.filename || 'office')
const ext = computed(() => getFileExtension(filename.value))

const kind = computed(() => {
  const e = ext.value
  if (DOCX_EXTENSIONS.includes(e)) return 'docx'
  if (EXCEL_EXTENSIONS.includes(e)) return 'excel'
  if (PPTX_EXTENSIONS.includes(e)) return 'pptx'
  return null
})

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
  <div class="min-h-screen flex flex-col bg-[var(--color-bg)]">
    <header
      class="h-14 px-6 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div class="flex items-center gap-2 min-w-0">
        <h1 class="text-base font-medium truncate">{{ filename }}</h1>
        <span class="text-xs text-[var(--color-text-muted)] uppercase">.{{ ext }}</span>
      </div>
      <a :href="downloadUrl" target="_blank">
        <BaseButton variant="secondary" size="sm">
          <span class="inline-flex items-center gap-1.5">
            <Download :size="14" />
            下载
          </span>
        </BaseButton>
      </a>
    </header>
    <main class="flex-1 min-h-0">
      <OfficePreviewer v-if="kind" :url="previewUrl || undefined" :file-id="fileId" :kind="kind" />
      <div
        v-else
        class="flex h-full items-center justify-center text-sm text-[var(--color-text-muted)]"
      >
        无文件扩展名或不支持的 Office 类型
      </div>
    </main>
  </div>
</template>
