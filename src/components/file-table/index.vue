<script setup>
/**
 * AppFileTable —— 主文件列表
 * P0 增强：
 * 1. 排序（name/size/date asc/desc）
 * 2. 筛选（扩展名 / 大小 / 时间）
 * 3. 批量下载（多文件下载）
 * 4. 多选 + 快捷键（Ctrl+A / Delete / F2）
 */
import {ref, computed, onMounted, onBeforeUnmount, watch, nextTick, onActivated, onDeactivated} from 'vue'
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
import DrivePreviewModal from '@/components/preview/drive-preview-modal.vue'
import FileTableToolbar from './FileTableToolbar.vue'
import FileThumbnail from './FileThumbnail.vue'
import {useTableSort} from '@/composables/useTableSort'
import {useDrivePreview} from '@/composables/useDrivePreview'
import {getDownloadUrl} from '@/utils/preview'
import {
  Folder, FileText, FileArchive, FileSpreadsheet, FileImage,
  FileAudio, FileVideo, FileCode, FileBarChart2, Loader2,
} from '@lucide/vue'

const router = useRouter()
const fileStore = useFileStore()
const breadcrumbStore = useBreadcrumbStore()
const {fileList, tableLoading, searchFlag, hasMore, isLoadingMore, total} = storeToRefs(fileStore)

const selected = ref([]) // 多选 fileId
const view = ref('list') // 'list' | 'grid'

function fileIcon(type) {
  return {
    0: Folder, 2: FileArchive, 3: FileSpreadsheet, 4: FileText,
    7: FileImage, 8: FileAudio, 9: FileVideo, 10: FileBarChart2, 11: FileCode,
  }[type] || FileText
}

// ─── 排序 / 筛选 ────────────────────────────────────────────────────────────
const {sortField, sortOrder, toggleSort, sortItems} = useTableSort('name', 'asc')
const filter = ref({extensions: [], sizeMin: '', sizeMax: '', dateFrom: '', dateTo: ''})

const filterActive = computed(() => {
  return (
    filter.value.extensions.length > 0 ||
    filter.value.sizeMin !== '' ||
    filter.value.sizeMax !== '' ||
    filter.value.dateFrom !== '' ||
    filter.value.dateTo !== ''
  )
})

// 筛选 / 排序 / 切目录时，重置选择
watch([filterActive, () => fileStore.parentId], () => {
  selected.value = []
  fileStore.setMultipleSelection([])
})

// 启用筛选 → 自动拉全量；关闭筛选 → 恢复分页
watch(filterActive, (active) => {
  if (active && !searchFlag.value) {
    fileStore.loadAllForFilter()
  } else if (!active && !searchFlag.value && fileStore.total > 0) {
    fileStore.loadFileList()
  }
})

const availableExtensions = computed(() => {
  const set = new Set()
  fileList.value.forEach((r) => {
    const fn = r.filename || r.name || ''
    const idx = fn.lastIndexOf('.')
    if (idx > 0 && idx < fn.length - 1) {
      set.add(fn.slice(idx + 1).toLowerCase())
    }
  })
  return Array.from(set).sort()
})

const filteredList = computed(() => {
  let items = fileList.value
  if (filter.value.extensions.length) {
    items = items.filter((r) => {
      const fn = r.filename || r.name || ''
      const idx = fn.lastIndexOf('.')
      if (idx <= 0) return false
      return filter.value.extensions.includes(fn.slice(idx + 1).toLowerCase())
    })
  }
  if (filter.value.sizeMin !== '') {
    const min = Number(filter.value.sizeMin) * 1024 * 1024
    items = items.filter((r) => Number(r.fileSize || r.size || 0) >= min)
  }
  if (filter.value.sizeMax !== '') {
    const max = Number(filter.value.sizeMax) * 1024 * 1024
    items = items.filter((r) => Number(r.fileSize || r.size || 0) <= max)
  }
  if (filter.value.dateFrom) {
    const from = new Date(filter.value.dateFrom).getTime()
    items = items.filter((r) => new Date(r.updateTime || r.updatedAt || 0).getTime() >= from)
  }
  if (filter.value.dateTo) {
    const to = new Date(filter.value.dateTo).getTime() + 86400000
    items = items.filter((r) => new Date(r.updateTime || r.updatedAt || 0).getTime() <= to)
  }
  return sortItems(items)
})

