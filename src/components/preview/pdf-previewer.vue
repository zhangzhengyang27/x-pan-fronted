<script setup>
/**
 * PdfPreviewer —— 基于 @vue-office/pdf
 * 1:1 复现 html5-examples PdfPreviewer
 * P1.10 增强：缩放比例持久化（localStorage）
 */
import {computed, onMounted, ref, watch} from 'vue'
import VueOfficePdf from '@vue-office/pdf'
import {getPreviewUrl} from '@/utils/preview'
import BaseButton from '@/components/base/BaseButton.vue'
import {ZoomIn, ZoomOut, RotateCcw} from '@lucide/vue'

const props = defineProps({
  fileId: {type: [String, Number], required: true},
})

const rendered = ref(false)
const url = ref(getPreviewUrl(props.fileId))

const handleRendered = () => {
  rendered.value = true
}

// ─── P1.10：缩放比例持久化 ─────────────────────────────────────────────────
const ZOOM_KEY = 'x-pan:pdf-zoom'
const DEFAULT_ZOOM = 100
const zoom = ref(Number(localStorage.getItem(ZOOM_KEY) || DEFAULT_ZOOM))

watch(zoom, (v) => {
  try {
    localStorage.setItem(ZOOM_KEY, String(v))
  } catch {}
})

function zoomIn() {
  zoom.value = Math.min(zoom.value + 25, 200)
}
function zoomOut() {
  zoom.value = Math.max(zoom.value - 25, 50)
}
function resetZoom() {
  zoom.value = DEFAULT_ZOOM
}

// 缩放通过 CSS transform 作用到 pdf 渲染容器
const zoomStyle = computed(() => ({
  transform: `scale(${zoom.value / 100})`,
  transformOrigin: 'top center',
  transition: 'transform 0.15s ease',
}))
</script>

<template>
  <div class="relative h-full w-full overflow-auto bg-[var(--color-surface-2)]">
    <!-- 缩放控制条 -->
    <div class="sticky top-0 z-10 flex items-center justify-center gap-2 py-2 bg-[var(--color-surface)]/90 backdrop-blur border-b border-[var(--color-border)]">
      <BaseButton variant="ghost" size="sm" @click="zoomOut" :disabled="zoom <= 50">
        <ZoomOut :size="14"/>
      </BaseButton>
      <span class="text-xs font-mono tabular-nums min-w-[50px] text-center text-[var(--color-text)]">{{ zoom }}%</span>
      <BaseButton variant="ghost" size="sm" @click="zoomIn" :disabled="zoom >= 200">
        <ZoomIn :size="14"/>
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="resetZoom">
        <RotateCcw :size="14"/>
        重置
      </BaseButton>
    </div>
    <div :style="zoomStyle" class="origin-top">
      <VueOfficePdf :src="url" style="height: 100%; width: 100%" @rendered="handleRendered"/>
    </div>
  </div>
</template>