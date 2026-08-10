<script setup>
/**
 * ShareListPage —— 我的分享列表
 */
import { computed, onMounted, ref } from 'vue'
import { Share2, Link as LinkIcon, X, Download } from '@lucide/vue'
import shareService from '@/api/share'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'

const tableData = ref([])
const selected = ref([])
const tableLoading = ref(true)

const columns = [
  { key: 'shareName', title: '分享名称', width: 'auto' },
  { key: 'shareUrl', title: '分享链接', width: 280, align: 'center' },
  { key: 'shareCode', title: '提取码', width: 110, align: 'center' },
  { key: 'createTime', title: '分享时间', width: 170, align: 'center' },
  { key: 'downloadStats', title: '下载统计', width: 130, align: 'center' },
  { key: 'shareStatusText', title: '状态', width: 160, align: 'center' },
  { key: 'actions', title: '操作', width: 120, align: 'right' }
]

const STATUS_TEXT_KEY = '_statusText'

function loadTableData() {
  tableLoading.value = true
  shareService.getShares(
    (res) => {
      tableLoading.value = false
      // 避免与后端 shareStatusText 字段冲突：本地显示状态重命名为 _statusText
      tableData.value = (res.data || []).map((row) => ({
        ...row,
        _statusText: formatStatus(row)
      }))
    },
    (res) => {
      tableLoading.value = false
      ElMessage.error(res.message)
    }
  )
}

function formatStatus(row) {
  if (row.shareStatus === 1) return { label: '有分享文件被删除', variant: 'warning' }
  if (row.shareDayType === 0) return { label: '永久有效', variant: 'success' }
  return { label: `${row.shareEndTime} 到期`, variant: 'neutral' }
}

function copyShare(row) {
  // 优先使用现代 Clipboard API，不可用时退化到隐藏 textarea + execCommand
  const text = `链接：${row.shareUrl}\n提取码：${row.shareCode}\n赶快分享给小伙伴吧！`
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(text)
      .then(() => ElMessage.success('已复制'))
      .catch(() => fallbackCopy(text))
  } else {
    fallbackCopy(text)
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  try {
    document.execCommand('copy')
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败，请手动选择')
  } finally {
    document.body.removeChild(ta)
  }
}

function doCancelShares(shareIds) {
  ElMessageBox({
    title: '取消分享',
    message: '分享取消后将不可恢复，您确定这样做吗？',
    confirmText: '确认取消',
    cancelText: '取消',
    type: 'warning'
  })
    .then(() => {
      shareService.cancelShare(
        { shareIds },
        () => {
          ElMessage.success('取消分享成功')
          loadTableData()
        },
        (res) => ElMessage.error(res.message)
      )
    })
    .catch(() => {})
}

function cancelShares() {
  if (selected.value.length === 0) return ElMessage.error('请选择要取消的分享')
  const ids = selected.value
    .map((i) => tableData.value[i]?.shareId)
    .filter(Boolean)
    .join('__,__')
  doCancelShares(ids)
}

function cancelShare(row) {
  doCancelShares(row.shareId)
}

onMounted(loadTableData)

/** P1.12：分享总览统计 */
const summary = computed(() => {
  const rows = tableData.value
  const now = Date.now()
  const active = rows.filter((r) => {
    if (r.shareStatus === 1) return false
    if (r.shareDayType === 0) return true
    return new Date(r.shareEndTime).getTime() > now
  })
  const totalDownloads = rows.reduce((s, r) => s + (r.downloadCount || 0), 0)
  const remaining = rows.reduce((s, r) => {
    if (!r.downloadLimit || r.downloadLimit <= 0) return s
    return s + Math.max(0, r.downloadLimit - (r.downloadCount || 0))
  }, 0)
  return {
    totalShares: rows.length,
    activeShares: active.length,
    totalDownloads,
    remainingQuota: remaining
  }
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <!-- P1.12：分享总览统计 -->
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
      <div
        class="px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
      >
        <div class="text-xs text-[var(--color-text-muted)]">分享总数</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums">{{ summary.totalShares }}</div>
      </div>
      <div
        class="px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
      >
        <div class="text-xs text-[var(--color-text-muted)]">有效分享</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-success)]">
          {{ summary.activeShares }}
        </div>
      </div>
      <div
        class="px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
      >
        <div class="text-xs text-[var(--color-text-muted)]">总下载次数</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-primary-600)]">
          {{ summary.totalDownloads }}
        </div>
      </div>
      <div
        class="px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
      >
        <div class="text-xs text-[var(--color-text-muted)]">剩余下载配额</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-warning)]">
          {{ summary.remainingQuota }}
        </div>
      </div>
    </div>
    <div class="flex items-center justify-between py-3">
      <BaseButton variant="danger" @click="cancelShares">
        <template #default>
          <span class="flex items-center gap-2"> <X :size="16" /> 取消分享 </span>
        </template>
      </BaseButton>
    </div>

    <BaseTable
      :columns="columns"
      :data="tableData"
      :loading="tableLoading"
      :selected="selected"
      selectable
      row-key="shareId"
      empty-text="还没有分享记录"
      @update:selected="(v) => (selected = v)"
    >
      <template #cell-shareName="{ row }">
        <div class="flex items-center gap-3">
          <Share2 :size="18" class="text-[var(--color-primary-500)] shrink-0" />
          <span class="truncate">{{ row.shareName }}</span>
        </div>
      </template>
      <template #cell-shareUrl="{ row }">
        <a
          :href="row.shareUrl"
          target="_blank"
          class="text-[var(--color-primary-600)] hover:underline truncate inline-block max-w-[280px] align-middle"
        >
          {{ row.shareUrl.length > 30 ? row.shareUrl.slice(0, 30) + '…' : row.shareUrl }}
        </a>
      </template>
      <template #cell-shareStatusText="{ row }">
        <BaseBadge :variant="row[STATUS_TEXT_KEY].variant">{{
          row[STATUS_TEXT_KEY].label
        }}</BaseBadge>
      </template>
      <template #cell-downloadStats="{ row }">
        <div class="inline-flex items-center gap-1.5 text-xs">
          <Download :size="12" class="text-[var(--color-text-muted)]" />
          <span class="font-medium tabular-nums">{{ row.downloadCount || 0 }}</span>
          <span v-if="row.downloadLimit > 0" class="text-[var(--color-text-muted)]">
            / {{ row.downloadLimit }}
          </span>
          <span v-else class="text-[var(--color-text-muted)] text-[10px]">(不限)</span>
        </div>
      </template>
      <template #cell-actions="{ row }">
        <div
          class="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <BaseTooltip text="复制链接" position="top">
            <BaseButton variant="ghost" size="sm" @click="copyShare(row)">
              <LinkIcon :size="14" />
            </BaseButton>
          </BaseTooltip>
          <BaseTooltip text="取消分享" position="top">
            <BaseButton variant="danger" size="sm" @click="cancelShare(row)">
              <X :size="14" />
            </BaseButton>
          </BaseTooltip>
        </div>
      </template>
    </BaseTable>
  </div>
</template>
