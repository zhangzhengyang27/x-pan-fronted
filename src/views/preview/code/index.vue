<script setup lang="ts">
/**
 * PreviewCode —— 代码预览（Shiki 高亮）
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileCode, Download } from '@lucide/vue'
import { getDownloadUrl } from '@/utils/preview'
import BaseButton from '@/components/base/BaseButton.vue'
import CodePreviewer from '@/components/preview/code-previewer.vue'

const route = useRoute()
const fileId = computed(() => route.params.fileId)
const filename = computed(() => route.query.filename || 'code')
const downloadUrl = computed(() => getDownloadUrl(fileId.value))
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[var(--color-bg)]">
    <header
      class="h-14 px-6 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div class="flex items-center gap-2 min-w-0">
        <FileCode :size="20" class="text-[var(--color-primary-600)] shrink-0" />
        <h1 class="text-base font-medium truncate">{{ filename }}</h1>
      </div>
      <a :href="downloadUrl" target="_blank">
        <BaseButton variant="ghost" size="sm">
          <span class="inline-flex items-center gap-1.5">
            <Download :size="14" />
            下载
          </span>
        </BaseButton>
      </a>
    </header>
    <main class="flex-1 min-h-0">
      <CodePreviewer :file-id="fileId" :filename="filename" />
    </main>
  </div>
</template>
