<script setup lang="ts">
/**
 * BaseEmpty —— 夸克风格空态组件
 * 简约图标 + 品牌色 + 标题 + 描述 + 可选 CTA
 */
import { FolderOpen } from '@lucide/vue'

defineProps({
  icon: { type: [Object, Function], default: FolderOpen },
  title: { type: String, default: '暂无数据' },
  description: { type: String, default: '' }
})
</script>

<template>
  <div class="flex flex-col items-center text-center py-12 px-6 select-none">
    <!-- 夸克式插画:简洁圆形图标 -->
    <div
      class="size-16 rounded-2xl flex items-center justify-center mb-5"
      style="background-color: rgba(0, 163, 255, 0.08);"
    >
      <component
        :is="icon"
        :size="30"
        :stroke-width="1.5"
        class="text-primary-500"
      />
    </div>
    <!-- 标题 -->
    <h3 class="text-sm font-medium text-(--color-text) mb-1.5">{{ title }}</h3>
    <!-- 描述 -->
    <p
      v-if="description"
      class="text-xs text-(--color-text-muted) max-w-xs leading-relaxed mb-4"
    >
      {{ description }}
    </p>
    <!-- CTA 插槽 -->
    <div v-if="$slots.default" class="flex gap-2">
      <slot />
    </div>
  </div>
</template>