const selectedRows = computed(() => filteredList.value.filter((r) => selected.value.includes(r.fileId)))

const columns = computed(() => {
  const base = [{key: 'filename', title: '文件名', width: 'auto'}]
  if (searchFlag.value) base.push({key: 'parentFilename', title: '位置', width: 140, align: 'center'})
  base.push(
    {key: 'fileSizeDesc', title: '大小', width: 120, align: 'right'},
    {key: 'updateTime', title: '修改日期', width: 200, align: 'center'},
    {key: 'actions', title: '操作', width: 240, align: 'right'},
  )
  return base
})

function handleSelectionChange(keys) {
  selected.value = keys
  const rows = fileList.value.filter((r) => keys.includes(r.fileId))
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
    case 3: case 4: case 10: return openNewPage('/preview/office', 'PreviewOffice', {fileId: panUtil.handleId(row.fileId)}, {filename: row.filename})
    case 5: case 6: return openNewPage('/preview/iframe', 'PreviewIframe', {fileId: panUtil.handleId(row.fileId)}, {filename: row.filename})
    case 7: return openNewPage('/preview/image', 'PreviewImage', {fileId: panUtil.handleId(row.fileId), parentId: panUtil.handleId(row.parentId)}, {filename: row.filename})
    case 8: return openNewPage('/preview/music', 'PreviewMusic', {fileId: panUtil.handleId(row.fileId), parentId: panUtil.handleId(row.parentId)}, {filename: row.filename})
    case 9: return openNewPage('/preview/video', 'PreviewVideo', {fileId: panUtil.handleId(row.fileId), parentId: panUtil.handleId(row.parentId)}, {filename: row.filename})
    case 11: return openNewPage('/preview/code', 'PreviewCode', {fileId: panUtil.handleId(row.fileId)}, {filename: row.filename})
  }
}

function onRowClick(row) {
  // 单击：切换选中（多选）
  const id = row.fileId
  const idx = selected.value.indexOf(id)
  if (idx === -1) {
    selected.value.push(id)
  } else {
    selected.value.splice(idx, 1)
  }
  handleSelectionChange([...selected.value])
}

function onRowDblclick(row) {
  if (row.fileType === 0) {
    clickFilename(row)
    return
  }
  const opened = preview.openPreview(row)
  if (!opened) {
    clickFilename(row)
  }
}

// ─── 批量下载 ────────────────────────────────────────────────────────────────
async function batchDownload(rows) {
  if (!rows || rows.length === 0) return
  ElMessage.info(`开始下载 ${rows.length} 个文件...`)
  let ok = 0
  let failed = 0
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    try {
      const url = getDownloadUrl(r.fileId)
      const a = document.createElement('a')
      a.href = url
      a.download = r.filename || r.name || ''
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      a.remove()
      ok++
      // 间隔 200ms 避免浏览器拦截
      await new Promise((r) => setTimeout(r, 200))
    } catch {
      failed++
    }
  }
  ElMessage.success(`已下载 ${ok} 个文件${failed ? `，失败 ${failed} 个` : ''}`)
}

// ─── 批量删除 ────────────────────────────────────────────────────────────────
function batchDelete(rows) {
  if (!rows || rows.length === 0) return
  const fileIds = rows.map((r) => r.fileId).join('__,__')
  fileService.delete(
    {fileIds},
    () => {
      ElMessage.success(`已删除 ${rows.length} 个文件`)
      selected.value = []
      fileStore.loadFileList()
    },
    (err) => ElMessage.error(err.message),
  )
}

