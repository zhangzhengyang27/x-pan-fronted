<script setup lang="ts">
/**
 * EditMarkdown —— Markdown/文本在线编辑页
 * - 进入时申请编辑锁（同一文件同一时间仅允许一个用户编辑）
 * - Vditor 分屏编辑，Ctrl/Cmd+S 保存
 * - baseVersion 乐观锁：版本冲突时提示加载最新内容或下载本地修改
 * - 离开前拦截未保存修改，离开时释放编辑锁
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { ArrowLeft, Download, Save } from '@lucide/vue'
import fileService, { type IFileDetailVO } from '@/api/file'
import BaseButton from '@/components/base/BaseButton.vue'
import { useTheme } from '@/composables/useTheme'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import { decodeTextContent, invalidatePreviewUrl, resolvePreviewUrl } from '@/utils/preview'

const route = useRoute()
const router = useRouter()
const { isDark } = useTheme()

const fileId = computed(() => String(route.params.fileId || ''))
const filename = ref(String(route.query.filename || ''))
const version = ref(1)
const detail = ref<IFileDetailVO | null>(null)

const phase = ref<'loading' | 'ready' | 'locked' | 'unsupported' | 'error'>('loading')
const errorMessage = ref('')
const dirty = ref(false)
const saving = ref(false)

const containerRef = ref<HTMLElement | null>(null)
let vditor: InstanceType<typeof Vditor> | null = null
let savedContent = ''
let lockToken = ''
let heartbeatTimer: number | undefined
let resizeObserver: ResizeObserver | null = null

const isMarkdown = computed(() => {
  const name = filename.value.toLowerCase()
  return name.endsWith('.md') || name.endsWith('.markdown')
})

async function bootstrap() {
  phase.value = 'loading'
  errorMessage.value = ''
  try {
    // 1. 文件详情 + 权限校验
    const detailRes = await fileService.getDetail(fileId.value)
    detail.value = detailRes.data
    filename.value = detailRes.data.filename || filename.value
    version.value = detailRes.data.version || 1
    if (detailRes.data.editable === false) {
      phase.value = 'unsupported'
      errorMessage.value = '该文件类型暂不支持在线编辑'
      return
    }

    // 2. 申请编辑锁
    try {
      const session = await fileService.acquireEditSession(fileId.value)
      lockToken = session.data.lockToken
      version.value = session.data.version || version.value
      startHeartbeat()
    } catch (e) {
      const err = e as { code?: number; message?: string }
      if (err?.code === 423) {
        phase.value = 'locked'
        errorMessage.value = err.message || '文件正在被其他用户编辑'
        return
      }
      throw e
    }

    // 3. 加载文件内容并初始化编辑器
    const text = await fetchContent()
    await nextTick()
    initEditor(text)
    phase.value = 'ready'
  } catch (e) {
    const err = e as { code?: number; message?: string }
    phase.value = 'error'
    errorMessage.value = err?.message || '编辑器加载失败'
  }
}

async function fetchContent(): Promise<string> {
  const url = await resolvePreviewUrl(fileId.value)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`内容加载失败（HTTP ${res.status}）`)
  const buffer = await res.arrayBuffer()
  const declaredCharset = res.headers.get('content-type')?.match(/charset=([\w-]+)/i)?.[1]
  return decodeTextContent(buffer, declaredCharset)
}

function initEditor(text: string) {
  if (!containerRef.value) return
  savedContent = text
  dirty.value = false
  vditor = new Vditor(containerRef.value, {
    value: text,
    mode: 'sv',
    theme: isDark.value ? 'dark' : 'classic',
    icon: 'material',
    cache: { enable: false },
    counter: { enable: true, type: 'text' },
    toolbar: [
      'headings',
      'bold',
      'italic',
      'strike',
      'link',
      '|',
      'list',
      'ordered-list',
      'check',
      'quote',
      '|',
      'code',
      'inline-code',
      'table',
      'line',
      '|',
      'undo',
      'redo',
      'fullscreen'
    ],
    input: () => {
      dirty.value = (vditor?.getValue() ?? '') !== savedContent
    },
    after: () => {
      syncHeight()
      resizeObserver?.disconnect()
      resizeObserver = new ResizeObserver(() => syncHeight())
      if (containerRef.value) resizeObserver.observe(containerRef.value)
    }
  })
}

/** 将 Vditor 高度钉死为容器可视高度，避免长文档撑高页面 */
function syncHeight() {
  if (!containerRef.value) return
  const h = containerRef.value.clientHeight
  const vd = containerRef.value.querySelector('.vditor') as HTMLElement | null
  if (vd && h > 0) vd.style.height = h + 'px'
}

