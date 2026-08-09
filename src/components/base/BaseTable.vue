<script setup>
/**
 * BaseTable —— 通用表格（基础版）
 * - 粘性表头
 * - 行 hover
 * - 多选（checkbox 列）
 * - 加载 / 空 / 错误三态
 * - skeleton 骨架屏（skeleton=true 时启用）
 *
 * 列定义通过 columns prop 传入：
 *   [{ key: 'name', title: '文件名', width: 'auto', align: 'left' }, ...]
 */
import { computed } from 'vue'
import { Check, Minus } from '@lucide/vue'
import { cn } from '@/utils/classnames'

const props = defineProps({
  columns: { type: Array, required: true },
  data: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  skeleton: { type: Boolean, default: false }, // 首次加载骨架屏
  error: { type: [String, Object], default: '' },
  rowKey: { type: String, default: 'id' },
  selectable: { type: Boolean, default: false },
  selected: { type: Array, default: () => [] },
  emptyText: { type: String, default: '暂无数据' },
  skeletonRows: { type: Number, default: 5 }
})

const emit = defineEmits(['update:selected', 'rowClick', 'rowDblclick', 'rowContextmenu'])

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
function rowClass(row, idx) {
  return cn(
    'transition-colors duration-150 cursor-pointer',
    'hover:bg-[var(--color-surface-2)]',
    isSelected(row) && 'bg-[var(--color-primary-50)] hover:bg-[var(--color-primary-50)]',
    'dark:hover:bg-[var(--color-surface-2)]',
    isSelected(row) && 'dark:bg-[var(--color-primary-900)]/20'
  )
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
              class="size-4 rounded border border-[var(--color-border-strong)] flex items-center justify-center transition-colors"
              :class="
                (allSelected || partialSelected) &&
                'bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white'
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
            :class="
              col.align === 'right'
                ? 'text-right'
                : col.align === 'center'
                  ? 'text-center'
                  : 'text-left'
            "
            :style="
              col.width
                ? { width: typeof col.width === 'number' ? `${col.width}px` : col.width }
                : {}
            "
          >
            {{ col.title }}
          </th>
        </tr>
      </thead>
      <tbody v-if="loading || skeleton">
        <tr
          v-for="i in skeletonRows"
          :key="i"
          class="border-b border-[var(--color-border)] last:border-b-0"
        >
          <td v-if="selectable" class="w-12 px-4 py-3">
            <span class="block size-4 rounded bg-[var(--color-surface-2)] animate-pulse" />
          </td>
          <td v-for="col in columns" :key="col.key" class="px-4 py-3">
            <span
              class="inline-block h-3 rounded bg-[var(--color-surface-2)] animate-pulse"
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
            class="px-4 py-16 text-center text-[var(--color-danger)]"
          >
            加载失败：{{ typeof error === 'string' ? error : error?.message }}
          </td>
        </tr>
      </tbody>
      <tbody v-else-if="data.length === 0">
        <tr>
          <td
            :colspan="columns.length + (selectable ? 1 : 0)"
            class="px-4 py-16 text-center text-[var(--color-text-muted)]"
          >
            {{ emptyText }}
          </td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr
          v-for="(row, idx) in data"
          :key="getRowKey(row, idx)"
          :class="rowClass(row, idx)"
          class="border-b border-[var(--color-border)] last:border-b-0"
          @click="emit('rowClick', row, idx)"
          @dblclick="emit('rowDblclick', row, idx)"
          @contextmenu="emit('rowContextmenu', $event, row)"
        >
          <td v-if="selectable" class="w-12 px-4 py-3" @click.stop>
            <button
              type="button"
              class="size-4 rounded border border-[var(--color-border-strong)] flex items-center justify-center transition-colors"
              :class="
                isSelected(row) &&
                'bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-white'
              "
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
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
