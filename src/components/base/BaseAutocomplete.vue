<script setup lang="ts">
/**
 * BaseAutocomplete —— 自动补全输入
 * - input + 下拉面板
 * - 支持自定义过滤函数（默认不区分大小写 startsWith）
 */
import { ref, computed } from 'vue'
import type { PropType } from 'vue'
import BaseInput from '@/components/base/BaseInput.vue'

interface AutocompleteOption {
  label: string
  value: string | number
  [key: string]: unknown
}

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array as PropType<AutocompleteOption[]>, default: () => [] }, // [{label, value}]
  placeholder: { type: String, default: '搜索…' },
  fetchSuggestions: { type: Function, default: null },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [opt: AutocompleteOption]
}>()

const open = ref(false)
const highlighted = ref(0)

const filtered = computed(() => {
  const q = (props.modelValue || '').trim().toLowerCase()
  const src = props.options
  if (!q) return src.slice(0, 8)
  return src.filter((o) => o.label?.toLowerCase().includes(q)).slice(0, 8)
})

function onInput(v: string) {
  emit('update:modelValue', v)
  open.value = true
  highlighted.value = 0
}
function pick(opt: AutocompleteOption) {
  emit('update:modelValue', opt.label)
  emit('select', opt)
  open.value = false
}
function onFocus() {
  open.value = true
}
function onBlur() {
  // 延迟以允许点击 option
  setTimeout(() => (open.value = false), 120)
}
function onKeydown(e: KeyboardEvent) {
  if (!open.value || filtered.value.length === 0) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlighted.value = (highlighted.value + 1) % filtered.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlighted.value = (highlighted.value - 1 + filtered.value.length) % filtered.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    pick(filtered.value[highlighted.value])
  } else if (e.key === 'Escape') {
    open.value = false
  }
}
</script>

<template>
  <div class="relative w-full">
    <BaseInput
      :model-value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      autocomplete="off"
      @update:model-value="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeydown"
    />
    <ul
      v-if="open && filtered.length > 0"
      class="absolute left-0 right-0 top-full mt-2 z-(--z-popover) max-h-64 overflow-y-auto rounded-xl border border-(--color-border) bg-(--color-surface) shadow-lg py-1"
      role="listbox"
    >
      <li
        v-for="(opt, i) in filtered"
        :key="opt.value ?? i"
        role="option"
        :aria-selected="highlighted === i"
        :class="[
          'px-3 py-2 text-sm cursor-pointer transition-colors',
          highlighted === i
            ? 'bg-primary-50 text-primary-700'
            : 'hover:bg-(--color-surface-2)'
        ]"
        @mousedown.prevent="pick(opt)"
      >
        {{ opt.label }}
      </li>
    </ul>
  </div>
</template>