async function save() {
  if (saving.value || phase.value !== 'ready' || !vditor) return
  const content = vditor.getValue()
  saving.value = true
  try {
    const blob = new Blob([content], {
      type: isMarkdown.value ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
    })
    const res = await fileService.saveContent({
      fileId: fileId.value,
      baseVersion: version.value,
      file: blob,
      filename: filename.value
    })
    version.value = res.data.version
    savedContent = content
    dirty.value = false
    detail.value = detail.value
      ? { ...detail.value, version: res.data.version, sizeBytes: res.data.sizeBytes, contentHash: res.data.contentHash }
      : detail.value
    invalidatePreviewUrl(fileId.value)
    notifyFileChanged()
    ElMessage.success('已保存')
  } catch (e) {
    const err = e as { code?: number; message?: string }
    if (err?.code === 409) {
      await handleConflict()
    } else if (err?.code === 423) {
      phase.value = 'locked'
      errorMessage.value = err.message || '编辑锁已失效，请重新进入'
    } else {
      ElMessage.error(err?.message || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

/** 版本冲突：加载最新内容（丢弃本地修改）或下载本地版本 */
async function handleConflict() {
  const reload = await ElMessageBox.confirm(
    '文件已被其他端修改。加载最新内容会丢弃你当前的未保存修改，也可以先下载你的版本。',
    '保存冲突',
    {
      confirmButtonText: '加载最新内容',
      cancelButtonText: '下载我的版本',
      type: 'warning'
    }
  )
  if (reload) {
    try {
      const detailRes = await fileService.getDetail(fileId.value)
      version.value = detailRes.data.version || version.value
      const text = await fetchContent()
      vditor?.setValue(text)
      savedContent = text
      dirty.value = false
      ElMessage.success('已加载最新内容')
    } catch (e) {
      const err = e as { message?: string }
      ElMessage.error(err?.message || '加载最新内容失败')
    }
  } else {
    downloadLocal()
  }
}

function downloadLocal() {
  const content = vditor?.getValue() ?? ''
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.value || 'content.md'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** 通知其它标签页刷新文件列表（storage 事件只会在其它标签页触发） */
function notifyFileChanged() {
  try {
    localStorage.setItem(`xpan:file-changed:${fileId.value}`, String(Date.now()))
  } catch {
    /* 隐私模式下忽略 */
  }
}

/** 编辑锁心跳：同一用户重复申请会续期，同时换发新令牌 */
function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = window.setInterval(async () => {
    try {
      const session = await fileService.acquireEditSession(fileId.value)
      lockToken = session.data.lockToken
    } catch {
      /* 网络异常时等待下一次心跳，锁过期后保存仍受版本冲突保护 */
    }
  }, 5 * 60 * 1000)
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer)
    heartbeatTimer = undefined
  }
}

function releaseLock() {
  stopHeartbeat()
  if (!lockToken) return
  fileService.releaseEditSession(fileId.value, lockToken).catch(() => {
    /* 锁会在 TTL 后自动过期，释放失败不阻塞页面关闭 */
  })
  lockToken = ''
}

async function confirmLeave(): Promise<boolean> {
  if (!dirty.value) return true
  return ElMessageBox.confirm('当前修改尚未保存，确定离开吗？', '提示', {
    confirmButtonText: '离开',
    cancelButtonText: '继续编辑',
    type: 'warning'
  })
}

async function goBack() {
  if (!(await confirmLeave())) return
  if (window.opener) {
    window.close()
    return
  }
  if (window.history.length > 1) router.back()
  else router.push('/files')
}

function onKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    save()
  }
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = ''
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('beforeunload', onBeforeUnload)
  bootstrap()
})

onBeforeRouteLeave(async () => {
  const allowed = await confirmLeave()
  if (allowed) releaseLock()
  return allowed
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('beforeunload', onBeforeUnload)
  resizeObserver?.disconnect()
  resizeObserver = null
  releaseLock()
  if (vditor) {
    try {
      vditor.destroy()
    } catch {
      /* noop */
    }
    vditor = null
  }
})
</script>

<template>
  <div class="h-screen flex flex-col bg-(--color-bg)">
    <!-- 顶部工具栏 -->
    <header
      class="h-14 px-4 flex items-center justify-between gap-3 border-b border-(--color-border) bg-(--color-surface)"
    >
      <div class="flex items-center gap-2 min-w-0">
        <button
          type="button"
          class="size-8 rounded-sm flex items-center justify-center text-(--color-text-muted) hover:bg-(--color-surface-2) hover:text-(--color-text) transition-colors"
          title="返回"
          @click="goBack"
        >
          <ArrowLeft :size="18" />
        </button>
        <h1 class="text-base font-medium truncate">{{ filename || '在线编辑' }}</h1>
        <span
          class="shrink-0 rounded-full bg-(--color-surface-2) px-2 py-0.5 text-[11px] text-(--color-text-muted)"
        >
          v{{ version }}
        </span>
        <span v-if="dirty" class="shrink-0 text-[11px] text-amber-500">未保存</span>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <BaseButton variant="ghost" size="sm" :disabled="phase !== 'ready'" @click="downloadLocal">
          <span class="inline-flex items-center gap-1.5">
            <Download :size="14" />
            下载
          </span>
        </BaseButton>
        <BaseButton
          variant="primary"
          size="sm"
          :loading="saving"
          :disabled="phase !== 'ready' || !dirty"
          @click="save"
        >
          <span class="inline-flex items-center gap-1.5">
            <Save :size="14" />
            保存
            <kbd class="ml-1 rounded bg-white/20 px-1 text-[10px]">⌘S</kbd>
          </span>
        </BaseButton>
      </div>
    </header>

    <!-- 编辑区 -->
    <main class="flex-1 min-h-0 relative">
      <div ref="containerRef" class="h-full min-h-0 w-full overflow-hidden vditor-edit-host" />

      <div
        v-if="phase === 'loading'"
        class="absolute inset-0 flex items-center justify-center bg-(--color-bg)"
      >
        <div class="size-10 rounded-xl bg-(--color-surface-2) animate-pulse" />
      </div>

      <div
        v-else-if="phase === 'locked' || phase === 'unsupported' || phase === 'error'"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-(--color-bg) text-center px-6"
      >
        <p class="text-sm text-(--color-text-muted)">{{ errorMessage }}</p>
        <BaseButton v-if="phase === 'locked' || phase === 'error'" variant="secondary" size="sm" @click="bootstrap">
          重试
        </BaseButton>
        <BaseButton variant="ghost" size="sm" @click="goBack">返回</BaseButton>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* 编辑器占满内容区，长文档在 Vditor 内部滚动 */
.vditor-edit-host :deep(.vditor) {
  border: none;
  border-radius: 0;
}
.vditor-edit-host :deep(.vditor-sv) {
  font-size: 14px;
}
</style>
