<script setup lang="ts">
/**
 * AppFileTable —— 主文件列表 (Redesign v2)
 * 变化:工具栏/操作按钮移至详情面板,本组件专注列表/网格/筛选/排序/选择
 */
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import fileService from '@/api/file'
import panUtil from '@/utils/common'
import { useFileStore } from '@/stores/file'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import { useRouter } from 'vue-router'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import ContextMenu from '@/components/base/ContextMenu.vue'
import FolderPickerDialog from '@/components/base/FolderPickerDialog.vue'
import FileThumbnail from './FileThumbnail.vue'
import { useFavorites } from '@/composables/useFavorites'
import { useRecent } from '@/composables/useRecent'
import { useBreakpoint } from '@/composables/useMediaQuery'
import FileCardList from './FileCardList.vue'
import { useFileTags } from '@/composables/useFileTags'
import { getDownloadUrl, invalidatePreviewUrl } from '@/utils/preview'
import { removeThumbnailFromCache } from '@/utils/thumbnail-cache'
import { invalidateVideoCoverCache } from '@/composables/useVideoCover'
import { useDrivePreview } from '@/composables/useDrivePreview'
import DrivePreviewModal from '@/components/preview/drive-preview-modal.vue'
import { useUploader } from '@/composables/useUploader'
import {
  LoaderCircle,
  Download,
  Trash2,
  Star,
  SearchX,
  FolderOpen,
  Edit2,
  History,
  Shield,
  Share2,
  FileArchive
} from '@lucide/vue'
import vaultService from '@/api/vault'
import { FileType } from '@/types'
import { isArchive } from '@/utils/common'
import ExtractDialog from '@/components/base/ExtractDialog.vue'

const props = withDefaults(
  defineProps<{
    view?: 'list' | 'grid'
  }>(),
  { view: 'list' }
)

// 右键菜单「分享」→ 由父级打开两步式分享表单
const emit = defineEmits<{
  (e: 'share', row: any): void
}>()

const router = useRouter()
const fileStore = useFileStore()
const breadcrumbStore = useBreadcrumbStore()
const {
  fileList,
  tableLoading,
  searchFlag,
  hasMore,
  isLoadingMore,
  total,
  sortProp,
  sortOrder,
  clipboard
} = storeToRefs(fileStore)

const selected = ref<string[]>([]) // 多选 fileId
const { isMobile } = useBreakpoint()
const currentView = ref(props.view)

// 外部传入 view 变化时同步
watch(() => props.view, (v) => { if (v) currentView.value = v })

// ─── 排序 / 筛选（均交由后端处理） ─────────────────────────────────────────
const filter = ref({
  extensions: [] as string[],
  fileTypes: [] as FileType[],
  sizeMin: '',
  sizeMax: '',
  dateFrom: '',
  dateTo: ''
})

const filterActive = computed(() => filter.value.fileTypes.length > 0)

// 筛选变化：把所选文件类型映射为后端 fileTypes 字符串并重新加载
watch(filterActive, (active) => {
  if (!searchFlag.value) {
    const types = active ? filter.value.fileTypes.join(',') : '-1'
    fileStore.setFileTypes(types)
    fileStore.loadFileList()
  }
})

// 排序变化：直接重新加载（后端按 orderBy/order 返回）
watch([sortProp, sortOrder], () => {
  if (!searchFlag.value) fileStore.loadFileList()
})

// 列表数据直接来自 store（后端已完成排序与类型筛选）
const filteredList = computed(() => fileList.value)

// ─── 文件预览（统一弹窗，替代新开页面） ──────────────────────────────────────
const preview = useDrivePreview(() => filteredList.value as any[])
const { state: previewState, openPreview, closePreview, resolvePreviewUrl: resolvePreviewUrlItem } = preview

function previewDownload(item: Record<string, any>) {
  window.open(getDownloadUrl(item.fileId), '_blank')
}

// 重置选择:筛选/目录/排序变化
watch([filterActive, () => fileStore.parentId], () => {
  selected.value = []
  fileStore.setMultipleSelection([])
})

function applyFilter(f: typeof filter.value) {
  filter.value = { ...f }
}

// ─── 快捷键派发的文件操作 ─────────────────────────────────────────────────────
// 上传：转发到全局上传器
const { addFiles: uploadAddFiles } = useUploader()

function triggerUpload() {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.style.display = 'none'
  input.onchange = () => {
    if (input.files?.length) uploadAddFiles(input.files)
    input.remove()
  }
  document.body.appendChild(input)
  input.click()
}

function downloadSelected() {
  if (!selectedRows.value.length) {
    ElMessage.warning('请先选择要下载的文件')
    return
  }
  if (selectedRows.value.some((r) => r.fileType === 0)) {
    ElMessage.error('文件夹暂不支持下载')
    return
  }
  batchDownload(selectedRows.value)
}

