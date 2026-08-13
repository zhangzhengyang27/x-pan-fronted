<script setup lang="ts">
/**
 * FileTypeFilter —— 文件类型筛选 chips
 * 设计规范：stitch_document_driven_page_design/03_g3.md
 * - rounded-full chips
 * - 选中态：bg-primary-container text-on-primary-container
 */
import { computed, onMounted } from 'vue'
import { Image as ImageIcon, FileType as FileText, Video, Music, Folder } from '@lucide/vue'
import { useFileStore } from '@/stores/file'
import { useRoute, useRouter } from 'vue-router'

const fileStore = useFileStore()
const route = useRoute()
const router = useRouter()

// P2-8: types 同时持有 fileTypes(value) 与 query.type(query)，与 file/index.vue 映射一致
const types = [
  { value: '-1', query: '', label: '全部', icon: Folder },
  { value: '7', query: 'imgs', label: '图片', icon: ImageIcon },
  { value: '3,4,5,6,10', query: 'docs', label: '文档', icon: FileText },
  { value: '9', query: 'videos', label: '视频', icon: Video },
  { value: '8', query: 'musics', label: '音乐', icon: Music },
  { value: '0', query: 'other', label: '其他', icon: null }
]

// current 由 route.query.type 驱动，保证高亮与 URL 同步
const current = computed(() => {
  const q = Array.isArray(route.query.type) ? route.query.type[0] : route.query.type
  if (!q) return '-1'
  const found = types.find((t) => t.query === q)
  return found ? found.value : '-1'
})

const visible = computed(() => {
  return route.name === 'Files' && !fileStore.searchFlag
})

function pick(t) {
  if (current.value === t.value) return
  // P2-8: 更新 query.type，由 file/index.vue 的 watch 统一应用筛选并保留目录上下文
  router.replace({ path: '/files', query: t.query ? { type: t.query } : {} })
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
          ? 'bg-(--color-primary-container) text-(--color-on-primary-container) border border-transparent'
          : 'bg-(--color-surface-container) border border-(--color-border) text-(--color-text) hover:bg-(--color-surface-container-high)'
      ]"
      @click="pick(t)"
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
