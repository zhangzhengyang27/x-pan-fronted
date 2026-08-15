<script setup lang="ts">
/**
 * VideoCard —— 视频卡片（海报式封面 + 播放按钮）
 * 封面：进入视口后用 canvas 采样单帧生成真实画面缩略图；
 *       生成前显示深色渐变 + Film 图标占位，生成后显示封面。
 */
import { ref, onMounted } from 'vue'
import { Play, Film, LoaderCircle } from '@lucide/vue'
import { useVideoCover } from '@/composables/useVideoCover'
import type { IFileVO } from '@/types'

const props = defineProps<{
  file: IFileVO
}>()

const emit = defineEmits<{ (e: 'open', file: IFileVO): void }>()

const rootEl = ref<HTMLElement | null>(null)
const cover = ref<string | null>(null)
const loading = ref(false)

const { watch } = useVideoCover()

onMounted(() => {
  if (!rootEl.value) return
  loading.value = true
  watch(props.file.fileId, rootEl.value, (dataUrl) => {
    loading.value = false
    if (dataUrl) cover.value = dataUrl
  })
})

function formatSize(size: string | number | undefined): string {
  if (size === undefined || size === null || size === '') return ''
  const bytes = Number(size)
  if (!isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return bytes + ' B'
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes
  let u = -1
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++ }
  return v.toFixed(1) + ' ' + units[u]
}
</script>

<template>
  <div ref="rootEl" class="group cursor-pointer" @click="emit('open', file)">
    <!-- 16:9 封面 -->
    <div
      class="relative aspect-video rounded-md overflow-hidden border border-(--color-border) flex items-center justify-center"
      style="background-color: #111"
    >
      <!-- 真实封面 -->
      <img
        v-if="cover"
        :src="cover"
        :alt="file.filename"
        class="absolute inset-0 w-full h-full object-cover"
      />
      <!-- 占位：深色渐变 + Film 图标（生成中/失败） -->
      <template v-else>
        <div class="absolute inset-0 bg-linear-to-br from-black/80 to-black/40" />
        <LoaderCircle v-if="loading" :size="24" class="relative animate-spin text-white/30" />
        <Film v-else :size="36" :stroke-width="1.2" class="relative text-white/30" />
      </template>

      <!-- 居中播放按钮 -->
      <div class="absolute inset-0 flex items-center justify-center">
        <div
          class="size-11 rounded-full bg-primary-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 scale-75 group-hover:scale-100 shadow-lg"
        >
          <Play :size="18" class="ml-0.5" :fill="'currentColor'" />
        </div>
      </div>
      <!-- 顶部类型角标 -->
      <span class="absolute top-2 left-2 px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-black/50 text-white/80">
        视频
      </span>
    </div>

    <!-- 文件名 -->
    <p class="mt-2 text-xs font-medium text-(--color-text) truncate" :title="file.filename">
      {{ file.filename }}
    </p>
    <p class="text-[11px] text-(--color-text-muted)">{{ formatSize(file.fileSize) }}</p>
  </div>
</template>