// 单个文件下载（DrivePreviewModal 弹窗"下载"按钮）
function onDownload(row: Record<string, any>) {
  if (!row) return
  if (row.fileType === 0) {
    ElMessage.error('文件夹暂不支持下载')
    return
  }
  batchDownload([row])
}

function renameSelected() {
  if (!selectedRows.value.length) {
    ElMessage.error('请先选择要重命名的文件')
    return
  }
  if (selectedRows.value.length > 1) batchRename(selectedRows.value)
  else promptRename(selectedRows.value[0])
}

function refreshList() {
  fileStore.loadFileList()
}

async function createFolder() {
  try {
    const { value: name } = await ElMessageBox.prompt('请输入文件夹名称', '新建文件夹', {
      inputValidator: (val) => (val && val.trim()) || '名称不能为空',
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    })
    if (!name) return
    fileService.createFolder(
      { parentId: fileStore.parentId, filename: name.trim() },
      () => {
        ElMessage.success('新建成功')
        fileStore.loadFileList()
      },
      (err) => ElMessage.error(err.message)
    )
  } catch {
    // 取消
  }
}

const selectedRows = computed(() =>
  filteredList.value.filter((r) => selected.value.includes(r.fileId))
)

const selectedCount = computed(() => selected.value.length)

const columns = computed<Array<{ key: string; title: string; width: string | number; align?: 'center' | 'left' | 'right' }>>(() => {
  const base: Array<{ key: string; title: string; width: string | number; align?: 'center' | 'left' | 'right' }> = [
    { key: 'filename', title: '文件名', width: 'auto' }
  ]
  if (searchFlag.value)
    base.push({ key: 'parentFilename', title: '位置', width: 140, align: 'center' })
  base.push(
    { key: 'fileSizeDesc', title: '大小', width: 110, align: 'right' },
    { key: 'fileType', title: '类型', width: 96, align: 'center' },
    { key: 'updateTime', title: '修改时间', width: 172, align: 'center' }
  )
  return base
})

function getFileTypeLabel(row: any) {
  const type = row.fileType
  if (type === 0 || row.folderFlag === 1) return '文件夹'
  if (type === 7) return '图片'
  if (type === 9) return '视频'
  if (type === 8) return '音乐'
  if (type === 11) return '代码'
  // 文档子类型（对应后端 FileTypeEnum）
  const docTypes: Record<number, string> = {
    3: 'Excel',
    4: 'Word',
    5: 'PDF',
    6: '文本',
    10: 'PPT',
    12: 'CSV'
  }
  if (docTypes[type]) return docTypes[type]
  return '其他'
}

function handleSelectionChange(keys: string[]) {
  // 只保留当前列表里真实存在且 fileId 有效的选中项，剔除脏 key，
  // 避免选中快照与渲染列表脱节导致分享等操作拿到缺失字段的对象
  const validKeys = keys.filter((k) => !!k && fileList.value.some((r) => r.fileId === k))
  selected.value = validKeys
  const rows = fileList.value.filter((r) => validKeys.includes(r.fileId))
  fileStore.setMultipleSelection(rows)
}

function selectAll() {
  selected.value = filteredList.value.map((r) => r.fileId)
  handleSelectionChange([...selected.value])
}

function clearSelection() {
  selected.value = []
  handleSelectionChange([])
}

// ─── 点击文件名 ────────────────────────────────────────────────────────────
function goInFolder(fileId: string) {
  fileService.getBreadcrumbs(
    { fileId },
    (res) => {
      fileStore.setSearchFlag(false)
      breadcrumbStore.clear()
      breadcrumbStore.reset(res.data as any)
      fileStore.setParentId(fileId)
      fileStore.loadFileList()
    },
    (res) => ElMessage.error(res.message)
  )
}

function openNewPage(path: string, name: string, params: Record<string, string>, query: Record<string, string>) {
  // Vue Router 用 name 解析时会检查 params，必须保证每个必填参数都有值。
  // 注意：不要同时传 path，否则 params 会被忽略。
  const safeParams: Record<string, string> = {}
  Object.entries(params).forEach(([key, value]) => {
    safeParams[key] = value || '0'
  })
  const { href } = router.resolve({ name, params: safeParams, query })
  window.open(href, '_blank')
}

