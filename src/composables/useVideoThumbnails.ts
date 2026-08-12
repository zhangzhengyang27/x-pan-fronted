/**
 * useVideoThumbnails —— 视频关键帧缩略图生成（P3-1）
 *
 * 原理：用隐藏 video 元素 seek 到不同时间点，绘制到 canvas 生成 dataURL。
 * 不依赖后端接口，纯前端 canvas 采样。
 *
 * 限制：
 * - CORS：视频需同源或支持 CORS（R Pan 经 vite proxy 同源，无此问题）
 * - 性能：采样 N 帧需 seek N 次，约 2-5 秒（20 帧以内）
 * - 精度：不如后端预生成，但对标夸克的进度条 hover 预览已足够
 *
 * 后端就绪后可替换为 GET /file/{id}/thumbnails 返回的 sprite URL（见 BE-03）
 */
import { ref } from 'vue'

export interface ThumbnailOptions {
  count?: number // 采样帧数（默认 20）
  width?: number // 缩略图宽度（默认 160）
  height?: number // 缩略图高度（默认 90，按视频比例自动计算）
}

export function useVideoThumbnails() {
  const generating = ref(false)
  const thumbnails = ref<string[]>([])

  /**
   * 生成视频关键帧缩略图
   * @param videoUrl 视频源 URL
   * @param options 采样选项
   * @returns dataURL 数组（空数组表示生成失败，如 CORS）
   */
  async function generate(
    videoUrl: string,
    options: ThumbnailOptions = {}
  ): Promise<string[]> {
    const { count = 20, width = 160 } = options
    generating.value = true

    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'metadata'
    video.src = videoUrl
    video.style.position = 'fixed'
    video.style.left = '-9999px'
    video.style.opacity = '0'
    document.body.appendChild(video)

    try {
      // 等待 metadata 加载，获取时长
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('metadata 超时')), 10000)
        video.addEventListener(
          'loadedmetadata',
          () => {
            clearTimeout(timer)
            resolve()
          },
          { once: true }
        )
        video.addEventListener('error', () => reject(new Error('视频加载失败')), { once: true })
      })

      const duration = video.duration
      if (!duration || !isFinite(duration)) {
        return []
      }

      // 按视频比例计算缩略图高度
      const ratio = video.videoHeight / video.videoWidth || 0.5625
      const height = Math.round(width * ratio)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return []

      const results: string[] = []
      // 在 10%-90% 时间区间均匀采样，避免片头/片尾黑屏
      for (let i = 0; i < count; i++) {
        const t = duration * (0.1 + (0.8 * i) / (count - 1))
        try {
          await seekTo(video, t)
          ctx.drawImage(video, 0, 0, width, height)
          // toDataURL 可能因 CORS 抛出 SecurityError
          results.push(canvas.toDataURL('image/jpeg', 0.7))
        } catch {
          // 单帧失败跳过，继续采样
          continue
        }
      }

      thumbnails.value = results
      return results
    } catch {
      // CORS 或加载失败 → 返回空数组，ArtPlayer 降级为无缩略图
      return []
    } finally {
      video.remove()
      generating.value = false
    }
  }

  return { generating, thumbnails, generate }
}

/** seek 到指定时间并等待 seeked 事件 */
function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      // seeked 后需等一帧让画面渲染
      requestAnimationFrame(() => resolve())
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}
