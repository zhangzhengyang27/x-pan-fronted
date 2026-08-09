<script setup>
/**
 * UploadButton —— 触发文件上传（仅打开文件选择器，逻辑在 useUploader）
 * 按钮 UI 走 Tailwind + BaseButton 风格（替换原 el-button）
 */
import {ref} from 'vue'
import {Upload} from '@lucide/vue'
import {useUploader} from '@/composables/useUploader'
import BaseButton from '@/components/base/BaseButton.vue'

const props = defineProps({
  size: {type: String, default: 'md'},
})

const fileInputRef = ref(null)
const {addFiles} = useUploader()

function triggerPicker() {
  fileInputRef.value?.click()
}

function onChange(e) {
  const files = e.target.files
  if (files?.length) addFiles(files)
  e.target.value = '' // 允许同名重选
}

defineExpose({triggerPicker})
</script>

<template>
  <div class="inline-block">
    <BaseButton variant="primary" :size="props.size" @click="triggerPicker">
      <span class="inline-flex items-center gap-1.5">
        <Upload :size="14"/>
        上传
      </span>
    </BaseButton>
    <input
      ref="fileInputRef"
      type="file"
      multiple
      class="hidden"
      @change="onChange"
    />
  </div>
</template>