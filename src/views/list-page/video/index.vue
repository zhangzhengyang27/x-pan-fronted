<script setup lang="ts">
/**
 * VideoListPage —— 视频类型列表（专属视图：卡片海报网格 + 内嵌播放）
 */
import FileButtonGroup from '@/components/file-button-group/index.vue'
import FileTable from '@/components/file-table/index.vue'
import VideoViewer from '@/components/file-table/VideoViewer.vue'
import { LayoutGrid, List, Clapperboard } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import { useFileStore } from '@/stores/file'

const fileStore = useFileStore()
const buttonArray = ref(['upload', 'download', 'delete', 'rename', 'share', 'copy', 'transfer'])

// 视图模式：grid=专属卡片 / list=传统列表
const viewMode = ref<'grid' | 'list'>('grid')

onMounted(() => {
  fileStore.setSearchFlag(false)
  fileStore.setParentId('-1')
  fileStore.setFileTypes('9')
  fileStore.loadFileList()
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center gap-3 py-3">
      <h1 class="text-xl font-semibold tracking-tight text-(--color-text) inline-flex items-center gap-2">
        <Clapperboard :size="20" class="text-primary-500" /> 视频
      </h1>
      <span class="px-2 py-0.5 rounded-full font-mono text-xs" style="background-color: var(--color-surface-container-low); color: var(--color-text-muted);">
        {{ fileStore.fileList?.length || 0 }} items
      </span>
    </div>
    <div class="flex items-center justify-between gap-4 py-3 px-3 rounded-md border border-(--color-border) bg-(--color-surface-container-low)">
      <FileButtonGroup :button-array="buttonArray" />

      <!-- 视图切换：卡片 / 列表 -->
      <div class="inline-flex items-center rounded-md p-0.5 bg-(--color-surface-2) border border-(--color-border)">
        <button
          type="button"
          class="px-3 h-7 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors"
          :class="viewMode === 'grid' ? 'bg-(--color-surface) text-(--color-text) shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text)'"
          @click="viewMode = 'grid'"
        >
          <LayoutGrid :size="14" /> 卡片
        </button>
        <button
          type="button"
          class="px-3 h-7 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors"
          :class="viewMode === 'list' ? 'bg-(--color-surface) text-(--color-text) shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text)'"
          @click="viewMode = 'list'"
        >
          <List :size="14" /> 列表
        </button>
      </div>
    </div>

    <!-- 专属视图：视频卡片 -->
    <VideoViewer v-if="viewMode === 'grid'" />

    <!-- 传统列表视图 -->
    <FileTable v-else />
  </div>
</template>
