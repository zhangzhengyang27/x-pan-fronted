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
import { Check, Minus, ArrowUp, ArrowDown, ArrowUpDown } from '@lucide/vue'
import { cn } from '@/utils/classnames'

const props = defineProps({
  columns: { type: Array, required: true },
  data: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  skeleton: { type: Boolean, default: false },
  error: { type: [String, Object], default: '' },
  rowKey: { type: String, default: 'id' },
  selectable: { type: Boolean, default: false },
  selected: { type: Array, default: () => [] },
  emptyText: { type: String, default: '暂无数据' },
  skeletonRows: { type: Number, default: 5 },
  sortField: { type: String, default: '' },
  sortOrder: { type: String, default: '' }
})

const emit = defineEmits(['update:selected', 'rowClick', 'rowDblclick', 'rowContextmenu', 'sortChange'])

const allSelected = computed(
  () => props.selectable && props.data.length > 0 && props.selected.length === props.data.length
)
const partialSelected = computed(
  () => props.selectable && props.selected.length > 0 && props.selected.length < props.data.length
)

function getRowKey(row, idx) {
  return row[props.rowKey] ?? idx
}
function isSelected(row) {
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
function toggleRow(row, idx) {
  const key = getRowKey(row, idx)
  const next = isSelected(row) ? props.selected.filter((k) => k !== key) : [...props.selected, key]
  emit('update:selected', next)
}
function rowClass(row) {
  return cn(
    'transition-colors duration-150 cursor-pointer',
    'hover:bg-[var(--color-surface-2)]',
    isSelected(row) && 'bg-[rgba(0,112,243,0.1)]'
  )
}

function getSortIcon(col) {
  if (!col.sortable) return null
  if (props.sortField !== col.key) return ArrowUpDown
  return props.sortOrder === 'ascending' ? ArrowUp : ArrowDown
}

function handleSort(col) {
  if (!col.sortable) return
  emit('sortChange', col.key)
}
</script>

<template>
  <div
    class="w-full overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
  >
    <table class="w-full text-sm border-collapse">
      <thead class="sticky top-0 z-10 bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
        <tr class="border-b border-[var(--color-border)]">
          <th v-if="selectable" class="w-12 px-4 py-3 text-left">
            <button
              type="button"
              class="size-4 rounded flex items-center justify-center transition-colors"
              style="border: 1px solid var(--color-border-strong);"
              :style="
                (allSelected || partialSelected)
                  ? 'background-color: var(--color-primary-500); border-color: var(--color-primary-500); color: white;'
                  : ''
              "
              :aria-checked="allSelected ? 'true' : partialSelected ? 'mixed' : 'false'"
              role="checkbox"
              @click.stop="toggleAll"
            >
              <Check v-if="allSelected" :size="12" :stroke-width="3" />
              <Minus v-else-if="partialSelected" :size="12" :stroke-width="3" />
            </button>
          </th>
          <th
            v-for="col in columns"
            :key="col.key"
            class="px-4 py-3 font-medium select-none"
            :class="[
              col.align === 'right'
                ? 'text-right'
                : col.align === 'center'
                  ? 'text-center'
                  : 'text-left',
              col.sortable && 'cursor-pointer hover:bg-[var(--color-surface-container-high)] transition-colors'
            ]"
            :style="
              col.width
                ? { width: typeof col.width === 'number' ? `${col.width}px` : col.width }
                : {}
            "
            @click="handleSort(col)"
          >
            <div class="inline-flex items-center gap-1">
              {{ col.title }}
              <template v-if="col.sortable">
                <component
                  :is="getSortIcon(col)"
                  :size="12"
                  :stroke-width="2"
                  :style="sortField === col.key ? 'color: var(--color-primary-500);' : 'color: var(--color-text-muted); opacity: 0.5;'"
                />
              </template>
            </div>
          </th>
        </tr>
      </thead>
      <tbody v-if="loading || skeleton">
        <tr
          v-for="i in skeletonRows"
          :key="i"
          class="border-b border-[var(--color-border)]"
        >
          <td v-if="selectable" class="w-12 px-4 py-3">
            <span class="block size-4 rounded animate-pulse" style="background-color: var(--color-surface-container-low);" />
          </td>
          <td v-for="col in columns" :key="col.key" class="px-4 py-3">
            <span
              class="inline-block h-3 rounded animate-pulse"
              style="background-color: var(--color-surface-container-low);"
              :style="{
                width: `${50 + ((i * 13) % 40)}%`,
                maxWidth:
                  col.width && typeof col.width === 'number' ? `${col.width - 32}px` : '100%'
              }"
            />
          </td>
        </tr>
      </tbody>
      <tbody v-else-if="error">
        <tr>
          <td
            :colspan="columns.length + (selectable ? 1 : 0)"
            class="px-4 py-16 text-center"
            style="color: var(--color-danger);"
          >
            加载失败：{{ typeof error === 'string' ? error : error?.message }}
          </td>
        </tr>
      </tbody>
      <tbody v-else-if="data.length === 0">
        <tr>
          <td
            :colspan="columns.length + (selectable ? 1 : 0)"
            class="px-4 py-16 text-center"
            style="color: var(--color-text-muted);"
          >
            {{ emptyText }}
          </td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr
          v-for="(row, idx) in data"
          :key="getRowKey(row, idx)"
          :class="rowClass(row)"
          class="border-b border-[var(--color-border)]"
          @click="emit('rowClick', row, idx)"
          @dblclick="emit('rowDblclick', row, idx)"
          @contextmenu="emit('rowContextmenu', $event, row)"
        >
          <td v-if="selectable" class="w-12 px-4 py-3" @click.stop>
            <button
              type="button"
              class="size-4 rounded flex items-center justify-center transition-colors"
              style="border: 1px solid var(--color-border-strong);"
              :style="isSelected(row) ? 'background-color: var(--color-primary-500); border-color: var(--color-primary-500); color: white;' : ''"
              :aria-checked="isSelected(row) ? 'true' : 'false'"
              role="checkbox"
              @click="toggleRow(row, idx)"
            >
              <Check v-if="isSelected(row)" :size="12" :stroke-width="3" />
            </button>
          </td>
          <td
            v-for="col in columns"
            :key="col.key"
            class="px-4 py-3"
            :class="
              col.align === 'right'
                ? 'text-right'
                : col.align === 'center'
                  ? 'text-center'
                  : 'text-left'
            "
          >
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]" :index="idx">
              <span style="color: var(--color-text);">{{ row[col.key] }}</span>
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
