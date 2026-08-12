<script setup lang="ts">
/**
 * AppFileListPage —— 主文件列表页
 * 设计规范：G3 设计风格
 * - FileTypeFilter（类型筛选 chips）
 * - 工具条（FileButtonGroup + 视图切换）
 * - 面包屑 BreadCrumb
 * - DashboardCards + DashboardCharts（仅根目录+非搜索态）
 * - FileTable（列表/网格双视图）
 * - 拖拽上传反馈
 */
import { onMounted, onUnmounted, ref, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  LayoutGrid,
  List,
  CloudUpload,
  Download,
  Share2,
  Trash2,
  MoreHorizontal,
  Check,
  Minus
} from '@lucide/vue'
import FileButtonGroup from '@/components/file-button-group/index.vue'
import BreadCrumb from '@/components/breadcrumb/index.vue'
import FileTable from '@/components/file-table/index.vue'
import SortMenu from '@/components/file-table/SortMenu.vue'
import FilterMenu from '@/components/file-table/FilterMenu.vue'
import TransferButton from '@/components/buttons/transfer-button/index.vue'
import CopyButton from '@/components/buttons/copy-button/index.vue'
import UploadTaskPanel from '@/components/upload-task-panel/index.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import BasePopover from '@/components/base/BasePopover.vue'
import { useFileStore } from '@/stores/file'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import { useUploader } from '@/composables/useUploader'
import { storeToRefs } from 'pinia'
import { ElMessage } from '@/composables/useToast'

const fileStore = useFileStore()
const breadcrumbStore = useBreadcrumbStore()
const { searchFlag, defaultParentId, defaultParentFilename, fileList, multipleSelection } = storeToRefs(fileStore)
const route = useRoute()

// P2-8: query.type → fileTypes 映射（与 file-type-filter 保持一致）
const typeQueryMap: Record<string, string> = {
  imgs: '7',
  docs: '3,4,10',
  videos: '9',
  musics: '8',
  other: '0'
}

function applyTypeQuery(typeQuery: unknown) {
  const key = Array.isArray(typeQuery) ? typeQuery[0] : typeQuery
  const fileTypes = typeQueryMap[key as string] || '-1'
  fileStore.setFileTypes(fileTypes)
  fileStore.loadFileList()
}

const showDashboard = ref(true)
const view = ref('list')
const isDragOver = ref(false)
const fileTableRef = ref(null)
const { addFiles } = useUploader()

// ─── 全局快捷键（来自 useShortcuts 派发） ───────────────────────────────────
function onShortcut(e: Event) {
  const name = (e as CustomEvent).detail?.name
  const table = fileTableRef.value as any
  switch (name) {
    case 'upload':
      table?.triggerUpload?.()
      break
    case 'createFolder':
      table?.createFolder?.()
      break
    case 'download':
      table?.download?.()
      break
    case 'rename':
      table?.rename?.()
      break
    case 'refresh':
      table?.refresh?.()
      break
    case 'view-list':
      view.value = 'list'
      table?.setView?.('list')
      break
    case 'view-grid':
      view.value = 'grid'
      table?.setView?.('grid')
      break
  }
}
onMounted(() => window.addEventListener('xpan:shortcut', onShortcut))
onUnmounted(() => window.removeEventListener('xpan:shortcut', onShortcut))

// 排序 / 筛选状态（与 FileTable 共享）
const sortOpen = ref(false)
const filterOpen = ref(false)

function onFilterChange(filter: any) {
  // 透传给 file-table，内部通过 watch filter 生效
  if (fileTableRef.value) {
    fileTableRef.value.applyFilter(filter)
  }
}

// 视图切换：通过 setView 同步到 FileTable 内部状态（而非 :key 强制重挂载）
watch(view, (v) => {
  fileTableRef.value?.setView(v)
})

const buttonArray = ref(['upload', 'createFolder'])
const selectedCount = computed(() => multipleSelection.value.length)
const isAllSelected = computed(() => {
  if (!fileList.value.length) return false
  return fileList.value.every((r) => multipleSelection.value.some((s) => s.fileId === r.fileId))
})
const isIndeterminate = computed(() => {
  return selectedCount.value > 0 && !isAllSelected.value
})
const moreMenuOpen = ref(false)

