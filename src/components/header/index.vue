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
import { useMediaQuery } from '@/composables/useMediaQuery'

const route = useRoute()
const { isDark, toggleTheme } = useTheme()
const isMobile = useMediaQuery('(max-width: 768px)').matches

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
</script>

<template>
  <header
    class="sticky top-0 z-50 flex-shrink-0 border-b bg-(--color-surface) border-(--color-border)"
    style="height: var(--header-h);"
  >
    <div class="h-full w-full flex items-center px-4 lg:px-6 gap-3">

      <!-- 移动端汉堡按钮 -->
      <button
        v-if="isMobile"
        type="button"
        class="size-7 rounded-sm flex items-center justify-center text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-hover) transition-colors flex-shrink-0"
        aria-label="打开导航"
        @click="openMobileNav"
      >
        <Menu :size="16" :stroke-width="2" />
      </button>

      <!-- 品牌 -->
      <router-link
        to="/"
        class="flex items-center gap-2.5 shrink-0 group"
      >
        <!-- 夸克式品牌图标:纯色无渐变,圆角偏小 -->
        <div
          class="size-7 rounded-sm flex items-center justify-center flex-shrink-0"
          style="background-color: var(--color-primary-500);"
        >
          <Cloud :size="14" :stroke-width="2" class="text-white" />
        </div>
        <!-- 夸克式品牌名:无副标题,更紧凑 -->
        <span class="text-base font-semibold tracking-tight text-(--color-text) leading-none">
          X Pan
        </span>
      </router-link>

      <!-- 主搜索(靠右贴合右侧按钮组,搜索框左侧留白由父容器自然吸收) -->
      <div v-if="showSearch" class="ml-auto min-w-0 max-w-sm mr-2">
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
        <BaseTooltip text="快捷键 (?)" position="bottom">
          <button
            type="button"
            class="size-7 rounded-sm flex items-center justify-center transition-colors text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-hover)"
            aria-label="快捷键"
            @click="openShortcuts"
          >
            <Keyboard :size="15" :stroke-width="1.75" />
          </button>
        </BaseTooltip>

        <!-- 主题切换(夸克风格:更简约) -->
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
