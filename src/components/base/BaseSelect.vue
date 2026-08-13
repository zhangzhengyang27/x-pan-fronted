<script setup lang="ts">
/**
 * BaseSelect —— 包装原生 <select>
 */
import type { PropType } from 'vue'
import { ChevronDown } from '@lucide/vue'

interface SelectOption {
  label: string
  value: string | number
  [key: string]: unknown
}

defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array as PropType<Array<SelectOption | string | number>>, default: () => [] }, // [{label, value}] 或 [string]
  placeholder: { type: String, default: '请选择' },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'md' },
  error: { type: Boolean, default: false }
})
const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value)
}

function normalize(opt: SelectOption | string | number): SelectOption {
  if (typeof opt === 'string' || typeof opt === 'number') return { label: String(opt), value: opt }
  return opt
}
</script>

<template>
  <label
    class="relative flex items-center w-full rounded-sm border bg-(--color-surface) transition-colors duration-150"
    :class="[
      error
        ? 'border-danger'
        : 'border-(--color-border) hover:border-(--color-border-strong) focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-(--color-ring) focus-within:ring-offset-1',
      size === 'sm' ? 'h-8 text-xs' : size === 'lg' ? 'h-11 text-base' : 'h-9 text-sm',
      disabled && 'opacity-50 cursor-not-allowed bg-(--color-surface-2)'
    ]"
  >
    <select
      :value="modelValue"
      :disabled="disabled"
      class="appearance-none bg-transparent outline-none flex-1 px-3 cursor-pointer disabled:cursor-not-allowed"
      @change="onChange"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="(opt, i) in options" :key="i" :value="normalize(opt).value">
        {{ normalize(opt).label }}
      </option>
    </select>
    <ChevronDown :size="16" class="mr-2 text-(--color-text-muted) pointer-events-none" />
  </label>
</template>
