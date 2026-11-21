<script setup lang="ts">
/**
 * ShareListPage —— 我的分享列表
 * 设计规范：G 设计风格
 * - 标题 + 副标题
 * - 分享统计（总数/有效/下载次数）
 * - BaseTable（分享类型/提取码/过期时间/浏览次数/操作）
 */
import { computed, onMounted, ref } from 'vue'
import { Share2, Link as LinkIcon, X, Globe, Lock, Eye, Inbox, ShieldAlert, ShieldCheck } from '@lucide/vue'
import shareService from '@/api/share'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import type { IShareVO } from '@/types'

const tableData = ref<IShareVO[]>([])
const selected = ref<(string | number)[]>([])
const tableLoading = ref(true)

// 列字段与后端 XPanShareUrlListVO 契约对齐：
// shareName（分享名称）/ shareEndTime（过期时间）/ visitCount（浏览次数）
const columns: { key: string; title: string; width: string | number; align?: 'left' | 'right' | 'center' }[] = [
  { key: 'shareName', title: '分享名称', width: 'auto' },
  { key: 'shareType', title: '分享类型', width: 120, align: 'center' },
  { key: 'shareCode', title: '提取码', width: 100, align: 'center' },
  { key: 'expireTime', title: '过期时间', width: 160, align: 'center' },
  { key: 'visitCount', title: '浏览次数', width: 100, align: 'center' },
  { key: 'collect', title: '文件收集', width: 110, align: 'center' },
  { key: 'actions', title: '操作', width: 200, align: 'right' }
]

function loadTableData() {
  tableLoading.value = true
  shareService.getShares(
    (res) => {
      tableLoading.value = false
      if (res.code === 0 && res.data) {
        tableData.value = res.data.shares || []
      } else {
        tableData.value = []
      }
    },
    (res) => {
      tableLoading.value = false
      ElMessage.error(res.message)
    }
  )
}

function copyShare(row: Partial<IShareVO>) {
  // 用浏览器当前地址动态拼接分享链接，避免数据库 shareUrl 指向后端端口（如 127.0.0.1:8081）打不开前端分享页面
  const url = `${window.location.origin}/share/${row.shareId}`
  const text = row.shareCode
    ? `链接：${url}\n提取码：${row.shareCode}\n赶快分享给小伙伴吧！`
    : `链接：${url}\n赶快分享给小伙伴吧！`
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => ElMessage.success('链接已复制')).catch(() => fallbackCopy(text))
  } else {
    fallbackCopy(text)
  }
}

function fallbackCopy(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  try {
    document.execCommand('copy')
    ElMessage.success('链接已复制')
  } catch {
    ElMessage.error('复制失败，请手动选择')
  } finally {
    document.body.removeChild(ta)
  }
}

