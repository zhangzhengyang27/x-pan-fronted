<script setup lang="ts">
/**
 * BaseButton —— 通用按钮（夸克风格）
 * variant: primary | secondary | ghost | danger | warning
 * size: xs | sm | md | lg
 */
import { computed } from 'vue'
import { LoaderCircle } from '@lucide/vue'
import { cn } from '@/utils/classnames'
import type { PropType } from 'vue'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'
type ButtonType = 'button' | 'submit' | 'reset'

const props = defineProps({
  variant: { type: String as PropType<ButtonVariant>, default: 'primary' },
  size: { type: String as PropType<ButtonSize>, default: 'md' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
  type: { type: String as PropType<ButtonType>, default: 'button' }
})

const variantClass = computed(() =>
  ({
    primary: 'bg-primary-500 text-white hover:bg-primary-600',
    secondary: 'bg-(--color-surface) text-(--color-text) border border-(--color-border) hover:bg-(--color-surface-2)',
    ghost: 'bg-transparent text-(--color-text) hover:bg-(--color-hover)',
    danger: 'bg-danger text-white hover:opacity-85',
    warning: 'bg-warning text-white hover:opacity-85'
  })[props.variant]
)

const sizeClass = computed(
  () =>
    ({
      xs: 'h-6 px-2 text-[11px] gap-1 rounded-sm',
      sm: 'h-8 px-3 text-xs gap-1.5 rounded-sm',
      md: 'h-9 px-4 text-sm gap-2 rounded-sm',
      lg: 'h-10 px-5 text-sm gap-2 rounded-sm'
    })[props.size] ||
    // 兜底：未知 size 时回退到 sm，避免 className 缺失导致按钮无尺寸
    ({
      xs: 'h-6 px-2 text-[11px] gap-1 rounded-sm',
      sm: 'h-8 px-3 text-xs gap-1.5 rounded-sm',
      md: 'h-9 px-4 text-sm gap-2 rounded-sm',
      lg: 'h-10 px-5 text-sm gap-2 rounded-sm'
    }).sm
)

const classes = computed(() =>
  cn(
    'inline-flex items-center justify-center font-medium select-none whitespace-nowrap',
    'transition-all duration-100',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-(--color-ring)',
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
