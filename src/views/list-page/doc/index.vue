<script setup lang="ts">
/**
 * DocListPage —— 文档类型列表
 * 参考百度/夸克网盘文档页：类型 Tab 筛选 + 卡片分组 / 时间线 专属视图，可切换回传统列表
 */
import FileButtonGroup from '@/components/file-button-group/index.vue'
import FileTable from '@/components/file-table/index.vue'
import DocViewer, { type DocViewMode } from '@/components/file-table/DocViewer.vue'
import { LayoutGrid, CalendarRange, List, FileText } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import { useFileStore } from '@/stores/file'

const fileStore = useFileStore()
const buttonArray = ref(['upload', 'download', 'delete', 'rename', 'share', 'copy', 'transfer'])

// 视图模式：cards=卡片分组 / timeline=时间线 / list=传统列表
const viewMode = ref<DocViewMode | 'list'>('cards')
function setViewMode(v: DocViewMode | 'list') {
  viewMode.value = v
}

onMounted(() => {
  fileStore.setSearchFlag(false)
  fileStore.setParentId('-1')
  fileStore.setFileTypes('3,4,5,6,10')
  fileStore.loadFileList()
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center gap-3 py-3">
      <h1 class="text-xl font-semibold tracking-tight text-(--color-text) inline-flex items-center gap-2">
        <FileText :size="20" class="text-primary-500" /> 文档
      </h1>
      <span class="px-2 py-0.5 rounded-full font-mono text-xs" style="background-color: var(--color-surface-container-low); color: var(--color-text-muted);">
        {{ fileStore.fileList?.length || 0 }} items
      </span>
    </div>
    <div class="flex items-center justify-between gap-4 py-3 px-3 rounded-md border border-(--color-border) bg-(--color-surface-container-low)">
      <FileButtonGroup :button-array="buttonArray" />

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

    <!-- 专属视图：卡片分组 / 时间线 -->
    <DocViewer
      v-if="viewMode !== 'list'"
      :files="fileStore.fileList || []"
      :view-mode="viewMode"
      @update:view-mode="(v: DocViewMode) => (viewMode = v)"
    />

    <!-- 传统列表视图 -->
    <FileTable v-else />
  </div>
</template>
