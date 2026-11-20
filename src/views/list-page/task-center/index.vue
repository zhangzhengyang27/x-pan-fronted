/*
 * TaskCenterPage —— 统一任务中心（P1-2）
 *
 * 设计：后端把三类任务归一成同一状态/进度口径，页面只做筛选与展示；
 * 离线任务保留取消/重试入口，解压失败保留断点重试入口，预览只读。
 */
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertCircle,
  Archive,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  Download,
  FileText,
  LoaderCircle,
  RefreshCw,
  X
} from '@lucide/vue'
import taskCenterService from '@/api/task-center'
import offlineService from '@/api/offline'
import extractService from '@/api/file/extract'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import type { ITaskCenterItem, OfflineTaskStatusCode, TaskCenterType } from '@/types'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseProgress from '@/components/base/BaseProgress.vue'

const router = useRouter()

const tasks = ref<ITaskCenterItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const activeTab = ref<'all' | TaskCenterType>('all')
const statusFilter = ref<OfflineTaskStatusCode | undefined>(undefined)

type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

const tabs: Array<{ key: 'all' | TaskCenterType; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'offline', label: '离线下载' },
  { key: 'extract', label: '解压' },
  { key: 'preview', label: '预览转换' }
]

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const hasActive = computed(() =>
  tasks.value.some((t) => t.status === 0 || t.status === 1)
)

const typeMeta: Record<TaskCenterType, { label: string; icon: typeof Download }> = {
  offline: { label: '离线', icon: Download },
  extract: { label: '解压', icon: Archive },
  preview: { label: '预览', icon: FileText }
}

function load(targetPage = page.value): void {
  loading.value = true
  taskCenterService.list(
    {
      types: activeTab.value === 'all' ? undefined : activeTab.value,
      status: statusFilter.value,
      page: targetPage,
      pageSize
    },
    (res) => {
      loading.value = false
      if (res.code !== 0) return
      const data = res.data
      tasks.value = data.records || []
      total.value = data.total || 0
      page.value = targetPage
      ensurePolling()
    },
    () => {
      loading.value = false
    }
  )
}

function switchTab(key: 'all' | TaskCenterType): void {
  if (activeTab.value === key) return
  activeTab.value = key
  load(1)
}

function switchStatus(value: string): void {
  statusFilter.value = value === 'all' ? undefined : (Number(value) as OfflineTaskStatusCode)
  load(1)
}

function goPage(target: number): void {
  if (target < 1 || target > totalPages.value || target === page.value) return
  load(target)
}

function statusMeta(t: ITaskCenterItem): {
  label: string
  variant: BadgeVariant
  icon: typeof Download
  color: string
} {
  if (t.status === 2) {
    return { label: '已完成', variant: 'success', icon: CircleCheck, color: 'var(--color-success)' }
  }
  if (t.status === 3) {
    return { label: '失败', variant: 'danger', icon: AlertCircle, color: 'var(--color-danger)' }
  }
  if (t.status === 4) {
    return { label: '已取消', variant: 'warning', icon: X, color: 'var(--color-warning)' }
  }
  if (t.status === 1) {
    const label = t.taskType === 'extract' ? '解压中' : t.taskType === 'preview' ? '转换中' : '下载中'
    return { label, variant: 'primary', icon: LoaderCircle, color: 'var(--color-primary-500)' }
  }
  const label = t.taskType === 'extract' ? '待开始' : t.taskType === 'preview' ? '待处理' : '排队中'
  return { label, variant: 'neutral', icon: Clock, color: 'var(--color-text-muted)' }
}

function progressStatus(t: ITaskCenterItem): string {
  if (t.status === 2) return 'success'
  if (t.status === 3) return 'danger'
  if (t.status === 4) return 'warning'
  return 'primary'
}

function taskId(t: ITaskCenterItem): string {
  return String(t.taskId)
}

function formatTime(value?: string): string {
  return value || '—'
}

