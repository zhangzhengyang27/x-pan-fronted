<script setup lang="ts">
/**
 * ExtractDialog —— 在线解压弹窗（异步任务模型）
 *
 * 流程：
 *   1. 打开即调用 POST /file/extract 创建解压任务，立即拿到 taskId（后端同步校验后返回，不阻塞）
 *   2. 后台线程池执行解压入库（解压出的文件直接入库到目标父目录）
 *   3. 前端每 800ms 轮询 GET /file/extract/progress?taskId=xxx，展示真实进度百分比
 *   4. status=2 完成 → 展示结果列表，点击"完成"关闭并刷新列表
 *   5. status=3 失败 → 提示 errorMsg
 *   6. 轮询超时（5 分钟）→ 转为后台处理提示，文件最终仍会入库
 * 数据来源：api/file/extract.ts
 */
import { ref, watch, onUnmounted } from 'vue'
import { LoaderCircle, CheckCircle2, FileArchive, Folder, File as FileIcon, X } from '@lucide/vue'
import extractService, { type ExtractedFile } from '@/api/file/extract'
import { ElMessage } from '@/composables/useToast'

const props = defineProps({
  open: { type: Boolean, default: false },
  fileId: { type: String, default: '' },
  filename: { type: String, default: '' }
})
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'extracted', files: ExtractedFile[]): void }>()

const status = ref<'idle' | 'extracting' | 'done' | 'error' | 'timeout'>('idle')
const progress = ref(0)
const files = ref<ExtractedFile[]>([])

// 轮询相关
const POLL_INTERVAL_MS = 800
// 轮询超时保护：超过该时长仍未结束，则停止轮询并提示用户稍后查看（后台任务继续跑，文件最终会入库）
const POLL_TIMEOUT_MS = 5 * 60 * 1000

let timer: ReturnType<typeof setInterval> | null = null
let pollStartedAt = 0

function stopPolling() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

watch(
  () => props.open,
  (v) => {
    if (v && props.fileId) {
      startExtract()
    } else {
      // 关闭弹窗：停止轮询（后台任务可能仍在跑，但已入库，不影响）
      stopPolling()
      status.value = 'idle'
      progress.value = 0
      files.value = []
      pollStartedAt = 0
    }
  }
)

onUnmounted(stopPolling)

function startExtract() {
  if (timer) stopPolling()
  status.value = 'extracting'
  progress.value = 0
  files.value = []
  pollStartedAt = Date.now()

  // 1. 创建解压任务（HTTP 立即返回 taskId）
  extractService.extract(
    props.fileId,
    (res) => {
      const task = res.data
      if (!task || !task.taskId) {
        status.value = 'error'
        return
      }
      // 先展示一个初始进度
      progress.value = task.progress || 0
      pollProgress(task.taskId)
    },
    () => {
      status.value = 'error'
      ElMessage.error('解压失败，文件可能已损坏或格式不支持')
    }
    // targetParentId 当前由后端默认解压到当前目录，如需指定可传入
  )
}

// 2. 轮询进度
function pollProgress(taskId: string) {
  stopPolling()
  timer = setInterval(() => {
    // 轮询超时保护：避免极端情况下永久轮询
    if (Date.now() - pollStartedAt > POLL_TIMEOUT_MS) {
      stopPolling()
      status.value = 'timeout'
      ElMessage.warning('解压较慢，已转为后台处理，请稍后在文件列表中查看结果')
      return
    }

    extractService.progress(
      taskId,
      (res) => {
        // 弹窗已关闭/重开：丢弃过期响应，避免上一次任务结果闪现
        if (!props.open) return
        const task = res.data
        if (!task) return
        progress.value = task.progress || 0
        // 2 完成
        if (task.status === 2) {
          stopPolling()
          files.value = task.result || []
          progress.value = 100
          status.value = 'done'
        }
        // 3 失败
        else if (task.status === 3) {
          stopPolling()
          status.value = 'error'
          ElMessage.error(task.errorMsg || '解压失败，请稍后重试')
        }
        // 0/1 继续轮询
      },
      () => {
        // 网络异常不立即失败，等待下次轮询；连续失败由超时保护处理
      }
    )
  }, POLL_INTERVAL_MS)
}

function close() {
  stopPolling()
  emit('update:open', false)
}

