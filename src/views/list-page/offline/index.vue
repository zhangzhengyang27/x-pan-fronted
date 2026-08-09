<script setup lang="ts">
/**
 * OfflineListPage —— 离线下载（P1.16 + P4：WebSocket 实时推送）
 *
 * P4 改造：
 * - 删除 3s 轮询
 * - 订阅 WebSocket OFFLINE_TASK_UPDATE / OFFLINE_TASK_REMOVED 消息
 * - 仅当 WS 断开时降级为 5s 轮询
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { Download, Link as LinkIcon, Plus, Trash2, X, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from '@lucide/vue'
import offlineService from '@/api/offline'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import { useWebSocket } from '@/composables/useWebSocket'
import { getToken } from '@/utils/cookie'
import type { IOfflineTaskVO } from '@/types'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'

const tasks = ref<IOfflineTaskVO[]>([])
const newUrl = ref('')
const customName = ref('')
const loading = ref(false)
const dialogOpen = ref(false)

/** 状态枚举：0=待开始 1=下载中 2=已完成 3=失败 4=已取消 */
type TaskStatus = 0 | 1 | 2 | 3 | 4

function taskKey(t: IOfflineTaskVO): string {
  return String(t.id ?? (t as unknown as { taskId?: string }).taskId ?? '')
}

function loadTasks(): void {
  loading.value = true
  offlineService.list(
    {},
    (res) => {
      loading.value = false
      if (res.code === 0) tasks.value = (res.data || []) as IOfflineTaskVO[]
    },
    () => {
      loading.value = false
    },
  )
}

function doCreate(): void {
  if (!newUrl.value.trim()) {
    ElMessage.warning('请输入下载链接')
    return
  }
  offlineService.create(
    { url: newUrl.value.trim(), targetFolderId: undefined },
    (res) => {
      if (res.code === 0) {
        ElMessage.success('任务已创建')
        newUrl.value = ''
        customName.value = ''
        dialogOpen.value = false
        // 服务端会立即推送 OFFLINE_TASK_UPDATE，无需手动 loadTasks
      } else ElMessage.error(res.message || '创建失败')
    },
    (err) => ElMessage.error((err as { message?: string })?.message || '创建失败'),
  )
}

function doCancel(task: IOfflineTaskVO): void {
  ElMessageBox.confirm('确定取消该下载任务？已下载的部分会被丢弃。', '取消下载', {
    confirmButtonText: '确认取消',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    offlineService.cancel(
      taskKey(task),
      (res) => {
        if (res.code === 0) ElMessage.success('已取消')
      },
      () => ElMessage.error('取消失败'),
    )
  }).catch(() => {})
}

function doDelete(task: IOfflineTaskVO): void {
  ElMessageBox.confirm('删除该任务记录？已下载的文件不会被删除。', '删除任务', {
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    offlineService.delete(
      taskKey(task),
      (res) => {
        if (res.code === 0) ElMessage.success('已删除')
      },
      () => ElMessage.error('删除失败'),
    )
  }).catch(() => {})
}

