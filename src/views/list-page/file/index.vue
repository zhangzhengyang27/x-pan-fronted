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
  Minus,
  RefreshCw,
  ClipboardPaste
} from '@lucide/vue'
import ShareButton from '@/components/buttons/share-button/index.vue'
import FileButtonGroup from '@/components/file-button-group/index.vue'
import BreadCrumb from '@/components/breadcrumb/index.vue'
import FileTable from '@/components/file-table/index.vue'
import SortMenu from '@/components/file-table/SortMenu.vue'
import FilterMenu from '@/components/file-table/FilterMenu.vue'
import TransferButton from '@/components/buttons/transfer-button/index.vue'
import CopyButton from '@/components/buttons/copy-button/index.vue'
import FileDetailPanel from '@/components/file-table/FileDetailPanel.vue'
import UploadTaskPanel from '@/components/upload-task-panel/index.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import BasePopover from '@/components/base/BasePopover.vue'
import { useFileStore } from '@/stores/file'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import { useUploader } from '@/composables/useUploader'
import { storeToRefs } from 'pinia'
import fileService from '@/api/file'
import { ElMessage } from '@/composables/useToast'

const fileStore = useFileStore()
const breadcrumbStore = useBreadcrumbStore()
const { searchFlag, defaultParentId, defaultParentFilename, fileList, multipleSelection } = storeToRefs(fileStore)
const route = useRoute()

// P2-8: query.type → fileTypes 映射（与 file-type-filter 保持一致）
const typeQueryMap: Record<string, string> = {
  imgs: '7',
  docs: '3,4,5,6,10',
  videos: '9',
  musics: '8',
  other: '1,2,11,12'
}

function applyTypeQuery(typeQuery: unknown) {
  const key = Array.isArray(typeQuery) ? typeQuery[0] : typeQuery
  const fileTypes = typeQueryMap[key as string] || '-1'
  if (fileTypes === '-1') {
    // 全部类型：显式回到根目录，避免残留的 parentId（如来自分类页的 '-1' 哨兵）影响查询上下文
    fileStore.setParentId(defaultParentId.value)
  } else {
    // 具体分类：用 '-1' 哨兵触发后端"全盘按类型跨目录"查询
    fileStore.setParentId('-1')
  }
  fileStore.setFileTypes(fileTypes)
  fileStore.loadFileList()
}

const showDashboard = ref(true)
const view = ref('list')
const isDragOver = ref(false)
const dragEnterCount = ref(0)
const fileTableRef = ref(null)
const shareButtonRef = ref<InstanceType<typeof ShareButton> | null>(null)
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
const selectedRows = computed(() => multipleSelection.value)
const isAllSelected = computed(() => {
  if (!fileList.value.length) return false
  return fileList.value.every((r) => multipleSelection.value.some((s) => s.fileId === r.fileId))
})
const isIndeterminate = computed(() => {
  return selectedCount.value > 0 && !isAllSelected.value
})
const moreMenuOpen = ref(false)
const detailOpen = ref(false)
const detailFile = ref<Record<string, any> | null>(null)

function toggleSelectAll() {
  const table = fileTableRef.value as any
  if (isAllSelected.value) {
    table?.clearSelection?.()
  } else {
    table?.selectAll?.()
  }
}

/** 粘贴（移动/复制到当前目录），复用 file store 剪贴板 */
async function doPaste() {
  const res = await fileStore.paste()
  if (res.success) {
    ElMessage.success('粘贴成功')
  } else {
    ElMessage.error(res.message || '粘贴失败')
  }
}

function onBatchDownload() {
  const table = fileTableRef.value as any
  const rows = selectedRows.value
  if (!rows.length) {
    ElMessage.warning('请先选择文件')
    return
  }
  table?.batchDownload?.(rows)
}

function onBatchDelete() {
  const table = fileTableRef.value as any
  const rows = selectedRows.value
  if (!rows.length) {
    ElMessage.warning('请先选择文件')
    return
  }
  table?.batchDelete?.(rows)
}

function onBatchRename() {
  const table = fileTableRef.value as any
  const rows = selectedRows.value
  if (!rows.length) {
    ElMessage.warning('请先选择文件')
    return
  }
  if (rows.length === 1) {
    table?.rename?.()
  } else {
    table?.batchRename?.(rows)
  }
}

function onBatchShare() {
  const table = fileTableRef.value as any
  const rows = table?.selectedRows || selectedRows.value
  if (!rows.length) {
    ElMessage.warning('请先选择文件')
    return
  }
  shareButtonRef.value?.openModal(rows)
}

