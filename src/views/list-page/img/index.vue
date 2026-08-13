<script setup lang="ts">
/**
 * ImgListPage —— 图片类型列表（夸克式时间线视图）
 * - 默认进入「时间线」网格视图（按年/月/日分组，137px 缩略图瓦片）
 * - 可切换回「列表」表格视图（复用 FileTable）
 */
import FileButtonGroup from '@/components/file-button-group/index.vue'
import FileTable from '@/components/file-table/index.vue'
import ImageTimeline from '@/components/file-table/ImageTimeline.vue'
import { onMounted, ref } from 'vue'
import { useFileStore } from '@/stores/file'
import { LayoutGrid, List } from '@lucide/vue'

const fileStore = useFileStore()

const buttonArray = ref(['upload', 'download', 'delete', 'rename', 'share', 'copy', 'transfer'])

// 视图模式：timeline（默认，夸克式）/ list（原表格）
const viewMode = ref<'timeline' | 'list'>('timeline')
// 时间线分组粒度
const groupMode = ref<'year' | 'month' | 'day'>('day')

function setViewMode(v: 'timeline' | 'list') {
  viewMode.value = v
}

onMounted(() => {
  fileStore.setSearchFlag(false)
  fileStore.setParentId('-1')
  fileStore.setFileTypes('7')
  fileStore.loadFileList()
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center gap-3 py-3">
      <h1 class="text-xl font-semibold tracking-tight text-(--color-text)">图片</h1>
      <span class="px-2 py-0.5 rounded-full font-mono text-xs" style="background-color: var(--color-surface-container-low); color: var(--color-text-muted);">
        {{ fileStore.fileList?.length || 0 }} items
      </span>
    </div>

    <div class="flex items-center justify-between gap-4 py-3 px-3 rounded-sm border border-(--color-border) bg-(--color-surface-container-low)">
      <FileButtonGroup :button-array="buttonArray" />

      <!-- 视图切换：时间线 / 列表 -->
      <div class="inline-flex items-center rounded-full p-0.5 bg-(--color-surface-2) border border-(--color-border)">
        <button
          type="button"
          class="px-3 h-7 rounded-full text-xs font-medium inline-flex items-center gap-1 transition-colors"
          :class="viewMode === 'timeline' ? 'bg-(--color-surface) text-(--color-text) shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text)'"
          @click="setViewMode('timeline')"
        >
          <LayoutGrid :size="14" /> 时间线
        </button>
        <button
          type="button"
          class="px-3 h-7 rounded-full text-xs font-medium inline-flex items-center gap-1 transition-colors"
          :class="viewMode === 'list' ? 'bg-(--color-surface) text-(--color-text) shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text)'"
          @click="setViewMode('list')"
        >
          <List :size="14" /> 列表
        </button>
      </div>
    </div>

    <!-- 夸克式时间线视图 -->
    <ImageTimeline
      v-if="viewMode === 'timeline'"
      :files="fileStore.fileList || []"
      :group-mode="groupMode"
      @update:group-mode="groupMode = $event"
    />

    <!-- 原表格视图 -->
    <FileTable v-else />
  </div>
</template>
