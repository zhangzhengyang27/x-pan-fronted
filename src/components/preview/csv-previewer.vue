<script setup lang="ts">
/**
 * CsvPreviewer —— CSV 表格预览（P0 新增格式）
 * 纯前端解析：fetch 预览流 → decodeTextContent 编码识别 → 轻量 CSV 解析 → 表格渲染。
 * 复用现有 ptoken 签名直链 + 编码识别能力，零后端改动。
 */
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import { getPreviewUrl, decodeTextContent } from '@/utils/preview'

const props = defineProps({
  fileId: { type: [String, Number], required: true },
  /** 外部已解析好的预览 URL（优先于本地拼接） */
  url: { type: String, default: '' }
})

const resolvedUrl = () => props.url || getPreviewUrl(props.fileId)

const headers = ref<string[]>([])
const rows = ref<string[][]>([])
const loading = ref(true)
const error = ref('')
const truncated = ref(false)

// 大文件保护：最多解析前 N 行（CSV 表格预览无需全量）
const MAX_ROWS = 5000
const MAX_CELLS = 200 // 单行单元格上限，防异常超宽行

/**
 * 轻量 CSV 解析器：支持引号包裹字段、转义双引号、逗号/制表符分隔、\r\n 换行。
 * 不引入重型库，避免额外依赖。
 */
function parseCsv(text: string): string[][] {
  const result: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const n = text.length

  while (i < n) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',' || ch === '\t' || ch === ';') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (ch === '\n' || ch === '\r') {
      // 处理 \r\n
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((c) => c !== '')) result.push(row)
      row = []
      i++
      continue
    }
    field += ch
    i++
  }
  // 收尾
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.some((c) => c !== '')) result.push(row)
  }
  return result
}

let loadSeq = 0
let abortCtrl: AbortController | null = null

async function load() {
  const seq = ++loadSeq
  abortCtrl?.abort()
  abortCtrl = new AbortController()
  loading.value = true
  error.value = ''
  truncated.value = false
  headers.value = []
  rows.value = []
  try {
    const res = await fetch(resolvedUrl(), { signal: abortCtrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buffer = await res.arrayBuffer()
    const declaredCharset = res.headers.get('content-type')?.match(/charset=([\w-]+)/i)?.[1]
    let text = decodeTextContent(buffer, declaredCharset)
    // 空文件
    if (!text.trim()) {
      if (seq === loadSeq) loading.value = false
      return
    }
    const data = parseCsv(text)
    if (data.length === 0) {
      if (seq === loadSeq) loading.value = false
      return
    }
    const header = data[0].slice(0, MAX_CELLS)
    const body: string[][] = []
    for (let r = 1; r < data.length && r < MAX_ROWS; r++) {
      body.push(data[r].slice(0, MAX_CELLS))
    }
    if (data.length > MAX_ROWS) truncated.value = true
    if (seq !== loadSeq) return
    headers.value = header
    rows.value = body
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return
    if (seq !== loadSeq) return
    error.value = e instanceof Error ? e.message : 'CSV 加载失败'
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

onMounted(load)
watch(() => [props.fileId, props.url], load)

onBeforeUnmount(() => {
  abortCtrl?.abort()
  abortCtrl = null
})

const colCount = computed(() => headers.value.length)
</script>

<template>
  <div class="relative flex h-full flex-col bg-(--color-surface-2)">
    <div class="flex-1 overflow-auto">
      <table class="csv-table min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th class="csv-index">#</th>
            <th
              v-for="(h, i) in headers"
              :key="i"
              class="csv-cell csv-head"
            >
              {{ h || `列 ${i + 1}` }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, r) in rows" :key="r">
            <td class="csv-index">{{ r + 1 }}</td>
            <td v-for="(cell, c) in row" :key="c" class="csv-cell">
              {{ cell }}
            </td>
            <td v-if="row.length < colCount" :colspan="colCount - row.length" />
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="truncated"
      class="px-4 py-2 text-xs text-(--color-text-muted) border-t border-(--color-border) bg-(--color-surface)"
    >
      数据量较大，仅展示前 {{ MAX_ROWS - 1 }} 行。请下载完整文件查看。
    </div>

    <div
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center bg-(--color-surface-2)"
    >
      <div class="size-10 rounded-xl bg-(--color-surface) animate-pulse" />
    </div>
    <div
      v-else-if="error"
      class="absolute inset-0 flex items-center justify-center text-sm text-danger"
    >
      {{ error }}
    </div>
    <div
      v-else-if="headers.length === 0"
      class="absolute inset-0 flex items-center justify-center text-sm text-(--color-text-muted)"
    >
      空文件
    </div>
  </div>
</template>

<style scoped>
.csv-table {
  font-variant-numeric: tabular-nums;
}
.csv-cell {
  padding: 6px 12px;
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-text);
}
.csv-head {
  position: sticky;
  top: 0;
  background: var(--color-surface);
  font-weight: 600;
  color: var(--color-text);
  z-index: 1;
}
.csv-index {
  position: sticky;
  left: 0;
  background: var(--color-surface);
  padding: 6px 10px;
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  text-align: right;
  color: var(--color-text-muted);
  font-size: 12px;
  white-space: nowrap;
  z-index: 1;
}
thead .csv-index {
  z-index: 2;
}
</style>
