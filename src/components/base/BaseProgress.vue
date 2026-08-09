<script setup>
/**
 * BaseProgress —— 进度条
 * value: 0-100
 * status: primary | success | warning | danger
 */
import {computed} from 'vue'
import {cn} from '@/utils/classnames'

const props = defineProps({
  value: {type: Number, default: 0},
  status: {type: String, default: 'primary'},
  showText: {type: Boolean, default: false},
  size: {type: String, default: 'md'}, // sm | md | lg
})

const colorClass = computed(() => ({
  primary: 'bg-[var(--color-primary-600)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger:  'bg-[var(--color-danger)]',
}[props.status]))

const heightClass = computed(() => ({sm: 'h-1', md: 'h-2', lg: 'h-3'}[props.size]))
const safe = computed(() => Math.max(0, Math.min(100, props.value)))
</script>

<template>
  <div class="w-full">
    <div :class="cn('w-full rounded-full bg-[var(--color-surface-2)] overflow-hidden', heightClass)">
      <div
        :class="cn('h-full rounded-full transition-[width] duration-300 ease-[var(--ease)]', colorClass)"
        :style="{width: `${safe}%`}"
        role="progressbar"
        :aria-valuenow="safe"
        aria-valuemin="0"
        aria-valuemax="100"
      />
    </div>
    <div v-if="showText" class="mt-1 text-xs text-[var(--color-text-muted)] text-right tabular-nums">
      {{ safe }}%
    </div>
  </div>
</template>