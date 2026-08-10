<script setup>
/**
 * BaseBadge —— 徽标
 */
import { cn } from '@/utils/classnames'

defineProps({
  variant: { type: String, default: 'neutral' }, // neutral | primary | success | warning | danger
  size: { type: String, default: 'md' } // sm | md
})

const variantClass = {
  neutral:
    'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]',
  primary:
    'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border border-[var(--color-primary-200)]',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  danger: 'bg-red-50 text-red-700 border border-red-200'
}

const sizeClass = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5'
}
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex items-center gap-1 rounded-md font-medium',
        variantClass[variant],
        sizeClass[size]
      )
    "
  >
    <slot />
  </span>
</template>
