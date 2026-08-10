<template>
  <div class="download-button-content">
    <BaseButton
      v-if="roundFlag"
      variant="secondary"
      :size="btnSize"
      class="rounded-full"
      :loading="loading"
      @click="downloadFile"
    >
      <span class="inline-flex items-center gap-1.5">
        下载
        <Download :size="14" />
      </span>
    </BaseButton>
    <BaseButton
      v-if="circleFlag"
      variant="secondary"
      :size="btnSize"
      class="rounded-full !px-0 !w-8 !h-8 justify-center"
      :loading="loading"
      @click="downloadFile"
    >
      <Download :size="14" />
    </BaseButton>
  </div>
</template>

<script setup>
const props = defineProps({
  roundFlag: Boolean,
  circleFlag: Boolean,
  size: String,
  item: Object
})

import { computed, onBeforeUnmount, ref } from 'vue'
import { Download } from '@lucide/vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { ElMessage } from '@/composables/useToast'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'
import panUtil from '@/utils/common'
import { getToken } from '@/utils/cookie'

// BaseButton 尺寸：small → sm，default → md
const btnSize = computed(() => (props.size === 'small' ? 'sm' : 'md'))

const fileStore = useFileStore()
const { multipleSelection } = storeToRefs(fileStore)

const loading = ref(false)

const doDownload = (item) => {
  if (!item || !item.fileId) {
    ElMessage.warning('文件信息缺失，无法下载')
    return
  }
  const fileId = String(item.fileId).replace(/\+/g, '%2B')
  const filename = item.filename
  let url =
      panUtil.getUrlPrefix() + '/file/download?fileId=' + fileId + '&authorization=' + getToken(),
    link = document.createElement('a')
  link.style.display = 'none'
  link.href = url
  link.setAttribute('download', filename || 'download')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

let downloadTimer: ReturnType<typeof setTimeout> | null = null

const doDownLoads = (items, i) => {
  if (!i) {
    i = 0
  }
  if (items.length === i) {
    return
  }
  downloadTimer = setTimeout(function () {
    doDownload(items[i])
    i++
    doDownLoads(items, i)
  }, 500)
}

onBeforeUnmount(() => {
  if (downloadTimer) {
    clearTimeout(downloadTimer)
    downloadTimer = null
  }
})

const downloadFile = () => {
  if (!props.item && (!multipleSelection.value || multipleSelection.value.length === 0)) {
    ElMessage.error('请选择要下载的文件')
    return
  }
  if (!props.item) {
    for (let i = 0, iLength = multipleSelection.value.length; i < iLength; i++) {
      if (multipleSelection.value[i].folderFlag === 1) {
        ElMessage.error('文件夹暂不支持下载')
        return
      }
    }
    doDownLoads(multipleSelection.value)
  }
  if (props.item) {
    if (props.item.folderFlag === 1) {
      ElMessage.error('文件夹暂不支持下载')
      return
    }
    doDownload(props.item)
  }
}
</script>

<style scoped>
.download-button-content {
  display: inline-block;
  margin-right: 10px;
}
</style>
