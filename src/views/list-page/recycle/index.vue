<script setup lang="ts">
/**
 * RecycleListPage —— 回收站
 * 设计规范：G 设计风格
 * 顶部提示条 + 还原/彻底删除操作
 */
import { computed, onMounted, ref } from 'vue'
import {
  RefreshCw,
  Trash2,
  Folder,
  FileText,
  FileArchive,
  FileSpreadsheet,
  FileImage,
  FileAudio,
  FileVideo,
  FileCode,
  FileBarChart2,
  AlertTriangle,
  Clock,
  Eraser,
  Info
} from '@lucide/vue'
import recycleService from '@/api/recycle'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'

const RECYCLE_EXPIRE_DAYS = 30

const tableData = ref([])
const selected = ref([])
const tableLoading = ref(true)

const columns = [
  { key: 'filename', title: '文件名', width: 'auto' },
  { key: 'fileSizeDesc', title: '大小', width: 120, align: 'right' },
  { key: 'updateTime', title: '删除日期', width: 180, align: 'center' },
  { key: 'expireHint', title: '到期', width: 160, align: 'center' },
  { key: 'actions', title: '操作', width: 140, align: 'right' }
]

function fileIcon(type) {
  return (
    {
      0: Folder,
      2: FileArchive,
      3: FileSpreadsheet,
      4: FileText,
      7: FileImage,
      8: FileAudio,
      9: FileVideo,
      10: FileBarChart2,
      11: FileCode
    }[type] || FileText
  )
}

function loadTableData() {
  tableLoading.value = true
  recycleService.recycles(
    (res) => {
      tableLoading.value = false
      tableData.value = res.data || []
    },
    (res) => {
      tableLoading.value = false
      ElMessage.error(res.message)
    }
  )
}

/**
 * 计算剩余天数
 */
function expireInfo(row) {
  if (!row.updateTime) return { text: '—', urgent: false, expired: false }
  const update = new Date(row.updateTime).getTime()
  const expireAt = update + RECYCLE_EXPIRE_DAYS * 24 * 3600 * 1000
  const left = Math.ceil((expireAt - Date.now()) / (24 * 3600 * 1000))
  if (left < 0) return { text: '已过期', urgent: true, expired: true, left: 0 }
  if (left <= 7) return { text: `还剩 ${left} 天`, urgent: true, expired: false, left }
  return { text: `还剩 ${left} 天`, urgent: false, expired: false, left }
}

function cleanRecycle() {
  if (tableData.value.length === 0) return ElMessage.warning('回收站已经是空的')
  ElMessageBox.confirm(
    `将永久删除 ${tableData.value.length} 个文件/文件夹（${summary.value.totalSize}），此操作不可恢复！`,
    '清空回收站',
    {
      confirmButtonText: '确认清空',
      cancelButtonText: '取消',
      type: 'danger'
    }
  )
    .then(() => {
      doDelete(tableData.value.map((f) => f.fileId).join('__,__'))
    })
    .catch(() => {})
}

