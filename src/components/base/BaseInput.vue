<script setup>
/**
 * BaseInput —— 受控输入框
 * Props:
 *   modelValue: string | number
 *   type: text | password | email | number | search
 *   size: sm | md | lg
 *   placeholder, disabled, readonly, clearable, prefix, suffix, error
 */
import {computed} from 'vue'
import {Search, X} from '@lucide/vue'
import {cn} from '@/utils/classnames'

const props = defineProps({
  modelValue: {type: [String, Number], default: ''},
  type: {type: String, default: 'text'},
  size: {type: String, default: 'md'},
  placeholder: {type: String, default: ''},
  disabled: {type: Boolean, default: false},
  readonly: {type: Boolean, default: false},
  clearable: {type: Boolean, default: false},
  prefix: {type: [Object, Function], default: null},
  suffix: {type: [Object, Function], default: null},
  error: {type: Boolean, default: false},
  id: {type: String, default: ''},
})

const emit = defineEmits(['update:modelValue', 'clear', 'enter'])

const sizeClass = computed(() => ({
  sm: 'h-8 text-xs px-2.5',
  md: 'h-9 text-sm px-3',
  lg: 'h-11 text-base px-4',
}[props.size]))

const wrapperClass = computed(() =>
  cn(
    'group relative flex items-center w-full rounded-lg border bg-[var(--color-surface)]',
    'transition-colors duration-150 ease-[var(--ease)]',
    'focus-within:ring-2 focus-within:ring-[var(--color-ring)] focus-within:ring-offset-1 focus-within:ring-offset-[var(--color-bg)]',
    props.error
      ? 'border-[var(--color-danger)] focus-within:ring-[var(--color-danger)]'
      : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] focus-within:border-[var(--color-primary-500)]',
    props.disabled && 'opacity-50 cursor-not-allowed bg-[var(--color-surface-2)]',
  ),
)

function onInput(e) {
  emit('update:modelValue', e.target.value)
}
function onClear() {
  emit('update:modelValue', '')
  emit('clear')
}
function onKeydown(e) {
  if (e.key === 'Enter') emit('enter', e)
}
</script>

<template>
  <div :class="wrapperClass">
    <span v-if="prefix" class="pl-3 text-[var(--color-text-muted)] shrink-0 flex items-center">
      <component :is="prefix" :size="16"/>
    </span>
    <input
      :id="id"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :class="cn(
        'flex-1 min-w-0 bg-transparent outline-none placeholder:text-[var(--color-text-muted)]',
        'disabled:cursor-not-allowed',
        sizeClass,
        (prefix || suffix || clearable) && (sizeClass.includes('px-') ? '' : '')
      )"
      :aria-invalid="error || undefined"
      @input="onInput"
      @keydown="onKeydown"
    />
    <button
      v-if="clearable && modelValue !== '' && !disabled"
      type="button"
      class="mr-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] shrink-0 flex items-center"
      aria-label="清除"
      @click="onClear"
    >
      <X :size="14"/>
    </button>
    <span v-else-if="suffix" class="pr-3 text-[var(--color-text-muted)] shrink-0 flex items-center">
      <component :is="suffix" :size="16"/>
    </span>
  </div>
</template>