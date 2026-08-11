<script setup>
/**
 * AppHeader —— 顶部导航条（64px）
 * 品牌 · 上传任务入口 · 全局搜索 · 主题切换 · 用户菜单
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
  // 登录/注册/忘记页不显示搜索
  return !['Login', 'Register', 'Forget', 'Error404', 'Error500'].includes(route.name)
})

/** P1.12：派发自定义事件给 ShortcutsPanel（挂在 App.vue 上） */
function openShortcuts() {
  window.dispatchEvent(new CustomEvent('xpan:open-shortcuts'))
}

/** P1.15：移动端汉堡按钮 → 打开侧栏抽屉 */
function openMobileNav() {
  window.dispatchEvent(new CustomEvent('xpan:open-mobile-nav'))
}

/** P1.18：AI 助手 */
const aiOpen = ref(false)
function openAI() {
  aiOpen.value = true
}
</script>

<template>
  <header
    class="sticky top-0 z-[var(--z-sticky)] h-[var(--header-h)] border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-md"
  >
    <div class="h-full w-full flex items-center px-4 md:px-6 gap-3 md:gap-4">
      <!-- 移动端汉堡按钮 -->
      <button
        v-if="isMobile"
        type="button"
        class="size-9 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
        aria-label="打开导航"
        @click="openMobileNav"
      >
        <Menu :size="20" />
      </button>

      <!-- 品牌 -->
      <router-link to="/" class="flex items-center gap-2.5 shrink-0 group">
        <div
          class="size-9 rounded-xl bg-gradient-to-br from-[var(--color-primary-500)] to-[var(--color-primary-700)] flex items-center justify-center shadow-sm group-hover:shadow transition-shadow"
        >
          <Cloud :size="18" class="text-white" :stroke-width="2.25" />
        </div>
        <span class="text-lg font-semibold tracking-tight text-[var(--color-text)]">R Pan</span>
        <span class="text-xs text-[var(--color-text-muted)] hidden md:inline">个人分布式存储</span>
      </router-link>

      <!-- 主搜索（中间自适应） -->
      <div v-if="showSearch" class="flex-1 max-w-xl mx-auto">
        <PanSearch />
      </div>
      <div v-else class="flex-1" />

      <!-- 右侧操作 -->
      <div class="flex items-center gap-2 shrink-0">
        <PanTaskList />

        <BaseTooltip text="AI 助手" position="bottom">
          <button
            type="button"
            class="size-9 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
            aria-label="AI 助手"
            @click="openAI"
          >
            <Sparkles :size="18" />
          </button>
        </BaseTooltip>

        <BaseTooltip text="快捷键 (?)" position="bottom">
          <button
            type="button"
            class="size-9 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
            aria-label="快捷键"
            @click="openShortcuts"
          >
            <Keyboard :size="18" />
          </button>
        </BaseTooltip>

        <BaseTooltip :text="isDark ? '切换为浅色' : '切换为深色'" position="bottom">
          <button
            type="button"
            class="size-9 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
            :aria-label="isDark ? '切换为浅色' : '切换为深色'"
            @click="toggleTheme"
          >
            <Sun v-if="isDark" :size="18" />
            <Moon v-else :size="18" />
          </button>
        </BaseTooltip>

        <PanUserInfo />
      </div>
    </div>
  </header>

  <AIAssistant v-model:open="aiOpen" />
</template>
