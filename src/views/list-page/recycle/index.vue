<script setup lang="ts">
/**
 * RecycleListPage —— 回收站（P1-6 增强）
 * - 关键词搜索（本地模糊匹配，文件名 includes）
 * - 时间范围筛选（全部 / 最近7天 / 最近30天 / 即将过期 / 已过期）
 * - 批量还原（已有）+ 基于筛选结果的批量操作
 */
import { computed, onMounted, ref, watch } from 'vue'
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
  Info,
  Search as SearchIcon,
  Filter
} from '@lucide/vue'
import recycleService from '@/api/recycle'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import BaseInput from '@/components/base/BaseInput.vue'

const RECYCLE_EXPIRE_DAYS = 30

const tableData = ref([])
const selected = ref([])
const tableLoading = ref(true)

// P1-6：筛选状态
const searchKeyword = ref('')
const timeFilter = ref<'all' | '7d' | '30d' | 'expiring' | 'expired'>('all')

const timeFilterOptions = [
  { value: 'all', label: '全部时间' },
  { value: '7d', label: '最近 7 天' },
  { value: '30d', label: '最近 30 天' },
  { value: 'expiring', label: '即将过期（7天内）' },
  { value: 'expired', label: '已过期' }
]

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

// P1-6：筛选后数据（关键词 + 时间范围）
const filteredTableData = computed(() => {
  let list = tableData.value
  const kw = searchKeyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter((r) => {
      const name = (r.filename || r.name || '').toLowerCase()
      return name.includes(kw)
    })
  }
  if (timeFilter.value !== 'all') {
    const now = Date.now()
    const dayMs = 86400000
    list = list.filter((r) => {
      const info = expireInfo(r)
      if (timeFilter.value === 'expired') return info.expired
      if (timeFilter.value === 'expiring') return info.urgent && !info.expired
      // 按删除时间筛
      const t = new Date(r.updateTime || 0).getTime()
      const days = (now - t) / dayMs
      if (timeFilter.value === '7d') return days <= 7
      if (timeFilter.value === '30d') return days <= 30
      return true
    })
  }
  return list
})

// 筛选变化时清空选择（避免选中已不在视图的项）
watch([searchKeyword, timeFilter], () => {
  selected.value = []
})

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
    `将永久删除全部 ${totalSummary.value.count} 个文件/文件夹（${totalSummary.value.totalSize}），此操作不可恢复！`,
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
  const expiredBytes = expired.reduce((acc, r) => acc + parseSize(r.fileSizeDesc), 0)
  ElMessageBox.confirm(
    `将删除 ${expired.length} 个已过期文件，释放 ${formatSize(expiredBytes)} 空间`,
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
  // 统计基于筛选后数据，让用户看到当前视图的汇总
  const rows = filteredTableData.value
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

// 全量统计（用于顶部提示条"清空回收站"文案）
const totalSummary = computed(() => ({
  count: tableData.value.length,
  totalSize: formatSize(
    tableData.value.reduce((acc, r) => acc + parseSize(r.fileSizeDesc), 0)
  )
}))

// 批量删除选中项（P1-6 补全）
function batchDeleteSelected() {
  if (selected.value.length === 0) return ElMessage.error('请选择要删除的文件')
  ElMessageBox.confirm(
    `将永久删除选中的 ${selected.value.length} 个文件，此操作不可恢复！`,
    '批量彻底删除',
    { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'danger' }
  )
    .then(() => {
      doDelete(selected.value.filter(Boolean).join('__,__'))
    })
    .catch(() => {})
}

// 一键还原当前筛选结果（P1-6 便捷操作）
function restoreAllFiltered() {
  if (filteredTableData.value.length === 0) return
  ElMessageBox.confirm(
    `将还原当前筛选的 ${filteredTableData.value.length} 个文件到原位置`,
    '批量还原',
    { confirmButtonText: '确认还原', cancelButtonText: '取消' }
  )
    .then(() => {
      const ids = filteredTableData.value.map((r) => r.fileId).join('__,__')
      doRestore(ids)
    })
    .catch(() => {})
}

onMounted(loadTableData)
</script>

<template>
  <div class="flex flex-col gap-1">
    <!-- 页面标题 -->
    <div class="flex items-center gap-3 py-3">
      <h1 class="text-xl font-semibold tracking-tight text-[var(--color-text)]">回收站</h1>
      <span class="px-2 py-0.5 rounded-full text-xs font-mono" style="background-color: var(--color-surface-container-low); color: var(--color-text-muted);">
        {{ totalSummary.count }} items
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

    <!-- P1-6：筛选栏（关键词 + 时间范围） -->
    <div class="flex items-center gap-3 py-3 flex-wrap">
      <div class="flex-1 min-w-[240px] max-w-md">
        <BaseInput
          v-model="searchKeyword"
          placeholder="搜索回收站文件名…"
          :prefix="SearchIcon"
          clearable
        />
      </div>
      <div class="relative">
        <Filter
          :size="14"
          :stroke-width="2"
          class="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-muted)]"
        />
        <select
          v-model="timeFilter"
          class="h-9 pl-8 pr-8 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] outline-none cursor-pointer transition-colors hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-ring)] appearance-none"
        >
          <option v-for="opt in timeFilterOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <span
        v-if="searchKeyword || timeFilter !== 'all'"
        class="text-xs text-[var(--color-text-muted)]"
      >
        筛选结果：{{ summary.count }} 项
      </span>
    </div>

    <!-- 统计卡片（基于当前筛选结果） -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
      <div class="px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)]">
        <div class="text-xs" style="color: var(--color-text-muted);">
          {{ searchKeyword || timeFilter !== 'all' ? '当前筛选文件数' : '回收站文件数' }}
        </div>
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
        <!-- P1-6：一键还原当前筛选结果 -->
        <BaseTooltip text="还原当前筛选出的全部文件" position="top">
          <BaseButton
            variant="ghost"
            :disabled="filteredTableData.length === 0"
            @click="restoreAllFiltered"
          >
            <span class="flex items-center gap-1.5">
              <RefreshCw :size="14" :stroke-width="2" />
              还原筛选结果
            </span>
          </BaseButton>
        </BaseTooltip>
        <!-- P1-6：批量彻底删除选中 -->
        <BaseButton
          variant="danger"
          :disabled="selected.length === 0"
          @click="batchDeleteSelected"
        >
          <span class="flex items-center gap-1.5">
            <Trash2 :size="14" :stroke-width="2" />
            彻底删除
          </span>
        </BaseButton>
        <BaseButton variant="primary" :disabled="selected.length === 0" @click="restoreRecycle">
          <span class="flex items-center gap-1.5">
            <RefreshCw :size="14" :stroke-width="2" />
            还原选中
          </span>
        </BaseButton>
      </div>
    </div>

    <BaseTable
      :columns="columns"
      :data="filteredTableData"
      :loading="tableLoading"
      :selected="selected"
      selectable
      row-key="fileId"
      :empty-text="searchKeyword || timeFilter !== 'all' ? '没有符合筛选条件的文件' : '回收站是空的'"
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
