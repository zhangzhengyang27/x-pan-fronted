<script setup lang="ts">
/**
 * BaseCheckbox —— 单个 / 受控复选框
 * v-model 为 boolean
 */
import { Check, Minus } from '@lucide/vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  indeterminate: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  label: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <label
    class="inline-flex items-center gap-2 cursor-pointer select-none text-sm"
    :class="disabled && 'opacity-50 cursor-not-allowed'"
  >
    <span
      class="relative size-4 rounded border flex items-center justify-center transition-colors"
      :class="
        modelValue || indeterminate
          ? 'bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white'
          : 'border-[var(--color-border-strong)] bg-[var(--color-surface)]'
      "
    >
      <Check v-if="modelValue && !indeterminate" :size="12" :stroke-width="3" />
      <Minus v-else-if="indeterminate" :size="12" :stroke-width="3" />
    </span>
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      class="sr-only"
      @change="toggle"
    />
    <span v-if="label">{{ label }}</span>
  </label>
</template>
