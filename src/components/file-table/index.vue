<script setup lang="ts">
/**
 * AppFileTable —— 主文件列表 (Redesign v2)
 * 变化:工具栏/操作按钮移至详情面板,本组件专注列表/网格/筛选/排序/选择
 */
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import fileService from '@/api/file'
import panUtil from '@/utils/common'
import { useFileStore } from '@/stores/file'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import { useRouter } from 'vue-router'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import ContextMenu from '@/components/base/ContextMenu.vue'
import FolderPickerDialog from '@/components/base/FolderPickerDialog.vue'
import FileTableToolbar from './FileTableToolbar.vue'
import FileThumbnail from './FileThumbnail.vue'
import { useFavorites } from '@/composables/useFavorites'
import { useRecent } from '@/composables/useRecent'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { useFileTags } from '@/composables/useFileTags'
import { getDownloadUrl } from '@/utils/preview'
import {
  LoaderCircle,
  Download,
  Trash2,
  Star,
  SearchX,
  FolderOpen,
  Edit2,
  History,
  Shield,
  Share2,
  QrCode
} from '@lucide/vue'
import QRCode from 'qrcode'
import shareService from '@/api/share'
import vaultService from '@/api/vault'
import { FileType } from '@/types'

const props = withDefaults(
  defineProps<{
    view?: 'list' | 'grid'
  }>(),
  { view: 'list' }
)

const router = useRouter()
const fileStore = useFileStore()
const breadcrumbStore = useBreadcrumbStore()
const { fileList, tableLoading, searchFlag, hasMore, isLoadingMore, total, sortProp, sortOrder } =
  storeToRefs(fileStore)

const selected = ref<string[]>([]) // 多选 fileId
const isMobile = useMediaQuery('(max-width: 768px)').matches
const currentView = ref(props.view)

// 外部传入 view 变化时同步
watch(() => props.view, (v) => { if (v) currentView.value = v })

// ─── 排序 / 筛选（均交由后端处理） ─────────────────────────────────────────
const filter = ref({
  extensions: [] as string[],
  fileTypes: [] as FileType[],
  sizeMin: '',
  sizeMax: '',
  dateFrom: '',
  dateTo: ''
})

const filterActive = computed(() => filter.value.fileTypes.length > 0)

// 筛选变化：把所选文件类型映射为后端 fileTypes 字符串并重新加载
watch(filterActive, (active) => {
  if (!searchFlag.value) {
    const types = active ? filter.value.fileTypes.join(',') : '-1'
    fileStore.setFileTypes(types)
    fileStore.loadFileList()
  }
})

// 排序变化：直接重新加载（后端按 orderBy/order 返回）
watch([sortProp, sortOrder], () => {
  if (!searchFlag.value) fileStore.loadFileList()
})

// 列表数据直接来自 store（后端已完成排序与类型筛选）
const filteredList = computed(() => fileList.value)

// 重置选择:筛选/目录/排序变化
watch([filterActive, () => fileStore.parentId], () => {
  selected.value = []
  fileStore.setMultipleSelection([])
})

function applyFilter(f: typeof filter.value) {
  filter.value = { ...f }
}

// 暴露方法给父组件
defineExpose({ applyFilter, setView: (v: string) => { currentView.value = v } })

const selectedRows = computed(() =>
  filteredList.value.filter((r) => selected.value.includes(r.fileId))
)

const selectedCount = computed(() => selected.value.length)

const columns = computed(() => {
  const base = [{ key: 'filename', title: '文件名', width: 'auto' }]
  if (searchFlag.value)
    base.push({ key: 'parentFilename', title: '位置', width: 140, align: 'center' })
  base.push(
    { key: 'fileSizeDesc', title: '大小', width: 120, align: 'right' },
    { key: 'updateTime', title: '修改日期', width: 200, align: 'center' }
  )
  return base
})

