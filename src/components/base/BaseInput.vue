<script setup lang="ts">
/**
 * BaseInput —— 受控输入框
 *   modelValue · type · size · placeholder · disabled · readonly · clearable
 *   prefix · suffix · error · id · showPassword
 */
import { computed, ref } from 'vue'
import { X, Eye, EyeOff } from '@lucide/vue'
import { cn } from '@/utils/classnames'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  size: { type: String, default: 'md' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  clearable: { type: Boolean, default: false },
  prefix: { type: [Object, Function], default: null },
  suffix: { type: [Object, Function], default: null },
  error: { type: Boolean, default: false },
  id: { type: String, default: '' },
  showPassword: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'clear', 'enter'])
const showPw = ref(false)

const inputType = computed(() => {
  if (props.type === 'password' && props.showPassword) {
    return showPw.value ? 'text' : 'password'
  }
  return props.type
})

const showClearBtn = computed(() => props.clearable && props.modelValue !== '' && !props.disabled)
const showPwBtn = computed(() => props.type === 'password' && props.showPassword)

const sizeClass = computed(
  () =>
    ({
      sm: 'h-8 text-xs',
      md: 'h-9 text-sm',
      lg: 'h-11 text-base'
    })[props.size]
)

const padClass = computed(() => {
  const left = props.prefix || showPwBtn.value ? 'pl-2.5' : 'pl-3'
  const right = props.suffix || showClearBtn.value || showPwBtn.value ? 'pr-2.5' : 'pr-3'
  return `${left} ${right}`
})

const wrapperClass = computed(() =>
  cn(
    'group relative flex items-center w-full rounded-lg border bg-[var(--color-surface)]',
    'transition-colors duration-150 ease-[var(--ease)]',
    'focus-within:ring-2 focus-within:ring-[var(--color-ring)] focus-within:ring-offset-1 focus-within:ring-offset-[var(--color-bg)]',
    props.error
      ? 'border-[var(--color-danger)] focus-within:ring-[var(--color-danger)]'
      : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] focus-within:border-[var(--color-primary-500)]',
    props.disabled && 'opacity-50 cursor-not-allowed bg-[var(--color-surface-2)]'
  )
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
    <span
      v-if="prefix || showPwBtn"
      class="text-[var(--color-text-muted)] shrink-0 flex items-center"
      :class="prefix && showPwBtn ? 'pl-3' : prefix ? 'pl-3' : 'pl-3'"
    >
      <component v-if="prefix" :is="prefix" :size="16" />
    </span>

    <input
      :id="id"
      :type="inputType"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :class="
        cn(
          'flex-1 min-w-0 bg-transparent outline-none placeholder:text-[var(--color-text-muted)] disabled:cursor-not-allowed',
          sizeClass,
          padClass
        )
      "
      :aria-invalid="error || undefined"
      @input="onInput"
      @keydown="onKeydown"
    />

    <span v-if="showClearBtn" class="flex items-center gap-0.5 shrink-0 pr-1.5">
      <button
        type="button"
        class="size-6 flex items-center justify-center rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
        aria-label="清除"
        @click="onClear"
      >
        <X :size="14" />
      </button>
    </span>

    <span v-if="showPwBtn" class="flex items-center gap-0.5 shrink-0 pr-1.5">
      <button
        type="button"
        class="size-6 flex items-center justify-center rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
        :aria-label="showPw ? '隐藏密码' : '显示密码'"
        @click="showPw = !showPw"
      >
        <component :is="showPw ? EyeOff : Eye" :size="14" />
      </button>
    </span>

    <span v-else-if="suffix" class="pr-3 text-[var(--color-text-muted)] shrink-0 flex items-center">
      <component :is="suffix" :size="16" />
    </span>
  </div>
</template>
