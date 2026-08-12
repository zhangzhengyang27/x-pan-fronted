<script setup lang="ts">
/**
 * UploadButton —— 触发文件上传（夸克蓝色风格）
 */
import { ref, computed } from 'vue'
import { Upload } from '@lucide/vue'
import { useUploader } from '@/composables/useUploader'
import BaseButton from '@/components/base/BaseButton.vue'

const props = defineProps({
  size: { type: String, default: 'sm' }
})

const btnSize = computed(() => (props.size === 'small' ? 'sm' : 'md'))

const fileInputRef = ref(null)
const { addFiles } = useUploader()

function triggerPicker() {
  fileInputRef.value?.click()
}

function onChange(e) {
  const files = e.target.files
  if (files?.length) addFiles(files)
  e.target.value = ''
}

defineExpose({ triggerPicker })
</script>

<template>
  <div class="inline-block">
    <BaseButton
      variant="secondary"
      :size="btnSize"
      class="rounded-sm !bg-[var(--color-primary-500)] !text-white !border-transparent hover:!opacity-90 transition-opacity"
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
