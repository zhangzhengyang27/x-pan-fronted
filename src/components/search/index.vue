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
import { ElMessage } from '@/composables/useToast'
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
const inputRef = ref(null)

// Ctrl/Cmd+K 聚焦搜索框
function onFocusSearch() {
  inputRef.value?.focus()
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

// 输入时实时建议（本地 Fuse.js 模糊匹配）
watch(searchKey, (val) => {
  if (!val || val.trim().length < 1) {
    suggestions.value = []
    showSuggest.value = false
    return
  }
  const results = fuse.value.search(val.trim()).slice(0, 6)
  suggestions.value = results.map((r) => r.item)
  showSuggest.value = suggestions.value.length > 0
})

function doSearch() {
  if (!searchKey.value.trim()) return
  showSuggest.value = false

  // P1-5：解析自然语言
  const parsed = parseNaturalLanguage(searchKey.value)

  fileStore.setFileTypes('-1')
  fileStore.setSearchFlag(true)
  navbarStore.change('Files')
  fileStore.setSearchKey(parsed.keyword || searchKey.value)

  // 构造后端搜索参数
  const params: Record<string, unknown> = {
    keyword: parsed.keyword || searchKey.value,
    fileTypes: parsed.fileType != null ? String(parsed.fileType) : '-1'
  }
  if (parsed.dateFrom) params.dateFrom = parsed.dateFrom
  if (parsed.dateTo) params.dateTo = parsed.dateTo

  fileService.search(
    params,
    (res) => {
      let list = res.data || []
      // 前端二次过滤大小（后端可能不支持 sizeMin/Max）
      if (parsed.sizeMin != null) {
        list = list.filter((r) => {
          const sz = Number(r.fileSize || 0)
          return sz >= parsed.sizeMin! * 1024 * 1024
        })
      }
      if (parsed.sizeMax != null) {
        list = list.filter((r) => {
          const sz = Number(r.fileSize || 0)
          return sz <= parsed.sizeMax! * 1024 * 1024
        })
      }
      breadcrumbStore.clear()
      breadcrumbStore.addItem({ id: defaultParentId.value, name: defaultParentFilename.value })
      breadcrumbStore.addItem({ id: '-1', name: '搜索：' + searchKey.value })
      fileStore.setFileList(list)
    },
    (res) => ElMessage.error(res.message)
  )
}

// 点击建议项：直接预览/进入
function clickSuggestion(item) {
  showSuggest.value = false
  searchKey.value = item.filename || item.name || ''
  // 触发 file-table 的预览逻辑：通过自定义事件
  window.dispatchEvent(new CustomEvent('x-pan:quick-preview', { detail: item }))
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
        @focus="showSuggest = suggestions.length > 0"
      />
    </form>

    <!-- 搜索建议下拉（P1-5 Fuse.js 本地模糊匹配） -->
    <Transition name="modal">
      <div
        v-if="showSuggest && suggestions.length > 0"
        class="absolute top-full left-0 right-0 mt-1 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg overflow-hidden z-[var(--z-dropdown)]"
      >
        <button
          v-for="(item, i) in suggestions"
          :key="i"
          type="button"
          class="w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--color-surface-2)]"
          @mousedown.prevent="clickSuggestion(item)"
        >
          <span class="size-2 rounded-full bg-[var(--color-primary-500)] shrink-0" />
          <span class="truncate flex-1 text-[var(--color-text)]">{{ item.filename || item.name }}</span>
          <span class="text-xs text-[var(--color-text-muted)] shrink-0">{{ item.fileSizeDesc }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>
