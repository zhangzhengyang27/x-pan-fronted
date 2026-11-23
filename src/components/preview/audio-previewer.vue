<script setup lang="ts">
/**
 * AudioPreviewer —— 基于 APlayer（动态 import）
 * 1:1 复现 html5-examples AudioPreviewer
 *
 * 注意：预览弹窗可能在同一个组件实例内切换音频文件，APlayer 不像 img/audio
 * 那样会自动跟随 src 变化；这里必须监听 url/fileId/title，销毁旧实例后重建，
 * 否则切歌后仍播放上一首。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import 'aplayer/dist/APlayer.min.css'
import { getPreviewUrl } from '@/utils/preview'

const props = defineProps({
  fileId: { type: [String, Number], required: true },
  title: { type: String, default: '音频' },
  /** 外部已解析好的预览 URL（优先于本地拼接） */
  url: { type: String, default: '' }
})

const containerRef = ref<HTMLDivElement | null>(null)
let player: { destroy: () => void } | null = null
// 重建是异步的（动态 import + await 后可能已被下一次切换抢先），用序号丢弃旧实例
let loadSeq = 0
let destroyed = false

function destroyPlayer() {
  if (!player) return
  try {
    player.destroy()
  } catch {
    /* noop */
  }
  player = null
}

async function createPlayer() {
  if (!containerRef.value) return
  const seq = ++loadSeq
  destroyPlayer()
  const { default: APlayer } = await import('aplayer')
  // await 后组件可能已卸载，或用户又切了下一首
  if (destroyed || seq !== loadSeq || !containerRef.value) return
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
}

onMounted(createPlayer)
watch(() => [props.fileId, props.url, props.title], createPlayer)

onBeforeUnmount(() => {
  destroyed = true
  loadSeq++
  destroyPlayer()
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
