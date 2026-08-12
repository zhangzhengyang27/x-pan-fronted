<script setup lang="ts">
/**
 * AppFileTable —— 主文件列表
 * P0 增强：
 * 1. 排序（name/size/date asc/desc）
 * 2. 筛选（扩展名 / 大小 / 时间）
 * 3. 批量下载（多文件下载）
 * 4. 多选 + 快捷键（Ctrl+A / Delete / F2）
 */
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import DownloadButton from '@/components/buttons/download-button/index.vue'
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
import DrivePreviewModal from '@/components/preview/drive-preview-modal.vue'
import ExtractDialog from '@/components/base/ExtractDialog.vue'
import FileTableToolbar from './FileTableToolbar.vue'
import FileThumbnail from './FileThumbnail.vue'
import FileHistoryPanel from './FileHistoryPanel.vue'
import { useFavorites } from '@/composables/useFavorites'
import { useRecent } from '@/composables/useRecent'
import { useDrivePreview } from '@/composables/useDrivePreview'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { useFileTags } from '@/composables/useFileTags'
import { getDownloadUrl } from '@/utils/preview'
import {
  LoaderCircle,
  Download,
  Edit3,
  Copy,
  Trash2,
  Share2,
  FolderInput,
  Star,
  Eye,
  History,
  QrCode,
  Edit2,
  Tags,
  Sparkles,
  SearchX,
  FolderOpen,
  FileArchive,
  Shield
} from '@lucide/vue'
import QRCode from 'qrcode'
import shareService from '@/api/share'
import vaultService from '@/api/vault'

const router = useRouter()
const fileStore = useFileStore()
const breadcrumbStore = useBreadcrumbStore()
const { fileList, tableLoading, searchFlag, hasMore, isLoadingMore, total, sortProp, sortOrder } = storeToRefs(fileStore)

const selected = ref([]) // 多选 fileId
const view = ref('list') // 'list' | 'grid'
const isMobile = useMediaQuery('(max-width: 768px)').matches

// ─── 移动/复制对话框（占位 → 真实 FolderPickerDialog） ─────────────────
const moveDialog = ref({ open: false, mode: 'move', row: null })

function openMoveDialog(row) {
  moveDialog.value = { open: true, mode: 'move', row: row || null }
}

function onMoveComplete() {
  ElMessage.success('已移动到目标文件夹')
  moveDialog.value.open = false
  fileStore.loadFileList()
}

// ─── 排序 / 筛选 ────────────────────────────────────────────────────────────
// 排序状态提升到 fileStore，与 FileTableToolbar 共享
const filter = ref({ extensions: [], sizeMin: '', sizeMax: '', dateFrom: '', dateTo: '' })

const filterActive = computed(() => {
  return (
    filter.value.extensions.length > 0 ||
    filter.value.sizeMin !== '' ||
    filter.value.sizeMax !== '' ||
    filter.value.dateFrom !== '' ||
    filter.value.dateTo !== ''
  )
})

// 筛选 / 排序 / 切目录时，重置选择
watch([filterActive, () => fileStore.parentId], () => {
  selected.value = []
  fileStore.setMultipleSelection([])
})

// 启用筛选 → 自动拉全量；关闭筛选 → 恢复分页
watch(filterActive, (active) => {
  if (active && !searchFlag.value) {
    fileStore.loadAllForFilter()
  } else if (!active && !searchFlag.value && fileStore.total > 0) {
    fileStore.loadFileList()
  }
})

const availableExtensions = computed(() => {
  const set = new Set()
  fileList.value.forEach((r) => {
    const fn = r.filename || r.name || ''
    const idx = fn.lastIndexOf('.')
    if (idx > 0 && idx < fn.length - 1) {
      set.add(fn.slice(idx + 1).toLowerCase())
    }
  })
  return Array.from(set).sort()
})

