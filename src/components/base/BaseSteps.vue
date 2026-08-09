<script setup>
/**
 * BaseSteps —— 步骤条
 * active: 当前激活的步骤索引（从 0 开始）
 */
import { Check } from '@lucide/vue'
import { cn } from '@/utils/classnames'

defineProps({
  steps: { type: Array, required: true }, // [{title, description}]
  active: { type: Number, default: 0 }
})
</script>

<template>
  <ol class="flex items-center w-full m-0 p-0 list-none gap-0">
    <li
      v-for="(s, i) in steps"
      :key="i"
      :class="cn('flex items-center gap-3', i < steps.length - 1 && 'flex-1')"
    >
      <div class="flex items-center gap-2 shrink-0">
        <span
          :class="
            cn(
              'size-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
              i < active && 'bg-[var(--color-primary-600)] text-white',
              i === active &&
                'bg-[var(--color-primary-600)] text-white ring-4 ring-[var(--color-primary-100)]',
              i > active &&
                'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
            )
          "
        >
          <Check v-if="i < active" :size="14" :stroke-width="3" />
          <span v-else>{{ i + 1 }}</span>
        </span>
        <div class="flex flex-col leading-tight">
          <span
            :class="
              cn(
                'text-sm',
                i <= active
                  ? 'text-[var(--color-text)] font-medium'
                  : 'text-[var(--color-text-muted)]'
              )
            "
            >{{ s.title }}</span
          >
          <span v-if="s.description" class="text-xs text-[var(--color-text-muted)]">{{
            s.description
          }}</span>
        </div>
      </div>
      <span
        v-if="i < steps.length - 1"
        :class="
          cn(
            'flex-1 h-px mx-2 transition-colors',
            i < active ? 'bg-[var(--color-primary-600)]' : 'bg-[var(--color-border)]'
          )
        "
      />
    </li>
  </ol>
</template>
