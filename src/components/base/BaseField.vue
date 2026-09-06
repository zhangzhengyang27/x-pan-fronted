<script setup lang="ts">
/**
 * BaseField —— label + 控件 + 错误信息三段式包装
 * 设计规范：G 设计风格
 * 不绑定具体 input 控件，通过默认插槽让用户传入任意控件
 */
import { computed } from 'vue'
import { cn } from '@/utils/classnames'

const props = defineProps({
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
    <div v-if="label" class="flex items-center justify-between">
      <label
        :for="labelId"
        class="text-sm font-medium text-(--color-text)"
      >
        {{ label }}
        <span v-if="required" style="color: var(--color-danger);" aria-hidden="true">*</span>
      </label>
      <slot name="label-extra" />
    </div>
    <slot :id="labelId" />
    <p v-if="hint && !error" class="text-xs text-(--color-text-muted)">
      {{ hint }}
    </p>
    <p v-if="error" class="text-xs" style="color: var(--color-danger);" role="alert">
      {{ error }}
    </p>
    <slot name="hint" />
  </div>
</template>
