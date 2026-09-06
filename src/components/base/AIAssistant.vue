<script setup lang="ts">
/**
 * AIAssistant —— AI 助手对话框（P1-10 接入真实 LLM）
 *
 * 能力（DeepSeek 驱动）：
 * - 自然语言搜索（"找上周的图片" → LLM 解析为参数 → 调 fileService.search）
 * - 文件摘要（选中文件 → 基于文件名分类整理建议）
 * - 智能重命名建议（选中文件 → LLM 建议规范名称）
 * - 闲聊问答（通用对话，流式输出）
 *
 * API Key 配置：点击齿轮按钮，输入 DeepSeek API Key，存 localStorage
 * 切换 LLM：修改 src/composables/useLLM.ts
 */
import { computed, nextTick, ref, watch } from 'vue'
import {
  Sparkles,
  Send,
  User as UserIcon,
  LoaderCircle,
  FileText,
  Image as ImageIcon,
  Settings,
  Search as SearchIcon,
  Wand2,
  MessageCircle,
  AlertCircle,
  Check
} from '@lucide/vue'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'
import BaseInput from './BaseInput.vue'
import { useAIAssistant } from '@/composables/useAIAssistant'
import { useLLM, type LLMMessage } from '@/composables/useLLM'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'

defineProps({
  open: { type: Boolean, default: false }
})

const emit = defineEmits(['update:open'])

const fileStore = useFileStore()
const { multipleSelection } = storeToRefs(fileStore)
const { run, isConfigured } = useAIAssistant()
const { setApiKey } = useLLM()

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const messages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    content:
      '你好，我是 X-Pan AI 助手 ✨\n\n我可以帮你：\n• 智能搜索文件（"找上周的图片"）\n• 整理选中文件（选中后说"总结"）\n• 建议重命名（选中后说"改名"）\n• 闲聊问答\n\n试试问我点什么吧～'
  }
])
const input = ref('')
const loading = ref(false)
const scrollRef = ref<HTMLElement | null>(null)
const errorMsg = ref('')

// API Key 配置面板
const showApiKeyPanel = ref(false)
const apiKeyInput = ref('')
const apiKeySaved = ref(false)
const currentFolder = computed(() => fileStore.defaultParentFilename || '根目录')

// 快捷指令
const quickPrompts = [
  { label: '本周上传的文件', icon: SearchIcon, text: '找本周上传的文件' },
  { label: '最大的 5 个文件', icon: FileText, text: '找出最大的 5 个文件' },
  { label: '所有图片', icon: ImageIcon, text: '找所有图片' },
  { label: '闲聊', icon: MessageCircle, text: '你能做什么？' }
]

function scrollBottom() {
  nextTick(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight
    }
  })
}

watch(() => messages.value.length, scrollBottom)
watch(
  () => messages.value[messages.value.length - 1]?.content,
  scrollBottom
)

function openApiKeyPanel() {
  apiKeyInput.value = localStorage.getItem('xpan_ai_apikey') || ''
  apiKeySaved.value = false
  showApiKeyPanel.value = true
}

function saveApiKey() {
  setApiKey(apiKeyInput.value)
  apiKeySaved.value = true
  setTimeout(() => {
    showApiKeyPanel.value = false
    apiKeySaved.value = false
  }, 800)
}

