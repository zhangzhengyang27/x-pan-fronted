<script setup lang="ts">
/**
 * FilterDialog —— 筛选下拉弹窗
 */
import { X } from '@lucide/vue'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'

const fileStore = useFileStore()
const { fileTypes } = storeToRefs(fileStore)

defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const filterOptions = [
  { value: '-1', label: '全部' },
  { value: '7', label: '图片' },
  { value: '3,4,10', label: '文档' },
  { value: '9', label: '视频' },
  { value: '8', label: '音频' }
]

function select(val: string) {
  fileStore.setFileTypes(val)
  fileStore.loadFileList()
  emit('close')
}
</script>

<template>
  <Transition name="modal">
    <div
      v-if="open"
      class="absolute right-0 top-full mt-1 w-[140px] rounded-sm shadow-2xl overflow-hidden z-100"
      style="background-color: var(--color-surface); border: 1px solid var(--color-border);"
      @click.stop
    >
      <!-- 选项列表 -->
      <div class="px-3 py-2">
        <div
          v-for="opt in filterOptions"
          :key="opt.value"
          class="flex items-center justify-between py-2.5 cursor-pointer rounded-sm px-3 transition-colors"
          :class="fileTypes === opt.value ? 'bg-(--color-surface-2)' : 'hover:bg-(--color-hover)'"
          @click="select(opt.value)"
        >
          <span
            class="text-sm"
            :style="fileTypes === opt.value ? 'color: var(--color-primary-500); font-weight: 500;' : 'color: var(--color-text);'"
          >
            {{ opt.label }}
          </span>
          <span
            v-if="fileTypes === opt.value"
            class="text-xs"
            style="color: var(--color-primary-500);"
          >✓</span>
        </div>
      </div>
    </div>
  </Transition>
</template>
