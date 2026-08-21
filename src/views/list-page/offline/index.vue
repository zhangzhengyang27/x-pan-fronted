<script setup lang="ts">
/**
 * OfflineListPage —— 离线下载
 * 设计规范：G 设计风格
 * 状态图标 + WS 实时推送
 */
import { onMounted, onUnmounted, ref } from 'vue'
import {
  Download,
  Link as LinkIcon,
  Plus,
  Trash2,
  X,
  RefreshCw,
  CircleCheck,
  AlertCircle,
  LoaderCircle,
  Clock,
  Play,
  Pause
} from '@lucide/vue'
import offlineService from '@/api/offline'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import { useWebSocket } from '@/composables/useWebSocket'
import { getToken } from '@/utils/cookie'
import type { IOfflineTaskVO } from '@/types'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseProgress from '@/components/base/BaseProgress.vue'

const tasks = ref<IOfflineTaskVO[]>([])
const newUrl = ref('')
const customName = ref('')
const loading = ref(false)
const dialogOpen = ref(false)

/** 状态枚举：0=待开始 1=下载中 2=已完成 3=失败 4=已取消 */
type TaskStatus = 0 | 1 | 2 | 3 | 4

function taskKey(t: IOfflineTaskVO): string {
  return String(t.taskId)
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
    }
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
        ElMessage.success('已添加到下载队列')
        newUrl.value = ''
        customName.value = ''
        dialogOpen.value = false
      } else ElMessage.error(res.message || '创建失败')
    },
    (err) => ElMessage.error((err as { message?: string })?.message || '创建失败')
  )
}

function doCancel(task: IOfflineTaskVO): void {
  ElMessageBox.confirm('确定取消该下载任务？已下载的部分会被丢弃。', '取消下载', {
    confirmButtonText: '确认取消',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      offlineService.cancel(
        taskKey(task),
        (res) => {
          if (res.code === 0) ElMessage.success('已取消')
        },
        () => ElMessage.error('取消失败')
      )
    })
    .catch(() => {})
}

function doDelete(task: IOfflineTaskVO): void {
  ElMessageBox.confirm('删除该任务记录？已下载的文件不会被删除。', '删除任务', {
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      offlineService.delete(
        taskKey(task),
        (res) => {
          if (res.code === 0) {
            ElMessage.success('已删除')
            // 删除后重新拉取列表，避免残留已删除任务（与 recycle 列表同样问题）
            loadTasks()
          }
        },
        () => ElMessage.error('删除失败')
      )
    })
    .catch(() => {})
}

function statusMeta(s: number | null | undefined) {
  return (
    {
      0: { label: '排队中', icon: Clock, variant: 'neutral', spin: false },
      1: { label: '下载中', icon: Download, variant: 'primary', spin: false },
      2: { label: '已完成', icon: CircleCheck, variant: 'success', spin: false },
      3: { label: '失败', icon: AlertCircle, variant: 'danger', spin: false },
      4: { label: '已取消', icon: X, variant: 'warning', spin: false }
    }[s as TaskStatus] || { label: '未知', icon: LoaderCircle, variant: 'neutral', spin: false }
  )
}

