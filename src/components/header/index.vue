<script setup lang="ts">
/**
 * AppHeader —— 顶部导航条 (夸克风格重设计)
 * - 56px 高度(夸克标准),sticky top
 * - 品牌 · 上传任务 · 全局搜索 · AI助手 · 快捷键 · 主题切换 · 用户菜单
 * - 夸克风格:极简、灰调、快交互
 */
import { computed, ref } from 'vue'
import { Cloud, Sun, Moon, Keyboard, Menu, Sparkles } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import PanUserInfo from '@/components/user-info/index.vue'
import NotificationBell from '@/components/base/NotificationBell.vue'
import PanTaskList from '@/components/task-list/index.vue'
import { getToken } from '@/utils/cookie'
import PanSearch from '@/components/search/index.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import AIAssistant from '@/components/base/AIAssistant.vue'
import { useBreakpoint } from '@/composables/useMediaQuery'

const route = useRoute()
const { isDark, toggleTheme } = useTheme()
const { isMobile, isTablet } = useBreakpoint()

const showSearch = computed(() => {
  return !['Login', 'Register', 'Forget', 'Error404', 'Error500'].includes(route.name as string)
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

/** 手机端：搜索图标 → 展开全屏搜索层 */
const mobileSearchOpen = ref(false)
function openMobileSearch() {
  mobileSearchOpen.value = true
}
</script>

<template>
  <!-- ============ 手机端（≤768px）精简 Header ============ -->
  <header
    v-if="isMobile"
    class="sticky top-0 z-50 shrink-0 border-b bg-(--color-surface) border-(--color-border)"
    style="height: calc(var(--header-h) + env(safe-area-inset-top, 0px)); padding-top: env(safe-area-inset-top, 0px);"
  >
    <div class="h-full w-full flex items-center px-3 gap-2">

      <!-- 汉堡 -->
      <button
        type="button"
        class="size-10 -ml-1 rounded-lg flex items-center justify-center text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-hover) transition-colors shrink-0"
        aria-label="打开导航"
        @click="openMobileNav"
      >
        <Menu :size="20" :stroke-width="2" />
      </button>

      <!-- Logo -->
      <router-link to="/" class="flex items-center gap-2 shrink-0 group">
        <div
          class="size-8 rounded-lg flex items-center justify-center shrink-0"
          style="background-color: var(--color-primary-500);"
        >
          <Cloud :size="16" :stroke-width="2" class="text-white" />
        </div>
      </router-link>

      <!-- 占位 / 或搜索（未展开时占满） -->
      <div class="flex-1 min-w-0" />

      <!-- 搜索图标（点击展开） -->
      <button
        v-if="showSearch"
        type="button"
        class="size-10 rounded-lg flex items-center justify-center text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-hover) transition-colors shrink-0"
        aria-label="搜索"
        @click="openMobileSearch"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-5">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>

      <!-- 上传任务 -->
      <PanTaskList />

      <!-- 通知 -->
      <NotificationBell v-if="!!getToken()" />

      <!-- 头像 -->
      <PanUserInfo />
    </div>

    <!-- 手机端搜索展开层（覆盖在内容区顶部） -->
    <Transition name="modal">
      <div
        v-if="mobileSearchOpen"
        class="absolute inset-x-0 top-0 z-40 border-b border-(--color-border) bg-(--color-surface) px-3"
        style="height: calc(var(--header-h) + env(safe-area-inset-top, 0px)); padding-top: env(safe-area-inset-top, 0px);"
      >
        <div class="h-full flex items-center gap-2">
          <button
            type="button"
            class="size-10 -ml-1 rounded-lg flex items-center justify-center text-(--color-text-secondary) hover:bg-(--color-hover) transition-colors shrink-0"
            aria-label="关闭搜索"
            @click="mobileSearchOpen = false"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div class="flex-1 min-w-0"><PanSearch /></div>
        </div>
      </div>
    </Transition>
  </header>

  <!-- ============ 平板（769-1024px）+ 桌面（≥1025px）Header ============ -->
  <header
    v-else
    class="sticky top-0 z-50 shrink-0 border-b bg-(--color-surface) border-(--color-border)"
    style="height: var(--header-h);"
  >
    <div class="h-full w-full flex items-center px-4 lg:px-6 gap-3">

      <!-- 平板汉堡按钮 -->
      <button
        v-if="isTablet"
        type="button"
        class="size-8 rounded-sm flex items-center justify-center text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-hover) transition-colors shrink-0"
        aria-label="打开导航"
        @click="openMobileNav"
      >
        <Menu :size="18" :stroke-width="2" />
      </button>

      <!-- 品牌 -->
      <router-link to="/" class="flex items-center gap-2.5 shrink-0 group">
        <div
          class="size-7 rounded-sm flex items-center justify-center shrink-0"
          style="background-color: var(--color-primary-500);"
        >
          <Cloud :size="14" :stroke-width="2" class="text-white" />
        </div>
        <span class="text-base font-semibold tracking-tight text-(--color-text) leading-none">
          X Pan
        </span>
      </router-link>

      <!-- 主搜索(平板/桌面限宽靠右) -->
      <div v-if="showSearch" class="ml-auto min-w-0 mr-2 max-w-sm shrink">
        <PanSearch />
      </div>
      <div v-else class="ml-auto" />

      <!-- 右侧操作按钮组(夸克风格:灰调 icon button) -->
      <div class="flex items-center gap-0.5 sm:gap-1 shrink-0">

        <!-- 上传任务 -->
        <PanTaskList />

        <!-- AI 助手 -->
        <BaseTooltip text="AI 助手" position="bottom">
          <button
            type="button"
            class="size-7 rounded-sm flex items-center justify-center transition-colors text-(--color-text-secondary) hover:text-primary-500 hover:bg-(--color-hover)"
            aria-label="AI 助手"
            @click="openAI"
          >
            <Sparkles :size="15" :stroke-width="1.75" />
          </button>
        </BaseTooltip>

        <!-- 快捷键 -->
        <BaseTooltip text="快捷键 (?)" position="bottom" class="hidden sm:flex">
          <button
            type="button"
            class="size-7 rounded-sm flex items-center justify-center transition-colors text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-hover)"
            aria-label="快捷键"
            @click="openShortcuts"
          >
            <Keyboard :size="15" :stroke-width="1.75" />
          </button>
        </BaseTooltip>

        <!-- 主题切换 -->
        <BaseTooltip :text="isDark ? '浅色模式' : '深色模式'" position="bottom">
          <button
            type="button"
            class="size-7 rounded-sm flex items-center justify-center transition-colors text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-hover)"
            :aria-label="isDark ? '浅色模式' : '深色模式'"
            @click="toggleTheme"
          >
            <Sun v-if="isDark" :size="15" :stroke-width="1.75" />
            <Moon v-else :size="15" :stroke-width="1.75" />
          </button>
        </BaseTooltip>

        <!-- 通知铃铛（登录后显示） -->
        <NotificationBell v-if="!!getToken()" />

        <!-- 用户信息 -->
        <PanUserInfo />
      </div>
    </div>
  </header>

  <AIAssistant v-model:open="aiOpen" />
</template>
