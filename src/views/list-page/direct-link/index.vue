<script setup lang="ts">
/**
 * DirectLinkListPage —— 直链管理列表
 * 设计规范：对齐「我的分享」列表页骨架（G 设计风格）
 * - 标题 + 副标题
 * - 统计（直链总数/启用中）
 * - BaseTable（文件名/token/状态/创建时间/操作：复制/启停/删除）
 */
import { computed, onMounted, ref } from 'vue'
import { Link as LinkIcon, X, Copy, Power } from '@lucide/vue'
import directLinkService, { type IDirectLinkVO } from '@/api/direct-link'
import { buildDirectLinkUrl } from '@/utils/direct-link'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'

const tableData = ref<IDirectLinkVO[]>([])
const selected = ref<(string | number)[]>([])
const tableLoading = ref(true)

// 列字段与后端 XPanDirectLinkVO 契约对齐
const columns: { key: string; title: string; width: string | number; align?: 'left' | 'right' | 'center' }[] = [
  { key: 'filename', title: '文件名', width: 'auto' },
  { key: 'token', title: 'Token', width: 160, align: 'center' },
  { key: 'enableFlag', title: '状态', width: 100, align: 'center' },
  { key: 'createTime', title: '创建时间', width: 160, align: 'center' },
  { key: 'actions', title: '操作', width: 160, align: 'right' }
]

function loadTableData() {
  tableLoading.value = true
  directLinkService.list(
    (res) => {
      tableLoading.value = false
      tableData.value = res.code === 0 && res.data ? res.data : []
    },
    (res) => {
      tableLoading.value = false
      tableData.value = []
      ElMessage.error(res.message)
    }
  )
}

function linkUrl(row: Partial<IDirectLinkVO>) {
  // 直链是后端端点：必须带 API 前缀（nginx/dev 只反代 /api/），终审 Important 1 修复
  return buildDirectLinkUrl(String(row.token || ''))
}

function copyLink(row: Partial<IDirectLinkVO>) {
  const url = linkUrl(row)
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(() => ElMessage.success('直链已复制')).catch(() => fallbackCopy(url))
  } else {
    fallbackCopy(url)
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
    ElMessage.success('直链已复制')
  } catch {
    ElMessage.error('复制失败，请手动选择')
  } finally {
    document.body.removeChild(ta)
  }
}

function toggleLink(row: IDirectLinkVO) {
  const target = row.enableFlag === 1 ? 0 : 1
  directLinkService.toggle(
    row.id,
    target,
    () => {
      ElMessage.success(target === 1 ? '已启用' : '已停用')
      loadTableData()
    },
    (res) => ElMessage.error(res.message)
  )
}

function doDeleteLink(id: string) {
  ElMessageBox.confirm('确定删除该直链?删除后链接立即失效', '删除直链', {
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then((ok) => {
      if (!ok) return
      directLinkService.remove(
        id,
        () => {
          ElMessage.success('删除成功')
          selected.value = []
          loadTableData()
        },
        (res) => ElMessage.error(res.message)
      )
    })
    .catch(() => {})
}

function deleteLink(row: Partial<IDirectLinkVO>) {
  if (!row.id) return
  doDeleteLink(row.id)
}

function deleteSelected() {
  if (selected.value.length === 0) return ElMessage.error('请选择要删除的直链')
  const ids = selected.value.filter(Boolean) as string[]
  ElMessageBox.confirm(`确定删除选中的 ${ids.length} 条直链?删除后链接立即失效`, '批量删除', {
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then((ok) => {
      if (!ok) return
      Promise.all(
        ids.map(
          (id) =>
            new Promise<void>((resolve) => {
              directLinkService.remove(id, () => resolve(), () => resolve())
            })
        )
      ).then(() => {
        ElMessage.success('批量删除完成')
        selected.value = []
        loadTableData()
      })
    })
    .catch(() => {})
}

onMounted(loadTableData)

const summary = computed(() => {
  const rows = tableData.value
  return {
    total: rows.length,
    enabled: rows.filter((r) => r.enableFlag === 1).length
  }
})

function formatCreateTime(row: Partial<IDirectLinkVO>) {
  return row.createTime ? String(row.createTime).split(' ')[0] : '—'
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 页面标题 -->
    <div class="flex items-center gap-3">
      <h1 class="text-2xl font-semibold tracking-tight text-(--color-text)">直链管理</h1>
      <span class="text-sm" style="color: var(--color-text-muted)">
        管理免登录下载直链
      </span>
    </div>

    <!-- 统计 -->
    <div class="grid grid-cols-2 gap-4">
      <div
        class="rounded-xl border border-(--color-border) p-4 bg-(--color-surface-container-low)"
      >
        <div class="text-xs mb-1" style="color: var(--color-text-muted)">直链总数</div>
        <div class="text-2xl font-bold tabular-nums text-(--color-text)">{{ summary.total }}</div>
      </div>
      <div
        class="rounded-xl border border-(--color-border) p-4 bg-(--color-surface-container-low)"
      >
        <div class="text-xs mb-1" style="color: var(--color-text-muted)">启用中</div>
        <div class="text-2xl font-bold tabular-nums" style="color: var(--color-success)">
          {{ summary.enabled }}
        </div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="flex items-center justify-end">
      <BaseButton variant="danger" size="sm" :disabled="selected.length === 0" @click="deleteSelected">
        <template #default>
          <span class="inline-flex items-center gap-1.5">
            <X :size="14" :stroke-width="2" />
            批量删除
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
      row-key="id"
      empty-text="还没有创建过直链（在文件列表点「直链」即可创建）"
      @update:selected="(v) => (selected = v)"
    >
      <template #cell-filename="{ row }">
        <div class="flex items-center gap-3">
          <LinkIcon :size="18" :stroke-width="2" class="shrink-0" style="color: var(--color-primary-500)" />
          <span class="truncate text-(--color-text)">{{ row.filename || '未命名' }}</span>
        </div>
      </template>

      <template #cell-token="{ row }">
        <span class="font-mono tabular-nums text-xs tracking-wider text-(--color-text-muted)">
          {{ String(row.token || '').slice(0, 12) }}…
        </span>
      </template>

      <template #cell-enableFlag="{ row }">
        <BaseBadge :variant="row.enableFlag === 1 ? 'success' : 'neutral'">
          {{ row.enableFlag === 1 ? '启用中' : '已停用' }}
        </BaseBadge>
      </template>

      <template #cell-createTime="{ row }">
        <span class="tabular-nums text-sm" style="color: var(--color-text-muted)">
          {{ formatCreateTime(row) }}
        </span>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center gap-1 justify-end transition-opacity opacity-0 group-hover:opacity-100">
          <BaseTooltip text="复制直链" position="top">
            <BaseButton variant="secondary" size="sm" @click="copyLink(row)">
              <Copy :size="14" :stroke-width="2" />
            </BaseButton>
          </BaseTooltip>
          <BaseTooltip :text="row.enableFlag === 1 ? '停用' : '启用'" position="top">
            <BaseButton variant="secondary" size="sm" @click="toggleLink(row as IDirectLinkVO)">
              <Power :size="14" :stroke-width="2" />
            </BaseButton>
          </BaseTooltip>
          <BaseTooltip text="删除" position="top">
            <BaseButton variant="danger" size="sm" @click="deleteLink(row)">
              <X :size="14" :stroke-width="2" />
            </BaseButton>
          </BaseTooltip>
        </div>
      </template>
    </BaseTable>
  </div>
</template>
