<script setup lang="ts">
/**
 * FileTableToolbar —— 列表上方批量操作工具栏
 * - 选中 N 个 → 转移/复制/删除/下载
 */
import { computed } from 'vue'
import { Download, Trash2 } from '@lucide/vue'
import TransferButton from '@/components/buttons/transfer-button/index.vue'
import CopyButton from '@/components/buttons/copy-button/index.vue'
import { ElMessage } from '@/composables/useToast'

const props = defineProps({
  selectedRows: { type: Array, default: () => [] }
})

const emit = defineEmits(['batch-download', 'batch-delete'])

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
    class="toolbar flex items-center justify-end gap-2 px-3 py-2 border-b border-(--color-border) bg-(--color-surface)"
  >
    <span class="text-xs text-(--color-text-muted)"
      >已选
      <span class="font-medium text-(--color-text) tabular-nums">{{ selectedCount }}</span>
      项</span
    >
    <button
      type="button"
      class="h-7 px-2 rounded-sm text-xs inline-flex items-center gap-1 text-(--color-text-muted) hover:bg-(--color-surface-2) hover:text-(--color-text)"
      @click="onBatchDownload"
    >
      <Download :size="12" />
      下载
    </button>
    <TransferButton roundFlag size="small" />
    <CopyButton roundFlag size="small" />
    <button
      type="button"
      class="h-7 px-2 rounded-sm text-xs inline-flex items-center gap-1 text-danger hover:bg-(--color-danger-bg)/20"
      @click="onBatchDelete"
    >
      <Trash2 :size="12" />
      删除
    </button>
  </div>
</template>
