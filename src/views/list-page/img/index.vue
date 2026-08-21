<script setup lang="ts">
/**
 * ImgListPage —— 图片类型列表（夸克式时间线视图）
 * - 默认进入「时间线」网格视图（按年/月/日分组，137px 缩略图瓦片）
 * - 可切换回「列表」表格视图（复用 FileTable）
 * - 时间线视图补充右键菜单 + 批量删除/分享（与 /files 行为一致）
 */
import FileButtonGroup from '@/components/file-button-group/index.vue'
import FileTable from '@/components/file-table/index.vue'
import ImageTimeline from '@/components/file-table/ImageTimeline.vue'
import ShareButton from '@/components/buttons/share-button/index.vue'
import ContextMenu from '@/components/base/ContextMenu.vue'
import { computed, onMounted, ref } from 'vue'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'
import { LayoutGrid, List, Download, Share2, Trash2 } from '@lucide/vue'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import fileService from '@/api/file'
import { getDownloadUrl } from '@/utils/preview'
import { useDrivePreview } from '@/composables/useDrivePreview'
import DrivePreviewModal from '@/components/preview/drive-preview-modal.vue'
import type { IFileVO } from '@/types'

const fileStore = useFileStore()
const { multipleSelection } = storeToRefs(fileStore)

// 与 /files 一致：非选中态只保留通用工具（上传），删除/分享/复制/移动等
// 批量操作只在选中文件后的批量操作条中出现，避免未选中就展示操作按钮。
const buttonArray = ref(['upload'])

// 视图模式：timeline（默认，夸克式）/ list（原表格）
const viewMode = ref<'timeline' | 'list'>('timeline')
// 时间线分组粒度
const groupMode = ref<'year' | 'month' | 'day'>('day')

function setViewMode(v: 'timeline' | 'list') {
  viewMode.value = v
}

// ─── 选中态（与 ImageTimeline / FileTable 共享 store.multipleSelection） ─────
const selectedCount = computed(() => multipleSelection.value.length)
const selectedRows = computed<IFileVO[]>(() => multipleSelection.value)

// ─── 分享（统一走两步式分享表单） ─────────────────────────────────────────────
const shareButtonRef = ref<InstanceType<typeof ShareButton> | null>(null)
function openShare(rows: IFileVO[]) {
  const list = rows?.length ? rows : selectedRows.value
  if (!list.length) {
    ElMessage.warning('请先选择文件')
    return
  }
  shareButtonRef.value?.openModal(list)
}

// ─── 删除（带危险确认） ─────────────────────────────────────────────────────
async function doDelete(rows: IFileVO[]) {
  const list = rows?.length ? rows : selectedRows.value
  if (!list.length) {
    ElMessage.warning('请先选择文件')
    return
  }
  // 注意：ElMessageBox.confirm 是 Promise<boolean>，永不 reject，只 resolve(true/false)。
  // 所以必须用返回值判断，否则用户"取消"也会继续删除。
  let ok = false
  try {
    ok = await ElMessageBox.confirm(
      `确定删除选中的 ${list.length} 个文件吗？删除后可在回收站找回。`,
      '删除文件',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'danger' }
    )
  } catch {
    return
  }
  if (!ok) return
  fileService.delete(
    { fileIds: list.map((r) => r.fileId) },
    () => {
      ElMessage.success(`已删除 ${list.length} 个文件`)
      fileStore.setMultipleSelection([])
      fileStore.loadFileList()
    },
    (err) => ElMessage.error(err.message)
  )
}

// ─── 预览 / 下载（时间线视图用） ─────────────────────────────────────────────
const preview = useDrivePreview(() => (fileStore.fileList || []) as any[])
const { state: previewState, openPreview: openPreviewModal, closePreview, resolvePreviewUrl } = preview

