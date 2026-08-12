<script setup lang="ts">
/**
 * AppNavbar —— 左侧导航栏（P0-1 三层语义重构）
 * 分层：快速访问（最近/收藏） → 文件类型 → 工具区
 * - 可折叠（64px 折叠态，折叠时隐藏快速访问与分组标题）
 * - 可拖拽调宽度（200-420px）
 * - 存储配额进度条（三色阈值）
 * - 快速访问：最近访问 + 收藏文件夹（来自 useRecent / useFavorites）
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNavbarStore } from '@/stores/navbar'
import { useFileStore } from '@/stores/file'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
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
  Cloud,
  Clock,
  File as FileGeneric,
  Folder,
  Shield,
  BarChart3
} from '@lucide/vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import { useResizable } from '@/composables/useResizable'
import { useUserStore } from '@/stores/user'
import { storeToRefs as toRefs } from 'pinia'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { useFavorites } from '@/composables/useFavorites'
import { useRecent } from '@/composables/useRecent'
import fileService from '@/api/file'
import panUtil from '@/utils/common'

const store = useNavbarStore()
const userStore = useUserStore()
const fileStore = useFileStore()
const breadcrumbStore = useBreadcrumbStore()
const route = useRoute()
const router = useRouter()

const { active } = storeToRefs(store)
const { usedSpace, totalSpace, usedPercent } = toRefs(userStore)
const { change } = store
const collapsed = ref(false)
const isMobile = useMediaQuery('(max-width: 768px)').matches
const mobileOpen = ref(false)

// ─── 快速访问：最近访问 + 收藏 ────────────────────────────────────────────
const { favorites } = useFavorites()
const { recent } = useRecent()

// 最近访问最多展示 5 项
const recentItems = computed(() =>
  (recent.value || []).slice(0, 5).map((r) => ({
    key: `recent-${r.fileId}`,
    label: r.filename,
    icon: Clock,
    fileId: r.fileId,
    fileType: r.fileType,
    parentId: r.parentId,
    kind: 'recent' as const
  }))
)

// 收藏列表展示全部（最多 10 项避免过长）
const favoriteItems = computed(() =>
  (favorites.value || []).slice(0, 10).map((f) => ({
    key: `fav-${f.fileId}`,
    label: f.filename || f.name || '未命名',
    icon: (f.fileType === 0 ? Folder : FileGeneric),
    fileId: f.fileId,
    fileType: f.fileType,
    kind: 'favorite' as const
  }))
)

const quickAccessItems = computed(() => [...recentItems.value, ...favoriteItems.value])

function navigate(item) {
  active.value = item.key
  router.push({ path: item.path, query: item.query || {} })
  mobileOpen.value = false
}

watch(
  () => route.path,
  () => {
    mobileOpen.value = false
  }
)

// P2-8: 路由 name 或 query.type 变化时同步 active 高亮
watch(
  () => [route.name, route.query.type],
  () => {
    syncActive()
  },
  { immediate: true }
)

defineExpose({ openMobile: () => (mobileOpen.value = true), isMobile })

const { width, startDrag } = useResizable('x-pan.navbar.width', {
  min: 200,
  max: 420,
  defaultWidth: 240
})

// ─── 导航分组（三层语义）─────────────────────────────────────────────────
// P2-8: 类型筛选改为 query 模式，点击类型项跳 /files?type=xxx，保留目录上下文
const groups = computed(() => [
  {
    title: '快速访问',
    items: quickAccessItems.value
  },
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
      { key: 'Stats', label: '统计概览', icon: BarChart3, path: '/stats', query: {} },
      { key: 'Recycles', label: '回收站', icon: Trash2, path: '/recycles', query: {} }
    ]
  }
])

// 导航 key → 跳转目标（path + query）
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

function go(key) {
  change(key)
  router.push(goMap[key] || { path: '/files' })
}

// 根据 route.name + route.query.type 同步 active 高亮
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

// ─── 快速访问项点击：文件夹→进入，文件→新开预览页 ──────────────────────
function handleQuickNav(item) {
  mobileOpen.value = false
  const fid = panUtil.handleId(item.fileId)
  if (item.fileType === 0) {
    // 文件夹：进入目录
    fileService.getBreadcrumbs(
      { fileId: fid },
      (res) => {
        fileStore.setSearchFlag(false)
        breadcrumbStore.clear()
        breadcrumbStore.reset(res.data)
        fileStore.setParentId(fid)
        fileStore.loadFileList()
        change('Files')
        router.push('/files')
      },
      (res) => {
        /* noop */
      }
    )
    return
  }
  // 文件：新开预览页（与 file-table clickFilename 路由规则一致）
  const typeMap: Record<number, { path: string; name: string }> = {
    3: { path: '/preview/office', name: 'PreviewOffice' },
    4: { path: '/preview/office', name: 'PreviewOffice' },
    10: { path: '/preview/office', name: 'PreviewOffice' },
    5: { path: '/preview/iframe', name: 'PreviewIframe' },
    6: { path: '/preview/iframe', name: 'PreviewIframe' },
    7: { path: '/preview/image', name: 'PreviewImage' },
    8: { path: '/preview/music', name: 'PreviewMusic' },
    9: { path: '/preview/video', name: 'PreviewVideo' },
    11: { path: '/preview/code', name: 'PreviewCode' }
  }
  const target = typeMap[item.fileType]
  if (target) {
    const { href } = router.resolve({
      path: target.path,
      name: target.name,
      params: { fileId: fid },
      query: { filename: item.label }
    })
    window.open(href, '_blank')
  }
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
  // active 高亮已由 watch [route.name, route.query.type] immediate 同步
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
          <div class="h-full flex flex-col py-3 gap-4 overflow-y-auto">
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

            <!-- 导航分组 -->
            <div v-for="(group, gi) in groups" :key="gi" class="flex flex-col gap-0.5">
              <!-- 分组标题 -->
              <p
                v-if="group.items.length > 0"
                class="px-5 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]"
              >
                {{ group.title }}
              </p>
              <template v-if="group.title === '快速访问'">
                <button
                  v-for="item in group.items"
                  :key="item.key"
                  type="button"
                  class="group flex items-center gap-3 mx-2 px-3 h-10 rounded-lg text-sm transition-all active:scale-[0.98] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                  @click="handleQuickNav(item)"
                >
                  <component :is="item.icon" :size="16" :stroke-width="2" class="shrink-0 text-[var(--color-primary-500)]" />
                  <span class="truncate">{{ item.label }}</span>
                </button>
                <p
                  v-if="group.items.length === 0"
                  class="px-5 py-2 text-xs text-[var(--color-text-muted)] italic"
                >
                  暂无快速访问
                </p>
              </template>
              <template v-else>
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
              </template>
            </div>

            <!-- 配额卡片 -->
            <div
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
    <div class="h-full flex flex-col py-3 gap-4 overflow-y-auto">
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

      <!-- 导航分组 -->
      <div v-for="(group, gi) in groups" :key="gi" class="flex flex-col gap-0.5">
        <!-- 折叠态：快速访问区整体隐藏；其余区只显示图标 -->
        <template v-if="collapsed && group.title === '快速访问'">
          <!-- 折叠时不显示快速访问（空间不足） -->
        </template>
        <template v-else>
          <!-- 分组标题（折叠态隐藏） -->
          <p
            v-if="!collapsed && group.items.length > 0"
            class="px-5 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {{ group.title }}
          </p>

          <template v-if="group.title === '快速访问'">
            <BaseTooltip
              v-for="item in group.items"
              :key="item.key"
              :text="item.label"
              position="right"
            >
              <button
                type="button"
                class="group flex items-center gap-3 mx-2 px-3 h-9 rounded-lg text-sm transition-all active:scale-[0.98] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                @click="handleQuickNav(item)"
              >
                <component :is="item.icon" :size="16" :stroke-width="2" class="shrink-0 text-[var(--color-primary-500)]" />
                <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
              </button>
            </BaseTooltip>
            <p
              v-if="!collapsed && group.items.length === 0"
              class="px-5 py-2 text-xs text-[var(--color-text-muted)] italic"
            >
              暂无快速访问
            </p>
          </template>

          <template v-else>
            <BaseTooltip
              v-for="item in group.items"
              :key="item.key"
              :text="collapsed ? item.label : ''"
              position="right"
            >
              <button
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
            </BaseTooltip>
          </template>
        </template>
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
      @mouseover="($event.target as HTMLElement).style.backgroundColor='rgba(0, 178, 255, 0.3)'"
      @mouseout="($event.target as HTMLElement).style.backgroundColor='transparent'"
    >
      <GripVertical :size="10" :stroke-width="2" class="text-[var(--color-text-muted)]" />
    </div>
  </aside>
</template>
