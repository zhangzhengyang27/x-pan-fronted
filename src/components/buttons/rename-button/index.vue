<template>
  <div class="rename-button-content">
    <BaseButton
      v-if="roundFlag"
      variant="secondary"
      :size="btnSize"
      class="rounded-full !bg-warning !text-white !border-transparent hover:!opacity-90"
      @click="renameFile"
    >
      <span class="inline-flex items-center gap-1.5">
        重命名
        <SquarePen :size="14" />
      </span>
    </BaseButton>
    <BaseButton
      v-if="circleFlag"
      variant="secondary"
      :size="btnSize"
      class="rounded-full !px-0 !w-8 !h-8 justify-center !bg-warning !text-white !border-transparent hover:!opacity-90"
      @click="renameFile"
    >
      <SquarePen :size="14" />
    </BaseButton>

    <BaseModal v-model:open="renameDialogVisible" title="文件重命名" @close="resetForm">
      <BaseField label="文件名称" :required="true" :error="filenameError">
        <BaseInput
          id="renameFilename"
          v-model="renameForm.filename"
          placeholder="请输入新文件名称"
          @enter="doRenameFile"
        />
      </BaseField>
      <template #footer>
        <span class="dialog-footer flex items-center justify-end gap-2">
          <BaseButton variant="secondary" size="sm" @click="renameDialogVisible = false">
            取 消
          </BaseButton>
          <BaseButton variant="primary" size="sm" :loading="loading" @click="doRenameFile">
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
  size: String,
  item: Object
})

import { computed, reactive, ref, watch, nextTick } from 'vue'
import { SquarePen } from '@lucide/vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseField from '@/components/base/BaseField.vue'
import fileService from '@/api/file'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'
import { ElMessage } from '@/composables/useToast'

const btnSize = computed(() => (props.size === 'small' ? 'sm' : 'md'))

const renameDialogVisible = ref(false)
const loading = ref(false)
const filenameError = ref('')

const fileStore = useFileStore()
const { multipleSelection } = storeToRefs(fileStore)

const renameForm = reactive({
  fileId: '',
  filename: ''
})

const resetForm = () => {
  renameForm.filename = ''
  filenameError.value = ''
}

watch(
  () => renameDialogVisible.value,
  (v) => {
    if (v) {
      nextTick(() => document.getElementById('renameFilename')?.focus())
    }
  }
)

const renameFile = () => {
  if (props.item) {
    renameForm.fileId = props.item.fileId
    renameForm.filename = props.item.filename
    renameDialogVisible.value = true
    return
  }
  if (!multipleSelection.value || multipleSelection.value.length == 0) {
    ElMessage.error('请选择要重命名的文件')
    return
  }
  if (multipleSelection.value.length > 1) {
    ElMessage.error('请选择一个文件进行重命名')
    return
  }
  let item = multipleSelection.value[0]
  renameForm.fileId = item.fileId
  renameForm.filename = item.filename
  renameDialogVisible.value = true
}

const doRenameFile = async () => {
  if (!renameForm.filename.trim()) {
    filenameError.value = '请输入新文件名称'
    return
  }
  filenameError.value = ''
  loading.value = true
  fileService.update(
    {
      fileId: renameForm.fileId,
      filename: renameForm.filename
    },
    () => {
      loading.value = false
      renameDialogVisible.value = false
      ElMessage.success('重命名成功')
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
.rename-button-content {
  display: inline-block;
  margin-right: 10px;
}
.dialog-footer {
  width: 100%;
}
</style>
