<script setup lang="ts">
/**
 * ExtractDialog —— 在线解压弹窗（选择性解压 + 异步任务模型）
 *
 * 流程：
 *   1. 打开先 GET /file/extract/entries 列出包内条目，用户勾选要解压的文件/目录
 *   2. POST /file/extract 创建任务（立即返回 taskId），后台线程池执行
 *   3. 每 800ms 轮询进度，完成展示结果列表；失败可按检查点重试
 *   4. 轮询超时（5 分钟）转为后台处理提示，文件最终仍会入库
 * 数据来源：api/file/extract.ts
 */
import { computed, onUnmounted, ref, watch } from 'vue'
import { LoaderCircle, CheckCircle2, FileArchive, Folder, File as FileIcon, X } from '@lucide/vue'
import extractService, { type ExtractedFile, type ExtractEntry } from '@/api/file/extract'
import { ElMessage } from '@/composables/useToast'

const props = defineProps({
  open: { type: Boolean, default: false },
  fileId: { type: String, default: '' },
  filename: { type: String, default: '' }
})
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'extracted', files: ExtractedFile[]): void }>()

type DialogStatus = 'selecting' | 'loadingEntries' | 'extracting' | 'done' | 'error' | 'timeout'
const status = ref<DialogStatus>('selecting')
const entries = ref<ExtractEntry[]>([])
const selectedPaths = ref<string[]>([])
const progress = ref(0)
const files = ref<ExtractedFile[]>([])
const currentTaskId = ref('')
const errorMsg = ref('')

const POLL_INTERVAL_MS = 800
const POLL_TIMEOUT_MS = 5 * 60 * 1000
let timer: ReturnType<typeof setInterval> | null = null
let pollStartedAt = 0

const allChecked = computed(
  () => entries.value.length > 0 && selectedPaths.value.length === entries.value.length
)
const selectedFileCount = computed(() => {
  const set = new Set(selectedPaths.value)
  return entries.value.filter((e) => !e.isDir && set.has(e.path)).length
})

