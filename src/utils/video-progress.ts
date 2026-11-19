/**
 * 视频续播位置（P3-4）
 *
 * 只存秒数，不存播放状态；Key 按 fileId 隔离，避免同一浏览器多文件互相覆盖。
 * 位置过短、接近结尾、超过 30 天都视为无效：避免“点开视频就跳到片尾”或长期脏数据。
 */
const KEY_PREFIX = 'x-pan:video-progress:'
const MIN_RESUME_SECONDS = 5
const NEAR_END_SECONDS = 5
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

interface StoredProgress {
  currentTime: number
  duration: number
  updatedAt: number
}

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

export function loadVideoProgress(fileId: string | number): number | null {
  try {
    const raw = localStorage.getItem(keyOf(fileId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredProgress
    if (
      !parsed ||
      !Number.isFinite(parsed.currentTime) ||
      !Number.isFinite(parsed.duration) ||
      parsed.currentTime < MIN_RESUME_SECONDS ||
      parsed.currentTime >= parsed.duration - NEAR_END_SECONDS ||
      Date.now() - parsed.updatedAt > MAX_AGE_MS
    ) {
      remove(fileId)
      return null
    }
    return parsed.currentTime
  } catch {
    remove(fileId)
    return null
  }
}

export function saveVideoProgress(fileId: string | number, currentTime: number, duration: number) {
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
  const value: StoredProgress = { currentTime, duration, updatedAt: Date.now() }
  try {
    localStorage.setItem(keyOf(fileId), JSON.stringify(value))
  } catch {
    /* ignore quota */
  }
}

export function clearVideoProgress(fileId: string | number) {
  remove(fileId)
}