function handleSelectionChange(keys: string[]) {
  selected.value = keys
  const rows = fileList.value.filter((r) => keys.includes(r.fileId))
  fileStore.setMultipleSelection(rows)
}

// ─── 点击文件名 ────────────────────────────────────────────────────────────
function goInFolder(fileId: string) {
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

function openNewPage(path: string, name: string, params: Record<string, string>, query: Record<string, string>) {
  const { href } = router.resolve({ path, name, params, query })
  window.open(href, '_blank')
}

function clickFilename(row: Record<string, any>) {
  switch (row.fileType) {
    case 0:
      return goInFolder(panUtil.handleId(row.fileId))
    case 3:
    case 4:
    case 10:
      return openNewPage('/preview/office', 'PreviewOffice', { fileId: panUtil.handleId(row.fileId) }, { filename: row.filename })
    case 5:
    case 6:
      return openNewPage('/preview/iframe', 'PreviewIframe', { fileId: panUtil.handleId(row.fileId) }, { filename: row.filename })
    case 7:
      return openNewPage('/preview/image', 'PreviewImage', { fileId: panUtil.handleId(row.fileId), parentId: panUtil.handleId(row.parentId) }, { filename: row.filename })
    case 8:
      return openNewPage('/preview/music', 'PreviewMusic', { fileId: panUtil.handleId(row.fileId), parentId: panUtil.handleId(row.parentId) }, { filename: row.filename })
    case 9:
      return openNewPage('/preview/video', 'PreviewVideo', { fileId: panUtil.handleId(row.fileId), parentId: panUtil.handleId(row.parentId) }, { filename: row.filename })
    case 11:
      return openNewPage('/preview/code', 'PreviewCode', { fileId: panUtil.handleId(row.fileId) }, { filename: row.filename })
  }
}

// ─── 行点击(单选) ─────────────────────────────────────────────────────────
function onRowClick(row: Record<string, any>) {
  const id = row.fileId
  const idx = selected.value.indexOf(id)
  if (idx === -1) {
    selected.value = [id]
  } else {
    selected.value = []
  }
  handleSelectionChange([...selected.value])
}

// ─── 行双击 ───────────────────────────────────────────────────────────────
const { visit: visitRecent } = useRecent()

function onRowDblclick(row: Record<string, any>) {
  visitRecent(row)
  clickFilename(row)
}

// ─── 批量下载 ────────────────────────────────────────────────────────────────
async function batchDownload(rows: Record<string, any>[]) {
  if (!rows?.length) return
  if (rows.length === 1) {
    const r = rows[0]
    const url = getDownloadUrl(r.fileId)
    const a = document.createElement('a')
    a.href = url
    a.download = r.filename || r.name || ''
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    a.remove()
    return
  }
  ElMessage.info(`正在打包 ${rows.length} 个文件...`)
  const fileIds = rows.map((r) => r.fileId).join('__,__')
  fileService.archiveDownload(
    { fileIds },
    (res) => {
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
    (err) => ElMessage.error(err.message || '打包下载失败')
  )
}

// ─── 批量删除 ────────────────────────────────────────────────────────────────
function batchDelete(rows: Record<string, any>[]) {
  if (!rows?.length) return
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
function onKeyDown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return

  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault()
    selected.value = filteredList.value.map((r) => r.fileId)
    handleSelectionChange([...selected.value])
    return
  }
  if (e.key === 'Delete' && selected.value.length > 0) {
    e.preventDefault()
    batchDelete(selectedRows.value)
    return
  }
  if (e.key === 'Escape') {
    selected.value = []
    handleSelectionChange([])
  }
}

// ─── 滚动加载 ───────────────────────────────────────────────────────────────
const loadMoreSentinel = ref<HTMLElement | null>(null)
let intersectionObserver: IntersectionObserver | null = null

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
      intersectionObserver!.observe(loadMoreSentinel.value)
    }
  })
}

function teardownIntersectionObserver() {
  if (intersectionObserver) {
    intersectionObserver.disconnect()
    intersectionObserver = null
  }
}

