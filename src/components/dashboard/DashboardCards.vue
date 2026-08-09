<script setup>
/**
 * DashboardCard —— 仪表盘卡片
 * P1.9 增强：
 * - 统计：总数 / 各类文件数 / 总占用（基于当前列表）
 * - 收藏夹：localStorage 收藏的文件
 * - 最近访问：localStorage 最近点击
 * - 大文件 Top 5（基于当前列表）
 */
import {computed} from 'vue'
import {Star, Clock, FileImage, FileVideo, FileText, FileArchive, FileAudio, FileCode, Folder, HardDrive, ChevronRight, FileBarChart2} from '@lucide/vue'
import {useFavorites} from '@/composables/useFavorites'
import {useRecent} from '@/composables/useRecent'
import {useRouter} from 'vue-router'
import BaseButton from '@/components/base/BaseButton.vue'
import FileThumbnail from '@/components/file-table/FileThumbnail.vue'
import {cn} from '@/utils/classnames'

const props = defineProps({
  /** 当前文件夹的文件列表（用于统计 / 大文件 Top） */
  files: {type: Array, default: () => []},
})

const emit = defineEmits(['select-favorite'])

const {favorites, count: favoriteCount, toggle: toggleFav, remove: removeFav} = useFavorites()
const {recent, visit} = useRecent()
const router = useRouter()

function fileIcon(type) {
  return {0: Folder, 2: FileArchive, 3: FileText, 7: FileImage, 8: FileAudio, 9: FileVideo, 11: FileCode}[type] || FileText
}

// ─── 统计 ────────────────────────────────────────────────────────────────
const stats = computed(() => {
  const result = {
    total: props.files.length,
    image: 0, video: 0, doc: 0, audio: 0, archive: 0, code: 0, folder: 0,
  }
  props.files.forEach((f) => {
    if (f.folderFlag === 1) result.folder++
    else {
      const t = f.fileType
      if ([7].includes(t)) result.image++
      else if ([9].includes(t)) result.video++
      else if ([3, 4, 5, 6, 10].includes(t)) result.doc++
      else if ([8].includes(t)) result.audio++
      else if ([2].includes(t)) result.archive++
      else if ([11].includes(t)) result.code++
    }
  })
  return result
})

const statItems = computed(() => [
  {key: 'image', label: '图片', icon: FileImage, color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-900/20', value: stats.value.image},
  {key: 'video', label: '视频', icon: FileVideo, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20', value: stats.value.video},
  {key: 'doc', label: '文档', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', value: stats.value.doc},
  {key: 'audio', label: '音频', icon: FileAudio, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20', value: stats.value.audio},
  {key: 'archive', label: '压缩', icon: FileArchive, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', value: stats.value.archive},
  {key: 'folder', label: '文件夹', icon: Folder, color: 'text-[var(--color-primary-600)]', bg: 'bg-[var(--color-primary-50)] dark:bg-[var(--color-primary-900)]/20', value: stats.value.folder},
])

// ─── 大文件 Top 5 ────────────────────────────────────────────────────────
function parseSize(desc) {
  if (!desc) return 0
  const m = String(desc).match(/^([\d.]+)\s*(B|KB|MB|GB|K|M|G)?$/i)
  if (!m) return 0
  const n = parseFloat(m[1])
  const unit = (m[2] || 'B').toUpperCase()
  const mul = {B: 1, K: 1024, KB: 1024, M: 1024 * 1024, MB: 1024 * 1024, G: 1024 * 1024 * 1024, GB: 1024 * 1024 * 1024}[unit] || 1
  return Math.floor(n * mul)
}

const largestFiles = computed(() => {
  return [...props.files]
      .filter((f) => f.folderFlag !== 1)
      .map((f) => ({...f, _size: parseSize(f.fileSizeDesc)}))
      .sort((a, b) => b._size - a._size)
      .slice(0, 5)
})

function goFile(f) {
  visit(f)
  if (f.fileType === 0) {
    router.push({path: '/file', query: {folderId: f.fileId}})
  } else {
    router.push({path: '/preview/image', query: {fileId: f.fileId}}).catch(() => {})
  }
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
    <!-- 统计卡片 -->
    <div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-[var(--color-text)] flex items-center gap-1.5">
          <HardDrive :size="14"/>
          本目录统计
        </h3>
        <span class="text-xs text-[var(--color-text-muted)] tabular-nums">{{ stats.total }} 项</span>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <div
          v-for="s in statItems"
          :key="s.key"
          :class="cn('flex items-center gap-2 p-2 rounded-lg', s.bg)"
        >
          <component :is="s.icon" :size="16" :class="s.color"/>
          <div class="min-w-0">
            <p class="text-xs text-[var(--color-text-muted)] truncate">{{ s.label }}</p>
            <p :class="cn('text-sm font-semibold tabular-nums', s.color)">{{ s.value }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 收藏夹 -->
    <div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-[var(--color-text)] flex items-center gap-1.5">
          <Star :size="14"/>
          收藏夹
        </h3>
        <span class="text-xs text-[var(--color-text-muted)] tabular-nums">{{ favoriteCount }} 项</span>
      </div>
      <div v-if="favorites.length === 0" class="py-4 text-center text-xs text-[var(--color-text-muted)]">
        在文件上点击星标即可收藏
      </div>
      <ul v-else class="space-y-1 max-h-32 overflow-auto">
        <li
          v-for="f in favorites.slice(0, 5)"
          :key="f.fileId"
          class="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-[var(--color-surface-2)] cursor-pointer group"
          @click="goFile(f)"
        >
          <component :is="fileIcon(f.fileType)" :size="14" class="shrink-0 text-amber-500"/>
          <span class="flex-1 truncate text-xs text-[var(--color-text)]">{{ f.filename }}</span>
          <button
            class="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
            type="button"
            @click.stop="removeFav(f.fileId)"
          >×</button>
        </li>
      </ul>
    </div>

    <!-- 大文件 Top -->
    <div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-[var(--color-text)] flex items-center gap-1.5">
          <FileBarChart2 :size="14"/>
          大文件 Top 5
        </h3>
      </div>
      <div v-if="largestFiles.length === 0" class="py-4 text-center text-xs text-[var(--color-text-muted)]">
        暂无文件
      </div>
      <ul v-else class="space-y-1 max-h-32 overflow-auto">
        <li
          v-for="(f, i) in largestFiles"
          :key="f.fileId"
          class="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-[var(--color-surface-2)] cursor-pointer"
          @click="goFile(f)"
        >
          <span class="w-5 h-5 shrink-0 rounded-full bg-[var(--color-primary-500)] text-white text-[10px] font-semibold inline-flex items-center justify-center tabular-nums">{{ i + 1 }}</span>
          <component :is="fileIcon(f.fileType)" :size="14" class="shrink-0 text-[var(--color-text-muted)]"/>
          <span class="flex-1 truncate text-xs text-[var(--color-text)]">{{ f.filename }}</span>
          <span class="text-[10px] text-[var(--color-text-muted)] tabular-nums">{{ f.fileSizeDesc }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>