function downloadOne(row: IFileVO) {
  if (row.folderFlag === 1) {
    ElMessage.error('文件夹暂不支持下载')
    return
  }
  const a = document.createElement('a')
  a.href = getDownloadUrl(row.fileId)
  a.download = row.filename || ''
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function downloadSelected(rows: IFileVO[]) {
  const list = rows?.length ? rows : selectedRows.value
  if (!list.length) {
    ElMessage.warning('请先选择要下载的文件')
    return
  }
  if (list.some((r) => r.folderFlag === 1)) {
    ElMessage.error('文件夹暂不支持下载')
    return
  }
  list.forEach((r) => downloadOne(r))
}

function previewDownload(item: Record<string, any>) {
  window.open(getDownloadUrl(item.fileId), '_blank')
}

// ─── 时间线视图右键菜单 ──────────────────────────────────────────────────────
const ctxMenu = ref({ visible: false, x: 0, y: 0, row: null as IFileVO | null })

function onContextMenu(e: MouseEvent, row: IFileVO) {
  e.preventDefault()
  // 右键非选中项时，仅选中该项
  if (row && !multipleSelection.value.some((s) => s.fileId === row.fileId)) {
    fileStore.setMultipleSelection([row])
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
  const isMulti = selectedRows.value.length > 1
  const rows = selectedRows.value.length ? selectedRows.value : [r]
  return [
    {
      key: 'preview',
      label: '预览',
      action: () =>
        openPreviewModal({ fileId: r.fileId, filename: r.filename, fileType: r.fileType })
    },
    {
      key: 'download',
      label: isMulti ? `下载 ${rows.length} 项` : '下载',
      disabled: r.folderFlag === 1,
      action: () => downloadSelected(rows)
    },
    {
      key: 'share',
      label: '分享',
      action: () => openShare(rows)
    },
    { divider: true },
    {
      key: 'delete',
      label: isMulti ? `删除 ${rows.length} 项` : '删除',
      danger: true,
      action: () => doDelete(rows)
    }
  ]
})

onMounted(() => {
  fileStore.setSearchFlag(false)
  fileStore.setParentId('-1')
  fileStore.setFileTypes('7')
  fileStore.loadFileList()
})
</script>

<template>
  <div class="h-full flex flex-col min-h-0">
    <!-- 固定头部：标题 -->
    <div class="flex items-center gap-3 py-3 shrink-0">
      <h1 class="text-xl font-semibold tracking-tight text-(--color-text)">图片</h1>
      <span class="px-2 py-0.5 rounded-full font-mono text-xs" style="background-color: var(--color-surface-container-low); color: var(--color-text-muted);">
        {{ fileStore.fileList?.length || 0 }} items
      </span>
    </div>

    <!-- 固定工具条：操作按钮 + 视图切换（与 /files 样式统一：无边框、圆角浅色背景） -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 p-2 sm:p-3 rounded-sm bg-(--color-surface-container-low) shrink-0">
      <FileButtonGroup :button-array="buttonArray" :selected-rows="selectedRows" />

      <!-- 选中批量操作条 -->
      <div v-if="selectedCount > 0" class="flex items-center gap-2">
        <div class="w-px h-4 bg-(--color-border)" />
        <span class="text-sm text-(--color-text)">已选 {{ selectedCount }} 项</span>
        <div class="w-px h-4 bg-(--color-border)" />
        <button
          type="button"
          class="h-8 px-2 rounded-sm text-sm inline-flex items-center gap-1 text-(--color-text) hover:bg-(--color-surface-2)"
          @click="downloadSelected([])"
        >
          <Download :size="16" />
          下载
        </button>
        <button
          type="button"
          class="h-8 px-2 rounded-sm text-sm inline-flex items-center gap-1 text-(--color-text) hover:bg-(--color-surface-2)"
          @click="openShare([])"
        >
          <Share2 :size="16" />
          分享
        </button>
        <button
          type="button"
          class="h-8 px-2 rounded-sm text-sm inline-flex items-center gap-1 text-danger hover:bg-(--color-danger-bg)/20"
          @click="doDelete([])"
        >
          <Trash2 :size="16" />
          删除
        </button>
      </div>

      <!-- 视图切换：时间线 / 列表 -->
      <div class="inline-flex items-center rounded-md p-0.5 bg-(--color-surface-2) border border-(--color-border)">
        <button
          type="button"
          class="px-3 h-7 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors"
          :class="viewMode === 'timeline' ? 'bg-(--color-surface) text-(--color-text) shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text)'"
          @click="setViewMode('timeline')"
        >
          <LayoutGrid :size="14" /> 时间线
        </button>
        <button
          type="button"
          class="px-3 h-7 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors"
          :class="viewMode === 'list' ? 'bg-(--color-surface) text-(--color-text) shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text)'"
          @click="setViewMode('list')"
        >
          <List :size="14" /> 列表
        </button>
      </div>
    </div>

    <!-- 滚动区：仅列表内容滚动，标题/按钮固定 -->
    <div class="flex-1 min-h-0 overflow-y-auto">
      <!-- 夸克式时间线视图 -->
      <ImageTimeline
        v-if="viewMode === 'timeline'"
        :files="fileStore.fileList || []"
        :group-mode="groupMode"
        @update:group-mode="groupMode = $event"
        @contextmenu="(e: MouseEvent, row: IFileVO) => onContextMenu(e, row)"
      />

      <!-- 原表格视图（自带滚动 + 右键菜单） -->
      <FileTable
        v-else
        class="h-full"
        @share="(row: any) => openShare([row])"
      />
    </div>

    <!-- 时间线右键菜单 -->
    <ContextMenu
      :visible="ctxMenu.visible"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      :items="ctxItems"
      @select="onCtxSelect"
      @close="closeCtxMenu"
    />

    <!-- 统一预览弹窗 -->
    <DrivePreviewModal
      :state="previewState"
      :resolve-url="resolvePreviewUrl"
      @close="closePreview"
      @download="previewDownload"
    />

    <!-- 两步式分享表单（隐藏触发按钮，仅作为弹窗容器） -->
    <ShareButton ref="shareButtonRef" hide-trigger size="small" />
  </div>
</template>
