<script setup lang="ts">
/**
 * BaseBadge —— 徽标
 */
import type { PropType } from 'vue'
import { cn } from '@/utils/classnames'

type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
type BadgeSize = 'sm' | 'md'

defineProps({
  variant: { type: String as PropType<BadgeVariant>, default: 'neutral' }, // neutral | primary | success | warning | danger
  size: { type: String as PropType<BadgeSize>, default: 'md' } // sm | md
})

const variantClass: Record<BadgeVariant, string> = {
  neutral:
    'bg-(--color-surface-2) text-(--color-text-secondary) border border-(--color-border)',
  primary:
    'bg-(--color-brand-soft) text-(--color-info-text) border border-(--color-border)',
  success: 'bg-(--color-success-bg) text-(--color-success-text) border border-(--color-border)',
  warning: 'bg-(--color-warning-bg) text-(--color-warning-text) border border-(--color-border)',
  danger: 'bg-(--color-danger-bg) text-(--color-danger-text) border border-(--color-border)'
}

const sizeClass: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5'
}
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex items-center gap-1 rounded-sm font-medium',
        variantClass[variant],
        sizeClass[size]
      )
    "
  >
    <slot />
  </span>
</template>
