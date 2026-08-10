<script setup>
/**
 * AppFileTable —— 主文件列表
 * P0 增强：
 * 1. 排序（name/size/date asc/desc）
 * 2. 筛选（扩展名 / 大小 / 时间）
 * 3. 批量下载（多文件下载）
 * 4. 多选 + 快捷键（Ctrl+A / Delete / F2）
 */
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import DownloadButton from '@/components/buttons/download-button/index.vue'
import DeleteButton from '@/components/buttons/delete-button/index.vue'
import RenameButton from '@/components/buttons/rename-button/index.vue'
import CopyButton from '@/components/buttons/copy-button/index.vue'
import TransferButton from '@/components/buttons/transfer-button/index.vue'
import ShareButton from '@/components/buttons/share-button/index.vue'
import fileService from '@/api/file'
import panUtil from '@/utils/common'
import { useFileStore } from '@/stores/file'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import { useRouter } from 'vue-router'

import BaseTable from '@/components/base/BaseTable.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import ContextMenu from '@/components/base/ContextMenu.vue'
import FolderPickerDialog from '@/components/base/FolderPickerDialog.vue'
import DrivePreviewModal from '@/components/preview/drive-preview-modal.vue'
import FileTableToolbar from './FileTableToolbar.vue'
import FileThumbnail from './FileThumbnail.vue'
import FileHistoryPanel from './FileHistoryPanel.vue'
import { useFavorites } from '@/composables/useFavorites'
import { useRecent } from '@/composables/useRecent'
import { useDrivePreview } from '@/composables/useDrivePreview'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { getDownloadUrl } from '@/utils/preview'
import {
  LoaderCircle,
  Download,
  Edit3,
  Copy,
  Trash2,
  Share2,
  FolderInput,
  Star,
  Eye,
  History
} from '@lucide/vue'

const router = useRouter()
const fileStore = useFileStore()
const breadcrumbStore = useBreadcrumbStore()
const { fileList, tableLoading, searchFlag, hasMore, isLoadingMore, total } = storeToRefs(fileStore)

const selected = ref([]) // 多选 fileId
const view = ref('list') // 'list' | 'grid'
const isMobile = useMediaQuery('(max-width: 768px)')

// ─── 移动/复制对话框（占位 → 真实 FolderPickerDialog） ─────────────────
const moveDialog = ref({ open: false, mode: 'move', row: null })

function openMoveDialog(row) {
  moveDialog.value = { open: true, mode: 'move', row: row || null }
}

function onMoveComplete() {
  ElMessage.success('已移动到目标文件夹')
  moveDialog.value.open = false
  fileStore.loadFileList()
}

// ─── 排序 / 筛选 ────────────────────────────────────────────────────────────
// 排序状态提升到 fileStore，与 FileTableToolbar 共享
const filter = ref({ extensions: [], sizeMin: '', sizeMax: '', dateFrom: '', dateTo: '' })

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
  return fileStore.sortItems(items)
})

const selectedRows = computed(() =>
  filteredList.value.filter((r) => selected.value.includes(r.fileId))
)

