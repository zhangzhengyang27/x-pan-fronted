<script setup lang="ts">
/**
 * TransferButton —— 移动文件
 * 1:1 复现 html5-examples MoveDialog
 * 使用 FolderTreeSelector（带根目录）
 */
import { ref } from 'vue'
import { Move } from '@lucide/vue'
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
    ElMessage.error('请选择要移动的文件')
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
    ElMessage.error('没有可移动的文件')
    return
  }

  loading.value = true
  fileService
    .transfer({
      fileIds,
      targetParentId: targetId || ''
    })
    .then(() => {
      loading.value = false
      dialogVisible.value = false
      ElMessage.success('文件移动成功')
      fileStore.loadFileList()
    })
    .catch((err) => {
      loading.value = false
      ElMessage.error(err.message)
    })
}
</script>

<template>
  <div class="inline-block mr-2.5">
    <BaseButton v-if="roundFlag" :size="size === 'small' ? 'sm' : 'md'" :icon="Move" @click="open">
      移动到
    </BaseButton>
    <BaseButton
      v-else-if="circleFlag"
      :size="size === 'small' ? 'sm' : 'md'"
      :icon="Move"
      @click="open"
    />
    <BaseButton v-else :size="size === 'small' ? 'sm' : 'md'" :icon="Move" @click="open">
      移动
    </BaseButton>

    <FolderTreeSelector
      v-model:open="dialogVisible"
      title="选择目标文件夹"
      confirm-text="移动到此处"
      :exclude-ids="item ? [item.fileId] : multipleSelection.map((s) => s.fileId)"
      @confirm="onConfirm"
    />
  </div>
</template>
