<script setup lang="ts">
/**
 * FileCardList —— 移动端文件卡片列表
 * 替代 BaseTable 在手机/平板窄屏下的表格渲染，避免横向溢出。
 * - 单击：选中并打开（等效桌面「单击选中 + 双击打开」）
 * - 长按：触发上下文菜单（等效桌面右键），坐标由 pointer 事件计算
 * - 复用父级已有的 selected / onRowClick / clickFilename / onContextMenu 逻辑
 */
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import FileThumbnail from './FileThumbnail.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import { FolderOpen, SearchX, LoaderCircle } from '@lucide/vue'
import { useBreakpoint } from '@/composables/useMediaQuery'

const props = withDefaults(
  defineProps<{
    data: any[]
    selected: string[]
    loading?: boolean
    skeleton?: boolean
    emptyText?: string
    filterActive?: boolean
    hasMore?: boolean
    isLoadingMore?: boolean
    total?: number
  }>(),
  { loading: false, skeleton: false, filterActive: false, hasMore: false, isLoadingMore: false, total: 0 }
)

const emit = defineEmits<{
  (e: 'rowClick', row: any, evt?: MouseEvent): void
  (e: 'open', row: any): void
  (e: 'contextmenu', evt?: MouseEvent, row?: any): void
  (e: 'load-more'): void
}>()

const { isMobile, isTablet } = useBreakpoint()

// 手机：单列大卡片列表；平板：双列；桌面：多列网格
const gridCols = isMobile ? 'grid-cols-1' : isTablet ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'

const scrollRoot = ref<HTMLElement | null>(null)
const sentinel = ref<HTMLElement | null>(null)
let io: IntersectionObserver | null = null

function setupLoadMore() {
  if (io || typeof IntersectionObserver === 'undefined') return
  io = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && props.hasMore && !props.isLoadingMore && !props.filterActive) {
        emit('load-more')
      }
    },
    { root: scrollRoot.value, rootMargin: '200px' }
  )
  nextTick(() => {
    if (sentinel.value && io) io.observe(sentinel.value)
  })
}

onMounted(() => {
  nextTick(setupLoadMore)
})

// 数据变多 / 出现更多页时，确保哨兵重新被观察
watch([() => props.hasMore, () => props.data.length], () => {
  if (io && sentinel.value) {
    io.unobserve(sentinel.value)
    io.observe(sentinel.value)
  } else {
    nextTick(setupLoadMore)
  }
})

onBeforeUnmount(() => {
  io?.disconnect()
  io = null
})

function getFileTypeLabel(row: any) {
  const type = row.fileType
  if (type === 0 || row.folderFlag === 1) return '文件夹'
  if (type === 7) return '图片'
  if (type === 9) return '视频'
  if (type === 8) return '音乐'
  if (type === 11) return '代码'
  const docTypes: Record<number, string> = {
    3: 'Excel', 4: 'Word', 5: 'PDF', 6: '文本', 10: 'PPT', 12: 'CSV'
  }
  return docTypes[type] || '其他'
}

// ─── 长按触发上下文菜单 ────────────────────────────────────────────────
const longPressTimer = ref<number | null>(null)
const pressStart = ref<{ x: number; y: number } | null>(null)
let longPressFired = false

function onPointerDown(e: PointerEvent, row: any) {
  longPressFired = false
  pressStart.value = { x: e.clientX, y: e.clientY }
  longPressTimer.value = window.setTimeout(() => {
    longPressFired = true
    const me = new MouseEvent('contextmenu', {
      bubbles: false, clientX: pressStart.value!.x, clientY: pressStart.value!.y
    })
    emit('contextmenu', me, row)
  }, 500)
}

function onPointerMove(e: PointerEvent) {
  if (!pressStart.value) return
  const dx = Math.abs(e.clientX - pressStart.value.x)
  const dy = Math.abs(e.clientY - pressStart.value.y)
  if (dx > 10 || dy > 10) clearLongPress()
}

function onPointerUp() {
  clearLongPress()
}

