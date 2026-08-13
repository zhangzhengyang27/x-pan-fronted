<script setup lang="ts">
/**
 * VideoViewer —— 视频页专属视图（参考百度/夸克网盘视频页）
 *  - 海报式视频卡片网格（16:9 封面 + 居中播放按钮）
 *  - hover 浮现 播放 / 下载 快捷操作
 *  - 点击卡片通过 DrivePreviewModal 内嵌播放视频
 */
import { computed } from 'vue'
import { Play, Film } from '@lucide/vue'
import { useFileStore } from '@/stores/file'
import panUtil from '@/utils/common'
import { getDownloadUrl } from '@/utils/preview'
import { useDrivePreview } from '@/composables/useDrivePreview'
import DrivePreviewModal from '@/components/preview/drive-preview-modal.vue'
import type { IFileVO } from '@/types'

const fileStore = useFileStore()
const files = computed<IFileVO[]>(() => fileStore.fileList || [])

const preview = useDrivePreview(() => files.value as any[])
const { state, closePreview } = preview

function openPlay(row: IFileVO) {
  preview.openPreview({
    fileId: row.fileId,
    id: row.fileId,
    name: row.filename,
    filename: row.filename,
    fileType: row.fileType
  })
}

function formatSize(size: string | number | undefined): string {
  if (size === undefined || size === null || size === '') return ''
  const bytes = Number(size)
  if (!isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return bytes + ' B'
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes
  let u = -1
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++ }
  return v.toFixed(1) + ' ' + units[u]
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 空态 -->
    <div v-if="files.length === 0" class="py-20 flex flex-col items-center gap-3 text-(--color-text-muted)">
      <Film :size="48" :stroke-width="1.2" />
      <span class="text-sm">暂无视频文件</span>
    </div>

    <!-- 视频卡片网格 -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <div
        v-for="f in files"
        :key="f.fileId"
        class="group cursor-pointer"
        @click="openPlay(f)"
      >
        <!-- 16:9 封面 -->
        <div
          class="relative aspect-video rounded-md overflow-hidden bg-linear-to-br from-black/80 to-black/40 border border-(--color-border) flex items-center justify-center"
        >
          <Film :size="36" :stroke-width="1.2" class="text-white/30" />
          <!-- 居中播放按钮 -->
          <div
            class="absolute inset-0 flex items-center justify-center"
          >
            <div
              class="size-11 rounded-full bg-primary-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 scale-75 group-hover:scale-100 shadow-lg"
            >
              <Play :size="18" class="ml-0.5" :fill="'currentColor'" />
            </div>
          </div>
          <!-- 顶部类型角标 -->
          <span class="absolute top-2 left-2 px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-black/50 text-white/80">
            视频
          </span>
        </div>
        <!-- 文件名 -->
        <p class="mt-2 text-xs font-medium text-(--color-text) truncate" :title="f.filename">
          {{ f.filename }}
        </p>
        <p class="text-[11px] text-(--color-text-muted)">{{ formatSize(f.fileSize) }}</p>
      </div>
    </div>

    <!-- 内嵌视频预览弹窗 -->
    <DrivePreviewModal
      v-if="state.open"
      :state="state"
      @close="closePreview"
      @download="(row: any) => window.open(getDownloadUrl(row.fileId || row.id), '_blank')"
    />
  </div>
</template>
