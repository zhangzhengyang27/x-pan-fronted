<script setup lang="ts">
/**
 * AudioPreviewer —— 基于 APlayer（动态 import）
 * 1:1 复现 html5-examples AudioPreviewer
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import 'aplayer/dist/APlayer.min.css'
import { getPreviewUrl } from '@/utils/preview'

const props = defineProps({
  fileId: { type: [String, Number], required: true },
  title: { type: String, default: '音频' },
  /** 外部已解析好的预览 URL（优先于本地拼接） */
  url: { type: String, default: '' }
})

const containerRef = ref(null)
let player = null

onMounted(async () => {
  if (!containerRef.value) return
  const { default: APlayer } = await import('aplayer')
  player = new APlayer({
    container: containerRef.value,
    audio: [
      {
        name: props.title,
        artist: 'X Pan',
        url: props.url || getPreviewUrl(props.fileId)
      }
    ],
    autoplay: true,
    lrcType: 0,
    theme: '#00b2ff'
  })
})

onBeforeUnmount(() => {
  if (player) {
    try {
      player.destroy()
    } catch {
      /* noop */
    }
    player = null
  }
})
</script>

<template>
  <div class="flex h-full w-full items-center justify-center px-6 py-10">
    <div ref="containerRef" class="w-full max-w-[480px]" />
  </div>
</template>

<style scoped>
:deep(.aplayer) {
  border-radius: 12px;
  overflow: hidden;
}
</style>
