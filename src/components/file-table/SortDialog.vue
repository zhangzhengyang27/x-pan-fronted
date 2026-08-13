<script setup lang="ts">
/**
 * SortDialog —— 排序下拉弹窗
 */
import { X } from '@lucide/vue'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'

const fileStore = useFileStore()
const { sortProp, sortOrder } = storeToRefs(fileStore)

defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const sortOptions = [
  { value: 'filename', label: '文件名' },
  { value: 'fileSize', label: '文件大小' },
  { value: 'uploadTime', label: '上传时间' },
  { value: 'lastOpTime', label: '修改时间' }
]

function select(field: string) {
  fileStore.toggleSort(field)
  fileStore.loadFileList()
  emit('close')
}
</script>

<template>
  <Transition name="modal">
    <div
      v-if="open"
      class="absolute right-0 top-full mt-1 w-[160px] rounded-sm shadow-2xl overflow-hidden z-100"
      style="background-color: var(--color-surface); border: 1px solid var(--color-border);"
      @click.stop
    >
      <!-- 选项列表 -->
      <div class="px-3 py-2">
        <div
          v-for="opt in sortOptions"
          :key="opt.value"
          class="flex items-center justify-between py-2.5 cursor-pointer rounded-sm px-3 transition-colors"
          :class="sortProp === opt.value ? 'bg-(--color-surface-2)' : 'hover:bg-(--color-hover)'"
          @click="select(opt.value)"
        >
          <span
            class="text-sm"
            :style="sortProp === opt.value ? 'color: var(--color-primary-500); font-weight: 500;' : 'color: var(--color-text);'"
          >
            {{ opt.label }}
          </span>
          <span
            v-if="sortProp === opt.value"
            class="text-xs font-medium"
            style="color: var(--color-primary-500);"
          >
            {{ sortOrder === 'ascending' ? '↑升序' : '↓降序' }}
          </span>
        </div>
      </div>
    </div>
  </Transition>
</template>
