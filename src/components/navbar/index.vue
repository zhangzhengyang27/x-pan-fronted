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
  Star,
  Copy as CopyIcon
} from '@lucide/vue'
import { useResizable } from '@/composables/useResizable'
import { useBreakpoint } from '@/composables/useMediaQuery'

const store = useNavbarStore()
const route = useRoute()
const router = useRouter()

const { active } = storeToRefs(store)
const { change } = store
const { isMobile, isTablet, isDesktop } = useBreakpoint()
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
      { key: 'Imgs', label: '图片', icon: ImageIcon, path: '/imgs', query: {} },
      { key: 'Docs', label: '文档', icon: FileText, path: '/docs', query: {} },
      { key: 'Videos', label: '视频', icon: Video, path: '/videos', query: {} },
      { key: 'Musics', label: '音乐', icon: Music, path: '/musics', query: {} },
      { key: 'Favorites', label: '我的收藏', icon: Star, path: '/favorites', query: {} }
    ]
  },
  {
    title: '工具',
    items: [
      { key: 'Shares', label: '我的分享', icon: Share2, path: '/shares', query: {} },
      { key: 'Offline', label: '离线下载', icon: DownloadIcon, path: '/offline', query: {} },
      { key: 'Vault', label: '隐私保险箱', icon: Shield, path: '/vault', query: {} },
      { key: 'Stats', label: '存储统计', icon: BarChart3, path: '/stats', query: {} },
      { key: 'Dedup', label: '文件去重', icon: CopyIcon, path: '/dedup', query: {} },
      { key: 'Recycles', label: '回收站', icon: Trash2, path: '/recycles', query: {} }
    ]
  }
])

const goMap = {
  Files: { path: '/files' },
  Imgs: { path: '/imgs' },
  Docs: { path: '/docs' },
  Videos: { path: '/videos' },
  Musics: { path: '/musics' },
  Shares: { path: '/shares' },
  Recycles: { path: '/recycles' },
  Offline: { path: '/offline' },
  Vault: { path: '/vault' },
  Stats: { path: '/stats' },
  Favorites: { path: '/favorites' },
  Dedup: { path: '/dedup' }
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
</script>

<template>
  <!-- 移动端 / 平板抽屉 -->
  <Teleport v-if="isMobile || isTablet" to="body">
    <Transition name="drawer">
      <div v-if="mobileOpen" class="fixed inset-0 z-1600 flex" @click.self="mobileOpen = false">
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

          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>

  <!-- 桌面端固定侧栏（平板及以上横屏显示为可拖拽固定侧栏） -->
  <aside
    v-if="isDesktop"
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
