<script setup lang="ts">
/**
 * BaseSelect —— 包装原生 <select>
 */
import { ChevronDown } from '@lucide/vue'

defineProps({
  modelValue: { type: [String, Number, null], default: '' },
  options: { type: Array, default: () => [] }, // [{label, value}] 或 [string]
  placeholder: { type: String, default: '请选择' },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'md' },
  error: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

function onChange(e) {
  emit('update:modelValue', e.target.value)
}

function normalize(opt) {
  if (typeof opt === 'string' || typeof opt === 'number') return { label: String(opt), value: opt }
  return opt
}
</script>

<template>
  <label
    class="relative flex items-center w-full rounded-lg border bg-[var(--color-surface)] transition-colors duration-150"
    :class="[
      error
        ? 'border-[var(--color-danger)]'
        : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] focus-within:border-[var(--color-primary-500)] focus-within:ring-2 focus-within:ring-[var(--color-ring)] focus-within:ring-offset-1',
      size === 'sm' ? 'h-8 text-xs' : size === 'lg' ? 'h-11 text-base' : 'h-9 text-sm',
      disabled && 'opacity-50 cursor-not-allowed bg-[var(--color-surface-2)]'
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
    <ChevronDown :size="16" class="mr-2 text-[var(--color-text-muted)] pointer-events-none" />
  </label>
</template>
