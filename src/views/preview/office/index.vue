<script setup lang="ts">
/**
 * PreviewOffice —— Office 文档预览（对接后端 P4 转 PDF 异步任务）
 *
 * 流程：
 * 1. 调用 POST /preview/office/{fileId} 创建转 PDF 任务
 * 2. 轮询 GET /preview/url/{taskId} 直到 status=2，拿到受保护的 PDF 预览地址
 * 3. 用 PdfPreviewer 展示 PDF（体验更佳、跨端一致）
 * 4. 若后端转 PDF 失败（status=3）或未启用 LibreOffice，降级用 @vue-office 直接渲染原文件
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Download, LoaderCircle, AlertTriangle, Edit3 } from '@lucide/vue'
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
import panUtil from '@/utils/common'
import { ElMessage } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const fileId = computed(() => String(route.params.fileId || ''))
const filename = computed(() => String(route.query.filename || 'office'))
const ext = computed(() => getFileExtension(filename.value))

/** 支持 OnlyOffice 在线编辑的扩展名 */
const EDITABLE_EXTS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
const canEdit = computed(() => EDITABLE_EXTS.includes(ext.value))

/** 新标签页打开 OnlyOffice 编辑器 */
function openEditor() {
  const { href } = router.resolve({
    name: 'EditOffice',
    params: { fileId: fileId.value },
    query: { filename: filename.value }
  })
  window.open(href, '_blank', 'noopener,noreferrer')
}

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
const pdfUrl = ref('') // 转 PDF 后的可访问地址（后端相对端点或对象存储直链）
const convertFailed = ref(false)
const errorMsg = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null
// 轮询超时保护（对齐 ExtractDialog 的 5 分钟模式）：超时停止轮询，降级为原文件预览
const POLL_TIMEOUT_MS = 5 * 60 * 1000
let pollStartedAt = 0

// 同一路由组件内快速切换 fileId 时，旧任务的创建/轮询回调仍可能在途。
// 所有异步回调必须对代次，否则会把上一份文档的 taskId/pdfUrl 写到新页面。
let requestSeq = 0

function clearPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function startConvert(seq: number) {
  if (!fileId.value) return
  clearPoll()
  converting.value = true
  convertFailed.value = false
  errorMsg.value = ''
  pollStartedAt = Date.now()

  previewService.office(
    String(fileId.value),
    (res) => {
      if (seq !== requestSeq) return
      const task = res.data
      if (!task || !task.taskId) {
        // 无 taskId → 直接降级原文件
        converting.value = false
        convertFailed.value = true
        return
      }
      // 立即轮询一次，再定时轮询
      pollUrl(task.taskId, seq)
      pollTimer = setInterval(() => pollUrl(task.taskId, seq), 1500)
    },
    (err) => {
      if (seq !== requestSeq) return
      converting.value = false
      convertFailed.value = true
      errorMsg.value = err?.message || '创建预览任务失败'
    }
  )
}

function pollUrl(taskId: string, seq: number) {
  if (seq !== requestSeq) return
  // 超过总上限仍未出结果：停止轮询并提示，降级原文件预览（后台转换任务继续跑）
  if (Date.now() - pollStartedAt > POLL_TIMEOUT_MS) {
    clearPoll()
    converting.value = false
    convertFailed.value = true
    errorMsg.value = '文档转换耗时较长，已停止等待'
    ElMessage.warning('转换耗时较长，已降级为原文件预览')
    return
  }
  previewService.url(
    taskId,
    (res) => {
      if (seq !== requestSeq) return
      const vo = res.data
      if (vo && vo.status === 2 && vo.previewUrl) {
        // 后端返回受登录态保护的相对端点（/preview/result/...）；MinIO 预签名直链
        // 是绝对地址，原样使用。不能把绝对地址再拼 /api。
        pdfUrl.value = vo.previewUrl.startsWith('/')
          ? panUtil.getUrlPrefix() + vo.previewUrl
          : vo.previewUrl
        converting.value = false
        clearPoll()
      } else if (vo && vo.status === 3) {
        // 转换失败 → 降级原文件
        converting.value = false
        convertFailed.value = true
        clearPoll()
      } else if (vo && vo.status === 2) {
        // 任务标完成但没有产物地址：继续轮询只会空转到 5 分钟超时，直接降级。
        converting.value = false
        convertFailed.value = true
        errorMsg.value = '预览产物缺失，请重新打开或下载原文件'
        clearPoll()
      }
      // status 0/1 → 继续轮询
    },
    () => {
      if (seq !== requestSeq) return
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
    // 切文件先推进代次并清掉旧定时器；在途请求即使晚到也会被回调里的 seq 拦下。
    const seq = ++requestSeq
    clearPoll()
    pdfUrl.value = ''
    convertFailed.value = false
    converting.value = false
    rawPreviewUrl.value = ''
    if (id) {
      resolvePreviewUrl(id)
        .then((u) => {
          if (seq === requestSeq) rawPreviewUrl.value = u
        })
        .catch(() => {})
      startConvert(seq)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  requestSeq++
  clearPoll()
})
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden bg-(--color-bg)">
    <header
      class="h-14 px-6 flex items-center justify-between border-b border-(--color-border) bg-(--color-surface)"
    >
      <div class="flex items-center gap-2 min-w-0">
        <h1 class="text-base font-medium truncate">{{ filename }}</h1>
        <span class="text-xs text-(--color-text-muted) uppercase">.{{ ext }}</span>
      </div>
      <div class="flex items-center gap-2">
        <BaseButton v-if="canEdit" variant="primary" size="sm" @click="openEditor">
          <span class="inline-flex items-center gap-1.5">
            <Edit3 :size="14" />
            在线编辑
          </span>
        </BaseButton>
        <a :href="downloadUrl" target="_blank">
          <BaseButton variant="secondary" size="sm">
            <span class="inline-flex items-center gap-1.5">
              <Download :size="14" />
              下载
            </span>
          </BaseButton>
        </a>
      </div>
    </header>
    <main class="flex-1 min-h-0 overflow-hidden">
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
        <div v-if="errorMsg" class="flex items-center gap-2 px-4 py-2 text-xs text-(--color-warning-text) bg-(--color-warning-bg) border-b border-(--color-border)">
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
