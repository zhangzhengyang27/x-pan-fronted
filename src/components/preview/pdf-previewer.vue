<script setup>
/**
 * PdfPreviewer —— 基于 @vue-office/pdf（pdf.js 封装）
 * 1:1 复现 html5-examples PdfPreviewer
 */
import {ref} from 'vue'
import VueOfficePdf from '@vue-office/pdf'
import {getPreviewUrl} from '@/utils/preview'

const props = defineProps({
  fileId: {type: [String, Number], required: true},
})

const rendered = ref(false)
const url = ref(getPreviewUrl(props.fileId))
const handleRendered = () => {
  rendered.value = true
}
</script>

<template>
  <div class="h-full w-full overflow-auto bg-[var(--color-surface-2)]">
    <VueOfficePdf :src="url" style="height: 100%" @rendered="handleRendered"/>
  </div>
</template>