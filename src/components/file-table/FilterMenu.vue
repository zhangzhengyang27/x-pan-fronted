<script setup lang="ts">
/**
 * FilterMenu —— 筛选菜单弹窗
 * 仅保留文件类型（图片/文档/视频/音乐）筛选，样式与 SortMenu 统一
 * 应用筛选 → emit filter-change
 */
import { computed, ref } from 'vue'
import { Funnel, Check } from '@lucide/vue'
import BasePopover from '@/components/base/BasePopover.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { FileType } from '@/types'

const emit = defineEmits(['filter-change'])
const open = defineModel('open', { type: Boolean, default: false })

interface TypeOption {
  label: string
  value: FileType
}

const typeOptions: TypeOption[] = [
  { label: '图片', value: FileType.IMAGE },
  { label: '文档', value: FileType.DOC },
  { label: '视频', value: FileType.VIDEO },
  { label: '音乐', value: FileType.AUDIO }
]

const filter = ref({
  extensions: [] as string[],
  fileTypes: [] as FileType[],
  sizeMin: '',
  sizeMax: '',
  dateFrom: '',
  dateTo: ''
})

const active = computed(() => filter.value.fileTypes.length > 0)
const count = computed(() => filter.value.fileTypes.length)

// 全部文件：清空类型筛选（与下方分类互斥）
const allSelected = computed(() => filter.value.fileTypes.length === 0)

function selectAll() {
  filter.value.fileTypes = []
}

function toggleType(type: FileType) {
  const i = filter.value.fileTypes.indexOf(type)
  if (i === -1) filter.value.fileTypes.push(type)
  else filter.value.fileTypes.splice(i, 1)
}

function apply() {
  emit('filter-change', { ...filter.value })
  open.value = false
}

function reset() {
  filter.value = {
    extensions: [],
    fileTypes: [],
    sizeMin: '',
    sizeMax: '',
    dateFrom: '',
    dateTo: ''
  }
  emit('filter-change', { ...filter.value })
  open.value = false
}
</script>

<template>
  <BasePopover v-model="open" placement="bottom-start" :width="200">
    <template #trigger>
      <button
        type="button"
        class="inline-flex items-center gap-1 h-8 px-2.5 rounded-sm border border-(--color-border) bg-(--color-surface) text-[13px] font-medium transition-colors"
        :class="
          active
            ? 'border-primary-500 text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30'
            : 'text-(--color-text) hover:bg-(--color-surface-2)'
        "
      >
        <Funnel :size="14" />
        <span>筛选</span>
      </button>
    </template>

    <div class="py-1 min-w-[160px]">
      <button
        type="button"
        class="w-full flex items-center justify-between px-4 py-2 text-sm transition-colors"
        :class="
          allSelected
            ? 'text-primary-500'
            : 'text-(--color-text) hover:bg-(--color-surface-2)'
        "
        @click="selectAll"
      >
        <span>全部文件</span>
        <Check v-if="allSelected" :size="14" />
      </button>

      <div class="my-1 border-t border-(--color-border)" />

      <button
        v-for="opt in typeOptions"
        :key="opt.value"
        type="button"
        class="w-full flex items-center justify-between px-4 py-2 text-sm transition-colors"
        :class="
          filter.fileTypes.includes(opt.value)
            ? 'text-primary-500'
            : 'text-(--color-text) hover:bg-(--color-surface-2)'
        "
        @click="toggleType(opt.value)"
      >
        <span>{{ opt.label }}</span>
        <Check
          v-if="filter.fileTypes.includes(opt.value)"
          :size="14"
        />
      </button>

      <div class="my-1 border-t border-(--color-border)" />

      <div class="flex items-center justify-end gap-2 px-4 py-2">
        <button
          type="button"
          class="text-xs text-(--color-text-muted) hover:text-(--color-text)"
          @click="reset"
        >清空</button>
        <BaseButton variant="primary" size="sm" @click="apply">应用</BaseButton>
      </div>
    </div>
  </BasePopover>
</template>
