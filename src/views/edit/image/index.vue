<script setup lang="ts">
/**
 * EditImage —— 图片在线编辑页
 * - 旋转 90°、水平/垂直翻转、自由裁剪
 * - 保存复用 PUT /file/content（baseVersion 乐观锁，409 冲突）
 * - 编辑锁与 Markdown 编辑页一致：进入申请、心跳续期、离开释放
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Crop,
  Download,
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  RotateCw,
  Save,
  Undo2
} from '@lucide/vue'
import fileService, { type IFileDetailVO } from '@/api/file'
import BaseButton from '@/components/base/BaseButton.vue'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import { invalidatePreviewUrl, resolvePreviewUrl } from '@/utils/preview'
import { removeThumbnailFromCache } from '@/utils/thumbnail-cache'

const route = useRoute()
const router = useRouter()

const fileId = computed(() => String(route.params.fileId || ''))
const filename = ref(String(route.query.filename || ''))
const version = ref(1)
const detail = ref<IFileDetailVO | null>(null)

const phase = ref<'loading' | 'ready' | 'locked' | 'unsupported' | 'error'>('loading')
const errorMessage = ref('')
const dirty = ref(false)
const saving = ref(false)
const cropMode = ref(false)

const stageRef = ref<HTMLElement | null>(null)
const canvasBoxRef = ref<HTMLElement | null>(null)
const displayCanvasRef = ref<HTMLCanvasElement | null>(null)

/** 裁剪框（相对当前工作图的 0~1 比例） */
const crop = ref({ x: 0, y: 0, w: 1, h: 1 })
/** 画布展示尺寸（CSS 像素） */
const cssSize = ref({ w: 0, h: 0 })

/** 服务端当前内容的画布（重置/冲突恢复的基线） */
let baselineCanvas: HTMLCanvasElement | null = null
/** 当前编辑中的画布（已应用旋转/翻转） */
let workingCanvas: HTMLCanvasElement | null = null
/** 编辑锁令牌 */
let lockToken = ''
let heartbeatTimer: number | undefined
let resizeObserver: ResizeObserver | null = null
let fitRaf = 0

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
type Handle = (typeof HANDLES)[number]

interface DragState {
  mode: 'create' | 'move' | Handle
  startX: number
  startY: number
  anchorX: number
  anchorY: number
  startCrop: { x: number; y: number; w: number; h: number }
}
let drag: DragState | null = null

const MAX_PIXELS = 40_000_000
const IMAGE_SUFFIXES = ['jpg', 'jpeg', 'png', 'webp']

const ext = computed(() => {
  const name = filename.value.toLowerCase()
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1) : ''
})

const mime = computed(() => {
  if (ext.value === 'png') return 'image/png'
  if (ext.value === 'webp') return 'image/webp'
  return 'image/jpeg'
})

const cropBoxStyle = computed(() => ({
  left: `${crop.value.x * cssSize.value.w}px`,
  top: `${crop.value.y * cssSize.value.h}px`,
  width: `${crop.value.w * cssSize.value.w}px`,
  height: `${crop.value.h * cssSize.value.h}px`,
  // 框外压暗，突出裁剪区域（父容器 overflow-hidden 保证不溢出图片）
  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)'
}))

async function bootstrap() {
  phase.value = 'loading'
  errorMessage.value = ''
  try {
    // 1. 文件详情 + 权限校验
    const detailRes = await fileService.getDetail(fileId.value)
    detail.value = detailRes.data
    filename.value = detailRes.data.filename || filename.value
    version.value = detailRes.data.version || 1
    if (!IMAGE_SUFFIXES.includes(ext.value)) {
      phase.value = 'unsupported'
      errorMessage.value = '该图片格式暂不支持在线编辑（支持 JPG/PNG/WebP）'
      return
    }

    // 2. 申请编辑锁
    try {
      const session = await fileService.acquireEditSession(fileId.value)
      lockToken = session.data.lockToken
      version.value = session.data.version || version.value
      startHeartbeat()
    } catch (e) {
      const err = e as { code?: number; message?: string }
      if (err?.code === 423) {
        phase.value = 'locked'
        errorMessage.value = err.message || '文件正在被其他用户编辑'
        return
      }
      throw e
    }

    // 3. 加载图片
    await loadImage()
    phase.value = 'ready'
    await nextTick()
    fitCanvas()
  } catch (e) {
    const err = e as { code?: number; message?: string }
    phase.value = 'error'
    errorMessage.value = err?.message || '图片加载失败'
  }
}

