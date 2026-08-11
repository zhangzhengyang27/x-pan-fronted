<script setup lang="ts">
/**
 * FileTypeFilter —— 文件类型筛选 chips
 * 设计规范：stitch_document_driven_page_design/03_g3.md
 * - rounded-full chips
 * - 选中态：bg-primary-container text-on-primary-container
 */
import { ref, computed, onMounted } from 'vue'
import { Image as ImageIcon, FileType as FileText, Video, Music, Folder } from '@lucide/vue'
import { useFileStore } from '@/stores/file'
import { useRoute } from 'vue-router'

const fileStore = useFileStore()
const route = useRoute()

const types = [
  { value: '-1', label: '全部', icon: Folder },
  { value: '7', label: '图片', icon: ImageIcon },
  { value: '3', label: '文档', icon: FileText },
  { value: '9', label: '视频', icon: Video },
  { value: '8', label: '音乐', icon: Music },
  { value: '0', label: '其他', icon: null }
]

const current = ref(fileStore.fileTypes || '-1')

const visible = computed(() => {
  return route.name === 'Files' && !fileStore.searchFlag
})

function pick(t) {
  if (current.value === t) return
  current.value = t
  fileStore.setFileTypes(t)
  fileStore.loadFileList()
}

onMounted(() => {
  if (!fileStore.fileTypes) fileStore.setFileTypes('-1')
})
</script>

<template>
  <div v-if="visible" class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
    <button
      v-for="t in types"
      :key="t.value"
      type="button"
      class="inline-flex items-center gap-1.5 h-8 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors"
      :class="[
        current === t.value
          ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] border border-transparent'
          : 'bg-[var(--color-surface-container)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-container-high)]'
      ]"
      @click="pick(t.value)"
    >
      <component v-if="t.icon" :is="t.icon" :size="14" :stroke-width="2" />
      {{ t.label }}
    </button>
  </div>
</template>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
