<script setup lang="ts">
/**
 * BaseDivider —— 分割线（横向 / 纵向 / 居中文案）
 */

defineProps({
  direction: { type: String, default: 'horizontal' } // horizontal | vertical
})
</script>

<template>
  <div v-if="direction === 'horizontal'" class="flex items-center gap-3 my-2" role="separator">
    <span class="flex-1 h-px bg-[var(--color-border)]" />
    <span v-if="$slots.default" class="text-xs text-[var(--color-text-muted)] shrink-0"
      ><slot
    /></span>
    <span class="flex-1 h-px bg-[var(--color-border)]" />
  </div>
  <span
    v-else
    class="inline-block w-px self-stretch bg-[var(--color-border)] mx-2"
    role="separator"
    aria-orientation="vertical"
  />
</template>