const filteredList = computed(() => {
  let items = fileList.value
  if (filter.value.extensions.length) {
    items = items.filter((r) => {
      const fn = r.filename || r.name || ''
      const idx = fn.lastIndexOf('.')
      if (idx <= 0) return false
      return filter.value.extensions.includes(fn.slice(idx + 1).toLowerCase())
    })
  }
  if (filter.value.sizeMin !== '') {
    const min = Number(filter.value.sizeMin) * 1024 * 1024
    items = items.filter((r) => Number(r.fileSize || r.size || 0) >= min)
  }
  if (filter.value.sizeMax !== '') {
    const max = Number(filter.value.sizeMax) * 1024 * 1024
    items = items.filter((r) => Number(r.fileSize || r.size || 0) <= max)
  }
  if (filter.value.dateFrom) {
    const from = new Date(filter.value.dateFrom).getTime()
    items = items.filter((r) => new Date(r.updateTime || r.updatedAt || 0).getTime() >= from)
  }
  if (filter.value.dateTo) {
    const to = new Date(filter.value.dateTo).getTime() + 86400000
    items = items.filter((r) => new Date(r.updateTime || r.updatedAt || 0).getTime() <= to)
  }
  return fileStore.sortItems(items)
})

const selectedRows = computed(() =>
  filteredList.value.filter((r) => selected.value.includes(r.fileId))
)

const columns = computed(() => {
  const base = [{ key: 'filename', title: '文件名', width: 'auto', sortable: true }]
  if (searchFlag.value)
    base.push({ key: 'parentFilename', title: '位置', width: 140, align: 'center' })
  base.push(
    { key: 'fileSizeDesc', title: '大小', width: 120, align: 'right', sortable: true },
    { key: 'updateTime', title: '修改日期', width: 200, align: 'center', sortable: true },
    { key: 'actions', title: '操作', width: 100, align: 'right' }
  )
  return base
})

function handleSelectionChange(keys) {
  selected.value = keys
  const rows = fileList.value.filter((r) => keys.includes(r.fileId))
  fileStore.setMultipleSelection(rows)
}

function handleSort(field) {
  fileStore.toggleSort(field)
}

function goInFolder(fileId) {
  fileService.getBreadcrumbs(
    { fileId },
    (res) => {
      fileStore.setSearchFlag(false)
      breadcrumbStore.clear()
      breadcrumbStore.reset(res.data)
      fileStore.setParentId(fileId)
      fileStore.loadFileList()
    },
    (res) => ElMessage.error(res.message)
  )
}

function openNewPage(path, name, params, query) {
  const { href } = router.resolve({ path, name, params, query })
  window.open(href, '_blank')
}

function clickFilename(row) {
  switch (row.fileType) {
    case 0:
      return goInFolder(panUtil.handleId(row.fileId))
    case 3:
    case 4:
    case 10:
      return openNewPage(
        '/preview/office',
        'PreviewOffice',
        { fileId: panUtil.handleId(row.fileId) },
        { filename: row.filename }
      )
    case 5:
    case 6:
      return openNewPage(
        '/preview/iframe',
        'PreviewIframe',
        { fileId: panUtil.handleId(row.fileId) },
        { filename: row.filename }
      )
    case 7:
      return openNewPage(
        '/preview/image',
        'PreviewImage',
        { fileId: panUtil.handleId(row.fileId), parentId: panUtil.handleId(row.parentId) },
        { filename: row.filename }
      )
    case 8:
      return openNewPage(
        '/preview/music',
        'PreviewMusic',
        { fileId: panUtil.handleId(row.fileId), parentId: panUtil.handleId(row.parentId) },
        { filename: row.filename }
      )
    case 9:
      return openNewPage(
        '/preview/video',
        'PreviewVideo',
        { fileId: panUtil.handleId(row.fileId), parentId: panUtil.handleId(row.parentId) },
        { filename: row.filename }
      )
    case 11:
      return openNewPage(
        '/preview/code',
        'PreviewCode',
        { fileId: panUtil.handleId(row.fileId) },
        { filename: row.filename }
      )
  }
}

function onRowClick(row) {
  // 单击：切换选中（多选）
  const id = row.fileId
  const idx = selected.value.indexOf(id)
  if (idx === -1) {
    selected.value.push(id)
  } else {
    selected.value.splice(idx, 1)
  }
  handleSelectionChange([...selected.value])
}

