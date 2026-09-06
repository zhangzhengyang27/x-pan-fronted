<script setup lang="ts">
/**
 * ArchivePreviewer —— 压缩包预览（P0 新增格式）
 * 压缩包不是「可渲染文件」而是「可解压文件」：
 * - zip/tar/gz/bz2：复用后端 /file/extract 在线解压（异步任务 + 进度轮询）；
 * - rar/7z：后端暂不支持解压，提示用户下载后本地处理。
 *
 * 复用 ptoken 鉴权链路（不额外暴露长期 token），解压结果直接入库到当前目录。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { Archive, FileArchive, Download, LoaderCircle, CheckCircle2, AlertCircle } from '@lucide/vue'
import { getDownloadUrl, getFileExtension } from '@/utils/preview'
import extractService from '@/api/file/extract'
import BaseButton from '@/components/base/BaseButton.vue'
import { ElMessage } from '@/composables/useToast'

const props = defineProps({
  fileId: { type: [String, Number], required: true },
  /** 文件名（用于判断扩展名 / 展示） */
  filename: { type: String, default: '' },
  /** 外部已解析好的预览 URL（本组件不使用，仅为统一契约保留） */
  url: { type: String, default: '' }
})

const emit = defineEmits(['extracted'])

const ext = computed(() => getFileExtension(props.filename || '').toLowerCase())
// 后端支持 zip / tar / gz / bz2 在线解压（rar/7z 暂不支持）
const EXTRACTABLE_EXTS = ['zip', 'tar', 'gz', 'bz2']
const canExtract = computed(() => EXTRACTABLE_EXTS.includes(ext.value))

const status = ref<'idle' | 'extracting' | 'done' | 'error' | 'timeout'>('idle')
const progress = ref(0)
const errorMsg = ref('')
const resultCount = ref(0)

let pollTimer: ReturnType<typeof setInterval> | null = null
// 轮询超时保护（对齐 ExtractDialog 的 5 分钟模式）：超时停止轮询并提示，
// 后台任务继续跑，文件最终仍会入库
const POLL_TIMEOUT_MS = 5 * 60 * 1000
let pollStartedAt = 0

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function startExtract() {
  if (!canExtract.value || status.value === 'extracting') return
  status.value = 'extracting'
  progress.value = 0
  errorMsg.value = ''
  resultCount.value = 0
  pollStartedAt = Date.now()

  extractService.extract(
    String(props.fileId),
    (res) => {
      const task = res?.data
      if (!task?.taskId) {
        status.value = 'error'
        errorMsg.value = '创建解压任务失败'
        return
      }
      // 轮询进度
      stopPolling()
      pollTimer = setInterval(() => {
        // 超过总上限仍未结束：停止轮询并提示（避免极端情况下永久轮询）
        if (Date.now() - pollStartedAt > POLL_TIMEOUT_MS) {
          stopPolling()
          status.value = 'timeout'
          ElMessage.warning('解压耗时较长，已转为后台处理，请稍后在文件列表中查看结果')
          return
        }
        extractService.progress(
          task.taskId,
          (p) => {
            const t = p?.data
            if (!t) return
            progress.value = t.progress ?? 0
            // status: 0 待开始 1 解压中 2 完成 3 失败
            if (t.status === 2) {
              stopPolling()
              status.value = 'done'
              resultCount.value = t.totalCount ?? (t.result?.length ?? 0)
              ElMessage.success(`解压完成，共 ${resultCount.value} 个文件已入库`)
              emit('extracted', t.result)
            } else if (t.status === 3) {
              stopPolling()
              status.value = 'error'
              errorMsg.value = t.errorMsg || '解压失败'
              ElMessage.error(errorMsg.value)
            }
          },
          () => {
            /* 单次轮询失败不中断，继续重试 */
          }
        )
      }, 1500)
    },
    () => {
      status.value = 'error'
      errorMsg.value = '创建解压任务失败'
    }
  )
}

onBeforeUnmount(stopPolling)

const downloadUrl = computed(() => getDownloadUrl(props.fileId))
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-5 px-8 py-12 bg-(--color-surface-2)">
    <div class="flex size-16 items-center justify-center rounded-2xl bg-(--color-surface)">
      <FileArchive :size="32" class="text-(--color-text-muted)" />
    </div>

    <div class="text-center">
      <div class="text-base font-medium text-(--color-text)">{{ filename }}</div>
      <div class="mt-1 text-sm text-(--color-text-muted)">
        {{ canExtract ? '压缩包，可在线解压到当前目录' : '该压缩格式暂不支持在线解压' }}
      </div>
    </div>

    <!-- 解压进度 -->
    <div v-if="status === 'extracting'" class="w-full max-w-[360px]">
      <div class="h-2 w-full overflow-hidden rounded-full bg-(--color-surface)">
        <div
          class="h-full rounded-full bg-primary-500 transition-all duration-300"
          :style="{ width: `${Math.min(100, progress)}%` }"
        />
      </div>
      <div class="mt-2 flex items-center justify-center gap-1.5 text-xs text-(--color-text-muted)">
        <LoaderCircle :size="14" class="animate-spin" />
        解压中… {{ Math.min(100, Math.round(progress)) }}%
      </div>
    </div>

    <!-- 完成态 -->
    <div v-else-if="status === 'done'" class="flex items-center gap-1.5 text-sm text-success">
      <CheckCircle2 :size="16" />
      已解压 {{ resultCount }} 个文件到当前目录
    </div>

    <!-- 错误态 -->
    <div v-else-if="status === 'error'" class="flex items-center gap-1.5 text-sm text-danger">
      <AlertCircle :size="16" />
      {{ errorMsg || '解压失败，请重试' }}
    </div>

    <!-- 超时态：停止轮询，任务转后台继续执行 -->
    <div v-else-if="status === 'timeout'" class="flex items-center gap-1.5 text-sm text-warning">
      <AlertCircle :size="16" />
      解压耗时较长，已转为后台处理，请稍后在文件列表中查看结果
    </div>

    <div class="flex items-center gap-2">
      <BaseButton v-if="canExtract" variant="primary" size="sm" :disabled="status === 'extracting'" @click="startExtract">
        <span class="inline-flex items-center gap-1.5">
          <Archive :size="14" />
          {{ status === 'extracting' ? '解压中' : '在线解压' }}
        </span>
      </BaseButton>
      <a :href="downloadUrl" target="_blank">
        <BaseButton variant="ghost" size="sm">
          <span class="inline-flex items-center gap-1.5">
            <Download :size="14" />
            下载
          </span>
        </BaseButton>
      </a>
    </div>

    <p v-if="!canExtract" class="max-w-[360px] text-center text-xs leading-relaxed text-(--color-text-muted)">
      当前支持 zip / tar / gz / bz2 在线解压。rar / 7z 请下载后使用本地工具处理。
    </p>
  </div>
</template>