function onShareRow(row: any) {
  shareButtonRef.value?.openModal(row)
}

// 详情面板「分享」：传入当前文件打开表单
function onShareDetail() {
  if (detailFile.value) shareButtonRef.value?.openModal(detailFile.value)
}

function onMoreAction(key: string) {
  moreMenuOpen.value = false
  const table = fileTableRef.value as any
  // 统一从 file-table 的真实选中行取数，避免依赖 store 快照（可能含缺失字段的脏数据）
  const rows = table?.selectedRows || selectedRows.value
  switch (key) {
    case 'rename':
      onBatchRename()
      break
    case 'favorite': {
      const row = rows[0]
      if (row) table?.toggleFavorite?.(row)
      break
    }
    case 'detail': {
      const row = rows[0]
      if (row) {
        detailFile.value = row
        detailOpen.value = true
      }
      break
    }
  }
}

function onRefresh() {
  fileTableRef.value?.refresh?.()
  ElMessage.success('已刷新')
}

function onDragEnter(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  dragEnterCount.value++
  isDragOver.value = true
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
}

function onDragLeave(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  dragEnterCount.value--
  if (dragEnterCount.value <= 0) {
    dragEnterCount.value = 0
    isDragOver.value = false
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  dragEnterCount.value = 0
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (files?.length) addFiles(files)
}

function onWindowDragOver(e: DragEvent) {
  e.preventDefault()
}

function onWindowDrop(e: DragEvent) {
  e.preventDefault()
  dragEnterCount.value = 0
  isDragOver.value = false
}

onMounted(() => {
  if (!searchFlag.value) {
    const savedParentId = fileStore.parentId
    if (savedParentId && savedParentId !== '-1') {
      // 刷新后恢复：用保存的目录重新拉面包屑 + 列表
      fileService.getBreadcrumbs(
        { fileId: savedParentId },
        (res) => {
          breadcrumbStore.clear()
          breadcrumbStore.reset(res.data)
          fileStore.loadFileList()
        },
        () => {
          breadcrumbStore.clear()
          breadcrumbStore.addItem({ id: defaultParentId.value, name: defaultParentFilename.value })
          fileStore.refreshParentId()
          fileStore.loadFileList()
        }
      )
    } else {
      // 根目录：重置 breadcrumb
      breadcrumbStore.clear()
      breadcrumbStore.addItem({ id: defaultParentId.value, name: defaultParentFilename.value })
      fileStore.refreshParentId()
    }
    // P2-8: 从 query.type 读取类型筛选（保留当前目录上下文）
    applyTypeQuery(route.query.type)
  }
  window.addEventListener('dragover', onWindowDragOver)
  window.addEventListener('drop', onWindowDrop)
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
  window.removeEventListener('drop', onWindowDrop)
})
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex flex-1 gap-4 min-h-0">
    <!-- 拖拽上传区域 -->
    <div
      class="flex flex-col relative flex-1 min-w-0 h-full"
      :class="isDragOver ? 'ring-2 ring-inset ring-primary-500 rounded-xl' : ''"
      @dragenter="onDragEnter"
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
        <div class="flex flex-col items-center gap-3" style="color: var(--color-primary-500);">
          <CloudUpload :size="56" :stroke-width="1.5" />
          <div class="text-lg font-medium">
            释放鼠标以上传文件
          </div>
          <div class="text-sm opacity-80">
            支持多文件批量上传 · 自动分片 · 秒传
          </div>
        </div>
      </div>
    </Transition>

    <!-- 固定头部：工具条 + 面包屑 -->
    <div class="sticky top-0 z-20 bg-(--color-bg) flex flex-col">
      <!-- 工具条 -->
      <div
        class="flex items-center justify-between gap-4 p-3 rounded-sm bg-(--color-surface-container-low)"
      >
      <div class="flex items-center gap-2">
        <FileButtonGroup :button-array="buttonArray" />

        <template v-if="selectedCount > 0">
          <div class="w-px h-4 bg-(--color-border)" />

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
          <span class="text-sm text-(--color-text)">
            已选
            <span class="font-medium tabular-nums">{{ selectedCount }}</span>
            项
          </span>

          <div class="w-px h-4 bg-(--color-border)" />

          <BaseTooltip text="下载" position="bottom">
            <button
              type="button"
              class="h-8 px-2 rounded-sm text-sm inline-flex items-center gap-1 text-(--color-text) hover:bg-(--color-surface-2)"
              @click="onBatchDownload"
            >
              <Download :size="16" />
              下载
            </button>
          </BaseTooltip>
          <BaseTooltip text="分享" position="bottom">
            <button
              type="button"
              class="h-8 px-2 rounded-sm text-sm inline-flex items-center gap-1 text-(--color-text) hover:bg-(--color-surface-2)"
              @click="onBatchShare"
            >
              <Share2 :size="16" />
              分享
            </button>
          </BaseTooltip>
          <ShareButton ref="shareButtonRef" hide-trigger size="small" />
          <CopyButton round-flag size="small" />
          <TransferButton round-flag size="small" />
          <BaseTooltip text="粘贴" position="bottom">
            <button
              type="button"
              class="h-8 px-2 rounded-sm text-sm inline-flex items-center gap-1 text-(--color-text) hover:bg-(--color-surface-2) disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="!fileStore.clipboard"
              @click="doPaste"
            >
              <ClipboardPaste :size="16" />
              粘贴
            </button>
          </BaseTooltip>
          <BaseTooltip text="删除" position="bottom">
            <button
              type="button"
              class="h-8 px-2 rounded-sm text-sm inline-flex items-center gap-1 text-danger hover:bg-(--color-danger-bg)/20"
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
                class="h-8 px-2 rounded-sm text-sm inline-flex items-center gap-1 text-(--color-text) hover:bg-(--color-surface-2)"
              >
                <MoreHorizontal :size="16" />
                更多
              </button>
            </template>
            <div class="py-1 min-w-[120px]">
              <button
                type="button"
                class="w-full px-3 py-1.5 text-sm text-left text-(--color-text) hover:bg-(--color-surface-2)"
                @click="onMoreAction('rename')"
              >
                重命名
              </button>
              <button
                type="button"
                class="w-full px-3 py-1.5 text-sm text-left text-(--color-text) hover:bg-(--color-surface-2)"
                @click="onMoreAction('favorite')"
              >
                收藏
              </button>
              <button
                type="button"
                class="w-full px-3 py-1.5 text-sm text-left text-(--color-text) hover:bg-(--color-surface-2)"
                @click="onMoreAction('detail')"
              >
                查看详情
              </button>
            </div>
          </BasePopover>
        </template>
      </div>

      <div class="flex items-center gap-2">
        <SortMenu v-model:open="sortOpen" />
        <FilterMenu
          v-model:open="filterOpen"
          @filter-change="onFilterChange"
        />
        <div
          class="flex items-center rounded-sm overflow-hidden bg-(--color-surface) border border-(--color-border)"
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
        <div class="w-px h-4 bg-(--color-border)" />
        <BaseTooltip text="刷新" position="bottom">
          <button
            type="button"
            class="size-8 rounded-sm inline-flex items-center justify-center transition-colors text-(--color-text) hover:bg-(--color-surface-2)"
            @click="onRefresh"
          >
            <RefreshCw :size="16" />
          </button>
        </BaseTooltip>
      </div>
    </div>

      <!-- 面包屑 -->
      <BreadCrumb class="pt-2 pb-1" />
    </div>

    <!-- 文件表格 -->
    <FileTable ref="fileTableRef" class="flex-1 min-h-0" @share="onShareRow">
      <template #after-list>
        <!-- 空白处上传提示（跟随文件列表之后） -->
        <div
          class="mt-4 py-6 rounded-xl border border-dashed text-center flex-none"
          style="border-color: var(--color-border-strong);"
        >
          <p class="text-sm text-(--color-text-muted)">
            点击
            <button
              type="button"
              class="text-primary-500 hover:underline"
              @click="fileTableRef?.triggerUpload?.()"
            >
              上传文件
            </button>
            or
            <span class="text-primary-500">拖拽/粘贴</span>
            到空白处上传文件
          </p>
        </div>
      </template>
    </FileTable>
  </div>

  <Transition name="detail-mask">
    <div
      v-if="detailOpen"
      class="fixed inset-0 z-30 bg-black/30"
      @click="detailOpen = false"
    />
  </Transition>

  <FileDetailPanel
    :file="detailFile"
    :open="detailOpen"
    @update:open="(v: boolean) => detailOpen = v"
    @close="detailOpen = false"
    @refresh="fileStore.loadFileList()"
    @share="onShareDetail"
  />
</div>

<UploadTaskPanel />
  </div>
</template>