// ─── 批量下载 ────────────────────────────────────────────────────────────────
async function batchDownload(rows) {
  if (!rows || rows.length === 0) return

  // 单文件 → 走单个下载
  if (rows.length === 1) {
    const r = rows[0]
    const url = getDownloadUrl(r.fileId)
    const a = document.createElement('a')
    a.href = url
    a.download = r.filename || r.name || ''
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
    return
  }

  // 多文件 → 后端 zip 打包下载（P1.7）
  ElMessage.info(`正在打包 ${rows.length} 个文件...`)
  const fileIds = rows.map((r) => r.fileId).join('__,__')
  fileService.archiveDownload(
    { fileIds },
    (res) => {
      // res 是 Blob
      const blob =
        res instanceof Blob ? res : new Blob([res.data || res], { type: 'application/zip' })
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
    (err) => {
      ElMessage.error(err.message || '打包下载失败')
    }
  )
}

// ─── 批量删除 ────────────────────────────────────────────────────────────────
function batchDelete(rows) {
  if (!rows || rows.length === 0) return
  const fileIds = rows.map((r) => r.fileId).join('__,__')
  fileService.delete(
    { fileIds },
    () => {
      ElMessage.success(`已删除 ${rows.length} 个文件`)
      selected.value = []
      fileStore.loadFileList()
    },
    (err) => ElMessage.error(err.message)
  )
}

// ─── 快捷键 ────────────────────────────────────────────────────────────────
function onKeyDown(e) {
  // 跳过输入框
  const tag = e.target?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return

  // Ctrl+A: 全选
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault()
    selected.value = filteredList.value.map((r) => r.fileId)
    handleSelectionChange([...selected.value])
    return
  }
  // Delete: 删除选中
  if (e.key === 'Delete' && selected.value.length > 0) {
    e.preventDefault()
    batchDelete(selectedRows.value)
    return
  }
  // F2: 重命名第一个选中
  if (e.key === 'F2' && selected.value.length === 1) {
    e.preventDefault()
    const row = selectedRows.value[0]
    if (row) {
      // 重用 promptRename，复用 ElMessageBox.prompt 统一体验
      promptRename(row)
    }
  }
  // Escape: 清空选择
  if (e.key === 'Escape') {
    selected.value = []
    handleSelectionChange([])
  }
}

// 移动端强制网格视图
watch(
  isMobile,
  (v) => {
    if (v) view.value = 'grid'
  },
  { immediate: true }
)

onMounted(() => {
  fileStore.setMultipleSelection([])
  window.addEventListener('keydown', onKeyDown)
  setupIntersectionObserver()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  teardownIntersectionObserver()
})

// ─── 滚动加载（P1.2） ───────────────────────────────────────────────────────
const loadMoreSentinel = ref(null)
let intersectionObserver = null

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
      intersectionObserver.observe(loadMoreSentinel.value)
    }
  })
}

function teardownIntersectionObserver() {
  if (intersectionObserver) {
    intersectionObserver.disconnect()
    intersectionObserver = null
  }
}

// 列表结构变化时重新观察 sentinel
watch([() => filteredList.value.length, hasMore], () => {
  if (!intersectionObserver) return
  nextTick(() => {
    if (loadMoreSentinel.value) {
      intersectionObserver.unobserve(loadMoreSentinel.value)
      intersectionObserver.observe(loadMoreSentinel.value)
    }
  })
})

defineExpose({ setView: (v) => (view.value = v) })

// ─── 预览（弹窗式） ────────────────────────────────────────────────────────
const preview = useDrivePreview(() => fileList.value)

// ─── 收藏 / 最近访问（P1.9） ───────────────────────────────────────────────
const { isFavorite, toggle: toggleFavorite } = useFavorites()
const { visit: visitRecent } = useRecent()
// P3-2：智能打标
const { loading: tagLoading, autoTag, getTags } = useFileTags()

async function handleAutoTag(row) {
  if (tagLoading.value) return
  const tags = await autoTag(row)
  if (tags.length === 0) {
    ElMessage.info('未能生成标签')
  } else {
    ElMessage.success(`已生成 ${tags.length} 个标签：${tags.join('、')}`)
  }
}

function onRowDblclick(row) {
  visitRecent(row) // 记录最近访问
  if (row.fileType === 0) {
    clickFilename(row)
    return
  }
  const opened = preview.openPreview(row)
  if (!opened) {
    clickFilename(row)
  }
}

function previewDownload(item) {
  const url = getDownloadUrl(item.fileId || item.id)
  window.open(url, '_blank')
}

// ─── 右键菜单（P1.12） ────────────────────────────────────────────────────
const ctxMenu = ref({ visible: false, x: 0, y: 0, row: null })

// ─── 版本历史（P1.13） ────────────────────────────────────────────────────
const historyPanel = ref({ open: false, fileId: '' })

function openHistory(row) {
  historyPanel.value = { open: true, fileId: panUtil.handleId(row.fileId) }
}

