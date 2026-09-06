<script setup lang="ts">
/**
 * AppSearch —— 全局搜索（P1-5 增强）
 * - 后端关键词搜索（已有）
 * - P1-5：自然语言短语解析（"上周""大于100MB""图片"等）+ Fuse.js 本地模糊匹配
 * - 搜索建议下拉（输入时实时匹配本地文件）
 */
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import Fuse from 'fuse.js'
import fileService from '@/api/file'
import { useFileStore } from '@/stores/file'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import { useNavbarStore } from '@/stores/navbar'
import { storeToRefs } from 'pinia'
import { Search as SearchIcon } from '@lucide/vue'

import BaseInput from '@/components/base/BaseInput.vue'

const fileStore = useFileStore()
const breadcrumbStore = useBreadcrumbStore()
const navbarStore = useNavbarStore()
const { defaultParentId, defaultParentFilename, fileList } = storeToRefs(fileStore)

const searchKey = ref('')
const showSuggest = ref(false)
const suggestions = ref([])
/** 后端联想词（字符串关键词，点击后直接搜索） */
const suggestWords = ref<string[]>([])
/** 热搜词 */
const hotWords = ref<string[]>([])
const inputRef = ref(null)

let suggestTimer: ReturnType<typeof setTimeout> | null = null

/** 防抖调后端 suggest */
function fetchSuggest(prefix: string) {
  if (suggestTimer) clearTimeout(suggestTimer)
  suggestTimer = setTimeout(() => {
    fileService.suggest(
      prefix,
      (res) => {
        suggestWords.value = res.data || []
      },
      () => {
        suggestWords.value = []
      }
    )
  }, 200)
}

/** 加载热搜词（聚焦空框时展示） */
function fetchHot() {
  fileService.hot(
    10,
    (res) => {
      hotWords.value = res.data || []
    },
    () => {}
  )
}

// Ctrl/Cmd+K 聚焦搜索框
function onFocusSearch() {
  inputRef.value?.focus()
}

// 输入框聚焦：空框时加载热搜并展示下拉
function onInputFocus() {
  if (!searchKey.value.trim()) {
    if (hotWords.value.length === 0) fetchHot()
    showSuggest.value = true
  } else {
    showSuggest.value = suggestions.value.length > 0 || suggestWords.value.length > 0
  }
}
onMounted(() => {
  window.addEventListener('xpan:focus-search', onFocusSearch)
})
onBeforeUnmount(() => {
  window.removeEventListener('xpan:focus-search', onFocusSearch)
})

// Fuse.js 配置：模糊匹配文件名，容忍拼写错误
const fuse = computed(
  () =>
    new Fuse(fileList.value, {
      keys: ['filename', 'name'],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 1,
      includeScore: true
    })
)

// P1-5：自然语言短语解析
interface ParsedQuery {
  keyword: string
  fileType?: number // 0 文件夹 7 图片 8 音频 9 视频 3/4/10 文档
  sizeMin?: number // MB
  sizeMax?: number // MB
  dateFrom?: string
  dateTo?: string
}

