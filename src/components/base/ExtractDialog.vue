<script setup lang="ts">
/**
 * ExtractDialog —— 在线解压弹窗（P3-3 UI 骨架 + Mock）
 *
 * 流程：点击解压 → 进度动画 → 显示解压后文件列表 → 可"全部转存"或"关闭"
 * 数据来源：api/file/extract.ts（当前 Mock，后端就绪后自动生效）
 */
import { ref, watch } from 'vue'
import { LoaderCircle, CheckCircle2, FileArchive, Folder, File as FileIcon, X } from '@lucide/vue'
import extractService, { type ExtractedFile } from '@/api/file/extract'
import { ElMessage } from '@/composables/useToast'

const props = defineProps({
  open: { type: Boolean, default: false },
  fileId: { type: String, default: '' },
  filename: { type: String, default: '' }
})
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'extracted', files: ExtractedFile[]): void }>()

const status = ref<'idle' | 'extracting' | 'done' | 'error'>('idle')
const progress = ref(0)
const files = ref<ExtractedFile[]>([])

watch(
  () => props.open,
  (v) => {
    if (v && props.fileId) {
      startExtract()
    } else {
      status.value = 'idle'
      progress.value = 0
      files.value = []
    }
  }
)

function startExtract() {
  status.value = 'extracting'
  progress.value = 0
  // Mock 进度动画
  const timer = setInterval(() => {
    progress.value = Math.min(progress.value + Math.random() * 25, 95)
  }, 200)

  extractService.extract(
    props.fileId,
    (res) => {
      clearInterval(timer)
      progress.value = 100
      files.value = res.data || []
      status.value = 'done'
    },
    () => {
      clearInterval(timer)
      status.value = 'error'
      ElMessage.error('解压失败')
    }
  )
}

function close() {
  emit('update:open', false)
}

function saveAll() {
  // Mock：后端就绪后调用 transfer 接口转存到当前目录
  ElMessage.success(`已转存 ${files.value.length} 个文件到当前目录`)
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
        <div class="w-[520px] max-w-[90vw] rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
          <!-- 头部 -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <div class="flex items-center gap-3">
              <div
                class="size-9 rounded-sm flex items-center justify-center"
                style="background: rgba(0, 178, 255, 0.1);"
              >
                <FileArchive :size="18" class="text-[var(--color-primary-500)]" />
              </div>
              <div>
                <h3 class="text-sm font-medium text-[var(--color-text)]">在线解压</h3>
                <p class="text-xs text-[var(--color-text-muted)] truncate max-w-[300px]">{{ filename }}</p>
              </div>
            </div>
            <button
              class="p-1.5 rounded-sm hover:bg-[var(--color-surface-container-low)] text-[var(--color-text-muted)]"
              @click="close"
            >
              <X :size="16" />
            </button>
          </div>

          <!-- 内容区 -->
          <div class="px-5 py-5">
            <!-- 解压中 -->
            <div v-if="status === 'extracting'" class="flex flex-col items-center py-8">
              <LoaderCircle :size="40" class="animate-spin text-[var(--color-primary-500)] mb-4" />
              <p class="text-sm text-[var(--color-text)] mb-2">正在解压...</p>
              <div class="w-full max-w-[300px] h-2 rounded-full bg-[var(--color-surface-container-low)] overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-200"
                  style="background: var(--color-primary-500); width: {{ progress }}%;"
                />
              </div>
              <p class="text-xs text-[var(--color-text-muted)] mt-2 tabular-nums">{{ Math.round(progress) }}%</p>
            </div>

            <!-- 解压完成 -->
            <div v-else-if="status === 'done'">
              <div class="flex items-center gap-2 mb-4">
                <CheckCircle2 :size="16" class="text-green-500" />
                <span class="text-sm text-[var(--color-text)]">解压完成，共 {{ files.length }} 个文件</span>
              </div>
              <div class="max-h-[280px] overflow-y-auto rounded-sm border border-[var(--color-border)]">
                <div
                  v-for="(f, i) in files"
                  :key="i"
                  class="flex items-center gap-3 px-3 py-2 border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-container-low)]"
                >
                  <component :is="fileTypeIcon(f)" :size="16" class="text-[var(--color-text-muted)] shrink-0" />
                  <span class="text-sm text-[var(--color-text)] truncate flex-1">{{ f.filename }}</span>
                  <span class="text-xs text-[var(--color-text-muted)] tabular-nums shrink-0">{{ f.fileSizeDesc }}</span>
                </div>
              </div>
            </div>

            <!-- 解压失败 -->
            <div v-else-if="status === 'error'" class="flex flex-col items-center py-8">
              <p class="text-sm text-red-500">解压失败，请稍后重试</p>
            </div>
          </div>

          <!-- 底部操作 -->
          <div v-if="status === 'done'" class="flex justify-end gap-2 px-5 py-4 border-t border-[var(--color-border)]">
            <button
              class="px-4 py-1.5 rounded-sm text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-container-low)]"
              @click="close"
            >
              关闭
            </button>
            <button
              class="px-4 py-1.5 rounded-sm text-sm text-white"
              style="background: var(--color-primary-500);"
              @click="saveAll"
            >
              全部转存到当前目录
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
