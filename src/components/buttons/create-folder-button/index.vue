<template>
  <div class="create-folder-button-content">
    <BaseButton
      v-if="showRound"
      variant="secondary"
      :size="btnSize"
      class="rounded-full !bg-[var(--color-success)] !text-white !border-transparent hover:!opacity-90"
      @click="createFolderDialogVisible = true"
    >
      <span class="inline-flex items-center gap-1.5">
        新建文件夹
        <FolderPlus :size="14" />
      </span>
    </BaseButton>
    <BaseButton
      v-if="circleFlag"
      variant="secondary"
      :size="btnSize"
      class="rounded-full !px-0 !w-8 !h-8 justify-center !bg-[var(--color-success)] !text-white !border-transparent hover:!opacity-90"
      @click="createFolderDialogVisible = true"
    >
      <FolderPlus :size="14" />
    </BaseButton>

    <BaseModal v-model:open="createFolderDialogVisible" title="新建文件夹" @close="resetForm">
      <BaseField label="文件夹名称" :required="true" :error="folderNameError">
        <BaseInput
          id="createFolderName"
          v-model="createFolderForm.folderName"
          placeholder="请输入文件夹名称"
          @enter="doCreateFolder"
        />
      </BaseField>
      <template #footer>
        <span class="dialog-footer flex items-center justify-end gap-2">
          <BaseButton variant="secondary" size="sm" @click="createFolderDialogVisible = false">
            取 消
          </BaseButton>
          <BaseButton variant="primary" size="sm" :loading="loading" @click="doCreateFolder">
            确 定
          </BaseButton>
        </span>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  roundFlag: Boolean,
  circleFlag: Boolean,
  size: String
})

import { computed, reactive, ref, watch, nextTick } from 'vue'
import { FolderPlus } from '@lucide/vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseField from '@/components/base/BaseField.vue'
import fileService from '@/api/file'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'
import { ElMessage } from '@/composables/useToast'

const btnSize = computed(() => (props.size === 'small' ? 'sm' : 'md'))

// 显式传 circleFlag=true 时走圆形变体；否则默认显示带文字的圆角变体
// （修复 FileButtonGroup 未传 roundFlag 导致按钮不显示的问题）
const showRound = computed(() => !props.circleFlag || props.roundFlag)

const fileStore = useFileStore()
const { paramParentId } = storeToRefs(fileStore)

const createFolderDialogVisible = ref(false)
const loading = ref(false)
const folderNameError = ref('')

const createFolderForm = reactive({
  folderName: ''
})

const resetForm = () => {
  createFolderForm.folderName = ''
  folderNameError.value = ''
}

// BaseModal 打开后聚焦输入框
watch(
  () => createFolderDialogVisible.value,
  (v) => {
    if (v) {
      nextTick(() => document.getElementById('createFolderName')?.focus())
    }
  }
)

const doCreateFolder = async () => {
  if (!createFolderForm.folderName.trim()) {
    folderNameError.value = '请输入文件夹名称'
    return
  }
  folderNameError.value = ''
  loading.value = true
  fileService.createFolder(
    {
      parentId: paramParentId.value,
      folderName: createFolderForm.folderName
    },
    () => {
      loading.value = false
      createFolderDialogVisible.value = false
      ElMessage.success('新建成功')
      fileStore.loadFileList()
    },
    (res) => {
      ElMessage.error(res.message)
      loading.value = false
    }
  )
}
</script>

<style scoped>
.create-folder-button-content {
  display: inline-block;
  margin-right: 10px;
}
.dialog-footer {
  width: 100%;
}
</style>