// ─── 在线解压（P3-3） ───────────────────────────────────────────────────────
const extractDialog = ref({ open: false, fileId: '', filename: '' })

const ARCHIVE_EXTS = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2']

function isArchive(row): boolean {
  if (row.fileType === 0) return false
  const fn = (row.filename || row.name || '').toLowerCase()
  return ARCHIVE_EXTS.some((ext) => fn.endsWith(ext))
}

function openExtract(row) {
  extractDialog.value = {
    open: true,
    fileId: panUtil.handleId(row.fileId),
    filename: row.filename || row.name || ''
  }
}

// ─── 移入保险箱（P3-4） ───────────────────────────────────────────────────
function moveToVault(rows) {
  if (!rows || rows.length === 0) return
  const fileIds = rows.map((r) => panUtil.handleId(r.fileId)).join(',')
  vaultService.move(
    fileIds,
    () => {
      ElMessage.success(`已移入保险箱 ${rows.length} 项`)
      fileStore.loadFileList()
    },
    (err) => {
      const m = (err as { message?: string })?.message
      ElMessage.error(m || '移入保险箱失败')
    }
  )
}

function onContextMenu(e, row) {
  e.preventDefault()
  // 若未选中右键目标，且当前右键的不是已选中的，加入选择
  if (row && !selected.value.includes(row.fileId)) {
    selected.value = [row.fileId]
    handleSelectionChange([row.fileId])
  }
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, row }
}

function closeCtxMenu() {
  ctxMenu.value.visible = false
}

const ctxItems = computed(() => {
  const r = ctxMenu.value.row
  if (!r) return []
  const isFolder = r.fileType === 0
  const favorited = isFavorite(r.fileId)
  const isMulti = selectedRows.value.length > 1
  const multiRows = selectedRows.value.length ? selectedRows.value : [r]
  const archive = isArchive(r)
  return [
    {
      key: 'open',
      label: isFolder ? '打开' : '预览',
      icon: Eye,
      shortcut: 'Enter',
      action: () => (isFolder ? goInFolder(panUtil.handleId(r.fileId)) : onRowDblclick(r))
    },
    // P3-3：压缩包显示"在线解压"
    {
      key: 'extract',
      label: '在线解压',
      icon: FileArchive,
      visible: archive && !isMulti,
      action: () => openExtract(r)
    },
    { divider: true },
    {
      key: 'download',
      label: isMulti ? `下载 ${selectedRows.value.length} 项` : '下载',
      icon: Download,
      shortcut: 'Ctrl+D',
      disabled: isFolder,
      action: () => batchDownload(multiRows)
    },
    {
      // 合并 rename / batchRename：单文件→重命名；多选→批量重命名（自动加序号）
      key: 'rename',
      label: isMulti ? `批量重命名 ${selectedRows.value.length} 项` : '重命名',
      icon: isMulti ? Edit2 : Edit3,
      shortcut: 'F2',
      action: () => (isMulti ? batchRename(selectedRows.value) : promptRename(r))
    },
    {
      key: 'copy',
      label: '复制到...',
      icon: Copy,
      shortcut: 'Ctrl+C',
      action: () => {
        moveDialog.value = { open: true, mode: 'copy', row: multiRows }
      }
    },
    {
      key: 'move',
      label: '移动到...',
      icon: FolderInput,
      action: () => openMoveDialog(multiRows)
    },
    {
      // 合并 share / qrcode：单文件→二维码分享弹窗；多选→提示走工具栏
      key: 'share',
      label: isMulti ? `批量分享 ${selectedRows.value.length} 项` : '分享 / 二维码',
      icon: isMulti ? Share2 : QrCode,
      disabled: isFolder,
      action: () => {
        if (isMulti) {
          ElMessage.info('批量分享：请点击工具栏的"分享"按钮')
        } else {
          shareWithQRCode(r)
        }
      }
    },
    { divider: true },
    {
      key: 'history',
      label: '查看历史版本',
      icon: History,
      disabled: isFolder,
      action: () => openHistory(r)
    },
    {
      key: 'favorite',
      label: favorited ? '取消收藏' : '收藏',
      icon: Star,
      action: () => toggleFavorite(r)
    },
    {
      // P3-2：智能打标（AI 生成标签）
      key: 'autotag',
      label: '智能打标',
      icon: tagLoading ? LoaderCircle : Sparkles,
      disabled: isMulti || tagLoading,
      action: () => handleAutoTag(r)
    },
    {
      // P3-4：移入保险箱（支持多选）
      key: 'vault',
      label: isMulti ? `移入保险箱 ${selectedRows.value.length} 项` : '移入保险箱',
      icon: Shield,
      action: () => moveToVault(multiRows)
    },
    { divider: true },
    {
      key: 'delete',
      label: isMulti ? `删除 ${selectedRows.value.length} 项` : '删除',
      icon: Trash2,
      shortcut: 'Del',
      danger: true,
      action: () => batchDelete(multiRows)
    }
  ]
})

