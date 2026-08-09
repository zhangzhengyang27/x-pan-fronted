<script setup>
/**
 * RecycleListPage —— 回收站
 */
import {onMounted, ref} from 'vue'
import {RefreshCw, Trash2, Folder, FileText, FileArchive, FileSpreadsheet, FileImage, FileAudio, FileVideo, FileCode, FileBarChart2} from '@lucide/vue'
import recycleService from '@/api/recycle'
import {ElMessage, ElMessageBox} from '@/composables/useToast'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'

const tableData = ref([])
const selected = ref([])
const tableLoading = ref(true)

const columns = [
  {key: 'filename', title: '文件名', width: 'auto'},
  {key: 'fileSizeDesc', title: '大小', width: 120, align: 'right'},
  {key: 'updateTime', title: '删除日期', width: 200, align: 'center'},
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

onMounted(loadTableData)
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between py-3">
      <BaseButton variant="primary" @click="restoreRecycle">
        <span class="flex items-center gap-2"><RefreshCw :size="16"/> 还原</span>
      </BaseButton>
      <BaseButton variant="danger" @click="cleanRecycle">
        <span class="flex items-center gap-2"><Trash2 :size="16"/> 清空回收站</span>
      </BaseButton>
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