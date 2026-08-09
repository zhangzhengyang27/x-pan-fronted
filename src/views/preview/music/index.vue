<script setup>
/**
 * PreviewMusic —— 音乐预览页
 */
import {onMounted, ref, computed, onBeforeUnmount} from 'vue'
import {useRoute} from 'vue-router'
import {Headphones, SkipBack, SkipForward, Play, Pause, Volume2} from '@lucide/vue'
import fileService from '@/api/file'
import panUtil from '@/utils/common'
import {ElMessage} from '@/composables/useToast'
import BaseButton from '@/components/base/BaseButton.vue'

const route = useRoute()
const musicList = ref([])
const musicName = ref('')
const musicSrc = ref('')
const playing = ref(false)
const audioRef = ref(null)
const volume = ref(0.8)
const activeIndex = ref('')

function renderList(dataList) {
  musicList.value = (dataList || []).map((it) => ({
    ...it,
    displayName: it.filename.length > 30 ? it.filename.slice(0, 30) + '…' : it.filename,
  }))
  const target = musicList.value.find((it) => it.fileId === route.params.fileId)
  if (target) {
    musicName.value = target.filename
    musicSrc.value = panUtil.getPreviewUrl(target.fileId)
    activeIndex.value = target.fileId
  }
}

function selectMusic(fileId) {
  const target = musicList.value.find((it) => it.fileId === fileId)
  if (!target) return
  musicName.value = target.filename
  musicSrc.value = panUtil.getPreviewUrl(target.fileId)
  activeIndex.value = fileId
  audioRef.value?.play().catch(() => {})
}

function toggle() {
  if (!audioRef.value) return
  if (audioRef.value.paused) audioRef.value.play()
  else audioRef.value.pause()
}

function onTimeUpdate() {
  playing.value = !audioRef.value?.paused
}

function onVolume(e) {
  volume.value = Number(e.target.value)
  if (audioRef.value) audioRef.value.volume = volume.value
}

function next() {
  const i = musicList.value.findIndex((it) => it.fileId === activeIndex.value)
  if (i >= 0 && i < musicList.value.length - 1) selectMusic(musicList.value[i + 1].fileId)
}
function prev() {
  const i = musicList.value.findIndex((it) => it.fileId === activeIndex.value)
  if (i > 0) selectMusic(musicList.value[i - 1].fileId)
}

onMounted(() => {
  fileService.preview(
    {fileId: panUtil.handleId(route.params.parentId)},
    renderList,
    (res) => ElMessage.error(res.message),
  )
})
onBeforeUnmount(() => audioRef.value?.pause())
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
    <!-- 顶部 -->
    <header class="h-16 px-6 flex items-center border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <Headphones :size="22" class="text-[var(--color-primary-600)] mr-3"/>
      <h1 class="text-base font-semibold">音乐播放</h1>
    </header>

    <div class="flex-1 flex min-h-0">
      <!-- 左侧：唱片 + 控件 -->
      <div class="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        <div class="size-64 rounded-full bg-gradient-to-br from-[var(--color-primary-400)] via-[var(--color-primary-600)] to-[var(--color-primary-800)] shadow-xl flex items-center justify-center"
             :class="playing && 'animate-[spin_8s_linear_infinite]'">
          <div class="size-16 rounded-full bg-[var(--color-surface)] border-4 border-[var(--color-primary-800)]"/>
        </div>

        <div class="text-center">
          <h2 class="text-xl font-semibold mb-1">{{ musicName || '未选择' }}</h2>
          <p class="text-sm text-[var(--color-text-muted)]">R Pan 音乐</p>
        </div>

        <audio
          ref="audioRef"
          :src="musicSrc"
          autoplay
          @play="playing = true"
          @pause="playing = false"
          @timeupdate="onTimeUpdate"
          @ended="next"
          class="hidden"
        />

        <div class="flex items-center gap-3">
          <BaseButton variant="ghost" size="lg" @click="prev"><SkipBack :size="20"/></BaseButton>
          <BaseButton variant="primary" size="lg" class="!rounded-full !size-14" @click="toggle">
            <Pause v-if="playing" :size="22"/>
            <Play v-else :size="22"/>
          </BaseButton>
          <BaseButton variant="ghost" size="lg" @click="next"><SkipForward :size="20"/></BaseButton>
        </div>

        <label class="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Volume2 :size="16"/>
          <input type="range" min="0" max="1" step="0.01" :value="volume" @input="onVolume" class="w-32 accent-[var(--color-primary-600)]"/>
        </label>
      </div>

      <!-- 右侧：播放列表 -->
      <aside class="w-80 border-l border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto">
        <div class="px-5 py-3 text-sm font-medium text-[var(--color-text-muted)] border-b border-[var(--color-border)]">播放列表（{{ musicList.length }}）</div>
        <ul class="p-2">
          <li
            v-for="item in musicList"
            :key="item.fileId"
            :class="['flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors', activeIndex === item.fileId ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)]' : 'hover:bg-[var(--color-surface-2)]']"
            @click="selectMusic(item.fileId)"
          >
            <Headphones :size="14"/>
            <span class="truncate">{{ item.displayName }}</span>
          </li>
        </ul>
      </aside>
    </div>
  </div>
</template>