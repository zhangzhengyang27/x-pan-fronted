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
import { resolvePreviewUrl } from '@/utils/preview'
import { getPreviewPluginById } from '@/utils/preview-plugin'
import ImageGalleryPreviewer from './image-gallery-previewer.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'

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

// 插件化：按当前 kind 反查插件（kind 就是 plugin.id），尺寸/渲染/新窗口策略统一从插件读取
const plugin = computed(() => getPreviewPluginById(props.state.kind))

const modalWidth = computed(() => plugin.value?.modal?.width ?? 960)

const contentHeight = computed(() => plugin.value?.modal?.height ?? '68vh')

// 懒加载渲染组件（替代原来的 6 个 defineAsyncComponent 声明）
const ActiveComponent = computed(() =>
  plugin.value && !plugin.value.fullscreen
    ? defineAsyncComponent(plugin.value.component)
    : null
)

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
  const item = currentItem.value
  if (!item) return
  // 插件化：新窗口策略下沉到各插件的 openInNewTab（未配置则 fallback 到 iframe 路由）
  const fn = plugin.value?.openInNewTab
  if (fn) {
    fn(item, previewUrl.value)
  } else {
    const fileId = encodeURIComponent(String(item.fileId ?? item.id))
    const filename = encodeURIComponent(item.name || item.filename || '')
    window.open(
      `${window.location.origin}/preview/iframe/${fileId}?filename=${filename}`,
      '_blank',
      'noopener,noreferrer'
    )
  }
}
function handleGalleryIndex(i: number) {
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
        <!-- 插件表驱动：<component :is> 替代原 v-if 链，统一传齐异构 props -->
        <div v-if="state.kind === 'video'" class="h-full w-full">
          <component
            :is="ActiveComponent"
            :url="previewUrl || undefined"
            :file-id="currentItem.fileId || currentItem.id"
            :title="fileName"
            :filename="fileName"
            :kind="state.kind"
          />
        </div>
        <component
          v-else-if="ActiveComponent"
          :is="ActiveComponent"
          :url="previewUrl || undefined"
          :file-id="currentItem.fileId || currentItem.id"
          :title="fileName"
          :filename="fileName"
          :kind="state.kind"
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
