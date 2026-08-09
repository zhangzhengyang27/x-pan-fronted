<script setup>
/**
 * FileTableToolbar —— 列表上方工具栏
 * - 排序：name / size / date asc/desc
 * - 筛选：扩展名（多选）/ 大小区间 / 时间范围
 * - 批量：选中 N 个 → 转移/复制/删除/下载
 */
import {computed, ref, watch} from 'vue'
import {ArrowUp, ArrowDown, ArrowUpDown, Filter, X, Download, Trash2, FolderInput, Copy} from '@lucide/vue'
import BasePopover from '@/components/base/BasePopover.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import TransferButton from '@/components/buttons/transfer-button/index.vue'
import CopyButton from '@/components/buttons/copy-button/index.vue'
import {ElMessage} from '@/composables/useToast'
import {SORT_FIELDS, useTableSort} from '@/composables/useTableSort'

const props = defineProps({
  selectedRows: {type: Array, default: () => []},
  /** 全部可用的扩展名（从当前文件列表推导） */
  availableExtensions: {type: Array, default: () => []},
})

const emit = defineEmits(['sort-change', 'filter-change', 'batch-download', 'batch-delete'])

const {sortField, sortOrder, toggleSort} = useTableSort('name', 'asc')

const filterOpen = ref(false)
const filter = ref({
  extensions: [], // ['jpg', 'png', ...]
  sizeMin: '', // MB
  sizeMax: '',
  dateFrom: '', // ISO date
  dateTo: '',
})

const filterActive = computed(() => {
  return (
    filter.value.extensions.length > 0 ||
    filter.value.sizeMin !== '' ||
    filter.value.sizeMax !== '' ||
    filter.value.dateFrom !== '' ||
    filter.value.dateTo !== ''
  )
})

const filterCount = computed(() => {
  let n = 0
  if (filter.value.extensions.length) n++
  if (filter.value.sizeMin !== '' || filter.value.sizeMax !== '') n++
  if (filter.value.dateFrom !== '' || filter.value.dateTo !== '') n++
  return n
})

function clearFilter() {
  filter.value = {extensions: [], sizeMin: '', sizeMax: '', dateFrom: '', dateTo: ''}
  applyFilter()
}

function applyFilter() {
  emit('filter-change', filter.value)
  filterOpen.value = false
}

function toggleExt(ext) {
  const idx = filter.value.extensions.indexOf(ext)
  if (idx === -1) filter.value.extensions.push(ext)
  else filter.value.extensions.splice(idx, 1)
}

function getSortIcon(field) {
  if (sortField.value !== field) return ArrowUpDown
  return sortOrder.value === 'asc' ? ArrowUp : ArrowDown
}

function onSort(field) {
  toggleSort(field)
  emit('sort-change', {field: sortField.value, order: sortOrder.value})
}

function onBatchDownload() {
  if (props.selectedRows.length === 0) {
    ElMessage.warning('请先选择文件')
    return
  }
  emit('batch-download', props.selectedRows)
}

function onBatchDelete() {
  if (props.selectedRows.length === 0) {
    ElMessage.warning('请先选择文件')
    return
  }
  emit('batch-delete', props.selectedRows)
}

const selectedCount = computed(() => props.selectedRows.length)
</script>

<template>
  <div class="toolbar flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
    <div class="flex items-center gap-1">
      <button
        v-for="f in SORT_FIELDS"
        :key="f.key"
        type="button"
        class="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs transition-colors"
        :class="sortField === f.key ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] dark:bg-[var(--color-primary-900)]/30 dark:text-[var(--color-primary-300)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'"
        @click="onSort(f.key)"
      >
        <component :is="getSortIcon(f.key)" :size="12"/>
        {{ f.label }}
      </button>

      <BasePopover v-model:open="filterOpen" placement="bottom-start" :width="320">
        <template #trigger>
          <button
            type="button"
            class="relative inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs transition-colors"
            :class="filterActive ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] dark:bg-[var(--color-primary-900)]/30 dark:text-[var(--color-primary-300)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'"
          >
            <Filter :size="12"/>
            筛选
            <span v-if="filterActive" class="ml-1 size-4 inline-flex items-center justify-center rounded-full bg-[var(--color-primary-500)] text-white text-[10px]">{{ filterCount }}</span>
          </button>
        </template>
        <div class="space-y-3">
          <div>
            <p class="text-xs font-medium text-[var(--color-text)] mb-2">文件类型</p>
            <div v-if="availableExtensions.length === 0" class="text-xs text-[var(--color-text-muted)]">暂无数据</div>
            <div v-else class="flex flex-wrap gap-1.5 max-h-32 overflow-auto">
              <button
                v-for="ext in availableExtensions"
                :key="ext"
                type="button"
                class="inline-flex items-center gap-1 h-6 px-2 rounded border text-xs transition-colors"
                :class="filter.extensions.includes(ext) ? 'bg-[var(--color-primary-500)] border-[var(--color-primary-500)] text-white' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary-500)] hover:text-[var(--color-primary-700)]'"
                @click="toggleExt(ext)"
              >
                .{{ ext }}
              </button>
            </div>
          </div>

          <div>
            <p class="text-xs font-medium text-[var(--color-text)] mb-2">大小（MB）</p>
            <div class="flex items-center gap-2">
              <input
                v-model="filter.sizeMin"
                type="number"
                min="0"
                placeholder="不限"
                class="flex-1 h-7 px-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-xs"
              />
              <span class="text-xs text-[var(--color-text-muted)]">—</span>
              <input
                v-model="filter.sizeMax"
                type="number"
                min="0"
                placeholder="不限"
                class="flex-1 h-7 px-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-xs"
              />
            </div>
          </div>

          <div>
            <p class="text-xs font-medium text-[var(--color-text)] mb-2">修改时间</p>
            <div class="flex items-center gap-2">
              <input
                v-model="filter.dateFrom"
                type="date"
                class="flex-1 h-7 px-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-xs"
              />
              <span class="text-xs text-[var(--color-text-muted)]">—</span>
              <input
                v-model="filter.dateTo"
                type="date"
                class="flex-1 h-7 px-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-xs"
              />
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <button type="button" class="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]" @click="clearFilter">清空</button>
            <BaseButton variant="primary" size="sm" @click="applyFilter">应用</BaseButton>
          </div>
        </div>
      </BasePopover>
    </div>

    <div v-if="selectedCount > 0" class="flex items-center gap-1.5">
      <span class="text-xs text-[var(--color-text-muted)]">已选 <span class="font-medium text-[var(--color-text)] tabular-nums">{{ selectedCount }}</span> 项</span>
      <button type="button" class="h-7 px-2 rounded-md text-xs inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]" @click="onBatchDownload">
        <Download :size="12"/>
        下载
      </button>
      <TransferButton roundFlag size="small"/>
      <CopyButton roundFlag size="small"/>
      <button type="button" class="h-7 px-2 rounded-md text-xs inline-flex items-center gap-1 text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]/20" @click="onBatchDelete">
        <Trash2 :size="12"/>
        删除
      </button>
    </div>
  </div>
</template>