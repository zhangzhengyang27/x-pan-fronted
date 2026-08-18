<script setup lang="ts">
/**
 * CopyButton —— 复制文件
 * 1:1 复现 html5-examples MoveDialog (copy 模式)
 * 使用 FolderTreeSelector（带根目录）
 */
import { ref } from 'vue'
import { Copy } from '@lucide/vue'
import fileService from '@/api/file'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'
import { ElMessage } from '@/composables/useToast'
import FolderTreeSelector from '@/components/common/FolderTreeSelector.vue'
import BaseButton from '@/components/base/BaseButton.vue'

const props = defineProps({
  roundFlag: Boolean,
  circleFlag: Boolean,
  size: String,
  item: Object
})

const fileStore = useFileStore()
const { multipleSelection } = storeToRefs(fileStore)

const dialogVisible = ref(false)
const loading = ref(false)

function open() {
  if (!props.item && (!multipleSelection.value || multipleSelection.value.length === 0)) {
    ElMessage.error('请选择要复制的文件')
    return
  }
  dialogVisible.value = true
}

function collectFileIds() {
  if (props.item) return [props.item.fileId]
  return multipleSelection.value.map((f) => f.fileId)
}

function onConfirm({ targetId }) {
  const fileIds = collectFileIds()
  if (fileIds.length === 0) {
    ElMessage.error('没有可复制的文件')
    return
  }

  loading.value = true
  fileService.copy(
    {
      fileIds,
      targetParentId: targetId || ''
    },
    () => {
      loading.value = false
      dialogVisible.value = false
      ElMessage.success('文件复制成功')
      fileStore.loadFileList()
    },
    (err) => {
      loading.value = false
      ElMessage.error(err.message)
    }
  )
}
</script>

<template>
  <div class="inline-block mr-2.5">
    <BaseButton v-if="roundFlag" :size="size === 'small' ? 'sm' : 'md'" :icon="Copy" @click="open">
      复制到
    </BaseButton>
    <BaseButton
      v-else-if="circleFlag"
      :size="size === 'small' ? 'sm' : 'md'"
      :icon="Copy"
      @click="open"
    />
    <BaseButton v-else :size="size === 'small' ? 'sm' : 'md'" :icon="Copy" @click="open">
      复制
    </BaseButton>

    <FolderTreeSelector
      v-model:open="dialogVisible"
      title="选择目标文件夹"
      confirm-text="复制到此处"
      @confirm="onConfirm"
    />
  </div>
</template>
