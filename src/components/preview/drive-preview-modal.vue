<script setup lang="ts">
/**
 * DrivePreviewModal —— 文件预览统一弹窗（参考 html5-examples DrivePreviewModal）
 * - 图片：全屏画廊（独立浮层）
 * - 其它类型：弹窗内渲染（视频/音频/PDF/Office/Markdown/代码/文本）
 * - 异步加载非图片预览 URL（带缓存）
 * - 动态加载所有重型渲染器
 */
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { Download, ExternalLink, AlertCircle } from '@lucide/vue'
import { resolvePreviewUrl, isOfficeKind } from '@/utils/preview'
import ImageGalleryPreviewer from './image-gallery-previewer.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'

// 懒加载（保证只打包进需要的 chunk）
const VideoPreviewer = defineAsyncComponent(() => import('./video-previewer.vue'))
const AudioPreviewer = defineAsyncComponent(() => import('./audio-previewer.vue'))
const PdfPreviewer = defineAsyncComponent(() => import('./pdf-previewer.vue'))
const OfficePreviewer = defineAsyncComponent(() => import('./office-previewer.vue'))
const MarkdownPreviewer = defineAsyncComponent(() => import('./markdown-previewer.vue'))
const CodePreviewer = defineAsyncComponent(() => import('./code-previewer.vue'))

const props = defineProps({
  state: { type: Object, required: true }, // {open, item, kind, galleryItems, galleryIndex}
  /** 兼容：可选的 resolveUrl（覆盖默认）；若传则使用 prop 的 */
  resolveUrl: { type: Function, default: null }
})

const emit = defineEmits(['close', 'download'])

// 非图片预览 URL（异步加载）
const previewUrl = ref('')
const urlLoading = ref(false)
const urlError = ref('')

const isImage = computed(() => props.state.kind === 'image')
const currentItem = computed(() => props.state.item)

const modalWidth = computed(() => {
  const W = { audio: 560, video: 920 } as Record<string, number>
  return W[props.state.kind] ?? 960
})

const contentHeight = computed(() => {
  switch (props.state.kind) {
    case 'video':
      return '520px'
    case 'audio':
      return '220px'
    default:
      return '68vh'
  }
})

const fileName = computed(() => currentItem.value?.name || currentItem.value?.filename || '')

// 监听状态变化加载 URL
// 用请求令牌避免快速切换文件时旧请求后到覆盖新值（竞态）
let urlToken = 0
watch(
  () => [props.state.open, props.state.item, props.state.kind],
  async ([open, item, kind]) => {
    if (!open || !item || kind === 'image') {
      previewUrl.value = ''
      urlError.value = ''
      return
    }
    const token = ++urlToken
    urlLoading.value = true
    urlError.value = ''
    try {
      const url = props.resolveUrl
        ? await props.resolveUrl(item)
        : await resolvePreviewUrl(item.fileId || item.id)
      if (token === urlToken) previewUrl.value = url
    } catch {
      if (token === urlToken) urlError.value = '预览链接获取失败，请重试或直接下载。'
    } finally {
      if (token === urlToken) urlLoading.value = false
    }
  },
  { immediate: true }
)

function close() {
  emit('close')
}
function download() {
  if (currentItem.value) emit('download', currentItem.value)
}
function openInNewTab() {
  if (previewUrl.value) window.open(previewUrl.value, '_blank', 'noopener,noreferrer')
}
function handleGalleryIndex(i) {
  // 透传到父组件更新 galleryIndex
  if (props.state) props.state.galleryIndex = i
}
</script>

<template>
  <!-- 图片：全屏画廊（独立浮层） -->
  <ImageGalleryPreviewer
    v-if="isImage && state.open"
    :items="state.galleryItems"
    :active-index="state.galleryIndex"
    mode="fullscreen"
    @update:active-index="handleGalleryIndex"
    @close="close"
    @download="download"
  />

  <!-- 其它类型：弹窗预览 -->
  <BaseModal
    v-else
    :open="state.open && !isImage"
    :title="fileName || '文件预览'"
    :size="modalWidth <= 600 ? 'sm' : modalWidth <= 800 ? 'md' : 'xl'"
    @update:open="(v) => !v && close()"
  >
    <div
      class="drive-preview-body rounded-sm overflow-hidden border border-(--color-border)"
      :style="{ height: contentHeight }"
    >
      <div v-if="urlLoading" class="flex h-full items-center justify-center">
        <div class="size-12 rounded-2xl bg-(--color-surface-2) animate-pulse" />
      </div>
      <div
        v-else-if="urlError"
        class="flex h-full flex-col items-center justify-center gap-3 text-sm text-(--color-text-muted)"
      >
        <AlertCircle :size="32" />
        {{ urlError }}
      </div>
      <template v-else-if="previewUrl && currentItem">
        <div v-if="state.kind === 'video'" class="h-full w-full">
          <VideoPreviewer
            :url="previewUrl || undefined"
            :file-id="currentItem.fileId || currentItem.id"
            :title="fileName"
          />
        </div>
        <AudioPreviewer
          v-else-if="state.kind === 'audio'"
          :url="previewUrl || undefined"
          :file-id="currentItem.fileId || currentItem.id"
          :title="fileName"
        />
        <PdfPreviewer
          v-else-if="state.kind === 'pdf'"
          :url="previewUrl || undefined"
          :file-id="currentItem.fileId || currentItem.id"
        />
        <OfficePreviewer
          v-else-if="isOfficeKind(state.kind)"
          :url="previewUrl || undefined"
          :file-id="currentItem.fileId || currentItem.id"
          :kind="state.kind"
        />
        <MarkdownPreviewer
          v-else-if="state.kind === 'markdown'"
          :url="previewUrl || undefined"
          :file-id="currentItem.fileId || currentItem.id"
        />
        <CodePreviewer
          v-else-if="state.kind === 'code' || state.kind === 'text'"
          :url="previewUrl || undefined"
          :file-id="currentItem.fileId || currentItem.id"
          :filename="fileName"
        />
        <div
          v-else
          class="flex h-full items-center justify-center text-sm text-(--color-text-muted)"
        >
          暂不支持的预览类型：{{ state.kind }}
        </div>
      </template>
    </div>

    <template #footer>
      <BaseButton variant="ghost" size="sm" @click="openInNewTab">
        <span class="inline-flex items-center gap-1.5">
          <ExternalLink :size="14" />
          新窗口打开
        </span>
      </BaseButton>
      <BaseButton variant="primary" size="sm" @click="download">
        <span class="inline-flex items-center gap-1.5">
          <Download :size="14" />
          下载
        </span>
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.drive-preview-body {
  width: 100%;
}
</style>