function doCancelShares(shareIds: string[]) {
  ElMessageBox.confirm('确定取消分享?取消后链接将失效', '取消分享', {
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then((ok) => {
      if (!ok) return
      shareService.cancelShare(
        { shareIds },
        () => {
          ElMessage.success('取消分享成功')
          // 清空选中，避免残留已被删除的分享 ID
          selected.value = []
          loadTableData()
        },
        (res) => ElMessage.error(res.message)
      )
    })
    .catch(() => {})
}

function cancelShares() {
  if (selected.value.length === 0) return ElMessage.error('请选择要取消的分享')
  const ids = selected.value.filter(Boolean) as string[]
  doCancelShares(ids)
}

function cancelShare(row: Partial<IShareVO>) {
  if (!row.shareId) return
  doCancelShares([row.shareId])
}

async function appealShare(row: Partial<IShareVO>) {
  if (!row.shareId) return
  try {
    const { value } = await ElMessageBox.prompt(
      '请说明申诉理由（例如：分享内容为原创、无违规）。管理员复核后会恢复或驳回。',
      '申诉被隐藏的分享',
      {
        confirmButtonText: '提交申诉',
        cancelButtonText: '取消',
        inputValidator: (v: string) => {
          const text = String(v || '').trim()
          if (!text) return '申诉理由不能为空'
          if (text.length > 500) return '申诉理由不能超过 500 字'
          return true
        }
      }
    )
    shareService.appealShare(
      { shareId: row.shareId, reason: String(value || '').trim() },
      (res) => {
        if (res.code === 0) {
          ElMessage.success('申诉已提交，请等待管理员复核')
          loadTableData()
        } else ElMessage.error(res.message || '申诉提交失败')
      },
      () => ElMessage.error('申诉提交失败')
    )
  } catch {
    // 用户取消输入
  }
}

onMounted(loadTableData)

const summary = computed(() => {
  const rows = tableData.value
  const now = Date.now()
  const active = rows.filter((r) => {
    if (r.shareStatus === 1) return false
    // 举报待复核隐藏不算有效分享：访问者已经无法打开，统计应与实际状态一致
    if (r.reportHidden === 1) return false
    if (r.shareDayType === 0) return true
    return !!r.shareEndTime && new Date(r.shareEndTime).getTime() > now
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

function toggleCollect(row: Partial<IShareVO>) {
  const shareId = row.shareId
  if (!shareId) return
  const enabled = row.collectEnabled !== 1
  shareService.setShareCollect(
    shareId,
    enabled,
    (res) => {
      if (res.code !== 0) return ElMessage.error(res.message)
      ElMessage.success(enabled ? '已开启文件收集' : '已关闭文件收集')
      loadTableData()
    },
    (res) => ElMessage.error(res.message)
  )
}

function isPublicShare(row: Partial<IShareVO>) {
  return row.shareType === 0
}

function isExpired(row: Partial<IShareVO>) {
  if (!row.shareEndTime) return false
  return new Date(row.shareEndTime).getTime() < Date.now()
}

function formatExpireTime(row: Partial<IShareVO>) {
  if (!row.shareEndTime) return '永久'
  return row.shareEndTime.split(' ')[0]
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 页面标题 -->
    <div class="flex items-center gap-3">
      <h1 class="text-2xl font-semibold tracking-tight text-(--color-text)">
        我的分享
      </h1>
      <span class="text-sm" style="color: var(--color-text-muted);">
        管理您分享的文件
      </span>
    </div>

    <!-- 分享统计 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div
        class="rounded-xl border border-(--color-border) p-4 bg-(--color-surface-container-low)"
      >
        <div class="text-xs mb-1" style="color: var(--color-text-muted);">分享总数</div>
        <div class="text-2xl font-bold tabular-nums text-(--color-text)">
          {{ summary.totalShares }}
        </div>
      </div>
      <div
        class="rounded-xl border border-(--color-border) p-4 bg-(--color-surface-container-low)"
      >
        <div class="text-xs mb-1" style="color: var(--color-text-muted);">有效分享</div>
        <div class="text-2xl font-bold tabular-nums" style="color: var(--color-success);">
          {{ summary.activeShares }}
        </div>
      </div>
      <div
        class="rounded-xl border border-(--color-border) p-4 bg-(--color-surface-container-low)"
      >
        <div class="text-xs mb-1" style="color: var(--color-text-muted);">总下载次数</div>
        <div class="text-2xl font-bold tabular-nums" style="color: var(--color-primary-500);">
          {{ summary.totalDownloads }}
        </div>
      </div>
      <div
        class="rounded-xl border border-(--color-border) p-4 bg-(--color-surface-container-low)"
      >
        <div class="text-xs mb-1" style="color: var(--color-text-muted);">剩余下载配额</div>
        <div class="text-2xl font-bold tabular-nums" style="color: var(--color-warning);">
          {{ summary.remainingQuota }}
        </div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="flex items-center justify-end">
      <BaseButton
        variant="danger"
        size="sm"
        :disabled="selected.length === 0"
        @click="cancelShares"
      >
        <template #default>
          <span class="inline-flex items-center gap-1.5">
            <X :size="14" :stroke-width="2" />
            取消分享
          </span>
        </template>
      </BaseButton>
    </div>

    <!-- 表格 -->
    <BaseTable
      :columns="columns"
      :data="tableData"
      :loading="tableLoading"
      :selected="selected"
      selectable
      row-key="shareId"
      empty-text="还没有分享过文件"
      @update:selected="(v) => (selected = v)"
    >
      <template #cell-shareName="{ row }">
        <div class="flex items-center gap-3">
          <Share2 :size="18" :stroke-width="2" class="shrink-0" style="color: var(--color-primary-500);" />
          <span class="truncate text-(--color-text)">{{ row.shareName || '未命名' }}</span>
          <BaseBadge v-if="row.e2ee === 1" variant="success" size="sm">
            <span class="inline-flex items-center gap-1">
              <ShieldCheck :size="11" :stroke-width="2" />
              E2EE
            </span>
          </BaseBadge>
          <BaseBadge v-if="row.reportHidden === 1" variant="danger" size="sm">待复核</BaseBadge>
        </div>
      </template>

      <template #cell-shareType="{ row }">
        <BaseBadge :variant="isPublicShare(row) ? 'success' : 'warning'">
          <span class="inline-flex items-center gap-1">
            <Globe v-if="isPublicShare(row)" :size="12" :stroke-width="2" />
            <Lock v-else :size="12" :stroke-width="2" />
            {{ isPublicShare(row) ? '公开' : '加密' }}
          </span>
        </BaseBadge>
      </template>

      <template #cell-shareCode="{ row }">
        <span v-if="row.shareCode" class="font-mono tabular-nums text-sm tracking-wider text-(--color-text)">
          {{ row.shareCode }}
        </span>
        <span v-else style="color: var(--color-text-muted);">—</span>
      </template>

      <template #cell-expireTime="{ row }">
        <span
          class="tabular-nums text-sm"
          :style="isExpired(row) ? 'color: var(--color-danger);' : 'color: var(--color-text-muted);'"
        >
          {{ formatExpireTime(row) }}
          <span v-if="isExpired(row)" class="ml-1">(已过期)</span>
        </span>
      </template>

      <template #cell-collect="{ row }">
        <BaseBadge :variant="row.collectEnabled === 1 ? 'success' : 'neutral'">
          <span class="inline-flex items-center gap-1">
            <Inbox :size="12" :stroke-width="2" />
            {{ row.collectEnabled === 1 ? '已开启' : '未开启' }}
          </span>
        </BaseBadge>
      </template>

      <template #cell-visitCount="{ row }">
        <span class="inline-flex items-center gap-1 tabular-nums text-sm text-(--color-text)">
          <Eye :size="12" :stroke-width="2" style="color: var(--color-text-muted);" />
          {{ row.visitCount ?? 0 }}
        </span>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center gap-1 justify-end transition-opacity opacity-0 group-hover:opacity-100">
          <BaseTooltip text="复制链接" position="top">
            <BaseButton variant="secondary" size="sm" @click="copyShare(row)">
              <LinkIcon :size="14" :stroke-width="2" />
            </BaseButton>
          </BaseTooltip>
          <BaseTooltip v-if="row.reportHidden === 1" text="申诉复核" position="top">
            <BaseButton variant="primary" size="sm" @click="appealShare(row)">
              <ShieldAlert :size="14" :stroke-width="2" />
            </BaseButton>
          </BaseTooltip>
          <BaseTooltip :text="row.collectEnabled === 1 ? '关闭文件收集' : '开启文件收集'" position="top">
            <BaseButton
              variant="secondary"
              size="sm"
              :disabled="row.shareStatus === 1 || row.reportHidden === 1 || isExpired(row)"
              @click="toggleCollect(row)"
            >
              <Inbox :size="14" :stroke-width="2" />
            </BaseButton>
          </BaseTooltip>
          <BaseTooltip text="取消分享" position="top">
            <BaseButton variant="danger" size="sm" @click="cancelShare(row)">
              <X :size="14" :stroke-width="2" />
            </BaseButton>
          </BaseTooltip>
        </div>
      </template>
    </BaseTable>
  </div>
</template>
