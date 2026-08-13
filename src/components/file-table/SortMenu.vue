<script setup lang="ts">
/**
 * SortMenu —— 排序菜单弹窗
 * 结构：字段列表（单选） + 分隔线 + 正序/倒序（单选）
 */
import { computed } from 'vue'
import { ArrowUpDown, Check } from '@lucide/vue'
import BasePopover from '@/components/base/BasePopover.vue'
import { useFileStore } from '@/stores/file'
import type { SortOrder } from '@/composables/useTableSort'
import { storeToRefs } from 'pinia'

const fileStore = useFileStore()
const { sortProp, sortOrder } = storeToRefs(fileStore)

const open = defineModel('open', { type: Boolean, default: false })

interface FieldOption {
  key: string
  label: string
}

/** 排序字段：与后端 SafeOrderBy 白名单一致 */
const fields: FieldOption[] = [
  { key: '', label: '综合排序' },
  { key: 'filename', label: '按文件名' },
  { key: 'updateTime', label: '按修改时间' },
  { key: 'createTime', label: '按创建时间' },
  { key: 'fileSize', label: '按文件大小' }
]

const directions: { value: SortOrder; label: string }[] = [
  { value: 'ascending', label: '正序' },
  { value: 'descending', label: '倒序' }
]

// 按钮始终显示“图标+排序”，选中态通过高亮样式体现
const currentLabel = computed(() => '排序')

function selectField(key: string) {
  if (key === '') {
    fileStore.sortProp = ''
    // 方向保留但不再生效；UI 上仍显示之前选的方向
    return
  }
  fileStore.sortProp = key
  if (!sortOrder.value) fileStore.sortOrder = 'ascending'
  // 不关闭弹窗，方便连续选择方向
}

function selectDirection(order: SortOrder) {
  fileStore.sortOrder = order
  if (!sortProp.value) fileStore.sortProp = 'filename'
  // 不关闭弹窗，方便连续确认/修改字段
}

function clearSort() {
  fileStore.sortProp = ''
  fileStore.sortOrder = null
  open.value = false
}

const active = computed(() => !!sortProp.value && !!sortOrder.value)
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
        <ArrowUpDown :size="14" />
        <span>{{ currentLabel }}</span>
      </button>
    </template>

    <div class="py-1 min-w-[160px]">
      <!-- 字段列表 -->
      <button
        v-for="f in fields"
        :key="f.key || 'default'"
        type="button"
        class="w-full flex items-center justify-between px-4 py-2 text-sm transition-colors"
        :class="
          sortProp === f.key
            ? 'text-primary-500'
            : 'text-(--color-text) hover:bg-(--color-surface-2)'
        "
        @click="selectField(f.key)"
      >
        <span>{{ f.label }}</span>
        <Check
          v-if="sortProp === f.key"
          :size="14"
        />
      </button>

      <!-- 分隔线 -->
      <div class="my-1 border-t border-(--color-border)" />

      <!-- 正序 / 倒序 -->
      <button
        v-for="d in directions"
        :key="d.value"
        type="button"
        class="w-full flex items-center justify-between px-4 py-2 text-sm transition-colors"
        :class="
          sortOrder === d.value
            ? 'text-primary-500'
            : 'text-(--color-text) hover:bg-(--color-surface-2)'
        "
        @click="selectDirection(d.value)"
      >
        <span>{{ d.label }}</span>
        <Check
          v-if="sortOrder === d.value"
          :size="14"
        />
      </button>

      <!-- 重置 -->
      <div
        v-if="sortProp || sortOrder"
        class="mt-1 pt-1 border-t border-(--color-border)"
      >
        <button
          type="button"
          class="w-full px-4 py-2 text-sm text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-2) transition-colors text-left"
          @click="clearSort"
        >
          默认排序
        </button>
      </div>
    </div>
  </BasePopover>
</template>