// ─── 快捷键 ────────────────────────────────────────────────────────────────
function onKeyDown(e) {
  // 跳过输入框
  const tag = e.target?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return

  // Ctrl+A: 全选
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault()
    selected.value = filteredList.value.map((r) => r.fileId)
    handleSelectionChange([...selected.value])
    return
  }
  // Delete: 删除选中
  if (e.key === 'Delete' && selected.value.length > 0) {
    e.preventDefault()
    batchDelete(selectedRows.value)
    return
  }
  // F2: 重命名第一个选中
  if (e.key === 'F2' && selected.value.length === 1) {
    e.preventDefault()
    const row = selectedRows.value[0]
    if (row) {
      // 触发 rename-button 内部逻辑（这里用 confirm 提示替代）
      const newName = prompt('重命名', row.filename || row.name || '')
      if (newName && newName !== (row.filename || row.name)) {
        fileService.update(
          {fileId: row.fileId, filename: newName},
          () => {
            ElMessage.success('重命名成功')
            fileStore.loadFileList()
          },
          (err) => ElMessage.error(err.message),
        )
      }
    }
  }
  // Escape: 清空选择
  if (e.key === 'Escape') {
    selected.value = []
    handleSelectionChange([])
  }
}

onMounted(() => {
  fileStore.setMultipleSelection([])
  window.addEventListener('keydown', onKeyDown)
  setupIntersectionObserver()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  teardownIntersectionObserver()
})

// ─── 滚动加载（P1.2） ───────────────────────────────────────────────────────
const loadMoreSentinel = ref(null)
let intersectionObserver = null

function setupIntersectionObserver() {
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && hasMore.value && !isLoadingMore.value && !filterActive.value && !searchFlag.value) {
          fileStore.loadMore()
        }
      }
    },
    {rootMargin: '200px'},
  )
  nextTick(() => {
    if (loadMoreSentinel.value) {
      intersectionObserver.observe(loadMoreSentinel.value)
    }
  })
}

function teardownIntersectionObserver() {
  if (intersectionObserver) {
    intersectionObserver.disconnect()
    intersectionObserver = null
  }
}

// 列表结构变化时重新观察 sentinel
watch([() => filteredList.value.length, hasMore], () => {
  if (!intersectionObserver) return
  nextTick(() => {
    if (loadMoreSentinel.value) {
      intersectionObserver.unobserve(loadMoreSentinel.value)
      intersectionObserver.observe(loadMoreSentinel.value)
    }
  })
})

defineExpose({setView: (v) => (view.value = v)})

// ─── 预览（弹窗式） ────────────────────────────────────────────────────────
const preview = useDrivePreview(() => fileList.value)

function previewDownload(item) {
  const url = getDownloadUrl(item.fileId || item.id)
  window.open(url, '_blank')
}
</script>

