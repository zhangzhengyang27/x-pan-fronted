<script setup lang="ts">
/**
 * BaseEmpty —— 品牌化空态（P2-10）
 * - 简约插画：Lucide 图标 + 品牌色淡背景圆
 * - 标题 + 描述 + 可选 CTA 插槽
 */
import { FolderOpen } from '@lucide/vue'

defineProps({
  icon: { type: [Object, Function], default: FolderOpen },
  title: { type: String, default: '暂无数据' },
  description: { type: String, default: '' }
})
</script>

<template>
  <div class="flex flex-col items-center text-center py-16 px-6 select-none">
    <!-- 品牌插画 -->
    <div class="relative mb-6">
      <div class="absolute inset-0 -m-10 rounded-full bg-[var(--color-primary-500)]/[0.06] blur-xl" />
      <div
        class="relative size-20 rounded-2xl flex items-center justify-center"
        style="background: linear-gradient(135deg, rgba(0, 178, 255, 0.12), rgba(0, 178, 255, 0.04));"
      >
        <component :is="icon" :size="36" :stroke-width="1.5" class="text-[var(--color-primary-500)]" />
      </div>
    </div>
    <h3 class="text-base font-medium text-[var(--color-text)] mb-1.5">{{ title }}</h3>
    <p v-if="description" class="text-sm text-[var(--color-text-muted)] max-w-sm leading-relaxed mb-5">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="flex gap-3">
      <slot />
    </div>
  </div>
</template>
