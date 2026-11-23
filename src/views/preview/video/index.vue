<script setup lang="ts">
/**
 * PreviewVideo —— 视频预览（ArtPlayer），独立新页面播放
 * 支持手动生成 HLS 高清版：转码期间继续播放原视频，完成后无缝切到 HLS。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Film, Download, Zap } from '@lucide/vue'
import { ElMessage } from '@/composables/useToast'
import { getDownloadUrl, resolvePreviewUrl } from '@/utils/preview'
import BaseButton from '@/components/base/BaseButton.vue'
import VideoPreviewer from '@/components/preview/video-previewer.vue'
import previewService from '@/api/preview'
import panUtil from '@/utils/common'

const route = useRoute()
const fileId = computed(() => route.params.fileId as string)
const filename = computed(() => (route.query.filename as string) || 'video')
const downloadUrl = computed(() => getDownloadUrl(fileId.value))

// 统一走签名 URL（与 DrivePreviewModal 一致），避免长期 token 进 URL
const previewUrl = ref('')
// HLS 播放地址：为空时播放原视频；转码完成后由 HLS.js 接管
const hlsUrl = ref('')
const hlsLoading = ref(false)
let hlsPollTimer: ReturnType<typeof setTimeout> | null = null
let hlsPollDeadline = 0
// 路由参数切换时旧文件的 HLS 创建/轮询请求可能仍在途；用代次隔离，
// 防止旧任务返回后把上一部视频的 hlsUrl 写到新视频页。
let requestSeq = 0

function stopHlsPoll() {
  if (hlsPollTimer) {
    clearTimeout(hlsPollTimer)
    hlsPollTimer = null
  }
}

async function pollHlsTask(taskId: string, seq: number) {
  if (seq !== requestSeq) return
  if (Date.now() > hlsPollDeadline) {
    hlsLoading.value = false
    ElMessage.error('高清转码超时，请稍后重试')
    return
  }
  try {
    const data = await new Promise<{ status: number; previewUrl?: string }>((resolve, reject) => {
      previewService.url(taskId, (res) => resolve(res.data), (err) => reject(err))
    })
    if (seq !== requestSeq) return
    if (data.status === 2 && data.previewUrl) {
      hlsUrl.value = panUtil.getUrlPrefix() + data.previewUrl
      hlsLoading.value = false
      ElMessage.success('高清版已生成，正在切换播放')
      return
    }
    if (data.status === 2) {
      // 任务完成但产物地址缺失（目录被清理/脏数据）：继续轮询只会空转 5 分钟。
      hlsLoading.value = false
      ElMessage.error('高清版产物缺失，请重新生成')
      return
    }
    if (data.status === 3) {
      // 失败原因由任务接口返回，播放页不展示内部 ffmpeg 细节
      hlsLoading.value = false
      ElMessage.error('高清转码失败，已继续播放原视频')
      return
    }
    hlsPollTimer = setTimeout(() => pollHlsTask(taskId, seq), 1000)
  } catch {
    if (seq !== requestSeq) return
    // 网络抖动不应该终止转码；下一次轮询继续
    hlsPollTimer = setTimeout(() => pollHlsTask(taskId, seq), 2000)
  }
}

async function generateHls() {
  if (!fileId.value || hlsLoading.value) return
  const seq = requestSeq
  hlsLoading.value = true
  try {
    const task = await previewService.hls(fileId.value)
    if (seq !== requestSeq) return
    if (task.status === 2) {
      // 之前已转好：POST 幂等返回完成，直接走 URL 接口拿播放地址
      const data = await new Promise<{ status: number; previewUrl?: string }>((resolve, reject) => {
        previewService.url(task.taskId, (res) => resolve(res.data), (err) => reject(err))
      })
      if (seq !== requestSeq) return
      if (data.previewUrl) {
        hlsUrl.value = panUtil.getUrlPrefix() + data.previewUrl
      } else {
        ElMessage.error('高清版产物缺失，请重新生成')
      }
      hlsLoading.value = false
      return
    }
    hlsPollDeadline = Date.now() + 5 * 60 * 1000
    pollHlsTask(task.taskId, seq)
  } catch {
    if (seq !== requestSeq) return
    hlsLoading.value = false
    ElMessage.error('创建高清转码任务失败')
  }
}

watch(
  fileId,
  (id) => {
    // 推进代次并清掉旧定时器；在途请求晚到时由 seq 拦截。
    const seq = ++requestSeq
    stopHlsPoll()
    previewUrl.value = ''
    hlsUrl.value = ''
    hlsLoading.value = false
    if (id) {
      resolvePreviewUrl(id)
        .then((u) => {
          if (seq === requestSeq) previewUrl.value = u
        })
        .catch(() => {})
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  requestSeq++
  stopHlsPoll()
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-black">
    <header
      class="h-14 px-6 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur"
    >
      <div class="flex items-center gap-2 min-w-0 text-white">
        <Film :size="20" class="text-primary-400 shrink-0" />
        <h1 class="text-base font-medium truncate">{{ filename }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <BaseButton
          variant="ghost"
          size="sm"
          class="text-white hover:bg-white/10"
          :disabled="hlsLoading"
          @click="generateHls"
        >
          <span class="inline-flex items-center gap-1.5">
            <Zap :size="14" />
            {{ hlsLoading ? '转码中…' : hlsUrl ? '高清版已启用' : '生成高清版' }}
          </span>
        </BaseButton>
        <a :href="downloadUrl" target="_blank">
          <BaseButton variant="ghost" size="sm" class="text-white hover:bg-white/10">
            <span class="inline-flex items-center gap-1.5">
              <Download :size="14" />
              下载
            </span>
          </BaseButton>
        </a>
      </div>
    </header>
    <main class="flex-1 min-h-0 flex items-center justify-center p-4">
      <div class="w-full max-w-5xl">
        <div class="aspect-video w-full bg-black rounded-lg overflow-hidden">
          <VideoPreviewer
            :url="previewUrl || undefined"
            :hls-url="hlsUrl || undefined"
            :file-id="fileId"
            :title="filename"
            class="h-full w-full"
          />
        </div>
      </div>
    </main>
  </div>
</template>
