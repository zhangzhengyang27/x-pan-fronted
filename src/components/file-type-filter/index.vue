<script setup>
/**
 * FileTypeFilter —— 文件类型多选筛选
 * chip 形式，支持单选（-1 全部）或多选（todo: 与后端协议对齐）
 * 当前与后端一致：单选 -1 / 3 / 4 / 5 等单值
 */
import { ref, computed, onMounted } from 'vue'
import { Image as ImageIcon, FileType2 as FileText, Video, Music2, Folder, File } from '@lucide/vue'
import { useFileStore } from '@/stores/file'
import { useNavbarStore } from '@/stores/navbar'
import { useRoute } from 'vue-router'

const fileStore = useFileStore()
const navbarStore = useNavbarStore()
const route = useRoute()

const types = [
  { value: '-1', label: '全部', icon: Folder },
  { value: '7', label: '图片', icon: ImageIcon },
  { value: '3', label: '文档', icon: FileText },
  { value: '9', label: '视频', icon: Video },
  { value: '8', label: '音乐', icon: Music2 }
]

const current = ref(fileStore.fileTypes || '-1')

const visible = computed(() => {
  // 仅在 /files（全部文件）下显示
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
  <div v-if="visible" class="flex items-center gap-1.5 flex-wrap">
    <button
      v-for="t in types"
      :key="t.value"
      type="button"
      :class="[
        'inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs transition-colors',
        current === t.value
          ? 'bg-[var(--color-primary-600)] text-white shadow-xs'
          : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]'
      ]"
      @click="pick(t.value)"
    >
      <component :is="t.icon" :size="12" />
      {{ t.label }}
    </button>
  </div>
</template>
