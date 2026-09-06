<script setup lang="ts">
/**
 * FileDetailPanel —— 右侧文件详情面板
 * 参考夸克/迅雷风格:
 * - 选中文件时滑入,取消选中时滑出
 * - 文件预览大图/图标 + 文件名
 * - 快捷操作按钮组
 * - 文件元信息(大小/类型/位置/创建时间/修改时间)
 * - 标签(来自 useFileTags)
 */
import { computed, ref, watch } from 'vue'
import { useBreakpoint } from '@/composables/useMediaQuery'
import {
  X,
  Download,
  Share2,
  Trash2,
  Edit3,
  Copy,
  FolderInput,
  History,
  Star,
  Tag,
  Shield,
  ExternalLink,
  LoaderCircle,
  Sparkles,
  FileArchive,
  File
} from '@lucide/vue'
import FileThumbnail from '@/components/file-table/FileThumbnail.vue'
import DrivePreviewModal from '@/components/preview/drive-preview-modal.vue'
import FileHistoryPanel from '@/components/file-table/FileHistoryPanel.vue'
import FolderPickerDialog from '@/components/base/FolderPickerDialog.vue'
import ExtractDialog from '@/components/base/ExtractDialog.vue'
import { useFileTags } from '@/composables/useFileTags'
import { useDrivePreview, type PreviewItem } from '@/composables/useDrivePreview'
import { useFavorites } from '@/composables/useFavorites'
import { useRouter } from 'vue-router'
import fileService from '@/api/file'
import vaultService from '@/api/vault'
import panUtil, { isArchive } from '@/utils/common'
import { getDownloadUrl } from '@/utils/preview'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import type { IFileVO } from '@/types'

const props = defineProps<{
  file: IFileVO | null
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'close'): void
  (e: 'refresh'): void
  (e: 'share'): void
}>()

const router = useRouter()
const { isMobile } = useBreakpoint()
const { isFavorite, toggle: toggleFavorite } = useFavorites()
const { loading: tagLoading, autoTag, getTags, addTag, removeTag, loadTags } = useFileTags()

// ─── 文件预览 ──────────────────────────────────────────────────────────────
const preview = useDrivePreview(() => (props.file ? [props.file] as unknown as PreviewItem[] : []))

function openPreview() {
  if (!props.file || props.file.fileType === 0) return
  const opened = preview.openPreview(props.file as unknown as PreviewItem)
  if (!opened) {
    // fallback: 新窗口预览（用 name 解析，路由以 :fileId 为必填参数）
    const fid = panUtil.handleId(props.file.fileId)
    const { href } = router.resolve({
      name:
        props.file.fileType === 7 || props.file.fileType === 8
          ? `Preview${props.file.fileType === 7 ? 'Image' : 'Music'}`
          : props.file.fileType === 11
            ? 'PreviewCode'
            : 'PreviewOffice',
      params: { fileId: fid }
    })
    window.open(href, '_blank')
  }
}

