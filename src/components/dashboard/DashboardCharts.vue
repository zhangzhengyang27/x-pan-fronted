<script setup>
/**
 * DashboardCharts —— 仪表盘图表
 * P1.10 增强：
 * - 存储历史曲线（基于 localStorage 每日打点）
 * - 分类分布柱状图（基于当前列表）
 *
 * 无图表库依赖，纯 SVG
 */
import {computed, ref, watch, onMounted} from 'vue'
import {TrendingUp, BarChart3, Trash2} from '@lucide/vue'
import {cn} from '@/utils/classnames'

const props = defineProps({
  files: {type: Array, default: () => []},
})

const STORAGE_KEY = 'x-pan:storage-history'

// ─── 存储历史 ─────────────────────────────────────────────────────────────
function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

const history = ref(loadHistory())

function recordToday(files) {
  const total = files.reduce((sum, f) => {
    const m = String(f.fileSizeDesc || '').match(/^([\d.]+)\s*(B|KB|MB|GB|K|M|G)?$/i)
    if (!m) return sum
    const n = parseFloat(m[1])
    const unit = (m[2] || 'B').toUpperCase()
    const mul = {B: 1, K: 1024, KB: 1024, M: 1024 * 1024, MB: 1024 * 1024, G: 1024 * 1024 * 1024, GB: 1024 * 1024 * 1024}[unit] || 1
    return sum + n * mul
  }, 0)
  const today = new Date().toISOString().slice(0, 10)
  const idx = history.value.findIndex((h) => h.date === today)
  if (idx >= 0) {
    history.value[idx].bytes = Math.round(total)
  } else {
    history.value.push({date: today, bytes: Math.round(total)})
    if (history.value.length > 30) history.value.shift()
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.value))
  } catch {}
}

watch(
  () => props.files,
  (v) => v && recordToday(v),
  {immediate: true},
)

// ─── 历史曲线 SVG ──────────────────────────────────────────────────────────
const chartData = computed(() => {
  const data = history.value.slice(-14) // 最近 14 天
  if (data.length === 0) return null
  const max = Math.max(...data.map((d) => d.bytes), 1)
  const w = 280
  const h = 80
  const stepX = data.length > 1 ? w / (data.length - 1) : w
  const points = data.map((d, i) => `${i * stepX},${h - (d.bytes / max) * h * 0.9}`)
  const path = `M ${points.join(' L ')}`
  const fillPath = `${path} L ${(data.length - 1) * stepX},${h} L 0,${h} Z`
  return {path, fillPath, data, max, w, h, stepX}
})

function formatBytes(b) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

// ─── 分类柱状图 ───────────────────────────────────────────────────────────
const distribution = computed(() => {
  const cats = {folder: 0, image: 0, video: 0, doc: 0, audio: 0, archive: 0, code: 0, other: 0}
  props.files.forEach((f) => {
    if (f.folderFlag === 1) cats.folder++
    else {
      const t = f.fileType
      if ([7].includes(t)) cats.image++
      else if ([9].includes(t)) cats.video++
      else if ([3, 4, 5, 6, 10].includes(t)) cats.doc++
      else if ([8].includes(t)) cats.audio++
      else if ([2].includes(t)) cats.archive++
      else if ([11].includes(t)) cats.code++
      else cats.other++
    }
  })
  const total = Object.values(cats).reduce((a, b) => a + b, 0) || 1
  return Object.entries(cats).map(([key, value]) => ({
    key,
    label: {folder: '文件夹', image: '图片', video: '视频', doc: '文档', audio: '音频', archive: '压缩', code: '代码', other: '其他'}[key],
    value,
    ratio: value / total,
    color: {
      folder: 'bg-[var(--color-primary-500)]',
      image: 'bg-pink-500',
      video: 'bg-violet-500',
      doc: 'bg-blue-500',
      audio: 'bg-rose-500',
      archive: 'bg-amber-500',
      code: 'bg-orange-500',
      other: 'bg-slate-500',
    }[key],
  }))
})

function clearHistory() {
  history.value = []
  localStorage.removeItem(STORAGE_KEY)
}

onMounted(() => recordToday(props.files))
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
    <!-- 存储历史曲线 -->
    <div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-[var(--color-text)] flex items-center gap-1.5">
          <TrendingUp :size="14"/>
          存储趋势（最近 14 天）
        </h3>
        <button v-if="history.length > 0" type="button" class="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)] inline-flex items-center gap-1" @click="clearHistory">
          <Trash2 :size="12"/>
          清空
        </button>
      </div>
      <div v-if="!chartData" class="py-6 text-center text-xs text-[var(--color-text-muted)]">
        暂无数据，再访问几次后会显示趋势
      </div>
      <div v-else>
        <svg :viewBox="`0 0 ${chartData.w} ${chartData.h}`" class="w-full" style="height: 80px">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--color-primary-500)" stop-opacity="0.4"/>
              <stop offset="100%" stop-color="var(--color-primary-500)" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path :d="chartData.fillPath" fill="url(#chartGradient)"/>
          <path :d="chartData.path" fill="none" stroke="var(--color-primary-500)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="flex justify-between mt-1 text-[10px] text-[var(--color-text-muted)]">
          <span>{{ chartData.data[0]?.date.slice(5) }}</span>
          <span>最大: {{ formatBytes(chartData.max) }}</span>
          <span>{{ chartData.data[chartData.data.length - 1]?.date.slice(5) }}</span>
        </div>
      </div>
    </div>

    <!-- 分类柱状图 -->
    <div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-[var(--color-text)] flex items-center gap-1.5">
          <BarChart3 :size="14"/>
          分类分布
        </h3>
        <span class="text-xs text-[var(--color-text-muted)] tabular-nums">{{ files.length }} 项</span>
      </div>
      <div class="space-y-2">
        <div v-for="d in distribution" :key="d.key" class="flex items-center gap-2">
          <span class="w-12 text-xs text-[var(--color-text-muted)]">{{ d.label }}</span>
          <div class="flex-1 h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
            <div :class="cn('h-full transition-all', d.color)" :style="{width: `${Math.max(d.ratio * 100, d.value ? 4 : 0)}%`}"/>
          </div>
          <span class="w-8 text-right text-xs text-[var(--color-text)] tabular-nums">{{ d.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>