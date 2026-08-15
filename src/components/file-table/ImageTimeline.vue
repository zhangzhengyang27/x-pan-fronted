<script setup lang="ts">
/**
 * ImageTimeline —— 夸克网盘式「图片」时间线视图
 * 特征（1:1 还原夸克）：
 *  - 顶部「分组粒度」切换：年 / 月 / 日（默认 日）
 *  - 按日期分组，每组一个日期标题 + 137px 直角缩略图瓦片（横向自动折行）
 *  - hover 显示半透明白蒙层 + 预览/下载按钮
 *  - 右上角选择态（勾选框），与全局 multipleSelection 联动
 *  - 点击卡片打开图片预览（与 file/index.vue 的 clickFilename 一致）
 */
import { computed, ref } from 'vue'
import FileThumbnail from '@/components/file-table/FileThumbnail.vue'
import { useFileStore } from '@/stores/file'
import { getDownloadUrl } from '@/utils/preview'
import { useDrivePreview } from '@/composables/useDrivePreview'
import DrivePreviewModal from '@/components/preview/drive-preview-modal.vue'
import { ElMessage } from '@/composables/useToast'
import { Eye, Download } from '@lucide/vue'
import type { IFileVO } from '@/types'

const props = withDefaults(
  defineProps<{
    files: IFileVO[]
    groupMode?: 'year' | 'month' | 'day'
  }>(),
  { groupMode: 'day' }
)

const fileStore = useFileStore()

// ─── 图片预览（统一走 DrivePreviewModal 弹窗，与 /files 页一致） ────────────
const preview = useDrivePreview(() => props.files as IFileVO[])
const { state: previewState, openPreview: openPreviewModal, closePreview, resolvePreviewUrl } = preview

function previewDownload(item: Record<string, any>) {
  window.open(getDownloadUrl(item.fileId || item.id), '_blank')
}

// 当前分组粒度（受控于父组件，也可内部维护）
const currentGroupMode = ref(props.groupMode)
const emit = defineEmits<{ (e: 'update:groupMode', v: 'year' | 'month' | 'day'): void }>()
function setGroupMode(v: 'year' | 'month' | 'day') {
  currentGroupMode.value = v
  emit('update:groupMode', v)
}

// ─── 日期工具（原生 Date，避免引入 dayjs 依赖） ──────────────────────────
function parseTime(t: string | number | undefined): Date | null {
  if (t === undefined || t === null || t === '') return null
  const d = new Date(t)
  return isNaN(d.getTime()) ? null : d
}
function pad(n: number): string {
  return n < 10 ? '0' + n : '' + n
}
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// ─── 分组计算 ────────────────────────────────────────────────────────────
// 夸克分组标题格式：日 -> 2026年03月05日；月 -> 2026年03月；年 -> 2026年
// 额外：今天 / 昨天 特殊文案（日粒度下）
function groupKeyOf(file: IFileVO): string {
  const d = parseTime(file.updateTime)
  if (!d) return '未知日期'
  switch (currentGroupMode.value) {
    case 'year':
      return `${d.getFullYear()}年`
    case 'month':
      return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月`
    case 'day':
    default:
      return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日`
  }
}

function groupLabelOf(key: string, file: IFileVO): string {
  if (currentGroupMode.value === 'day') {
    const d = parseTime(file.updateTime)
    if (d) {
      const today = new Date()
      const yesterday = new Date()
      yesterday.setDate(today.getDate() - 1)
      if (isSameDay(d, today)) return '今天'
      if (isSameDay(d, yesterday)) return '昨天'
      // 今年省略年份（夸克习惯）
      if (d.getFullYear() === today.getFullYear()) {
        return `${pad(d.getMonth() + 1)}月${pad(d.getDate())}日`
      }
    }
  }
  return key
}

const grouped = computed(() => {
  const map = new Map<string, IFileVO[]>()
  for (const f of props.files) {
    const k = groupKeyOf(f)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(f)
  }
  // 按日期倒序（最新的组在最前）
  const entries = [...map.entries()].sort((a, b) => {
    const da = parseTime(a[1][0].updateTime)?.getTime() || 0
    const db = parseTime(b[1][0].updateTime)?.getTime() || 0
    return db - da
  })
  return entries.map(([key, list]) => ({
    key,
    label: groupLabelOf(key, list[0]),
    list
  }))
})

// ─── 选择联动（与 FileTable 共用 store.multipleSelection） ────────────────
const selectedIds = computed(() =>
  new Set(fileStore.multipleSelection.map((f) => f.fileId))
)

function isSelected(file: IFileVO): boolean {
  return selectedIds.value.has(file.fileId)
}

function toggleSelect(file: IFileVO, e: MouseEvent) {
  e.stopPropagation()
  const next = [...fileStore.multipleSelection]
  const idx = next.findIndex((f) => f.fileId === file.fileId)
  if (idx === -1) next.push(file)
  else next.splice(idx, 1)
  fileStore.setMultipleSelection(next)
}

function selectAllInGroup(list: IFileVO[]) {
  const current = new Set(fileStore.multipleSelection.map((f) => f.fileId))
  list.forEach((f) => current.add(f.fileId))
  fileStore.setMultipleSelection(
    props.files.filter((f) => current.has(f.fileId))
  )
}

