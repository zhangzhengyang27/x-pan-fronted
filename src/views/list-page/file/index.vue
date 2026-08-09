<script setup>
/**
 * AppFileListPage —— 主文件列表页
 */
import {onMounted, ref} from 'vue'
import FileButtonGroup from '@/components/file-button-group/index.vue'
import Search from '@/components/search/index.vue'
import BreadCrumb from '@/components/breadcrumb/index.vue'
import FileTable from '@/components/file-table/index.vue'
import {useFileStore} from '@/stores/file'
import {useBreadcrumbStore} from '@/stores/breadcrumb'
import {storeToRefs} from 'pinia'

const fileStore = useFileStore()
const breadcrumbStore = useBreadcrumbStore()
const {searchFlag, defaultParentId, defaultParentFilename} = storeToRefs(fileStore)

const buttonArray = ref(['upload', 'createFolder', 'download', 'delete', 'rename', 'share', 'copy', 'transfer'])

onMounted(() => {
  if (!searchFlag.value) {
    const firstItem = {id: defaultParentId.value, name: defaultParentFilename.value}
    breadcrumbStore.clear()
    breadcrumbStore.addItem(firstItem)
    fileStore.refreshParentId()
    fileStore.setFileTypes('-1')
    fileStore.loadFileList()
  }
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between gap-4 py-3">
      <FileButtonGroup :button-array="buttonArray"/>
    </div>
    <BreadCrumb/>
    <FileTable/>
  </div>
</template>