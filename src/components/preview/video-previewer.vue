<script setup lang="ts">
/**
 * VideoPreviewer —— ArtPlayer 视频预览（动态 import）
 * P1-8：倍速 0.5-5x + 快捷键 >/< 调速、Space 播放/暂停、←/→ 快退快进
 * P1-9：画中画（Picture-in-Picture）
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useVideoThumbnails } from '@/composables/useVideoThumbnails'
import { ElMessage } from '@/composables/useToast'

const props = defineProps({
  fileId: { type: [String, Number], required: true },
  title: { type: String, default: '' },
  /** 外部已解析好的预览 URL（优先于本地拼接） */
  url: { type: String, default: '' }
})

const containerRef = ref<HTMLDivElement | null>(null)
let player: any = null
let currentUrl = ''
let ArtplayerCtor: any = null

// P3-1：视频关键帧缩略图
const { generate: generateThumbnails } = useVideoThumbnails()

// 倍速档位（对标夸克 0.5-5x）
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5]

async function initArtplayer() {
  if (!ArtplayerCtor) {
    const { default: Artplayer } = await import('artplayer')
    ArtplayerCtor = Artplayer
  }
}

function bindPlayerEvents() {
  if (!player) return

  // 首帧渲染保险：canplay 后强制 seek 到第 0 秒并渲染，避免某些浏览器黑屏
  player.on('video:loadedmetadata', () => {
    if (player && player.video && player.video.currentTime === 0) {
      player.seek = 0
    }
  })

  player.on('video:canplay', () => {
    if (player && player.video) {
      // 确保画面已绘制（部分浏览器 autoplay 被阻止后首帧不渲染）
      if (player.video.paused && player.video.readyState >= 2) {
        player.video.play().catch(() => {
          // 自动播放被浏览器策略阻止，属于正常情况，不报错
        })
      }
    }
  })

  // 监听浏览器 video 解码错误，提示用户视频编码可能不被支持
  player.on('error', () => {
    const video = player?.video
    const err = video?.error
    if (err && err.code === 4) {
      ElMessage.error('视频格式或编码不受浏览器支持，可尝试下载后用本地播放器打开')
    }
  })
}

async function initPlayer(url: string) {
  if (!containerRef.value || player) return
  if (!url) return

  await initArtplayer()
  currentUrl = url

  player = new ArtplayerCtor({
    container: containerRef.value,
    url,
    title: props.title,
    autoplay: true,
    // 高度由容器 CSS（aspect-video + min-h）决定，
    // .art-video-player 默认 height:100% 会撑满容器，避免高度塌陷黑屏
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
    // P3-1：进度条关键帧缩略图（后台异步采样，生成后动态注入）
    thumbnails: {
      urls: [],
      width: 160,
      height: 90,
      column: 1
    }
  })

  bindPlayerEvents()

  // P1-8：自定义全局快捷键（ArtPlayer hotkey 仅在焦点时生效，补充全局）
  window.addEventListener('keydown', onKeydown)

  // P3-1：后台异步采样关键帧，生成后动态注入 ArtPlayer
  refreshThumbnails(url)
}

function refreshThumbnails(videoUrl: string) {
  generateThumbnails(videoUrl, { count: 20, width: 160 })
    .then((urls) => {
      if (urls.length > 0 && player) {
        player.thumbnails = { urls, width: 160, height: 90, column: 1 }
      }
    })
    .catch(() => {
      // 采样失败（CORS/格式问题）→ 降级为无缩略图，不影响播放
    })
}

onMounted(async () => {
  if (!containerRef.value) return
  if (props.url) {
    initPlayer(props.url)
  }
  // 否则保持 loading，等 watch props.url 拿到签名 URL 后再初始化
})

// 签名 URL 解析完成后，动态切换视频源
watch(
  () => props.url,
  (newUrl) => {
    if (!newUrl || newUrl === currentUrl) return

    if (!player) {
      // 首次拿到签名 URL 时才真正创建播放器（避免用未签名 URL 初始化导致黑屏）
      initPlayer(newUrl)
      return
    }

    currentUrl = newUrl
    // ArtPlayer.switchUrl 只接受一个 url 参数
    player.switchUrl(newUrl)
    player.seek = 0
    player.play()
    refreshThumbnails(newUrl)
  }
)

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

function nearestRateIndex(rate: number): number {
  // 找不到精确匹配（浮点误差）时，选最接近的档位
  let best = 0
  let bestDiff = Infinity
  PLAYBACK_RATES.forEach((r, i) => {
    const diff = Math.abs(r - rate)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  })
  return best
}

function speedUp() {
  if (!player) return
  const idx = nearestRateIndex(player.playbackRate)
  const next = PLAYBACK_RATES[Math.min(idx + 1, PLAYBACK_RATES.length - 1)]
  player.playbackRate = next
  showSpeedToast(next)
}

function speedDown() {
  if (!player) return
  const idx = nearestRateIndex(player.playbackRate)
  const prev = PLAYBACK_RATES[Math.max(idx - 1, 0)]
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
  <div
    ref="containerRef"
    class="drive-video-container h-full w-full"
  />
</template>

<style scoped>
/* 兜底：保证 ArtPlayer 容器与 video 元素始终撑满父级高度，
   避免父级高度链塌缩导致 .art-video-player(height:100%) 解析为 0（伪黑屏） */
.drive-video-container {
  min-height: 360px;
}
.drive-video-container :deep(.art-video-player) {
  height: 100% !important;
  width: 100% !important;
}
.drive-video-container :deep(.art-video-player video) {
  height: 100% !important;
  width: 100% !important;
  object-fit: contain;
}
</style>