async function loadImage() {
  const url = await resolvePreviewUrl(fileId.value)
  const img = await loadImageElement(url)
  if (img.naturalWidth * img.naturalHeight > MAX_PIXELS) {
    throw new Error('图片像素过大，暂不支持在线编辑')
  }
  const canvas = createCanvas(img.naturalWidth, img.naturalHeight)
  canvas.getContext('2d')!.drawImage(img, 0, 0)
  baselineCanvas = canvas
  workingCanvas = cloneCanvas(canvas)
  crop.value = { x: 0, y: 0, w: 1, h: 1 }
  cropMode.value = false
  dirty.value = false
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // 预览流可能跨域（开发环境前端与后端不同端口），必须带 CORS 才能读写 canvas
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = url
  })
}

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w))
  canvas.height = Math.max(1, Math.round(h))
  return canvas
}

function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = createCanvas(src.width, src.height)
  canvas.getContext('2d')!.drawImage(src, 0, 0)
  return canvas
}

/** 将工作图等比缩放绘制到展示画布（限制最大 1 倍，避免小图放大发虚） */
function fitCanvas() {
  if (!workingCanvas || !stageRef.value || !displayCanvasRef.value || !canvasBoxRef.value) return
  const stageW = stageRef.value.clientWidth - 48
  const stageH = stageRef.value.clientHeight - 48
  if (stageW <= 0 || stageH <= 0) return
  const scale = Math.min(stageW / workingCanvas.width, stageH / workingCanvas.height, 1)
  const w = Math.max(1, Math.round(workingCanvas.width * scale))
  const h = Math.max(1, Math.round(workingCanvas.height * scale))
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const canvas = displayCanvasRef.value
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(workingCanvas, 0, 0, w, h)
  cssSize.value = { w, h }
}

function scheduleFit() {
  cancelAnimationFrame(fitRaf)
  fitRaf = requestAnimationFrame(() => fitCanvas())
}

function setWorking(canvas: HTMLCanvasElement) {
  workingCanvas = canvas
  crop.value = { x: 0, y: 0, w: 1, h: 1 }
  cropMode.value = false
  dirty.value = true
  nextTick(fitCanvas)
}

function rotate(deg: 90 | -90) {
  if (!workingCanvas || phase.value !== 'ready') return
  const src = workingCanvas
  const swap = Math.abs(deg) % 180 === 90
  const w = swap ? src.height : src.width
  const h = swap ? src.width : src.height
  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.translate(w / 2, h / 2)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.drawImage(src, -src.width / 2, -src.height / 2)
  setWorking(canvas)
}

function flip(horizontal: boolean) {
  if (!workingCanvas || phase.value !== 'ready') return
  const src = workingCanvas
  const canvas = createCanvas(src.width, src.height)
  const ctx = canvas.getContext('2d')!
  if (horizontal) {
    ctx.translate(src.width, 0)
    ctx.scale(-1, 1)
  } else {
    ctx.translate(0, src.height)
    ctx.scale(1, -1)
  }
  ctx.drawImage(src, 0, 0)
  setWorking(canvas)
}

function toggleCrop() {
  if (phase.value !== 'ready') return
  cropMode.value = !cropMode.value
  // 首次进入裁剪：默认选中中间 80%，避免整框无法拖出新区域
  if (cropMode.value && crop.value.w >= 0.999 && crop.value.h >= 0.999) {
    crop.value = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }
    dirty.value = true
  }
}

