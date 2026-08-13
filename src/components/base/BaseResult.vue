<script setup lang="ts">
/**
 * BaseResult —— 结果页（成功/失败/信息/警告）
 */
import type { PropType } from 'vue'
import type { Component } from 'vue'
import { CircleCheck, CircleX, Info, AlertTriangle } from '@lucide/vue'

type ResultStatus = 'success' | 'error' | 'info' | 'warning'

defineProps({
  status: { type: String as PropType<ResultStatus>, default: 'info' }, // success | error | info | warning
  title: { type: String, default: '' },
  description: { type: String, default: '' }
})

const iconMap: Record<ResultStatus, Component> = {
  success: CircleCheck,
  error: CircleX,
  info: Info,
  warning: AlertTriangle
}
const colorMap: Record<ResultStatus, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-info',
  warning: 'text-warning'
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
    <p v-if="description" class="text-sm text-(--color-text-muted) m-0 max-w-md">
      {{ description }}
    </p>
    <div v-if="$slots.extra" class="mt-6 flex gap-3">
      <slot name="extra" />
    </div>
  </div>
</template>
