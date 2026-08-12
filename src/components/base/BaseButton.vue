<script setup lang="ts">
/**
 * BaseButton —— 通用按钮（夸克风格）
 * variant: primary | secondary | ghost | danger | warning
 * size: xs | sm | md | lg
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
    primary: 'bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)]',
    secondary: 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]',
    ghost: 'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-hover)]',
    danger: 'bg-[var(--color-danger)] text-white hover:opacity-85',
    warning: 'bg-[var(--color-warning)] text-white hover:opacity-85'
  })[props.variant]
)

const sizeClass = computed(
  () =>
    ({
      xs: 'h-6 px-2 text-[11px] gap-1 rounded-sm',
      sm: 'h-8 px-3 text-xs gap-1.5 rounded-sm',
      md: 'h-9 px-4 text-sm gap-2 rounded-sm',
      lg: 'h-10 px-5 text-sm gap-2 rounded-sm'
    })[props.size]
)

const classes = computed(() =>
  cn(
    'inline-flex items-center justify-center font-medium select-none whitespace-nowrap',
    'transition-all duration-100',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-ring)]',
    'disabled:opacity-45 disabled:cursor-not-allowed',
    props.block && 'w-full',
    variantClass.value,
    sizeClass.value
  )
)
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled || loading" :aria-busy="loading || undefined">
    <LoaderCircle v-if="loading" :size="props.size === 'xs' || props.size === 'sm' ? 12 : 14" class="animate-spin" aria-hidden="true" />
    <slot />
  </button>
</template>
