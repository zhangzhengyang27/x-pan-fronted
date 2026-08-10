<script setup>
/**
 * FileThumbnail —— 智能文件缩略图
 * 1. 图片 (fileType=7)：真实预览 + 加载中骨架 + 失败回落
 * 2. 文件夹 (fileType=0)：渐变背景 + 文件夹 icon
 * 3. 其他类型：彩色背景 + 大图标
 *
 * 后端若提供 thumbnail 字段（image/video），优先用 thumbnail；
 * 当前无后端支持，图片直接走 preview URL。
 */
import { ref, computed } from 'vue'
import {
  Folder,
  FileText,
  FileArchive,
  FileSpreadsheet,
  FileImage,
  FileAudio,
  FileVideo,
  FileCode,
  FileBarChart2,
  File,
  LoaderCircle,
  Eye
} from '@lucide/vue'
import { cn } from '@/utils/classnames'
import panUtil from '@/utils/common'

const props = defineProps({
  file: { type: Object, required: true },
  size: { type: Number, default: 56 }, // 缩略图正方形边长
  rounded: { type: String, default: 'rounded-xl' }
})

const imageLoaded = ref(false)
const imageErrored = ref(false)

const visual = computed(() => {
  const t = props.file.fileType
  if (t === 0) {
    return {
      bg: 'bg-gradient-to-br from-[var(--color-primary-100)] to-[var(--color-primary-200)] dark:from-[var(--color-primary-900)]/40 dark:to-[var(--color-primary-800)]/40',
      icon: Folder,
      text: 'var(--color-primary-700)',
      label: '文件夹'
    }
  }
  return {
    bg:
      {
        2: 'bg-amber-50 dark:bg-amber-900/20',
        3: 'bg-emerald-50 dark:bg-emerald-900/20',
        4: 'bg-blue-50 dark:bg-blue-900/20',
        5: 'bg-slate-50 dark:bg-slate-800/40',
        6: 'bg-slate-50 dark:bg-slate-800/40',
        7: 'bg-pink-50 dark:bg-pink-900/20',
        8: 'bg-rose-50 dark:bg-rose-900/20',
        9: 'bg-violet-50 dark:bg-violet-900/20',
        10: 'bg-cyan-50 dark:bg-cyan-900/20',
        11: 'bg-orange-50 dark:bg-orange-900/20'
      }[t] || 'bg-slate-50 dark:bg-slate-800/40',
    icon:
      {
        2: FileArchive,
        3: FileSpreadsheet,
        4: FileText,
        5: FileBarChart2,
        6: FileBarChart2,
        7: FileImage,
        8: FileAudio,
        9: FileVideo,
        10: FileBarChart2,
        11: FileCode
      }[t] || File,
    text:
      {
        2: 'text-amber-600 dark:text-amber-400',
        3: 'text-emerald-600 dark:text-emerald-400',
        4: 'text-blue-600 dark:text-blue-400',
        5: 'text-slate-600 dark:text-slate-400',
        6: 'text-slate-600 dark:text-slate-400',
        7: 'text-pink-600 dark:text-pink-400',
        8: 'text-rose-600 dark:text-rose-400',
        9: 'text-violet-600 dark:text-violet-400',
        10: 'text-cyan-600 dark:text-cyan-400',
        11: 'text-orange-600 dark:text-orange-400'
      }[t] || 'text-slate-500',
    label: ''
  }
})

const isImage = computed(() => props.file.fileType === 7)
const showImage = computed(() => isImage.value && !imageErrored.value)

// 后端预览 URL（图片直出预览）；后端 thumbnail 字段（P1.8）优先
// P2 修复：使用 panUtil.getUrlPrefix() 拼绝对路径，避免相对路径 404
const previewUrl = computed(() => {
  if (!isImage.value) return null
  if (props.file.thumbnail) return props.file.thumbnail
  const base = panUtil.getUrlPrefix() || ''
  // fileId 需加密；不解密直接传密文（后端解密）
  return `${base}/file/thumbnail?fileId=${encodeURIComponent(props.file.fileId)}`
})

const iconSize = computed(() => Math.max(20, Math.round(props.size * 0.45)))

function onImageLoad() {
  imageLoaded.value = true
}
function onImageError() {
  imageErrored.value = true
}
</script>

<template>
  <div
    :class="
      cn('relative overflow-hidden flex items-center justify-center shrink-0', rounded, visual.bg)
    "
    :style="{ width: `${size}px`, height: `${size}px` }"
    :aria-label="visual.label || file.filename"
  >
    <!-- 图片：真实预览 -->
    <template v-if="showImage">
      <img
        v-if="previewUrl"
        :src="previewUrl"
        :alt="file.filename"
        class="w-full h-full object-cover"
        :class="imageLoaded ? 'opacity-100' : 'opacity-0'"
        loading="lazy"
        @load="onImageLoad"
        @error="onImageError"
      />
      <!-- 加载中骨架 -->
      <LoaderCircle
        v-if="!imageLoaded"
        :size="iconSize * 0.6"
        class="absolute inset-0 m-auto animate-spin text-pink-400"
      />
      <!-- 图片类型徽标 -->
      <span
        v-if="imageLoaded"
        class="absolute bottom-1 right-1 px-1.5 h-4 rounded bg-black/60 text-white text-[10px] leading-4 inline-flex items-center gap-0.5"
      >
        <Eye :size="10" /> 图
      </span>
    </template>

    <!-- 其他类型：图标 -->
    <component
      v-else
      :is="visual.icon"
      :size="iconSize"
      class="transition-transform group-hover:scale-110"
      :class="visual.text"
    />
  </div>
</template>
