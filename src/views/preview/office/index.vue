<script setup lang="ts">
/**
 * PreviewOffice —— Office 文档预览（对接后端 P4 转 PDF 异步任务）
 *
 * 流程：
 * 1. 调用 POST /preview/office/{fileId} 创建转 PDF 任务
 * 2. 轮询 GET /preview/url/{taskId} 直到 status=2，拿到预签名 PDF 直链
 * 3. 用 PdfPreviewer 展示 PDF（体验更佳、跨端一致）
 * 4. 若后端转 PDF 失败（status=3）或未启用 LibreOffice，降级用 @vue-office 直接渲染原文件
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Download, LoaderCircle, AlertTriangle } from '@lucide/vue'
import {
  getDownloadUrl,
  getFileExtension,
  resolvePreviewUrl,
  DOCX_EXTENSIONS,
  EXCEL_EXTENSIONS,
  PPTX_EXTENSIONS
} from '@/utils/preview'
import BaseButton from '@/components/base/BaseButton.vue'
import OfficePreviewer from '@/components/preview/office-previewer.vue'
import PdfPreviewer from '@/components/preview/pdf-previewer.vue'
import previewService from '@/api/preview'
import { ElMessage } from '@/composables/useToast'

const route = useRoute()
const fileId = computed(() => String(route.params.fileId || ''))
const filename = computed(() => String(route.query.filename || 'office'))
const ext = computed(() => getFileExtension(filename.value))

const kind = computed(() => {
  const e = ext.value
  if (DOCX_EXTENSIONS.includes(e)) return 'docx'
  if (EXCEL_EXTENSIONS.includes(e)) return 'excel'
  if (PPTX_EXTENSIONS.includes(e)) return 'pptx'
  return null
})

const downloadUrl = computed(() => getDownloadUrl(fileId.value))

// 降级用原文件签名 URL（@vue-office）
const rawPreviewUrl = ref('')

// P4 转 PDF 状态
const converting = ref(false) // 正在转换/轮询
const pdfUrl = ref('') // 转 PDF 后的预签名直链
const convertFailed = ref(false)
const errorMsg = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

function clearPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function startConvert() {
  if (!fileId.value) return
  clearPoll()
  converting.value = true
  convertFailed.value = false
  errorMsg.value = ''

  previewService.office(
    String(fileId.value),
    (res) => {
      const task = res.data
      if (!task || !task.taskId) {
        // 无 taskId → 直接降级原文件
        converting.value = false
        convertFailed.value = true
        return
      }
      // 立即轮询一次，再定时轮询
      pollUrl(task.taskId)
      pollTimer = setInterval(() => pollUrl(task.taskId), 1500)
    },
    (err) => {
      converting.value = false
      convertFailed.value = true
      errorMsg.value = err?.message || '创建预览任务失败'
    }
  )
}

function pollUrl(taskId: string) {
  previewService.url(
    taskId,
    (res) => {
      const vo = res.data
      if (vo && vo.status === 2 && vo.previewUrl) {
        pdfUrl.value = vo.previewUrl
        converting.value = false
        clearPoll()
      } else if (vo && vo.status === 3) {
        // 转换失败 → 降级原文件
        converting.value = false
        convertFailed.value = true
        clearPoll()
      }
      // status 0/1 → 继续轮询
    },
    () => {
      // 轮询失败：停止轮询，降级原文件
      converting.value = false
      convertFailed.value = true
      clearPoll()
    }
  )
}

watch(
  fileId,
  (id) => {
    pdfUrl.value = ''
    convertFailed.value = false
    converting.value = false
    rawPreviewUrl.value = ''
    if (id) {
      resolvePreviewUrl(id).then((u) => (rawPreviewUrl.value = u)).catch(() => {})
      startConvert()
    }
  },
  { immediate: true }
)

onBeforeUnmount(clearPoll)
</script>

<template>
  <div class="min-h-screen flex flex-col bg-(--color-bg)">
    <header
      class="h-14 px-6 flex items-center justify-between border-b border-(--color-border) bg-(--color-surface)"
    >
      <div class="flex items-center gap-2 min-w-0">
        <h1 class="text-base font-medium truncate">{{ filename }}</h1>
        <span class="text-xs text-(--color-text-muted) uppercase">.{{ ext }}</span>
      </div>
      <a :href="downloadUrl" target="_blank">
        <BaseButton variant="secondary" size="sm">
          <span class="inline-flex items-center gap-1.5">
            <Download :size="14" />
            下载
          </span>
        </BaseButton>
      </a>
    </header>
    <main class="flex-1 min-h-0">
      <!-- 转换中 -->
      <div
        v-if="converting"
        class="flex h-full flex-col items-center justify-center gap-3 text-(--color-text-muted)"
      >
        <LoaderCircle :size="32" class="animate-spin text-primary-500" />
        <p class="text-sm">正在转换文档为 PDF，请稍候...</p>
      </div>

      <!-- 转 PDF 成功 -->
      <PdfPreviewer v-else-if="pdfUrl" :url="pdfUrl" :file-id="fileId" />

      <!-- 转 PDF 失败 → 降级原文件 -->
      <div v-else-if="convertFailed" class="h-full flex flex-col">
        <div v-if="errorMsg" class="flex items-center gap-2 px-4 py-2 text-xs text-amber-600 bg-amber-500/10 border-b border-amber-500/20">
          <AlertTriangle :size="14" />
          <span>文档转 PDF 失败，已降级为在线原文件预览：{{ errorMsg }}</span>
        </div>
        <div class="flex-1 min-h-0">
          <OfficePreviewer v-if="kind" :url="rawPreviewUrl || undefined" :file-id="fileId" :kind="kind" />
          <div v-else class="flex h-full items-center justify-center text-sm text-(--color-text-muted)">
            无文件扩展名或不支持的 Office 类型
          </div>
        </div>
      </div>

      <!-- 兜底 -->
      <div v-else class="flex h-full items-center justify-center text-sm text-(--color-text-muted)">
        <template v-if="kind">文档预览初始化中...</template>
        <template v-else>无文件扩展名或不支持的 Office 类型</template>
      </div>
    </main>
  </div>
</template>
