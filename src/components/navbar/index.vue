<script setup>
/**
 * AppNavbar —— 左侧导航栏（可折叠 / 可拖拽调宽度 / 显示存储配额）
 * 顶部：全部文件 / 图片 / 文档 / 视频 / 音乐
 * 中部：我的分享
 * 底部：回收站 + 存储配额
 */
import {computed, onMounted, ref} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {useNavbarStore} from '@/stores/navbar'
import {storeToRefs} from 'pinia'
import {
  Files, Image as ImageIcon, FileType2 as FileText, Video, Music2,
  Share2, Trash2, PanelLeftClose, PanelLeftOpen, GripVertical,
} from '@lucide/vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import {useResizable} from '@/composables/useResizable'
import {useUserStore} from '@/stores/user'
import {storeToRefs as toRefs} from 'pinia'

const store = useNavbarStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const {active} = storeToRefs(store)
const {usedSpace, totalSpace, usedPercent} = toRefs(userStore)
const {change} = store
const collapsed = ref(false)

const {width, startDrag} = useResizable('x-pan.navbar.width', {
  min: 200,
  max: 420,
  defaultWidth: 240,
})

const groups = computed(() => [
  {
    items: [
      {key: 'Files', label: '全部文件', icon: Files},
      {key: 'Imgs', label: '图片', icon: ImageIcon},
      {key: 'Docs', label: '文档', icon: FileText},
      {key: 'Videos', label: '视频', icon: Video},
      {key: 'Musics', label: '音乐', icon: Music2},
    ],
  },
  {
    items: [
      {key: 'Shares', label: '我的分享', icon: Share2},
      {key: 'Recycles', label: '回收站', icon: Trash2},
    ],
  },
])

function go(key) {
  change(key)
  const map = {
    Files: '/files', Imgs: '/imgs', Docs: '/docs',
    Videos: '/videos', Musics: '/musics',
    Shares: '/shares', Recycles: '/recycles',
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

onMounted(() => {
  const name = route.name
  change(name === 'Index' ? 'Files' : name)
})
</script>

<template>
  <aside
    class="relative shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-[width] duration-300 ease-[var(--ease)] overflow-hidden"
    :style="{width: collapsed ? '64px' : `${width}px`}"
  >
    <div class="h-full flex flex-col py-3 gap-4">
      <!-- 折叠按钮 -->
      <div class="px-3 flex justify-end">
        <BaseTooltip :text="collapsed ? '展开侧边栏' : '收起侧边栏'" position="right">
          <button
            type="button"
            class="size-8 rounded-md flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
            :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
            @click="collapsed = !collapsed"
          >
            <PanelLeftClose v-if="!collapsed" :size="16"/>
            <PanelLeftOpen v-else :size="16"/>
          </button>
        </BaseTooltip>
      </div>

      <!-- 导航项 -->
      <div
        v-for="(group, gi) in groups"
        :key="gi"
        class="flex flex-col gap-0.5"
      >
        <button
          v-for="item in group.items"
          :key="item.key"
          type="button"
          :class="[
            'group flex items-center gap-3 mx-2 px-3 h-9 rounded-lg text-sm transition-colors',
            'hover:bg-[var(--color-surface-2)]',
            active === item.key
              ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-medium'
              : 'text-[var(--color-text)]',
            active === item.key && 'dark:bg-[var(--color-primary-900)]/30 dark:text-[var(--color-primary-300)]',
          ]"
          @click="go(item.key)"
        >
          <component
            :is="item.icon"
            :size="18"
            :stroke-width="2"
            :class="active === item.key ? 'text-[var(--color-primary-600)] dark:text-[var(--color-primary-400)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]'"
          />
          <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
        </button>
      </div>

      <!-- 配额卡片 -->
      <div v-if="!collapsed" class="mt-auto mx-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
        <div class="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-1.5">
          <span>已用空间</span>
          <span class="tabular-nums">{{ Math.round(usedPercent) }}%</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface)]">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="
              usedPercent >= 90
                ? 'bg-[var(--color-danger)]'
                : usedPercent >= 70
                  ? 'bg-[var(--color-warning)]'
                  : 'bg-[var(--color-primary)]'
            "
            :style="{width: `${Math.min(100, usedPercent)}%`}"
          />
        </div>
        <p class="mt-1.5 text-[11px] text-[var(--color-text-muted)] tabular-nums">
          {{ formatSize(usedSpace) }} / {{ formatSize(totalSpace) }}
        </p>
      </div>
    </div>

    <!-- 拖拽手柄（仅展开时） -->
    <div
      v-if="!collapsed"
      class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize flex items-center justify-center hover:bg-[var(--color-primary)]/10 transition-colors"
      role="separator"
      aria-orientation="vertical"
      :aria-valuenow="width"
      aria-valuemin="200"
      aria-valuemax="420"
      @mousedown="startDrag"
    >
      <GripVertical :size="10" class="text-[var(--color-text-muted)] opacity-0 hover:opacity-100"/>
    </div>
  </aside>
</template>