<template>
  <!-- 工具栏：排序 + 筛选 + 批量操作 -->
  <FileTableToolbar
    :selected-rows="selectedRows"
    :available-extensions="availableExtensions"
    @sort-change="() => {}"
    @filter-change="(f) => filter = f"
    @batch-download="batchDownload"
    @batch-delete="batchDelete"
  />

  <!-- 列表视图 -->
  <BaseTable
    v-if="view === 'list'"
    :columns="columns"
    :data="filteredList"
    :loading="tableLoading"
    :skeleton="tableLoading && filteredList.length === 0"
    selectable
    row-key="fileId"
    :selected="selected"
    empty-text="该文件夹为空，试试上传文件"
    @update:selected="(v) => handleSelectionChange(v)"
    @rowClick="onRowClick"
    @rowDblclick="onRowDblclick"
  >
    <template #cell-filename="{row}">
      <BaseTooltip :text="row.filename" position="top">
        <button type="button" class="group flex items-center gap-3 text-left w-full min-w-0" @click.stop="clickFilename(row)" @dblclick.stop="clickFilename(row)">
          <FileThumbnail :file="row" :size="28" rounded="rounded-md"/>
          <span class="truncate text-[var(--color-text)] group-hover:text-[var(--color-primary-600)] transition-colors">
            {{ row.filename }}
          </span>
        </button>
      </BaseTooltip>
    </template>
    <template #cell-parentFilename="{row}">
      <button type="button" class="text-[var(--color-primary-600)] hover:underline" @click="goInFolder(row.parentId)">
        {{ row.parentFilename }}
      </button>
    </template>
    <template #cell-actions="{row}">
      <div class="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <BaseTooltip text="下载" position="top"><DownloadButton size="small" :item="row"/></BaseTooltip>
        <BaseTooltip text="重命名" position="top"><RenameButton size="small" :item="row"/></BaseTooltip>
        <BaseTooltip text="删除" position="top"><DeleteButton size="small" :item="row"/></BaseTooltip>
        <BaseTooltip text="分享" position="top"><ShareButton size="small" :item="row"/></BaseTooltip>
        <BaseTooltip text="复制到" position="top"><CopyButton size="small" :item="row"/></BaseTooltip>
        <BaseTooltip text="移动到" position="top"><TransferButton size="small" :item="row"/></BaseTooltip>
      </div>
    </template>
  </BaseTable>

  <!-- 网格视图 -->
  <div v-else>
    <div v-if="tableLoading && filteredList.length === 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <div v-for="i in 8" :key="i" class="aspect-square rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 animate-pulse">
        <div class="size-12 mx-auto rounded-xl bg-[var(--color-surface-2)] mb-3"/>
        <div class="h-3 w-3/4 mx-auto rounded bg-[var(--color-surface-2)] mb-2"/>
        <div class="h-2 w-1/2 mx-auto rounded bg-[var(--color-surface-2)]"/>
      </div>
    </div>

  <!-- 加载更多 sentinel -->
    <div
      v-if="!filterActive && hasMore && filteredList.length > 0"
      ref="loadMoreSentinel"
      class="col-span-full py-6 flex items-center justify-center text-xs text-[var(--color-text-muted)]"
    >
      <Loader2 v-if="isLoadingMore" :size="14" class="animate-spin mr-2"/>
      {{ isLoadingMore ? '加载中...' : '滚动加载更多' }}
    </div>
    <div
      v-else-if="!filterActive && !hasMore && filteredList.length > 0 && total > 0"
      class="col-span-full py-6 text-center text-xs text-[var(--color-text-muted)]"
    >
      已加载全部 {{ total }} 个文件
    </div>

    <div v-else-if="filteredList.length === 0" class="text-center py-20 text-sm text-[var(--color-text-muted)]">
      <template v-if="filterActive">
        没有符合筛选条件的文件
      </template>
      <template v-else>该文件夹为空，试试上传文件</template>
    </div>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <button
        v-for="row in filteredList"
        :key="row.fileId"
        type="button"
        class="group relative aspect-square rounded-2xl border bg-[var(--color-surface)] hover:shadow-md transition-all p-4 flex flex-col items-center justify-center text-center"
        :class="selected.includes(row.fileId) ? 'border-[var(--color-primary-500)] ring-2 ring-[var(--color-primary-500)]/30' : 'border-[var(--color-border)] hover:border-[var(--color-primary-400)]'"
        @click="onRowClick(row)"
        @dblclick="onRowDblclick(row)"
      >
        <FileThumbnail :file="row" :size="64" rounded="rounded-xl" class="mb-3"/>
        <BaseTooltip :text="row.filename" position="top">
          <p class="text-sm font-medium text-[var(--color-text)] line-clamp-2 mb-1 w-full break-all">
            {{ row.filename }}
          </p>
        </BaseTooltip>
        <p class="text-xs text-[var(--color-text-muted)]">{{ row.fileSizeDesc }}</p>
      </button>
    </div>
  </div>

  <!-- 预览弹窗（参考 html5-examples DrivePreviewModal） -->
  <DrivePreviewModal
    :state="preview.state.value"
    :resolve-url="preview.resolvePreviewUrl"
    @close="preview.closePreview"
    @download="previewDownload"
  />
</template>