<script setup lang="ts">
/**
 * AppNavbar —— 左侧导航栏
 * - 两层语义：文件分类 → 工具
 * - 固定展开，不再支持收起/快速访问
 */
import { computed, ref, watch } from 'vue'
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
  GripVertical,
  Download as DownloadIcon,
  Shield,
  BarChart3,
  HardDrive
} from '@lucide/vue'
import { useResizable } from '@/composables/useResizable'
import { useUserStore } from '@/stores/user'
import { useMediaQuery } from '@/composables/useMediaQuery'

const store = useNavbarStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const { active } = storeToRefs(store)
const { usedSpace, totalSpace, usedPercent } = storeToRefs(userStore)
const { change } = store
const isMobile = useMediaQuery('(max-width: 768px)').matches
const mobileOpen = ref(false)

watch(
  () => route.path,
  () => { mobileOpen.value = false }
)

watch(
  () => [route.name, route.query.type],
  () => { syncActive() },
  { immediate: true }
)

defineExpose({ openMobile: () => (mobileOpen.value = true), isMobile })

const { width, startDrag } = useResizable('x-pan.navbar.width', {
  min: 160,
  max: 360,
  defaultWidth: 200
})

// ─── 导航分组 ──────────────────────────────────────────────────────────────
const groups = computed(() => [
  {
    title: '文件',
    items: [
      { key: 'Files', label: '全部文件', icon: Files, path: '/files', query: {} },
      { key: 'Imgs', label: '图片', icon: ImageIcon, path: '/files', query: { type: 'imgs' } },
      { key: 'Docs', label: '文档', icon: FileText, path: '/files', query: { type: 'docs' } },
      { key: 'Videos', label: '视频', icon: Video, path: '/files', query: { type: 'videos' } },
      { key: 'Musics', label: '音乐', icon: Music, path: '/files', query: { type: 'musics' } }
    ]
  },
  {
    title: '工具',
    items: [
      { key: 'Shares', label: '我的分享', icon: Share2, path: '/shares', query: {} },
      { key: 'Offline', label: '离线下载', icon: DownloadIcon, path: '/offline', query: {} },
      { key: 'Vault', label: '隐私保险箱', icon: Shield, path: '/vault', query: {} },
      { key: 'Stats', label: '存储统计', icon: BarChart3, path: '/stats', query: {} },
      { key: 'Recycles', label: '回收站', icon: Trash2, path: '/recycles', query: {} }
    ]
  }
])

const goMap = {
  Files: { path: '/files' },
  Imgs: { path: '/files', query: { type: 'imgs' } },
  Docs: { path: '/files', query: { type: 'docs' } },
  Videos: { path: '/files', query: { type: 'videos' } },
  Musics: { path: '/files', query: { type: 'musics' } },
  Shares: { path: '/shares' },
  Recycles: { path: '/recycles' },
  Offline: { path: '/offline' },
  Vault: { path: '/vault' },
  Stats: { path: '/stats' }
}

function go(key: string) {
  change(key)
  router.push(goMap[key] || { path: '/files' })
}

function syncActive() {
  if (route.name === 'Files') {
    const t = route.query.type
    if (!t) change('Files')
    else if (t === 'imgs') change('Imgs')
    else if (t === 'docs') change('Docs')
    else if (t === 'videos') change('Videos')
    else if (t === 'musics') change('Musics')
    else change('Files')
  } else if (route.name === 'Stats') {
    change('Stats')
  } else if (typeof route.name === 'string') {
    change(route.name)
  }
}

function navigate(item: any) {
  active.value = item.key
  router.push({ path: item.path, query: item.query || {} })
  mobileOpen.value = false
}

