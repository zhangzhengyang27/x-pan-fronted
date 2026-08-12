<script setup lang="ts">
/**
 * ImgListPage —— 图片类型列表
 */
import FileButtonGroup from '@/components/file-button-group/index.vue'
import FileTable from '@/components/file-table/index.vue'
import { onMounted, ref } from 'vue'
import { useFileStore } from '@/stores/file'

const fileStore = useFileStore()

const buttonArray = ref(['upload', 'download', 'delete', 'rename', 'share', 'copy', 'transfer'])

onMounted(() => {
  fileStore.setSearchFlag(false)
  fileStore.setParentId('-1')
  fileStore.setFileTypes('7')
  fileStore.loadFileList()
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center gap-3 py-3">
      <h1 class="text-xl font-semibold tracking-tight text-[var(--color-text)]">图片</h1>
      <span class="px-2 py-0.5 rounded-full font-mono text-xs" style="background-color: var(--color-surface-container-low); color: var(--color-text-muted);">
        {{ fileStore.fileList?.length || 0 }} items
      </span>
    </div>
    <div class="flex items-center justify-between gap-4 py-3 px-3 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-low)]">
      <FileButtonGroup :button-array="buttonArray" />
    </div>
    <FileTable />
  </div>
</template>