function stopPolling(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

watch(
  () => props.open,
  (v) => {
    if (v && props.fileId) {
      loadEntries()
    } else {
      stopPolling()
      resetState()
    }
  }
)

onUnmounted(stopPolling)

function resetState(): void {
  status.value = 'selecting'
  entries.value = []
  selectedPaths.value = []
  progress.value = 0
  files.value = []
  currentTaskId.value = ''
  errorMsg.value = ''
  pollStartedAt = 0
}

function loadEntries(): void {
  stopPolling()
  resetState()
  if (!props.fileId) return
  status.value = 'loadingEntries'
  extractService.listEntries(
    props.fileId,
    (res) => {
      if (!props.open) return
      entries.value = res.data || []
      // 默认全选：与旧版“整包解压”行为一致，用户可取消不需要的条目
      selectedPaths.value = entries.value.map((e) => e.path)
      status.value = 'selecting'
    },
    (err) => {
      status.value = 'error'
      errorMsg.value = (err as { message?: string })?.message || '读取压缩包条目失败'
    }
  )
}

function isChecked(path: string): boolean {
  return selectedPaths.value.includes(path)
}

function toggleEntry(entry: ExtractEntry, checked: boolean): void {
  if (entry.isDir) {
    // 目录勾选等于勾选整棵子树；取消同理
    const affected = entries.value
      .filter((e) => e.path === entry.path || e.path.startsWith(entry.path + '/'))
      .map((e) => e.path)
    const next = new Set(selectedPaths.value)
    affected.forEach((p) => (checked ? next.add(p) : next.delete(p)))
    selectedPaths.value = Array.from(next)
    return
  }
  const next = new Set(selectedPaths.value)
  if (checked) next.add(entry.path)
  else next.delete(entry.path)
  selectedPaths.value = Array.from(next)
}

function toggleAll(checked: boolean): void {
  selectedPaths.value = checked ? entries.value.map((e) => e.path) : []
}

function startExtract(): void {
  if (selectedPaths.value.length === 0) {
    ElMessage.error('请至少选择一个要解压的条目')
    return
  }
  if (timer) stopPolling()
  status.value = 'extracting'
  progress.value = 0
  files.value = []
  currentTaskId.value = ''
  errorMsg.value = ''
  pollStartedAt = Date.now()

  // 全选时传 undefined，避免把几千条路径塞进请求体（后端按“整包”处理）
  const selected = allChecked.value ? undefined : selectedPaths.value
  extractService.extract(
    props.fileId,
    (res) => {
      const task = res.data
      if (!task || !task.taskId) {
        status.value = 'error'
        errorMsg.value = '创建解压任务失败'
        return
      }
      currentTaskId.value = task.taskId
      progress.value = task.progress || 0
      pollProgress(task.taskId)
    },
    (err) => {
      status.value = 'error'
      errorMsg.value = (err as { message?: string })?.message || '解压失败，文件可能已损坏或格式不支持'
      ElMessage.error(errorMsg.value)
    },
    undefined,
    selected
  )
}

function pollProgress(taskId: string): void {
  stopPolling()
  timer = setInterval(() => {
    if (Date.now() - pollStartedAt > POLL_TIMEOUT_MS) {
      stopPolling()
      status.value = 'timeout'
      ElMessage.warning('解压较慢，已转为后台处理，请稍后在文件列表中查看结果')
      return
    }

    extractService.progress(
      taskId,
      (res) => {
        if (!props.open) return
        const task = res.data
        if (!task) return
        progress.value = task.progress || 0
        if (task.status === 2) {
          stopPolling()
          files.value = task.result || []
          progress.value = 100
          status.value = 'done'
        } else if (task.status === 3) {
          stopPolling()
          status.value = 'error'
          errorMsg.value = task.errorMsg || '解压失败，请稍后重试'
          ElMessage.error(errorMsg.value)
        }
      },
      () => {
        // 单次网络异常不立即失败，交给超时保护
      }
    )
  }, POLL_INTERVAL_MS)
}

function close(): void {
  stopPolling()
  emit('update:open', false)
}

/** 失败后按后端检查点重试：已完成的 entry 不会重复上传 */
function retryExtract(): void {
  if (!currentTaskId.value) {
    loadEntries()
    return
  }
  if (timer) stopPolling()
  status.value = 'extracting'
  progress.value = 0
  errorMsg.value = ''
  pollStartedAt = Date.now()
  extractService.retry(
    currentTaskId.value,
    (res) => {
      const task = res.data
      if (!task || !task.taskId) {
        status.value = 'error'
        errorMsg.value = '重试失败'
        return
      }
      progress.value = task.progress || 0
      pollProgress(task.taskId)
    },
    (err) => {
      status.value = 'error'
      errorMsg.value = (err as { message?: string })?.message || '重试失败'
    }
  )
}

function finish(): void {
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
        <div class="w-[560px] max-w-[92vw] rounded-sm border border-(--color-border) bg-(--color-surface) shadow-xl">
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
                <p class="text-xs text-(--color-text-muted) truncate max-w-[320px]">{{ filename }}</p>
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
            <!-- 条目加载 -->
            <div v-if="status === 'loadingEntries'" class="flex flex-col items-center py-10">
              <LoaderCircle :size="32" class="animate-spin text-primary-500 mb-3" />
              <p class="text-sm text-(--color-text)">正在读取压缩包目录...</p>
            </div>

            <!-- 选择条目 -->
            <div v-else-if="status === 'selecting'">
              <div class="mb-3 flex items-center justify-between">
                <span class="text-xs text-(--color-text-muted)">
                  共 {{ entries.length }} 个条目，已选 {{ selectedFileCount }} 个文件
                </span>
                <label class="inline-flex items-center gap-1.5 text-xs text-(--color-text-muted) cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="allChecked"
                    @change="toggleAll(($event.target as HTMLInputElement).checked)"
                  />
                  全选
                </label>
              </div>
              <div class="max-h-[300px] overflow-y-auto rounded-sm border border-(--color-border)">
                <label
                  v-for="entry in entries"
                  :key="entry.path"
                  class="flex items-center gap-3 px-3 py-2 border-b border-(--color-border) last:border-b-0 hover:bg-(--color-surface-container-low) cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :checked="isChecked(entry.path)"
                    @change="toggleEntry(entry, ($event.target as HTMLInputElement).checked)"
                  />
                  <Folder v-if="entry.isDir" :size="16" class="text-(--color-text-muted) shrink-0" />
                  <FileIcon v-else :size="16" class="text-(--color-text-muted) shrink-0" />
                  <span class="text-sm text-(--color-text) truncate flex-1" :title="entry.path">
                    {{ entry.path }}
                  </span>
                  <span class="text-xs text-(--color-text-muted) tabular-nums shrink-0">
                    {{ entry.isDir ? '' : entry.sizeDesc }}
                  </span>
                </label>
              </div>
              <p v-if="entries.length === 0" class="py-8 text-center text-sm text-(--color-text-muted)">
                压缩包内没有可解压条目
              </p>
            </div>

            <!-- 解压中 -->
            <div v-else-if="status === 'extracting'" class="flex flex-col items-center py-8">
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
              <p class="text-sm text-red-500">{{ errorMsg || '解压失败，请稍后重试' }}</p>
              <button
                class="mt-4 px-4 py-1.5 rounded-sm text-sm text-white"
                style="background: var(--color-primary-500);"
                @click="retryExtract"
              >
                {{ currentTaskId ? '从断点重试' : '重新读取' }}
              </button>
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
          <div class="flex justify-end gap-2 px-5 py-4 border-t border-(--color-border)">
            <button
              class="px-4 py-1.5 rounded-sm text-sm text-(--color-text-muted) hover:bg-(--color-surface-container-low)"
              @click="close"
            >
              {{ status === 'done' ? '关闭' : '取消' }}
            </button>
            <button
              v-if="status === 'selecting'"
              class="px-4 py-1.5 rounded-sm text-sm text-white disabled:opacity-50"
              style="background: var(--color-primary-500);"
              :disabled="selectedPaths.length === 0"
              @click="startExtract"
            >
              开始解压
            </button>
            <button
              v-if="status === 'done'"
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