function resetAll() {
  if (!baselineCanvas) return
  workingCanvas = cloneCanvas(baselineCanvas)
  crop.value = { x: 0, y: 0, w: 1, h: 1 }
  cropMode.value = false
  dirty.value = false
  nextTick(fitCanvas)
}

// ─── 裁剪拖拽 ────────────────────────────────────────────────────────────────

function localPoint(e: PointerEvent) {
  const rect = canvasBoxRef.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(v, max))
}

function onPointerDown(e: PointerEvent) {
  if (!cropMode.value || phase.value !== 'ready') return
  e.preventDefault()
  const p = localPoint(e)
  const W = cssSize.value.w
  const H = cssSize.value.h
  drag = {
    mode: 'create',
    startX: p.x,
    startY: p.y,
    anchorX: clamp(p.x, 0, W),
    anchorY: clamp(p.y, 0, H),
    startCrop: toPx(crop.value)
  }
  crop.value = { x: drag.anchorX / W, y: drag.anchorY / H, w: 0, h: 0 }
  attachDrag()
}

function onMoveStart(e: PointerEvent) {
  if (!cropMode.value) return
  e.preventDefault()
  e.stopPropagation()
  const p = localPoint(e)
  drag = {
    mode: 'move',
    startX: p.x,
    startY: p.y,
    anchorX: 0,
    anchorY: 0,
    startCrop: toPx(crop.value)
  }
  attachDrag()
}

function onResizeStart(e: PointerEvent, handle: Handle) {
  if (!cropMode.value) return
  e.preventDefault()
  e.stopPropagation()
  const p = localPoint(e)
  drag = {
    mode: handle,
    startX: p.x,
    startY: p.y,
    anchorX: 0,
    anchorY: 0,
    startCrop: toPx(crop.value)
  }
  attachDrag()
}

function toPx(c: { x: number; y: number; w: number; h: number }) {
  return {
    x: c.x * cssSize.value.w,
    y: c.y * cssSize.value.h,
    w: c.w * cssSize.value.w,
    h: c.h * cssSize.value.h
  }
}

function attachDrag() {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function detachDrag() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}

function onPointerMove(e: PointerEvent) {
  if (!drag) return
  e.preventDefault()
  const p = localPoint(e)
  const W = cssSize.value.w
  const H = cssSize.value.h
  const min = 24
  let rect = { ...drag.startCrop }

  if (drag.mode === 'create') {
    const x = clamp(p.x, 0, W)
    const y = clamp(p.y, 0, H)
    rect = {
      x: Math.min(drag.anchorX, x),
      y: Math.min(drag.anchorY, y),
      w: Math.abs(x - drag.anchorX),
      h: Math.abs(y - drag.anchorY)
    }
  } else if (drag.mode === 'move') {
    const dx = p.x - drag.startX
    const dy = p.y - drag.startY
    rect.x = clamp(drag.startCrop.x + dx, 0, W - drag.startCrop.w)
    rect.y = clamp(drag.startCrop.y + dy, 0, H - drag.startCrop.h)
  } else {
    let left = drag.startCrop.x
    let top = drag.startCrop.y
    let right = left + drag.startCrop.w
    let bottom = top + drag.startCrop.h
    if (drag.mode.includes('w')) left = clamp(p.x, 0, right - min)
    if (drag.mode.includes('e')) right = clamp(p.x, left + min, W)
    if (drag.mode.includes('n')) top = clamp(p.y, 0, bottom - min)
    if (drag.mode.includes('s')) bottom = clamp(p.y, top + min, H)
    rect = { x: left, y: top, w: right - left, h: bottom - top }
  }

  crop.value = { x: rect.x / W, y: rect.y / H, w: rect.w / W, h: rect.h / H }
  dirty.value = true
}

function onPointerUp() {
  detachDrag()
  if (drag?.mode === 'create') {
    const W = cssSize.value.w
    const H = cssSize.value.h
    if (crop.value.w * W < 8 || crop.value.h * H < 8) {
      crop.value = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }
    }
  }
  drag = null
}

// ─── 保存 ────────────────────────────────────────────────────────────────────

