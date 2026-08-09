<script setup>
/**
 * AppNavbar —— 左侧导航栏（默认 240px，可折叠 64px）
 * 顶部：全部文件 / 图片 / 文档 / 视频 / 音乐
 * 中部：我的分享
 * 底部：回收站
 */
import {computed, onMounted} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {useNavbarStore} from '@/stores/navbar'
import {storeToRefs} from 'pinia'
import {
  Files, Image as ImageIcon, FileType2 as FileText, Video, Music2,
  Share2, Trash2, PanelLeftClose, PanelLeftOpen,
} from '@lucide/vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import {ref} from 'vue'

const store = useNavbarStore()
const route = useRoute()
const router = useRouter()

const {active} = storeToRefs(store)
const {change} = store
const collapsed = ref(false)

const groups = computed(() => [
  {
    items: [
      {key: 'Files',  label: '全部文件', icon: Files},
      {key: 'Imgs',   label: '图片',     icon: ImageIcon},
      {key: 'Docs',   label: '文档',     icon: FileText},
      {key: 'Videos', label: '视频',     icon: Video},
      {key: 'Musics', label: '音乐',     icon: Music2},
    ],
  },
  {
    items: [
      {key: 'Shares',  label: '我的分享', icon: Share2},
      {key: 'Recycles', label: '回收站',  icon: Trash2},
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

onMounted(() => {
  const name = route.name
  change(name === 'Index' ? 'Files' : name)
})
</script>

<template>
  <aside
    class="shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-[width] duration-300 ease-[var(--ease)] overflow-hidden"
    :style="{width: collapsed ? '64px' : 'var(--navbar-w)'}"
  >
    <div class="h-full flex flex-col py-3 gap-4">
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
    </div>
  </aside>
</template>