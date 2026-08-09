<script setup>
/**
 * DocListPage —— 文档类型列表
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
  fileStore.setFileTypes('3,4,10')
  fileStore.loadFileList()
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="py-3">
      <FileButtonGroup :button-array="buttonArray" />
    </div>
    <FileTable />
  </div>
</template>
