<script setup>
/**
 * PreviewOffice —— Office 文档预览
 *
 * 后端无 Office 转 PDF 服务，前端无 LibreOffice → 无法纯前端渲染 docx/xlsx/pptx。
 * 这里采用"提示 + 提供外部查看器"方案：
 *   1. 用户上传 .docx/.xlsx/.pptx 时后端只存原文件；
 *   2. 前端引导用户下载或通过 Microsoft Office Online / Google Docs / WPS Web 查看。
 *
 * 如果未来后端集成 LibreOffice 转 PDF，可改为 PdfPreviewer。
 */
import {computed} from 'vue'
import {useRoute} from 'vue-router'
import {FileSpreadsheet, Download, ExternalLink, FileWarning} from '@lucide/vue'
import {getExt, getDownloadUrl, getPreviewUrl} from '@/utils/preview'
import BaseButton from '@/components/base/BaseButton.vue'

const route = useRoute()
const fileId = computed(() => route.params.fileId)
const filename = computed(() => route.query.filename || 'office')
const ext = computed(() => getExt(filename.value))
const downloadUrl = computed(() => getDownloadUrl(fileId.value))
const previewUrl = computed(() => getPreviewUrl(fileId.value))

// office 公共在线查看器（部分网络环境可用）
const onlineViewer = computed(() => {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl.value)}`
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[var(--color-bg)]">
    <header class="h-14 px-6 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div class="flex items-center gap-2 min-w-0">
        <FileSpreadsheet :size="20" class="text-[var(--color-primary-600)] shrink-0"/>
        <h1 class="text-base font-medium truncate">{{ filename }}</h1>
        <span class="text-xs text-[var(--color-text-muted)] uppercase">.{{ ext }}</span>
      </div>
      <div class="flex items-center gap-2">
        <a :href="onlineViewer" target="_blank">
          <BaseButton variant="secondary" size="sm">
            <span class="inline-flex items-center gap-1.5">
              <ExternalLink :size="14"/>
              Office Online
            </span>
          </BaseButton>
        </a>
        <a :href="downloadUrl" target="_blank">
          <BaseButton variant="primary" size="sm">
            <span class="inline-flex items-center gap-1.5">
              <Download :size="14"/>
              下载
            </span>
          </BaseButton>
        </a>
      </div>
    </header>

    <main class="flex-1 flex items-center justify-center p-10">
      <div class="max-w-md text-center">
        <div class="size-16 mx-auto rounded-full bg-[var(--color-warning)]/10 text-[var(--color-warning)] flex items-center justify-center mb-4">
          <FileWarning :size="28"/>
        </div>
        <h2 class="text-lg font-semibold text-[var(--color-text)] mb-2">
          Office 文档暂不支持浏览器内预览
        </h2>
        <p class="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
          {{ ext }} 文件需要 Office 服务端渲染。您可以选择：
        </p>
        <ul class="text-sm text-left space-y-2 mb-6">
          <li class="flex gap-2"><span class="text-[var(--color-primary)]">①</span> 点击"下载"在本地用 Office/WPS 打开</li>
          <li class="flex gap-2"><span class="text-[var(--color-primary)]">②</span> 点击"Office Online"使用微软在线查看（需外网）</li>
        </ul>
        <div class="flex items-center justify-center gap-2">
          <a :href="onlineViewer" target="_blank">
            <BaseButton variant="secondary" size="md">
              <span class="inline-flex items-center gap-1.5">
                <ExternalLink :size="14"/>
                在 Office Online 打开
              </span>
            </BaseButton>
          </a>
          <a :href="downloadUrl" target="_blank">
            <BaseButton variant="primary" size="md">
              <span class="inline-flex items-center gap-1.5">
                <Download :size="14"/>
                下载到本地
              </span>
            </BaseButton>
          </a>
        </div>
      </div>
    </main>
  </div>
</template>