function doCancel(t: ITaskCenterItem): void {
  ElMessageBox.confirm('确定取消该离线下载任务？已下载部分会保留，之后可重试继续。', '取消下载', {
    confirmButtonText: '确认取消',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then((ok) => {
      if (!ok) return
      taskCenterService.cancelOffline(
        taskId(t),
        (res) => {
          if (res.code === 0) {
            ElMessage.success('已取消')
            load()
          } else ElMessage.error(res.message || '取消失败')
        },
        () => ElMessage.error('取消失败')
      )
    })
    .catch(() => {})
}

function doRetryOffline(t: ITaskCenterItem): void {
  offlineService.retry(
    taskId(t),
    (res) => {
      if (res.code === 0) {
        ElMessage.success('已重新排队，将从已下载部分继续')
        load()
      } else ElMessage.error(res.message || '重试失败')
    },
    () => ElMessage.error('重试失败')
  )
}

function doRetryExtract(t: ITaskCenterItem): void {
  extractService.retry(
    taskId(t),
    (res) => {
      if (res.code === 0) {
        ElMessage.success('已从检查点继续解压')
        load()
      } else ElMessage.error(res.message || '重试失败')
    },
    () => ElMessage.error('重试失败')
  )
}

let pollTimer: number | null = null
function ensurePolling(): void {
  if (hasActive.value && pollTimer === null) {
    pollTimer = window.setInterval(() => load(), 5000)
  } else if (!hasActive.value && pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(() => load(1))
onUnmounted(() => {
  if (pollTimer !== null) clearInterval(pollTimer)
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between py-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-semibold tracking-tight text-(--color-text)">任务中心</h1>
        <span
          class="px-2 py-0.5 rounded-full text-xs font-mono"
          style="background-color: var(--color-surface-container-low); color: var(--color-text-muted);"
        >
          {{ total }} tasks
        </span>
      </div>
      <div class="flex items-center gap-2">
        <BaseButton variant="ghost" aria-label="刷新任务列表" title="刷新任务列表" @click="load()">
          <RefreshCw :size="14" :stroke-width="2" />
        </BaseButton>
        <BaseButton variant="primary" @click="router.push('/offline')">
          <span class="inline-flex items-center gap-1.5">
            <Download :size="14" :stroke-width="2" />
            新建离线任务
          </span>
        </BaseButton>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <BaseButton
        v-for="tab in tabs"
        :key="tab.key"
        :variant="activeTab === tab.key ? 'primary' : 'ghost'"
        size="sm"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
      </BaseButton>
      <div class="flex-1" />
      <label class="text-xs" style="color: var(--color-text-muted);">状态</label>
      <select
        aria-label="按任务状态筛选"
        class="h-8 px-2 rounded-sm border border-(--color-border) bg-(--color-surface) text-xs"
        :value="statusFilter ?? 'all'"
        @change="switchStatus(($event.target as HTMLSelectElement).value)"
      >
        <option value="all">全部</option>
        <option value="0">待开始</option>
        <option value="1">进行中</option>
        <option value="2">已完成</option>
        <option value="3">失败</option>
        <option value="4">已取消</option>
      </select>
    </div>

    <div v-if="loading && tasks.length === 0" class="py-16 text-center text-sm" style="color: var(--color-text-muted);">
      加载中...
    </div>
    <div v-else-if="tasks.length === 0" class="py-16 text-center">
      <div
        class="size-16 mx-auto rounded-2xl flex items-center justify-center mb-3"
        style="background-color: var(--color-surface-container-low); color: var(--color-text-muted);"
      >
        <Clock :size="28" :stroke-width="1.5" />
      </div>
      <p class="text-sm" style="color: var(--color-text-muted);">暂无任务</p>
      <p class="text-xs mt-1" style="color: var(--color-text-muted);">
        离线下载、解压和预览转换任务会汇总到这里
      </p>
    </div>
    <div v-else class="space-y-2">
      <div
        v-for="task in tasks"
        :key="`${task.taskType}-${task.taskId}`"
        class="flex items-center gap-4 px-4 py-3 rounded-xl border border-(--color-border) bg-(--color-surface) hover:bg-(--color-surface-container-low) transition-colors"
      >
        <component
          :is="typeMeta[task.taskType].icon"
          :size="20"
          :stroke-width="2"
          :style="{ color: statusMeta(task).color }"
        />
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <span class="font-medium text-sm truncate text-(--color-text)">{{ task.taskName || '未命名任务' }}</span>
            <BaseBadge variant="neutral" size="sm">{{ typeMeta[task.taskType].label }}</BaseBadge>
            <BaseBadge :variant="statusMeta(task).variant" size="sm">{{ statusMeta(task).label }}</BaseBadge>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-xs" style="color: var(--color-text-muted);">
            <span>{{ task.createTime }}</span>
            <span v-if="task.progress != null" class="tabular-nums">{{ task.progress }}%</span>
            <span v-if="task.errorMsg" class="truncate" style="color: var(--color-danger);">{{ task.errorMsg }}</span>
          </div>
          <div v-if="task.progress != null" class="mt-2 max-w-md">
            <BaseProgress :value="task.progress" :status="progressStatus(task)" size="sm" :showText="false" />
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <BaseButton
            v-if="task.taskType === 'offline' && (task.status === 0 || task.status === 1)"
            variant="ghost"
            size="sm"
            title="取消"
            @click="doCancel(task)"
          >
            <X :size="14" :stroke-width="2" />
          </BaseButton>
          <BaseButton
            v-if="task.taskType === 'offline' && (task.status === 3 || task.status === 4)"
            variant="ghost"
            size="sm"
            title="重试（断点续传）"
            @click="doRetryOffline(task)"
          >
            <RefreshCw :size="14" :stroke-width="2" />
          </BaseButton>
          <BaseButton
            v-if="task.taskType === 'extract' && task.status === 3"
            variant="ghost"
            size="sm"
            title="从检查点重试"
            @click="doRetryExtract(task)"
          >
            <RefreshCw :size="14" :stroke-width="2" />
          </BaseButton>
        </div>
      </div>
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-end gap-2 pt-2">
      <BaseButton variant="ghost" size="sm" :disabled="page <= 1" @click="goPage(page - 1)">
        <ChevronLeft :size="14" :stroke-width="2" />
      </BaseButton>
      <span class="text-xs tabular-nums" style="color: var(--color-text-muted);">
        {{ page }} / {{ totalPages }}
      </span>
      <BaseButton variant="ghost" size="sm" :disabled="page >= totalPages" @click="goPage(page + 1)">
        <ChevronRight :size="14" :stroke-width="2" />
      </BaseButton>
    </div>
  </div>
</template>