watch([() => filteredList.value.length, hasMore], () => {
  if (!intersectionObserver) return
  nextTick(() => {
    if (loadMoreSentinel.value) {
      intersectionObserver!.unobserve(loadMoreSentinel.value)
      intersectionObserver!.observe(loadMoreSentinel.value)
    }
  })
})

// ─── 框选 ──────────────────────────────────────────────────────────────────
const selBox = ref({ active: false, x1: 0, y1: 0, x2: 0, y2: 0 })
const selContainer = ref<HTMLElement | null>(null)

function onSelStart(e: MouseEvent) {
  if (e.button !== 0) return
  const t = e.target as HTMLElement
  if (t.closest('[data-file-id]')) return
  if (t.closest('button, input, a, [contenteditable]')) return
  if (!selContainer.value) return

  const rect = selContainer.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  selBox.value = { active: true, x1: x, y1: y, x2: x, y2: y }

  if (!e.shiftKey && selected.value.length > 0) {
    selected.value = []
    handleSelectionChange([])
  }

  const onMove = (ev: MouseEvent) => {
    if (!selBox.value.active) return
    selBox.value.x2 = ev.clientX - rect.left
    selBox.value.y2 = ev.clientY - rect.top
    updateSelFromBox()
  }
  const onUp = () => {
    selBox.value.active = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function updateSelFromBox() {
  if (!selContainer.value) return
  const b = selBox.value
  const left = Math.min(b.x1, b.x2)
  const right = Math.max(b.x1, b.x2)
  const top = Math.min(b.y1, b.y2)
  const bottom = Math.max(b.y1, b.y2)
  if (right - left < 4 && bottom - top < 4) return

  const containerRect = selContainer.value.getBoundingClientRect()
  const cards = selContainer.value.querySelectorAll('[data-file-id]')
  const hitIds: string[] = []
  cards.forEach((card) => {
    const r = (card as HTMLElement).getBoundingClientRect()
    const cx = r.left - containerRect.left
    const cy = r.top - containerRect.top
    if (cx < right && cx + r.width > left && cy < bottom && cy + r.height > top) {
      hitIds.push((card as HTMLElement).dataset.fileId as string)
    }
  })
  const matched = filteredList.value.filter((r) => hitIds.includes(String(r.fileId)))
  if (matched.length > 0) {
    selected.value = matched.map((r) => r.fileId)
    handleSelectionChange([...selected.value])
  }
}

const selBoxStyle = computed(() => {
  const b = selBox.value
  if (!b.active) return { display: 'none' }
  return {
    left: Math.min(b.x1, b.x2) + 'px',
    top: Math.min(b.y1, b.y2) + 'px',
    width: Math.abs(b.x2 - b.x1) + 'px',
    height: Math.abs(b.y2 - b.y1) + 'px'
  }
})

// ─── 收藏 ─────────────────────────────────────────────────────────────────
const { isFavorite, toggle: toggleFavorite } = useFavorites()

// ─── 移动/复制对话框 ──────────────────────────────────────────────────────
const moveDialog = ref({ open: false, mode: 'move' as 'move' | 'copy', row: null as any })

function openMoveDialog(rows: any[]) {
  moveDialog.value = { open: true, mode: 'move', row: rows || null }
}

function onMoveComplete() {
  ElMessage.success('已移动到目标文件夹')
  moveDialog.value.open = false
  fileStore.loadFileList()
}

// ─── 右键菜单 ──────────────────────────────────────────────────────────────
const ctxMenu = ref({ visible: false, x: 0, y: 0, row: null as any })

function onContextMenu(e: MouseEvent, row: any) {
  e.preventDefault()
  if (row && !selected.value.includes(row.fileId)) {
    selected.value = [row.fileId]
    handleSelectionChange([row.fileId])
  }
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, row }
}

function closeCtxMenu() {
  ctxMenu.value.visible = false
}

function onCtxSelect(item: any) {
  if (item && typeof item.action === 'function') item.action()
}

const ctxItems = computed(() => {
  const r = ctxMenu.value.row
  if (!r) return []
  const isFolder = r.fileType === 0
  const isMulti = selectedRows.value.length > 1
  const multiRows = selectedRows.value.length ? selectedRows.value : [r]

  return [
    {
      key: 'open',
      label: isFolder ? '打开' : '预览',
      shortcut: 'Enter',
      action: () => (isFolder ? goInFolder(panUtil.handleId(r.fileId)) : onRowDblclick(r))
    },
    {
      key: 'download',
      label: isMulti ? `下载 ${selectedRows.value.length} 项` : '下载',
      icon: Download,
      shortcut: 'Ctrl+D',
      disabled: isFolder,
      action: () => batchDownload(multiRows)
    },
    {
      key: 'rename',
      label: isMulti ? `批量重命名 ${selectedRows.value.length} 项` : '重命名',
      icon: Edit2,
      shortcut: 'F2',
      action: () => {
        if (isMulti) batchRename(selectedRows.value)
        else promptRename(r)
      }
    },
    {
      key: 'copy',
      label: '复制到...',
      action: () => { moveDialog.value = { open: true, mode: 'copy', row: multiRows } }
    },
    {
      key: 'move',
      label: '移动到...',
      action: () => openMoveDialog(multiRows)
    },
    {
      key: 'share',
      label: '分享',
      icon: Share2,
      disabled: isFolder,
      action: () => shareWithQRCode(r)
    },
    {
      divider: true
    },
    {
      key: 'favorite',
      label: isFavorite(r.fileId) ? '取消收藏' : '收藏',
      icon: Star,
      action: () => toggleFavorite(r)
    },
    {
      key: 'delete',
      label: isMulti ? `删除 ${selectedRows.value.length} 项` : '删除',
      icon: Trash2,
      shortcut: 'Del',
      danger: true,
      action: () => batchDelete(multiRows)
    }
  ].filter((item) => item.visible !== false)
})

// ─── 重命名 ────────────────────────────────────────────────────────────────
async function promptRename(row: any) {
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
    // 取消
  }
}

