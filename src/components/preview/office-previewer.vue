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
  kind: { type: String, required: true } // 'docx' | 'excel' | 'pptx'
})

const url = computed(() => getPreviewUrl(props.fileId))
</script>

<template>
  <div class="h-full w-full overflow-auto bg-[var(--color-surface-2)]">
    <VueOfficeDocx v-if="kind === 'docx'" :src="url" class="min-h-full" />
    <VueOfficeExcel v-else-if="kind === 'excel'" :src="url" class="min-h-full" />
    <VueOfficePptx v-else-if="kind === 'pptx'" :src="url" class="min-h-full" />
    <div
      v-else
      class="flex h-full items-center justify-center text-sm text-[var(--color-text-muted)]"
    >
      不支持的 Office 类型：{{ kind }}
    </div>
  </div>
</template>
