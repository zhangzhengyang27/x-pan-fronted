<script setup lang="ts">
/**
 * DocListPage —— 文档类型列表
 * 参考百度/夸克网盘文档页：类型 Tab 筛选 + 卡片分组 / 时间线 专属视图，可切换回传统列表
 * - 修复：标题/工具条固定，仅列表区滚动；专属视图补充右键菜单 + 批量删除/分享
 */
import FileButtonGroup from '@/components/file-button-group/index.vue'
import FileTable from '@/components/file-table/index.vue'
import DocViewer, { type DocViewMode } from '@/components/file-table/DocViewer.vue'
import ShareButton from '@/components/buttons/share-button/index.vue'
import ContextMenu from '@/components/base/ContextMenu.vue'
import { LayoutGrid, CalendarRange, List, FileText, Download, Share2, Trash2 } from '@lucide/vue'
import { onMounted, ref, computed } from 'vue'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import fileService from '@/api/file'
import { getDownloadUrl } from '@/utils/preview'
import type { IFileVO } from '@/types'

const fileStore = useFileStore()
const { multipleSelection } = storeToRefs(fileStore)
// 与 /files 一致：非选中态只保留通用工具（上传），删除/分享等批量操作
// 只在选中文件后的批量操作条中出现。
const buttonArray = ref(['upload'])

// 视图模式：cards=卡片分组 / timeline=时间线 / list=传统列表
const viewMode = ref<DocViewMode | 'list'>('cards')
function setViewMode(v: DocViewMode | 'list') {
  viewMode.value = v
}

// ─── 选中态 ───────────────────────────────────────────────────────────────
const selectedCount = computed(() => multipleSelection.value.length)
const selectedRows = computed<IFileVO[]>(() => multipleSelection.value)

// ─── 分享 / 删除 ──────────────────────────────────────────────────────────
const shareButtonRef = ref<InstanceType<typeof ShareButton> | null>(null)
function openShare(rows: IFileVO[]) {
  const list = rows?.length ? rows : selectedRows.value
  if (!list.length) {
    ElMessage.warning('请先选择文件')
    return
  }
  shareButtonRef.value?.openModal(list)
}

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

// ─── 下载 ─────────────────────────────────────────────────────────────────
function downloadOne(row: IFileVO) {
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
  list.forEach((r) => downloadOne(r))
}

// ─── 专属视图右键菜单 ──────────────────────────────────────────────────────
const ctxMenu = ref({ visible: false, x: 0, y: 0, row: null as IFileVO | null })

function onContextMenu(e: MouseEvent, row: IFileVO) {
  e.preventDefault()
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
    { key: 'download', label: isMulti ? `下载 ${rows.length} 项` : '下载', action: () => downloadSelected(rows) },
    { key: 'share', label: '分享', action: () => openShare(rows) },
    { divider: true },
    { key: 'delete', label: isMulti ? `删除 ${rows.length} 项` : '删除', danger: true, action: () => doDelete(rows) }
  ]
})

onMounted(() => {
  fileStore.setSearchFlag(false)
  fileStore.setParentId('-1')
  fileStore.setFileTypes('3,4,5,6,10')
  fileStore.loadFileList()
})
</script>

<template>
  <div class="h-full flex flex-col min-h-0">
    <!-- 固定头部：标题 -->
    <div class="flex items-center gap-3 py-3 shrink-0">
      <h1 class="text-xl font-semibold tracking-tight text-(--color-text) inline-flex items-center gap-2">
        <FileText :size="20" class="text-primary-500" /> 文档
      </h1>
      <span class="px-2 py-0.5 rounded-full font-mono text-xs" style="background-color: var(--color-surface-container-low); color: var(--color-text-muted);">
        {{ fileStore.fileList?.length || 0 }} items
      </span>
    </div>

    <!-- 固定工具条 -->
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

      <!-- 视图切换：卡片 / 时间线 / 列表 -->
      <div class="inline-flex items-center rounded-md p-0.5 bg-(--color-surface-2) border border-(--color-border)">
        <button
          type="button"
          class="px-3 h-7 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors"
          :class="viewMode === 'cards' ? 'bg-(--color-surface) text-(--color-text) shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text)'"
          @click="setViewMode('cards')"
        >
          <LayoutGrid :size="14" /> 卡片
        </button>
        <button
          type="button"
          class="px-3 h-7 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors"
          :class="viewMode === 'timeline' ? 'bg-(--color-surface) text-(--color-text) shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text)'"
          @click="setViewMode('timeline')"
        >
          <CalendarRange :size="14" /> 时间线
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

    <!-- 滚动区：仅列表内容滚动 -->
    <div class="flex-1 min-h-0 overflow-y-auto">
      <!-- 专属视图：卡片分组 / 时间线 -->
      <DocViewer
        v-if="viewMode !== 'list'"
        :files="fileStore.fileList || []"
        :view-mode="viewMode"
        @update:view-mode="(v: DocViewMode) => (viewMode = v)"
        @contextmenu="(e: MouseEvent, row: IFileVO) => onContextMenu(e, row)"
      />

      <!-- 传统列表视图（自带滚动 + 右键菜单） -->
      <FileTable
        v-else
        class="h-full"
        @share="(row: any) => openShare([row])"
      />
    </div>

    <!-- 专属视图右键菜单 -->
    <ContextMenu
      :visible="ctxMenu.visible"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      :items="ctxItems"
      @select="onCtxSelect"
      @close="closeCtxMenu"
    />

    <!-- 两步式分享表单 -->
    <ShareButton ref="shareButtonRef" hide-trigger size="small" />
  </div>
</template>
