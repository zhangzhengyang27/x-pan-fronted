/**
 * useVideoCover —— 视频卡片封面缩略图生成（P3-1 前端降级实现）
 *
 * 原理：为每个视频文件在进入视口时，用隐藏 video 元素 seek 到 10% 时间点，
 * 绘制到 canvas 生成单帧 dataURL 作为封面。纯前端，无后端依赖。
 *
 * 与 useVideoThumbnails 的区别：本 composable 面向「列表卡片封面」场景，
 * 只提取 1 帧（轻量），并内置 IntersectionObserver 懒加载 + dataURL 缓存，
 * 避免大量视频同时加载造成的带宽/CPU 压力。
 */
import { onBeforeUnmount } from 'vue'
import { resolvePreviewUrl, resolveVideoCoverUrl, invalidatePreviewUrl } from '@/utils/preview'

// dataURL 缓存：fileId -> cover dataURL（会话级，避免重复采样）
const coverCache = new Map<string, string>()
// 缓存容量上限：与图片缩略图 urlCache 一致，避免长时间浏览大量视频导致内存无界增长
const COVER_CACHE_MAX = 500
// 封面生成最大重试次数（总尝试 = MAX_RETRY + 1）
const COVER_MAX_RETRY = 2

/**
 * 清除指定文件的视频封面缓存（模块级，供文件删除/移动等操作后失效调用）。
 * 注意：各组件实例内部的 triggered 集合无法从这里清除，
 * 但 coverCache 命中会直接返回，因此删除 coverCache 后下一次进入视口会重新生成。
 */
export function invalidateVideoCoverCache(fileId: string): void {
  coverCache.delete(fileId)
}

export function useVideoCover() {
  // fileId -> 是否已进入视口并触发过生成
  const triggered = new Set<string>()
  const observers = new Map<string, IntersectionObserver>()

  /**
   * 为视频卡片注册懒加载封面生成。
   * 卡片元素进入视口（提前 200px）后才开始提取封面，生成后写入回调。
   *
   * @param fileId 文件 id
   * @param el     卡片根元素（用于 IntersectionObserver 观察）
   * @param onDone 生成完成回调（dataURL 或 null）
   */
  function watch(fileId: string, el: HTMLElement, onDone: (dataUrl: string | null) => void) {
    if (!el || triggered.has(fileId)) return

    // 命中缓存直接返回
    if (coverCache.has(fileId)) {
      triggered.add(fileId)
      onDone(coverCache.get(fileId) as string)
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      trigger(fileId, onDone)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect()
          observers.delete(fileId)
          trigger(fileId, onDone)
        }
      },
      { rootMargin: '200px' }
    )
    observers.set(fileId, observer)
    observer.observe(el)
  }

  function trigger(fileId: string, onDone: (dataUrl: string | null) => void) {
    if (triggered.has(fileId)) return
    triggered.add(fileId)
    // 失败重试：ptoken 过期/瞬时网络失败时失效缓存并重试，最多 COVER_MAX_RETRY 次
    generateCoverWithRetry(fileId, COVER_MAX_RETRY)
      .then((dataUrl) => {
        if (dataUrl) {
          // 容量控制：超过上限时淘汰最旧条目
          if (coverCache.size >= COVER_CACHE_MAX) {
            const oldest = coverCache.keys().next().value
            if (oldest !== undefined) coverCache.delete(oldest)
          }
          coverCache.set(fileId, dataUrl)
        }
        onDone(dataUrl)
      })
      .catch(() => onDone(null))
  }

  async function generateCoverWithRetry(fileId: string, retriesLeft: number): Promise<string | null> {
    // 优先尝试后端 FFmpeg 封面（磁盘缓存，无需前端抽帧）；不可用则降级 canvas 采样
    const serverCover = await generateServerCover(fileId)
    if (serverCover) return serverCover

    const dataUrl = await generateCover(fileId)
    if (dataUrl) return dataUrl
    if (retriesLeft <= 0) return null
    // 失效可能过期的 ptoken 缓存，重试时重新申请
    invalidatePreviewUrl(fileId)
    return generateCoverWithRetry(fileId, retriesLeft - 1)
  }

  /** 尝试获取后端视频封面直链（FFmpeg 生成）；失败返回 null 触发 canvas 降级 */
  async function generateServerCover(fileId: string): Promise<string | null> {
    try {
      const url = await resolveVideoCoverUrl(fileId)
      if (!url) return null
      // 探测封面是否可用（后端 FFmpeg 缺失会返回 404）
      const ok = await new Promise<boolean>((resolve) => {
        const img = new Image()
        img.onload = () => resolve(true)
        img.onerror = () => resolve(false)
        img.src = url
      })
      return ok ? url : null
    } catch {
      return null
    }
  }

  /** 提取单帧封面：seek 到 10% 时间点绘制到 canvas */
  async function generateCover(fileId: string): Promise<string | null> {
    let url: string
    try {
      url = await resolvePreviewUrl(fileId)
    } catch {
      return null
    }

    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'metadata'
    video.src = url
    video.style.position = 'fixed'
    video.style.left = '-9999px'
    video.style.opacity = '0'
    document.body.appendChild(video)

    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('metadata 超时')), 8000)
        video.addEventListener('loadedmetadata', () => { clearTimeout(timer); resolve() }, { once: true })
        video.addEventListener('error', () => { clearTimeout(timer); reject(new Error('视频加载失败')) }, { once: true })
      })

      const duration = video.duration
      if (!duration || !isFinite(duration)) return null

      // 封面取 10% 位置帧，避免片头黑屏；seek 加超时兜底，防止异常流导致永久 pending
      const target = duration * 0.1
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('seek 超时')), 8000)
        const onSeeked = () => {
          clearTimeout(timer)
          video.removeEventListener('seeked', onSeeked)
          requestAnimationFrame(() => resolve())
        }
        video.addEventListener('seeked', onSeeked)
        video.currentTime = target
      })

      const w = 480
      const ratio = video.videoHeight / video.videoWidth || 0.5625
      const h = Math.max(1, Math.round(w * ratio))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(video, 0, 0, w, h)
      return canvas.toDataURL('image/jpeg', 0.7)
    } catch {
      return null
    } finally {
      video.remove()
    }
  }

  /** 清理所有 observer（组件卸载时调用） */
  function dispose() {
    observers.forEach((o) => o.disconnect())
    observers.clear()
  }

  /** 清除指定文件的封面缓存（文件删除/移动/更新后失效，重新生成） */
  function removeCover(fileId: string) {
    coverCache.delete(fileId)
    triggered.delete(fileId)
  }

  onBeforeUnmount(dispose)

  return { watch, dispose, removeCover }
}
