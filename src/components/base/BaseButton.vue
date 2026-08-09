<script setup>
/**
 * BaseButton —— 通用按钮
 * Props:
 *   variant: primary | secondary | ghost | danger | link
 *   size:    sm | md | lg
 *   loading: boolean
 *   disabled: boolean
 *   block:   boolean
 *   icon:    lucide icon name or Vue component
 */
import {computed} from 'vue'
import {LoaderCircle} from '@lucide/vue'
import {cn} from '@/utils/classnames'

const props = defineProps({
  variant: {type: String, default: 'primary'},
  size: {type: String, default: 'md'},
  loading: {type: Boolean, default: false},
  disabled: {type: Boolean, default: false},
  block: {type: Boolean, default: false},
  type: {type: String, default: 'button'},
  icon: {type: [Object, Function], default: null},
})

const variantClass = computed(() => ({
  primary:
    'bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] active:bg-[var(--color-primary-800)] shadow-xs',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] active:bg-[var(--color-neutral-200)]',
  ghost:
    'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
  danger:
    'bg-[var(--color-danger)] text-white hover:opacity-90 active:opacity-80 shadow-xs',
  link: 'bg-transparent text-[var(--color-primary-600)] hover:underline underline-offset-4 px-0',
}[props.variant]))

const sizeClass = computed(() => ({
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  md: 'h-9 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-base gap-2 rounded-lg',
}[props.size]))

const classes = computed(() =>
  cn(
    'inline-flex items-center justify-center font-medium select-none whitespace-nowrap',
    'transition-[background-color,opacity,box-shadow] duration-150 ease-[var(--ease)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    props.block && 'w-full',
    variantClass.value,
    sizeClass.value,
  ),
)
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <LoaderCircle v-if="loading" :size="16" class="animate-spin" aria-hidden="true"/>
    <component v-else-if="icon" :is="icon" :size="size === 'sm' ? 14 : 16" aria-hidden="true"/>
    <slot/>
  </button>
</template>