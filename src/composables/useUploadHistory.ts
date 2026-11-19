/**
 * 最近上传记录（P3-1）
 *
 * 上传成功后只记文件名/大小/目标目录，不记 fileId：合并接口不返回新文件 id，
 * 前端无法可靠拿到落库后的 id。点击记录因此进入“所在目录”，而不是假装能直接打开文件。
 *
 * 模块级 ref 与 useRecent 一致：上传成功后列表页的“最近上传”横条要立即刷新。
 */
import { computed, ref } from 'vue'

export interface UploadHistoryItem {
  filename: string
  fileSizeDesc?: string
  fileSizeBytes?: number
  parentId?: string
  uploadTime: number
}

const STORAGE_KEY = 'x-pan:upload-history'
const MAX = 10

function load(): UploadHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as UploadHistoryItem[]
    return Array.isArray(parsed) ? parsed.filter((i) => i && i.filename) : []
  } catch {
    return []
  }
}

function save(list: UploadHistoryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* 配额/隐私模式下静默降级，不影响上传 */
  }
}

const uploadHistory = ref<UploadHistoryItem[]>(load())

export function useUploadHistory() {
  const recentUploads = computed<UploadHistoryItem[]>(() => uploadHistory.value)

  function add(item: Omit<UploadHistoryItem, 'uploadTime'>) {
    if (!item?.filename) return
    // 同名同目录视为一次重复上传，先移除旧记录再插到最前，避免横条被同名文件占满
    const list = uploadHistory.value.filter(
      (i) => !(i.filename === item.filename && (i.parentId || '') === (item.parentId || ''))
    )
    list.unshift({ ...item, uploadTime: Date.now() })
    uploadHistory.value = list.slice(0, MAX)
    save(uploadHistory.value)
  }

  function clear() {
    uploadHistory.value = []
    save([])
  }

  return { recentUploads, add, clear }
}
