<script setup lang="ts">
/**
 * UploadButton —— 触发文件上传（仅打开文件选择器，逻辑在 useUploader）
 * 按钮 UI 与 CreateFolderButton 保持一致的绿色胶囊风格
 */
import { ref, computed } from 'vue'
import { Upload } from '@lucide/vue'
import { useUploader } from '@/composables/useUploader'
import BaseButton from '@/components/base/BaseButton.vue'

const props = defineProps({
  size: { type: String, default: 'sm' }
})

// FileButtonGroup 传 size="default"，需映射为 BaseButton 支持的尺寸
const btnSize = computed(() => (props.size === 'small' ? 'sm' : 'md'))

const fileInputRef = ref(null)
const { addFiles } = useUploader()

function triggerPicker() {
  fileInputRef.value?.click()
}

function onChange(e) {
  const files = e.target.files
  if (files?.length) addFiles(files)
  e.target.value = '' // 允许同名重选
}

defineExpose({ triggerPicker })
</script>

<template>
  <div class="inline-block">
    <BaseButton
      variant="secondary"
      :size="btnSize"
      class="rounded-full !bg-[var(--color-success)] !text-white !border-transparent hover:!opacity-90"
      @click="triggerPicker"
    >
      <span class="inline-flex items-center gap-1.5">
        <Upload :size="14" />
        上传
      </span>
    </BaseButton>
    <input ref="fileInputRef" type="file" multiple class="hidden" @change="onChange" />
  </div>
</template>
