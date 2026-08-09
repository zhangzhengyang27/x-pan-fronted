<script setup>
/**
 * ShareListPage —— 我的分享列表
 */
import {onMounted, ref} from 'vue'
import {Share2, Link as LinkIcon, X} from '@lucide/vue'
import shareService from '@/api/share'
import {ElMessage, ElMessageBox} from '@/composables/useToast'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'

const tableData = ref([])
const selected = ref([])
const tableLoading = ref(true)

const columns = [
  {key: 'shareName', title: '分享名称', width: 'auto'},
  {key: 'shareUrl', title: '分享链接', width: 320, align: 'center'},
  {key: 'shareCode', title: '提取码', width: 120, align: 'center'},
  {key: 'createTime', title: '分享时间', width: 180, align: 'center'},
  {key: 'shareStatusText', title: '状态', width: 160, align: 'center'},
  {key: 'actions', title: '操作', width: 120, align: 'right'},
]

function loadTableData() {
  tableLoading.value = true
  shareService.getShares(
    (res) => {
      tableLoading.value = false
      tableData.value = (res.data || []).map((row) => ({
        ...row,
        shareStatusText: formatStatus(row),
      }))
    },
    (res) => {
      tableLoading.value = false
      ElMessage.error(res.message)
    },
  )
}

function formatStatus(row) {
  if (row.shareStatus === 1) return {label: '有分享文件被删除', variant: 'warning'}
  if (row.shareDayType === 0) return {label: '永久有效', variant: 'success'}
  return {label: `${row.shareEndTime} 到期`, variant: 'neutral'}
}

function copyShare(row) {
  const text = `链接：${row.shareUrl}\n提取码：${row.shareCode}\n赶快分享给小伙伴吧！`
  navigator.clipboard.writeText(text)
    .then(() => ElMessage.success('已复制'))
    .catch(() => ElMessage.error('复制失败'))
}

function doCancelShares(shareIds) {
  if (!window.confirm('分享取消后将不可恢复，您确定这样做吗？')) return
  shareService.cancelShare(
    {shareIds},
    () => {
      ElMessage.success('取消分享成功')
      loadTableData()
    },
    (res) => ElMessage.error(res.message),
  )
}

function cancelShares() {
  if (selected.value.length === 0) return ElMessage.error('请选择要取消的分享')
  const ids = selected.value.map((i) => tableData.value[i]?.shareId).filter(Boolean).join('__,__')
  doCancelShares(ids)
}

function cancelShare(row) {
  doCancelShares(row.shareId)
}

onMounted(loadTableData)
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between py-3">
      <BaseButton variant="danger" @click="cancelShares">
        <template #default>
          <span class="flex items-center gap-2">
            <X :size="16"/> 取消分享
          </span>
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
      <template #cell-shareName="{row}">
        <div class="flex items-center gap-3">
          <Share2 :size="18" class="text-[var(--color-primary-500)] shrink-0"/>
          <span class="truncate">{{ row.shareName }}</span>
        </div>
      </template>
      <template #cell-shareUrl="{row}">
        <a :href="row.shareUrl" target="_blank" class="text-[var(--color-primary-600)] hover:underline truncate inline-block max-w-[280px] align-middle">
          {{ row.shareUrl.length > 30 ? row.shareUrl.slice(0, 30) + '…' : row.shareUrl }}
        </a>
      </template>
      <template #cell-shareStatusText="{row}">
        <BaseBadge :variant="row.shareStatusText.variant">{{ row.shareStatusText.label }}</BaseBadge>
      </template>
      <template #cell-actions="{row}">
        <div class="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <BaseTooltip text="复制链接" position="top">
            <BaseButton variant="ghost" size="sm" @click="copyShare(row)">
              <LinkIcon :size="14"/>
            </BaseButton>
          </BaseTooltip>
          <BaseTooltip text="取消分享" position="top">
            <BaseButton variant="danger" size="sm" @click="cancelShare(row)">
              <X :size="14"/>
            </BaseButton>
          </BaseTooltip>
        </div>
      </template>
    </BaseTable>
  </div>
</template>