// ─── 下载 ──────────────────────────────────────────────────────────────────
function download() {
  if (!props.file) return
  const url = getDownloadUrl(props.file.fileId)
  const a = document.createElement('a')
  a.href = url
  a.download = props.file.filename || ''
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// ─── 分享 ──────────────────────────────────────────────────────────────────
// 由父级打开两步式分享表单（ShareButton：配置分享名/有效期/提取码 → 链接+提取码+二维码）
function share() {
  if (!props.file) return
  emit('share')
}

// ─── 新窗口打开任意预览 URL ───────────────────────────────────────────────
function openExternal(url: string) {
  window.open(url, '_blank')
}

// ─── 重命名 ─────────────────────────────────────────────────────────────────
async function rename() {
  if (!props.file) return
  const oldName = props.file.filename || ''
  try {
    const { value: newName } = await ElMessageBox.prompt('请输入新的文件名', '重命名', {
      inputValue: oldName,
      inputValidator: (val) =>
        (val && val.trim() && val !== oldName) || '文件名不能为空或与原名相同',
      confirmButtonText: '确认',
      cancelButtonText: '取消'
    })
    if (!newName) return
    fileService.update(
      { fileId: props.file.fileId, filename: newName.trim() },
      () => {
        ElMessage.success('重命名成功')
        emit('refresh')
      },
      (err) => ElMessage.error(err.message)
    )
  } catch {
    // 取消
  }
}

// ─── 删除 ───────────────────────────────────────────────────────────────────
async function deleteFile() {
  if (!props.file) return
  // ElMessageBox.confirm（useToast 假封装）恒 resolve(true/false)，取消时 false；
  // try/catch 等 reject 是死代码，会导致取消也执行删除
  const ok = await ElMessageBox.confirm(
    `确定要删除「${props.file.filename}」吗？删除后可从回收站恢复。`,
    '确认删除',
    { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
  )
  if (!ok) return
  fileService.delete(
    { fileIds: [props.file.fileId] },
    () => {
      ElMessage.success('已删除')
      emit('refresh')
      emit('close')
    },
    (err) => ElMessage.error(err.message)
  )
}

// ─── 移动/复制 ──────────────────────────────────────────────────────────────
const moveDialog = ref({ open: false, mode: 'move' as 'move' | 'copy' })

function openMove() {
  moveDialog.value = { open: true, mode: 'move' }
}
function openCopy() {
  moveDialog.value = { open: true, mode: 'copy' }
}

function onMoveComplete() {
  ElMessage.success(moveDialog.value.mode === 'move' ? '已移动' : '已复制')
  moveDialog.value.open = false
  if (moveDialog.value.mode === 'copy') return
  emit('refresh')
  emit('close')
}

// ─── 移入保险箱 ────────────────────────────────────────────────────────────
function moveToVault() {
  if (!props.file) return
  vaultService.move(
    [panUtil.handleId(props.file.fileId)],
    () => {
      ElMessage.success('已移入保险箱')
      emit('refresh')
      emit('close')
    },
    (err) => ElMessage.error((err as { message?: string })?.message || '移入保险箱失败')
  )
}

// ─── 历史版本 ──────────────────────────────────────────────────────────────
const historyPanel = ref({ open: false, fileId: '' })

function openHistory() {
  if (!props.file) return
  historyPanel.value = { open: true, fileId: panUtil.handleId(props.file.fileId) }
}

// ─── 智能打标 ───────────────────────────────────────────────────────────────
const tagInput = ref('')

async function handleAddTag() {
  if (!props.file || !tagInput.value.trim()) return
  await addTag(props.file.fileId, tagInput.value.trim())
  tagInput.value = ''
}

async function handleAutoTag() {
  if (!props.file || tagLoading.value) return
  const tags = await autoTag(props.file)
  if (tags.length === 0) {
    ElMessage.info('未能生成标签')
  } else {
    ElMessage.success(`已生成 ${tags.length} 个标签：${tags.join('、')}`)
  }
}

const fileTags = computed(() => {
  if (!props.file) return []
  return getTags(props.file.fileId)
})

// ─── 在线解压 ───────────────────────────────────────────────────────────────
const extractDialog = ref({ open: false, fileId: '', filename: '' })

function openExtract() {
  if (!props.file) return
  extractDialog.value = {
    open: true,
    fileId: panUtil.handleId(props.file.fileId),
    filename: props.file.filename || ''
  }
}

// ─── 文件元信息格式化 ─────────────────────────────────────────────────────
const fileMeta = computed(() => {
  if (!props.file) return null
  const f = props.file
  const typeMap: Record<number, string> = {
    0: '文件夹',
    2: '压缩包',
    3: 'Excel',
    4: 'Word',
    5: 'PDF',
    6: '其他文档',
    7: '图片',
    8: '音频',
    9: '视频',
    10: '演示文稿',
    11: '代码文件'
  }
  const formatDate = (d: string) => {
    if (!d) return '-'
    try {
      return new Date(d).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return d
    }
  }
  return {
    type: typeMap[f.fileType] || '未知',
    size: f.fileSizeDesc || panUtil.translateFileSize(Number(f.fileSize || 0)) || '-',
    location: f.parentFilename || '根目录',
    created: formatDate(f.createTime || ''),
    modified: formatDate(f.updateTime || '')
  }
})

// ─── 打开所在位置 ──────────────────────────────────────────────────────────
function openLocation() {
  if (!props.file?.parentId) return
  router.push({
    path: '/files',
    query: { openFolder: panUtil.handleId(props.file.parentId) }
  })
}

// 监听文件变化,从后端加载标签（fileId 本身已是后端加密串，直接传给 tag API）
watch(
  () => props.file,
  (f) => {
    if (f && f.fileType !== 0) {
      loadTags(f.fileId)
    }
  },
  { immediate: true }
)
</script>

<template>
  <Transition name="detail-slide">
    <aside
      v-if="open && file"
      class="fixed z-40 flex flex-col border-(--color-border) bg-(--color-surface) overflow-hidden"
      :class="isMobile
        ? 'left-0 right-0 bottom-0 max-h-[85vh] rounded-t-2xl border-t pb-(--safe-bottom)'
        : 'top-0 right-0 bottom-0 border-l'"
      :style="isMobile ? '' : 'width: 320px; max-width: 90vw;'"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-(--color-border)">
        <span class="text-sm font-semibold text-(--color-text)">文件详情</span>
        <button
          type="button"
          class="size-7 rounded-sm flex items-center justify-center text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-2) transition-colors"
          @click="emit('close')"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- 滚动内容 -->
      <div class="flex-1 overflow-y-auto">

        <!-- 文件预览区 -->
        <div class="flex flex-col items-center pt-4 pb-3 px-4 gap-2">
          <!-- 点击放大预览 -->
          <div
            class="relative cursor-pointer group"
            :class="file.fileType !== 0 ? 'hover:opacity-90' : 'cursor-default'"
            @click="openPreview"
          >
            <FileThumbnail :file="file" :size="72" rounded="rounded-lg" />
            <!-- 图片/视频类型遮罩 -->
            <div
              v-if="file.fileType === 7 || file.fileType === 9"
              class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg bg-black/30"
            >
              <span class="size-8 rounded-full bg-white/90 flex items-center justify-center">
                <ExternalLink :size="16" class="text-(--color-text)" />
              </span>
            </div>
          </div>

          <!-- 文件名 + 元信息 -->
          <div class="text-center w-full">
            <p class="text-sm font-medium text-(--color-text) break-all line-clamp-2 leading-snug">
              {{ file.filename }}
            </p>
            <div class="flex items-center justify-center gap-2 mt-0.5">
              <span class="text-xs text-(--color-text-muted) tabular-nums">
                {{ fileMeta?.size }}
              </span>
              <button
                type="button"
                class="flex items-center gap-1 text-[11px] transition-colors"
                :class="isFavorite(file.fileId) ? 'text-amber-500' : 'text-(--color-text-muted) hover:text-amber-500'"
                @click="toggleFavorite(file as any)"
              >
                <Star
                  :size="11"
                  :fill="isFavorite(file.fileId) ? 'currentColor' : 'none'"
                  :stroke-width="2"
                />
                {{ isFavorite(file.fileId) ? '已收藏' : '收藏' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 操作按钮组 -->
        <div class="px-4 pb-3">
          <div class="flex items-center justify-between gap-1">
            <button
              type="button"
              class="group flex flex-col items-center gap-1.5 flex-1 py-2 rounded-lg text-(--color-text-muted) hover:bg-(--color-surface-2) transition-colors"
              @click="download"
            >
              <span class="size-9 rounded-full bg-primary-500/10 text-primary-500 group-hover:bg-primary-500 group-hover:text-white flex items-center justify-center transition-colors">
                <Download :size="17" :stroke-width="2" />
              </span>
              <span class="text-[11px]">下载</span>
            </button>

            <button
              type="button"
              class="group flex flex-col items-center gap-1.5 flex-1 py-2 rounded-lg text-(--color-text-muted) hover:bg-(--color-surface-2) transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="file.fileType === 0"
              @click="share"
            >
              <span class="size-9 rounded-full bg-primary-500/10 text-primary-500 group-hover:bg-primary-500 group-hover:text-white flex items-center justify-center transition-colors">
                <Share2 :size="17" :stroke-width="2" />
              </span>
              <span class="text-[11px]">分享</span>
            </button>

            <button
              type="button"
              class="group flex flex-col items-center gap-1.5 flex-1 py-2 rounded-lg text-(--color-text-muted) hover:bg-(--color-surface-2) transition-colors"
              @click="rename"
            >
              <span class="size-9 rounded-full bg-(--color-surface-container-high) text-(--color-text-muted) group-hover:bg-(--color-text) group-hover:text-(--color-surface) flex items-center justify-center transition-colors">
                <Edit3 :size="17" :stroke-width="2" />
              </span>
              <span class="text-[11px]">重命名</span>
            </button>

            <button
              type="button"
              class="group flex flex-col items-center gap-1.5 flex-1 py-2 rounded-lg text-(--color-text-muted) hover:bg-(--color-surface-2) transition-colors"
              @click="deleteFile"
            >
              <span class="size-9 rounded-full bg-danger/10 text-danger group-hover:bg-danger group-hover:text-white flex items-center justify-center transition-colors">
                <Trash2 :size="17" :stroke-width="2" />
              </span>
              <span class="text-[11px]">删除</span>
            </button>
          </div>
        </div>

        <!-- 分隔线 -->
        <div class="mx-4 border-t border-(--color-border)" />

        <!-- 更多操作 -->
        <div class="px-3 py-2 space-y-0.5">
          <button
            v-if="file.fileType !== 0"
            type="button"
            class="w-full flex items-center gap-3 h-8 px-2.5 rounded-md text-[13px] text-(--color-text-muted) hover:bg-(--color-surface-2) hover:text-(--color-text) transition-colors"
            @click="openCopy"
          >
            <Copy :size="14" :stroke-width="1.75" />
            复制到...
          </button>
          <button
            v-if="file.fileType !== 0"
            type="button"
            class="w-full flex items-center gap-3 h-8 px-2.5 rounded-md text-[13px] text-(--color-text-muted) hover:bg-(--color-surface-2) hover:text-(--color-text) transition-colors"
            @click="openMove"
          >
            <FolderInput :size="14" :stroke-width="1.75" />
            移动到...
          </button>
          <button
            v-if="file.fileType !== 0"
            type="button"
            class="w-full flex items-center gap-3 h-8 px-2.5 rounded-md text-[13px] text-(--color-text-muted) hover:bg-(--color-surface-2) hover:text-(--color-text) transition-colors"
            @click="openLocation"
          >
            <ExternalLink :size="14" :stroke-width="1.75" />
            打开所在位置
          </button>
          <button
            v-if="file.fileType !== 0"
            type="button"
            class="w-full flex items-center gap-3 h-8 px-2.5 rounded-md text-[13px] text-(--color-text-muted) hover:bg-(--color-surface-2) hover:text-(--color-text) transition-colors"
            @click="openHistory"
          >
            <History :size="14" :stroke-width="1.75" />
            历史版本
          </button>
          <button
            v-if="isArchive(file)"
            type="button"
            class="w-full flex items-center gap-3 h-8 px-2.5 rounded-md text-[13px] text-(--color-text-muted) hover:bg-(--color-surface-2) hover:text-(--color-text) transition-colors"
            @click="openExtract"
          >
            <FileArchive :size="14" :stroke-width="1.75" />
            在线解压
          </button>
          <button
            v-if="file.fileType !== 0"
            type="button"
            class="w-full flex items-center gap-3 h-8 px-2.5 rounded-md text-[13px] text-(--color-text-muted) hover:bg-(--color-surface-2) hover:text-(--color-text) transition-colors"
            @click="moveToVault"
          >
            <Shield :size="14" :stroke-width="1.75" />
            移入保险箱
          </button>
        </div>

        <!-- 分隔线 -->
        <div class="mx-4 border-t border-(--color-border)" />

        <!-- 文件信息 -->
        <div class="px-4 py-2">
          <p class="text-xs font-medium text-(--color-text-muted) mb-2 uppercase tracking-wider">
            文件信息
          </p>
          <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
            <span class="text-(--color-text-muted)">类型</span>
            <span class="text-(--color-text) text-right">{{ fileMeta?.type }}</span>
            <span class="text-(--color-text-muted)">大小</span>
            <span class="text-(--color-text) text-right tabular-nums">{{ fileMeta?.size }}</span>
            <span class="text-(--color-text-muted)">位置</span>
            <span class="text-(--color-text) text-right truncate max-w-[160px]">{{ fileMeta?.location }}</span>
            <span class="text-(--color-text-muted)">创建时间</span>
            <span class="text-(--color-text) text-right tabular-nums">{{ fileMeta?.created }}</span>
            <span class="text-(--color-text-muted)">修改时间</span>
            <span class="text-(--color-text) text-right tabular-nums">{{ fileMeta?.modified }}</span>
          </div>
        </div>

        <!-- 分隔线 -->
        <div class="mx-4 border-t border-(--color-border)" />

        <!-- 标签 -->
        <div class="px-4 py-2 pb-4">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-medium text-(--color-text-muted) uppercase tracking-wider">
              标签
            </p>
            <button
              type="button"
              class="flex items-center gap-1 text-[11px] text-primary-500 hover:text-primary-600 transition-colors"
              :disabled="tagLoading"
              @click="handleAutoTag"
            >
              <LoaderCircle v-if="tagLoading" :size="12" class="animate-spin" />
              <Sparkles v-else :size="12" />
              AI 打标
            </button>
          </div>
          <div class="flex flex-wrap gap-1 mb-2">
            <span
              v-for="tag in fileTags"
              :key="tag"
              class="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-(--color-surface-container-high) text-xs text-(--color-text-muted) group/tag"
            >
              <Tag :size="10" />
              {{ tag }}
              <button
                type="button"
                class="size-3.5 rounded-full hover:bg-danger/20 hover:text-danger transition-colors ml-0.5 opacity-0 group-hover/tag:opacity-100"
                @click="removeTag(file.fileId, tag)"
              >
                <X :size="10" />
              </button>
            </span>
          </div>
          <div class="flex items-center gap-2">
            <input
              v-model="tagInput"
              type="text"
              placeholder="添加标签..."
              class="flex-1 h-7 px-2.5 rounded-md border border-(--color-border) bg-(--color-surface) text-xs text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-primary-500 transition-colors"
              @keydown.enter="handleAddTag"
            />
            <button
              type="button"
              class="size-7 rounded-md bg-primary-500 text-white hover:bg-primary-600 transition-colors flex items-center justify-center"
              @click="handleAddTag"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="size-3.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 预览弹窗 -->
      <DrivePreviewModal
        :state="preview.state"
        :resolve-url="preview.resolvePreviewUrl"
        @close="preview.closePreview"
        @download="(item: any) => openExternal(getDownloadUrl(String(item?.fileId ?? '')))"
      />

      <!-- 历史版本 -->
      <FileHistoryPanel
        :file-id="historyPanel.fileId"
        :open="historyPanel.open"
        @update:open="(v) => (historyPanel.open = v)"
        @rolled-back="emit('refresh')"
      />

      <!-- 移动/复制 -->
      <FolderPickerDialog
        v-if="moveDialog.open"
        :open="moveDialog.open"
        :mode="moveDialog.mode"
        :row="[file]"
        @update:open="(v) => (moveDialog.open = v)"
        @complete="onMoveComplete"
      />

      <!-- 在线解压 -->
      <ExtractDialog
        v-model:open="extractDialog.open"
        :file-id="extractDialog.fileId"
        :filename="extractDialog.filename"
        @extracted="emit('refresh')"
      />
    </aside>
  </Transition>
</template>

<style scoped>
.detail-slide-enter-active,
.detail-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.detail-slide-enter-from,
.detail-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
