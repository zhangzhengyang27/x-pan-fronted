<script setup lang="ts">
/**
 * RecycleListPage —— 回收站（夸克风格重设计）
 * 关键词搜索 + 时间范围筛选 + 批量还原/删除
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
  Filter,
  X
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

const searchKeyword = ref('')
const timeFilter = ref<'all' | '7d' | '30d' | 'expiring' | 'expired'>('all')

const timeFilterOptions = [
  { value: 'all', label: '全部' },
  { value: '7d', label: '最近 7 天' },
  { value: '30d', label: '最近 30 天' },
  { value: 'expiring', label: '即将过期' },
  { value: 'expired', label: '已过期' }
]

const columns = [
  { key: 'filename', title: '文件名', width: 'auto' },
  { key: 'fileSizeDesc', title: '大小', width: 120, align: 'right' },
  { key: 'updateTime', title: '删除日期', width: 180, align: 'center' },
  { key: 'expireHint', title: '剩余时间', width: 160, align: 'center' },
  { key: 'actions', title: '操作', width: 120, align: 'right' }
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
      const t = new Date(r.updateTime || 0).getTime()
      const days = (now - t) / dayMs
      if (timeFilter.value === '7d') return days <= 7
      if (timeFilter.value === '30d') return days <= 30
      return true
    })
  }
  return list
})

watch([searchKeyword, timeFilter], () => {
  selected.value = []
})

function expireInfo(row) {
  if (!row.updateTime) return { text: '—', urgent: false, expired: false }
  const update = new Date(row.updateTime).getTime()
  const expireAt = update + RECYCLE_EXPIRE_DAYS * 24 * 3600 * 1000
  const left = Math.ceil((expireAt - Date.now()) / (24 * 3600 * 1000))
  if (left < 0) return { text: '已过期', urgent: true, expired: true, left: 0 }
  if (left <= 7) return { text: `${left} 天后删除`, urgent: true, expired: false, left }
  return { text: `${left} 天后删除`, urgent: false, expired: false, left }
}

function cleanRecycle() {
  if (tableData.value.length === 0) return ElMessage.warning('回收站已经是空的')
  ElMessageBox.confirm(
    `将永久删除全部 ${totalSummary.value.count} 个文件/文件夹（${totalSummary.value.totalSize}），此操作不可恢复！`,
    '清空回收站',
    { confirmButtonText: '确认清空', cancelButtonText: '取消', type: 'danger' }
  ).then(() => {
    doDelete(tableData.value.map((f) => f.fileId).join('__,__'))
  }).catch(() => {})
}

function cleanExpired() {
  const expired = tableData.value.filter((r) => expireInfo(r).expired)
  if (expired.length === 0) return ElMessage.warning('没有过期文件可清理')
  const expiredBytes = expired.reduce((acc, r) => acc + parseSize(r.fileSizeDesc), 0)
  ElMessageBox.confirm(
    `将删除 ${expired.length} 个已过期文件，释放 ${formatSize(expiredBytes)} 空间`,
    '清理过期文件',
    { confirmButtonText: '确认清理', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    doDelete(expired.map((f) => f.fileId).join('__,__'))
  }).catch(() => {})
}

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
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
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
const totalUrgent = computed(() => tableData.value.filter((r) => expireInfo(r).urgent && !expireInfo(r).expired).length)

const summary = computed(() => {
  const rows = filteredTableData.value
  let totalBytes = 0
  let expiredBytes = 0
  rows.forEach((r) => {
    const b = parseSize(r.fileSizeDesc)
    totalBytes += b
    if (expireInfo(r).expired) expiredBytes += b
  })
  return { count: rows.length, totalSize: formatSize(totalBytes), expiredSize: formatSize(expiredBytes) }
})

const totalSummary = computed(() => ({
  count: tableData.value.length,
  totalSize: formatSize(tableData.value.reduce((acc, r) => acc + parseSize(r.fileSizeDesc), 0))
}))

function batchDeleteSelected() {
  if (selected.value.length === 0) return ElMessage.error('请选择要删除的文件')
  ElMessageBox.confirm(
    `将永久删除选中的 ${selected.value.length} 个文件，此操作不可恢复！`,
    '批量彻底删除',
    { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'danger' }
  ).then(() => {
    doDelete(selected.value.filter(Boolean).join('__,__'))
  }).catch(() => {})
}

function restoreAllFiltered() {
  if (filteredTableData.value.length === 0) return
  ElMessageBox.confirm(
    `将还原当前筛选的 ${filteredTableData.value.length} 个文件到原位置`,
    '批量还原',
    { confirmButtonText: '确认还原', cancelButtonText: '取消' }
  ).then(() => {
    const ids = filteredTableData.value.map((r) => r.fileId).join('__,__')
    doRestore(ids)
  }).catch(() => {})
}

onMounted(loadTableData)
</script>

<template>
  <div class="flex flex-col gap-4 px-5 py-4">
    <!-- 页面标题行 -->
    <div class="flex items-center gap-3">
      <h1 class="text-xl font-semibold text-[var(--color-text)]">回收站</h1>
      <span
        v-if="totalSummary.count > 0"
        class="quark-badge"
      >
        {{ totalSummary.count }} 项
      </span>
    </div>

    <!-- 警告提示条(夸克风格) -->
    <div class="quark-card px-4 py-3 flex items-center justify-between gap-4">
      <div class="flex items-center gap-2.5">
        <AlertTriangle :size="16" :stroke-width="2" class="text-[var(--color-warning)] shrink-0" />
        <span class="text-sm text-[var(--color-text)]">
          文件将在 <span class="font-semibold tabular-nums">{{ RECYCLE_EXPIRE_DAYS }}</span> 天后自动清除
          <span v-if="totalUrgent > 0" class="ml-2 text-[var(--color-warning)] font-medium">
            · {{ totalUrgent }} 个即将过期
          </span>
          <span v-if="totalExpired > 0" class="ml-1 text-[var(--color-danger)] font-medium">
            · {{ totalExpired }} 个已过期
          </span>
        </span>
      </div>
      <BaseButton variant="danger" size="sm" @click="cleanRecycle">
        <Trash2 :size="14" :stroke-width="2" />
        清空
      </BaseButton>
    </div>

    <!-- 筛选栏 -->
    <div class="flex items-center gap-3 flex-wrap">
      <div class="flex-1 min-w-[220px] max-w-sm">
        <BaseInput
          v-model="searchKeyword"
          placeholder="搜索文件名..."
          :prefix="SearchIcon"
          clearable
        />
      </div>
      <div class="flex items-center gap-1.5">
        <Filter :size="14" class="text-[var(--color-text-muted)] shrink-0" />
        <select
          v-model="timeFilter"
          class="h-8 pl-3 pr-8 text-xs rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] outline-none cursor-pointer transition-colors hover:border-[var(--color-border-strong)] focus:border-[var(--color-border-focus)] appearance-none"
        >
          <option v-for="opt in timeFilterOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <span
        v-if="searchKeyword || timeFilter !== 'all'"
        class="text-xs text-[var(--color-text-muted)] shrink-0"
      >
        筛选 {{ summary.count }} 项
      </span>
    </div>

    <!-- 统计卡片(夸克风格:三列紧凑卡片) -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="quark-card px-4 py-3">
        <div class="text-xs text-[var(--color-text-secondary)]">文件数</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text)]">{{ summary.count }}</div>
      </div>
      <div class="quark-card px-4 py-3">
        <div class="text-xs text-[var(--color-text-secondary)]">占用空间</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text)]">{{ summary.totalSize }}</div>
      </div>
      <div class="quark-card px-4 py-3">
        <div class="text-xs text-[var(--color-text-secondary)]">过期释放</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums" :class="summary.expiredSize !== '0 B' ? 'text-[var(--color-warning)]' : 'text-[var(--color-text)]'">
          {{ summary.expiredSize }}
        </div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div class="flex items-center gap-2">
        <BaseButton
          variant="primary"
          size="sm"
          :disabled="selected.length === 0"
          @click="restoreRecycle"
        >
          <RefreshCw :size="13" :stroke-width="2" />
          还原
        </BaseButton>
        <BaseButton
          variant="danger"
          size="sm"
          :disabled="selected.length === 0"
          @click="batchDeleteSelected"
        >
          <Trash2 :size="13" :stroke-width="2" />
          删除
        </BaseButton>
        <BaseButton
          v-if="totalExpired > 0"
          variant="warning"
          size="sm"
          @click="cleanExpired"
        >
          <Eraser :size="13" :stroke-width="2" />
          清理过期
        </BaseButton>
      </div>
      <div class="flex items-center gap-2">
        <BaseButton
          variant="ghost"
          size="sm"
          :disabled="filteredTableData.length === 0"
          @click="restoreAllFiltered"
        >
          <RefreshCw :size="13" :stroke-width="2" />
          还原全部
        </BaseButton>
      </div>
    </div>

    <!-- 表格 -->
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
            :size="18"
            :stroke-width="1.75"
            class="shrink-0 text-[var(--color-text-secondary)]"
          />
          <span class="truncate text-sm text-[var(--color-text)]">{{ row.filename }}</span>
        </div>
      </template>

      <template #cell-updateTime="{ row }">
        <span class="text-xs tabular-nums text-[var(--color-text-secondary)]">
          {{ row.updateTime ? new Date(row.updateTime).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-' }}
        </span>
      </template>

      <template #cell-expireHint="{ row }">
        <span
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
          :class="expireInfo(row).expired
            ? 'quark-badge-danger'
            : expireInfo(row).urgent
              ? 'quark-badge-warning'
              : 'quark-badge'"
        >
          <AlertTriangle v-if="expireInfo(row).expired || expireInfo(row).urgent" :size="11" />
          {{ expireInfo(row).text }}
        </span>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <BaseButton variant="primary" size="sm" @click="doRestore(row.fileId)">
            <RefreshCw :size="13" :stroke-width="2" />
          </BaseButton>
          <BaseButton variant="danger" size="sm" @click="doDelete(row.fileId)">
            <Trash2 :size="13" :stroke-width="2" />
          </BaseButton>
        </div>
      </template>
    </BaseTable>
  </div>
</template>