function clearLongPress() {
  if (longPressTimer.value !== null) {
    window.clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  pressStart.value = null
}

// 单击（非长按）视为选中 + 打开
function onClick(row: any, e: MouseEvent) {
  if (longPressFired) {
    longPressFired = false
    return
  }
  emit('rowClick', row, e)
  emit('open', row)
}
</script>

<template>
  <div ref="scrollRoot" class="h-full min-h-0 overflow-y-auto" style="touch-action: pan-y;" :class="isMobile ? 'px-3 pb-[calc(env(safe-area-inset-bottom)+8px)]' : 'px-4'">

    <!-- 骨架屏 -->
    <div v-if="skeleton" :class="['grid gap-2.5 pt-2', gridCols]">
      <div
        v-for="i in 8"
        :key="i"
        class="rounded-xl border border-(--color-border) bg-(--color-surface) p-3 animate-pulse flex items-center gap-3"
      >
        <div class="size-12 rounded-lg bg-(--color-surface-2) shrink-0" />
        <div class="flex-1 min-w-0 space-y-2">
          <div class="h-3 w-3/4 rounded bg-(--color-surface-2)" />
          <div class="h-2.5 w-1/2 rounded bg-(--color-surface-2)" />
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <BaseEmpty
      v-else-if="data.length === 0"
      :icon="filterActive ? SearchX : FolderOpen"
      :title="filterActive ? '没有符合筛选条件的文件' : '该文件夹为空'"
      :description="filterActive ? '试着调整筛选条件或清除筛选' : '点击下方按钮添加文件'"
    />

    <!-- 卡片列表 -->
    <div v-else :class="['grid gap-2.5 pt-2', gridCols]">
      <button
        v-for="row in data"
        :key="row.fileId"
        type="button"
        :data-file-id="row.fileId"
        class="group relative flex items-center gap-3 rounded-xl border bg-(--color-surface) p-3 text-left transition-all active:scale-[0.98]"
        :class="
          selected.includes(row.fileId)
            ? 'border-primary-500 ring-2 ring-primary-500/20 bg-primary-500/5'
            : 'border-(--color-border) hover:border-primary-400 active:bg-(--color-surface-2)'
        "
        @click="onClick(row, $event)"
        @pointerdown="onPointerDown($event, row)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @pointerleave="onPointerUp"
      >
        <!-- 选中指示（桌面/平板右上角小勾；移动端左侧圆框） -->
        <div
          v-if="selected.includes(row.fileId)"
          class="absolute flex items-center justify-center rounded-full bg-primary-500 text-white shadow-sm z-10"
          :class="isMobile ? '-left-1.5 -top-1.5 size-5' : 'top-2 right-2 size-5'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" class="size-3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <FileThumbnail
          :file="row"
          :size="isMobile ? 52 : 48"
          rounded="rounded-lg"
          class="ring-1 ring-(--color-border)/60 shrink-0"
        />

        <div class="min-w-0 flex-1">
          <!-- 手机：完整文件名两行省略，避免「1-…」信息丢失 -->
          <p
            class="text-[14px] font-medium text-(--color-text) leading-snug"
            :class="isMobile ? 'line-clamp-2' : 'truncate'"
          >
            {{ row.filename }}
          </p>
          <div class="mt-1 flex items-center gap-2 text-[12px] text-(--color-text-muted)">
            <span
              class="inline-flex items-center px-1.5 h-5 rounded-full shrink-0"
              style="background-color: var(--color-surface-2); color: var(--color-text-secondary);"
            >
              {{ getFileTypeLabel(row) }}
            </span>
            <span class="tabular-nums shrink-0">{{ row.fileSizeDesc }}</span>
            <span
              v-if="!isMobile && row.updateTime"
              class="truncate text-(--color-text-muted)/80"
            >· {{ row.updateTime }}</span>
          </div>
        </div>

        <!-- 移动端：右侧箭头，强化「点击进入」语义 -->
        <svg
          v-if="isMobile"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          class="size-4 text-(--color-text-muted)/50 shrink-0"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>

    <!-- 滚动加载哨兵 + 加载更多提示 -->
    <div
      v-if="!filterActive && hasMore && data.length > 0"
      ref="sentinel"
      class="py-6 flex items-center justify-center text-xs text-(--color-text-muted)"
    >
      <LoaderCircle v-if="isLoadingMore" :size="14" class="animate-spin mr-2" />
      {{ isLoadingMore ? '加载中...' : '滚动加载更多' }}
    </div>
    <div
      v-else-if="!filterActive && !hasMore && data.length > 0"
      class="py-4 text-center text-xs text-(--color-text-muted)"
    >
      已加载全部 {{ total }} 个文件
    </div>
  </div>
</template>
