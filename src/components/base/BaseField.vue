<script setup>
/**
 * BaseField —— label + 控件 + 错误信息三段式包装
 * 不绑定具体 input 控件，通过默认插槽让用户传入任意控件
 */
import { computed } from 'vue'
import { cn } from '@/utils/classnames'

defineProps({
  label: { type: String, default: '' },
  required: { type: Boolean, default: false },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
  block: { type: Boolean, default: true }
})

const labelId = computed(() => `field-${Math.random().toString(36).slice(2, 9)}`)
</script>

<template>
  <div :class="cn('flex flex-col gap-1.5', block && 'w-full')">
    <label
      v-if="label"
      :for="labelId"
      class="text-sm font-medium text-[var(--color-text)] flex items-center gap-1"
    >
      {{ label }}
      <span v-if="required" class="text-[var(--color-danger)]" aria-hidden="true">*</span>
    </label>
    <slot :id="labelId" />
    <p v-if="hint && !error" class="text-xs text-[var(--color-text-muted)]">{{ hint }}</p>
    <p v-if="error" class="text-xs text-[var(--color-danger)]" role="alert">{{ error }}</p>
  </div>
</template>
