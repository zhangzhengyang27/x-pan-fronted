<script setup lang="ts">
/**
 * VideoPreviewer —— ArtPlayer 视频预览（动态 import）
 * P1-8：倍速 0.5-5x + 快捷键 >/< 调速、Space 播放/暂停、←/→ 快退快进
 * P1-9：画中画（Picture-in-Picture）
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { getPreviewUrl } from '@/utils/preview'
import { useVideoThumbnails } from '@/composables/useVideoThumbnails'

const props = defineProps({
  fileId: { type: [String, Number], required: true },
  title: { type: String, default: '' },
  /** 外部已解析好的预览 URL（优先于本地拼接） */
  url: { type: String, default: '' }
})

const containerRef = ref(null)
let player = null

// P3-1：视频关键帧缩略图
const { generate: generateThumbnails } = useVideoThumbnails()

// 倍速档位（对标夸克 0.5-5x）
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5]

onMounted(async () => {
  if (!containerRef.value) return
  const { default: Artplayer } = await import('artplayer')
  const videoUrl = props.url || getPreviewUrl(props.fileId)
  player = new Artplayer({
    container: containerRef.value,
    url: videoUrl,
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
    theme: '#00b2ff',
    // P1-8：自定义倍速档位
    playbackRateList: PLAYBACK_RATES,
    // P1-9：画中画
    pip: true,
    // 快捷键开启（ArtPlayer 内置 hotkey）
    hotkey: true,
    // 设置面板可折叠
    setting: true,
    // P3-1：进度条关键帧缩略图（后台异步采样，生成后动态注入）
    thumbnails: {
      urls: [],
      width: 160,
      height: 90,
      column: 1
    }
  })

  // P1-8：自定义全局快捷键（ArtPlayer hotkey 仅在焦点时生效，补充全局）
  window.addEventListener('keydown', onKeydown)

  // P3-1：后台异步采样关键帧，生成后动态注入 ArtPlayer
  generateThumbnails(videoUrl, { count: 20, width: 160 })
    .then((urls) => {
      if (urls.length > 0 && player) {
        player.thumbnails = { urls, width: 160, height: 90, column: 1 }
      }
    })
    .catch(() => {
      // 采样失败（CORS/格式问题）→ 降级为无缩略图，不影响播放
    })
})

// P1-8：全局快捷键
function onKeydown(e: KeyboardEvent) {
  if (!player) return
  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return

  switch (e.key) {
    case '>':
    case '.':
      e.preventDefault()
      speedUp()
      break
    case '<':
    case ',':
      e.preventDefault()
      speedDown()
      break
    case 'ArrowRight':
      e.preventDefault()
      player.forward = 5
      player.seek(player.currentTime + 5)
      break
    case 'ArrowLeft':
      e.preventDefault()
      player.seek(player.currentTime - 5)
      break
  }
}

function speedUp() {
  if (!player) return
  const cur = player.playbackRate
  const idx = PLAYBACK_RATES.findIndex((r) => Math.abs(r - cur) < 0.01)
  const next = PLAYBACK_RATES[Math.min(idx + 1, PLAYBACK_RATES.length - 1)] || cur
  player.playbackRate = next
  showSpeedToast(next)
}

function speedDown() {
  if (!player) return
  const cur = player.playbackRate
  const idx = PLAYBACK_RATES.findIndex((r) => Math.abs(r - cur) < 0.01)
  const prev = PLAYBACK_RATES[Math.max(idx - 1, 0)] || cur
  player.playbackRate = prev
  showSpeedToast(prev)
}

// 倍速提示（轻量浮层，非 Toast）
let speedToastEl: HTMLElement | null = null
function showSpeedToast(rate: number) {
  if (speedToastEl) speedToastEl.remove()
  speedToastEl = document.createElement('div')
  speedToastEl.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);padding:12px 24px;background:rgba(0,0,0,0.8);color:#fff;font-size:20px;font-weight:700;border-radius:12px;z-index:9999;pointer-events:none;transition:opacity 0.3s;'
  speedToastEl.textContent = `${rate}×`
  document.body.appendChild(speedToastEl)
  setTimeout(() => {
    if (speedToastEl) {
      speedToastEl.style.opacity = '0'
      setTimeout(() => speedToastEl?.remove(), 300)
    }
  }, 600)
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (speedToastEl) {
    speedToastEl.remove()
    speedToastEl = null
  }
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