async function send(prompt?: string) {
  const text = (prompt ?? input.value).trim()
  if (!text || loading.value) return

  if (!isConfigured.value) {
    errorMsg.value = '请先配置 DeepSeek API Key（点击齿轮按钮）'
    openApiKeyPanel()
    return
  }

  errorMsg.value = ''
  messages.value.push({ role: 'user', content: text })
  input.value = ''
  loading.value = true
  scrollBottom()

  // 预占一条 assistant 消息，流式拼接
  const assistantIdx = messages.value.length
  messages.value.push({ role: 'assistant', content: '' })

  // 构造历史上下文（不含刚 push 的 user 和空 assistant）
  const history: LLMMessage[] = messages.value
    .slice(0, -2)
    .map((m) => ({ role: m.role, content: m.content }))

  const ctx = {
    selectedFiles: multipleSelection.value,
    currentFolder: currentFolder.value
  }

  try {
    await run(
      text,
      ctx,
      history,
      (delta: string) => {
        // 流式拼接到最后一条 assistant 消息
        messages.value[assistantIdx].content += delta
      }
    )
    // 若 LLM 未输出内容（如纯搜索意图靠 onChunk 已填充），兜底
    if (!messages.value[assistantIdx].content) {
      messages.value[assistantIdx].content = '（无回复内容）'
    }
  } catch (e: unknown) {
    const err = e as Error
    messages.value[assistantIdx].content = `⚠️ ${err.message || 'AI 调用失败'}`
    if (err.message?.includes('API Key')) {
      errorMsg.value = err.message
    }
  } finally {
    loading.value = false
    scrollBottom()
  }
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <BaseModal :open="open" @update:open="(v) => emit('update:open', v)" title="AI 助手" size="md">
    <div class="flex flex-col gap-3 h-[60vh] min-h-[400px]">
      <!-- 视图切换：API Key 配置 / 对话 -->
      <template v-if="!showApiKeyPanel">
        <!-- 顶部状态栏：选中文件提示 + API Key 配置 -->
        <div class="flex items-center justify-between gap-2 pb-2 border-b border-(--color-border)">
          <div class="text-xs text-(--color-text-muted) truncate flex-1">
            <template v-if="multipleSelection.length > 0">
              已选中 {{ multipleSelection.length }} 个文件 · 当前目录：{{ currentFolder }}
            </template>
            <template v-else>
              当前目录：{{ currentFolder }}（选中文件可解锁摘要/重命名能力）
            </template>
          </div>
          <button
            type="button"
            class="relative size-7 flex items-center justify-center rounded-sm transition-colors text-(--color-text-muted) hover:bg-(--color-surface-2) hover:text-(--color-text)"
            :title="isConfigured ? 'API Key 已配置（点击修改）' : '配置 API Key'"
            @click="openApiKeyPanel"
          >
            <Settings :size="14" :stroke-width="2" />
            <span
              v-if="isConfigured"
              class="absolute top-0 right-0 size-1.5 rounded-full bg-emerald-500"
            />
          </button>
        </div>

        <!-- 消息列表 -->
        <div ref="scrollRef" class="flex-1 overflow-y-auto pr-1 space-y-3">
          <div
            v-for="(m, i) in messages"
            :key="i"
            class="flex items-start gap-2"
            :class="m.role === 'user' ? 'flex-row-reverse' : ''"
          >
            <div
              class="size-8 shrink-0 rounded-full flex items-center justify-center"
              :class="
                m.role === 'user'
                  ? 'bg-primary-500 text-white'
                  : 'bg-linear-to-br from-amber-400 to-pink-500 text-white'
              "
            >
              <UserIcon v-if="m.role === 'user'" :size="14" />
              <Sparkles v-else :size="14" />
            </div>
            <div
              class="max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-line break-words"
              :class="
                m.role === 'user'
                  ? 'bg-primary-500 text-white rounded-tr-sm'
                  : 'bg-(--color-surface-2) rounded-tl-sm'
              "
            >
              {{ m.content }}
              <LoaderCircle
                v-if="loading && i === messages.length - 1 && m.role === 'assistant' && !m.content"
                :size="12"
                class="animate-spin inline-block"
              />
            </div>
          </div>
        </div>

        <!-- 错误提示 -->
        <div
          v-if="errorMsg"
          class="flex items-center gap-2 px-3 py-2 rounded-sm text-xs"
          style="background-color: rgba(239, 68, 68, 0.1); color: var(--color-danger);"
        >
          <AlertCircle :size="12" :stroke-width="2" />
          {{ errorMsg }}
        </div>

        <!-- 快捷指令 -->
        <div v-if="messages.length <= 1" class="flex flex-wrap gap-1.5">
          <button
            v-for="(p, i) in quickPrompts"
            :key="i"
            type="button"
            class="px-2.5 py-1.5 text-xs rounded-full border border-(--color-border) bg-(--color-surface) hover:bg-(--color-surface-2) transition-colors flex items-center gap-1.5"
            @click="send(p.text)"
          >
            <component :is="p.icon" :size="11" />
            {{ p.label }}
          </button>
        </div>

        <!-- 输入框 -->
        <div class="flex items-end gap-2 pt-2 border-t border-(--color-border)">
          <div class="flex-1">
            <BaseInput v-model="input" placeholder="问点什么..." @enter="send()" />
          </div>
          <BaseButton variant="primary" :disabled="!input.trim() || loading" @click="send()">
            <Send :size="14" />
          </BaseButton>
        </div>
      </template>

      <!-- API Key 配置视图 -->
      <template v-else>
        <div class="flex-1 flex flex-col justify-center gap-4 py-4">
          <div class="flex items-center gap-2">
            <Wand2 :size="18" class="text-primary-500" />
            <h3 class="text-base font-semibold text-(--color-text)">配置 DeepSeek API Key</h3>
          </div>
          <p class="text-xs text-(--color-text-muted) leading-relaxed">
            前往
            <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener" class="text-primary-500 underline">platform.deepseek.com</a>
            创建 API Key，粘贴到下方。Key 仅存本地 localStorage，不会上传服务器。
          </p>
          <BaseInput
            v-model="apiKeyInput"
            type="password"
            placeholder="sk-..."
            :prefix="Wand2"
            @enter="saveApiKey"
          />
          <div v-if="apiKeySaved" class="flex items-center gap-1.5 text-xs text-emerald-600">
            <Check :size="12" :stroke-width="2" />
            API Key 已保存
          </div>
          <div class="flex items-center justify-end gap-2 pt-2">
            <BaseButton variant="ghost" size="sm" @click="showApiKeyPanel = false">返回</BaseButton>
            <BaseButton variant="primary" size="sm" :disabled="!apiKeyInput.trim()" @click="saveApiKey">
              保存
            </BaseButton>
          </div>
        </div>
      </template>
    </div>

    <template #footer>
      <span class="text-xs text-(--color-text-muted)">
        Powered by DeepSeek · {{ isConfigured ? '已连接' : '未配置 API Key' }}
      </span>
      <BaseButton variant="ghost" size="sm" @click="close">关闭</BaseButton>
    </template>
  </BaseModal>
</template>
