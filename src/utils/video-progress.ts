/**
 * 视频续播位置（P3-4）
 *
 * 只存秒数与展示元数据，不存播放状态；Key 按 fileId 隔离，避免同一浏览器多文件互相覆盖。
 * 位置过短、接近结尾、超过 30 天都视为无效：避免“点开视频就跳到片尾”或长期脏数据。
 */
import { ref } from 'vue'

const KEY_PREFIX = 'x-pan:video-progress:'
const MIN_RESUME_SECONDS = 5
const NEAR_END_SECONDS = 5
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export interface VideoProgressMeta {
  title?: string
  fileType?: number
}

interface StoredProgress {
  currentTime: number
  duration: number
  updatedAt: number
  title?: string
  fileType?: number
}

export interface VideoProgressItem extends StoredProgress {
  fileId: string
}

/** 写入/清理时递增，供“继续观看”区块感知 localStorage 变化（跨组件响应式） */
export const videoProgressRevision = ref(0)


function keyOf(fileId: string | number) {
  return KEY_PREFIX + String(fileId)
}

function remove(fileId: string | number) {
  try {
    localStorage.removeItem(keyOf(fileId))
  } catch {
    /* 隐私模式写入失败可忽略 */
  }
}

function isValid(parsed: StoredProgress | null): parsed is StoredProgress {
  return Boolean(
    parsed &&
      Number.isFinite(parsed.currentTime) &&
      Number.isFinite(parsed.duration) &&
      parsed.currentTime >= MIN_RESUME_SECONDS &&
      parsed.currentTime < parsed.duration - NEAR_END_SECONDS &&
      Date.now() - parsed.updatedAt <= MAX_AGE_MS
  )
}

export function loadVideoProgress(fileId: string | number): number | null {
  try {
    const raw = localStorage.getItem(keyOf(fileId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredProgress
    if (!isValid(parsed)) {
      // 损坏/过期/已播到片尾的记录直接清掉，避免继续观看区块反复出现无效条目
      remove(fileId)
      return null
    }
    return parsed.currentTime
  } catch {
    remove(fileId)
    return null
  }
}

/**
 * 列出所有可续播的本地视频，按最近播放时间倒序。
 * 只读 localStorage，不触发网络；用于根目录“继续观看”横条。
 */
export function listVideoProgress(limit = 8): VideoProgressItem[] {
  const items: VideoProgressItem[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(KEY_PREFIX)) continue
      const fileId = key.slice(KEY_PREFIX.length)
      if (!fileId) continue
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '') as StoredProgress
        // 复用与 load 相同的有效性判断，确保列表不会展示“即将片尾”的无效进度
        if (!isValid(parsed)) continue
        items.push({ fileId, ...parsed })
      } catch {
        // 单条脏数据不应影响其它视频展示
        continue
      }
    }
  } catch {
    return []
  }
  return items.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, Math.max(1, limit))
}

export function saveVideoProgress(
  fileId: string | number,
  currentTime: number,
  duration: number,
  meta?: VideoProgressMeta
) {
  // 进度太短或已接近结尾时不保存；否则下次打开会直接跳到片尾，体验比不续播更差
  if (
    !Number.isFinite(currentTime) ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    currentTime < MIN_RESUME_SECONDS ||
    currentTime >= duration - NEAR_END_SECONDS
  ) {
    remove(fileId)
    return
  }
  const value: StoredProgress = {
    currentTime,
    duration,
    updatedAt: Date.now(),
    // 用于根目录“继续观看”展示；不覆盖历史标题为空时的旧记录
    ...(meta?.title ? { title: meta.title } : {}),
    ...(meta?.fileType != null ? { fileType: meta.fileType } : {})
  }
  try {
    localStorage.setItem(keyOf(fileId), JSON.stringify(value))
    videoProgressRevision.value++
  } catch {
    /* ignore quota */
  }
}

export function clearVideoProgress(fileId: string | number) {
  remove(fileId)
  videoProgressRevision.value++
}