function onCtxSelect(item) {
  if (item && typeof item.action === 'function') item.action()
}

// 过滤 visible: false 的项，并清理连续 divider
function filterCtxItems(items) {
  return items
    .filter((item) => item.visible !== false)
    .reduce((acc, item, idx, arr) => {
      // 跳过首尾 divider 与连续 divider
      if (item.divider) {
        const prev = acc[acc.length - 1]
        if (!prev || prev.divider || idx === arr.length - 1) return acc
      }
      acc.push(item)
      return acc
    }, [])
}

/**
 * 重命名交互：使用 ElMessageBox.prompt（与项目其它确认对话框统一）
 */
async function promptRename(row) {
  const oldName = row.filename || row.name || ''
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
        ElMessage.success('重命名成功')
        fileStore.loadFileList()
      },
      (err) => ElMessage.error(err.message)
    )
  } catch {
    // 用户点取消
  }
}

// ─── 批量重命名（P1-2）─────────────────────────────────────────────────────
async function batchRename(rows) {
  if (!rows || rows.length === 0) return
  const base = rows[0].filename || rows[0].name || 'file'
  // 去扩展名作为基础名
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
      const dot = (row.filename || row.name || '').lastIndexOf('.')
      const e = dot > 0 ? (row.filename || row.name).slice(dot) : ''
      const newName = `${value.trim()}(${i + 1})${e}`
      await new Promise((resolve) => {
        fileService.update(
          { fileId: row.fileId, filename: newName },
          () => {
            successCount++
            resolve(true)
          },
          () => resolve(false)
        )
      })
    }
    ElMessage.success(`批量重命名完成，成功 ${successCount}/${rows.length} 个`)
    fileStore.loadFileList()
  } catch {
    // 用户取消
  }
}

// ─── 二维码分享（P1-2）─────────────────────────────────────────────────────
async function shareWithQRCode(row) {
  try {
    shareService.createShare(
      { fileId: row.fileId },
      (res) => {
        const shareId = res.data?.shareId || res.data
        const url = window.location.origin + '/share/' + shareId
        showQRModal(url, row.filename || row.name || '分享')
      },
      () => ElMessage.error('创建分享失败')
    )
  } catch {
    ElMessage.error('二维码生成失败')
  }
}

async function showQRModal(url, title) {
  try {
    const qrDataUrl = await QRCode.toDataURL(url, { width: 240, margin: 2 })
    const modal = document.createElement('div')
    modal.style.cssText =
      'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);'
    modal.innerHTML = `
      <div style="background:var(--color-surface);border-radius:16px;padding:24px;max-width:320px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <p style="font-size:16px;font-weight:600;margin:0 0 4px;color:var(--color-text);">${title}</p>
        <p style="font-size:12px;color:var(--color-text-muted);margin:0 0 16px;">扫描二维码访问分享</p>
        <img src="${qrDataUrl}" width="240" height="240" style="border-radius:8px;" />
        <p style="font-size:11px;color:var(--color-text-muted);margin:12px 0 0;word-break:break-all;">${url}</p>
        <button style="margin-top:16px;padding:8px 24px;background:var(--color-primary-500);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">关闭</button>
      </div>
    `
    modal.querySelector('button').onclick = () => modal.remove()
    modal.onclick = (e) => { if (e.target === modal) modal.remove() }
    document.body.appendChild(modal)
  } catch {
    ElMessage.error('二维码生成失败')
  }
}

// ─── 框选（P0-2）── 鼠标拖动虚线框批量选择 ────────────────────────────────
const selBox = ref({ active: false, x1: 0, y1: 0, x2: 0, y2: 0 })
const selContainer = ref<HTMLElement | null>(null)

