/**
 * 上传文件暂存（P2-11）
 *
 * 为什么不用 localStorage：File/Blob 无法序列化，强行转 base64 会复制数倍内存，
 * 且大文件必然触发配额失败。IndexedDB 原生支持 Blob，刷新后可以重新构造 File，
 * 让用户不必每次手动重新选择同一个文件。
 *
 * 边界：
 * - 只缓存不超过 256MB 的文件；更大的文件仍走“重新选择原文件”降级路径，
 *   避免把浏览器磁盘配额一次性打满（IndexedDB 配额失败不应影响上传主链路）。
 * - 隐私模式、配额不足、IndexedDB 不存在时全部静默降级，上传本身不受影响。
 * - 缓存按任务 id 隔离；任务成功/取消后主动删除，避免长期占用空间。
 */
const DB_NAME = 'x-pan-upload-cache'
const STORE_NAME = 'files'
const DB_VERSION = 1
/** 单文件缓存上限：超过后不落 IndexedDB，保留手动重新选择文件的路径 */
export const AUTO_RESUME_MAX_BYTES = 256 * 1024 * 1024

interface StoredUploadFile {
  taskId: string
  blob: Blob
  name: string
  type: string
  lastModified: number
  size: number
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null)
  return new Promise((resolve) => {
    let settled = false
    const finish = (db: IDBDatabase | null) => {
      if (settled) {
        db?.close()
        return
      }
      settled = true
      resolve(db)
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'taskId' })
        }
      }
      request.onsuccess = () => finish(request.result)
      // 隐私模式/浏览器禁用 IndexedDB 时 onerror 可能不给 event，统一按不可用处理
      request.onerror = () => finish(null)
      request.onblocked = () => finish(null)
    } catch {
      finish(null)
    }
  })
}

function withStore(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest
): Promise<boolean> {
  return openDb().then((db) => {
    if (!db) return false
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, mode)
        const request = action(tx.objectStore(STORE_NAME))
        request.onsuccess = () => resolve(true)
        request.onerror = () => resolve(false)
        // 事务失败（典型是 QuotaExceededError）不能让 Promise 永远悬挂
        tx.onerror = () => resolve(false)
        tx.onabort = () => resolve(false)
      } catch {
        resolve(false)
      } finally {
        // 事务结束后关闭连接，避免长生命周期的数据库句柄阻塞升级
        db.close()
      }
    })
  })
}

/**
 * 保存任务对应的原文件。返回 false 表示未缓存（超限/配额/隐私模式），
 * 调用方无需提示：手动重新选择文件仍可续传。
 */
export async function saveUploadFile(taskId: string, file: File): Promise<boolean> {
  if (!taskId || !file || file.size <= 0 || file.size > AUTO_RESUME_MAX_BYTES) return false
  const record: StoredUploadFile = {
    taskId,
    blob: file,
    name: file.name,
    type: file.type || '',
    lastModified: file.lastModified || Date.now(),
    size: file.size
  }
  return withStore('readwrite', (store) => store.put(record))
}

/** 读取并重建 File；记录损坏/大小不一致时删除脏数据并返回 null */
export async function loadUploadFile(taskId: string): Promise<File | null> {
  if (!taskId) return null
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(taskId)
      request.onsuccess = () => {
        const record = request.result as StoredUploadFile | undefined
        if (!record || !record.blob || !record.name || !record.size) {
          resolve(null)
          return
        }
        try {
          const file = new File([record.blob], record.name, {
            type: record.type || '',
            lastModified: record.lastModified || Date.now()
          })
          // 部分浏览器重建后的 size 可能与元数据有偏差；用元数据兜底校验，
          // 不一致说明记录损坏，宁可降级为手动选择也不能拿错文件续传。
          resolve(file.size === record.size ? file : null)
        } catch {
          resolve(null)
        }
      }
      request.onerror = () => resolve(null)
      tx.onerror = () => resolve(null)
    } catch {
      resolve(null)
    } finally {
      db.close()
    }
  })
}

export async function deleteUploadFile(taskId: string): Promise<void> {
  if (!taskId) return
  await withStore('readwrite', (store) => store.delete(taskId))
}
