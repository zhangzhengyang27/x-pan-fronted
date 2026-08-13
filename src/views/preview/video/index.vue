<script setup lang="ts">
/**
 * PreviewVideo —— 视频预览（ArtPlayer）
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Film, Download } from '@lucide/vue'
import { getDownloadUrl, resolvePreviewUrl } from '@/utils/preview'
import BaseButton from '@/components/base/BaseButton.vue'
import VideoPreviewer from '@/components/preview/video-previewer.vue'

const route = useRoute()
const fileId = computed(() => route.params.fileId)
const filename = computed(() => route.query.filename || 'video')
const downloadUrl = computed(() => getDownloadUrl(fileId.value))

// 统一走签名 URL（与 DrivePreviewModal 一致），避免长期 token 进 URL
const previewUrl = ref('')
watch(
  fileId,
  (id) => {
    previewUrl.value = ''
    if (id) resolvePreviewUrl(id).then((u) => (previewUrl.value = u)).catch(() => {})
  },
  { immediate: true }
)
</script>

<template>
  <div class="min-h-screen flex flex-col bg-black">
    <header
      class="h-14 px-6 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur"
    >
      <div class="flex items-center gap-2 min-w-0 text-white">
        <Film :size="20" class="text-primary-400 shrink-0" />
        <h1 class="text-base font-medium truncate">{{ filename }}</h1>
      </div>
      <a :href="downloadUrl" target="_blank">
        <BaseButton variant="ghost" size="sm" class="text-white hover:bg-white/10">
          <span class="inline-flex items-center gap-1.5">
            <Download :size="14" />
            下载
          </span>
        </BaseButton>
      </a>
    </header>
    <main class="flex-1 min-h-0 flex items-center justify-center p-4">
      <div class="w-full max-w-5xl">
        <div class="aspect-video w-full bg-black rounded-lg overflow-hidden">
          <VideoPreviewer :url="previewUrl || undefined" :file-id="fileId" :title="filename" class="h-full w-full" />
        </div>
      </div>
    </main>
  </div>
</template>