function parseNaturalLanguage(input: string): ParsedQuery {
  const q: ParsedQuery = { keyword: '' }
  let text = input.trim()

  // 时间解析："今天/昨天/本周/上周/本月/上月/最近N天"
  const today = new Date()
  const dayMs = 86400000
  if (/今天/.test(text)) {
    q.dateFrom = new Date(today.getTime() - dayMs).toISOString().slice(0, 10)
    text = text.replace(/今天/g, '')
  } else if (/昨天/.test(text)) {
    q.dateFrom = new Date(today.getTime() - 2 * dayMs).toISOString().slice(0, 10)
    q.dateTo = new Date(today.getTime() - dayMs).toISOString().slice(0, 10)
    text = text.replace(/昨天/g, '')
  } else if (/本周/.test(text)) {
    const weekStart = today.getTime() - ((today.getDay() + 6) % 7) * dayMs
    q.dateFrom = new Date(weekStart).toISOString().slice(0, 10)
    text = text.replace(/本周/g, '')
  } else if (/上周/.test(text)) {
    const weekStart = today.getTime() - ((today.getDay() + 6) % 7) * dayMs - 7 * dayMs
    q.dateFrom = new Date(weekStart).toISOString().slice(0, 10)
    q.dateTo = new Date(weekStart + 6 * dayMs).toISOString().slice(0, 10)
    text = text.replace(/上周/g, '')
  } else if (/本月/.test(text)) {
    q.dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
    text = text.replace(/本月/g, '')
  } else if (/上月/.test(text)) {
    q.dateFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10)
    q.dateTo = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10)
    text = text.replace(/上月/g, '')
  } else {
    const recentMatch = text.match(/最近\s*(\d+)\s*天/)
    if (recentMatch) {
      const days = parseInt(recentMatch[1], 10)
      q.dateFrom = new Date(today.getTime() - days * dayMs).toISOString().slice(0, 10)
      text = text.replace(recentMatch[0], '')
    }
  }

  // 文件类型解析
  if (/图片|照片|image|photo/i.test(text)) {
    q.fileType = 7
    text = text.replace(/图片|照片|image|photo/gi, '')
  } else if (/视频|video/i.test(text)) {
    q.fileType = 9
    text = text.replace(/视频|video/gi, '')
  } else if (/音乐|音频|music|audio/i.test(text)) {
    q.fileType = 8
    text = text.replace(/音乐|音频|music|audio/gi, '')
  } else if (/文档|doc|word|pdf|excel|ppt/i.test(text)) {
    // 文档类型不限定单一 fileType，留给后端 extensions
    text = text.replace(/文档|doc|word|pdf|excel|ppt/gi, '')
  } else if (/文件夹|目录|folder/i.test(text)) {
    q.fileType = 0
    text = text.replace(/文件夹|目录|folder/gi, '')
  }

  // 大小解析："大于100MB""小于1GB""超过50M"
  const sizeMinMatch = text.match(/(?:大于|超过|至少|>|≥)\s*(\d+(?:\.\d+)?)\s*(GB|MB|KB|G|M|K)/i)
  if (sizeMinMatch) {
    q.sizeMin = normalizeSize(parseFloat(sizeMinMatch[1]), sizeMinMatch[2])
    text = text.replace(sizeMinMatch[0], '')
  }
  const sizeMaxMatch = text.match(/(?:小于|至多|不超过|<|≤)\s*(\d+(?:\.\d+)?)\s*(GB|MB|KB|G|M|K)/i)
  if (sizeMaxMatch) {
    q.sizeMax = normalizeSize(parseFloat(sizeMaxMatch[1]), sizeMaxMatch[2])
    text = text.replace(sizeMaxMatch[0], '')
  }

  q.keyword = text.trim()
  return q
}

function normalizeSize(num: number, unit: string): number {
  const u = unit.toUpperCase()
  if (u.startsWith('G')) return num * 1024
  if (u.startsWith('M')) return num
  if (u.startsWith('K')) return num / 1024
  return num
}

// 输入时实时建议（本地 Fuse.js 模糊匹配 + 后端 suggest 联想词）
watch(searchKey, (val) => {
  if (!val || val.trim().length < 1) {
    suggestions.value = []
    suggestWords.value = []
    showSuggest.value = false
    return
  }
  const trimmed = val.trim()
  const results = fuse.value.search(trimmed).slice(0, 6)
  suggestions.value = results.map((r) => r.item)
  fetchSuggest(trimmed)
  showSuggest.value = suggestions.value.length > 0 || suggestWords.value.length > 0
})

// 点击联想词：填入搜索框并执行搜索
function clickSuggestionWord(word: string) {
  showSuggest.value = false
  searchKey.value = word
  doSearch()
}

