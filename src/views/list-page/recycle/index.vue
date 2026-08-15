<script setup lang="ts">
/**
 * RecycleListPage —— 回收站
 * 参照夸克网盘回收站设计：
 * - 顶行：面包屑/保存期/清空+还原
 * - 次行：文件类型筛选 chips
 * - 表格：文件名、文件原路径、大小、删除时间、清除日期
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
  Image as ImageIcon,
  Video,
  Music,
  ChevronRight,
  RotateCcw
} from '@lucide/vue'
import recycleService, { type IRecycleStatVO } from '@/api/recycle'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'

const RECYCLE_EXPIRE_DAYS = 30

const tableData = ref([])
const selected = ref([])
const tableLoading = ref(true)
const recycleStat = ref<IRecycleStatVO | null>(null)

function loadRecycleStat() {
  recycleService.stat(
    (res) => { recycleStat.value = res.data },
    () => {}
  )
}

// 文件类型筛选（与文件页映射保持一致，新增 folder/archive/audio/install 以满足截图分类）
const typeFilter = ref('-1')
const typeOptions = [
  { value: '-1', label: '全部', icon: null },
  { value: '0', label: '文件夹', icon: Folder },
  { value: '2', label: '压缩包', icon: FileArchive },
  { value: '3,4,5,10', label: '文档', icon: FileText },
  { value: '7', label: '图片', icon: ImageIcon },
  { value: '8', label: '音频', icon: Music },
  { value: '9', label: '视频', icon: Video }
]

const columns = [
  { key: 'filename', title: '文件名', width: 'auto' },
  { key: 'originPath', title: '文件原路径', width: 200 },
  { key: 'fileSizeDesc', title: '大小', width: 90, align: 'right' },
  { key: 'deleteTime', title: '删除时间', width: 150, align: 'center' },
  { key: 'clearDate', title: '清除日期', width: 120, align: 'center' },
  { key: 'actions', title: '操作', width: 80, align: 'right' }
]

function fileIcon(type: number) {
  return (
    {
      0: Folder,
      2: FileArchive,
      3: FileSpreadsheet,
      4: FileText,
      5: FileText,
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
  if (typeFilter.value !== '-1') {
    const set = new Set(typeFilter.value.split(','))
    list = list.filter((r: any) => set.has(String(r.fileType)))
  }
  return list
})

watch(typeFilter, () => {
  selected.value = []
})

function expireInfo(row: any) {
  if (!row.updateTime && !row.deleteTime) return { text: '—', urgent: false, expired: false }
  const update = new Date(row.deleteTime || row.updateTime).getTime()
  const expireAt = update + RECYCLE_EXPIRE_DAYS * 24 * 3600 * 1000
  const left = Math.ceil((expireAt - Date.now()) / (24 * 3600 * 1000))
  if (left < 0) return { text: '已过期', urgent: true, expired: true, left: 0, expireAt }
  if (left <= 7) return { text: `${left} 天后删除`, urgent: true, expired: false, left, expireAt }
  return { text: `${left} 天后删除`, urgent: false, expired: false, left, expireAt }
}

function formatDateTime(d: string | number | Date) {
  if (!d) return '-'
  const date = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatClearDate(row: any) {
  const info = expireInfo(row)
  if (!info.expireAt) return '-'
  const date = new Date(info.expireAt)
  const left = info.left
  const suffix = left < 0 ? '已过期' : `${left}天后清除`
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${suffix}`
}

function cleanRecycle() {
  if (tableData.value.length === 0) return ElMessage.warning('回收站已经是空的')
  ElMessageBox.confirm(
    `将永久删除全部 ${totalSummary.value.count} 个文件/文件夹，此操作不可恢复！`,
    '清空回收站',
    { confirmButtonText: '确认清空', cancelButtonText: '取消', type: 'danger' }
  ).then(() => {
    doDelete(tableData.value.map((f: any) => f.fileId).join('__,__'))
  }).catch(() => {})
}

function parseSize(desc: string) {
  if (!desc) return 0
  const m = String(desc).match(/^([\d.]+)\s*(B|KB|MB|GB|TB)?$/i)
  if (!m) return 0
  const num = parseFloat(m[1])
  const unit = (m[2] || 'B').toUpperCase()
  const mul = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }[unit] || 1
  return num * mul
}

function formatSize(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`
}

function doDelete(fileIds: string) {
  recycleService.deleteRecycle(
    { fileIds },
    () => {
      ElMessage.success('删除成功')
      loadTableData()
    },
    (res: any) => ElMessage.error(res.message)
  )
}

function doRestore(fileIds: string) {
  recycleService.restoreRecycle(
    { fileIds },
    (res: any) => {
      ElMessage.success('文件还原成功')
      tableData.value = res.data || []
    },
    (res: any) => ElMessage.error(res.message)
  )
}

function restoreRecycle() {
  if (selected.value.length === 0) return ElMessage.error('请选择要还原的文件')
  const ids = selected.value.filter(Boolean).join('__,__')
  doRestore(ids)
}

const totalSummary = computed(() => ({
  count: tableData.value.length,
  totalSize: formatSize(tableData.value.reduce((acc: number, r: any) => acc + parseSize(r.fileSizeDesc), 0))
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
    const ids = filteredTableData.value.map((r: any) => r.fileId).join('__,__')
    doRestore(ids)
  }).catch(() => {})
}

onMounted(() => {
  loadTableData()
  loadRecycleStat()
})
</script>

<template>
  <div class="flex flex-col gap-3 px-4 py-3 h-full">
    <!-- 顶行：面包屑 + 保存期提示 -->
    <div class="flex items-center justify-between gap-3 min-w-0">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-sm text-(--color-text-secondary) whitespace-nowrap">全部</span>
        <ChevronRight :size="14" class="text-(--color-text-muted)" />
        <span class="text-sm font-medium text-(--color-text)">回收站</span>
        <span v-if="totalSummary.count > 0 || recycleStat?.fileCount" class="quark-badge text-[11px]">
          {{ recycleStat?.fileCount ?? totalSummary.count }} 项
          <template v-if="recycleStat?.sizeDesc">&nbsp;· 占用 {{ recycleStat.sizeDesc }}</template>
        </span>
      </div>
      <span class="text-xs text-(--color-text-secondary) whitespace-nowrap">
        文件保存有效期 {{ RECYCLE_EXPIRE_DAYS }} 天
      </span>
    </div>

    <!-- 操作栏：类型筛选 chips + 保存期 + 操作按钮 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          v-for="t in typeOptions"
          :key="t.value"
          type="button"
          class="inline-flex items-center gap-1.5 h-8 px-4 py-1.5 rounded-[6px] text-sm font-medium whitespace-nowrap transition-all"
          :class="[
            typeFilter === t.value
              ? 'bg-primary-500 text-white border border-transparent shadow-[0_2px_6px_rgba(0,163,255,0.35)]'
              : 'bg-(--color-surface) border border-(--color-border) text-(--color-text) hover:border-primary-300 hover:text-primary-600'
          ]"
          @click="typeFilter = t.value"
        >
          <component
            v-if="t.icon"
            :is="t.icon"
            :size="14"
            :stroke-width="2"
            :class="typeFilter === t.value ? 'text-white' : ''"
          />
          {{ t.label }}
        </button>
      </div>
      <div class="flex items-center gap-2">
          <BaseButton
            variant="ghost"
            size="sm"
            :disabled="selected.length === 0"
            @click="restoreRecycle"
          >
            <RotateCcw :size="14" :stroke-width="2" />
            还原已选
          </BaseButton>
          <BaseButton
            variant="ghost"
            size="sm"
            :disabled="selected.length === 0"
            @click="batchDeleteSelected"
          >
            <Trash2 :size="14" :stroke-width="2" />
            清除已选
          </BaseButton>
          <BaseButton variant="danger" size="sm" @click="cleanRecycle">
            <Trash2 :size="14" :stroke-width="2" />
            清空回收站
          </BaseButton>
        </div>
      </div>

    <!-- 表格 -->
    <div class="flex-1 min-h-0 overflow-y-auto -mx-4 px-4">
      <BaseTable
        :columns="columns"
        :data="filteredTableData"
        :loading="tableLoading"
        :selected="selected"
        selectable
        row-key="fileId"
        :empty-text="typeFilter !== '-1' ? '没有符合筛选条件的文件' : '回收站是空的'"
        @update:selected="(v) => (selected = v)"
      >
        <template #cell-filename="{ row }">
          <div class="flex items-center gap-2">
            <component
              :is="fileIcon(row.fileType)"
              :size="18"
              :stroke-width="1.75"
              class="shrink-0 text-(--color-text-secondary)"
            />
            <span class="truncate text-sm text-(--color-text)">{{ row.filename }}</span>
          </div>
        </template>

        <template #cell-originPath="{ row }">
          <span class="truncate text-xs text-(--color-text-secondary)" :title="row.parentFilename || row.realPath || '-'">
            {{ row.parentFilename || row.realPath || '-' }}
          </span>
        </template>

        <template #cell-fileSizeDesc="{ row }">
          <span class="text-xs tabular-nums text-(--color-text-secondary)">{{ row.fileSizeDesc || '-' }}</span>
        </template>

        <template #cell-deleteTime="{ row }">
          <span class="text-xs tabular-nums text-(--color-text-secondary)">
            {{ formatDateTime(row.deleteTime || row.updateTime) }}
          </span>
        </template>

        <template #cell-clearDate="{ row }">
          <span
            class="text-xs tabular-nums"
            :class="expireInfo(row).expired ? 'text-danger' : 'text-(--color-text-secondary)'"
          >
            {{ formatClearDate(row) }}
          </span>
        </template>

        <template #cell-actions="{ row }">
          <div class="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <BaseTooltip text="还原">
              <BaseButton variant="primary" size="sm" @click="doRestore(row.fileId)">
                <RefreshCw :size="14" :stroke-width="2" />
              </BaseButton>
            </BaseTooltip>
            <BaseTooltip text="彻底删除">
              <BaseButton variant="danger" size="sm" @click="doDelete(row.fileId)">
                <Trash2 :size="14" :stroke-width="2" />
              </BaseButton>
            </BaseTooltip>
          </div>
        </template>
      </BaseTable>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