function cleanExpired() {
  const expired = tableData.value.filter((r) => expireInfo(r).expired)
  if (expired.length === 0) return ElMessage.warning('没有过期文件可清理')
  ElMessageBox.confirm(
    `将删除 ${expired.length} 个已过期文件，释放 ${summary.value.expiredSize} 空间`,
    '清理过期文件',
    {
      confirmButtonText: '确认清理',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(() => {
      doDelete(expired.map((f) => f.fileId).join('__,__'))
    })
    .catch(() => {})
}

/** 解析 fileSizeDesc 成字节 */
function parseSize(desc) {
  if (!desc) return 0
  const m = String(desc).match(/^([\d.]+)\s*(B|KB|MB|GB|TB)?$/i)
  if (!m) return 0
  const num = parseFloat(m[1])
  const unit = (m[2] || 'B').toUpperCase()
  const mul = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }[unit] || 1
  return num * mul
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`
}

function doDelete(fileIds) {
  recycleService.deleteRecycle(
    { fileIds },
    () => {
      ElMessage.success('删除成功')
      loadTableData()
    },
    (res) => ElMessage.error(res.message)
  )
}

function doRestore(fileIds) {
  recycleService.restoreRecycle(
    { fileIds },
    (res) => {
      ElMessage.success('文件还原成功')
      tableData.value = res.data || []
    },
    (res) => ElMessage.error(res.message)
  )
}

function restoreRecycle() {
  if (selected.value.length === 0) return ElMessage.error('请选择要还原的文件')
  const ids = selected.value.filter(Boolean).join('__,__')
  doRestore(ids)
}

const totalExpired = computed(() => tableData.value.filter((r) => expireInfo(r).expired).length)
const totalUrgent = computed(
  () => tableData.value.filter((r) => expireInfo(r).urgent && !expireInfo(r).expired).length
)

const summary = computed(() => {
  const rows = tableData.value
  let totalBytes = 0
  let expiredBytes = 0
  rows.forEach((r) => {
    const b = parseSize(r.fileSizeDesc)
    totalBytes += b
    if (expireInfo(r).expired) expiredBytes += b
  })
  return {
    count: rows.length,
    totalSize: formatSize(totalBytes),
    expiredSize: formatSize(expiredBytes)
  }
})

onMounted(loadTableData)
</script>

<template>
  <div class="flex flex-col gap-1">
    <!-- 页面标题 -->
    <div class="flex items-center gap-3 py-3">
      <h1 class="text-xl font-semibold tracking-tight text-[var(--color-text)]">回收站</h1>
      <span class="px-2 py-0.5 rounded-full text-xs font-mono" style="background-color: var(--color-surface-container-low); color: var(--color-text-muted);">
        {{ summary.count }} items
      </span>
    </div>

    <!-- 顶部提示条 -->
    <div class="rounded-lg p-3 flex items-center justify-between gap-3" style="background-color: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3);">
      <div class="flex items-center gap-2 text-sm">
        <Info :size="16" class="shrink-0" style="color: var(--color-warning);" />
        <span class="text-[var(--color-text)]">
          文件将在 <span class="font-medium tabular-nums">{{ RECYCLE_EXPIRE_DAYS }}</span> 天后自动清除
        </span>
      </div>
      <BaseButton variant="danger" size="sm" @click="cleanRecycle">
        <span class="flex items-center gap-1.5">
          <Trash2 :size="14" :stroke-width="2" />
          清空回收站
        </span>
      </BaseButton>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
      <div class="px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)]">
        <div class="text-xs" style="color: var(--color-text-muted);">回收站文件数</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text)]">{{ summary.count }}</div>
      </div>
      <div class="px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)]">
        <div class="text-xs" style="color: var(--color-text-muted);">占用空间</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text)]">{{ summary.totalSize }}</div>
      </div>
      <div class="px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)]">
        <div class="text-xs" style="color: var(--color-text-muted);">将释放空间（清理过期）</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums" style="color: var(--color-warning);">
          {{ summary.expiredSize }}
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="flex items-center justify-between py-3 flex-wrap gap-2">
      <div class="flex items-center gap-2 text-xs" style="color: var(--color-text-muted);">
        <Clock :size="14" :stroke-width="2" />
        回收站文件将在 {{ RECYCLE_EXPIRE_DAYS }} 天后被自动清理
        <span
          v-if="totalUrgent > 0"
          class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded"
          style="background-color: rgba(245, 158, 11, 0.2); color: var(--color-warning);"
        >
          <AlertTriangle :size="12" :stroke-width="2" />
          {{ totalUrgent }} 个即将过期
        </span>
        <span
          v-if="totalExpired > 0"
          class="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded"
          style="background-color: rgba(239, 68, 68, 0.2); color: var(--color-danger);"
        >
          {{ totalExpired }} 个已过期
        </span>
      </div>
      <div class="flex items-center gap-2">
        <BaseTooltip v-if="totalExpired > 0" text="清理所有已过期文件" position="top">
          <BaseButton variant="warning" @click="cleanExpired">
            <span class="flex items-center gap-1.5">
              <Eraser :size="14" :stroke-width="2" />
              清理过期
            </span>
          </BaseButton>
        </BaseTooltip>
        <BaseButton variant="primary" :disabled="selected.length === 0" @click="restoreRecycle">
          <span class="flex items-center gap-1.5">
            <RefreshCw :size="14" :stroke-width="2" />
            还原
          </span>
        </BaseButton>
      </div>
    </div>

    <BaseTable
      :columns="columns"
      :data="tableData"
      :loading="tableLoading"
      :selected="selected"
      selectable
      row-key="fileId"
      empty-text="回收站是空的"
      @update:selected="(v) => (selected = v)"
    >
      <template #cell-filename="{ row }">
        <div class="flex items-center gap-3">
          <component
            :is="fileIcon(row.fileType)"
            :size="20"
            :stroke-width="2"
            class="shrink-0"
            style="color: var(--color-text-muted);"
          />
          <span class="truncate text-[var(--color-text)]">{{ row.filename }}</span>
        </div>
      </template>
      <template #cell-expireHint="{ row }">
        <span
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
          :style="
            expireInfo(row).expired
              ? 'background-color: rgba(239, 68, 68, 0.2); color: var(--color-danger);'
              : expireInfo(row).urgent
                ? 'background-color: rgba(245, 158, 11, 0.2); color: var(--color-warning);'
                : 'background-color: rgba(0, 112, 243, 0.2); color: var(--color-primary-500);'
          "
        >
          <AlertTriangle v-if="expireInfo(row).urgent" :size="12" :stroke-width="2" />
          {{ expireInfo(row).text }}
        </span>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <BaseTooltip text="还原" position="top">
            <BaseButton variant="primary" size="sm" @click="doRestore(row.fileId)">
              <RefreshCw :size="14" :stroke-width="2" />
            </BaseButton>
          </BaseTooltip>
          <BaseTooltip text="彻底删除" position="top">
            <BaseButton variant="danger" size="sm" @click="doDelete(row.fileId)">
              <Trash2 :size="14" :stroke-width="2" />
            </BaseButton>
          </BaseTooltip>
        </div>
      </template>
    </BaseTable>
  </div>
</template>
