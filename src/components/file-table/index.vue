<script setup>
/**
 * AppFileTable —— 主文件列表
 * 基于 BaseTable，加悬浮行操作 + 列定义
 */
import {ref, computed, onMounted} from 'vue'
import DownloadButton from '@/components/buttons/download-button/index.vue'
import DeleteButton from '@/components/buttons/delete-button/index.vue'
import RenameButton from '@/components/buttons/rename-button/index.vue'
import CopyButton from '@/components/buttons/copy-button/index.vue'
import TransferButton from '@/components/buttons/transfer-button/index.vue'
import ShareButton from '@/components/buttons/share-button/index.vue'
import fileService from '@/api/file'
import panUtil from '@/utils/common'
import {useFileStore} from '@/stores/file'
import {useBreadcrumbStore} from '@/stores/breadcrumb'
import {storeToRefs} from 'pinia'
import {ElMessage} from '@/composables/useToast'
import {useRouter} from 'vue-router'
import ImageViewer from '@luohc92/vue3-image-viewer'
import '@luohc92/vue3-image-viewer/dist/style.css'

import BaseTable from '@/components/base/BaseTable.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import {Folder, FileText, FileArchive, FileSpreadsheet, FileImage, FileAudio, FileVideo, FileCode, FileBarChart2} from '@lucide/vue'

const router = useRouter()
const fileStore = useFileStore()
const breadcrumbStore = useBreadcrumbStore()
const {fileList, tableLoading, searchFlag} = storeToRefs(fileStore)

const selected = ref([])

const iconMap = {
  Folder, FileText, FileArchive, FileSpreadsheet,
  FileImage, FileAudio, FileVideo, FileCode, FileBarChart2,
}

function fileIcon(type) {
  return {
    0: Folder,
    2: FileArchive,
    3: FileSpreadsheet,
    4: FileText,
    5: FileText,
    6: FileText,
    7: FileImage,
    8: FileAudio,
    9: FileVideo,
    10: FileBarChart2,
    11: FileCode,
  }[type] || FileText
}

const columns = computed(() => {
  const base = [
    {key: 'filename', title: '文件名', width: 'auto'},
  ]
  if (searchFlag.value) base.push({key: 'parentFilename', title: '位置', width: 140, align: 'center'})
  base.push(
    {key: 'fileSizeDesc', title: '大小', width: 120, align: 'right'},
    {key: 'updateTime', title: '修改日期', width: 200, align: 'center'},
    {key: 'actions', title: '操作', width: 240, align: 'right'},
  )
  return base
})

function handleSelectionChange(keys) {
  const rows = fileList.value.filter((r, i) => keys.includes(r.fileId ?? i))
  fileStore.setMultipleSelection(rows)
}

function goInFolder(fileId) {
  fileService.getBreadcrumbs(
    {fileId},
    (res) => {
      fileStore.setSearchFlag(false)
      breadcrumbStore.clear()
      breadcrumbStore.reset(res.data)
      fileStore.setParentId(fileId)
      fileStore.loadFileList()
    },
    (res) => ElMessage.error(res.message),
  )
}

function openNewPage(path, name, params, query) {
  const {href} = router.resolve({path, name, params, query})
  window.open(href, '_blank')
}

function showImg(row) {
  const imgs = []
  let idx = 0
  fileList.value.forEach((f) => {
    if (f.fileType === 7) {
      imgs.push(panUtil.getPreviewUrl(f.fileId))
      if (f.fileId === row.fileId) idx = imgs.length - 1
    }
  })
  ImageViewer({
    images: imgs, curIndex: idx, zIndex: 2000, showDownload: false,
    showThumbnail: true, handlePosition: 'bottom', maskBgColor: 'rgba(0,0,0,0.7)',
  })
}

function clickFilename(row) {
  switch (row.fileType) {
    case 0: return goInFolder(panUtil.handleId(row.fileId))
    case 3: case 4: case 10: return openNewPage('/preview/office', 'PreviewOffice', {fileId: panUtil.handleId(row.fileId)})
    case 5: case 6: return openNewPage('/preview/iframe', 'PreviewIframe', {fileId: panUtil.handleId(row.fileId)})
    case 7: return showImg(row)
    case 8: return openNewPage('/preview/music', 'PreviewMusic', {fileId: panUtil.handleId(row.fileId), parentId: panUtil.handleId(row.parentId)})
    case 9: return openNewPage('/preview/video', 'PreviewVideo', {fileId: panUtil.handleId(row.fileId), parentId: panUtil.handleId(row.parentId)})
    case 11: return openNewPage('/preview/code', 'PreviewCode', {fileId: panUtil.handleId(row.fileId)}, {filename: row.filename})
  }
}

onMounted(() => fileStore.setMultipleSelection([]))
</script>

<template>
  <BaseTable
    :columns="columns"
    :data="fileList"
    :loading="tableLoading"
    selectable
    row-key="fileId"
    :selected="selected"
    @update:selected="(v) => { selected = v; handleSelectionChange(v) }"
    empty-text="该文件夹为空，试试上传文件"
  >
    <template #cell-filename="{row}">
      <button
        type="button"
        class="group flex items-center gap-3 text-left w-full"
        @click="clickFilename(row)"
      >
        <component
          :is="fileIcon(row.fileType)"
          :size="20"
          class="shrink-0 text-[var(--color-primary-500)] group-hover:text-[var(--color-primary-600)] transition-colors"
        />
        <span class="truncate text-[var(--color-text)] group-hover:text-[var(--color-primary-600)] transition-colors">
          {{ row.filename }}
        </span>
      </button>
    </template>

    <template #cell-parentFilename="{row}">
      <button
        type="button"
        class="text-[var(--color-primary-600)] hover:underline"
        @click="goInFolder(row.parentId)"
      >
        {{ row.parentFilename }}
      </button>
    </template>

    <template #cell-actions="{row}">
      <div class="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <BaseTooltip text="下载" position="top">
          <DownloadButton size="small" :item="row"/>
        </BaseTooltip>
        <BaseTooltip text="重命名" position="top">
          <RenameButton size="small" :item="row"/>
        </BaseTooltip>
        <BaseTooltip text="删除" position="top">
          <DeleteButton size="small" :item="row"/>
        </BaseTooltip>
        <BaseTooltip text="分享" position="top">
          <ShareButton size="small" :item="row"/>
        </BaseTooltip>
        <BaseTooltip text="复制到" position="top">
          <CopyButton size="small" :item="row"/>
        </BaseTooltip>
        <BaseTooltip text="移动到" position="top">
          <TransferButton size="small" :item="row"/>
        </BaseTooltip>
      </div>
    </template>
  </BaseTable>
</template>

<style scoped>
/* 让 BaseTable 内的行在 hover 时显示操作 */
:deep(tr) {
  position: relative;
}
:deep(tr:hover) .opacity-0 {
  opacity: 1;
}
</style>