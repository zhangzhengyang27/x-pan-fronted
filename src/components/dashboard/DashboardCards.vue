<script setup lang="ts">
/**
 * DashboardCards —— 仪表盘卡片
 * 设计规范：G3 风格
 * - 存储概览（已用/总量 + 进度环）
 * - 文件总数
 * - 最近上传
 * - 分享数
 */
import { computed } from 'vue'
import {
  Star,
  FileImage,
  FileVideo,
  FileText,
  FileArchive,
  FileAudio,
  FileCode,
  Folder,
  HardDrive,
  FileBarChart2
} from '@lucide/vue'
import { useFavorites } from '@/composables/useFavorites'
import { useRecent } from '@/composables/useRecent'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'

const props = defineProps({
  files: { type: Array, default: () => [] }
})

defineEmits(['select-favorite'])

const { favorites, count: favoriteCount, remove: removeFav } = useFavorites()
const { visit } = useRecent()
const router = useRouter()

// 存储配额
const userStore = useUserStore()
const { usedSpace, totalSpace, usedPercent } = storeToRefs(userStore)

function fileIcon(type) {
  return (
    {
      0: Folder,
      2: FileArchive,
      3: FileText,
      7: FileImage,
      8: FileAudio,
      9: FileVideo,
      11: FileCode
    }[type] || FileText
  )
}

// 统计
const stats = computed(() => {
  const result = {
    total: props.files.length,
    image: 0,
    video: 0,
    doc: 0,
    audio: 0,
    archive: 0,
    code: 0,
    folder: 0
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
  { key: 'image', label: '图片', icon: FileImage, value: stats.value.image },
  { key: 'video', label: '视频', icon: FileVideo, value: stats.value.video },
  { key: 'doc', label: '文档', icon: FileText, value: stats.value.doc },
  { key: 'folder', label: '文件夹', icon: Folder, value: stats.value.folder }
])

// 存储环
const quotaColor = computed(() => {
  if (usedPercent.value >= 90) return 'vardanger'
  if (usedPercent.value >= 70) return 'varwarning'
  return 'var(--color-primary-500)'
})

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

// 大文件 Top 5
function parseSize(desc) {
  if (!desc) return 0
  const m = String(desc).match(/^([\d.]+)\s*(B|KB|MB|GB|K|M|G)?$/i)
  if (!m) return 0
  const n = parseFloat(m[1])
  const unit = (m[2] || 'B').toUpperCase()
  const mul = { B: 1, K: 1024, KB: 1024, M: 1024 * 1024, MB: 1024 * 1024, G: 1024 * 1024 * 1024, GB: 1024 * 1024 * 1024 }[unit] || 1
  return Math.floor(n * mul)
}

const largestFiles = computed(() => {
  return [...props.files]
    .filter((f) => f.folderFlag !== 1)
    .map((f) => ({ ...f, _size: parseSize(f.fileSizeDesc) }))
    .sort((a, b) => b._size - a._size)
    .slice(0, 5)
})

function goFile(f) {
  visit(f)
  if (f.fileType === 0) {
    router.push({ path: '/file', query: { folderId: f.fileId } })
  }
}

function shorten(str, len = 8) {
  if (!str) return ''
  return str.length > len ? str.substring(0, len) + '…' : str
}
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <!-- 存储环 -->
    <div
      class="rounded-xl border border-(--color-border) p-4 flex flex-col items-center justify-center bg-(--color-surface-container-low)"
    >
      <div class="relative w-24 h-24 mb-3">
        <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" fill="transparent" r="40" :stroke="'var(--color-border)'" stroke-width="8" />
          <circle
            cx="50" cy="50" fill="transparent" r="40"
            :stroke="quotaColor"
            stroke-width="8"
            stroke-linecap="round"
            :stroke-dasharray="251.2"
            :stroke-dashoffset="251.2 * (1 - Math.min(100, usedPercent) / 100)"
          />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-xl font-bold tabular-nums text-(--color-text)">
            {{ Math.round(usedPercent) }}%
          </span>
          <span class="text-[10px]" style="color: var(--color-text-muted);">Used</span>
        </div>
      </div>
      <div class="text-xs tabular-nums" style="color: var(--color-text-muted);">
        {{ formatSize(usedSpace) }} / {{ formatSize(totalSpace) }}
      </div>
    </div>

    <!-- 统计卡片 - 文件总数 -->
    <div
      class="rounded-xl border border-(--color-border) p-4 flex flex-col justify-between bg-(--color-surface-container-low)"
    >
      <span :style="{ color: quotaColor }">
        <Folder :size="20" :stroke-width="2" />
      </span>
      <div>
        <div class="text-2xl font-bold tabular-nums text-(--color-text)">
          {{ stats.total.toLocaleString() }}
        </div>
        <div class="text-xs" style="color: var(--color-text-muted);">文件总数</div>
      </div>
    </div>

    <!-- 图片数 -->
    <div
      class="rounded-xl border border-(--color-border) p-4 flex flex-col justify-between bg-(--color-surface-container-low)"
    >
      <span style="color: var(--color-primary-500);">
        <FileImage :size="20" :stroke-width="2" />
      </span>
      <div>
        <div class="text-2xl font-bold tabular-nums text-(--color-text)">
          {{ stats.image.toLocaleString() }}
        </div>
        <div class="text-xs" style="color: var(--color-text-muted);">图片</div>
      </div>
    </div>

    <!-- 收藏数 -->
    <div
      class="rounded-xl border border-(--color-border) p-4 flex flex-col justify-between bg-(--color-surface-container-low)"
    >
      <span style="color: varwarning;">
        <Star :size="20" :stroke-width="2" />
      </span>
      <div>
        <div class="text-2xl font-bold tabular-nums text-(--color-text)">
          {{ favoriteCount.toLocaleString() }}
        </div>
        <div class="text-xs" style="color: var(--color-text-muted);">收藏</div>
      </div>
    </div>
  </div>
</template>
