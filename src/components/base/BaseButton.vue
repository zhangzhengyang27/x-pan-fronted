<script setup lang="ts">
/**
 * BaseButton —— 通用按钮
 * 设计规范：G 设计风格
 * variant: primary | secondary | ghost | danger | warning
 * size: sm | md | lg
 * loading | disabled | block
 */
import { computed } from 'vue'
import { LoaderCircle } from '@lucide/vue'
import { cn } from '@/utils/classnames'

const props = defineProps({
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
  type: { type: String, default: 'button' }
})

const variantClass = computed(() =>
  ({
    primary:
      'bg-[var(--color-primary-500)] text-white hover:opacity-90 active:opacity-80',
    secondary:
      'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]',
    ghost:
      'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
    danger:
      'bg-[var(--color-danger)] text-white hover:opacity-90 active:opacity-80',
    warning:
      'bg-[var(--color-warning)] text-white hover:opacity-90 active:opacity-80'
  })[props.variant]
)

const sizeClass = computed(
  () =>
    ({
      sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
      md: 'h-9 px-4 text-sm gap-2 rounded-lg',
      lg: 'h-11 px-5 text-base gap-2 rounded-lg'
    })[props.size]
)

const classes = computed(() =>
  cn(
    'inline-flex items-center justify-center font-medium select-none whitespace-nowrap',
    'transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-[var(--color-bg)]',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    props.block && 'w-full',
    variantClass.value,
    sizeClass.value
  )
)
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled || loading" :aria-busy="loading || undefined">
    <LoaderCircle v-if="loading" :size="props.size === 'sm' ? 14 : 16" class="animate-spin" aria-hidden="true" />
    <slot />
  </button>
</template>
