<script setup>
/**
 * PreviewVideo —— 视频预览页
 */
import {onMounted, ref} from 'vue'
import {useRoute} from 'vue-router'
import {Film, Download} from '@lucide/vue'
import panUtil from '@/utils/common'
import {ElMessage} from '@/composables/useToast'
import BaseButton from '@/components/base/BaseButton.vue'

const route = useRoute()
const src = ref('')

onMounted(() => {
  src.value = panUtil.getPreviewUrl(route.params.fileId)
})

function download() {
  window.open(src.value, '_blank')
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-black text-white">
    <header class="h-14 px-6 flex items-center justify-between border-b border-white/10 bg-black/60 backdrop-blur">
      <div class="flex items-center gap-2">
        <Film :size="20" class="text-[var(--color-primary-400)]"/>
        <h1 class="text-base font-medium">视频预览</h1>
      </div>
      <BaseButton variant="ghost" size="sm" class="text-white hover:bg-white/10" @click="download">
        <span class="inline-flex items-center gap-1.5"><Download :size="14"/>下载</span>
      </BaseButton>
    </header>

    <div class="flex-1 flex items-center justify-center p-6">
      <video :src="src" controls autoplay class="max-w-full max-h-full rounded-xl shadow-2xl"/>
    </div>
  </div>
</template>