function statusColor(s: number | null | undefined) {
  const meta = statusMeta(s)
  if (meta.variant === 'success') return 'varsuccess'
  if (meta.variant === 'danger') return 'vardanger'
  if (meta.variant === 'warning') return 'varwarning'
  if (meta.variant === 'primary') return 'var(--color-primary-500)'
  return 'var(--color-text-muted)'
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

// WebSocket 实时推送
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
  const token = getToken()
  if (token && !ws.isConnected.value) ws.connect(token)
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
    <!-- 页面标题 -->
    <div class="flex items-center justify-between py-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-semibold tracking-tight text-(--color-text)">离线下载</h1>
        <span class="px-2 py-0.5 rounded-full text-xs font-mono" style="background-color: var(--color-surface-container-low); color: var(--color-text-muted);">
          {{ tasks.length }} tasks
        </span>
      </div>
      <div class="flex items-center gap-2">
        <BaseButton variant="ghost" @click="loadTasks">
          <RefreshCw :size="14" :stroke-width="2" />
        </BaseButton>
        <BaseButton variant="primary" @click="dialogOpen = true">
          <span class="inline-flex items-center gap-1.5">
            <Plus :size="14" :stroke-width="2" />
            新建任务
          </span>
        </BaseButton>
      </div>
    </div>

    <!-- 任务列表 -->
    <div
      v-if="loading && tasks.length === 0"
      class="py-16 text-center text-sm"
      style="color: var(--color-text-muted);"
    >
      加载中...
    </div>
    <div v-else-if="tasks.length === 0" class="py-16 text-center">
      <div class="size-16 mx-auto rounded-2xl flex items-center justify-center mb-3" style="background-color: var(--color-surface-container-low); color: var(--color-text-muted);">
        <Download :size="28" :stroke-width="1.5" />
      </div>
      <p class="text-sm" style="color: var(--color-text-muted);">暂无离线下载任务</p>
      <p class="text-xs mt-1" style="color: var(--color-text-muted);">
        点击"新建任务"提交一个 HTTP/HTTPS 链接
      </p>
    </div>
    <div v-else class="space-y-2">
      <div
        v-for="t in tasks"
        :key="t.taskId"
        class="group flex items-center gap-4 px-4 py-3 rounded-xl border border-(--color-border) bg-(--color-surface) hover:bg-(--color-surface-container-low) transition-colors"
      >
        <!-- 状态图标 -->
        <component
          :is="statusMeta(t.status).icon"
          :size="20"
          :stroke-width="2"
          :class="statusMeta(t.status).spin && 'animate-spin'"
          :style="{ color: statusColor(t.status) }"
        />
        
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-medium text-sm truncate text-(--color-text)">{{ t.filename || '未命名' }}</span>
            <BaseBadge :variant="statusMeta(t.status).variant as any" size="sm">
              {{ statusMeta(t.status).label }}
            </BaseBadge>
          </div>
          <div class="flex items-center gap-2 text-xs" style="color: var(--color-text-muted);">
            <LinkIcon :size="11" :stroke-width="2" />
            <span class="truncate font-mono">{{ t.url }}</span>
          </div>
          <div class="flex items-center gap-3 text-xs mt-1" style="color: var(--color-text-muted);">
            <span v-if="t.totalSize">{{ formatSize(t.totalSize) }}</span>
            <span v-if="t.progress != null && t.status === 1" class="tabular-nums">
              进度 {{ t.progress }}%
            </span>
            <span v-if="t.errorMsg" style="color: vardanger;">{{ t.errorMsg }}</span>
            <span>{{ t.createTime }}</span>
          </div>
          
          <!-- 进度条 -->
          <div
            v-if="t.status === 1 && t.progress != null"
            class="mt-2"
          >
            <BaseProgress
              :value="t.progress"
              size="sm"
              :showText="false"
            />
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div class="flex items-center gap-1 shrink-0">
          <BaseButton
            v-if="t.status === 0 || t.status === 1"
            variant="ghost"
            size="sm"
            @click="doCancel(t)"
            title="取消"
          >
            <X :size="14" :stroke-width="2" />
          </BaseButton>
          <BaseButton variant="ghost" size="sm" @click="doDelete(t)" title="删除">
            <Trash2 :size="14" :stroke-width="2" />
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- 新建任务弹窗 -->
    <BaseModal v-model:open="dialogOpen" title="新建离线下载" size="md">
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium mb-1.5" style="color: var(--color-text-muted);"
            >下载链接 *</label
          >
          <BaseInput v-model="newUrl" placeholder="https://example.com/file.zip" />
          <p class="mt-1 text-[11px]" style="color: var(--color-text-muted);">
            支持 HTTP / HTTPS 直链。磁力/BT 需要额外配置 aria2。
          </p>
        </div>
        <div>
          <label class="block text-xs font-medium mb-1.5" style="color: var(--color-text-muted);"
            >文件名（可选）</label
          >
          <BaseInput v-model="customName" placeholder="留空则从 HTTP 头推断" />
        </div>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="dialogOpen = false">取消</BaseButton>
        <BaseButton variant="primary" @click="doCreate">提交下载</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
