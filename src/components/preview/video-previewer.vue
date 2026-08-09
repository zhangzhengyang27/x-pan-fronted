<script setup>
/**
 * VideoPreviewer —— ArtPlayer 视频预览（懒加载）
 */
import {onBeforeUnmount, onMounted, ref} from 'vue'
import {getPreviewUrl} from '@/utils/preview'

const props = defineProps({
  fileId: {type: [String, Number], required: true},
  filename: {type: String, default: ''},
})

const containerRef = ref(null)
let player = null

onMounted(async () => {
  if (!containerRef.value) return
  const Artplayer = (await import('artplayer')).default
  player = new Artplayer({
    container: containerRef.value,
    url: getPreviewUrl(props.fileId),
    title: props.filename,
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
    theme: '#6366f1',
  })
})

onBeforeUnmount(() => {
  if (player) {
    player.destroy(true)
    player = null
  }
})
</script>

<template>
  <div class="h-full w-full bg-black flex items-center justify-center">
    <div ref="containerRef" class="w-full h-full"/>
  </div>
</template>