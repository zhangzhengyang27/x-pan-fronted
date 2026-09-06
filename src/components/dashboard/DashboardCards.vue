<script setup lang="ts">
/**
 * DashboardCards —— 仪表盘卡片
 * 设计规范：G3 风格
 * - 存储概览（已用/总量 + 进度环）
 * - 文件总数（后端全盘统计）
 * - 各类型数量
 * 数据来源：后端 /files/stats 聚合统计接口。
 */
import { computed } from 'vue'
import { Star, FileImage, Folder } from '@lucide/vue'
import { useFavorites } from '@/composables/useFavorites'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import type { UserFileStatsVO } from '@/api/file'

const props = defineProps({
  /** 后端统计概览对象 */
  stats: { type: Object as () => UserFileStatsVO, default: null }
})

defineEmits(['select-favorite'])

const { count: favoriteCount } = useFavorites()

// 存储配额
const userStore = useUserStore()
const { usedSpace, totalSpace, usedPercent } = storeToRefs(userStore)

// 各类型数量（后端聚合值，未返回时默认 0）
const stats = computed(() => {
  const s = props.stats || ({} as UserFileStatsVO)
  return {
    total: s.totalFileCount || 0,
    image: s.imageCount || 0,
    video: s.videoCount || 0,
    doc: s.docCount || 0,
    audio: s.audioCount || 0,
    archive: s.archiveCount || 0,
    code: s.codeCount || 0,
    folder: s.totalFolderCount || 0
  }
})

// 存储环
const quotaColor = computed(() => {
  if (usedPercent.value >= 90) return 'var(--color-quota-danger)'
  if (usedPercent.value >= 70) return 'var(--color-quota-warning)'
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
      <span style="color: var(--color-warning);">
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
