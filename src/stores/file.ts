import { computed, ref, type Ref, type ComputedRef } from 'vue'
import { defineStore } from 'pinia'
import fileService from '@/api/file'
import { ElMessage } from '@/composables/useToast'
import type { SortOrder } from '@/composables/useTableSort'
import type { IFileVO, PageVO } from '@/types'

export interface SearchFilter {
  extensions?: string[]
  sizeMin?: number | string
  sizeMax?: number | string
  dateFrom?: string
  dateTo?: string
}

export interface FileStore {
  parentId: Ref<string>
  defaultParentId: Ref<string>
  defaultParentFilename: Ref<string>
  fileList: Ref<IFileVO[]>
  multipleSelection: Ref<IFileVO[]>
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
  setDefaultParentId: (id: string) => void
  setDefaultParentFilename: (name: string) => void
  setFileList: (list: IFileVO[]) => void
  appendFileList: (more: IFileVO[]) => void
  setMultipleSelection: (sel: IFileVO[]) => void
  setFileTypes: (types: string) => void
  setSearchFlag: (flag: boolean) => void
  setSearchKey: (key: string) => void
  setTableLoading: (loading: boolean) => void
  resetPagination: () => void
  clear: () => void
  loadFileList: () => void
  loadMore: () => void
  loadAllForFilter: () => void
  searchWithFilter: (filter: SearchFilter) => void
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
  const parentId = ref<string>('')
  const defaultParentId = ref<string>('')
  const defaultParentFilename = ref<string>('')
  const fileList = ref<IFileVO[]>([])
  const multipleSelection = ref<IFileVO[]>([])
  const fileTypes = ref<string>('-1')
  const searchFlag = ref<boolean>(false)
  const searchKey = ref<string>('')
  const tableLoading = ref<boolean>(true)

  const pageNum = ref<number>(1)
  const pageSize = ref<number>(50)
  const total = ref<number>(0)
  const hasMore = ref<boolean>(false)
  const isLoadingMore = ref<boolean>(false)

  const paramParentId = computed<string>(() =>
    parentId.value === '-1' ? defaultParentId.value : parentId.value
  )

  // ─── 排序状态（默认按名称升序，与工具栏一致） ───────────────────────────────
  const sortProp = ref<string>('name')
  const sortOrder = ref<SortOrder>('ascending')

  function valueOf(item: Record<string, unknown>, prop: string): number | string {
    if (prop === 'name') {
      const n = item.filename ?? item.name
      return typeof n === 'string' ? n : ''
    }
    const v = item[prop]
    return typeof v === 'number' || typeof v === 'string' ? v : ''
  }

  function toggleSort(prop: string): void {
    if (sortProp.value !== prop) {
      sortProp.value = prop
      sortOrder.value = 'ascending'
      return
    }
    if (sortOrder.value === 'ascending') sortOrder.value = 'descending'
    else if (sortOrder.value === 'descending') sortOrder.value = null
    else sortOrder.value = 'ascending'
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
    pageNum.value = 1
    hasMore.value = false
    total.value = 0
  }

  function refreshParentId(): void {
    parentId.value = defaultParentId.value
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
    sortProp.value = 'name'
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

  function loadFileList(): void {
    setTableLoading(true)
    pageNum.value = 1
    if (searchFlag.value) {
      fileService.search(
        {
          keyword: searchKey.value,
          fileTypes: '-1'
        } as any,
        (res: any) => {
          setFileList(res.data || [])
          setTableLoading(false)
          hasMore.value = false
          total.value = res.data?.length || 0
        },
        (res: any) => {
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
          pageSize: pageSize.value
        } as any,
        (res: any) => {
          setTableLoading(false)
          applyPageResponse(res.data, false)
        },
        (res: any) => {
          setTableLoading(false)
          ElMessage.error(res.message)
        }
      )
    }
  }

  function loadMore(): void {
    if (searchFlag.value || !hasMore.value || isLoadingMore.value) return
    isLoadingMore.value = true
    const next = pageNum.value + 1
    fileService.list(
      {
        parentId: paramParentId.value,
        fileTypes: fileTypes.value,
        pageNum: next,
        pageSize: pageSize.value
      } as any,
      (res: any) => {
        isLoadingMore.value = false
        applyPageResponse(res.data, true)
      },
      (res: any) => {
        isLoadingMore.value = false
        ElMessage.error(res.message)
      }
    )
  }

  function loadAllForFilter(): void {
    if (searchFlag.value) return
    setTableLoading(true)
    fileService.list(
      {
        parentId: paramParentId.value,
        fileTypes: fileTypes.value,
        pageNum: 1,
        pageSize: 9999
      } as any,
      (res: any) => {
        setTableLoading(false)
        applyPageResponse(res.data, false)
      },
      (res: any) => {
        setTableLoading(false)
        ElMessage.error(res.message)
      }
    )
  }

  function searchWithFilter(filter: SearchFilter): void {
    if (!searchFlag.value) setSearchFlag(true)
    setTableLoading(true)
    const params: Record<string, unknown> = {
      keyword: searchKey.value,
      fileTypes: '-1'
    }
    if (filter?.extensions?.length) params.extensions = filter.extensions.join(',')
    if (filter?.dateFrom) params.dateFrom = filter.dateFrom
    if (filter?.dateTo) params.dateTo = filter.dateTo

    fileService.search(
      params as any,
      (res: any) => {
        let list: IFileVO[] = res.data || []
        if (filter?.sizeMin !== '' && filter?.sizeMin != null) {
          const min = Number(filter.sizeMin) * 1024 * 1024
          list = list.filter((r) => {
            const sz = Number(r.fileSize || parseFileSizeDesc((r as any).fileSizeDesc) || 0)
            return sz >= min
          })
        }
        if (filter?.sizeMax !== '' && filter?.sizeMax != null) {
          const max = Number(filter.sizeMax) * 1024 * 1024
          list = list.filter((r) => {
            const sz = Number(r.fileSize || parseFileSizeDesc((r as any).fileSizeDesc) || 0)
            return sz <= max
          })
        }
        setFileList(list)
        setTableLoading(false)
        hasMore.value = false
        total.value = list.length
      },
      (res: any) => {
        setTableLoading(false)
        ElMessage.error(res.message)
      }
    )
  }

  return {
    parentId,
    defaultParentId,
    defaultParentFilename,
    fileList,
    multipleSelection,
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
    refreshParentId,
    setDefaultParentId,
    setDefaultParentFilename,
    setFileList,
    appendFileList,
    setMultipleSelection,
    setFileTypes,
    setSearchFlag,
    setSearchKey,
    setTableLoading,
    resetPagination,
    clear,
    loadFileList,
    loadMore,
    loadAllForFilter,
    searchWithFilter,
    toggleSort,
    sortItems
  }
})
