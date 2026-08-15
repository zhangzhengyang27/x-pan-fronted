<script setup lang="ts">
/**
 * FavoriteListPage —— 我的收藏（对接后端 P4 /favorite/list）
 * 表格展示收藏文件，支持取消收藏、打开（文件夹进入 / 文件预览）
 */
import { onMounted, ref } from 'vue'
import {
  Star,
  Folder,
  FileText,
  FileArchive,
  FileSpreadsheet,
  FileImage,
  FileAudio,
  FileVideo,
  FileCode,
  FileBarChart2,
  RotateCcw,
  Image as ImageIcon
} from '@lucide/vue'
import { useFavorites } from '@/composables/useFavorites'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import { useRouter } from 'vue-router'
import { getDownloadUrl } from '@/utils/preview'
import { useDrivePreview } from '@/composables/useDrivePreview'
import DrivePreviewModal from '@/components/preview/drive-preview-modal.vue'

const router = useRouter()
const { favorites, toggle, refresh } = useFavorites()

// ─── 文件预览（统一走 DrivePreviewModal 弹窗，与 /files 页一致） ────────────
const preview = useDrivePreview(() => favorites.value as any[])
const { state: previewState, openPreview, closePreview, resolvePreviewUrl: resolvePreviewUrlItem } = preview

function previewDownload(item: Record<string, any>) {
  window.open(getDownloadUrl(item.fileId || item.id), '_blank')
}

const selected = ref<string[]>([])
const tableLoading = ref(true)

const columns = [
  { key: 'filename', title: '文件名', width: 'auto' },
  { key: 'fileSizeDesc', title: '大小', width: 110, align: 'right' },
  { key: 'fileType', title: '类型', width: 96, align: 'center' },
  { key: 'addedAt', title: '收藏时间', width: 172, align: 'center' },
  { key: 'actions', title: '操作', width: 120, align: 'right' }
]

function fileIcon(type: number) {
  return (
    {
      0: Folder,
      2: FileArchive,
      3: FileSpreadsheet,
      4: FileText,
      5: FileText,
      6: FileText,
      7: FileImage,
      8: FileAudio,
      9: FileVideo,
      10: FileBarChart2,
      11: FileCode,
      12: FileSpreadsheet
    }[type] || FileText
  )
}

function typeLabel(type: number) {
  if (type === 0) return '文件夹'
  if (type === 7) return '图片'
  if (type === 9) return '视频'
  if (type === 8) return '音频'
  if (type === 11) return '代码'
  if ([3, 4, 5, 6, 10, 12].includes(type)) return '文档'
  return '其他'
}

function formatDateTime(d: string | undefined) {
  if (!d) return '-'
  const date = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function openFile(row: any) {
  if (row.fileType === 0) {
    router.push({ path: '/files', query: { dir: row.fileId } })
    return
  }
  // 统一走内嵌预览弹窗（与 /files 页一致）
  const opened = openPreview({
    fileId: row.fileId,
    id: row.fileId,
    name: row.filename,
    filename: row.filename,
    fileType: row.fileType
  })
  if (!opened) ElMessage.info('该类型暂不支持预览')
}

function onToggleFavorite(row: any) {
  toggle(row)
  ElMessage.success('已取消收藏')
}

function loadTableData() {
  tableLoading.value = true
  refresh()
  tableLoading.value = false
}

onMounted(loadTableData)
</script>

<template>
  <div class="flex flex-col gap-3 px-4 py-3 h-full">
    <!-- 顶行：标题 + 统计 -->
    <div class="flex items-center justify-between gap-3 min-w-0">
      <div class="flex items-center gap-2 min-w-0">
        <Star :size="16" class="text-amber-400" />
        <span class="text-sm font-medium text-(--color-text)">我的收藏</span>
        <span v-if="favorites.length > 0" class="quark-badge text-[11px]">{{ favorites.length }} 项</span>
      </div>
      <BaseButton variant="ghost" size="sm" @click="loadTableData">
        <RotateCcw :size="14" :stroke-width="2" />
        刷新
      </BaseButton>
    </div>

    <!-- 表格 -->
    <div class="flex-1 min-h-0 overflow-y-auto -mx-4 px-4">
      <BaseTable
        :columns="columns"
        :data="favorites"
        :loading="tableLoading"
        :selected="selected"
        selectable
        row-key="fileId"
        empty-text="还没有收藏任何文件"
        @update:selected="(v) => (selected = v)"
      >
        <template #cell-filename="{ row }">
          <button type="button" class="flex items-center gap-2 group" @click="openFile(row)">
            <component
              :is="fileIcon(row.fileType)"
              :size="18"
              :stroke-width="1.75"
              class="shrink-0 text-(--color-text-secondary)"
            />
            <span class="truncate text-sm text-(--color-text) group-hover:text-primary-600">{{ row.filename }}</span>
          </button>
        </template>

        <template #cell-fileSizeDesc="{ row }">
          <span class="text-xs tabular-nums text-(--color-text-secondary)">
            {{ row.fileSizeDesc || '-' }}
          </span>
        </template>

        <template #cell-fileType="{ row }">
          <span
            class="inline-flex items-center px-2 h-6 rounded-full text-[11px] font-medium"
            style="background-color: var(--color-surface-2); color: var(--color-text-secondary);"
          >
            {{ typeLabel(row.fileType) }}
          </span>
        </template>

        <template #cell-addedAt="{ row }">
          <span class="text-xs tabular-nums text-(--color-text-secondary)">
            {{ formatDateTime(row.addedAt) }}
          </span>
        </template>

        <template #cell-actions="{ row }">
          <div class="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <BaseTooltip text="取消收藏">
              <BaseButton variant="ghost" size="sm" @click="onToggleFavorite(row)">
                <Star :size="14" :stroke-width="2" class="text-amber-400" />
              </BaseButton>
            </BaseTooltip>
          </div>
        </template>
      </BaseTable>
    </div>

    <!-- 统一预览弹窗（与 /files 页一致，替代新开页面） -->
    <DrivePreviewModal
      :state="previewState"
      :resolve-url="resolvePreviewUrlItem"
      @close="closePreview"
      @download="previewDownload"
    />
  </div>
</template>