function toggleSelectAll() {
  const table = fileTableRef.value as any
  if (isAllSelected.value) {
    table?.clearSelection?.()
  } else {
    table?.selectAll?.()
  }
}

function onBatchDownload() {
  const table = fileTableRef.value as any
  if (!table?.selectedRows?.length) {
    ElMessage.warning('请先选择文件')
    return
  }
  table.batchDownload?.(table.selectedRows)
}

function onBatchDelete() {
  const table = fileTableRef.value as any
  if (!table?.selectedRows?.length) {
    ElMessage.warning('请先选择文件')
    return
  }
  table.batchDelete?.(table.selectedRows)
}

function onBatchRename() {
  const table = fileTableRef.value as any
  if (!table?.selectedRows?.length) {
    ElMessage.warning('请先选择文件')
    return
  }
  table.batchRename?.(table.selectedRows)
}

function onBatchShare() {
  const table = fileTableRef.value as any
  if (!table?.selectedRows?.length) {
    ElMessage.warning('请先选择文件')
    return
  }
  table.shareWithQRCode?.()
}

function onMoreAction(key: string) {
  moreMenuOpen.value = false
  switch (key) {
    case 'rename':
      onBatchRename()
      break
    case 'favorite': {
      const table = fileTableRef.value as any
      if (table?.selectedRows?.length) table?.toggleFavorite?.(table.selectedRows[0])
      break
    }
    case 'detail':
      ElMessage.info('文件详情')
      break
  }
}

function onDragOver(e) {
  e.preventDefault()
  isDragOver.value = true
}

function onDragLeave(e) {
  if (e.target === e.currentTarget) isDragOver.value = false
}

function onDrop(e) {
  e.preventDefault()
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (files?.length) addFiles(files)
}

function onWindowDragOver(e) {
  e.preventDefault()
}

onMounted(() => {
  if (!searchFlag.value) {
    const firstItem = { id: defaultParentId.value, name: defaultParentFilename.value }
    breadcrumbStore.clear()
    breadcrumbStore.addItem(firstItem)
    fileStore.refreshParentId()
    // P2-8: 从 query.type 读取类型筛选（首次进入仍重置到根目录）
    applyTypeQuery(route.query.type)
  }
  window.addEventListener('dragover', onWindowDragOver)
  window.addEventListener('drop', onWindowDragOver)
})

// P2-8: query.type 变化时切换类型筛选，保留当前目录上下文（不 refreshParentId）
watch(
  () => route.query.type,
  (newType, oldType) => {
    if (newType === oldType) return
    if (searchFlag.value) return // 搜索态不响应类型切换
    applyTypeQuery(newType)
  }
)

onUnmounted(() => {
  window.removeEventListener('dragover', onWindowDragOver)
  window.removeEventListener('drop', onWindowDragOver)
})
</script>

