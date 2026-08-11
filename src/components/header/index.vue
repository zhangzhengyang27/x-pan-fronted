<script setup lang="ts">
/**
 * AppHeader —— 顶部导航条
 * 设计规范：G2/B1 风格
 * - 64px 高度，sticky top
 * - 品牌 · 上传任务入口 · 全局搜索 · AI助手 · 快捷键 · 主题切换 · 用户菜单
 */
import { computed, ref } from 'vue'
import { Cloud, Sun, Moon, Keyboard, Menu, Sparkles } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import PanUserInfo from '@/components/user-info/index.vue'
import PanTaskList from '@/components/task-list/index.vue'
import PanSearch from '@/components/search/index.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import AIAssistant from '@/components/base/AIAssistant.vue'
import { useMediaQuery } from '@/composables/useMediaQuery'

const route = useRoute()
const { isDark, toggleTheme } = useTheme()
const isMobile = useMediaQuery('(max-width: 768px)').matches

const showSearch = computed(() => {
  return !['Login', 'Register', 'Forget', 'Error404', 'Error500'].includes(route.name)
})

function openShortcuts() {
  window.dispatchEvent(new CustomEvent('xpan:open-shortcuts'))
}

function openMobileNav() {
  window.dispatchEvent(new CustomEvent('xpan:open-mobile-nav'))
}

const aiOpen = ref(false)
function openAI() {
  aiOpen.value = true
}
</script>

<template>
  <header
    class="sticky top-0 z-50 h-16 border-b bg-[var(--color-surface)] border-[var(--color-border)]"
  >
    <div class="h-full w-full flex items-center px-4 md:px-6 gap-3 md:gap-4">
      <!-- 移动端汉堡按钮 -->
      <button
        v-if="isMobile"
        type="button"
        class="size-9 rounded-lg flex items-center justify-center transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
        aria-label="打开导航"
        @click="openMobileNav"
      >
        <Menu :size="20" :stroke-width="2" />
      </button>

      <!-- 品牌 -->
      <router-link to="/" class="flex items-center gap-2.5 shrink-0 group">
        <div
          class="size-9 rounded-xl flex items-center justify-center shadow-sm"
          style="background: linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-700) 100%);"
        >
          <Cloud :size="18" :stroke-width="2" class="text-white" />
        </div>
        <div class="flex flex-col leading-none">
          <span class="text-lg font-bold tracking-tight text-[var(--color-text)]">X Pan</span>
          <span class="font-mono text-[10px] tracking-wider hidden md:inline text-[var(--color-text-muted)]">DISTRIBUTED STORAGE</span>
        </div>
      </router-link>

      <!-- 主搜索（中间自适应） -->
      <div v-if="showSearch" class="flex-1 max-w-xl mx-auto">
        <PanSearch />
      </div>
      <div v-else class="flex-1" />

      <!-- 右侧操作 -->
      <div class="flex items-center gap-1 md:gap-2 shrink-0">
        <PanTaskList />

        <BaseTooltip text="AI 助手" position="bottom">
          <button
            type="button"
            class="size-9 rounded-lg flex items-center justify-center transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] active:scale-95 transition-all"
            aria-label="AI 助手"
            @click="openAI"
          >
            <Sparkles :size="18" :stroke-width="2" />
          </button>
        </BaseTooltip>

        <BaseTooltip text="快捷键 (?)" position="bottom">
          <button
            type="button"
            class="size-9 rounded-lg flex items-center justify-center transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] active:scale-95 transition-all"
            aria-label="快捷键"
            @click="openShortcuts"
          >
            <Keyboard :size="18" :stroke-width="2" />
          </button>
        </BaseTooltip>

        <BaseTooltip :text="isDark ? '切换为浅色' : '切换为深色'" position="bottom">
          <button
            type="button"
            class="size-9 rounded-lg flex items-center justify-center transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] active:scale-95 transition-all"
            :aria-label="isDark ? '切换为浅色' : '切换为深色'"
            @click="toggleTheme"
          >
            <Sun v-if="isDark" :size="18" :stroke-width="2" />
            <Moon v-else :size="18" :stroke-width="2" />
          </button>
        </BaseTooltip>

        <PanUserInfo />
      </div>
    </div>
  </header>

  <AIAssistant v-model:open="aiOpen" />
</template>