/** 按当前裁剪框生成输出画布 */
function buildOutputCanvas(): HTMLCanvasElement {
  const source = workingCanvas!
  const sx = clamp(Math.round(crop.value.x * source.width), 0, source.width - 1)
  const sy = clamp(Math.round(crop.value.y * source.height), 0, source.height - 1)
  const sw = clamp(Math.round(crop.value.w * source.width), 1, source.width - sx)
  const sh = clamp(Math.round(crop.value.h * source.height), 1, source.height - sy)
  const output = createCanvas(sw, sh)
  output.getContext('2d')!.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)
  return output
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片编码失败'))),
      type,
      quality
    )
  })
}

/** 浏览器不支持目标编码时（如部分 Safari 的 WebP）toBlob 会回退 PNG，避免写错扩展名 */
function ensureEncodedType(blob: Blob) {
  if (blob.type !== mime.value) {
    throw new Error(`当前浏览器不支持 ${mime.value} 编码，请更换浏览器重试`)
  }
}

async function save() {
  if (saving.value || phase.value !== 'ready' || !workingCanvas) return
  saving.value = true
  try {
    const output = buildOutputCanvas()
    const blob = await canvasToBlob(output, mime.value, 0.92)
    ensureEncodedType(blob)
    const res = await fileService.saveContent({
      fileId: fileId.value,
      baseVersion: version.value,
      file: blob,
      filename: filename.value
    })
    version.value = res.data.version
    baselineCanvas = output
    workingCanvas = output
    crop.value = { x: 0, y: 0, w: 1, h: 1 }
    cropMode.value = false
    dirty.value = false
    detail.value = detail.value
      ? { ...detail.value, version: res.data.version, sizeBytes: res.data.sizeBytes }
      : detail.value
    invalidatePreviewUrl(fileId.value)
    removeThumbnailFromCache(fileId.value)
    notifyFileChanged()
    await nextTick()
    fitCanvas()
    ElMessage.success('已保存')
  } catch (e) {
    const err = e as { code?: number; message?: string }
    if (err?.code === 409) {
      await handleConflict()
    } else if (err?.code === 423) {
      phase.value = 'locked'
      errorMessage.value = err.message || '编辑锁已失效，请重新进入'
    } else {
      ElMessage.error(err?.message || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

async function handleConflict() {
  const reload = await ElMessageBox.confirm(
    '图片已被其他端修改。加载最新内容会丢弃你当前的未保存编辑，也可以先下载你的版本。',
    '保存冲突',
    {
      confirmButtonText: '加载最新内容',
      cancelButtonText: '下载我的版本',
      type: 'warning'
    }
  )
  if (reload) {
    await reloadFromServer()
  } else {
    await downloadEdited()
  }
}

async function reloadFromServer() {
  try {
    const detailRes = await fileService.getDetail(fileId.value)
    version.value = detailRes.data.version || version.value
    detail.value = detailRes.data
    filename.value = detailRes.data.filename || filename.value
    invalidatePreviewUrl(fileId.value)
    await loadImage()
    await nextTick()
    fitCanvas()
    ElMessage.success('已加载最新内容')
  } catch (e) {
    const err = e as { message?: string }
    ElMessage.error(err?.message || '加载最新内容失败')
  }
}

async function downloadEdited() {
  if (!workingCanvas) return
  try {
    const output = buildOutputCanvas()
    const blob = await canvasToBlob(output, mime.value, 0.92)
    ensureEncodedType(blob)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.value || 'image.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    const err = e as { message?: string }
    ElMessage.error(err?.message || '导出图片失败')
  }
}

function notifyFileChanged() {
  try {
    localStorage.setItem(`xpan:file-changed:${fileId.value}`, String(Date.now()))
  } catch {
    /* 隐私模式下忽略 */
  }
}

// ─── 编辑锁 / 离开拦截 ───────────────────────────────────────────────────────

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = window.setInterval(async () => {
    try {
      const session = await fileService.acquireEditSession(fileId.value)
      lockToken = session.data.lockToken
    } catch {
      /* 网络异常时等待下一次心跳 */
    }
  }, 5 * 60 * 1000)
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer)
    heartbeatTimer = undefined
  }
}

function releaseLock() {
  stopHeartbeat()
  if (!lockToken) return
  fileService.releaseEditSession(fileId.value, lockToken).catch(() => {
    /* 锁会在 TTL 后自动过期 */
  })
  lockToken = ''
}

async function confirmLeave(): Promise<boolean> {
  if (!dirty.value) return true
  return ElMessageBox.confirm('当前修改尚未保存，确定离开吗？', '提示', {
    confirmButtonText: '离开',
    cancelButtonText: '继续编辑',
    type: 'warning'
  })
}

async function goBack() {
  if (!(await confirmLeave())) return
  if (window.opener) {
    window.close()
    return
  }
  if (window.history.length > 1) router.back()
  else router.push('/files')
}

function onKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    save()
  }
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = ''
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('beforeunload', onBeforeUnload)
  resizeObserver = new ResizeObserver(() => scheduleFit())
  if (stageRef.value) resizeObserver.observe(stageRef.value)
  bootstrap()
})

