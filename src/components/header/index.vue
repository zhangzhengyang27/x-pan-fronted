<script setup lang="ts">
/**
 * AppHeader —— 顶部导航条 (夸克风格重设计)
 * - 56px 高度(夸克标准),sticky top
 * - 品牌 · 上传任务 · 全局搜索 · AI助手 · 快捷键 · 主题切换 · 用户菜单
 * - Web 端仅提供桌面 Header；移动端由 x-pan-mobile 承载
 */
import { computed, ref } from 'vue'
import { Cloud, Sun, Moon, Keyboard, Sparkles } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import PanUserInfo from '@/components/user-info/index.vue'
import SpaceSwitcher from '@/components/space-switcher/index.vue'
import NotificationBell from '@/components/base/NotificationBell.vue'
import PanTaskList from '@/components/task-list/index.vue'
import { hasLoginSession } from '@/utils/cookie'
import PanSearch from '@/components/search/index.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import AIAssistant from '@/components/base/AIAssistant.vue'

const route = useRoute()
const { isDark, toggleTheme } = useTheme()

const showSearch = computed(() => {
  return !['Login', 'Register', 'Forget', 'Error404', 'Error500'].includes(route.name as string)
})

function openShortcuts() {
  window.dispatchEvent(new CustomEvent('xpan:open-shortcuts'))
}

const aiOpen = ref(false)
function openAI() {
  aiOpen.value = true
}
</script>

<template>
  <header
    class="sticky top-0 z-50 shrink-0 border-b bg-(--color-surface) border-(--color-border)"
    style="height: var(--header-h);"
  >
    <div class="h-full w-full flex items-center px-4 lg:px-6 gap-3">
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

      <!-- 主搜索(桌面限宽靠右) -->
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

        <!-- 空间切换（登录后显示） -->
        <SpaceSwitcher v-if="hasLoginSession()" />

        <!-- 通知铃铛（登录后显示） -->
        <NotificationBell v-if="hasLoginSession()" />

        <!-- 用户信息 -->
        <PanUserInfo />
      </div>
    </div>
  </header>

  <AIAssistant v-model:open="aiOpen" />
</template>