const columns = computed(() => {
  const base = [{ key: 'filename', title: '文件名', width: 'auto' }]
  if (searchFlag.value)
    base.push({ key: 'parentFilename', title: '位置', width: 140, align: 'center' })
  base.push(
    { key: 'fileSizeDesc', title: '大小', width: 120, align: 'right' },
    { key: 'updateTime', title: '修改日期', width: 200, align: 'center' },
    { key: 'actions', title: '操作', width: 240, align: 'right' }
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
    { fileId },
    (res) => {
      fileStore.setSearchFlag(false)
      breadcrumbStore.clear()
      breadcrumbStore.reset(res.data)
      fileStore.setParentId(fileId)
      fileStore.loadFileList()
    },
    (res) => ElMessage.error(res.message)
  )
}

function openNewPage(path, name, params, query) {
  const { href } = router.resolve({ path, name, params, query })
  window.open(href, '_blank')
}

function clickFilename(row) {
  switch (row.fileType) {
    case 0:
      return goInFolder(panUtil.handleId(row.fileId))
    case 3:
    case 4:
    case 10:
      return openNewPage(
        '/preview/office',
        'PreviewOffice',
        { fileId: panUtil.handleId(row.fileId) },
        { filename: row.filename }
      )
    case 5:
    case 6:
      return openNewPage(
        '/preview/iframe',
        'PreviewIframe',
        { fileId: panUtil.handleId(row.fileId) },
        { filename: row.filename }
      )
    case 7:
      return openNewPage(
        '/preview/image',
        'PreviewImage',
        { fileId: panUtil.handleId(row.fileId), parentId: panUtil.handleId(row.parentId) },
        { filename: row.filename }
      )
    case 8:
      return openNewPage(
        '/preview/music',
        'PreviewMusic',
        { fileId: panUtil.handleId(row.fileId), parentId: panUtil.handleId(row.parentId) },
        { filename: row.filename }
      )
    case 9:
      return openNewPage(
        '/preview/video',
        'PreviewVideo',
        { fileId: panUtil.handleId(row.fileId), parentId: panUtil.handleId(row.parentId) },
        { filename: row.filename }
      )
    case 11:
      return openNewPage(
        '/preview/code',
        'PreviewCode',
        { fileId: panUtil.handleId(row.fileId) },
        { filename: row.filename }
      )
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

// ─── 批量下载 ────────────────────────────────────────────────────────────────
async function batchDownload(rows) {
  if (!rows || rows.length === 0) return

  // 单文件 → 走单个下载
  if (rows.length === 1) {
    const r = rows[0]
    const url = getDownloadUrl(r.fileId)
    const a = document.createElement('a')
    a.href = url
    a.download = r.filename || r.name || ''
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
    return
  }

  // 多文件 → 后端 zip 打包下载（P1.7）
  ElMessage.info(`正在打包 ${rows.length} 个文件...`)
  const fileIds = rows.map((r) => r.fileId).join('__,__')
  fileService.archiveDownload(
    { fileIds },
    (res) => {
      // res 是 Blob
      const blob =
        res instanceof Blob ? res : new Blob([res.data || res], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `xpan-files-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
      ElMessage.success(`已下载 ${rows.length} 个文件（zip 打包）`)
    },
    (err) => {
      ElMessage.error(err.message || '打包下载失败')
    }
  )
}

// ─── 批量删除 ────────────────────────────────────────────────────────────────
function batchDelete(rows) {
  if (!rows || rows.length === 0) return
  const fileIds = rows.map((r) => r.fileId).join('__,__')
  fileService.delete(
    { fileIds },
    () => {
      ElMessage.success(`已删除 ${rows.length} 个文件`)
      selected.value = []
      fileStore.loadFileList()
    },
    (err) => ElMessage.error(err.message)
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
      // 重用 promptRename，复用 ElMessageBox.prompt 统一体验
      promptRename(row)
    }
  }
  // Escape: 清空选择
  if (e.key === 'Escape') {
    selected.value = []
    handleSelectionChange([])
  }
}

// 移动端强制网格视图
watch(
  isMobile,
  (v) => {
    if (v) view.value = 'grid'
  },
  { immediate: true }
)

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
        if (
          entry.isIntersecting &&
          hasMore.value &&
          !isLoadingMore.value &&
          !filterActive.value &&
          !searchFlag.value
        ) {
          fileStore.loadMore()
        }
      }
    },
    { rootMargin: '200px' }
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

defineExpose({ setView: (v) => (view.value = v) })

// ─── 预览（弹窗式） ────────────────────────────────────────────────────────
const preview = useDrivePreview(() => fileList.value)

// ─── 收藏 / 最近访问（P1.9） ───────────────────────────────────────────────
const { isFavorite, toggle: toggleFavorite } = useFavorites()
const { visit: visitRecent } = useRecent()

function onRowDblclick(row) {
  visitRecent(row) // 记录最近访问
  if (row.fileType === 0) {
    clickFilename(row)
    return
  }
  const opened = preview.openPreview(row)
  if (!opened) {
    clickFilename(row)
  }
}

function previewDownload(item) {
  const url = getDownloadUrl(item.fileId || item.id)
  window.open(url, '_blank')
}

// ─── 右键菜单（P1.12） ────────────────────────────────────────────────────
const ctxMenu = ref({ visible: false, x: 0, y: 0, row: null })

// ─── 版本历史（P1.13） ────────────────────────────────────────────────────
const historyPanel = ref({ open: false, fileId: null })

function openHistory(row) {
  historyPanel.value = { open: true, fileId: panUtil.handleId(row.fileId) }
}

function onContextMenu(e, row) {
  e.preventDefault()
  // 若未选中右键目标，且当前右键的不是已选中的，加入选择
  if (row && !selected.value.includes(row.fileId)) {
    selected.value = [row.fileId]
    handleSelectionChange([row.fileId])
  }
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, row }
}

function closeCtxMenu() {
  ctxMenu.value.visible = false
}

const ctxItems = computed(() => {
  const r = ctxMenu.value.row
  if (!r) return []
  const isFolder = r.fileType === 0
  const favorited = isFavorite(r.fileId)
  const isMulti = selectedRows.value.length > 1
  return [
    {
      key: 'open',
      label: isFolder ? '打开' : '预览',
      icon: Eye,
      shortcut: 'Enter',
      action: () => (isFolder ? goInFolder(panUtil.handleId(r.fileId)) : onRowDblclick(r))
    },
    { divider: true },
    {
      key: 'download',
      label: isMulti ? `下载 ${selectedRows.value.length} 项` : '下载',
      icon: Download,
      shortcut: 'Ctrl+D',
      disabled: isFolder,
      action: () => batchDownload(selectedRows.value.length ? selectedRows.value : [r])
    },
    {
      key: 'rename',
      label: '重命名',
      icon: Edit3,
      shortcut: 'F2',
      disabled: isMulti,
      action: () => promptRename(r)
    },
    {
      key: 'copy',
      label: '复制到...',
      icon: Copy,
      shortcut: 'Ctrl+C',
      action: () => {
        // 复用移动对话框，mode 改为 copy
        moveDialog.value = {
          open: true,
          mode: 'copy',
          row: selectedRows.value.length ? selectedRows.value : [r]
        }
      }
    },
    {
      key: 'move',
      label: '移动到...',
      icon: FolderInput,
      action: () => openMoveDialog(selectedRows.value.length ? selectedRows.value : [r])
    },
    {
      key: 'share',
      label: '分享',
      icon: Share2,
      disabled: isMulti,
      action: () => ElMessage.info('分享功能：请点击工具栏的"分享"按钮')
    },
    { divider: true },
    {
      key: 'history',
      label: '查看历史版本',
      icon: History,
      disabled: isFolder,
      action: () => openHistory(r)
    },
    {
      key: 'favorite',
      label: favorited ? '取消收藏' : '收藏',
      icon: Star,
      action: () => toggleFavorite(r)
    },
    { divider: true },
    {
      key: 'delete',
      label: isMulti ? `删除 ${selectedRows.value.length} 项` : '删除',
      icon: Trash2,
      shortcut: 'Del',
      danger: true,
      action: () => batchDelete(selectedRows.value.length ? selectedRows.value : [r])
    }
  ]
})

function onCtxSelect(item) {
  if (item && typeof item.action === 'function') item.action()
}

/**
 * 重命名交互：使用 ElMessageBox.prompt（与项目其它确认对话框统一）
 */
async function promptRename(row) {
  const oldName = row.filename || row.name || ''
  try {
    const { value: newName } = await ElMessageBox.prompt('请输入新的文件名', '重命名', {
      inputValue: oldName,
      inputValidator: (val) =>
        (val && val.trim() && val !== oldName) || '文件名不能为空或与原名相同',
      confirmButtonText: '确认',
      cancelButtonText: '取消'
    })
    if (!newName) return
    fileService.update(
      { fileId: row.fileId, filename: newName.trim() },
      () => {
        ElMessage.success('重命名成功')
        fileStore.loadFileList()
      },
      (err) => ElMessage.error(err.message)
    )
  } catch {
    // 用户点取消
  }
}
</script>

<template>
  <!-- 工具栏：排序 + 筛选 + 批量操作 -->
  <FileTableToolbar
    :selected-rows="selectedRows"
    :available-extensions="availableExtensions"
    @sort-change="() => {}"
    @filter-change="(f) => (filter = f)"
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
    @rowContextmenu="(e, row) => onContextMenu(e, row)"
  >
    <template #cell-filename="{ row }">
      <BaseTooltip :text="row.filename" position="top">
        <button
          type="button"
          class="group flex items-center gap-3 text-left w-full min-w-0"
          @click.stop="clickFilename(row)"
          @dblclick.stop="clickFilename(row)"
        >
          <FileThumbnail :file="row" :size="28" rounded="rounded-md" />
          <span
            class="truncate text-[var(--color-text)] group-hover:text-[var(--color-primary-600)] transition-colors"
          >
            {{ row.filename }}
          </span>
        </button>
      </BaseTooltip>
    </template>
    <template #cell-parentFilename="{ row }">
      <button
        type="button"
        class="text-[var(--color-primary-600)] hover:underline"
        @click="goInFolder(row.parentId)"
      >
        {{ row.parentFilename }}
      </button>
    </template>
    <template #cell-actions="{ row }">
      <div
        class="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <button
          type="button"
          class="size-7 rounded-md flex items-center justify-center transition-colors"
          :class="
            isFavorite(row.fileId)
              ? 'text-amber-500 hover:bg-amber-50'
              : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'
          "
          :title="isFavorite(row.fileId) ? '取消收藏' : '收藏'"
          @click="toggleFavorite(row)"
        >
          <svg
            viewBox="0 0 24 24"
            :fill="isFavorite(row.fileId) ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="2"
            class="size-4"
          >
            <polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
            />
          </svg>
        </button>
        <BaseTooltip text="下载" position="top"
          ><DownloadButton size="small" :item="row"
        /></BaseTooltip>
        <BaseTooltip text="重命名" position="top"
          ><RenameButton size="small" :item="row"
        /></BaseTooltip>
        <BaseTooltip text="删除" position="top"
          ><DeleteButton size="small" :item="row"
        /></BaseTooltip>
        <BaseTooltip text="分享" position="top"
          ><ShareButton size="small" :item="row"
        /></BaseTooltip>
        <BaseTooltip text="复制到" position="top"
          ><CopyButton size="small" :item="row"
        /></BaseTooltip>
        <BaseTooltip text="移动到" position="top"
          ><TransferButton size="small" :item="row"
        /></BaseTooltip>
      </div>
    </template>
  </BaseTable>

  <!-- 网格视图 -->
  <div v-else>
    <div
      v-if="tableLoading && filteredList.length === 0"
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
    >
      <div
        v-for="i in 8"
        :key="i"
        class="aspect-square rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 animate-pulse"
      >
        <div class="size-12 mx-auto rounded-xl bg-[var(--color-surface-2)] mb-3" />
        <div class="h-3 w-3/4 mx-auto rounded bg-[var(--color-surface-2)] mb-2" />
        <div class="h-2 w-1/2 mx-auto rounded bg-[var(--color-surface-2)]" />
      </div>
    </div>

    <!-- 加载更多 sentinel -->
    <div
      v-if="!filterActive && hasMore && filteredList.length > 0"
      ref="loadMoreSentinel"
      class="col-span-full py-6 flex items-center justify-center text-xs text-[var(--color-text-muted)]"
    >
      <LoaderCircle v-if="isLoadingMore" :size="14" class="animate-spin mr-2" />
      {{ isLoadingMore ? '加载中...' : '滚动加载更多' }}
    </div>
    <div
      v-else-if="!filterActive && !hasMore && filteredList.length > 0 && total > 0"
      class="col-span-full py-6 text-center text-xs text-[var(--color-text-muted)]"
    >
      已加载全部 {{ total }} 个文件
    </div>

    <div
      v-else-if="filteredList.length === 0"
      class="text-center py-20 text-sm text-[var(--color-text-muted)]"
    >
      <template v-if="filterActive"> 没有符合筛选条件的文件 </template>
      <template v-else>该文件夹为空，试试上传文件</template>
    </div>

    <div
      v-else
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
    >
      <button
        v-for="row in filteredList"
        :key="row.fileId"
        type="button"
        class="group relative aspect-square rounded-2xl border bg-[var(--color-surface)] hover:shadow-md transition-all p-4 flex flex-col items-center justify-center text-center"
        :class="
          selected.includes(row.fileId)
            ? 'border-[var(--color-primary-500)] ring-2 ring-[var(--color-primary-500)]/30'
            : 'border-[var(--color-border)] hover:border-[var(--color-primary-400)]'
        "
        @click="onRowClick(row)"
        @dblclick="onRowDblclick(row)"
        @contextmenu="onContextMenu($event, row)"
      >
        <FileThumbnail :file="row" :size="64" rounded="rounded-xl" class="mb-3" />
        <BaseTooltip :text="row.filename" position="top">
          <p
            class="text-sm font-medium text-[var(--color-text)] line-clamp-2 mb-1 w-full break-all"
          >
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

  <!-- P1.12：右键菜单 -->
  <ContextMenu
    :visible="ctxMenu.visible"
    :x="ctxMenu.x"
    :y="ctxMenu.y"
    :items="ctxItems"
    @select="onCtxSelect"
    @close="closeCtxMenu"
  />

  <!-- P1.13：版本历史弹窗 -->
  <FileHistoryPanel
    :file-id="historyPanel.fileId"
    :open="historyPanel.open"
    @update:open="(v) => (historyPanel.open = v)"
    @rolled-back="fileStore.loadFileList()"
  />

  <!-- P1.12：移动/复制对话框 -->
  <FolderPickerDialog
    v-if="moveDialog.open"
    :open="moveDialog.open"
    :mode="moveDialog.mode"
    :row="moveDialog.row"
    @update:open="(v) => (moveDialog.open = v)"
    @complete="onMoveComplete"
  />
</template>
