<script setup lang="ts">
/**
 * MusicViewer —— 音乐页专属视图（参考百度/夸克网盘音乐页）
 *  - 音乐播放列表：播放/暂停 + 歌名 + 大小
 *  - 点击行播放，正在播放行高亮 + 声波动画
 *  - 底部内嵌 APlayer 播放器（可连续播放）
 */
import { computed, nextTick, ref, watch } from 'vue'
import { Play, Pause, Music } from '@lucide/vue'
import { useFileStore } from '@/stores/file'
import { getPreviewUrl } from '@/utils/preview'
import type { IFileVO } from '@/types'

const fileStore = useFileStore()
const files = computed<IFileVO[]>(() => fileStore.fileList || [])

const emit = defineEmits<{ (e: 'contextmenu', ev: MouseEvent, file: IFileVO): void }>()

// 当前播放
const playingId = ref<string | number | null>(null)
const isPlaying = ref(false)
const audioRef = ref<HTMLAudioElement | null>(null)

function play(row: IFileVO) {
  const id = row.fileId
  if (playingId.value === id) {
    // 同一首：切换播放/暂停
    if (isPlaying.value) {
      audioRef.value?.pause()
      isPlaying.value = false
    } else {
      audioRef.value?.play().catch(() => {})
      isPlaying.value = true
    }
    return
  }
  // 切换歌曲：更新 playingId，由 watch 在 audio 渲染完成后设置 src
  playingId.value = id
}

// 监听歌曲切换，等底部 audio 渲染完成后加载并播放
watch(playingId, (id, old) => {
  if (id === null || id === old) return
  nextTick(() => {
    const audio = audioRef.value
    if (!audio) return
    audio.src = getPreviewUrl(id)
    audio.load()
    audio.play().catch(() => {})
    isPlaying.value = true
  })
})

function onEnded() {
  const idx = files.value.findIndex((f) => f.fileId === playingId.value)
  if (idx >= 0 && idx < files.value.length - 1) {
    play(files.value[idx + 1])
  } else {
    isPlaying.value = false
    playingId.value = null
  }
}

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
  <div class="flex flex-col gap-3">
    <!-- 空态 -->
    <div v-if="files.length === 0" class="py-20 flex flex-col items-center gap-3 text-(--color-text-muted)">
      <Music :size="48" :stroke-width="1.2" />
      <span class="text-sm">暂无音乐文件</span>
    </div>

    <!-- 音乐列表 -->
    <div v-else class="music-list border border-(--color-border) rounded-md overflow-hidden">
      <div
        v-for="(f, i) in files"
        :key="f.fileId"
        class="flex items-center gap-3 px-4 py-2.5 hover:bg-(--color-surface-2) transition-colors cursor-pointer"
        :class="playingId === f.fileId ? 'bg-primary-500/5' : ''"
        @click="play(f)"
        @contextmenu="emit('contextmenu', $event, f)"
      >
        <!-- 序号 / 播放按钮 -->
        <div class="w-6 flex items-center justify-center shrink-0">
          <Play
            v-if="playingId !== f.fileId"
            :size="16"
            class="text-(--color-text-muted)"
          />
          <Pause
            v-else-if="isPlaying"
            :size="16"
            class="text-primary-500"
          />
          <Play
            v-else
            :size="16"
            class="text-primary-500"
          />
        </div>
        <!-- 歌名 -->
        <div class="min-w-0 flex-1">
          <p
            class="text-sm truncate"
            :class="playingId === f.fileId ? 'text-primary-600 font-medium' : 'text-(--color-text)'"
            :title="f.filename"
          >
            {{ f.filename }}
          </p>
          <!-- 正在播放声波动画 -->
          <div v-if="playingId === f.fileId && isPlaying" class="flex items-center gap-0.5 mt-1 h-3">
            <span v-for="n in 4" :key="n" class="w-0.5 rounded-full bg-primary-500 equalizer-bar" />
          </div>
        </div>
        <!-- 序号角标 -->
        <span class="text-[11px] text-(--color-text-muted) shrink-0">{{ i + 1 }}</span>
        <!-- 大小 -->
        <span class="text-[11px] text-(--color-text-muted) w-16 text-right shrink-0">{{ formatSize(f.fileSize) }}</span>
      </div>
    </div>

    <!-- 底部内嵌播放器 -->
    <div v-if="playingId" class="sticky bottom-0 mt-auto border border-(--color-border) rounded-md bg-(--color-surface) shadow-md p-3">
      <audio
        ref="audioRef"
        class="w-full"
        controls
        @play="isPlaying = true"
        @pause="isPlaying = false"
        @ended="onEnded"
      />
    </div>
  </div>
</template>

<style scoped>
.music-list :deep(> div + div) {
  border-top: 1px solid var(--color-border);
}
.equalizer-bar {
  animation: eq 1s ease-in-out infinite;
}
.equalizer-bar:nth-child(2) { animation-delay: 0.15s; }
.equalizer-bar:nth-child(3) { animation-delay: 0.3s; }
.equalizer-bar:nth-child(4) { animation-delay: 0.45s; }
@keyframes eq {
  0%, 100% { height: 4px; }
  50% { height: 12px; }
}
</style>
