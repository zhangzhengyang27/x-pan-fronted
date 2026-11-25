<script setup lang="ts">
/**
 * BaseTable —— 通用表格
 * 设计规范：G 设计风格
 * - 粘性表头
 * - 行 hover
 * - 多选（checkbox 列）
 * - 加载 / 空 / 错误三态
 * - 可排序列（sortable=true 时）
 */
import { computed } from 'vue'
import type { PropType } from 'vue'
import { Check, Minus, ArrowUp, ArrowDown, ArrowUpDown } from '@lucide/vue'
import { cn } from '@/utils/classnames'

type RowKey = string | number
type SortOrder = 'ascending' | 'descending' | ''

interface TableColumn {
  key: string
  title: string
  width?: number | string
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  [key: string]: unknown
}

type Row = Record<string, any>

const props = defineProps({
  columns: { type: Array as PropType<TableColumn[]>, required: true },
  data: { type: Array as PropType<Row[]>, default: (): Row[] => [] },
  loading: { type: Boolean, default: false },
  skeleton: { type: Boolean, default: false },
  error: { type: [String, Object] as PropType<string | { message?: string }>, default: '' },
  rowKey: { type: String, default: 'id' },
  selectable: { type: Boolean, default: false },
  selected: { type: Array as PropType<RowKey[]>, default: (): RowKey[] => [] },
  activeKey: { type: [String, Number] as PropType<RowKey>, default: '' },
  emptyText: { type: String, default: '暂无数据' },
  skeletonRows: { type: Number, default: 5 },
  sortField: { type: String, default: '' },
  sortOrder: { type: String as PropType<SortOrder>, default: '' }
})

const emit = defineEmits<{
  'update:selected': [value: RowKey[]]
  rowClick: [row: Row, idx: number, e: MouseEvent]
  rowDblclick: [row: Row, idx: number]
  rowContextmenu: [e: MouseEvent, row: Row]
  sortChange: [field: string]
}>()

const allSelected = computed(
  () => props.selectable && props.data.length > 0 && props.selected.length === props.data.length
)
const partialSelected = computed(
  () => props.selectable && props.selected.length > 0 && props.selected.length < props.data.length
)
const errorMsg = computed(() => {
  const e = props.error as string | { message?: string } | null
  return typeof e === 'string' ? e : (e as { message?: string } | null)?.message || '加载失败'
})

function getRowKey(row: Row, idx?: number): RowKey {
  return (row[props.rowKey] as RowKey) ?? idx
}
function isSelected(row: Row): boolean {
  return props.selected.includes(getRowKey(row))
}
function toggleAll() {
  if (allSelected.value) emit('update:selected', [])
  else
    emit(
      'update:selected',
      props.data.map((r, i) => getRowKey(r, i))
    )
}
function toggleRow(row: Row, idx: number) {
  const key = getRowKey(row, idx)
  const next = isSelected(row) ? props.selected.filter((k) => k !== key) : [...props.selected, key]
  emit('update:selected', next)
}
function rowClass(row: Row) {
  return cn(
    'group transition-all duration-150 cursor-pointer',
    'hover:bg-(--color-hover)',
    isSelected(row) && 'bg-(--color-selected)',
    getRowKey(row) === props.activeKey && 'outline outline-2 outline-primary-500'
  )
}

// 计算行的外边距：除首行外顶部 2px，形成紧凑的视觉间隔；
// 选中行底部再额外加 2px，使其与下一行形成卡片分隔感
function rowMargin(idx: number): string {
  const top = idx > 0 ? '2px' : '0'
  const bottom = isSelected(props.data[idx]) ? '2px' : '0'
  return `${top} 0 ${bottom} 0`
}

function getSortIcon(col: TableColumn) {
  if (!col.sortable) return null
  if (props.sortField !== col.key) return ArrowUpDown
  return props.sortOrder === 'ascending' ? ArrowUp : ArrowDown
}

function handleSort(col: TableColumn) {
  if (!col.sortable) return
  emit('sortChange', col.key)
}

