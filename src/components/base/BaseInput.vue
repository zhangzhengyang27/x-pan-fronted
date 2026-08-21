<script setup lang="ts">
/**
 * BaseInput —— 受控输入框（夸克风格）
 */
import { computed, ref } from 'vue'
import { X, Eye, EyeOff } from '@lucide/vue'

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
  showPassword: { type: Boolean, default: false },
  // 新增:阻止浏览器/密码管理器把搜索框/普通输入误识别为登录凭据
  autocomplete: { type: String, default: 'off' },
  name: { type: String, default: '' },
  inputMode: { type: String, default: undefined }
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
  () => ({
    sm: 'h-8 text-xs',
    md: 'h-9 text-sm',
    lg: 'h-10 text-base'
  })[props.size]
)

const wrapperClass = computed(() => {
  const base = 'group relative flex items-center w-full rounded-sm border bg-transparent transition-colors duration-100'
  const errorClass = props.error
    ? 'border-danger focus-within:ring-2 focus-within:ring-danger/20'
    : 'border-(--color-border) hover:border-(--color-border-strong) focus-within:border-(--color-border-focus) focus-within:ring-2 focus-within:ring-(--color-ring)/20'
  const disabledClass = props.disabled ? 'opacity-50 cursor-not-allowed' : ''
  return `${base} ${errorClass} ${disabledClass}`
})

const inputClass = computed(() => {
  const base = 'flex-1 min-w-0 bg-transparent outline-none transition-colors text-(--color-text) placeholder-(--color-text-muted)'
  const disabledClass = props.disabled ? 'cursor-not-allowed' : ''
  const padLeft = props.prefix || showPwBtn.value ? 'pl-3' : 'pl-3'
  const padRight = showClearBtn.value || showPwBtn.value ? 'pr-3' : 'pr-3'
  return `${base} ${sizeClass.value} ${padLeft} ${padRight} ${disabledClass}`
})

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
function onClear() {
  emit('update:modelValue', '')
  emit('clear')
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') emit('enter', e)
}

const inputRef = ref<HTMLInputElement | null>(null)
function focus() {
  inputRef.value?.focus()
}
defineExpose({ focus })
</script>

<template>
  <div :class="wrapperClass">
    <span v-if="prefix" class="shrink-0 flex items-center pl-3 transition-colors">
      <component :is="prefix" :size="16" :stroke-width="2" class="text-(--color-text-muted)" />
    </span>

    <input
      ref="inputRef"
      :id="id"
      :type="inputType"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :class="inputClass"
      :autocomplete="autocomplete"
      :name="name"
      :inputmode="(inputMode as 'text' | 'search' | 'email' | 'tel' | 'url' | 'none' | 'numeric' | 'decimal' | undefined) || undefined"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      :aria-invalid="error || undefined"
      data-form-type="other"
      data-lpignore="true"
      data-1p-ignore="true"
      @input="onInput"
      @keydown="onKeydown"
    />

    <span v-if="showClearBtn" class="shrink-0 flex items-center pr-2">
      <button
        type="button"
        class="size-5 flex items-center justify-center rounded text-(--color-text-muted) hover:text-(--color-text) transition-colors"
        aria-label="清除"
        @click="onClear"
      >
        <X :size="13" :stroke-width="2" />
      </button>
    </span>

    <span v-else-if="showPwBtn" class="shrink-0 flex items-center pr-2">
      <button
        type="button"
        class="size-5 flex items-center justify-center rounded text-(--color-text-muted) hover:text-(--color-text) transition-colors"
        :aria-label="showPw ? '隐藏密码' : '显示密码'"
        @click="showPw = !showPw"
      >
        <component :is="showPw ? EyeOff : Eye" :size="13" :stroke-width="2" />
      </button>
    </span>

    <span v-else-if="suffix" class="shrink-0 flex items-center pr-3">
      <component :is="suffix" :size="16" :stroke-width="2" class="text-(--color-text-muted)" />
    </span>
  </div>
</template>
