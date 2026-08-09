/**
 * useTableSort —— 客户端排序（参考 html5-examples DrivePage）
 * 后端不支持 orderBy/order 参数，前端 sort 即可
 * - 支持 name / size / date 三种字段
 * - asc / desc 切换
 * - 默认按 name asc
 */
import {computed, ref} from 'vue'

export const SORT_FIELDS = [
  {key: 'name', label: '名称', getValue: (r) => (r.filename || r.name || '').toLowerCase()},
  {key: 'size', label: '大小', getValue: (r) => Number(r.fileSize || r.size || 0)},
  {key: 'date', label: '修改时间', getValue: (r) => new Date(r.updateTime || r.updatedAt || 0).getTime()},
]

export function useTableSort(initialField = 'name', initialOrder = 'asc') {
  const sortField = ref(initialField)
  const sortOrder = ref(initialOrder) // 'asc' | 'desc'

  function toggleSort(field) {
    if (sortField.value === field) {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortField.value = field
      sortOrder.value = 'asc'
    }
  }

  function sortItems(items) {
    const field = SORT_FIELDS.find((f) => f.key === sortField.value)
    if (!field) return items
    const sorted = [...items].sort((a, b) => {
      const va = field.getValue(a)
      const vb = field.getValue(b)
      if (va < vb) return sortOrder.value === 'asc' ? -1 : 1
      if (va > vb) return sortOrder.value === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }

  const sortedItems = computed(() => sortItems([]))

  return {
    sortField,
    sortOrder,
    toggleSort,
    sortItems,
  }
}