function clickFilename(row: Record<string, any>) {
  // 文件夹：进入目录（后端统一用 fileType === 0 判断，type === 'folder' 为冗余字段）
  if (row.fileType === 0) {
    return goInFolder(panUtil.handleId(row.fileId))
  }
  // 图片/视频/音频/PDF/Office/Markdown/代码/文本：统一走内嵌预览弹窗
  // （不再新开页面；用户如需新窗口可在弹窗底部「新窗口打开」）
  const opened = openPreview({
    fileId: row.fileId,
    filename: row.filename,
    fileType: row.fileType
  })
  if (opened) return

  // 弹窗不支持的格式：按后端 fileType（分类码）降级回新开页面。
  // 注意：这里不能再用 resolvePreviewKind（它按扩展名判断，与弹窗内部一致，
  // 对 .psd/.eps/.tga/.tiff 等「后端认图片但前端扩展名表未收录」的格式会误判为 unsupported）。
  switch (row.fileType) {
    case 3:
    case 4:
    case 10:
      return openNewPage('/preview/office', 'PreviewOffice', { fileId: panUtil.handleId(row.fileId) }, { filename: row.filename })
    case 5:
    case 6:
    case 12:
      return openNewPage('/preview/iframe', 'PreviewIframe', { fileId: panUtil.handleId(row.fileId) }, { filename: row.filename })
    case 7:
      return openNewPage('/preview/image', 'PreviewImage', { fileId: panUtil.handleId(row.fileId), parentId: panUtil.handleId(row.parentId || '0') }, { filename: row.filename })
    case 8:
      return openNewPage('/preview/music', 'PreviewMusic', { fileId: panUtil.handleId(row.fileId), parentId: panUtil.handleId(row.parentId || '0') }, { filename: row.filename })
    case 9:
      return openNewPage('/preview/video', 'PreviewVideo', { fileId: panUtil.handleId(row.fileId) }, { filename: row.filename })
    case 11:
      return openNewPage('/preview/code', 'PreviewCode', { fileId: panUtil.handleId(row.fileId) }, { filename: row.filename })
  }
}

// ─── 行点击 ────────────────────────────────────────────────────────────────
function onRowClick(row: Record<string, any>, e?: MouseEvent) {
  const id = row.fileId
  if (e && (e.ctrlKey || e.metaKey)) {
    const idx = selected.value.indexOf(id)
    selected.value = idx === -1 ? [...selected.value, id] : selected.value.filter((k) => k !== id)
  } else {
    selected.value = [id]
  }
  handleSelectionChange([...selected.value])
}

// ─── 行双击 ───────────────────────────────────────────────────────────────
const { add: addRecent } = useRecent()

function onRowDblclick(row: Record<string, any>) {
  addRecent(row as any)
  clickFilename(row)
}

