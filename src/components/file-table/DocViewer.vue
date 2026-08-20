<script setup lang="ts">
/**
 * DocViewer —— 文档页专属视图（参考百度/夸克网盘文档页）
 *  - 顶部「类型 Tab 筛选条」：全部 / Word / Excel / PPT / PDF / 文本
 *  - 卡片分组视图：按文档类型分组，横向瓦片卡片
 *  - 时间线视图：按 今天 / 昨天 / 本周 / 更早 分组，突出最近编辑
 *  - 点击卡片打开文档预览（office/pdf/iframe）
 *  - hover 浮现 预览 / 下载 / 分享 快捷操作
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  FileText,
  FileSpreadsheet,
  FileType,
  Download,
  Eye,
  LayoutGrid,
  CalendarRange,
  File as FileIcon
} from '@lucide/vue'
import { useFileStore } from '@/stores/file'
import { getFileKind, type FileKind } from '@/composables/useIcon'
import panUtil from '@/utils/common'
import { getDownloadUrl } from '@/utils/preview'
import { ElMessage } from '@/composables/useToast'
import type { IFileVO } from '@/types'

export type DocViewMode = 'cards' | 'timeline'
export type DocTab = 'all' | 'doc' | 'excel' | 'ppt' | 'pdf' | 'text'

const props = withDefaults(defineProps<{ files: IFileVO[]; viewMode?: DocViewMode }>(), { viewMode: 'cards' })
const emit = defineEmits<{ (e: 'update:viewMode', v: DocViewMode): void }>()
const fileStore = useFileStore()
const router = useRouter()

// ─── 类型 Tab 定义 ────────────────────────────────────────────────
const TABS: { key: DocTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'doc', label: 'Word' },
  { key: 'excel', label: 'Excel' },
  { key: 'ppt', label: 'PPT' },
  { key: 'pdf', label: 'PDF' },
  { key: 'text', label: '文本' }
]
const activeTab = ref<DocTab>('all')
const viewMode = computed({
  get: () => props.viewMode,
  set: (v: DocViewMode) => emit('update:viewMode', v)
})

// 文档类型 -> 分组描述
const KIND_META: Record<FileKind, { label: string; desc: string }> = {
  doc: { label: 'Word', desc: 'Word 文档' },
  excel: { label: 'Excel', desc: '表格' },
  ppt: { label: 'PPT', desc: '演示文稿' },
  pdf: { label: 'PDF', desc: 'PDF 文档' },
  text: { label: '文本', desc: 'TXT / Markdown' },
  folder: { label: '文件夹', desc: '' },
  image: { label: '图片', desc: '' },
  video: { label: '视频', desc: '' },
  audio: { label: '音频', desc: '' },
  archive: { label: '压缩包', desc: '' },
  code: { label: '代码', desc: '' },
  other: { label: '其他', desc: '' }
}

// ─── 类型筛选后的文件 ────────────────────────────────────────────
const filtered = computed(() => {
  if (activeTab.value === 'all') return props.files
  return props.files.filter((f) => getFileKind({ filename: f.filename, fileType: f.fileType }) === activeTab.value)
})

// ─── 卡片分组视图：按文档子类型分组 ──────────────────────────────
const DOC_ORDER: FileKind[] = ['doc', 'excel', 'ppt', 'pdf', 'text']
const groups = computed(() => {
  const map: Record<FileKind, IFileVO[]> = { doc: [], excel: [], ppt: [], pdf: [], text: [], folder: [], image: [], video: [], audio: [], archive: [], code: [], other: [] }
  filtered.value.forEach((f) => {
    const k = getFileKind({ filename: f.filename, fileType: f.fileType })
    if (map[k]) map[k].push(f)
  })
  return DOC_ORDER.map((k) => ({ kind: k, files: map[k] })).filter((g) => g.files.length > 0)
})

// ─── 时间线视图：今天 / 昨天 / 本周 / 更早 ────────────────────────
function parseTime(t: string | number | undefined): Date | null {
  if (t === undefined || t === null || t === '') return null
  const d = new Date(t)
  return isNaN(d.getTime()) ? null : d
}
function timelineKeyOf(f: IFileVO): string {
  const d = parseTime(f.updateTime)
  if (!d) return '更早'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff > 1 && diff < 7) return '本周'
  return '更早'
}
const TIMELINE_ORDER = ['今天', '昨天', '本周', '更早']
const timelineGroups = computed(() => {
  const map: Record<string, IFileVO[]> = { 今天: [], 昨天: [], 本周: [], 更早: [] }
  filtered.value.forEach((f) => {
    const k = timelineKeyOf(f)
    if (map[k]) map[k].push(f)
  })
  return TIMELINE_ORDER.map((label) => ({ label, files: map[label] })).filter((g) => g.files.length > 0)
})

// ─── 文件大小格式化 ──────────────────────────────────────────────
function formatSize(size: string | number | undefined): string {
  if (size === undefined || size === null || size === '') return ''
  const bytes = Number(size)
  if (!isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return bytes + ' B'
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes
  let u = -1
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024
    u++
  }
  return v.toFixed(1) + ' ' + units[u]
}

// ─── 预览跳转（与 file-table/index.vue clickFilename 一致） ─────
function openPreview(row: IFileVO) {
  const id = panUtil.handleId(row.fileId)
  const query = { filename: row.filename }
  const k = getFileKind({ filename: row.filename, fileType: row.fileType })
  if (k === 'pdf' || k === 'text') {
    router.push({ name: 'PreviewIframe', params: { fileId: id }, query })
  } else {
    router.push({ name: 'PreviewOffice', params: { fileId: id }, query })
  }
}

// ─── 缩略图/图标组件 ─────────────────────────────────────────────
const ICONS: Record<string, any> = {
  doc: FileType,
  excel: FileSpreadsheet,
  ppt: FileType,
  pdf: FileText,
  text: FileText
}
function iconOf(row: IFileVO) {
  const k = getFileKind({ filename: row.filename, fileType: row.fileType })
  return ICONS[k] || FileIcon
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 类型 Tab 筛选条 -->
    <div class="flex items-center gap-1.5 flex-wrap">
      <button
        v-for="t in TABS"
        :key="t.key"
        type="button"
        class="px-3 h-8 rounded-md text-xs font-medium transition-colors border border-transparent"
        :class="activeTab === t.key
          ? 'bg-primary-500/10 text-primary-600 border-primary-500/30'
          : 'text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-2)'"
        @click="activeTab = t.key"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- 视图切换：卡片 / 时间线 -->
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="px-3 h-8 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
        :class="viewMode === 'cards' ? 'bg-(--color-surface-2) text-(--color-text)' : 'text-(--color-text-muted) hover:text-(--color-text)'"
        @click="viewMode = 'cards'"
      >
        <LayoutGrid :size="14" /> 卡片
      </button>
      <button
        type="button"
        class="px-3 h-8 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
        :class="viewMode === 'timeline' ? 'bg-(--color-surface-2) text-(--color-text)' : 'text-(--color-text-muted) hover:text-(--color-text)'"
        @click="viewMode = 'timeline'"
      >
        <CalendarRange :size="14" /> 时间线
      </button>
    </div>

    <!-- 空态 -->
    <div v-if="filtered.length === 0" class="py-20 flex flex-col items-center gap-3 text-(--color-text-muted)">
      <FileIcon :size="48" :stroke-width="1.2" />
      <span class="text-sm">没有找到相关文档</span>
    </div>

    <!-- 卡片分组视图 -->
    <template v-else-if="viewMode === 'cards'">
      <section v-for="g in groups" :key="g.kind" class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-(--color-text) inline-flex items-center gap-2">
            <component :is="ICONS[g.kind] || FileIcon" :size="16" class="text-primary-500" />
            {{ KIND_META[g.kind].label }}
            <span class="text-xs font-normal text-(--color-text-muted)">{{ KIND_META[g.kind].desc }}</span>
          </h2>
          <span class="text-xs text-(--color-text-muted)">{{ g.files.length }} 个</span>
        </div>
        <div class="flex gap-3 flex-wrap">
          <div
            v-for="f in g.files"
            :key="f.fileId"
            class="group w-[200px] border border-(--color-border) rounded-md p-3 bg-(--color-surface) hover:shadow-sm hover:border-primary-400/50 transition-all cursor-pointer"
            @click="openPreview(f)"
          >
            <div class="flex items-start justify-between mb-2">
              <div class="w-9 h-9 rounded-sm flex items-center justify-center" :style="{ backgroundColor: 'var(--color-primary-50)' }">
                <component :is="iconOf(f)" :size="18" class="text-primary-500" />
              </div>
              <!-- hover 快捷操作 -->
              <div class="hidden group-hover:flex items-center gap-1">
                <button
                  type="button"
                  class="w-6 h-6 rounded-sm flex items-center justify-center text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-2)"
                  title="预览"
                  @click.stop="openPreview(f)"
                >
                  <Eye :size="14" />
                </button>
                <a
                  :href="getDownloadUrl(panUtil.handleId(f.fileId))"
                  target="_blank"
                  class="w-6 h-6 rounded-sm flex items-center justify-center text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-2)"
                  title="下载"
                  @click.stop
                >
                  <Download :size="14" />
                </a>
              </div>
            </div>
            <p class="text-xs font-medium text-(--color-text) leading-snug line-clamp-2 break-all" :title="f.filename">
              {{ f.filename }}
            </p>
            <p class="mt-1 text-[11px] text-(--color-text-muted)">{{ formatSize(f.fileSize) }}</p>
          </div>
        </div>
      </section>
    </template>

    <!-- 时间线视图 -->
    <template v-else>
      <section v-for="g in timelineGroups" :key="g.label" class="flex flex-col gap-3">
        <h2 class="text-sm font-semibold text-(--color-text)">{{ g.label }}</h2>
        <div class="flex gap-3 flex-wrap">
          <div
            v-for="f in g.files"
            :key="f.fileId"
            class="group flex items-center gap-3 w-full max-w-[420px] border border-(--color-border) rounded-md p-3 bg-(--color-surface) hover:border-primary-400/50 transition-all cursor-pointer"
            @click="openPreview(f)"
          >
            <div class="w-9 h-9 rounded-sm flex items-center justify-center shrink-0" :style="{ backgroundColor: 'var(--color-primary-50)' }">
              <component :is="iconOf(f)" :size="18" class="text-primary-500" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium text-(--color-text) truncate">{{ f.filename }}</p>
              <p class="mt-0.5 text-[11px] text-(--color-text-muted)">{{ KIND_META[getFileKind({ filename: f.filename, fileType: f.fileType })].label }} · {{ formatSize(f.fileSize) }}</p>
            </div>
            <div class="hidden group-hover:flex items-center gap-1 shrink-0">
              <button type="button" class="w-6 h-6 rounded-sm flex items-center justify-center text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-2)" title="预览" @click.stop="openPreview(f)">
                <Eye :size="14" />
              </button>
              <a :href="getDownloadUrl(panUtil.handleId(f.fileId))" target="_blank" class="w-6 h-6 rounded-sm flex items-center justify-center text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-2)" title="下载" @click.stop>
                <Download :size="14" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