function statusMeta(s: number | null | undefined) {
  return {
    0: { label: '待开始', icon: Loader2, variant: 'neutral', spin: false },
    1: { label: '下载中', icon: Loader2, variant: 'primary', spin: true },
    2: { label: '已完成', icon: CheckCircle2, variant: 'success', spin: false },
    3: { label: '失败', icon: AlertCircle, variant: 'danger', spin: false },
    4: { label: '已取消', icon: X, variant: 'warning', spin: false },
  }[s as TaskStatus] || { label: '未知', icon: Loader2, variant: 'neutral', spin: false }
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`
}

// ─── P4：WebSocket 实时推送（替代轮询） ──────────────────────────────────
const ws = useWebSocket()
let fallbackTimer: number | null = null

function applyUpdate(payload: IOfflineTaskVO): void {
  const incomingKey = taskKey(payload)
  const idx = tasks.value.findIndex((t) => taskKey(t) === incomingKey)
  if (idx >= 0) {
    tasks.value.splice(idx, 1, { ...tasks.value[idx], ...payload })
  } else {
    tasks.value.unshift(payload)
  }
}

function applyRemoved(payload: { taskId: string }): void {
  tasks.value = tasks.value.filter((t) => taskKey(t) !== payload.taskId)
}

function startFallbackPolling(): void {
  // WS 断开时降级：最多每 5s 拉一次
  if (fallbackTimer !== null) return
  fallbackTimer = window.setInterval(() => {
    if (tasks.value.some((t) => t.status === 1 || t.status === 0)) {
      loadTasks()
    }
  }, 5000)
}

function stopFallbackPolling(): void {
  if (fallbackTimer !== null) {
    clearInterval(fallbackTimer)
    fallbackTimer = null
  }
}

const offUpdate = ws.on<IOfflineTaskVO>('OFFLINE_TASK_UPDATE', applyUpdate)
const offRemoved = ws.on<{ taskId: string }>('OFFLINE_TASK_REMOVED', applyRemoved)

onMounted(() => {
  loadTasks()
  // 确保 WS 已连（main.js 也会触发，这里兜底）
  const token = getToken()
  if (token && !ws.isConnected.value) ws.connect(token)
  // WS 断开时降级轮询
  watchFallback()
})

let fallbackWatchHandle: ReturnType<typeof setInterval> | null = null
function watchFallback(): void {
  fallbackWatchHandle = setInterval(() => {
    if (ws.isConnected.value) {
      stopFallbackPolling()
    } else {
      startFallbackPolling()
    }
  }, 1000)
}

onUnmounted(() => {
  offUpdate()
  offRemoved()
  stopFallbackPolling()
  if (fallbackWatchHandle !== null) clearInterval(fallbackWatchHandle)
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 头部 + 统计 -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-base font-semibold flex items-center gap-2">
          <Download :size="18" class="text-[var(--color-primary-600)]"/>
          离线下载
        </h2>
        <p class="text-xs text-[var(--color-text-muted)] mt-0.5">提交下载链接，后台拉取到我的网盘</p>
      </div>
      <div class="flex items-center gap-2">
        <BaseButton variant="ghost" @click="loadTasks">
          <RefreshCw :size="14"/>
        </BaseButton>
        <BaseButton variant="primary" @click="dialogOpen = true">
          <span class="inline-flex items-center gap-1.5"><Plus :size="14"/>新建任务</span>
        </BaseButton>
      </div>
    </div>

    <!-- 任务列表 -->
    <div v-if="loading && tasks.length === 0" class="py-16 text-center text-sm text-[var(--color-text-muted)]">加载中...</div>
    <div v-else-if="tasks.length === 0" class="py-16 text-center">
      <div class="size-16 mx-auto rounded-2xl bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-text-muted)] mb-3">
        <Download :size="28"/>
      </div>
      <p class="text-sm text-[var(--color-text-muted)]">还没有离线下载任务</p>
      <p class="text-xs text-[var(--color-text-muted)] mt-1">点击"新建任务"提交一个 HTTP/HTTPS 链接</p>
    </div>
    <div v-else class="space-y-2">
      <div
        v-for="t in tasks"
        :key="t.taskId"
        class="group flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] transition-colors"
      >
        <component
          :is="statusMeta(t.status).icon"
          :size="18"
          :class="[
            statusMeta(t.status).variant === 'success' ? 'text-[var(--color-success)]'
            : statusMeta(t.status).variant === 'danger' ? 'text-[var(--color-danger)]'
            : statusMeta(t.status).variant === 'warning' ? 'text-[var(--color-warning)]'
            : statusMeta(t.status).variant === 'primary' ? 'text-[var(--color-primary-600)]'
            : 'text-[var(--color-text-muted)]',
            statusMeta(t.status).spin && 'animate-spin'
          ]"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium text-sm truncate">{{ t.filename || '未命名' }}</span>
            <BaseBadge :variant="statusMeta(t.status).variant" size="sm">{{ statusMeta(t.status).label }}</BaseBadge>
          </div>
          <div class="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <LinkIcon :size="11"/>
            <span class="truncate font-mono">{{ t.url }}</span>
          </div>
          <div class="mt-1 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            <span v-if="t.totalSize">{{ formatSize(t.totalSize) }}</span>
            <span v-if="t.progress != null && t.status === 1">进度 {{ t.progress }}%</span>
            <span v-if="t.errorMsg" class="text-[var(--color-danger)]">{{ t.errorMsg }}</span>
            <span>{{ t.createTime }}</span>
          </div>
          <!-- 进度条 -->
          <div v-if="t.status === 1 && t.progress != null" class="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
            <div class="h-full bg-[var(--color-primary-500)] transition-all" :style="{width: t.progress + '%'}"/>
          </div>
        </div>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <BaseButton v-if="t.status === 0 || t.status === 1" variant="ghost" size="sm" @click="doCancel(t)" title="取消">
            <X :size="14"/>
          </BaseButton>
          <BaseButton variant="ghost" size="sm" @click="doDelete(t)" title="删除">
            <Trash2 :size="14"/>
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- 新建任务弹窗 -->
    <BaseModal v-model:open="dialogOpen" title="新建离线下载" size="md">
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">下载链接 *</label>
          <BaseInput v-model="newUrl" placeholder="https://example.com/file.zip"/>
          <p class="mt-1 text-[11px] text-[var(--color-text-muted)]">支持 HTTP / HTTPS 直链。磁力/BT 需要额外配置 aria2。</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">文件名（可选）</label>
          <BaseInput v-model="customName" placeholder="留空则从 HTTP 头推断"/>
        </div>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="dialogOpen = false">取消</BaseButton>
        <BaseButton variant="primary" @click="doCreate">提交下载</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>