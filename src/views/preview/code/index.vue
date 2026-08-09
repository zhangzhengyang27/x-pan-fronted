<script setup>
/**
 * PreviewCode —— 代码预览（M7 简化版）
 * 后续可替换为 highlight.js / shiki
 */
import {computed, onMounted, ref} from 'vue'
import {useRoute} from 'vue-router'
import {FileCode, Download, Copy} from '@lucide/vue'
import fileService from '@/api/file'
import panUtil from '@/utils/common'
import {ElMessage} from '@/composables/useToast'
import BaseButton from '@/components/base/BaseButton.vue'

const route = useRoute()
const content = ref('')
const filename = ref(route.query.filename || '')

onMounted(() => {
  fileService.previewCode(
    {fileId: panUtil.handleId(route.params.fileId)},
    (res) => {
      content.value = res.data || ''
    },
    (res) => ElMessage.error(res.message),
  )
})

const lines = computed(() => content.value.split('\n'))

async function copyAll() {
  await navigator.clipboard.writeText(content.value)
  ElMessage.success('已复制')
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#0b0d10] text-[#e6e8eb]">
    <header class="h-14 px-6 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur">
      <div class="flex items-center gap-2">
        <FileCode :size="20" class="text-[var(--color-primary-400)]"/>
        <h1 class="text-base font-medium">{{ filename || '代码预览' }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <BaseButton variant="ghost" size="sm" class="text-white hover:bg-white/10" @click="copyAll">
          <span class="inline-flex items-center gap-1.5"><Copy :size="14"/>复制</span>
        </BaseButton>
      </div>
    </header>
    <div class="flex-1 overflow-auto">
      <pre class="font-mono text-sm leading-relaxed p-6 m-0"><code><span
        v-for="(line, i) in lines"
        :key="i"
        class="block whitespace-pre"
      ><span class="inline-block w-10 text-right pr-3 text-white/30 select-none">{{ i + 1 }}</span>{{ line }}</span></code></pre>
    </div>
  </div>
</template>