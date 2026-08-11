<script setup lang="ts">
/**
 * DeleteButton —— 删除文件（带危险确认）
 */
import { Trash2 } from '@lucide/vue'
import fileService from '@/api/file'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import BaseButton from '@/components/base/BaseButton.vue'

const props = defineProps({
  size: { type: String, default: 'md' },
  item: { type: Object, default: null }
})

const fileStore = useFileStore()
const { multipleSelection } = storeToRefs(fileStore)

async function doDelete(fileIds) {
  try {
    await ElMessageBox.confirm('文件删除后将保存在回收站，您可以随时恢复，是否继续？', '删除文件', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'danger'
    })
  } catch {
    return // cancel
  }
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
  if (props.item) {
    doDelete(props.item.fileId)
    return
  }
  if (multipleSelection.value?.length > 0) {
    const ids = multipleSelection.value.map((i) => i.fileId).join('__,__')
    doDelete(ids)
    return
  }
  ElMessage.error('请选择要删除的文件')
}
</script>

<template>
  <BaseButton variant="danger" :size="props.size" @click="onClick">
    <span class="inline-flex items-center gap-1.5">
      <Trash2 :size="14" />
      删除
    </span>
  </BaseButton>
</template>
