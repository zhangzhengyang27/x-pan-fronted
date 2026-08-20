<script setup lang="ts">
/**
 * VideoViewer —— 视频页专属视图（参考百度/夸克网盘视频页）
 *  - 海报式视频卡片网格（16:9 封面 + 居中播放按钮）
 *  - 封面：进入视口后 canvas 采样单帧生成真实画面缩略图
 *  - 点击卡片通过 DrivePreviewModal 内嵌播放视频
 */
import { computed } from 'vue'
import { Film } from '@lucide/vue'
import { useFileStore } from '@/stores/file'
import { getDownloadUrl } from '@/utils/preview'
import { useDrivePreview } from '@/composables/useDrivePreview'
import DrivePreviewModal from '@/components/preview/drive-preview-modal.vue'
import VideoCard from '@/components/file-table/VideoCard.vue'
import type { IFileVO } from '@/types'

const fileStore = useFileStore()
const files = computed<IFileVO[]>(() => fileStore.fileList || [])

const preview = useDrivePreview(() => files.value as any[])
const { state, closePreview } = preview

function openPlay(row: IFileVO) {
  preview.openPreview({
    fileId: row.fileId,
    filename: row.filename,
    fileType: row.fileType
  })
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
      <VideoCard
        v-for="f in files"
        :key="f.fileId"
        :file="f"
        @open="openPlay"
      />
    </div>

    <!-- 内嵌视频预览弹窗 -->
    <DrivePreviewModal
      v-if="state.open"
      :state="state"
      @close="closePreview"
      @download="(row: any) => window.open(getDownloadUrl(row.fileId), '_blank')"
    />
  </div>
</template>