<template>
  <!-- 拖拽上传区域 -->
  <div
    class="flex flex-col gap-4 relative"
    :class="isDragOver ? 'ring-2 ring-inset ring-[var(--color-primary-500)] rounded-xl' : ''"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- 拖拽遮罩提示 -->
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isDragOver"
        class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center backdrop-blur-sm rounded-xl m-4 border-2 border-dashed"
        style="border-color: var(--color-primary-500); background-color: rgba(0, 112, 243, 0.05);"
      >
        <div class="flex flex-col items-center gap-4" style="color: var(--color-primary-500);">
          <CloudUpload :size="64" :stroke-width="1.5" />
          <div class="text-base font-medium">
            松开以上传到当前文件夹
          </div>
        </div>
      </div>
    </Transition>

    <!-- 工具条 -->
    <div
      class="flex items-center justify-between gap-4 p-3 rounded-sm bg-[var(--color-surface-container-low)]"
    >
      <!-- 未选中：左侧上传/新建 -->
      <div v-if="selectedCount === 0" class="flex items-center gap-2">
        <FileButtonGroup :button-array="buttonArray" />
      </div>

      <!-- 选中时：左侧全选 + 批量操作 -->
      <div v-else class="flex items-center gap-2">
        <button
          type="button"
          class="size-4 rounded flex items-center justify-center transition-colors"
          style="border: 1px solid var(--color-border-strong);"
          :style="(isAllSelected || isIndeterminate) ? 'background-color: var(--color-primary-500); border-color: var(--color-primary-500); color: white;' : ''"
          @click="toggleSelectAll"
        >
          <Check v-if="isAllSelected" :size="12" :stroke-width="3" />
          <Minus v-else-if="isIndeterminate" :size="12" :stroke-width="3" />
        </button>
        <span class="text-sm text-[var(--color-text)]">
          已选
          <span class="font-medium tabular-nums">{{ selectedCount }}</span>
          项
        </span>

        <div class="w-px h-4 bg-[var(--color-border)]" />

        <BaseTooltip text="下载" position="bottom">
          <button
            type="button"
            class="h-8 px-2 rounded-sm text-sm inline-flex items-center gap-1 text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
            @click="onBatchDownload"
          >
            <Download :size="16" />
            下载
          </button>
        </BaseTooltip>
        <BaseTooltip text="分享" position="bottom">
          <button
            type="button"
            class="h-8 px-2 rounded-sm text-sm inline-flex items-center gap-1 text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
            @click="onBatchShare"
          >
            <Share2 :size="16" />
            分享
          </button>
        </BaseTooltip>
        <CopyButton round-flag size="small" />
        <TransferButton round-flag size="small" />
        <BaseTooltip text="删除" position="bottom">
          <button
            type="button"
            class="h-8 px-2 rounded-sm text-sm inline-flex items-center gap-1 text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]/20"
            @click="onBatchDelete"
          >
            <Trash2 :size="16" />
            删除
          </button>
        </BaseTooltip>
        <BasePopover v-model="moreMenuOpen" placement="bottom-start" trigger="click">
          <template #trigger>
            <button
              type="button"
              class="h-8 px-2 rounded-sm text-sm inline-flex items-center gap-1 text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
            >
              <MoreHorizontal :size="16" />
              更多
            </button>
          </template>
          <div class="py-1 min-w-[120px]">
            <button
              type="button"
              class="w-full px-3 py-1.5 text-sm text-left text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
              @click="onMoreAction('rename')"
            >
              重命名
            </button>
            <button
              type="button"
              class="w-full px-3 py-1.5 text-sm text-left text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
              @click="onMoreAction('favorite')"
            >
              收藏
            </button>
            <button
              type="button"
              class="w-full px-3 py-1.5 text-sm text-left text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
              @click="onMoreAction('detail')"
            >
              查看详情
            </button>
          </div>
        </BasePopover>
      </div>

      <div class="flex items-center gap-2">
        <SortMenu v-model:open="sortOpen" />
        <FilterMenu
          v-model:open="filterOpen"
          @filter-change="onFilterChange"
        />
        <div
          class="flex items-center rounded-sm overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)]"
        >
          <BaseTooltip text="列表视图" position="bottom">
            <button
              type="button"
              class="size-8 flex items-center justify-center transition-colors"
              :style="view === 'list' ? 'background-color: var(--color-primary-500); color: white;' : 'color: var(--color-text-muted);'"
              aria-label="列表视图"
              @click="view = 'list'"
            >
              <List :size="16" :stroke-width="2" />
            </button>
          </BaseTooltip>
          <BaseTooltip text="网格视图" position="bottom">
            <button
              type="button"
              class="size-8 flex items-center justify-center transition-colors"
              :style="view === 'grid' ? 'background-color: var(--color-primary-500); color: white;' : 'color: var(--color-text-muted);'"
              aria-label="网格视图"
              @click="view = 'grid'"
            >
              <LayoutGrid :size="16" :stroke-width="2" />
            </button>
          </BaseTooltip>
        </div>
      </div>
    </div>

    <!-- 面包屑 -->
    <BreadCrumb />

    <!-- 文件表格 -->
    <FileTable ref="fileTableRef" />
  </div>

  <UploadTaskPanel />
</template>
