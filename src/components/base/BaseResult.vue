<script setup lang="ts">
/**
 * BaseResult —— 结果页（成功/失败/信息/警告）
 */
import { CircleCheck, CircleX, Info, AlertTriangle } from '@lucide/vue'

defineProps({
  status: { type: String, default: 'info' }, // success | error | info | warning
  title: { type: String, default: '' },
  description: { type: String, default: '' }
})

const iconMap = { success: CircleCheck, error: CircleX, info: Info, warning: AlertTriangle }
const colorMap = {
  success: 'text-[var(--color-success)]',
  error: 'text-[var(--color-danger)]',
  info: 'text-[var(--color-info)]',
  warning: 'text-[var(--color-warning)]'
}
</script>

<template>
  <div class="flex flex-col items-center text-center py-12 px-6">
    <component
      :is="iconMap[status]"
      :size="72"
      :stroke-width="1.5"
      :class="colorMap[status]"
      class="mb-4"
    />
    <h1 class="text-2xl font-semibold m-0 mb-2">{{ title }}</h1>
    <p v-if="description" class="text-sm text-[var(--color-text-muted)] m-0 max-w-md">
      {{ description }}
    </p>
    <div v-if="$slots.extra" class="mt-6 flex gap-3">
      <slot name="extra" />
    </div>
  </div>
</template>
