<script setup lang="ts">
/**
 * XmindPreviewer —— XMind 思维导图预览（P1 新增格式）
 *
 * XMind 文件本质是 ZIP 包（.xmind 扩展名），核心内容在 content.json（XMind 8+）
 * 或 content.xml（旧格式）。这里用 JSZip 纯前端解析，零后端改动：
 *   1. fetch ptoken 预览流 → ArrayBuffer
 *   2. JSZip 解包 → 读 content.json
 *   3. 解析 sheet[0].rootTopic 递归树 → 渲染可折叠的思维导图树
 *
 * 复用现有 ptoken 签名直链鉴权，不引入后端依赖。
 */
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import JSZip from 'jszip'
import { getPreviewUrl } from '@/utils/preview'
import XmindNode from './xmind-node.vue'

const props = defineProps({
  fileId: { type: [String, Number], required: true },
  /** 外部已解析好的预览 URL（优先于本地拼接） */
  url: { type: String, default: '' }
})

interface TopicNode {
  id: string
  title: string
  children: TopicNode[]
  note?: string
  /** 分支线颜色（XMind 可为分支指定颜色） */
  branchColor?: string
}

const resolvedUrl = () => props.url || getPreviewUrl(props.fileId)

const root = ref<TopicNode | null>(null)
const loading = ref(true)
const error = ref('')
const sheetTitle = ref('')

// 折叠状态：topic id -> 是否折叠（折叠后隐藏子树）
const collapsed = ref<Set<string>>(new Set())

let loadSeq = 0
let abortCtrl: AbortController | null = null

/** 生成稳定的节点 id（基于 parentPath + title + 索引，避免重复） */
function makeId(parentPath: string, title: string, index: number): string {
  return `${parentPath}/${index}-${title}`.slice(0, 200)
}

/** 递归解析 XMind topic 树 */
function parseTopic(raw: any, parentPath: string, index: number): TopicNode {
  const title =
    typeof raw?.title === 'string'
      ? raw.title
      : raw?.title?.text || raw?.title?.plain || ''
  const node: TopicNode = {
    id: makeId(parentPath, title, index),
    title: title || '(未命名主题)',
    children: []
  }
  if (raw?.note) {
    node.note = typeof raw.note === 'string' ? raw.note : raw.note.plain || raw.note.text || ''
  }
  // XMind 8+ 分支颜色存在 style.properties['svg:fill']
  node.branchColor = raw?.style?.properties?.['svg:fill'] || undefined

  const attached = raw?.children?.attached
  if (Array.isArray(attached)) {
    node.children = attached.map((c: any, i: number) => parseTopic(c, node.id, i))
  }
  return node
}

async function load() {
  const seq = ++loadSeq
  abortCtrl?.abort()
  abortCtrl = new AbortController()
  loading.value = true
  error.value = ''
  root.value = null
  collapsed.value = new Set()
  sheetTitle.value = ''
  try {
    const res = await fetch(resolvedUrl(), { signal: abortCtrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buffer = await res.arrayBuffer()

    const zip = await JSZip.loadAsync(buffer)

    // 优先读 content.json（XMind 8+），旧版 content.xml 暂不支持
    const jsonEntry = zip.file('content.json')
    if (!jsonEntry) {
      throw new Error('暂不支持旧版 XMind（content.xml）格式，请用 XMind 8+ 重新保存')
    }
    const text = await jsonEntry.async('string')
    const parsed = JSON.parse(text)

    const sheets = Array.isArray(parsed) ? parsed : parsed?.sheets
    const sheet = Array.isArray(sheets) ? sheets[0] : sheets?.[0] || sheets
    sheetTitle.value = sheet?.title || '思维导图'

    const rootTopic = sheet?.rootTopic
    if (!rootTopic) {
      if (seq === loadSeq) {
        loading.value = false
        error.value = 'XMind 内容为空'
      }
      return
    }
    if (seq !== loadSeq) return
    root.value = parseTopic(rootTopic, '', 0)
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return
    if (seq !== loadSeq) return
    error.value = e instanceof Error ? e.message : 'XMind 解析失败'
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

function toggle(id: string) {
  const next = new Set(collapsed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsed.value = next
}

/** 统计节点总数（含根） */
const totalNodes = computed(() => countNodes(root.value))
function countNodes(n: TopicNode | null): number {
  if (!n) return 0
  return 1 + n.children.reduce((acc, c) => acc + countNodes(c), 0)
}
</script>

<template>
  <div class="relative flex h-full flex-col bg-(--color-surface-2)">
    <!-- 头部：标题 + 节点统计 -->
    <div class="flex items-center justify-between border-b border-(--color-border) px-4 py-2.5">
      <div class="text-sm font-medium text-(--color-text)">{{ sheetTitle }}</div>
      <div v-if="root" class="text-xs text-(--color-text-muted)">{{ totalNodes }} 个主题</div>
    </div>

    <!-- 树形主体 -->
    <div class="flex-1 overflow-auto p-4">
      <ul v-if="root" class="xmind-tree">
        <XmindNode :node="root" :collapsed="collapsed" @toggle="toggle" />
      </ul>
    </div>

    <!-- 加载/错误态 -->
    <div
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center bg-(--color-surface-2)"
    >
      <div class="size-10 rounded-xl bg-(--color-surface) animate-pulse" />
    </div>
    <div
      v-else-if="error"
      class="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-danger"
    >
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.xmind-tree {
  list-style: none;
  padding: 0;
  margin: 0;
}
</style>
