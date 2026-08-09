<script setup>
/**
 * BaseRadioGroup —— 单选组
 * 方向：horizontal | vertical
 */
import {computed} from 'vue'
import {cn} from '@/utils/classnames'

const props = defineProps({
  modelValue: {type: [String, Number, null], default: ''},
  options: {type: Array, default: () => []}, // [{label, value, disabled}]
  direction: {type: String, default: 'horizontal'},
  disabled: {type: Boolean, default: false},
})
const emit = defineEmits(['update:modelValue'])

function pick(value) {
  if (props.disabled) return
  emit('update:modelValue', value)
}
</script>

<template>
  <div
    :class="cn(
      'flex gap-4',
      direction === 'vertical' ? 'flex-col' : 'flex-row flex-wrap',
    )"
    role="radiogroup"
  >
    <label
      v-for="opt in options"
      :key="opt.value"
      class="inline-flex items-center gap-2 cursor-pointer select-none text-sm"
      :class="disabled && 'opacity-50 cursor-not-allowed'"
    >
      <span
        class="relative size-4 rounded-full border flex items-center justify-center transition-colors"
        :class="modelValue === opt.value
          ? 'border-[var(--color-primary-600)] bg-[var(--color-primary-600)]'
          : 'border-[var(--color-border-strong)] bg-[var(--color-surface)]'"
      >
        <span
          v-if="modelValue === opt.value"
          class="size-1.5 rounded-full bg-white"
          aria-hidden="true"
        />
      </span>
      <input
        type="radio"
        :value="opt.value"
        :checked="modelValue === opt.value"
        :disabled="disabled || opt.disabled"
        class="sr-only"
        @change="pick(opt.value)"
      >
      {{ opt.label }}
    </label>
  </div>
</template>