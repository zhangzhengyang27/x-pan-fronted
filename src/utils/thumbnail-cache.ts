/**
 * thumbnail-cache —— 图片缩略图位图缓存（IndexedDB）
 *
 * 背景：
 *  预览直链的 ptoken 只有 5 分钟有效，且 URL 每次申请都不同（带不同 ptoken），
 *  导致同一张图片以不同 URL 反复请求时，浏览器 HTTP 强缓存（Cache-Control）无法命中，
 *  只能依赖后端磁盘缓存重新拉流。这里在浏览器侧用 IndexedDB 缓存「已解码的 Blob 位图」，
 *  以 fileId + 尺寸档位为 key，命中后直接走 blob: URL，避免重复拉流。
 *
 * 特性：
 *  - 惰性初始化（首次使用时才打开 DB），兼容不支持 IndexedDB 的环境（自动降级为直链）。
 *  - 内存 LRU 兜底：IndexedDB 异步读延迟下，命中内存缓存可同步返回，减少闪烁。
 *  - 容量控制：条目数上限 + 单个 blob 大小上限，超限淘汰最旧条目（LRU 语义）。
 */

export interface ThumbnailCacheEntry {
  blob: Blob
  url: string
  ts: number
}

const DB_NAME = 'xpan-thumbnail-cache'
const DB_VERSION = 1
const STORE = 'thumbs'

// 缓存容量上限（避免长时间浏览大量图片导致配额耗尽）
const MAX_ENTRIES = 300
// 单个缩略图 Blob 大小上限（2MB，超出说明不是缩略图，不缓存）
const MAX_BLOB_SIZE = 2 * 1024 * 1024

let dbPromise: Promise<IDBDatabase | null> | null = null

// 内存 LRU 兜底（key -> 缓存项），命中可同步返回，避免 IndexedDB 异步读的闪烁
const memCache = new Map<string, ThumbnailCacheEntry>()

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null)
        return
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        console.warn('[thumbnail-cache] IndexedDB open failed:', req.error)
        resolve(null)
      }
      req.onblocked = () => resolve(null)
    } catch (e) {
      console.warn('[thumbnail-cache] IndexedDB unavailable:', e)
      resolve(null)
    }
  })
  return dbPromise
}

/** 构造缓存 key（与 resolvePreviewUrl 的 `${fileId}::${size}` 语义一致） */
export function thumbnailCacheKey(fileId: string | number, size: number | 'original'): string {
  return `${fileId}::${size}`
}

/**
 * 同步读取内存缓存（命中返回 blob URL，未命中返回 null）。
 * 优先用内存缓存，可避免 IndexedDB 异步读导致的加载闪烁。
 */
export function getThumbnailFromMemory(
  fileId: string | number,
  size: number | 'original'
): string | null {
  const key = thumbnailCacheKey(fileId, size)
  const hit = memCache.get(key)
  if (hit) {
    // 更新访问时间，模拟 LRU
    hit.ts = Date.now()
    memCache.delete(key)
    memCache.set(key, hit)
    return hit.url
  }
  return null
}

/**
 * 读取缩略图缓存（先内存、后 IndexedDB）。
 * 命中返回 blob URL；未命中返回 null。
 */
export async function getThumbnailFromCache(
  fileId: string | number,
  size: number | 'original'
): Promise<string | null> {
  const key = thumbnailCacheKey(fileId, size)

  const memHit = getThumbnailFromMemory(fileId, size)
  if (memHit) return memHit

  const db = await openDb()
  if (!db) return null

  try {
    const val = await new Promise<ThumbnailCacheEntry | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result as ThumbnailCacheEntry | undefined)
      req.onerror = () => reject(req.error)
    })
    if (!val || !val.blob) return null
    // 重建 blob URL（IndexedDB 存 Blob，URL 需运行时创建）
    const url = URL.createObjectURL(val.blob)
    const entry: ThumbnailCacheEntry = { blob: val.blob, url, ts: Date.now() }
    memCache.set(key, entry)
    evictMemoryIfNeeded()
    return url
  } catch {
    return null
  }
}

/**
 * 写入缩略图缓存（内存 + IndexedDB）。
 * @param fileId   文件 id
 * @param size     尺寸档位
 * @param blob     缩略图 Blob
 */
export async function putThumbnailToCache(
  fileId: string | number,
  size: number | 'original',
  blob: Blob
): Promise<void> {
  if (!blob || blob.size === 0 || blob.size > MAX_BLOB_SIZE) return
  const key = thumbnailCacheKey(fileId, size)
  const url = URL.createObjectURL(blob)
  const entry: ThumbnailCacheEntry = { blob, url, ts: Date.now() }
  memCache.set(key, entry)
  evictMemoryIfNeeded()

  const db = await openDb()
  if (!db) return
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(entry, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    evictDbIfNeeded(db)
  } catch {
    /* 写失败忽略，不影响主流程 */
  }
}

/** 从缓存中移除指定条目（文件更新/删除后失效） */
export function removeThumbnailFromCache(
  fileId: string | number,
  size?: number | 'original'
): void {
  const open = async () => {
    const db = await openDb()
    if (!db) return
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, 'readwrite')
        const store = tx.objectStore(STORE)
        if (size !== undefined) {
          store.delete(thumbnailCacheKey(fileId, size))
        } else {
          // 删除该文件所有尺寸档位
          const range = IDBKeyRange.bound(`${fileId}::`, `${fileId}::\uffff`)
          const req = store.openCursor(range)
          req.onsuccess = () => {
            const cursor = req.result
            if (cursor) {
              cursor.delete()
              cursor.continue()
            }
          }
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
      })
    } catch {
      /* ignore */
    }
  }
  void open()

  // 同步清理内存缓存
  if (size !== undefined) {
    memCache.delete(thumbnailCacheKey(fileId, size))
  } else {
    const prefix = `${fileId}::`
    for (const key of memCache.keys()) {
      if (key.startsWith(prefix)) {
        const hit = memCache.get(key)
        if (hit) URL.revokeObjectURL(hit.url)
        memCache.delete(key)
      }
    }
  }
}

function evictMemoryIfNeeded(): void {
  while (memCache.size > MAX_ENTRIES) {
    // Map 迭代顺序即插入顺序，最旧的在前
    const oldestKey = memCache.keys().next().value as string | undefined
    if (oldestKey === undefined) break
    const oldest = memCache.get(oldestKey)
    if (oldest) URL.revokeObjectURL(oldest.url)
    memCache.delete(oldestKey)
  }
}

function evictDbIfNeeded(db: IDBDatabase): void {
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const countReq = store.count()
    countReq.onsuccess = () => {
      const count = countReq.result
      if (count <= MAX_ENTRIES) return
      // 超出上限：按时间戳删除最旧条目（简单起见，删除最早插入的 N 条）
      const excess = count - MAX_ENTRIES
      const req = store.openCursor()
      let removed = 0
      req.onsuccess = () => {
        const cursor = req.result
        if (cursor && removed < excess) {
          cursor.delete()
          removed++
          cursor.continue()
        }
      }
    }
  } catch {
    /* ignore */
  }
}
