<script setup>
/**
 * AudioPreviewer —— 原生 <audio> + 自定义控件
 * 浏览器原生 audio 在 macOS Safari / Chrome 均良好支持，
 * 比 ArtPlayer 体积小，且符合"播放器没必要为单个 mp3 装一个依赖"的工程原则。
 */
import {ref, computed} from 'vue'
import {Play, Pause, Volume2, Music} from '@lucide/vue'
import {getPreviewUrl} from '@/utils/preview'

const props = defineProps({
  fileId: {type: [String, Number], required: true},
  filename: {type: String, default: ''},
})

const audioRef = ref(null)
const playing = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(0.8)

const progress = computed(() => (duration.value ? (currentTime.value / duration.value) * 100 : 0))

function toggle() {
  if (!audioRef.value) return
  if (playing.value) audioRef.value.pause()
  else audioRef.value.play()
}

function onTimeUpdate() {
  if (audioRef.value) currentTime.value = audioRef.value.currentTime
}

function onLoaded() {
  if (audioRef.value) duration.value = audioRef.value.duration || 0
}

function onEnded() {
  playing.value = false
}

function onVolumeChange() {
  if (audioRef.value) audioRef.value.volume = volume.value
}

function seek(e) {
  if (!audioRef.value || !duration.value) return
  const rect = e.currentTarget.getBoundingClientRect()
  const ratio = (e.clientX - rect.left) / rect.width
  audioRef.value.currentTime = Math.max(0, Math.min(duration.value, ratio * duration.value))
}

function fmtTime(s) {
  if (!s || !isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="h-full flex items-center justify-center px-6 py-8">
    <div class="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
      <div class="flex items-center gap-4 mb-6">
        <div class="size-14 rounded-xl bg-gradient-to-br from-[var(--color-primary-500)] to-[var(--color-primary-700)] flex items-center justify-center shadow-sm">
          <Music :size="22" class="text-white"/>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-[var(--color-text)] truncate">{{ filename }}</p>
          <p class="text-xs text-[var(--color-text-muted)]">音频预览</p>
        </div>
      </div>

      <audio
        ref="audioRef"
        :src="getPreviewUrl(fileId)"
        @play="playing = true"
        @pause="playing = false"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoaded"
        @ended="onEnded"
      />

      <div class="flex items-center gap-3">
        <button
          type="button"
          class="size-11 rounded-full bg-[var(--color-primary-600)] text-white flex items-center justify-center hover:bg-[var(--color-primary-700)] transition-colors shadow-sm"
          :aria-label="playing ? '暂停' : '播放'"
          @click="toggle"
        >
          <Pause v-if="playing" :size="18"/>
          <Play v-else :size="18" class="ml-0.5"/>
        </button>
        <div class="flex-1">
          <div
            class="h-1.5 rounded-full bg-[var(--color-surface-2)] cursor-pointer overflow-hidden"
            @click="seek"
          >
            <div
              class="h-full bg-[var(--color-primary-600)] rounded-full transition-all"
              :style="{width: `${progress}%`}"
            />
          </div>
          <div class="mt-1 flex items-center justify-between text-[11px] text-[var(--color-text-muted)] tabular-nums">
            <span>{{ fmtTime(currentTime) }}</span>
            <span>{{ fmtTime(duration) }}</span>
          </div>
        </div>
        <div class="flex items-center gap-1.5 text-[var(--color-text-muted)]">
          <Volume2 :size="14"/>
          <input
            v-model.number="volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="w-16 accent-[var(--color-primary)]"
            aria-label="音量"
            @input="onVolumeChange"
          />
        </div>
      </div>
    </div>
  </div>
</template>