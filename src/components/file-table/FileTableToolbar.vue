<script setup lang="ts">
/**
 * FileTableToolbar —— 列表上方工具栏
 * - 筛选：仅保留文件类型（图片/文档/视频/音乐）多选
 * - 批量：选中 N 个 → 转移/复制/删除/下载
 */
import { computed, ref } from 'vue'
import { Filter, Download, Trash2, Check } from '@lucide/vue'
import BasePopover from '@/components/base/BasePopover.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import TransferButton from '@/components/buttons/transfer-button/index.vue'
import CopyButton from '@/components/buttons/copy-button/index.vue'
import { ElMessage } from '@/composables/useToast'
import { FileType } from '@/types'

interface TypeOption {
  label: string
  value: FileType
}

const typeOptions: TypeOption[] = [
  { label: '图片', value: FileType.IMAGE },
  { label: '文档', value: FileType.DOC },
  { label: '视频', value: FileType.VIDEO },
  { label: '音乐', value: FileType.AUDIO }
]

const props = defineProps({
  selectedRows: { type: Array, default: () => [] }
})

const emit = defineEmits(['filter-change', 'batch-download', 'batch-delete'])

const filterOpen = ref(false)
const filter = ref({
  extensions: [] as string[],
  fileTypes: [] as FileType[],
  sizeMin: '',
  sizeMax: '',
  dateFrom: '',
  dateTo: ''
})

const filterActive = computed(() => filter.value.fileTypes.length > 0)
const filterCount = computed(() => filter.value.fileTypes.length)
const allSelected = computed(() => filter.value.fileTypes.length === 0)

function clearFilter() {
  filter.value = { extensions: [], fileTypes: [], sizeMin: '', sizeMax: '', dateFrom: '', dateTo: '' }
  applyFilter()
}

function applyFilter() {
  emit('filter-change', filter.value)
  filterOpen.value = false
}

function selectAll() {
  filter.value.fileTypes = []
}

function toggleType(type: FileType) {
  const idx = filter.value.fileTypes.indexOf(type)
  if (idx === -1) filter.value.fileTypes.push(type)
  else filter.value.fileTypes.splice(idx, 1)
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
  <div
    class="toolbar flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]"
  >
    <div class="flex items-center gap-1">
      <BasePopover v-model="filterOpen" placement="bottom-start" :width="200">
        <template #trigger>
          <button
            type="button"
            class="inline-flex items-center gap-1 h-8 px-2.5 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] text-xs transition-colors"
            :class="
              filterActive
                ? 'border-[var(--color-primary-500)] text-[var(--color-primary-700)] dark:text-[var(--color-primary-300)] bg-[var(--color-primary-50)] dark:bg-[var(--color-primary-900)]/30'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'
            "
          >
            <Filter :size="13" />
            <span>筛选</span>
          </button>
        </template>
        <div class="py-1 min-w-[160px]">
          <button
            type="button"
            class="w-full flex items-center justify-between px-4 py-2 text-sm transition-colors"
            :class="
              allSelected
                ? 'text-[var(--color-primary-500)]'
                : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
            "
            @click="selectAll"
          >
            <span>全部文件</span>
            <Check v-if="allSelected" :size="14" />
          </button>

          <div class="my-1 border-t border-[var(--color-border)]" />

          <button
            v-for="opt in typeOptions"
            :key="opt.value"
            type="button"
            class="w-full flex items-center justify-between px-4 py-2 text-sm transition-colors"
            :class="
              filter.fileTypes.includes(opt.value)
                ? 'text-[var(--color-primary-500)]'
                : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
            "
            @click="toggleType(opt.value)"
          >
            <span>{{ opt.label }}</span>
            <Check
              v-if="filter.fileTypes.includes(opt.value)"
              :size="14"
            />
          </button>

          <div class="my-1 border-t border-[var(--color-border)]" />

          <div class="flex items-center justify-end gap-2 px-4 py-2">
            <button
              type="button"
              class="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              @click="clearFilter"
            >
              清空
            </button>
            <BaseButton variant="primary" size="sm" @click="applyFilter">应用</BaseButton>
          </div>
        </div>
      </BasePopover>
    </div>

    <div v-if="selectedCount > 0" class="flex items-center gap-1.5">
      <span class="text-xs text-[var(--color-text-muted)]"
        >已选
        <span class="font-medium text-[var(--color-text)] tabular-nums">{{ selectedCount }}</span>
        项</span
      >
      <button
        type="button"
        class="h-7 px-2 rounded-sm text-xs inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
        @click="onBatchDownload"
      >
        <Download :size="12" />
        下载
      </button>
      <TransferButton roundFlag size="small" />
      <CopyButton roundFlag size="small" />
      <button
        type="button"
        class="h-7 px-2 rounded-sm text-xs inline-flex items-center gap-1 text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]/20"
        @click="onBatchDelete"
      >
        <Trash2 :size="12" />
        删除
      </button>
    </div>
  </div>
</template>
