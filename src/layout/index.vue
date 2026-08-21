<script setup lang="ts">
/**
 * AppLayout —— 主布局
 * Header + (Navbar + AppMain) + Footer
 * P1-3：全窗拖拽上传（监听提到根，全屏虚线高亮）
 */
import { onMounted, onUnmounted, ref } from 'vue'
import AppHeader from '@/components/header/index.vue'
import AppNavbar from '@/components/navbar/index.vue'
import { useUploader } from '@/composables/useUploader'
import { useBreakpoint } from '@/composables/useMediaQuery'

const { addFiles } = useUploader()
const { isMobile } = useBreakpoint()

/** 移动端上传兜底：触屏无拖拽，提供点击选文件入口 */
const uploadInput = ref<HTMLInputElement | null>(null)
function triggerUpload() {
  uploadInput.value?.click()
}
function onUploadChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (files && files.length > 0) {
    addFiles(files)
  }
  input.value = ''
}

/** P1.15：移动端汉堡 → 打开 Navbar 抽屉 */
const navbarRef = ref(null)
function onOpenMobileNav() {
  navbarRef.value?.openMobile?.()
}
onMounted(() => window.addEventListener('xpan:open-mobile-nav', onOpenMobileNav))
onUnmounted(() => window.removeEventListener('xpan:open-mobile-nav', onOpenMobileNav))

// ─── 全窗拖拽上传（P1-3）─────────────────────────────────────────────────
const dragOver = ref(false)
let dragCounter = 0

function onDragEnter(e: DragEvent) {
  if (!e.dataTransfer?.types?.includes('Files')) return
  dragCounter++
  dragOver.value = true
}
function onDragOver(e: DragEvent) {
  if (!e.dataTransfer?.types?.includes('Files')) return
  e.preventDefault()
}
function onDragLeave(e: DragEvent) {
  if (!e.dataTransfer?.types?.includes('Files')) return
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    dragOver.value = false
  }
}
function onDrop(e: DragEvent) {
  e.preventDefault()
  dragCounter = 0
  dragOver.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    addFiles(files)
  }
}

onMounted(() => {
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)
})
onUnmounted(() => {
  window.removeEventListener('dragenter', onDragEnter)
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onDrop)
})
</script>

<template>
  <div
    class="h-full w-full flex flex-col bg-(--color-bg) text-(--color-text)"
    :class="isMobile ? 'pt-(--safe-top)' : ''"
  >
    <AppHeader />

    <!-- 移动端浮动上传按钮（拖拽上传在触屏不可用，提供点击选文件兜底） -->
    <button
      v-if="isMobile"
      type="button"
      class="fixed right-4 bottom-5 z-[1500] size-14 rounded-full bg-primary-500 text-white shadow-lg shadow-primary-500/30 flex items-center justify-center active:scale-95 transition-transform"
      style="bottom: calc(1.25rem + var(--safe-bottom))"
      @click="triggerUpload"
      aria-label="上传文件"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    </button>
    <input
      ref="uploadInput"
      type="file"
      multiple
      class="hidden"
      @change="onUploadChange"
    />
    <div class="flex-1 flex min-h-0">
      <AppNavbar ref="navbarRef" />
      <main class="flex-1 min-w-0 flex flex-col">
        <div class="flex-1 min-h-0 overflow-y-auto" style="touch-action: pan-y; -webkit-overflow-scrolling: touch;">
          <div class="px-3 sm:px-4 md:px-6 pb-6 pt-2 mx-auto w-full max-w-[1600px] h-full">
            <RouterView v-slot="{ Component, route }">
              <Transition name="route-fade" mode="out-in">
                <component :is="Component" :key="route.path" />
              </Transition>
            </RouterView>
          </div>
        </div>
      </main>
    </div>

    <!-- 全窗拖拽上传高亮遮罩（P1-3，移动端无拖拽隐藏） -->
    <Transition name="modal">
      <div
        v-if="dragOver && !isMobile"
        class="fixed inset-0 z-[2000] pointer-events-none flex items-center justify-center bg-primary-500/10 backdrop-blur-sm"
      >
        <div
          class="flex flex-col items-center gap-4 px-12 py-10 rounded-3xl border-2 border-dashed border-primary-500 bg-(--color-surface)/90 shadow-2xl"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-primary-500"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p class="text-lg font-semibold text-(--color-text)">释放鼠标以上传文件</p>
          <p class="text-sm text-(--color-text-muted)">支持多文件批量上传 · 自动分片 + 秒传</p>
        </div>
      </div>
    </Transition>
  </div>
</template>
