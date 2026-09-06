import { computed, ref, type Ref, type ComputedRef } from 'vue'
import { defineStore } from 'pinia'
import fileService from '@/api/file'
import { ElMessage } from '@/composables/useToast'
import type { SortOrder } from '@/composables/useTableSort'
import type { ApiResponse, IFileVO, PageVO } from '@/types'

export interface SearchFilter {
  extensions?: string[]
  sizeMin?: number | string
  sizeMax?: number | string
  dateFrom?: string
  dateTo?: string
}

/** /file/search 后端查询参数（搜索框 / AI 助手 / searchByParams 共用） */
export interface SearchParams {
  keyword: string
  fileTypes?: string
  extensions?: string
  dateFrom?: string
  dateTo?: string
  sizeMin?: number
  sizeMax?: number
}

/** searchByParams 的可选回调：transform 加工结果列表，onFresh 在最新响应落地后触发 */
export interface SearchByParamsHooks {
  /** 响应仍最新时对结果做前端二次加工（如大小过滤），返回新列表后再写入 fileList */
  transform?: (list: IFileVO[]) => IFileVO[]
  /** 列表写入 fileList 后的回调（更新面包屑、生成 AI 文案等），过期响应不触发 */
  onFresh?: (list: IFileVO[]) => void
  /** 业务失败回调（默认行为是 ElMessage.error） */
  onError?: (res: ApiResponse<unknown>) => void
}

export interface FileStore {
  parentId: Ref<string>
  defaultParentId: Ref<string>
  defaultParentFilename: Ref<string>
  fileList: Ref<IFileVO[]>
  multipleSelection: Ref<IFileVO[]>
  clipboard: Ref<{ mode: 'cut' | 'copy'; files: IFileVO[] } | null>
  fileTypes: Ref<string>
  searchFlag: Ref<boolean>
  searchKey: Ref<string>
  tableLoading: Ref<boolean>

  // 分页
  pageNum: Ref<number>
  pageSize: Ref<number>
  total: Ref<number>
  hasMore: Ref<boolean>
  isLoadingMore: Ref<boolean>

  paramParentId: ComputedRef<string>

  // 排序状态（与 FileTableToolbar / file-table 共享）
  sortProp: Ref<string>
  sortOrder: Ref<SortOrder>

  setParentId: (id: string) => void
  refreshParentId: () => void
  clearParentCache: () => void
  setDefaultParentId: (id: string) => void
  setDefaultParentFilename: (name: string) => void
  setFileList: (list: IFileVO[]) => void
  appendFileList: (more: IFileVO[]) => void
  setMultipleSelection: (sel: IFileVO[]) => void
  cutFiles: (files: IFileVO[]) => void
  copyFiles: (files: IFileVO[]) => void
  clearClipboard: () => void
  paste: () => Promise<{ success: boolean; message?: string }>
  setFileTypes: (types: string) => void
  setSearchFlag: (flag: boolean) => void
  setSearchKey: (key: string) => void
  setTableLoading: (loading: boolean) => void
  resetPagination: () => void
  clear: () => void
  loadFileList: () => void
  loadMore: () => void
  searchWithFilter: (filter: SearchFilter) => void
  searchByParams: (params: SearchParams, hooks?: SearchByParamsHooks) => void
  getOrderBy: () => string
  getOrder: () => string
  toggleSort: (prop: string) => void
  sortItems: <T extends Record<string, unknown>>(list: T[]) => T[]
}

/**
 * 把 fileSizeDesc 字符串解析为字节数（用于 size 范围前端筛选）
 * 例："1.5 MB" -> 1572864
 */
function parseFileSizeDesc(desc: string | null | undefined): number {
  if (!desc) return 0
  const m = String(desc)
    .trim()
    .match(/^([\d.]+)\s*(B|KB|MB|GB|K|M|G)?$/i)
  if (!m) return 0
  const n = parseFloat(m[1])
  const unit = (m[2] || 'B').toUpperCase()
  const mul: Record<string, number> = {
    B: 1,
    K: 1024,
    KB: 1024,
    M: 1024 * 1024,
    MB: 1024 * 1024,
    G: 1024 * 1024 * 1024,
    GB: 1024 * 1024 * 1024
  }
  return Math.floor(n * (mul[unit] || 1))
}