const SELECT_COLUMN_WIDTH = 56
// 主列的最小可读宽度：至少能放下 4 个中文字符 + 单元格内边距。
// 低于这个宽度时不再继续压缩主列，而是让表格自身横向滚动。
const FLEX_COLUMN_MIN_WIDTH = 180

// 计算 grid-template-columns：选择列(56px) + 各数据列
const gridTemplateColumns = computed(() => {
  const parts: string[] = []
  if (props.selectable) parts.push(`${SELECT_COLUMN_WIDTH}px`)
  props.columns.forEach((c) => {
    // auto 必须映射为 1fr：CSS Grid 的 auto 轨道只取 max-content，
    // 不会吸收剩余宽度，会让“文件名”这类主列被固定列挤成单字竖排。
    if (c.width === undefined || c.width === 'auto') parts.push('minmax(0, 1fr)')
    else if (typeof c.width === 'number') parts.push(`${c.width}px`)
    else parts.push(c.width as string)
  })
  return parts.join(' ')
})

// 表格的最小总宽度。列很多、侧栏被拖宽或窗口变窄时，固定列会把弹性主列
// 压到只剩几十像素；这里给弹性列兜底，超出部分由外层滚动容器横向滚动。
const gridMinWidth = computed(() => {
  let fixedWidth = props.selectable ? SELECT_COLUMN_WIDTH : 0
  let flexColumns = 0
  props.columns.forEach((c) => {
    if (c.width === undefined || c.width === 'auto') {
      flexColumns++
      return
    }
    if (typeof c.width === 'number') {
      fixedWidth += c.width
      return
    }
    const px = /^(\d+(?:\.\d+)?)px$/.exec(c.width.trim())
    if (px) fixedWidth += Number(px[1])
    else flexColumns++ // 无法静态求宽的弹性表达式，按一列最小宽度预留
  })
  return fixedWidth + flexColumns * FLEX_COLUMN_MIN_WIDTH
})
</script>

