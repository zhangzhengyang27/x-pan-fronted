<script setup>
/**
 * AppFileListPage —— 主文件列表页（带视图切换 + 拖拽上传）
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { LayoutGrid, List } from '@lucide/vue'
import FileButtonGroup from '@/components/file-button-group/index.vue'
import BreadCrumb from '@/components/breadcrumb/index.vue'
import FileTable from '@/components/file-table/index.vue'
import UploadTaskPanel from '@/components/upload-task-panel/index.vue'
import FileTypeFilter from '@/components/file-type-filter/index.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import DashboardCards from '@/components/dashboard/DashboardCards.vue'
import DashboardCharts from '@/components/dashboard/DashboardCharts.vue'
import { useFileStore } from '@/stores/file'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import { useUploader } from '@/composables/useUploader'
import { storeToRefs } from 'pinia'

const fileStore = useFileStore()
const breadcrumbStore = useBreadcrumbStore()
const { searchFlag, defaultParentId, defaultParentFilename, fileList } = storeToRefs(fileStore)

const showDashboard = ref(true)
const view = ref('list')
const isDragOver = ref(false)
const { addFiles } = useUploader()

const buttonArray = ref([
  'upload',
  'createFolder',
  'download',
  'delete',
  'rename',
  'share',
  'copy',
  'transfer'
])

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

// 防止浏览器误打开文件，离开页面也清状态
function onWindowDragOver(e) {
  e.preventDefault()
}

onMounted(() => {
  if (!searchFlag.value) {
    const firstItem = { id: defaultParentId.value, name: defaultParentFilename.value }
    breadcrumbStore.clear()
    breadcrumbStore.addItem(firstItem)
    fileStore.refreshParentId()
    fileStore.setFileTypes('-1')
    fileStore.loadFileList()
  }
  window.addEventListener('dragover', onWindowDragOver)
  window.addEventListener('drop', onWindowDragOver)
})

onUnmounted(() => {
  window.removeEventListener('dragover', onWindowDragOver)
  window.removeEventListener('drop', onWindowDragOver)
})
</script>

<template>
  <div
    class="flex flex-col gap-1 relative"
    :class="isDragOver ? 'ring-2 ring-inset ring-[var(--color-primary)] rounded-xl' : ''"
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
        class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[var(--color-primary)]/5 backdrop-blur-sm rounded-xl"
      >
        <div class="text-center">
          <div class="text-base font-medium text-[var(--color-primary)]">
            松开以上传到当前文件夹
          </div>
        </div>
      </div>
    </Transition>

    <!-- 类型筛选 -->
    <FileTypeFilter />

    <!-- 工具条 -->
    <div class="flex items-center justify-between gap-4 py-3">
      <FileButtonGroup :button-array="buttonArray" />
      <div
        class="flex items-center gap-1 p-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
      >
        <BaseTooltip text="列表视图" position="bottom">
          <button
            type="button"
            class="size-7 flex items-center justify-center rounded-md transition-colors"
            :class="
              view === 'list'
                ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] dark:bg-[var(--color-primary-900)]/30 dark:text-[var(--color-primary-300)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            "
            aria-label="列表视图"
            @click="view = 'list'"
          >
            <List :size="14" />
          </button>
        </BaseTooltip>
        <BaseTooltip text="网格视图" position="bottom">
          <button
            type="button"
            class="size-7 flex items-center justify-center rounded-md transition-colors"
            :class="
              view === 'grid'
                ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] dark:bg-[var(--color-primary-900)]/30 dark:text-[var(--color-primary-300)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            "
            aria-label="网格视图"
            @click="view = 'grid'"
          >
            <LayoutGrid :size="14" />
          </button>
        </BaseTooltip>
      </div>
    </div>

    <BreadCrumb />

    <!-- P1.9 仪表盘：仅在根目录显示 -->
    <DashboardCards v-if="showDashboard && !searchFlag && fileList.length > 0" :files="fileList" />

    <!-- P1.10 图表 -->
    <DashboardCharts v-if="showDashboard && !searchFlag && fileList.length > 0" :files="fileList" />

    <FileTable :key="view" />
  </div>

  <UploadTaskPanel />
</template>
