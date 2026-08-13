<script setup lang="ts">
/**
 * OfficePreviewer —— 基于 @vue-office 系列（docx/excel/pptx）
 * 1:1 复现 html5-examples OfficePreviewer
 */
import { computed } from 'vue'
import VueOfficeDocx from '@vue-office/docx'
import '@vue-office/docx/lib/index.css'
import VueOfficeExcel from '@vue-office/excel'
import '@vue-office/excel/lib/index.css'
import VueOfficePptx from '@vue-office/pptx'
import { getPreviewUrl } from '@/utils/preview'

const props = defineProps({
  fileId: { type: [String, Number], required: true },
  kind: { type: String, required: true }, // 'docx' | 'excel' | 'pptx'
  /** 外部已解析好的预览 URL（优先于本地拼接） */
  url: { type: String, default: '' }
})

const resolvedUrl = computed(() => props.url || getPreviewUrl(props.fileId))
</script>

<template>
  <div class="h-full w-full overflow-auto bg-(--color-surface-2)">
    <VueOfficeDocx v-if="kind === 'docx'" :src="resolvedUrl" class="min-h-full" />
    <VueOfficeExcel v-else-if="kind === 'excel'" :src="resolvedUrl" class="min-h-full" />
    <VueOfficePptx v-else-if="kind === 'pptx'" :src="resolvedUrl" class="min-h-full" />
    <div
      v-else
      class="flex h-full items-center justify-center text-sm text-(--color-text-muted)"
    >
      不支持的 Office 类型：{{ kind }}
    </div>
  </div>
</template>