async function batchRename(rows: Record<string, any>[]) {
  if (!rows?.length) return
  const base = rows[0].filename || rows[0].name || 'file'
  const dotIdx = base.lastIndexOf('.')
  const baseName = dotIdx > 0 ? base.slice(0, dotIdx) : base
  const ext = dotIdx > 0 ? base.slice(dotIdx) : ''

  try {
    const { value } = await ElMessageBox.prompt(
      `将对 ${rows.length} 个文件批量重命名，自动添加序号 (1)(2)...`,
      '批量重命名',
      {
        inputValue: baseName,
        inputValidator: (val) => (val && val.trim()) || '名称不能为空',
        confirmButtonText: '确认',
        cancelButtonText: '取消'
      }
    )
    if (!value) return

    let successCount = 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const dot = (row.filename || row.name || '').lastIndexOf('.')
      const e = dot > 0 ? (row.filename || row.name || '').slice(dot) : ''
      const newName = `${value.trim()}(${i + 1})${e}`
      await new Promise((resolve) => {
        fileService.update(
          { fileId: row.fileId, filename: newName },
          () => { successCount++; resolve(true) },
          () => resolve(false)
        )
      })
    }
    ElMessage.success(`批量重命名完成，成功 ${successCount}/${rows.length} 个`)
    fileStore.loadFileList()
  } catch {
    // 取消
  }
}

// ─── 分享 ──────────────────────────────────────────────────────────────────
async function shareWithQRCode(row: any) {
  try {
    shareService.createShare(
      { fileId: row.fileId },
      (res) => {
        const shareId = res.data?.shareId || res.data
        const url = window.location.origin + '/share/' + shareId
        showQRModal(url, row.filename || row.name || '分享')
      },
      () => ElMessage.error('创建分享失败')
    )
  } catch {
    ElMessage.error('分享失败')
  }
}

