<script setup lang="ts">
/**
 * UploadButton —— 触发文件上传
 * 原生 button + 隐藏 file input，最通用兼容模式
 */
import { ref } from 'vue'
import { Upload } from '@lucide/vue'
import { useUploader } from '@/composables/useUploader'

withDefaults(defineProps<{ size?: string }>(), { size: 'default' })

const fileInputRef = ref<HTMLInputElement | null>(null)
const { addFiles } = useUploader()

function onChange(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files?.length) addFiles(files)
  target.value = ''
}

function triggerPicker() {
  fileInputRef.value?.click()
}

defineExpose({ triggerPicker })
</script>

<template>
  <div class="inline-block relative">
    <button
      type="button"
      class="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-sm text-sm font-medium cursor-pointer select-none whitespace-nowrap bg-[var(--color-primary-500)] text-white border border-transparent hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-1"
      @click="triggerPicker"
    >
      <Upload :size="14" :stroke-width="2" />
      上传
    </button>
    <input
      ref="fileInputRef"
      type="file"
      multiple
      class="absolute opacity-0 w-px h-px -z-10"
      aria-hidden="true"
      tabindex="-1"
      @change="onChange"
    />
  </div>
</template>