// ─── 批量下载 ────────────────────────────────────────────────────────────────
async function batchDownload(rows: Record<string, any>[]) {
  if (!rows?.length) return
  if (rows.length === 1) {
    const r = rows[0]
    const url = getDownloadUrl(r.fileId)
    const a = document.createElement('a')
    a.href = url
    a.download = r.filename || ''
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    a.remove()
    return
  }
  ElMessage.info(`正在打包 ${rows.length} 个文件...`)
  const fileIds = rows.map((r) => r.fileId)
  fileService.archiveDownload(
    { fileIds },
    (res) => {
      const blob =
        res instanceof Blob ? res : new Blob([res.data || res] as unknown as BlobPart[], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `xpan-files-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
      ElMessage.success(`已下载 ${rows.length} 个文件（zip 打包）`)
    },
    (err) => ElMessage.error(err.message || '打包下载失败')
  )
}

// ─── 媒体缓存失效 ────────────────────────────────────────────────────────────
// 文件删除/重命名/移动后，清除对应的缩略图/封面缓存（IndexedDB、内存、视频封面），
// 避免展示过期的旧位图。重命名可能改变扩展名进而改变 fileType，需一并失效。
function invalidateMediaCache(rows: Record<string, any>[]) {
  rows.forEach((r) => {
    const id = r.fileId
    if (!id) return
    removeThumbnailFromCache(id)
    invalidatePreviewUrl(id, 256)
    invalidatePreviewUrl(id, 'original')
    invalidateVideoCoverCache(String(id))
  })
}

// ─── 批量删除 ────────────────────────────────────────────────────────────────
function batchDelete(rows: Record<string, any>[]) {
  if (!rows?.length) return
  const fileIds = rows.map((r) => r.fileId)
  fileService.delete(
    { fileIds },
    () => {
      invalidateMediaCache(rows)
      ElMessage.success(`已删除 ${rows.length} 个文件`)
      selected.value = []
      fileStore.loadFileList()
    },
    (err) => ElMessage.error(err.message)
  )
}

// ─── 键盘行导航（↑↓ 选择 / Enter→ 打开 / ← 返回 / Space 多选 / Esc 取消） ──────
const activeIndex = ref(-1)
const activeRow = computed(() =>
  activeIndex.value >= 0 && activeIndex.value < filteredList.value.length
    ? filteredList.value[activeIndex.value]
    : null
)
const activeKey = computed(() => activeRow.value?.fileId ?? '')

// 高亮行自动滚动入视区
function scrollActiveIntoView() {
  if (!activeKey.value) return
  nextTick(() => {
    const el = document.querySelector(
      `[data-active="true"], [data-file-id="${activeKey.value}"]`
    ) as HTMLElement | null
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}
watch(activeIndex, scrollActiveIntoView)

function ensureActive() {
  if (activeIndex.value < 0 && filteredList.value.length) activeIndex.value = 0
}

function goUp() {
  const list = breadcrumbStore.breadcrumbList
  if (list.length >= 2) {
    const parent = list[list.length - 2]
    goInFolder(panUtil.handleId(parent.id))
  }
}

function onKeyDown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return
  const len = filteredList.value.length
  if (len === 0) return

  // 方向键：移动高亮行
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    ensureActive()
    activeIndex.value = Math.min(activeIndex.value + 1, len - 1)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    ensureActive()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
    return
  }
  // Enter / → 打开高亮行
  if ((e.key === 'Enter' || e.key === 'ArrowRight') && activeRow.value) {
    e.preventDefault()
    clickFilename(activeRow.value)
    return
  }
  // ← 返回上一级目录
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    goUp()
    return
  }
  // Space 切换高亮行选中
  if (e.key === ' ' && activeRow.value) {
    e.preventDefault()
    const id = activeRow.value.fileId
    const idx = selected.value.indexOf(id)
    selected.value = idx === -1 ? [...selected.value, id] : selected.value.filter((k) => k !== id)
    handleSelectionChange([...selected.value])
    return
  }
  if (e.key === 'Escape') {
    selected.value = []
    activeIndex.value = -1
    handleSelectionChange([])
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault()
    selected.value = filteredList.value.map((r) => r.fileId)
    handleSelectionChange([...selected.value])
    return
  }
  if (e.key === 'Delete' && selected.value.length > 0) {
    e.preventDefault()
    batchDelete(selectedRows.value)
    return
  }
  const mod = e.ctrlKey || e.metaKey
  const k = e.key.toLowerCase()
  const rows = selectedRows.value.length ? selectedRows.value : []
  if (mod && k === 'x' && rows.length > 0) {
    e.preventDefault()
    cutFiles(rows)
    return
  }
  if (mod && k === 'c' && rows.length > 0) {
    e.preventDefault()
    copyFiles(rows)
    return
  }
  if (mod && k === 'v' && hasClipboard.value) {
    e.preventDefault()
    doPaste()
    return
  }
}

// ─── 滚动加载 ───────────────────────────────────────────────────────────────
const loadMoreSentinel = ref<HTMLElement | null>(null)
let intersectionObserver: IntersectionObserver | null = null

function setupIntersectionObserver() {
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (
          entry.isIntersecting &&
          hasMore.value &&
          !isLoadingMore.value &&
          !filterActive.value &&
          !searchFlag.value
        ) {
          fileStore.loadMore()
        }
      }
    },
    { rootMargin: '200px' }
  )
  nextTick(() => {
    if (loadMoreSentinel.value) {
      intersectionObserver!.observe(loadMoreSentinel.value)
    }
  })
}

function teardownIntersectionObserver() {
  if (intersectionObserver) {
    intersectionObserver.disconnect()
    intersectionObserver = null
  }
}

// 移动端卡片列表滚动到底部时触发（等效桌面 loadMoreSentinel）
function onLoadMore() {
  if (hasMore.value && !isLoadingMore.value && !filterActive.value && !searchFlag.value) {
    fileStore.loadMore()
  }
}

watch([() => filteredList.value.length, hasMore], () => {
  if (!intersectionObserver) return
  nextTick(() => {
    if (loadMoreSentinel.value) {
      intersectionObserver!.unobserve(loadMoreSentinel.value)
      intersectionObserver!.observe(loadMoreSentinel.value)
    }
  })
})

// 列表刷新/翻页后，基于最新 fileList 重新校验选中项，剔除已不存在的脏 key，
// 保证 store 的 multipleSelection 始终是当前列表中的完整对象（供分享/详情等使用）
watch(
  () => fileList.value,
  (list) => {
    const keys = selected.value
    if (!keys.length) return
    const validKeys = keys.filter((k) => !!k && list.some((r) => r.fileId === k))
    if (validKeys.length !== keys.length) {
      selected.value = validKeys
    }
    fileStore.setMultipleSelection(list.filter((r) => validKeys.includes(r.fileId)))
  }
)

// ─── 框选 ──────────────────────────────────────────────────────────────────
const selBox = ref({ active: false, x1: 0, y1: 0, x2: 0, y2: 0 })
const selContainer = ref<HTMLElement | null>(null)

function onSelStart(e: MouseEvent) {
  if (e.button !== 0) return
  const t = e.target as HTMLElement
  if (t.closest('[data-file-id]')) return
  if (t.closest('button, input, a, [contenteditable]')) return
  if (!selContainer.value) return

  const rect = selContainer.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  selBox.value = { active: true, x1: x, y1: y, x2: x, y2: y }

  if (!e.shiftKey && selected.value.length > 0) {
    selected.value = []
    handleSelectionChange([])
  }

  const onMove = (ev: MouseEvent) => {
    if (!selBox.value.active) return
    selBox.value.x2 = ev.clientX - rect.left
    selBox.value.y2 = ev.clientY - rect.top
    updateSelFromBox()
  }
  const onUp = () => {
    selBox.value.active = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function updateSelFromBox() {
  if (!selContainer.value) return
  const b = selBox.value
  const left = Math.min(b.x1, b.x2)
  const right = Math.max(b.x1, b.x2)
  const top = Math.min(b.y1, b.y2)
  const bottom = Math.max(b.y1, b.y2)
  if (right - left < 4 && bottom - top < 4) return

  const containerRect = selContainer.value.getBoundingClientRect()
  const cards = selContainer.value.querySelectorAll('[data-file-id]')
  const hitIds: string[] = []
  cards.forEach((card) => {
    const r = (card as HTMLElement).getBoundingClientRect()
    const cx = r.left - containerRect.left
    const cy = r.top - containerRect.top
    if (cx < right && cx + r.width > left && cy < bottom && cy + r.height > top) {
      hitIds.push((card as HTMLElement).dataset.fileId as string)
    }
  })
  const matched = filteredList.value.filter((r) => hitIds.includes(String(r.fileId)))
  if (matched.length > 0) {
    selected.value = matched.map((r) => r.fileId)
    handleSelectionChange([...selected.value])
  }
}

const selBoxStyle = computed(() => {
  const b = selBox.value
  if (!b.active) return { display: 'none' }
  return {
    left: Math.min(b.x1, b.x2) + 'px',
    top: Math.min(b.y1, b.y2) + 'px',
    width: Math.abs(b.x2 - b.x1) + 'px',
    height: Math.abs(b.y2 - b.y1) + 'px'
  }
})

// ─── 收藏 ─────────────────────────────────────────────────────────────────
const { isFavorite, toggle: toggleFavorite, ensureLoaded: ensureFavoritesLoaded } = useFavorites()

// ─── 移动/复制对话框 ──────────────────────────────────────────────────────
const moveDialog = ref({ open: false, mode: 'move' as 'move' | 'copy', row: null as any })

function openMoveDialog(rows: any[]) {
  moveDialog.value = { open: true, mode: 'move', row: rows || null }
}

function onMoveComplete() {
  // 移动可能改变文件所在目录，需失效其缩略图/封面缓存（移动后 fileId 不变，但保险起见清理）
  const movedRows = moveDialog.value.row
  if (Array.isArray(movedRows)) invalidateMediaCache(movedRows)
  else if (movedRows) invalidateMediaCache([movedRows])
  ElMessage.success('已移动到目标文件夹')
  moveDialog.value.open = false
  fileStore.loadFileList()
}

// ─── 在线解压 ──────────────────────────────────────────────────────────────
const extractDialog = ref({ open: false, fileId: '', filename: '' })

function openExtractDialog(row: any) {
  if (!row) return
  extractDialog.value = {
    open: true,
    fileId: panUtil.handleId(row.fileId),
    filename: row.filename || ''
  }
}

function onExtracted() {
  fileStore.loadFileList()
}

// ─── 右键菜单 ──────────────────────────────────────────────────────────────
const ctxMenu = ref({ visible: false, x: 0, y: 0, row: null as any })

function onContextMenu(e: MouseEvent, row: any) {
  e.preventDefault()
  if (row && !selected.value.includes(row.fileId)) {
    selected.value = [row.fileId]
    handleSelectionChange([row.fileId])
  }
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, row }
}

function closeCtxMenu() {
  ctxMenu.value.visible = false
}

function onCtxSelect(item: any) {
  if (item && typeof item.action === 'function') item.action()
}

// ─── 剪贴板（剪切/复制/粘贴） ─────────────────────────────────────────
const hasClipboard = computed(() => !!clipboard.value && clipboard.value.files.length > 0)
const clipboardText = computed(() => {
  if (!hasClipboard.value) return '粘贴'
  const cb = clipboard.value!
  const n = cb.files.length
  return cb.mode === 'cut' ? `粘贴（移动 ${n} 项）` : `粘贴（复制 ${n} 项）`
})

/** 剪切选中项 */
function cutFiles(files: any[]) {
  fileStore.cutFiles(files)
  ElMessage.success('已剪切，到目标目录粘贴')
}
/** 复制选中项 */
function copyFiles(files: any[]) {
  fileStore.copyFiles(files)
  ElMessage.success('已复制，到目标目录粘贴')
}
/** 粘贴（移动到/复制到当前目录） */
async function doPaste() {
  const res = await fileStore.paste()
  if (res.success) {
    ElMessage.success('粘贴成功')
  } else {
    ElMessage.error(res.message || '粘贴失败')
  }
}

const ctxItems = computed(() => {
  const r = ctxMenu.value.row
  if (!r) return []
  const isFolder = r.fileType === 0
  const isMulti = selectedRows.value.length > 1
  const multiRows = selectedRows.value.length ? selectedRows.value : [r]

  return [
    {
      key: 'open',
      label: isFolder ? '打开' : '预览',
      shortcut: 'Enter',
      action: () => (isFolder ? goInFolder(panUtil.handleId(r.fileId)) : onRowDblclick(r))
    },
    {
      key: 'download',
      label: isMulti ? `下载 ${selectedRows.value.length} 项` : '下载',
      icon: Download,
      shortcut: 'Ctrl+D',
      disabled: isFolder,
      action: () => batchDownload(multiRows)
    },
    {
      key: 'rename',
      label: isMulti ? `批量重命名 ${selectedRows.value.length} 项` : '重命名',
      icon: Edit2,
      shortcut: 'F2',
      action: () => {
        if (isMulti) batchRename(selectedRows.value)
        else promptRename(r)
      }
    },
    {
      key: 'copy',
      label: '复制到...',
      action: () => { moveDialog.value = { open: true, mode: 'copy', row: multiRows } }
    },
    {
      key: 'move',
      label: '移动到...',
      action: () => openMoveDialog(multiRows)
    },
    {
      key: 'cut',
      label: isMulti ? `剪切 ${selectedRows.value.length} 项` : '剪切',
      shortcut: 'Ctrl+X',
      action: () => cutFiles(multiRows)
    },
    {
      key: 'copyClip',
      label: isMulti ? `复制 ${selectedRows.value.length} 项` : '复制',
      shortcut: 'Ctrl+C',
      action: () => copyFiles(multiRows)
    },
    {
      key: 'paste',
      label: clipboardText.value,
      shortcut: 'Ctrl+V',
      disabled: !hasClipboard,
      action: () => doPaste()
    },
    {
      key: 'share',
      label: '分享',
      icon: Share2,
      disabled: isFolder,
      action: () => emit('share', r)
    },
    {
      key: 'extract',
      label: '在线解压',
      icon: FileArchive,
      // 仅单文件压缩包支持，文件夹/多选/非压缩包隐藏
      visible: !isMulti && !isFolder && isArchive(r),
      action: () => openExtractDialog(r)
    },
    {
      divider: true
    },
    {
      key: 'favorite',
      label: isFavorite(r.fileId) ? '取消收藏' : '收藏',
      icon: Star,
      action: () => toggleFavorite(r)
    },
    {
      key: 'delete',
      label: isMulti ? `删除 ${selectedRows.value.length} 项` : '删除',
      icon: Trash2,
      shortcut: 'Del',
      danger: true,
      action: () => batchDelete(multiRows)
    }
  ].filter((item) => item.visible !== false)
})

// ─── 重命名 ────────────────────────────────────────────────────────────────
async function promptRename(row: any) {
  const oldName = row.filename || ''
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
      { fileId: row.fileId, filename: newName.trim() },
      () => {
        invalidateMediaCache([row])
        ElMessage.success('重命名成功')
        fileStore.loadFileList()
      },
      (err) => ElMessage.error(err.message)
    )
  } catch {
    // 取消
  }
}

async function batchRename(rows: Record<string, any>[]) {
  if (!rows?.length) return
  const base = rows[0].filename || 'file'
  const dotIdx = base.lastIndexOf('.')
  const baseName = dotIdx > 0 ? base.slice(0, dotIdx) : base
  const ext = dotIdx > 0 ? base.slice(dotIdx) : ''

  try {
    const { value } = await ElMessageBox.prompt(
      `将对 ${rows.length} 个文件批量重命名，自动添加序号 (1)(2)...`,
      '批量重命名',
      {
        inputValue: baseName,
        inputValidator: (val) => (val && val.trim()) || '名称不能为空',
        confirmButtonText: '确认',
        cancelButtonText: '取消'
      }
    )
    if (!value) return

    let successCount = 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const dot = (row.filename || '').lastIndexOf('.')
      const e = dot > 0 ? (row.filename || '').slice(dot) : ''
      const newName = `${value.trim()}(${i + 1})${e}`
      await new Promise((resolve) => {
        fileService.update(
          { fileId: row.fileId, filename: newName },
          () => { successCount++; resolve(true) },
          () => resolve(false)
        )
      })
    }
    ElMessage.success(`批量重命名完成，成功 ${successCount}/${rows.length} 个`)
    invalidateMediaCache(rows)
    fileStore.loadFileList()
  } catch {
    // 取消
  }
}

// 暴露方法给父组件（列表/网格视图切换、筛选、快捷键操作、批量选择）
defineExpose({
  applyFilter,
  setView: (v: string) => { currentView.value = v as 'list' | 'grid' },
  download: downloadSelected,
  rename: renameSelected,
  refresh: refreshList,
  createFolder,
  triggerUpload,
  selectedRows,
  selectedCount,
  batchDownload,
  batchDelete,
  batchRename,
  toggleFavorite,
  selectAll,
  clearSelection
})

onMounted(() => {
  fileStore.setMultipleSelection([])
  window.addEventListener('keydown', onKeyDown)
  setupIntersectionObserver()
  ensureFavoritesLoaded()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  teardownIntersectionObserver()
})

</script>

<template>
  <div class="h-full flex flex-col">

    <!-- 列表视图（移动端：卡片列表；桌面：表格） -->
    <div v-if="currentView === 'list'" class="flex-1 min-h-0 flex flex-col overflow-hidden">
      <!-- 移动端卡片列表：单击选中+打开，长按上下文菜单，无横向溢出 -->
      <FileCardList
        v-if="isMobile"
        :data="filteredList"
        :selected="selected"
        :loading="tableLoading"
        :skeleton="tableLoading && filteredList.length === 0"
        :filter-active="filterActive"
        :has-more="hasMore"
        :is-loading-more="isLoadingMore"
        :total="total"
        @row-click="(row: any, e: MouseEvent) => onRowClick(row, e)"
        @open="clickFilename"
        @contextmenu="(e: MouseEvent, row: any) => onContextMenu(e, row)"
        @load-more="onLoadMore"
      >
        <template #after-list>
          <slot name="after-list" />
        </template>
      </FileCardList>

      <BaseTable
        v-else
        :columns="columns"
        :data="filteredList"
        :loading="tableLoading"
        :skeleton="tableLoading && filteredList.length === 0"
        selectable
        row-key="fileId"
        :active-key="activeKey"
        :selected="selected"
        empty-text="该文件夹为空，试试上传文件"
        :sort-field="sortProp"
        :sort-order="sortOrder"
        @update:selected="(v: any) => handleSelectionChange(v)"
        @rowClick="(row: any, idx: number, e: MouseEvent) => onRowClick(row, e)"
        @rowDblclick="onRowDblclick"
        @rowContextmenu="(e: MouseEvent, row: any) => onContextMenu(e, row)"
      >
        <template #cell-filename="{ row }">
          <BaseTooltip :text="row.filename" position="top">
            <button
              type="button"
              class="group flex items-center gap-3.5 text-left w-full min-w-0"
              @click.stop="onRowClick(row)"
              @dblclick.stop="clickFilename(row)"
            >
              <FileThumbnail
                :file="row"
                :size="38"
                rounded="rounded-md"
                class="ring-1 ring-(--color-border)/60"
              />
              <span
                class="truncate text-[13.5px] font-medium text-(--color-text) group-hover:text-primary-600 transition-colors"
              >
                {{ row.filename }}
              </span>
            </button>
          </BaseTooltip>
        </template>

        <template #cell-parentFilename="{ row }">
          <button
            type="button"
            class="text-xs text-primary-500 hover:underline"
            @click="goInFolder(row.parentId)"
          >
            {{ row.parentFilename }}
          </button>
        </template>

        <template #cell-fileType="{ row }">
          <span
            class="inline-flex items-center px-2 h-6 rounded-full text-[11px] font-medium"
            style="background-color: var(--color-surface-2); color: var(--color-text-secondary);"
          >
            {{ getFileTypeLabel(row) }}
          </span>
        </template>

        <template #cell-fileSizeDesc="{ row }">
          <span class="text-[13px] text-(--color-text-secondary) tabular-nums">
            {{ row.fileSizeDesc }}
          </span>
        </template>

        <template #cell-updateTime="{ row }">
          <span class="text-[13px] text-(--color-text-muted) tabular-nums">
            {{ row.updateTime }}
          </span>
        </template>

        <template #empty>
          <BaseEmpty
            :icon="filterActive ? SearchX : FolderOpen"
            :title="filterActive ? '没有符合筛选条件的文件' : '该文件夹为空'"
            :description="filterActive ? '试着调整筛选条件或清除筛选' : '将文件拖拽到此处，或点击上方按钮添加文件'"
          />
        </template>

        <!-- 上传提示：转发给 BaseTable，渲染在其滚动区内，跟随数据滚动 -->
        <template #after-list>
          <slot name="after-list" />
        </template>
      </BaseTable>
    </div>

    <!-- 网格视图 -->
    <div v-else class="flex-1 min-h-0 overflow-y-auto px-1 pb-4">
      <!-- 骨架屏 -->
      <div
        v-if="tableLoading && filteredList.length === 0"
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-1"
      >
        <div
          v-for="i in 12"
          :key="i"
          class="aspect-square rounded-sm border border-(--color-border) bg-(--color-surface) p-4 animate-pulse flex flex-col items-center justify-center gap-2"
        >
          <div class="size-14 rounded-sm bg-(--color-surface-2)" />
          <div class="h-3 w-3/4 rounded bg-(--color-surface-2)" />
        </div>
      </div>

      <!-- 空状态 -->
      <BaseEmpty
        v-else-if="filteredList.length === 0"
        :icon="filterActive ? SearchX : FolderOpen"
        :title="filterActive ? '没有符合筛选条件的文件' : '该文件夹为空'"
        :description="filterActive ? '试着调整筛选条件或清除筛选' : '将文件拖拽到此处，或点击上方按钮添加文件'"
      />

      <!-- 文件网格 -->
      <div
        v-else
        ref="selContainer"
        class="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-1 select-none"
        @mousedown="onSelStart"
      >
        <!-- 框选虚线框 -->
        <div
          v-if="selBox.active"
          class="absolute pointer-events-none border-2 border-dashed border-primary-500 bg-primary-500/10 rounded-sm z-20"
          :style="selBoxStyle"
        />

        <button
          v-for="row in filteredList"
          :key="row.fileId"
          type="button"
          :data-file-id="row.fileId"
          class="group relative aspect-square rounded-sm border transition-all p-3 flex flex-col items-center justify-center text-center"
          :class="
            [
              selected.includes(row.fileId)
                ? 'border-primary-500 ring-2 ring-primary-500/20 bg-primary-500/5'
                : 'border-(--color-border) hover:border-primary-400 hover:shadow-sm bg-(--color-surface)',
              activeKey === row.fileId ? 'outline outline-2 outline-primary-500' : ''
            ]
          "
          @click="onRowClick(row)"
          @dblclick="onRowDblclick(row)"
          @contextmenu="onContextMenu($event, row)"
        >
          <!-- 选中指示 -->
          <div
            v-if="selected.includes(row.fileId)"
            class="absolute top-2 right-2 size-[18px] rounded-[4px] bg-primary-500 flex items-center justify-center shadow-sm"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" class="size-3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <FileThumbnail :file="row" :size="56" rounded="rounded-sm" class="mb-2" />

          <BaseTooltip :text="row.filename" position="top">
            <p class="text-xs font-medium text-(--color-text) line-clamp-2 leading-snug w-full break-all">
              {{ row.filename }}
            </p>
          </BaseTooltip>
          <p class="text-[10px] text-(--color-text-muted) tabular-nums mt-0.5">
            {{ row.fileSizeDesc }}
          </p>
        </button>
      </div>

      <!-- 加载更多 -->
      <div
        v-if="!filterActive && hasMore && filteredList.length > 0"
        ref="loadMoreSentinel"
        class="py-6 flex items-center justify-center text-xs text-(--color-text-muted)"
      >
        <LoaderCircle v-if="isLoadingMore" :size="14" class="animate-spin mr-2" />
        {{ isLoadingMore ? '加载中...' : '滚动加载更多' }}
      </div>
      <div
        v-else-if="!filterActive && !hasMore && filteredList.length > 0"
        class="py-4 text-center text-xs text-(--color-text-muted)"
      >
        已加载全部 {{ total }} 个文件
      </div>
    </div>

    <!-- 右键菜单 -->
    <ContextMenu
      :visible="ctxMenu.visible"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      :items="ctxItems"
      @select="onCtxSelect"
      @close="closeCtxMenu"
    />

    <!-- 移动/复制对话框 -->
    <FolderPickerDialog
      v-if="moveDialog.open"
      :open="moveDialog.open"
      :mode="moveDialog.mode"
      :row="moveDialog.row"
      @update:open="(v: boolean) => (moveDialog.open = v)"
      @complete="onMoveComplete"
    />

    <!-- 在线解压 -->
    <ExtractDialog
      v-model:open="extractDialog.open"
      :file-id="extractDialog.fileId"
      :filename="extractDialog.filename"
      @extracted="onExtracted"
    />

    <!-- 统一预览弹窗（图片/视频/音频/PDF/Office/代码等，替代新开页面） -->
    <DrivePreviewModal
      :state="previewState"
      :resolve-url="resolvePreviewUrlItem"
      @close="closePreview"
      @download="previewDownload"
    />

  </div>
</template>
