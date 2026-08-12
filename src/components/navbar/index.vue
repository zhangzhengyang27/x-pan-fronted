<script setup lang="ts">
/**
 * AppNavbar —— 左侧导航栏 (夸克风格重设计)
 * - 三层语义:快速访问 → 文件分类 → 工具
 * - 220px 宽度,64px 折叠态
 * - 夸克风格:灰调选中、极简 hover、轻配额卡片
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
  BarChart3,
  ChevronRight
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

// ─── 快速访问 ──────────────────────────────────────────────────────────────
const { favorites } = useFavorites()
const { recent } = useRecent()

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

const favoriteItems = computed(() =>
  (favorites.value || []).slice(0, 10).map((f) => ({
    key: `fav-${f.fileId}`,
    label: f.filename || f.name || '未命名',
    icon: f.fileType === 0 ? Folder : FileGeneric,
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
  () => { mobileOpen.value = false }
)

// P2-8: 路由变化同步 active 高亮
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

function go(key) {
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

// ─── 快速访问项点击 ──────────────────────────────────────────────────────
function handleQuickNav(item) {
  mobileOpen.value = false
  const fid = panUtil.handleId(item.fileId)
  if (item.fileType === 0) {
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
      () => { /* noop */ }
    )
    return
  }
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

// ─── 配额格式化 ───────────────────────────────────────────────────────────
function formatSize(bytes) {
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
          class="relative w-[260px] h-full flex flex-col bg-[var(--color-surface)] border-r border-[var(--color-border)]"
          @click.stop
        >
          <div class="h-full flex flex-col py-3 overflow-y-auto">
            <!-- 关闭按钮 -->
            <div class="px-3 flex justify-end mb-1">
              <button
                type="button"
                class="size-8 rounded-sm flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors"
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
                  class="px-3 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
                >
                  {{ group.title }}
                </p>
                <template v-if="group.title === '快速访问'">
                  <button
                    v-for="item in group.items"
                    :key="item.key"
                    type="button"
                    class="flex items-center gap-3 h-9 px-3 rounded-sm text-sm transition-all text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]"
                    @click="handleQuickNav(item)"
                  >
                    <component :is="item.icon" :size="16" :stroke-width="2" class="text-[var(--color-text-muted)] shrink-0" />
                    <span class="truncate">{{ item.label }}</span>
                  </button>
                  <p
                    v-if="group.items.length === 0"
                    class="px-3 py-2 text-xs text-[var(--color-text-disabled)]"
                  >
                    暂无快速访问
                  </p>
                </template>
                <template v-else>
                  <button
                    v-for="item in group.items"
                    :key="item.key"
                    type="button"
                    class="flex items-center gap-3 h-9 px-3 rounded-sm text-sm transition-all"
                    :class="active === item.key
                      ? 'text-[var(--color-primary-500)] bg-[var(--color-selected)] font-medium'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]'"
                    @click="navigate(item)"
                  >
                    <component :is="item.icon" :size="16" :stroke-width="2" class="shrink-0" />
                    <span class="truncate">{{ item.label }}</span>
                  </button>
                </template>
              </div>
            </template>

            <!-- 配额卡片 -->
            <div class="mt-auto mx-2 mb-2 rounded-sm p-3 bg-[var(--color-surface-2)] border border-[var(--color-border)]">
              <div class="flex items-center justify-between text-xs mb-1.5 text-[var(--color-text-secondary)]">
                <span>存储空间</span>
                <span class="tabular-nums font-medium" :style="{ color: quotaColor }">{{ Math.round(usedPercent) }}%</span>
              </div>
              <div class="quark-quota-bar">
                <div class="quark-quota-fill" :style="{ width: Math.min(100, usedPercent) + '%', backgroundColor: quotaColor }" />
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

  <!-- 桌面端固定侧栏 -->
  <aside
    v-if="!isMobile"
    class="relative shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-200 ease-in-out overflow-hidden"
    :style="{ width: collapsed ? '64px' : `${width}px` }"
  >
    <div class="h-full flex flex-col overflow-y-auto">

      <!-- 折叠按钮(夸克风格:更小更轻) -->
      <div class="px-2 pt-2 pb-1 flex justify-end">
        <BaseTooltip :text="collapsed ? '展开侧边栏' : '收起侧边栏'" position="right">
          <button
            type="button"
            class="size-7 rounded-sm flex items-center justify-center transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]"
            :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
            @click="collapsed = !collapsed"
          >
          <PanelLeftClose v-if="!collapsed" :size="12" :stroke-width="2" />
          <PanelLeftOpen v-else :size="12" :stroke-width="2" />
          </button>
        </BaseTooltip>
      </div>

      <!-- 导航分组 -->
      <template v-for="(group, gi) in groups" :key="gi">
        <template v-if="collapsed && group.title === '快速访问'">
          <!-- 折叠时隐藏快速访问 -->
        </template>
        <template v-else>
          <!-- 分组标题 -->
          <p
            v-if="!collapsed && group.items.length > 0"
            class="px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {{ group.title }}
          </p>

          <div class="flex flex-col gap-0.5 px-2">

            <!-- 快速访问 -->
            <template v-if="group.title === '快速访问'">
              <BaseTooltip
                v-for="item in group.items"
                :key="item.key"
                :text="collapsed ? item.label : ''"
                position="right"
              >
                <button
                  type="button"
                    class="flex items-center gap-2.5 h-8 px-2 rounded-sm text-sm transition-all w-full text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]"
                    @click="handleQuickNav(item)"
                  >
                    <component :is="item.icon" :size="14" :stroke-width="1.75" class="text-[var(--color-text-muted)] shrink-0" />
                  <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
                </button>
              </BaseTooltip>
              <p
                v-if="!collapsed && group.items.length === 0"
                class="px-2 py-1.5 text-xs text-[var(--color-text-disabled)]"
              >
                暂无快速访问
              </p>
            </template>

            <!-- 文件/工具分组 -->
            <template v-else>
              <BaseTooltip
                v-for="item in group.items"
                :key="item.key"
                :text="collapsed ? item.label : ''"
                position="right"
              >
                <button
                  type="button"
                  class="flex items-center gap-2.5 h-8 px-2 rounded-sm text-sm transition-all w-full"
                  :class="active === item.key
                    ? 'text-[var(--color-primary-500)] bg-[var(--color-selected)] font-medium'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]'"
                  @click="go(item.key)"
                >
                  <component :is="item.icon" :size="14" :stroke-width="1.75" class="shrink-0" />
                  <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
                </button>
              </BaseTooltip>
            </template>

          </div>
        </template>
      </template>

      <!-- 配额卡片(夸克风格:极简无边框) -->
      <div
        v-if="!collapsed"
        class="mt-auto mx-2 mb-2 rounded-sm p-3 bg-[var(--color-surface-2)]"
      >
        <div class="flex items-center justify-between text-xs mb-1.5 text-[var(--color-text-secondary)]">
          <span>存储空间</span>
          <span class="tabular-nums font-semibold" :style="{ color: quotaColor }">{{ Math.round(usedPercent) }}%</span>
        </div>
        <!-- 夸克式细进度条 -->
        <div class="quark-quota-bar">
          <div class="quark-quota-fill" :style="{ width: Math.min(100, usedPercent) + '%', backgroundColor: quotaColor }" />
        </div>
        <p class="mt-1.5 text-[11px] tabular-nums text-[var(--color-text-muted)]">
          {{ formatSize(usedSpace) }} / {{ formatSize(totalSpace) }}
        </p>
      </div>

      <!-- 配额卡片折叠态 -->
      <div v-if="collapsed" class="mt-auto mb-2 flex justify-center">
        <BaseTooltip text="存储空间" position="right">
          <button
            type="button"
            class="size-8 flex flex-col items-center justify-center rounded-sm text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] transition-colors"
          >
            <Cloud :size="16" :stroke-width="1.75" />
            <span class="text-[9px] tabular-nums mt-0.5" :style="{ color: quotaColor }">{{ Math.round(usedPercent) }}%</span>
          </button>
        </BaseTooltip>
      </div>
    </div>

    <!-- 拖拽手柄 -->
    <div
      v-if="!collapsed"
      class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize flex items-center justify-center transition-colors hover:bg-[var(--color-primary-500)]/20"
      role="separator"
      aria-orientation="vertical"
      :aria-valuenow="width"
      aria-valuemin="200"
      aria-valuemax="420"
      @mousedown="startDrag"
    >
      <GripVertical :size="8" :stroke-width="2" class="text-[var(--color-border-strong)]" />
    </div>
  </aside>
</template>
