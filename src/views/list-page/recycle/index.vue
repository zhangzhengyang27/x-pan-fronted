<script setup>
/**
 * RecycleListPage —— 回收站
 * P1.7：过期清理提示（基于 updateTime 计算 X 天后清除）
 */
import {computed, onMounted, ref} from 'vue'
import {RefreshCw, Trash2, Folder, FileText, FileArchive, FileSpreadsheet, FileImage, FileAudio, FileVideo, FileCode, FileBarChart2, AlertTriangle, Clock} from '@lucide/vue'
import recycleService from '@/api/recycle'
import {ElMessage, ElMessageBox} from '@/composables/useToast'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'

const RECYCLE_EXPIRE_DAYS = 30 // 后端清理阈值

const tableData = ref([])
const selected = ref([])
const tableLoading = ref(true)

const columns = [
  {key: 'filename', title: '文件名', width: 'auto'},
  {key: 'fileSizeDesc', title: '大小', width: 120, align: 'right'},
  {key: 'updateTime', title: '删除日期', width: 180, align: 'center'},
  {key: 'expireHint', title: '到期', width: 160, align: 'center'},
  {key: 'actions', title: '操作', width: 140, align: 'right'},
]

function fileIcon(type) {
  return {0: Folder, 2: FileArchive, 3: FileSpreadsheet, 4: FileText, 7: FileImage, 8: FileAudio, 9: FileVideo, 10: FileBarChart2, 11: FileCode}[type] || FileText
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
    },
  )
}

/**
 * P1.7：基于 updateTime 计算剩余天数
 * - daysLeft > 7：蓝色（充足）
 * - daysLeft 0~7：橙色（即将过期）
 * - daysLeft < 0：红色（已过期，由后端 cron 清理）
 */
function expireInfo(row) {
  if (!row.updateTime) return {text: '—', urgent: false, expired: false}
  const update = new Date(row.updateTime).getTime()
  const expireAt = update + RECYCLE_EXPIRE_DAYS * 24 * 3600 * 1000
  const left = Math.ceil((expireAt - Date.now()) / (24 * 3600 * 1000))
  if (left < 0) return {text: '已过期', urgent: true, expired: true, left: 0}
  if (left <= 7) return {text: `还剩 ${left} 天`, urgent: true, expired: false, left}
  return {text: `还剩 ${left} 天`, urgent: false, expired: false, left}
}

function doDelete(fileIds) {
  if (!window.confirm('文件删除后将不可恢复，您确定这样做吗？')) return
  recycleService.deleteRecycle(
    {fileIds},
    () => {
      ElMessage.success('删除成功')
      loadTableData()
    },
    (res) => ElMessage.error(res.message),
  )
}

function cleanRecycle() {
  if (tableData.value.length === 0) return
  doDelete(tableData.value.map((f) => f.fileId).join('__,__'))
}

function doRestore(fileIds) {
  recycleService.restoreRecycle(
    {fileIds},
    (res) => {
      ElMessage.success('文件还原成功')
      tableData.value = res.data || []
    },
    (res) => ElMessage.error(res.message),
  )
}

function restoreRecycle() {
  if (selected.value.length === 0) return ElMessage.error('请选择要还原的文件')
  const ids = selected.value.map((i) => tableData.value[i]?.fileId).filter(Boolean).join('__,__')
  doRestore(ids)
}

const totalExpired = computed(() => tableData.value.filter((r) => expireInfo(r).expired).length)
const totalUrgent = computed(() => tableData.value.filter((r) => expireInfo(r).urgent && !expireInfo(r).expired).length)

onMounted(loadTableData)
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between py-3">
      <div class="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Clock :size="14"/>
        回收站文件将在 {{ RECYCLE_EXPIRE_DAYS }} 天后被自动清理
        <span v-if="totalUrgent > 0" class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          <AlertTriangle :size="12"/>
          {{ totalUrgent }} 个即将过期
        </span>
        <span v-if="totalExpired > 0" class="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {{ totalExpired }} 个已过期
        </span>
      </div>
      <div class="flex items-center gap-2">
        <BaseButton variant="primary" @click="restoreRecycle">
          <span class="flex items-center gap-2"><RefreshCw :size="16"/> 还原</span>
        </BaseButton>
        <BaseButton variant="danger" @click="cleanRecycle">
          <span class="flex items-center gap-2"><Trash2 :size="16"/> 清空回收站</span>
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
      <template #cell-filename="{row}">
        <div class="flex items-center gap-3">
          <component :is="fileIcon(row.fileType)" :size="20" class="text-[var(--color-text-muted)] shrink-0"/>
          <span class="truncate">{{ row.filename }}</span>
        </div>
      </template>
      <template #cell-expireHint="{row}">
        <span
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
          :class="expireInfo(row).expired
            ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            : expireInfo(row).urgent
            ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'"
        >
          <AlertTriangle v-if="expireInfo(row).urgent" :size="12"/>
          {{ expireInfo(row).text }}
        </span>
      </template>
      <template #cell-actions="{row}">
        <div class="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <BaseTooltip text="还原" position="top">
            <BaseButton variant="primary" size="sm" @click="doRestore(row.fileId)">
              <RefreshCw :size="14"/>
            </BaseButton>
          </BaseTooltip>
          <BaseTooltip text="彻底删除" position="top">
            <BaseButton variant="danger" size="sm" @click="doDelete(row.fileId)">
              <Trash2 :size="14"/>
            </BaseButton>
          </BaseTooltip>
        </div>
      </template>
    </BaseTable>
  </div>
</template>