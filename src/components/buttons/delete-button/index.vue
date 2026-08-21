<script setup lang="ts">
/**
 * DeleteButton —— 删除文件（带危险确认）
 */
import { Trash2 } from '@lucide/vue'
import fileService from '@/api/file'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from '@/composables/useToast'

const props = defineProps({
  size: { type: String, default: 'sm' },
  /** 单个文件对象、对象数组、或 null（为空时回退到 store 多选） */
  item: { type: [Object, Array] as any, default: null }
})

const fileStore = useFileStore()
const { multipleSelection } = storeToRefs(fileStore)

async function doDelete(fileIds: string[]) {
  // 注意：ElMessageBox.confirm 是 Promise<boolean>，永不 reject，只 resolve(true/false)
  // ——所以原 try/catch 永远进不去，删除会在用户"取消"时仍然执行。这是历史 bug，已修复。
  let ok = false
  try {
    ok = await ElMessageBox.confirm(
      '文件删除后将保存在回收站，您可以随时恢复，是否继续？',
      '删除文件',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'danger'
      }
    )
  } catch {
    return
  }
  if (!ok) return // 用户取消
  fileService.delete(
    { fileIds },
    () => {
      ElMessage.success('删除成功')
      fileStore.loadFileList()
    },
    (err) => ElMessage.error(err.message)
  )
}

function onClick() {
  // 优先取 props.item（数组/单对象），否则回退 store 多选
  let rows: any[] = []
  if (Array.isArray(props.item)) rows = props.item
  else if (props.item && typeof props.item === 'object') rows = [props.item]
  else if (multipleSelection.value?.length > 0) rows = multipleSelection.value
  if (!rows.length) {
    ElMessage.error('请选择要删除的文件')
    return
  }
  const ids = rows.map((i) => i.fileId).filter(Boolean) as string[]
  if (!ids.length) {
    ElMessage.error('请选择要删除的文件')
    return
  }
  doDelete(ids)
}
</script>

<template>
  <!-- 使用原生 button，确保点击事件一定触发（排查"点击无反应"） -->
  <button
    type="button"
    class="inline-flex items-center justify-center font-medium select-none whitespace-nowrap transition-all duration-100 gap-1.5 rounded-sm border border-(--color-border) bg-(--color-surface) text-(--color-text) hover:bg-(--color-surface-2) disabled:opacity-45 disabled:cursor-not-allowed"
    :class="props.size === 'small' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm'"
    @click="onClick"
  >
    <Trash2 :size="14" />
    删除
  </button>
</template>