// ─── 点击 / 预览 / 下载 ─────────────────────────────────────────────────
function openPreview(file: IFileVO) {
  openPreviewModal({
    fileId: file.fileId,
    id: file.fileId,
    name: file.filename,
    filename: file.filename,
    fileType: file.fileType
  })
}

function download(file: IFileVO, e: MouseEvent) {
  e.stopPropagation()
  if (file.folderFlag === 1) {
    ElMessage.error('文件夹暂不支持下载')
    return
  }
  const a = document.createElement('a')
  a.href = getDownloadUrl(file.fileId)
  a.download = file.filename || ''
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function onCardClick(file: IFileVO) {
  // 单击：进入预览（夸克图片页单击即预览）
  openPreview(file)
}
</script>

<template>
  <div class="image-timeline">
    <!-- 分组粒度切换（夸克式 segmented） -->
    <div class="timeline-toolbar flex items-center justify-between px-1 pb-3">
      <span class="text-xs text-(--color-text-muted)">
        共 {{ files.length }} 张图片
      </span>
      <div
        class="inline-flex items-center rounded-md p-0.5 bg-(--color-surface-2) border border-(--color-border)"
      >
        <button
          v-for="m in (['year', 'month', 'day'] as const)"
          :key="m"
          type="button"
          class="px-3 h-7 rounded-md text-xs font-medium transition-colors"
          :class="
            currentGroupMode === m
              ? 'bg-(--color-surface) text-(--color-text) shadow-sm'
              : 'text-(--color-text-muted) hover:text-(--color-text)'
          "
          @click="setGroupMode(m)"
        >
          {{ m === 'year' ? '年' : m === 'month' ? '月' : '日' }}
        </button>
      </div>
    </div>

    <!-- 时间线分组 -->
    <div class="timeline-images">
      <section
        v-for="group in grouped"
        :key="group.key"
        class="timeline-group"
      >
        <header class="timeline-date flex items-center gap-2">
          <span class="timeline-date-text">{{ group.label }}</span>
          <button
            type="button"
            class="timeline-date-select text-xs text-(--color-text-muted) hover:text-primary-500"
            @click="selectAllInGroup(group.list)"
          >
            全选
          </button>
        </header>

        <div class="timeline-imggroup">
          <div
            v-for="file in group.list"
            :key="file.fileId"
            class="ttlimg-item"
            :class="{ selected: isSelected(file) }"
            :data-file-id="file.fileId"
            @click="onCardClick(file)"
          >
            <!-- 缩略图（137px 直角，object-cover 铺满） -->
            <FileThumbnail
              :file="file"
              :size="137"
              rounded="rounded-none"
              class="ttlimg"
            />

            <!-- hover 蒙层：半透明白 + 预览/下载 -->
            <div class="ttlimg-mask">
              <button
                type="button"
                class="mask-btn"
                title="预览"
                @click.stop="openPreview(file)"
              >
                <Eye :size="18" />
              </button>
              <button
                type="button"
                class="mask-btn"
                title="下载"
                @click.stop="download(file, $event)"
              >
                <Download :size="18" />
              </button>
            </div>

            <!-- 右上角选择态 -->
            <div
              class="ttlimg-select-status"
              :class="{ active: isSelected(file) }"
              @click="toggleSelect(file, $event)"
            >
              <svg
                v-if="isSelected(file)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                stroke-width="3"
                class="size-3.5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 统一预览弹窗（与 /files 页一致，替代新开页面） -->
    <DrivePreviewModal
      :state="previewState"
      :resolve-url="resolvePreviewUrl"
      @close="closePreview"
      @download="previewDownload"
    />
  </div>
</template>

<style scoped>
.image-timeline {
  padding: 0;
}

/* 夸克：分组标题 12px 加粗灰 */
.timeline-date {
  margin: 16px 0 0;
  padding: 0;
}
.timeline-date-text {
  font-size: 12px;
  font-weight: 700;
  color: rgb(82, 86, 94);
}
.timeline-date-select {
  font-size: 12px;
}

/* 夸克：图片瓦片容器，flex 自动折行，非 grid */
.timeline-imggroup {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

/* 137px 固定方形缩略图，直角 */
.ttlimg-item {
  position: relative;
  width: 137px;
  height: 137px;
  cursor: pointer;
  flex: 0 0 auto;
  background: var(--color-surface);
  overflow: hidden;
}
.ttlimg-item .ttlimg {
  width: 137px;
  height: 137px;
  border-radius: 0;
}

/* hover 蒙层：半透明白 */
.ttlimg-mask {
  display: none;
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.3);
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.ttlimg-item:hover .ttlimg-mask {
  display: flex;
}
.mask-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.mask-btn:hover {
  background: rgba(0, 0, 0, 0.75);
}

/* 右上角选择态：默认透明，选中显示蓝勾 */
.ttlimg-select-status {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}
.ttlimg-select-status.active {
  background: var(--color-primary-500);
}
.ttlimg-item.selected {
  outline: 2px solid var(--color-primary-500);
  outline-offset: -2px;
}
</style>
