<script setup lang="ts">
/**
 * EditOffice —— Office 文档在线编辑页（OnlyOffice DocumentServer）
 * - 进入时创建编辑会话（含编辑锁），加载 DocumentServer 的 api.js
 * - 编辑/保存由 DocumentServer 负责，保存结果通过服务端回调写入文件底座
 * - 关闭时释放编辑锁，并轮询会话状态确认保存结果（含旧格式扩展名转换）
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Loader2 } from '@lucide/vue'
import fileService from '@/api/file'
import BaseButton from '@/components/base/BaseButton.vue'
import { ElMessage } from '@/composables/useToast'

interface OfficeDocEditor {
  destroyEditor: () => void
}

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (placeholderId: string, config: Record<string, unknown>) => OfficeDocEditor
    }
  }
}

const route = useRoute()
const router = useRouter()

const fileId = computed(() => String(route.params.fileId || ''))
const filename = ref(String(route.query.filename || ''))
const version = ref(1)
const sessionId = ref('')

const phase = ref<'loading' | 'ready' | 'locked' | 'unsupported' | 'error'>('loading')
const errorMessage = ref('')
const saving = ref(false)

const hostRef = ref<HTMLElement | null>(null)
let editor: OfficeDocEditor | null = null
let closed = false
let loadedScriptUrl = ''
let heartbeatTimer: number | undefined

async function bootstrap() {
  phase.value = 'loading'
  errorMessage.value = ''
  try {
    const res = await fileService.createOfficeSession(fileId.value)
    const data = res.data
    filename.value = data.filename || filename.value
    version.value = data.version || 1
    sessionId.value = data.sessionId
    if (!data.config || !data.documentServerUrl) {
      throw new Error('OnlyOffice 配置缺失')
    }
    await loadDocApi(data.documentServerUrl)
    await nextTick()
    if (!hostRef.value) throw new Error('编辑器容器未就绪')
    const config: Record<string, unknown> = {
      ...data.config,
      events: {
        onDocumentReady: () => {
          phase.value = 'ready'
        },
        onRequestClose: () => {
          // 用户在 DocumentServer 头部点击关闭：走保存确认流程
          void handleRequestClose()
        },
        onError: (event: { data?: { errorCode?: number; errorDescription?: string } }) => {
          const desc = event?.data?.errorDescription || '文档编辑器发生错误'
          ElMessage.error(desc)
        }
      }
    }
    editor = new window.DocsAPI!.DocEditor('office-editor-host', config)
    startHeartbeat()
    // 兜底：部分部署下 onDocumentReady 可能延迟，避免一直停留在骨架屏
    window.setTimeout(() => {
      if (phase.value === 'loading') phase.value = 'ready'
    }, 8000)
  } catch (e) {
    const err = e as { code?: number; message?: string }
    if (err?.code === 423) {
      phase.value = 'locked'
      errorMessage.value = err.message || '文件正在被其他用户编辑'
      return
    }
    phase.value = 'error'
    errorMessage.value = err?.message || '文档编辑器加载失败'
  }
}

/** 动态加载 DocumentServer 的 api.js（同一页面只加载一次） */
function loadDocApi(serverUrl: string): Promise<void> {
  const src = `${serverUrl.replace(/\/+$/, '')}/web-apps/apps/api/documents/api.js`
  if (window.DocsAPI) return Promise.resolve()
  if (src === loadedScriptUrl) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-xpan-onlyoffice="1"]`) as HTMLScriptElement | null
      if (!existing) {
        loadedScriptUrl = ''
        // 竞态兜底：脚本节点已移除则重走加载，本次 Promise 交给新加载流程
        void loadDocApi(serverUrl)
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('OnlyOffice api.js 加载失败')), { once: true })
    })
  }
  loadedScriptUrl = src
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.xpanOnlyoffice = '1'
    script.onload = () => resolve()
    script.onerror = () => {
      loadedScriptUrl = ''
      script.remove()
      reject(new Error('OnlyOffice api.js 加载失败，请检查 DocumentServer 是否可访问'))
    }
    document.head.appendChild(script)
  })
}

/** DocumentServer 请求关闭编辑器：释放锁并等待保存回调落库 */
async function handleRequestClose() {
  if (closed) return
  closed = true
  stopHeartbeat()
  saving.value = true
  try {
    await fileService.closeOfficeSession(sessionId.value)
  } catch {
    /* 锁会在 TTL 后自动过期，关闭失败不阻塞退出 */
  }
  await waitForSave()
  saving.value = false
  leavePage()
}

/** 轮询保存状态：DocumentServer 的保存回调可能稍晚于关闭动作 */
async function waitForSave() {
  if (!sessionId.value) return
  for (let i = 0; i < 24; i++) {
    try {
      const res = await fileService.getOfficeSessionStatus(sessionId.value)
      const state = res.data
      if (state.status === 'expired') return
      if (state.status === 'saved' && (state.savedAt || 0) > 0) {
        if (state.renamed && state.filename) {
          ElMessage.success(`文档已保存，并转换为 ${state.filename}`)
        } else {
          ElMessage.success('文档已保存')
        }
        if (state.version) version.value = state.version
        if (state.filename) filename.value = state.filename
        return
      }
    } catch {
      /* 网络抖动时继续轮询 */
    }
    await new Promise((resolve) => window.setTimeout(resolve, 500))
  }
  ElMessage.info('文档已关闭，若有修改请稍后刷新文件列表确认')
}

/** 通知其它标签页刷新文件列表（storage 事件只会在其它标签页触发） */
function notifyFileChanged() {
  try {
    localStorage.setItem(`xpan:file-changed:${fileId.value}`, String(Date.now()))
  } catch {
    /* 隐私模式下忽略 */
  }
}

function leavePage() {
  notifyFileChanged()
  if (window.opener) {
    window.close()
    return
  }
  if (window.history.length > 1) router.back()
  else router.push('/files')
}

/** 编辑锁心跳：同一用户重复申请会续期，避免长时间编辑时锁过期 */
function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = window.setInterval(() => {
    fileService.acquireEditSession(fileId.value).catch(() => {
      /* 网络异常时等待下一次心跳，锁过期后保存仍受服务端版本保护 */
    })
  }, 5 * 60 * 1000)
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer)
    heartbeatTimer = undefined
  }
}

async function goBack() {
  if (!closed) {
    await handleRequestClose()
    return
  }
  leavePage()
}

onMounted(bootstrap)

onBeforeRouteLeave(() => {
  if (!closed && sessionId.value) {
    fileService.closeOfficeSession(sessionId.value).catch(() => {
      /* 忽略 */
    })
  }
  return true
})

onBeforeUnmount(() => {
  stopHeartbeat()
  if (editor) {
    try {
      editor.destroyEditor()
    } catch {
      /* noop */
    }
    editor = null
  }
  if (!closed && sessionId.value) {
    fileService.closeOfficeSession(sessionId.value).catch(() => {
      /* 忽略 */
    })
  }
})
</script>

<template>
  <div class="h-screen flex flex-col bg-(--color-bg)">
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
        <h1 class="text-base font-medium truncate">{{ filename || 'Office 在线编辑' }}</h1>
        <span
          class="shrink-0 rounded-full bg-(--color-surface-2) px-2 py-0.5 text-[11px] text-(--color-text-muted)"
        >
          v{{ version }}
        </span>
      </div>
    </header>

    <main class="flex-1 min-h-0 relative">
      <div id="office-editor-host" ref="hostRef" class="h-full w-full" />

      <div
        v-if="phase === 'loading'"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-(--color-bg)"
      >
        <Loader2 :size="28" class="animate-spin text-(--color-text-muted)" />
        <p class="text-sm text-(--color-text-muted)">正在启动文档编辑器…</p>
      </div>

      <div
        v-else-if="phase === 'locked' || phase === 'unsupported' || phase === 'error'"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-(--color-bg) text-center px-6"
      >
        <p class="text-sm text-(--color-text-muted)">{{ errorMessage }}</p>
        <BaseButton v-if="phase === 'locked' || phase === 'error'" variant="secondary" size="sm" @click="bootstrap">
          重试
        </BaseButton>
        <BaseButton variant="ghost" size="sm" @click="leavePage">返回</BaseButton>
      </div>

      <div
        v-if="saving"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/40 text-white"
      >
        <Loader2 :size="28" class="animate-spin" />
        <p class="text-sm">正在保存文档…</p>
      </div>
    </main>
  </div>
</template>