// ─── 配额格式化 ───────────────────────────────────────────────────────────
function formatSize(bytes: number) {
  if (!bytes || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return v.toFixed(v >= 100 || i === 0 ? 0 : 1) + ' ' + units[i]
}

const quotaColor = computed(() => {
  if (usedPercent.value >= 90) return 'var(--color-quota-danger)'
  if (usedPercent.value >= 70) return 'var(--color-quota-warning)'
  return 'var(--color-quota-normal)'
})
</script>

<template>
  <!-- 移动端抽屉 -->
  <Teleport v-if="isMobile" to="body">
    <Transition name="drawer">
      <div v-if="mobileOpen" class="fixed inset-0 z-50 flex" @click.self="mobileOpen = false">
        <div class="absolute inset-0 bg-black/40" @click="mobileOpen = false" />
        <aside
          class="relative w-[260px] h-full flex flex-col bg-(--color-surface) border-r border-(--color-border)"
          @click.stop
        >
          <div class="h-full flex flex-col py-3 overflow-y-auto">
            <!-- 关闭按钮 -->
            <div class="px-3 flex justify-end mb-1">
              <button
                type="button"
                class="size-8 rounded-sm flex items-center justify-center text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-hover) transition-colors"
                aria-label="关闭导航"
                @click="mobileOpen = false"
              >
                <PanelLeftClose :size="16" :stroke-width="2" />
              </button>
            </div>

            <!-- 导航分组 -->
            <template v-for="(group, gi) in groups" :key="gi">
              <div class="flex flex-col gap-0.5 px-2">
                <p
                  v-if="group.items.length > 0"
                  class="px-3 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-(--color-text-muted)"
                >
                  {{ group.title }}
                </p>
                <button
                  v-for="item in group.items"
                  :key="item.key"
                  type="button"
                  class="flex items-center gap-3 h-9 px-3 rounded-sm text-sm transition-all"
                  :class="active === item.key
                    ? 'text-primary-500 bg-(--color-selected) font-medium'
                    : 'text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-hover)'"
                  @click="navigate(item)"
                >
                  <component :is="item.icon" :size="16" :stroke-width="2" class="shrink-0" />
                  <span class="truncate">{{ item.label }}</span>
                </button>
              </div>
            </template>

            <!-- 存储空间卡片 -->
            <div class="mt-auto mx-2 mb-2 rounded-xl p-3 bg-linear-to-br from-(--color-surface-2) to-(--color-surface-container-low) border border-(--color-border)/60 shadow-sm">
              <!-- 顶部：图标 + 百分比 -->
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-1.5">
                  <div
                    class="size-6 rounded-md flex items-center justify-center"
                    :style="{ backgroundColor: `${quotaColor}15`, color: quotaColor }"
                  >
                    <HardDrive :size="13" :stroke-width="2" />
                  </div>
                  <span class="text-xs font-medium text-(--color-text-secondary)">存储空间</span>
                </div>
                <span
                  class="text-sm font-bold tabular-nums leading-none"
                  :style="{ color: quotaColor }"
                >{{ Math.round(usedPercent) }}<span class="text-xs font-normal opacity-70">%</span></span>
              </div>

              <!-- 进度条 -->
              <div class="relative h-1.5 rounded-full bg-(--color-surface) overflow-hidden mb-2">
                <div
                  class="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
                  :style="{ width: Math.min(100, usedPercent) + '%', backgroundColor: quotaColor }"
                >
                  <div class="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </div>
                <div
                  v-if="usedPercent > 5 && usedPercent < 95"
                  class="absolute top-1/2 -translate-y-1/2 size-2.5 rounded-full shadow-lg transition-all duration-500 ease-out"
                  :style="{ left: `calc(${Math.min(100, usedPercent)}% - 5px)`, backgroundColor: quotaColor, boxShadow: `0 0 8px ${quotaColor}80` }"
                />
              </div>

              <!-- 底部容量数值 -->
              <div class="flex items-center justify-between text-[11px]">
                <span class="tabular-nums font-medium text-(--color-text)">{{ formatSize(usedSpace) }}</span>
                <span class="text-(--color-text-muted)">/</span>
                <span class="tabular-nums text-(--color-text-muted)">{{ formatSize(totalSpace) }}</span>
                <span class="ml-auto text-(--color-text-muted)">剩余 {{ formatSize(Math.max(0, totalSpace - usedSpace)) }}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>

  <!-- 桌面端固定侧栏 -->
  <aside
    v-if="!isMobile"
    class="relative shrink-0 border-r border-(--color-border) bg-(--color-surface) overflow-hidden"
    :style="{ width: `${width}px` }"
  >
    <div class="h-full flex flex-col overflow-y-auto pt-2">
      <template v-for="(group, gi) in groups" :key="gi">
        <!-- 分组标题 -->
        <p
          v-if="group.items.length > 0"
          class="px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-(--color-text-muted)"
        >
          {{ group.title }}
        </p>

        <div class="flex flex-col gap-0.5 px-2">
          <button
            v-for="item in group.items"
            :key="item.key"
            type="button"
            class="flex items-center gap-2.5 h-8 px-2 rounded-sm text-sm transition-all w-full"
            :class="active === item.key
              ? 'text-primary-500 bg-(--color-selected) font-medium'
              : 'text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-hover)'"
            @click="go(item.key)"
          >
            <component :is="item.icon" :size="14" :stroke-width="1.75" class="shrink-0" />
            <span class="truncate">{{ item.label }}</span>
          </button>
        </div>
      </template>

      <!-- 存储空间卡片 -->
      <div class="mt-auto mx-2 mb-2 rounded-xl p-3 bg-linear-to-br from-(--color-surface-2) to-(--color-surface-container-low) border border-(--color-border)/60 shadow-sm">
        <!-- 顶部：图标 + 百分比 -->
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-1.5">
            <div
              class="size-6 rounded-md flex items-center justify-center"
              :style="{ backgroundColor: `${quotaColor}15`, color: quotaColor }"
            >
              <HardDrive :size="13" :stroke-width="2" />
            </div>
            <span class="text-xs font-medium text-(--color-text-secondary)">存储空间</span>
          </div>
          <span
            class="text-sm font-bold tabular-nums leading-none"
            :style="{ color: quotaColor }"
          >{{ Math.round(usedPercent) }}<span class="text-xs font-normal opacity-70">%</span></span>
        </div>

        <!-- 进度条 -->
        <div class="relative h-1.5 rounded-full bg-(--color-surface) overflow-hidden mb-2">
          <div
            class="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
            :style="{ width: Math.min(100, usedPercent) + '%', backgroundColor: quotaColor }"
          >
            <!-- 光泽效果 -->
            <div class="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>
          <!-- 发光点 -->
          <div
            v-if="usedPercent > 5 && usedPercent < 95"
            class="absolute top-1/2 -translate-y-1/2 size-2.5 rounded-full shadow-lg transition-all duration-500 ease-out"
            :style="{ left: `calc(${Math.min(100, usedPercent)}% - 5px)`, backgroundColor: quotaColor, boxShadow: `0 0 8px ${quotaColor}80` }"
          />
        </div>

        <!-- 底部容量数值 -->
        <div class="flex items-center justify-between text-[11px]">
          <span class="tabular-nums font-medium text-(--color-text)">{{ formatSize(usedSpace) }}</span>
          <span class="text-(--color-text-muted)">/</span>
          <span class="tabular-nums text-(--color-text-muted)">{{ formatSize(totalSpace) }}</span>
          <span class="ml-auto text-(--color-text-muted)">剩余 {{ formatSize(Math.max(0, totalSpace - usedSpace)) }}</span>
        </div>
      </div>
    </div>

    <!-- 拖拽手柄 -->
    <div
      class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize flex items-center justify-center transition-colors hover:bg-primary-500/20"
      role="separator"
      aria-orientation="vertical"
      :aria-valuenow="width"
      aria-valuemin="200"
      aria-valuemax="420"
      @mousedown="startDrag"
    >
      <GripVertical :size="8" :stroke-width="2" class="text-(--color-border-strong)" />
    </div>
  </aside>
</template>