onBeforeRouteLeave(async () => {
  const allowed = await confirmLeave()
  if (allowed) releaseLock()
  return allowed
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('beforeunload', onBeforeUnload)
  detachDrag()
  resizeObserver?.disconnect()
  resizeObserver = null
  cancelAnimationFrame(fitRaf)
  releaseLock()
})

function handleClass(h: Handle) {
  switch (h) {
    case 'nw':
      return '-left-1 -top-1 cursor-nwse-resize'
    case 'n':
      return 'left-1/2 -translate-x-1/2 -top-1 cursor-ns-resize'
    case 'ne':
      return '-right-1 -top-1 cursor-nesw-resize'
    case 'e':
      return '-right-1 top-1/2 -translate-y-1/2 cursor-ew-resize'
    case 'se':
      return '-right-1 -bottom-1 cursor-nwse-resize'
    case 's':
      return 'left-1/2 -translate-x-1/2 -bottom-1 cursor-ns-resize'
    case 'sw':
      return '-left-1 -bottom-1 cursor-nesw-resize'
    default:
      return '-left-1 top-1/2 -translate-y-1/2 cursor-ew-resize'
  }
}
</script>

<template>
  <div class="h-screen flex flex-col bg-(--color-bg)">
    <header
      class="h-14 px-4 flex items-center justify-between gap-3 border-b border-(--color-border) bg-(--color-surface)"
    >
      <div class="flex items-center gap-2 min-w-0">
        <button
          type="button"
          class="size-8 rounded-sm flex items-center justify-center text-(--color-text-muted) hover:bg-(--color-surface-2) hover:text-(--color-text) transition-colors"
          title="返回"
          @click="goBack"
        >
          <ArrowLeft :size="18" />
        </button>
        <h1 class="text-base font-medium truncate">{{ filename || '图片编辑' }}</h1>
        <span
          class="shrink-0 rounded-full bg-(--color-surface-2) px-2 py-0.5 text-[11px] text-(--color-text-muted)"
        >
          v{{ version }}
        </span>
        <span v-if="dirty" class="shrink-0 text-[11px] text-amber-500">未保存</span>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <BaseButton variant="ghost" size="sm" :disabled="phase !== 'ready'" @click="downloadEdited">
          <span class="inline-flex items-center gap-1.5">
            <Download :size="14" />
            下载
          </span>
        </BaseButton>
        <BaseButton
          variant="primary"
          size="sm"
          :loading="saving"
          :disabled="phase !== 'ready' || !dirty"
          @click="save"
        >
          <span class="inline-flex items-center gap-1.5">
            <Save :size="14" />
            保存
            <kbd class="ml-1 rounded bg-white/20 px-1 text-[10px]">⌘S</kbd>
          </span>
        </BaseButton>
      </div>
    </header>

    <div class="flex-1 min-h-0 flex">
      <!-- 画布区 -->
      <main
        ref="stageRef"
        class="relative flex-1 min-w-0 flex items-center justify-center overflow-hidden bg-(--color-surface-2)"
      >
        <div
          v-if="phase === 'ready'"
          ref="canvasBoxRef"
          class="relative overflow-hidden shadow-lg select-none touch-none"
          :style="{ width: `${cssSize.w}px`, height: `${cssSize.h}px` }"
          @pointerdown="onPointerDown"
        >
          <canvas ref="displayCanvasRef" class="block" />

          <!-- 裁剪层：点击空白处新建选框，框内拖动移动，8 个手柄缩放 -->
          <template v-if="cropMode">
            <div
              class="absolute border-2 border-white cursor-move"
              :style="cropBoxStyle"
              @pointerdown="onMoveStart"
            >
              <div
                v-for="h in HANDLES"
                :key="h"
                class="absolute size-2.5 rounded-full bg-white shadow"
                :class="handleClass(h)"
                @pointerdown="onResizeStart($event, h)"
              />
              <div class="absolute inset-0 pointer-events-none border border-white/30" />
            </div>
          </template>
        </div>

        <div
          v-if="phase === 'loading'"
          class="absolute inset-0 flex items-center justify-center bg-(--color-bg)"
        >
          <div class="size-10 rounded-xl bg-(--color-surface-2) animate-pulse" />
        </div>

        <div
          v-else-if="phase === 'locked' || phase === 'unsupported' || phase === 'error'"
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-(--color-bg) px-6 text-center"
        >
          <p class="text-sm text-(--color-text-muted)">{{ errorMessage }}</p>
          <BaseButton
            v-if="phase === 'locked' || phase === 'error'"
            variant="secondary"
            size="sm"
            @click="bootstrap"
          >
            重试
          </BaseButton>
          <BaseButton variant="ghost" size="sm" @click="goBack">返回</BaseButton>
        </div>

        <div
          v-if="cropMode && phase === 'ready'"
          class="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/90"
        >
          拖动框选裁剪区域
        </div>
      </main>

      <!-- 工具栏 -->
      <aside
        class="w-14 sm:w-52 shrink-0 border-l border-(--color-border) bg-(--color-surface) flex flex-col gap-1 p-2"
      >
        <button
          type="button"
          class="tool-btn"
          :disabled="phase !== 'ready'"
          @click="rotate(-90)"
        >
          <RotateCcw :size="17" />
          <span class="hidden sm:inline">向左旋转</span>
        </button>
        <button
          type="button"
          class="tool-btn"
          :disabled="phase !== 'ready'"
          @click="rotate(90)"
        >
          <RotateCw :size="17" />
          <span class="hidden sm:inline">向右旋转</span>
        </button>
        <button
          type="button"
          class="tool-btn"
          :disabled="phase !== 'ready'"
          @click="flip(true)"
        >
          <FlipHorizontal :size="17" />
          <span class="hidden sm:inline">水平翻转</span>
        </button>
        <button
          type="button"
          class="tool-btn"
          :disabled="phase !== 'ready'"
          @click="flip(false)"
        >
          <FlipVertical :size="17" />
          <span class="hidden sm:inline">垂直翻转</span>
        </button>
        <button
          type="button"
          class="tool-btn"
          :class="cropMode ? 'text-primary-500 bg-primary-500/10' : ''"
          :disabled="phase !== 'ready'"
          @click="toggleCrop"
        >
          <Crop :size="17" />
          <span class="hidden sm:inline">{{ cropMode ? '退出裁剪' : '裁剪' }}</span>
        </button>
        <button
          type="button"
          class="tool-btn"
          :disabled="phase !== 'ready'"
          @click="resetAll"
        >
          <Undo2 :size="17" />
          <span class="hidden sm:inline">重置</span>
        </button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 38px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text-muted);
  transition: background-color 0.12s, color 0.12s;
}
.tool-btn:hover:not(:disabled) {
  background: var(--color-surface-2);
  color: var(--color-text);
}
.tool-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
@media (min-width: 640px) {
  .tool-btn {
    justify-content: flex-start;
  }
}
</style>
