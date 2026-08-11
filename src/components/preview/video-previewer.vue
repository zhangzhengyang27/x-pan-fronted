<script setup lang="ts">
/**
 * VideoPreviewer —— ArtPlayer 视频预览（动态 import）
 * 1:1 复现 html5-examples VideoPreviewer
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { getPreviewUrl } from '@/utils/preview'

const props = defineProps({
  fileId: { type: [String, Number], required: true },
  title: { type: String, default: '' }
})

const containerRef = ref(null)
let player = null

onMounted(async () => {
  if (!containerRef.value) return
  const { default: Artplayer } = await import('artplayer')
  player = new Artplayer({
    container: containerRef.value,
    url: getPreviewUrl(props.fileId),
    title: props.title,
    autoplay: true,
    autoSize: false,
    autoMini: true,
    screenshot: true,
    setting: true,
    loop: false,
    flip: true,
    playbackRate: true,
    aspectRatio: true,
    fullscreen: true,
    fullscreenWeb: true,
    miniProgressBar: true,
    mutex: true,
    backdrop: true,
    theme: '#6366f1'
  })
})

onBeforeUnmount(() => {
  if (player) {
    try {
      player.destroy(true)
    } catch {
      /* noop */
    }
    player = null
  }
})
</script>

<template>
  <div ref="containerRef" class="drive-video-container h-full w-full min-h-[360px]" />
</template>