async function showQRModal(url: string, title: string) {
  try {
    const qrDataUrl = await QRCode.toDataURL(url, { width: 220, margin: 2 })
    const modal = document.createElement('div')
    modal.style.cssText =
      'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);'
    modal.innerHTML = `
      <div style="background:var(--color-surface);border-radius:20px;padding:28px;max-width:340px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.25);width:90%;">
        <p style="font-size:16px;font-weight:600;margin:0 0 4px;color:var(--color-text);">${title}</p>
        <p style="font-size:12px;color:var(--color-text-muted);margin:0 0 20px;">扫码获取分享链接</p>
        <img src="${qrDataUrl}" width="220" height="220" style="border-radius:12px;display:block;margin:0 auto;" />
        <p style="font-size:11px;color:var(--color-text-muted);margin:16px 0 0;word-break:break-all;line-height:1.5;">${url}</p>
        <button style="margin-top:20px;padding:10px 32px;background:var(--color-primary-500);color:#fff;border:none;border-radius:12px;cursor:pointer;font-size:14px;font-weight:500;">关闭</button>
      </div>
    `
    modal.querySelector('button')!.onclick = () => modal.remove()
    modal.onclick = (e) => { if (e.target === modal) modal.remove() }
    document.body.appendChild(modal)
  } catch {
    ElMessage.error('二维码生成失败')
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
</script>

<template>
  <div class="h-full flex flex-col">

    <!-- 工具栏:批量操作(列表视图上方) -->
    <FileTableToolbar
      v-if="selectedCount > 0"
      :selected-rows="selectedRows"
      @batch-download="batchDownload"
      @batch-delete="batchDelete"
    />

    <!-- 列表视图 -->
    <BaseTable
      v-if="currentView === 'list'"
      :columns="columns"
      :data="filteredList"
      :loading="tableLoading"
      :skeleton="tableLoading && filteredList.length === 0"
      selectable
      row-key="fileId"
      :selected="selected"
      empty-text="该文件夹为空，试试上传文件"
      :sort-field="sortProp"
      :sort-order="sortOrder"
      @update:selected="(v: string[]) => handleSelectionChange(v)"
      @rowClick="onRowClick"
      @rowDblclick="onRowDblclick"
      @rowContextmenu="(e: MouseEvent, row: any) => onContextMenu(e, row)"
    >
      <template #cell-filename="{ row }">
        <BaseTooltip :text="row.filename" position="top">
          <button
            type="button"
            class="group flex items-center gap-3 text-left w-full min-w-0"
            @click.stop="clickFilename(row)"
            @dblclick.stop="clickFilename(row)"
          >
            <FileThumbnail :file="row" :size="32" rounded="rounded-sm" />
            <span
              class="truncate text-sm text-[var(--color-text)] group-hover:text-[var(--color-primary-600)] transition-colors"
            >
              {{ row.filename }}
            </span>
          </button>
        </BaseTooltip>
      </template>

      <template #cell-parentFilename="{ row }">
        <button
          type="button"
          class="text-xs text-[var(--color-primary-500)] hover:underline"
          @click="goInFolder(row.parentId)"
        >
          {{ row.parentFilename }}
        </button>
      </template>

      <template #empty>
        <BaseEmpty
          :icon="filterActive ? SearchX : FolderOpen"
          :title="filterActive ? '没有符合筛选条件的文件' : '该文件夹为空'"
          :description="filterActive ? '试着调整筛选条件或清除筛选' : '将文件拖拽到此处，或点击上方按钮添加文件'"
        />
      </template>
    </BaseTable>

    <!-- 网格视图 -->
    <div v-else class="flex-1 min-h-0 overflow-y-auto px-1 pb-4">
      <!-- 骨架屏 -->
      <div
        v-if="tableLoading && filteredList.length === 0"
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-1"
      >
        <div
          v-for="i in 12"
          :key="i"
          class="aspect-square rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-4 animate-pulse flex flex-col items-center justify-center gap-2"
        >
          <div class="size-14 rounded-sm bg-[var(--color-surface-2)]" />
          <div class="h-3 w-3/4 rounded bg-[var(--color-surface-2)]" />
        </div>
      </div>

      <!-- 空状态 -->
      <BaseEmpty
        v-else-if="filteredList.length === 0"
        :icon="filterActive ? SearchX : FolderOpen"
        :title="filterActive ? '没有符合筛选条件的文件' : '该文件夹为空'"
        :description="filterActive ? '试着调整筛选条件或清除筛选' : '将文件拖拽到此处，或点击上方按钮添加文件'"
      />

      <!-- 文件网格 -->
      <div
        v-else
        ref="selContainer"
        class="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-1 select-none"
        @mousedown="onSelStart"
      >
        <!-- 框选虚线框 -->
        <div
          v-if="selBox.active"
          class="absolute pointer-events-none border-2 border-dashed border-[var(--color-primary-500)] bg-[var(--color-primary-500)]/10 rounded-sm z-20"
          :style="selBoxStyle"
        />

        <button
          v-for="row in filteredList"
          :key="row.fileId"
          type="button"
          :data-file-id="row.fileId"
          class="group relative aspect-square rounded-sm border transition-all p-3 flex flex-col items-center justify-center text-center"
          :class="
            selected.includes(row.fileId)
              ? 'border-[var(--color-primary-500)] ring-2 ring-[var(--color-primary-500)]/20 bg-[var(--color-primary-500)]/5'
              : 'border-[var(--color-border)] hover:border-[var(--color-primary-400)] hover:shadow-sm bg-[var(--color-surface)]'
          "
          @click="onRowClick(row)"
          @dblclick="onRowDblclick(row)"
          @contextmenu="onContextMenu($event, row)"
        >
          <!-- 选中指示 -->
          <div
            v-if="selected.includes(row.fileId)"
            class="absolute top-2 right-2 size-5 rounded-full bg-[var(--color-primary-500)] flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" class="size-3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <FileThumbnail :file="row" :size="56" rounded="rounded-sm" class="mb-2" />

          <BaseTooltip :text="row.filename" position="top">
            <p class="text-xs font-medium text-[var(--color-text)] line-clamp-2 leading-snug w-full break-all">
              {{ row.filename }}
            </p>
          </BaseTooltip>
          <p class="text-[10px] text-[var(--color-text-muted)] tabular-nums mt-0.5">
            {{ row.fileSizeDesc }}
          </p>
        </button>
      </div>

      <!-- 加载更多 -->
      <div
        v-if="!filterActive && hasMore && filteredList.length > 0"
        ref="loadMoreSentinel"
        class="py-6 flex items-center justify-center text-xs text-[var(--color-text-muted)]"
      >
        <LoaderCircle v-if="isLoadingMore" :size="14" class="animate-spin mr-2" />
        {{ isLoadingMore ? '加载中...' : '滚动加载更多' }}
      </div>
      <div
        v-else-if="!filterActive && !hasMore && filteredList.length > 0"
        class="py-4 text-center text-xs text-[var(--color-text-muted)]"
      >
        已加载全部 {{ total }} 个文件
      </div>
    </div>

    <!-- 右键菜单 -->
    <ContextMenu
      :visible="ctxMenu.visible"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      :items="ctxItems"
      @select="onCtxSelect"
      @close="closeCtxMenu"
    />

    <!-- 移动/复制对话框 -->
    <FolderPickerDialog
      v-if="moveDialog.open"
      :open="moveDialog.open"
      :mode="moveDialog.mode"
      :row="moveDialog.row"
      @update:open="(v: boolean) => (moveDialog.open = v)"
      @complete="onMoveComplete"
    />
  </div>
</template>