function doSearch() {
  if (!searchKey.value.trim()) return
  showSuggest.value = false

  // P1-5：解析自然语言
  const parsed = parseNaturalLanguage(searchKey.value)

  fileStore.setFileTypes('-1')
  navbarStore.change('Files')
  fileStore.setSearchKey(parsed.keyword || searchKey.value)

  // 构造后端搜索参数
  const params: {
    keyword: string
    fileTypes?: string
    dateFrom?: string
    dateTo?: string
  } = {
    keyword: parsed.keyword || searchKey.value,
    fileTypes: parsed.fileType != null ? String(parsed.fileType) : '-1'
  }
  if (parsed.dateFrom) params.dateFrom = parsed.dateFrom
  if (parsed.dateTo) params.dateTo = parsed.dateTo

  // 走 store 统一搜索入口：与目录加载共享 requestSeq，丢弃过期响应，避免旧结果覆盖新目录
  fileStore.searchByParams(params, {
    // 前端二次过滤大小（后端可能不支持 sizeMin/Max）
    transform: (list) => {
      let out = list
      if (parsed.sizeMin != null) {
        out = out.filter((r) => {
          const sz = Number(r.fileSize || 0)
          return sz >= parsed.sizeMin! * 1024 * 1024
        })
      }
      if (parsed.sizeMax != null) {
        out = out.filter((r) => {
          const sz = Number(r.fileSize || 0)
          return sz <= parsed.sizeMax! * 1024 * 1024
        })
      }
      return out
    },
    // 仅在响应仍最新时更新面包屑（过期响应不再触碰面包屑状态）
    onFresh: () => {
      breadcrumbStore.clear()
      breadcrumbStore.addItem({ id: defaultParentId.value, name: defaultParentFilename.value })
      breadcrumbStore.addItem({ id: '-1', name: '搜索：' + searchKey.value })
    }
  })
}

// 点击建议项：执行搜索并进入结果列表
function clickSuggestion(item) {
  showSuggest.value = false
  searchKey.value = item.filename || ''
  doSearch()
}
</script>

<template>
  <div class="w-full relative">
    <form
      autocomplete="off"
      data-form-type="other"
      data-lpignore="true"
      data-1p-ignore="true"
      class="block w-full m-0 p-0"
      @submit.prevent="doSearch"
    >
      <BaseInput
        ref="inputRef"
        v-model="searchKey"
        type="search"
        placeholder="搜索文件…"
        :prefix="SearchIcon"
        name="xpan-search"
        autocomplete="off"
        input-mode="search"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        clearable
        @enter="doSearch"
        @focus="onInputFocus"
      />
    </form>

    <!-- 搜索建议下拉（本地 Fuse + 后端 suggest 联想词 + 热搜词） -->
    <Transition name="modal">
      <div
        v-if="showSuggest && (suggestions.length > 0 || suggestWords.length > 0 || hotWords.length > 0)"
        class="absolute top-full left-0 right-0 mt-1 rounded-sm border border-(--color-border) bg-(--color-surface) shadow-lg overflow-hidden z-(--z-dropdown)"
      >
        <!-- 后端联想词 -->
        <template v-if="suggestWords.length > 0">
          <p class="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-(--color-text-muted)">联想</p>
          <button
            v-for="(word, i) in suggestWords"
            :key="'w' + i"
            type="button"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors hover:bg-(--color-surface-2)"
            @mousedown.prevent="clickSuggestionWord(word)"
          >
            <SearchIcon :size="14" class="text-primary-500 shrink-0" />
            <span class="truncate flex-1 text-(--color-text)">{{ word }}</span>
          </button>
        </template>

        <!-- 本地文件建议 -->
        <template v-if="suggestions.length > 0">
          <p v-if="suggestWords.length > 0" class="px-3 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-(--color-text-muted)">文件</p>
          <button
            v-for="(item, i) in suggestions"
            :key="i"
            type="button"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors hover:bg-(--color-surface-2)"
            @mousedown.prevent="clickSuggestion(item)"
          >
            <span class="size-2 rounded-full bg-primary-500 shrink-0" />
            <span class="truncate flex-1 text-(--color-text)">{{ item.filename }}</span>
            <span class="text-xs text-(--color-text-muted) shrink-0">{{ item.fileSizeDesc }}</span>
          </button>
        </template>

        <!-- 热搜词（空框聚焦时） -->
        <template v-if="!searchKey.trim() && hotWords.length > 0">
          <p class="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-(--color-text-muted)">热搜</p>
          <button
            v-for="(word, i) in hotWords"
            :key="'h' + i"
            type="button"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors hover:bg-(--color-surface-2)"
            @mousedown.prevent="clickSuggestionWord(word)"
          >
            <span class="w-4 text-xs font-bold text-(--color-text-muted) shrink-0">{{ i + 1 }}</span>
            <span class="truncate flex-1 text-(--color-text)">{{ word }}</span>
          </button>
        </template>
      </div>
    </Transition>
  </div>
</template>
