<script setup lang="ts">
/**
 * AppNavbar —— 左侧导航栏
 * 设计规范：G2/B2 风格
 * - 可折叠（64px 折叠态）
 * - 可拖拽调宽度（200-420px）
 * - 存储配额进度条（三色阈值）
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNavbarStore } from '@/stores/navbar'
import { storeToRefs } from 'pinia'
import {
  Files,
  Image as ImageIcon,
  FileType as FileText,
  Video,
  Music,
  Share2,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  GripVertical,
  Download as DownloadIcon,
  Cloud
} from '@lucide/vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import { useResizable } from '@/composables/useResizable'
import { useUserStore } from '@/stores/user'
import { storeToRefs as toRefs } from 'pinia'
import { useMediaQuery } from '@/composables/useMediaQuery'

const store = useNavbarStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const { active } = storeToRefs(store)
const { usedSpace, totalSpace, usedPercent } = toRefs(userStore)
const { change } = store
const collapsed = ref(false)
const isMobile = useMediaQuery('(max-width: 768px)').matches
const mobileOpen = ref(false)

function navigate(item) {
  active.value = item.key
  router.push(item.path)
  mobileOpen.value = false
}

watch(
  () => route.path,
  () => {
    mobileOpen.value = false
  }
)

defineExpose({ openMobile: () => (mobileOpen.value = true), isMobile })

const { width, startDrag } = useResizable('x-pan.navbar.width', {
  min: 200,
  max: 420,
  defaultWidth: 240
})

const groups = computed(() => [
  {
    items: [
      { key: 'Files', label: '全部文件', icon: Files, path: '/files' },
      { key: 'Imgs', label: '图片', icon: ImageIcon, path: '/imgs' },
      { key: 'Docs', label: '文档', icon: FileText, path: '/docs' },
      { key: 'Videos', label: '视频', icon: Video, path: '/videos' },
      { key: 'Musics', label: '音乐', icon: Music, path: '/musics' }
    ]
  },
  {
    items: [
      { key: 'Shares', label: '我的分享', icon: Share2, path: '/shares' },
      { key: 'Offline', label: '离线下载', icon: DownloadIcon, path: '/offline' },
      { key: 'Recycles', label: '回收站', icon: Trash2, path: '/recycles' }
    ]
  }
])

function go(key) {
  change(key)
  const map = {
    Files: '/files',
    Imgs: '/imgs',
    Docs: '/docs',
    Videos: '/videos',
    Musics: '/musics',
    Shares: '/shares',
    Recycles: '/recycles',
    Offline: '/offline'
  }
  router.push(map[key] || '/files')
}

function formatSize(bytes) {
  if (!bytes || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return v.toFixed(v >= 100 || i === 0 ? 0 : 1) + ' ' + units[i]
}

// 配额颜色
const quotaColor = computed(() => {
  if (usedPercent.value >= 90) return 'var(--color-danger)'
  if (usedPercent.value >= 70) return 'var(--color-warning)'
  return 'var(--color-primary-500)'
})

onMounted(() => {
  const name = route.name
  change(typeof name === 'string' ? name : 'Files')
})
</script>

<template>
  <!-- 移动端：抽屉模式 -->
  <Teleport v-if="isMobile" to="body">
    <Transition name="drawer">
      <div v-if="mobileOpen" class="fixed inset-0 z-50 flex" @click.self="mobileOpen = false">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="mobileOpen = false" />
        <aside
          class="relative w-72 h-full flex flex-col bg-[var(--color-surface)] border-r border-[var(--color-border)]"
          @click.stop
        >
          <div class="h-full flex flex-col py-3 gap-4">
            <!-- 关闭按钮 -->
            <div class="px-3 flex justify-end">
              <button
                type="button"
                class="size-8 rounded-md flex items-center justify-center transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                @click="mobileOpen = false"
              >
                <PanelLeftClose :size="16" :stroke-width="2" />
              </button>
            </div>

            <!-- 导航项 -->
            <div v-for="(group, gi) in groups" :key="gi" class="flex flex-col gap-0.5">
              <button
                v-for="item in group.items"
                :key="item.key"
                type="button"
                class="group flex items-center gap-3 mx-2 px-3 h-10 rounded-lg text-sm transition-all active:scale-[0.98]"
                :class="active === item.key
                  ? 'bg-[var(--color-primary-500)] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'"
                @click="navigate(item)"
              >
                <component :is="item.icon" :size="18" :stroke-width="2" class="shrink-0" />
                <span class="truncate">{{ item.label }}</span>
              </button>
            </div>

            <!-- 配额卡片 -->
            <div
              v-if="!collapsed"
              class="mt-auto mx-2 rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface-2)]"
            >
              <div
                class="flex items-center gap-2 text-xs mb-1.5 text-[var(--color-text-muted)]"
              >
                <Cloud :size="14" :stroke-width="2" />
                <span>存储空间</span>
                <span class="ml-auto tabular-nums">{{ Math.round(usedPercent) }}%</span>
              </div>
              <div class="h-1 overflow-hidden rounded-full bg-[var(--color-surface-container-highest)]">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :style="{ width: Math.min(100, usedPercent) + '%', backgroundColor: quotaColor }"
                />
              </div>
              <p class="mt-1.5 text-[11px] tabular-nums text-[var(--color-text-muted)]">
                {{ formatSize(usedSpace) }} / {{ formatSize(totalSpace) }}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>

  <!-- 桌面端：固定侧栏 -->
  <aside
    v-if="!isMobile"
    class="relative shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-[width] duration-300 ease-in-out overflow-hidden"
    :style="{ width: collapsed ? '64px' : `${width}px` }"
  >
    <div class="h-full flex flex-col py-3 gap-4">
      <!-- 折叠按钮 -->
      <div class="px-3 flex justify-end">
        <BaseTooltip :text="collapsed ? '展开侧边栏' : '收起侧边栏'" position="right">
          <button
            type="button"
            class="size-8 rounded-md flex items-center justify-center transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
            :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
            @click="collapsed = !collapsed"
          >
            <PanelLeftClose v-if="!collapsed" :size="16" :stroke-width="2" />
            <PanelLeftOpen v-else :size="16" :stroke-width="2" />
          </button>
        </BaseTooltip>
      </div>

      <!-- 导航项 -->
      <div v-for="(group, gi) in groups" :key="gi" class="flex flex-col gap-0.5">
        <button
          v-for="item in group.items"
          :key="item.key"
          type="button"
          class="group flex items-center gap-3 mx-2 px-3 h-9 rounded-lg text-sm transition-all active:scale-[0.98]"
          :class="active === item.key
            ? 'bg-[var(--color-primary-500)] text-white'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'"
          @click="go(item.key)"
        >
          <component
            :is="item.icon"
            :size="18"
            :stroke-width="2"
          />
          <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
        </button>
      </div>

      <!-- 配额卡片 -->
      <div
        v-if="!collapsed"
        class="mt-auto mx-2 rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface-2)]"
      >
        <div
          class="flex items-center justify-between text-xs mb-1.5 text-[var(--color-text-muted)]"
        >
          <span>已用空间</span>
          <span class="tabular-nums">{{ Math.round(usedPercent) }}%</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-container-highest)]">
          <div
            class="h-full rounded-full transition-all duration-500"
            :style="{ width: `${Math.min(100, usedPercent)}%`, backgroundColor: quotaColor }"
          />
        </div>
        <p class="mt-1.5 text-[11px] tabular-nums text-[var(--color-text-muted)]">
          {{ formatSize(usedSpace) }} / {{ formatSize(totalSpace) }}
        </p>
      </div>
    </div>

    <!-- 拖拽手柄（仅展开时） -->
    <div
      v-if="!collapsed"
      class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize flex items-center justify-center transition-colors"
      role="separator"
      aria-orientation="vertical"
      :aria-valuenow="width"
      aria-valuemin="200"
      aria-valuemax="420"
      @mousedown="startDrag"
      @mouseover="($event.target as HTMLElement).style.backgroundColor='rgba(0, 112, 243, 0.3)'"
      @mouseout="($event.target as HTMLElement).style.backgroundColor='transparent'"
    >
      <GripVertical :size="10" :stroke-width="2" class="text-[var(--color-text-muted)]" />
    </div>
  </aside>
</template>
