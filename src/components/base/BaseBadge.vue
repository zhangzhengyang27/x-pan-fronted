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
    'bg-(--color-surface-2) text-(--color-text-muted) border border-(--color-border)',
  primary:
    'bg-primary-50 text-primary-700 border border-primary-200',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  danger: 'bg-red-50 text-red-700 border border-red-200'
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
