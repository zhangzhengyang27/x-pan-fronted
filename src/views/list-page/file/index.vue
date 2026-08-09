<script setup>
/**
 * AppFileListPage —— 主文件列表页（带视图切换）
 */
import {onMounted, ref, provide} from 'vue'
import {LayoutGrid, List} from '@lucide/vue'
import FileButtonGroup from '@/components/file-button-group/index.vue'
import BreadCrumb from '@/components/breadcrumb/index.vue'
import FileTable from '@/components/file-table/index.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import {useFileStore} from '@/stores/file'
import {useBreadcrumbStore} from '@/stores/breadcrumb'
import {storeToRefs} from 'pinia'

const fileStore = useFileStore()
const breadcrumbStore = useBreadcrumbStore()
const {searchFlag, defaultParentId, defaultParentFilename} = storeToRefs(fileStore)

const view = ref('list')

const buttonArray = ref(['upload', 'createFolder', 'download', 'delete', 'rename', 'share', 'copy', 'transfer'])

onMounted(() => {
  if (!searchFlag.value) {
    const firstItem = {id: defaultParentId.value, name: defaultParentFilename.value}
    breadcrumbStore.clear()
    breadcrumbStore.addItem(firstItem)
    fileStore.refreshParentId()
    fileStore.setFileTypes('-1')
    fileStore.loadFileList()
  }
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <!-- 工具条 -->
    <div class="flex items-center justify-between gap-4 py-3">
      <FileButtonGroup :button-array="buttonArray"/>
      <div class="flex items-center gap-1 p-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <BaseTooltip text="列表视图" position="bottom">
          <button
            type="button"
            class="size-7 flex items-center justify-center rounded-md transition-colors"
            :class="view === 'list' ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] dark:bg-[var(--color-primary-900)]/30 dark:text-[var(--color-primary-300)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'"
            aria-label="列表视图"
            @click="view = 'list'"
          >
            <List :size="14"/>
          </button>
        </BaseTooltip>
        <BaseTooltip text="网格视图" position="bottom">
          <button
            type="button"
            class="size-7 flex items-center justify-center rounded-md transition-colors"
            :class="view === 'grid' ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] dark:bg-[var(--color-primary-900)]/30 dark:text-[var(--color-primary-300)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'"
            aria-label="网格视图"
            @click="view = 'grid'"
          >
            <LayoutGrid :size="14"/>
          </button>
        </BaseTooltip>
      </div>
    </div>

    <BreadCrumb/>
    <FileTable :key="view"/>
  </div>
</template>