function onSelStart(e: MouseEvent) {
  if (e.button !== 0) return
  // 点在卡片/按钮/输入框上时不触发框选，交由点击逻辑
  const t = e.target as HTMLElement
  if (t.closest('[data-file-id]')) return
  if (t.closest('button, input, a, [contenteditable]')) return
  if (!selContainer.value) return

  const rect = selContainer.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  selBox.value = { active: true, x1: x, y1: y, x2: x, y2: y }

  // 非 Shift 开始框选时清空已选
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
  // 太小的框视为点击，不处理
  if (right - left < 4 && bottom - top < 4) return

  const containerRect = selContainer.value.getBoundingClientRect()
  const cards = selContainer.value.querySelectorAll('[data-file-id]')
  const hitIds: string[] = []
  cards.forEach((card) => {
    const r = (card as HTMLElement).getBoundingClientRect()
    const cx = r.left - containerRect.left
    const cy = r.top - containerRect.top
    // 矩形相交
    if (cx < right && cx + r.width > left && cy < bottom && cy + r.height > top) {
      hitIds.push((card as HTMLElement).dataset.fileId as string)
    }
  })
  // 反查 filteredList 得到原类型 fileId，保持与 selected 类型一致
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
</script>

<template>
  <!-- 工具栏：排序 + 筛选 + 批量操作 -->
  <FileTableToolbar
    :selected-rows="selectedRows"
    :available-extensions="availableExtensions"
    @filter-change="(f) => (filter = f)"
    @batch-download="batchDownload"
    @batch-delete="batchDelete"
  />

  <!-- 列表视图 -->
  <BaseTable
    v-if="view === 'list'"
    :columns="columns"
    :data="filteredList"
    :loading="tableLoading"
    :skeleton="tableLoading && filteredList.length === 0"
    selectable
    row-key="fileId"
    :selected="selected"
    empty-text="该文件夹为空，试试上传文件"
    :sort-field="sortProp"
    :sort-order="sortOrder"
    @update:selected="(v) => handleSelectionChange(v)"
    @rowClick="onRowClick"
    @rowDblclick="onRowDblclick"
    @rowContextmenu="(e, row) => onContextMenu(e, row)"
    @sortChange="handleSort"
  >
    <template #cell-filename="{ row }">
      <BaseTooltip :text="row.filename" position="top">
        <button
          type="button"
          class="group flex items-center gap-3 text-left w-full min-w-0"
          @click.stop="clickFilename(row)"
          @dblclick.stop="clickFilename(row)"
        >
          <FileThumbnail :file="row" :size="28" rounded="rounded-md" />
          <span
            class="truncate text-[var(--color-text)] group-hover:text-[var(--color-primary-600)] transition-colors"
          >
            {{ row.filename }}
          </span>
        </button>
      </BaseTooltip>
    </template>
    <template #cell-parentFilename="{ row }">
      <button
        type="button"
        class="text-[var(--color-primary-600)] hover:underline"
        @click="goInFolder(row.parentId)"
      >
        {{ row.parentFilename }}
      </button>
    </template>
    <template #cell-actions="{ row }">
      <div
        class="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <button
          type="button"
          class="size-7 rounded-md flex items-center justify-center transition-colors"
          :class="
            isFavorite(row.fileId)
              ? 'text-amber-500 hover:bg-amber-50'
              : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'
          "
          :title="isFavorite(row.fileId) ? '取消收藏' : '收藏'"
          @click="toggleFavorite(row)"
        >
          <svg
            viewBox="0 0 24 24"
            :fill="isFavorite(row.fileId) ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="2"
            class="size-4"
          >
            <polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
            />
          </svg>
        </button>
        <BaseTooltip text="下载" position="top"
          ><DownloadButton size="small" :item="row"
        /></BaseTooltip>
      </div>
    </template>
    <template #empty>
      <BaseEmpty
        :icon="filterActive ? SearchX : FolderOpen"
        :title="filterActive ? '没有符合筛选条件的文件' : '该文件夹为空'"
        :description="filterActive ? '试着调整筛选条件或清除筛选' : '将文件拖拽到此处，或点击上传按钮添加文件'"
      />
    </template>
  </BaseTable>

  <!-- 网格视图 -->
  <div v-else>
    <div
      v-if="tableLoading && filteredList.length === 0"
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
    >
      <div
        v-for="i in 8"
        :key="i"
        class="aspect-square rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 animate-pulse"
      >
        <div class="size-12 mx-auto rounded-xl bg-[var(--color-surface-2)] mb-3" />
        <div class="h-3 w-3/4 mx-auto rounded bg-[var(--color-surface-2)] mb-2" />
        <div class="h-2 w-1/2 mx-auto rounded bg-[var(--color-surface-2)]" />
      </div>
    </div>

    <!-- 加载更多 sentinel -->
    <div
      v-if="!filterActive && hasMore && filteredList.length > 0"
      ref="loadMoreSentinel"
      class="col-span-full py-6 flex items-center justify-center text-xs text-[var(--color-text-muted)]"
    >
      <LoaderCircle v-if="isLoadingMore" :size="14" class="animate-spin mr-2" />
      {{ isLoadingMore ? '加载中...' : '滚动加载更多' }}
    </div>
    <div
      v-else-if="!filterActive && !hasMore && filteredList.length > 0 && total > 0"
      class="col-span-full py-6 text-center text-xs text-[var(--color-text-muted)]"
    >
      已加载全部 {{ total }} 个文件
    </div>

    <BaseEmpty
      v-else-if="filteredList.length === 0"
      :icon="filterActive ? SearchX : FolderOpen"
      :title="filterActive ? '没有符合筛选条件的文件' : '该文件夹为空'"
      :description="filterActive ? '试着调整筛选条件或清除筛选' : '将文件拖拽到此处，或点击上传按钮添加文件'"
    />

    <div
      v-else
      ref="selContainer"
      class="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 select-none"
      @mousedown="onSelStart"
    >
      <!-- 框选虚线框 -->
      <div
        v-if="selBox.active"
        class="absolute pointer-events-none border border-[var(--color-primary-500)] bg-[var(--color-primary-500)]/10 rounded-sm z-10"
        :style="selBoxStyle"
      />
      <button
        v-for="row in filteredList"
        :key="row.fileId"
        type="button"
        :data-file-id="row.fileId"
        class="group relative aspect-square rounded-2xl border bg-[var(--color-surface)] hover:shadow-md transition-all p-4 flex flex-col items-center justify-center text-center"
        :class="
          selected.includes(row.fileId)
            ? 'border-[var(--color-primary-500)] ring-2 ring-[var(--color-primary-500)]/30'
            : 'border-[var(--color-border)] hover:border-[var(--color-primary-400)]'
        "
        @click="onRowClick(row)"
        @dblclick="onRowDblclick(row)"
        @contextmenu="onContextMenu($event, row)"
      >
        <FileThumbnail :file="row" :size="64" rounded="rounded-xl" class="mb-3" />
        <BaseTooltip :text="row.filename" position="top">
          <p
            class="text-sm font-medium text-[var(--color-text)] line-clamp-2 mb-1 w-full break-all"
          >
            {{ row.filename }}
          </p>
        </BaseTooltip>
        <p class="text-xs text-[var(--color-text-muted)]">{{ row.fileSizeDesc }}</p>
      </button>
    </div>
  </div>

  <!-- 预览弹窗（参考 html5-examples DrivePreviewModal） -->
  <DrivePreviewModal
    :state="preview.state"
    :resolve-url="preview.resolvePreviewUrl"
    @close="preview.closePreview"
    @download="previewDownload"
  />

  <!-- P1.12：右键菜单 -->
  <ContextMenu
    :visible="ctxMenu.visible"
    :x="ctxMenu.x"
    :y="ctxMenu.y"
    :items="filterCtxItems(ctxItems)"
    @select="onCtxSelect"
    @close="closeCtxMenu"
  />

  <!-- P3-3 在线解压弹窗 -->
  <ExtractDialog
    v-model:open="extractDialog.open"
    :file-id="extractDialog.fileId"
    :filename="extractDialog.filename"
    @extracted="fileStore.loadFileList()"
  />

  <!-- P1.13：版本历史弹窗 -->
  <FileHistoryPanel
    :file-id="historyPanel.fileId"
    :open="historyPanel.open"
    @update:open="(v) => (historyPanel.open = v)"
    @rolled-back="fileStore.loadFileList()"
  />

  <!-- P1.12：移动/复制对话框 -->
  <FolderPickerDialog
    v-if="moveDialog.open"
    :open="moveDialog.open"
    :mode="moveDialog.mode"
    :row="moveDialog.row"
    @update:open="(v) => (moveDialog.open = v)"
    @complete="onMoveComplete"
  />
</template>