export const useFileStore = defineStore('file', (): FileStore => {
  const LS_PARENT_KEY = 'xpan:parentId'
  // 刷新前记住当前目录，刷新后恢复，避免一刷新回到根目录
  const savedParentId = (() => {
    try {
      return localStorage.getItem(LS_PARENT_KEY) || ''
    } catch {
      return ''
    }
  })()
  const parentId = ref<string>(savedParentId)
  const defaultParentId = ref<string>('')
  const defaultParentFilename = ref<string>('')
  const fileList = ref<IFileVO[]>([])
  const multipleSelection = ref<IFileVO[]>([])
  // 剪贴板：{ mode: 'cut' | 'copy', files } —— 用于"剪切/复制 → 粘贴"
  const clipboard = ref<{ mode: 'cut' | 'copy'; files: IFileVO[] } | null>(null)
  const fileTypes = ref<string>('-1')
  const searchFlag = ref<boolean>(false)
  const searchKey = ref<string>('')
  const tableLoading = ref<boolean>(true)

  function persistParentId(): void {
    try {
      if (parentId.value && parentId.value !== '-1') {
        localStorage.setItem(LS_PARENT_KEY, parentId.value)
      } else {
        localStorage.removeItem(LS_PARENT_KEY)
      }
    } catch {
      /* 忽略隐私模式下的写入失败 */
    }
  }

  const pageNum = ref<number>(1)
  const pageSize = ref<number>(50)
  const total = ref<number>(0)
  const hasMore = ref<boolean>(false)
  const isLoadingMore = ref<boolean>(false)

  // 请求序列号：快速切换目录/筛选时，仅采纳最新一次请求的响应，避免旧响应覆盖新数据
  let requestSeq = 0

  /**
   * 计算实际传给后端的 parentId。
   *
   * 后端语义（FileController.parseParentId + XPanUserFileMapper 的 parentId != -1 分支）：
   *   - 传 "-1"            → 跳过 parent_id 过滤，按类型"全盘跨目录"查询（分类页/图片页用）
   *   - 传真实根目录 ID    → 仅查该根目录一层（"全部文件"页用）
   *
   * 此前的实现把 parentId === '-1' 一律替换成 defaultParentId（根目录 ID），
   * 导致所有分类页都退化为"只查根目录一层"，子目录里的图片/视频/文档等无法展示。
   *
   * 修复：当 parentId 为哨兵 '-1' 时，若处于"分类视图"（fileTypes 为具体类型，非 '-1'），
   * 则透传 '-1' 字面量给后端触发全盘查询；仅在"全部文件"页（fileTypes 也是 '-1'）时，
   * 才退回根目录 ID，保持原有行为。这与移动端 FileService.list(parentId: '-1') 的语义一致。
   */
  const paramParentId = computed<string>(() =>
    parentId.value === '-1'
      ? fileTypes.value === '-1'
        ? defaultParentId.value
        : '-1'
      : parentId.value
  )

  // ─── 排序状态（默认按名称升序，与工具栏一致） ───────────────────────────────
  const sortProp = ref<string>('filename')
  const sortOrder = ref<SortOrder>('ascending')

  function valueOf(item: Record<string, unknown>, prop: string): number | string {
    const v = item[prop]
    return typeof v === 'number' || typeof v === 'string' ? v : ''
  }

  /**
   * 切换排序：换字段 → 新字段升序；同字段在 升/降 两态间循环。
   * 不提供 null（无排序）态：getOrderBy/getOrder 任何时刻都能给出明确的
   * orderBy/order（getOrder 把非 descending 一律映射为 asc，兼容外部直接
   * 把 sortOrder 置 null 的旧用法），保证排序状态与 UI 展示一致。
   */
  function toggleSort(prop: string): void {
    if (sortProp.value !== prop) {
      sortProp.value = prop
      sortOrder.value = 'ascending'
      return
    }
    sortOrder.value = sortOrder.value === 'ascending' ? 'descending' : 'ascending'
  }

  function sortItems<T extends Record<string, unknown>>(list: T[]): T[] {
    if (!sortOrder.value || !sortProp.value) return list
    const dir = sortOrder.value === 'ascending' ? 1 : -1
    return [...list].sort((a, b) => {
      const va = valueOf(a, sortProp.value)
      const vb = valueOf(b, sortProp.value)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb), 'zh-CN') * dir
    })
  }

  function setParentId(newParentId: string): void {
    parentId.value = newParentId
    persistParentId()
    pageNum.value = 1
    hasMore.value = false
    total.value = 0
  }

  // 切换账号/重新登录时调用，清掉上一次登录残留的目录缓存，
  // 避免新账号首屏短暂显示旧账号目录
  function clearParentCache(): void {
    try {
      localStorage.removeItem(LS_PARENT_KEY)
    } catch {
      /* 忽略隐私模式写入失败 */
    }
  }

  function refreshParentId(): void {
    parentId.value = defaultParentId.value
    persistParentId()
    pageNum.value = 1
    hasMore.value = false
    total.value = 0
  }

  function setDefaultParentId(id: string): void {
    defaultParentId.value = id
  }
  function setDefaultParentFilename(name: string): void {
    defaultParentFilename.value = name
  }
  function setFileList(list: IFileVO[]): void {
    fileList.value = list
  }
  function appendFileList(more: IFileVO[]): void {
    fileList.value = fileList.value.concat(more)
  }
  function setMultipleSelection(sel: IFileVO[]): void {
    multipleSelection.value = sel
  }

  /** 剪切：把选中文件放入剪贴板（cut 模式） */
  function cutFiles(files: IFileVO[]): void {
    if (!files || files.length === 0) return
    clipboard.value = { mode: 'cut', files }
  }
  /** 复制：把选中文件放入剪贴板（copy 模式） */
  function copyFiles(files: IFileVO[]): void {
    if (!files || files.length === 0) return
    clipboard.value = { mode: 'copy', files }
  }
  /** 清空剪贴板 */
  function clearClipboard(): void {
    clipboard.value = null
  }
  /** 粘贴：cut→移动，copy→复制，目标为当前目录 parentId */
  async function paste(): Promise<{ success: boolean; message?: string }> {
    const cb = clipboard.value
    if (!cb || cb.files.length === 0) {
      return { success: false, message: '剪贴板为空' }
    }
    const fileIds = cb.files.map((f) => f.fileId)
    const targetParentId = parentId.value
    try {
      if (cb.mode === 'cut') {
        await fileService.transfer({ fileIds, targetParentId })
      } else {
        await fileService.copy({ fileIds, targetParentId })
      }
      clearClipboard()
      await loadFileList()
      return { success: true }
    } catch (e: any) {
      return { success: false, message: e?.message || '粘贴失败' }
    }
  }

  function setFileTypes(types: string): void {
    fileTypes.value = types
    pageNum.value = 1
    hasMore.value = false
    total.value = 0
  }
  function setSearchFlag(flag: boolean): void {
    if (!flag) searchKey.value = ''
    searchFlag.value = flag
  }
  function setSearchKey(key: string): void {
    searchKey.value = key
  }
  function setTableLoading(loading: boolean): void {
    tableLoading.value = loading
  }
  function resetPagination(): void {
    pageNum.value = 1
    hasMore.value = false
    total.value = 0
  }

  function clear(): void {
    parentId.value = ''
    persistParentId()
    defaultParentId.value = ''
    defaultParentFilename.value = ''
    fileList.value = []
    multipleSelection.value = []
    fileTypes.value = '-1'
    searchFlag.value = false
    searchKey.value = ''
    tableLoading.value = true
    pageNum.value = 1
    hasMore.value = false
    total.value = 0
    sortProp.value = 'filename'
    sortOrder.value = 'ascending'
  }

  function applyPageResponse(
    payload: PageVO<IFileVO> | IFileVO[] | null | undefined,
    append: boolean
  ): void {
    if (payload && Array.isArray((payload as PageVO<IFileVO>).records)) {
      const p = payload as PageVO<IFileVO>
      if (append) {
        appendFileList(p.records)
        pageNum.value = p.pageNum ?? pageNum.value
      } else {
        setFileList(p.records)
        pageNum.value = p.pageNum ?? 1
      }
      hasMore.value = !!p.hasMore
      total.value = Number(p.total || 0)
    } else if (Array.isArray(payload)) {
      setFileList(payload as IFileVO[])
      hasMore.value = false
      total.value = (payload as IFileVO[]).length
    } else {
      setFileList([])
      hasMore.value = false
      total.value = 0
    }
  }

  // 把前端排序字段映射为后端 orderBy（对应后端 SafeOrderBy 白名单）
  function getOrderBy(): string {
    switch (sortProp.value) {
      case 'fileSize':
        return 'file_size'
      case 'updateTime':
        return 'update_time'
      case 'createTime':
        return 'create_time'
      default:
        return 'filename'
    }
  }

  function getOrder(): string {
    return sortOrder.value === 'descending' ? 'desc' : 'asc'
  }

  function loadFileList(): void {
    const seq = ++requestSeq
    // 重置 loadMore 进行中标志，避免切换目录/重载时残留 true，导致新目录滚动加载被错误拦截
    isLoadingMore.value = false
    setTableLoading(true)
    pageNum.value = 1
    if (searchFlag.value) {
      fileService.search(
        {
          keyword: searchKey.value,
          fileTypes: '-1'
        },
        (res: ApiResponse<IFileVO[]>) => {
          if (seq !== requestSeq) return // 已有更新的请求，丢弃过期响应
          setFileList(res.data || [])
          setTableLoading(false)
          hasMore.value = false
          total.value = res.data?.length || 0
        },
        (res: ApiResponse<unknown>) => {
          if (seq !== requestSeq) return
          setTableLoading(false)
          ElMessage.error(res.message)
        }
      )
    } else {
      fileService.list(
        {
          parentId: paramParentId.value,
          fileTypes: fileTypes.value,
          pageNum: 1,
          pageSize: pageSize.value,
          orderBy: getOrderBy(),
          order: getOrder()
        },
        (res: ApiResponse<PageVO<IFileVO>>) => {
          if (seq !== requestSeq) return // 丢弃过期响应，避免旧目录覆盖新目录
          setTableLoading(false)
          applyPageResponse(res.data, false)
        },
        (res: ApiResponse<unknown>) => {
          if (seq !== requestSeq) return
          setTableLoading(false)
          ElMessage.error(res.message)
        }
      )
    }
  }

  function loadMore(): void {
    if (searchFlag.value || !hasMore.value || isLoadingMore.value) return
    isLoadingMore.value = true
    const seq = ++requestSeq
    const next = pageNum.value + 1
    fileService.list(
      {
        parentId: paramParentId.value,
        fileTypes: fileTypes.value,
        pageNum: next,
        pageSize: pageSize.value,
        orderBy: getOrderBy(),
        order: getOrder()
      },
      (res: ApiResponse<PageVO<IFileVO>>) => {
        isLoadingMore.value = false
        if (seq !== requestSeq) return
        applyPageResponse(res.data, true)
      },
      (res: ApiResponse<unknown>) => {
        isLoadingMore.value = false
        if (seq !== requestSeq) return
        ElMessage.error(res.message)
      }
    )
  }

  function searchWithFilter(filter: SearchFilter): void {
    if (!searchFlag.value) setSearchFlag(true)
    const seq = ++requestSeq
    // 与 loadFileList 一致：重置 loadMore 标志和页码，避免旧目录的滚动加载/页码污染搜索结果
    isLoadingMore.value = false
    pageNum.value = 1
    setTableLoading(true)
    const params: {
      keyword: string
      fileTypes?: string
      extensions?: string
      dateFrom?: string
      dateTo?: string
    } = {
      keyword: searchKey.value,
      fileTypes: '-1'
    }
    if (filter?.extensions?.length) params.extensions = filter.extensions.join(',')
    if (filter?.dateFrom) params.dateFrom = filter.dateFrom
    if (filter?.dateTo) params.dateTo = filter.dateTo

    fileService.search(
      params,
      (res: ApiResponse<IFileVO[]>) => {
        if (seq !== requestSeq) return // 已有更新的请求，丢弃过期响应
        let list: IFileVO[] = res.data || []
        if (filter?.sizeMin !== '' && filter?.sizeMin != null) {
          const min = Number(filter.sizeMin) * 1024 * 1024
          list = list.filter((r) => {
            const sz = Number(r.fileSize || parseFileSizeDesc(r.fileSizeDesc) || 0)
            return sz >= min
          })
        }
        if (filter?.sizeMax !== '' && filter?.sizeMax != null) {
          const max = Number(filter.sizeMax) * 1024 * 1024
          list = list.filter((r) => {
            const sz = Number(r.fileSize || parseFileSizeDesc(r.fileSizeDesc) || 0)
            return sz <= max
          })
        }
        setFileList(list)
        setTableLoading(false)
        hasMore.value = false
        total.value = list.length
      },
      (res: ApiResponse<unknown>) => {
        if (seq !== requestSeq) return
        setTableLoading(false)
        ElMessage.error(res.message)
      }
    )
  }

  /**
   * 外部搜索路径的统一入口（全局搜索框 / AI 助手等）：
   * 与 loadFileList / searchWithFilter 共享同一 requestSeq，仅采纳最新一次响应，
   * 防止「旧搜索结果覆盖新目录 / 旧目录覆盖新搜索」的串台；命中后同步维护
   * tableLoading / total / hasMore / searchFlag 等状态。
   */
  function searchByParams(params: SearchParams, hooks?: SearchByParamsHooks): void {
    setSearchFlag(true)
    const seq = ++requestSeq
    isLoadingMore.value = false
    pageNum.value = 1
    setTableLoading(true)
    fileService.search(
      params,
      (res: ApiResponse<IFileVO[]>) => {
        if (seq !== requestSeq) return // 已有更新的请求，丢弃过期响应
        const raw = res.data || []
        const list = hooks?.transform ? hooks.transform(raw) : raw
        setFileList(list)
        setTableLoading(false)
        hasMore.value = false
        total.value = list.length
        hooks?.onFresh?.(list)
      },
      (res: ApiResponse<unknown>) => {
        if (seq !== requestSeq) return
        setTableLoading(false)
        if (hooks?.onError) hooks.onError(res)
        else ElMessage.error(res.message)
      }
    )
  }

  return {
    parentId,
    defaultParentId,
    defaultParentFilename,
    fileList,
    multipleSelection,
    clipboard,
    fileTypes,
    searchFlag,
    searchKey,
    tableLoading,
    pageNum,
    pageSize,
    total,
    hasMore,
    isLoadingMore,
    paramParentId,
    sortProp,
    sortOrder,
    setParentId,
    clearParentCache,
    refreshParentId,
    setDefaultParentId,
    setDefaultParentFilename,
    setFileList,
    appendFileList,
    setMultipleSelection,
    cutFiles,
    copyFiles,
    clearClipboard,
    paste,
    setFileTypes,
    setSearchFlag,
    setSearchKey,
    setTableLoading,
    resetPagination,
    clear,
    loadFileList,
    loadMore,
    searchWithFilter,
    searchByParams,
    getOrderBy,
    getOrder,
    toggleSort,
    sortItems
  }
})
