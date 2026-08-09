<script setup>
/**
 * AppSearch —— 全局搜索
 * 使用 BaseInput + BaseAutocomplete
 */
import {ref} from 'vue'
import userService from '@/api/user'
import fileService from '@/api/file'
import {ElMessage} from '@/composables/useToast'
import {useFileStore} from '@/stores/file'
import {useBreadcrumbStore} from '@/stores/breadcrumb'
import {useNavbarStore} from '@/stores/navbar'
import {storeToRefs} from 'pinia'
import {Search as SearchIcon} from '@lucide/vue'

import BaseInput from '@/components/base/BaseInput.vue'

const fileStore = useFileStore()
const breadcrumbStore = useBreadcrumbStore()
const navbarStore = useNavbarStore()
const {defaultParentId, defaultParentFilename} = storeToRefs(fileStore)

const searchKey = ref('')

function querySearchHistory(cb) {
  userService.searchHistories(
    (res) => cb(res.data || []),
    (res) => ElMessage.error(res.message),
  )
}

function doSearch() {
  if (!searchKey.value.trim()) return
  fileStore.setFileTypes('-1')
  fileStore.setSearchFlag(true)
  navbarStore.change('Files')
  fileStore.setSearchKey(searchKey.value)
  fileService.search(
    {keyword: searchKey.value, fileTypes: '-1'},
    (res) => {
      breadcrumbStore.clear()
      breadcrumbStore.addItem({id: defaultParentId.value, name: defaultParentFilename.value})
      breadcrumbStore.addItem({id: '-1', name: '搜索：' + searchKey.value})
      fileStore.setFileList(res.data)
    },
    (res) => ElMessage.error(res.message),
  )
}

function handleSelect(item) {
  searchKey.value = item.value
  doSearch()
}
</script>

<template>
  <div class="w-full">
    <BaseInput
      v-model="searchKey"
      placeholder="搜索文件…"
      :prefix="SearchIcon"
      clearable
      @enter="doSearch"
    />
  </div>
</template>