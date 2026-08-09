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

export function useTableSort(initial: Partial<SortState> = {}) {
  const state = reactive<SortState>({
    prop: initial.prop || '',
    order: initial.order || null
  })

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
   * 根据当前排序对数组排序（原地排序，谨慎使用）
   */
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

  return { state, isSorted, setSort, clear, applySort }
}
