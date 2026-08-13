<template>
  <header
    class="sticky top-0 z-50 h-16 border-b bg-(--color-surface) border-(--color-border)"
  >
    <div class="h-full w-full flex items-center justify-between px-4 md:px-6 gap-3">
      <!-- 品牌 -->
      <router-link to="/" class="flex items-center gap-2.5 shrink-0 group">
        <div
          class="size-9 rounded-xl flex items-center justify-center shadow-sm"
          style="background: linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-700) 100%);"
        >
          <Cloud :size="18" :stroke-width="2" class="text-white" />
        </div>
        <span class="text-lg font-bold tracking-tight text-(--color-text)">X Pan</span>
      </router-link>

      <div class="flex items-center gap-2 md:gap-3">
        <!-- 主题切换 -->
        <button
          type="button"
          class="size-9 rounded-sm flex items-center justify-center transition-colors text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-2)"
          :aria-label="theme.isDark ? '切换为浅色' : '切换为深色'"
          @click="theme.toggle"
        >
          <Sun v-if="theme.isDark" :size="18" :stroke-width="2" />
          <Moon v-else :size="18" :stroke-width="2" />
        </button>

        <!-- 用户信息 -->
        <pan-user-info />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Cloud, Sun, Moon } from '@lucide/vue'
import PanUserInfo from '@/components/user-info/index.vue'
import { useTheme } from '@/composables/useTheme'

const theme = useTheme()
</script>
