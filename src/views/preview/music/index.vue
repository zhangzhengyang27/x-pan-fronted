<script setup lang="ts">
/**
 * PreviewMusic —— 音乐预览（自定义播放器）
 */
import { computed, onMounted, ref, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { Headphones, Download, Play, Pause, SkipBack, SkipForward, Music } from '@lucide/vue'
import fileService from '@/api/file'
import panUtil from '@/utils/common'
import { ElMessage } from '@/composables/useToast'
import { getDownloadUrl, getPreviewUrl, resolvePreviewUrl } from '@/utils/preview'
import BaseButton from '@/components/base/BaseButton.vue'

const route = useRoute()
const musicList = ref([])
const musicName = ref('')
const musicSrc = ref('')
const playing = ref(false)
const audioRef = ref(null)
const activeIndex = ref('')
const currentTime = ref(0)
const duration = ref(0)

const downloadUrl = computed(() => getDownloadUrl(route.params.fileId))

function renderList(dataList) {
  musicList.value = (dataList || []).map((it) => ({
    ...it,
    displayName: it.filename.length > 30 ? it.filename.slice(0, 30) + '…' : it.filename
  }))
}

async function playMusic(item, idx) {
  musicName.value = item.filename
  // 优先使用签名 URL（短时效、绑定 fileId），失败降级到授权 query 直链
  let url = ''
  try {
    url = await resolvePreviewUrl(item.fileId)
  } catch {
    url = getPreviewUrl(item.fileId)
  }
  musicSrc.value = url
  activeIndex.value = idx
  playing.value = true
  setTimeout(() => audioRef.value?.play(), 30)
}

function next() {
  const idx = musicList.value.findIndex((m) => activeIndex.value === m.fileId)
  if (idx === -1 || idx === musicList.value.length - 1) return
  playMusic(musicList.value[idx + 1], idx + 1)
}

function prev() {
  const idx = musicList.value.findIndex((m) => activeIndex.value === m.fileId)
  if (idx <= 0) return
  playMusic(musicList.value[idx - 1], idx - 1)
}

function togglePlay() {
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
  next()
}

onMounted(() => {
  fileService.list(
    { parentId: panUtil.handleId(route.params.parentId || ''), fileTypes: '8', pageSize: 9999 },
    (res) => {
      const list = res.data?.records || []
      renderList(list)
      const idx = list.findIndex((x) => x.fileId === route.params.fileId)
      if (idx !== -1) {
        playMusic(list[idx], idx)
      }
    },
    (res) => ElMessage.error(res.message)
  )
})

onBeforeUnmount(() => {
  if (audioRef.value) audioRef.value.pause()
})
</script>

<template>
  <div
    class="min-h-screen flex bg-linear-to-br from-(--color-surface) to-(--color-surface-2)"
  >
    <!-- 播放列表 -->
    <aside
      class="w-80 shrink-0 border-r border-(--color-border) bg-(--color-surface)/80 backdrop-blur"
    >
      <div class="h-14 px-5 flex items-center gap-2 border-b border-(--color-border)">
        <Headphones :size="18" class="text-primary-600" />
        <h2 class="text-sm font-medium">音乐库</h2>
        <span class="text-xs text-(--color-text-muted) ml-auto"
          >{{ musicList.length }} 首</span
        >
      </div>
      <div class="overflow-y-auto" style="height: calc(100vh - 3.5rem)">
        <button
          v-for="(item, idx) in musicList"
          :key="item.fileId"
          type="button"
          class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-(--color-surface-2) transition-colors"
          :class="
            activeIndex === item.fileId
              ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
              : ''
          "
          @click="playMusic(item, idx)"
        >
          <Music :size="16" class="shrink-0" />
          <span class="text-sm truncate flex-1">{{ item.displayName }}</span>
          <Play v-if="activeIndex !== item.fileId" :size="12" class="opacity-50" />
          <Pause v-else :size="12" />
        </button>
      </div>
    </aside>

    <!-- 播放器 -->
    <main class="flex-1 flex items-center justify-center p-8">
      <div
        class="w-full max-w-md rounded-sm border border-(--color-border) bg-(--color-surface) p-8 shadow-lg"
      >
        <div class="flex items-center gap-4 mb-6">
          <div
            class="size-20 rounded-sm bg-linear-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md"
          >
            <Music :size="32" class="text-white" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-base font-medium text-(--color-text) truncate">
              {{ musicName || '未选择' }}
            </p>
            <p class="text-xs text-(--color-text-muted) mt-0.5">X Pan 音乐预览</p>
          </div>
        </div>

        <audio
          ref="audioRef"
          :src="musicSrc"
          @play="playing = true"
          @pause="playing = false"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onLoaded"
          @ended="onEnded"
        />

        <div class="flex items-center justify-center gap-4">
          <button
            type="button"
            class="size-12 rounded-full hover:bg-(--color-surface-2) flex items-center justify-center"
            aria-label="上一首"
            @click="prev"
          >
            <SkipBack :size="20" />
          </button>
          <button
            type="button"
            class="size-16 rounded-full bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 transition-colors shadow-md"
            aria-label="播放/暂停"
            @click="togglePlay"
          >
            <Pause v-if="playing" :size="26" />
            <Play v-else :size="26" class="ml-0.5" />
          </button>
          <button
            type="button"
            class="size-12 rounded-full hover:bg-(--color-surface-2) flex items-center justify-center"
            aria-label="下一首"
            @click="next"
          >
            <SkipForward :size="20" />
          </button>
        </div>

        <div class="mt-6 flex justify-center">
          <a :href="downloadUrl" target="_blank">
            <BaseButton variant="ghost" size="sm">
              <span class="inline-flex items-center gap-1.5">
                <Download :size="14" />
                下载
              </span>
            </BaseButton>
          </a>
        </div>
      </div>
    </main>
  </div>
</template>