// 后端异步解压，完成时 POST /file/extract/progress 已返回 result；
// 这里提示并关闭，由外层 refresh 刷新列表即可。
function finish() {
  if (files.value.length > 0) {
    ElMessage.success(`已解压 ${files.value.length} 个文件到当前目录`)
  }
  emit('extracted', files.value)
  close()
}

function fileTypeIcon(f: ExtractedFile) {
  return f.isDir ? Folder : FileIcon
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="close"
      >
        <div class="w-[520px] max-w-[90vw] rounded-sm border border-(--color-border) bg-(--color-surface) shadow-xl">
          <!-- 头部 -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-(--color-border)">
            <div class="flex items-center gap-3">
              <div
                class="size-9 rounded-sm flex items-center justify-center"
                style="background: rgba(0, 178, 255, 0.1);"
              >
                <FileArchive :size="18" class="text-primary-500" />
              </div>
              <div>
                <h3 class="text-sm font-medium text-(--color-text)">在线解压</h3>
                <p class="text-xs text-(--color-text-muted) truncate max-w-[300px]">{{ filename }}</p>
              </div>
            </div>
            <button
              class="p-1.5 rounded-sm hover:bg-(--color-surface-container-low) text-(--color-text-muted)"
              @click="close"
            >
              <X :size="16" />
            </button>
          </div>

          <!-- 内容区 -->
          <div class="px-5 py-5">
            <!-- 解压中 -->
            <div v-if="status === 'extracting'" class="flex flex-col items-center py-8">
              <LoaderCircle :size="40" class="animate-spin text-primary-500 mb-4" />
              <p class="text-sm text-(--color-text) mb-2">正在解压...</p>
              <div class="w-full max-w-[300px] h-2 rounded-full bg-(--color-surface-container-low) overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-200"
                  :style="{ background: 'var(--color-primary-500)', width: progress + '%' }"
                />
              </div>
              <p class="text-xs text-(--color-text-muted) mt-2 tabular-nums">{{ Math.round(progress) }}%</p>
            </div>

            <!-- 解压完成 -->
            <div v-else-if="status === 'done'">
              <div class="flex items-center gap-2 mb-4">
                <CheckCircle2 :size="16" class="text-green-500" />
                <span class="text-sm text-(--color-text)">解压完成，共 {{ files.length }} 个文件</span>
              </div>
              <div class="max-h-[280px] overflow-y-auto rounded-sm border border-(--color-border)">
                <div
                  v-for="(f, i) in files"
                  :key="i"
                  class="flex items-center gap-3 px-3 py-2 border-b border-(--color-border) last:border-b-0 hover:bg-(--color-surface-container-low)"
                >
                  <component :is="fileTypeIcon(f)" :size="16" class="text-(--color-text-muted) shrink-0" />
                  <span class="text-sm text-(--color-text) truncate flex-1">{{ f.filename }}</span>
                  <span class="text-xs text-(--color-text-muted) tabular-nums shrink-0">{{ f.fileSizeDesc }}</span>
                </div>
              </div>
            </div>

            <!-- 解压失败 -->
            <div v-else-if="status === 'error'" class="flex flex-col items-center py-8">
              <p class="text-sm text-red-500">解压失败，请稍后重试</p>
            </div>

            <!-- 轮询超时（后台仍在处理） -->
            <div v-else-if="status === 'timeout'" class="flex flex-col items-center py-8">
              <p class="text-sm text-(--color-text) mb-1">解压较慢，已转为后台处理</p>
              <p class="text-xs text-(--color-text-muted)">解压完成后文件会自动入库，请稍后在文件列表中查看结果</p>
              <button
                class="mt-4 px-4 py-1.5 rounded-sm text-sm text-white"
                style="background: var(--color-primary-500);"
                @click="close"
              >
                我知道了
              </button>
            </div>
          </div>

          <!-- 底部操作 -->
          <div v-if="status === 'done'" class="flex justify-end gap-2 px-5 py-4 border-t border-(--color-border)">
            <button
              class="px-4 py-1.5 rounded-sm text-sm text-(--color-text-muted) hover:bg-(--color-surface-container-low)"
              @click="close"
            >
              关闭
            </button>
            <button
              class="px-4 py-1.5 rounded-sm text-sm text-white"
              style="background: var(--color-primary-500);"
              @click="finish"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
