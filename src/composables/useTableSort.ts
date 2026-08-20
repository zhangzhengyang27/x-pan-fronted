/**
 * useTableSort —— 表格排序状态管理
 * 维护 { prop, order }，order: 'ascending' | 'descending' | null
 */
import { computed, reactive } from 'vue'

export type SortOrder = 'ascending' | 'descending' | null

export interface SortState {
  prop: string
  order: SortOrder
}

export interface SortFieldOption {
  key: string
  label: string
}

export const SORT_FIELDS: SortFieldOption[] = [
  { key: 'filename', label: '名称' },
  { key: 'fileSize', label: '大小' },
  { key: 'updateTime', label: '修改时间' }
]

function valueOf(item: Record<string, any>, prop: string): number | string {
  // 排序字段 key 与后端字段对齐（filename），名称排序直接取 filename
  if (prop === 'filename') return item.filename || ''
  const v = item[prop]
  return v ?? ''
}

function compare(a: number | string, b: number | string): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'zh-CN')
}

export function useTableSort(initialProp = '', initialOrder: SortOrder = null) {
  const state = reactive<SortState>({
    prop: initialProp,
    order: initialOrder
  })

  const sortField = computed(() => state.prop)
  const sortOrder = computed(() => state.order)
  const isSorted = computed(() => state.order !== null && !!state.prop)

  function setSort(prop: string, order: SortOrder) {
    state.prop = prop
    state.order = order
  }

  function clear() {
    state.prop = ''
    state.order = null
  }

  /**
   * 切换排序：未排该列→升序；已是升序→降序；已是降序→清除
   */
  function toggleSort(prop: string) {
    if (state.prop !== prop) {
      state.prop = prop
      state.order = 'ascending'
      return
    }
    if (state.order === 'ascending') {
      state.order = 'descending'
    } else if (state.order === 'descending') {
      state.prop = ''
      state.order = null
    } else {
      state.order = 'ascending'
    }
  }

  /**
   * 根据当前排序对数组排序，返回新数组
   */
  function sortItems<T extends Record<string, any>>(list: T[]): T[] {
    if (!isSorted.value) return list
    const dir = state.order === 'ascending' ? 1 : -1
    const prop = state.prop
    return [...list].sort((a, b) => compare(valueOf(a, prop), valueOf(b, prop)) * dir)
  }

  function applySort<T>(list: T[], getValue: (item: T) => number | string): T[] {
    if (!isSorted.value) return list
    const dir = state.order === 'ascending' ? 1 : -1
    return [...list].sort((a, b) => {
      const va = getValue(a)
      const vb = getValue(b)
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
  }

  return {
    state,
    sortField,
    sortOrder,
    isSorted,
    setSort,
    clear,
    toggleSort,
    sortItems,
    applySort
  }
}