<template>
  <div class="w-full text-sm h-full min-h-0 overflow-auto">
    <div class="flex flex-col min-h-full" :style="{ minWidth: `${gridMinWidth}px` }">
      <!-- 粘性表头：与数据共用同一个滚动容器，横向滚动时保持列对齐；
           必须使用不透明背景，否则纵向滚动时行内容会从表头下方透出。 -->
      <div
        class="sticky top-0 z-10 grid shrink-0 items-center bg-(--color-surface) text-[13px] font-semibold py-2.5"
        :style="{ gridTemplateColumns: gridTemplateColumns, color: 'var(--color-text)' }"
      >
        <div v-if="selectable" class="px-3 py-3 flex items-center justify-center">
          <button
            type="button"
            class="size-[18px] rounded-[4px] flex items-center justify-center transition-all duration-200"
            :class="
              allSelected || partialSelected
                ? 'bg-(--color-brand-action) border border-(--color-brand-action) text-white shadow-sm'
                : 'border border-(--color-border-strong) bg-(--color-surface) hover:border-primary-500'
            "
            :aria-checked="allSelected ? 'true' : partialSelected ? 'mixed' : 'false'"
            role="checkbox"
            @click.stop="toggleAll"
          >
            <Check v-if="allSelected" :size="12" :stroke-width="3.5" />
            <Minus v-else-if="partialSelected" :size="12" :stroke-width="3.5" />
          </button>
        </div>
        <div
          v-for="col in columns"
          :key="col.key"
          class="min-w-0 px-3 py-2.5 select-none font-semibold"
          :style="col.width && typeof col.width === 'number' ? { width: `${col.width}px` } : {}"
          :class="[
            col.align === 'right'
              ? 'text-right'
              : col.align === 'center'
                ? 'text-center'
                : 'text-left',
            col.sortable && 'cursor-pointer hover:text-primary-600 transition-colors'
          ]"
          @click="handleSort(col)"
        >
          <div class="inline-flex items-center gap-1 whitespace-nowrap">
            {{ col.title }}
            <template v-if="col.sortable">
              <component
                :is="getSortIcon(col)"
                :size="12"
                :stroke-width="2"
                :class="sortField === col.key ? 'text-primary-600' : 'text-(--color-text-muted)'"
              />
            </template>
          </div>
        </div>
      </div>

      <!-- 数据区：不再单独纵向滚动，避免出现“表头不跟着横向滚动”的两层滚动条 -->
      <div class="flex-1">
        <!-- 骨架屏 -->
        <div v-if="loading || skeleton">
          <div
            v-for="i in skeletonRows"
            :key="i"
            class="grid items-center"
            :style="{ gridTemplateColumns, minHeight: '52px' }"
          >
            <div v-if="selectable" class="px-3 py-2.5 flex justify-center">
              <span
                class="block size-[18px] rounded-[4px] animate-pulse"
                style="background-color: var(--color-surface-container-low)"
              />
            </div>
            <div
              v-for="col in columns"
              :key="col.key"
              class="min-w-0 px-3 py-2.5"
              :class="
                col.align === 'right'
                  ? 'text-right'
                  : col.align === 'center'
                    ? 'text-center'
                    : 'text-left'
              "
            >
              <span
                class="inline-block h-3 rounded-full animate-pulse"
                style="background-color: var(--color-surface-container-low)"
                :style="{
                  width: `${50 + ((i * 13) % 40)}%`,
                  maxWidth:
                    col.width && typeof col.width === 'number' ? `${col.width - 24}px` : '100%'
                }"
              />
            </div>
          </div>
        </div>

        <!-- 错误状态 -->
        <div
          v-else-if="error"
          class="px-3 py-12 text-center text-sm"
          style="color: var(--color-danger-text)"
        >
          加载失败：{{ errorMsg }}
        </div>

        <!-- 空状态 -->
        <div v-else-if="data.length === 0" class="px-3 py-10 text-center">
          <slot v-if="$slots.empty" name="empty" />
          <span v-else class="text-sm" style="color: var(--color-text-muted)">{{ emptyText }}</span>
        </div>

        <!-- 数据行 -->
        <div v-else>
          <div
            v-for="(row, idx) in data"
            :key="getRowKey(row, idx)"
            :class="rowClass(row)"
            :data-active="getRowKey(row) === props.activeKey ? 'true' : undefined"
            class="grid items-center"
            :style="{
              gridTemplateColumns,
              minHeight: '52px',
              margin: rowMargin(idx)
            }"
            @click="emit('rowClick', row, idx, $event)"
            @dblclick="emit('rowDblclick', row, idx)"
            @contextmenu="emit('rowContextmenu', $event, row)"
          >
            <div v-if="selectable" class="px-3 py-2.5 flex items-center justify-center" @click.stop>
              <button
                type="button"
                class="size-[18px] rounded-[4px] flex items-center justify-center transition-all duration-200"
                :class="
                  isSelected(row)
                    ? 'bg-(--color-brand-action) border border-(--color-brand-action) text-white shadow-sm'
                    : 'border border-(--color-border-strong) bg-(--color-surface) opacity-0 group-hover:opacity-100 hover:border-primary-500'
                "
                :aria-checked="isSelected(row) ? 'true' : 'false'"
                role="checkbox"
                @click="toggleRow(row, idx)"
              >
                <Check v-if="isSelected(row)" :size="12" :stroke-width="3.5" />
              </button>
            </div>
            <div
              v-for="col in columns"
              :key="col.key"
              class="min-w-0 px-3 py-2.5"
              :class="
                col.align === 'right'
                  ? 'text-right'
                  : col.align === 'center'
                    ? 'text-center'
                    : 'text-left'
              "
            >
              <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]" :index="idx">
                <span style="color: var(--color-text)">{{ row[col.key] }}</span>
              </slot>
            </div>
          </div>
        </div>

        <!-- 数据下方：跟随数据滚动，位于表格末尾 -->
        <slot name="after-list" />
      </div>
    </div>
  </div>
</template>
