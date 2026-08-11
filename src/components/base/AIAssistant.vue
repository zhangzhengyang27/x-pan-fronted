<script setup lang="ts">
/**
 * AIAssistant —— AI 助手对话框（P1.18）
 *
 * 能力：
 * - 自然语言搜索（"找上周的图片"）
 * - 文件摘要（"总结这些 PDF"）
 * - 智能分类建议
 *
 * 当前实现：模拟响应（演示 UI/UX）
 * 接入真实 LLM：替换 fetchAI 函数调用 OpenAI/通义千问/Ollama
 */
import { nextTick, ref, watch } from 'vue'
import {
  Sparkles,
  Send,
  User as UserIcon,
  LoaderCircle,
  FileText,
  Image as ImageIcon
} from '@lucide/vue'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'
import BaseInput from './BaseInput.vue'

defineProps({
  open: { type: Boolean, default: false }
})

const emit = defineEmits(['update:open'])

const messages = ref([
  {
    role: 'assistant',
    content:
      '你好，我是 X-Pan AI 助手 ✨\n\n我可以帮你：\n• 智能搜索文件（"找上周的图片"）\n• 总结 PDF/文档\n• 整理文件夹\n\n试试问我点什么吧～'
  }
])
const input = ref('')
const loading = ref(false)
const scrollRef = ref(null)

// 快捷指令
const quickPrompts = [
  { label: '本周上传的文件', icon: FileText },
  { label: '最大的 5 个文件', icon: FileText },
  { label: '所有图片分类', icon: ImageIcon },
  { label: 'PDF 文件总结', icon: FileText }
]

function scrollBottom() {
  nextTick(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight
    }
  })
}

watch(() => messages.value.length, scrollBottom)

async function send(prompt) {
  const text = (prompt ?? input.value).trim()
  if (!text || loading.value) return
  messages.value.push({ role: 'user', content: text })
  input.value = ''
  loading.value = true
  scrollBottom()

  // 模拟 AI 响应（生产：替换为真实 LLM API）
  setTimeout(() => {
    const reply = simulateAI(text)
    messages.value.push({ role: 'assistant', content: reply })
    loading.value = false
    scrollBottom()
  }, 800)
}

function simulateAI(prompt) {
  const lower = prompt.toLowerCase()
  if (lower.includes('图片') || lower.includes('image')) {
    return '我找到 47 张图片，按时间排序：\n\n• 2026-08-09  screenshot.png (1.2 MB)\n• 2026-08-08  头像.jpg (256 KB)\n• ...\n\n（演示响应 · 真实 LLM 待接入）'
  }
  if (lower.includes('总结') || lower.includes('summary')) {
    return '📄 文档摘要：\n\n1. **项目计划** — 8 月启动，10 月上线\n2. **架构设计** — 微服务 + 容器化部署\n3. **风险评估** — 中等，关键节点需 review\n\n（演示响应 · 真实 LLM 待接入）'
  }
  if (lower.includes('最大') || lower.includes('大')) {
    return '📊 最大的 5 个文件：\n\n1. backup-2026-08.tar.gz  ·  2.3 GB\n2. docker-image.tar  ·  1.8 GB\n3. video-tutorial.mp4  ·  1.2 GB\n4. database-dump.sql  ·  956 MB\n5. design.fig  ·  512 MB\n\n（演示响应 · 真实 LLM 待接入）'
  }
  return '🤔 收到你的指令。\n\n这是一个演示响应。\n\n生产环境接入 LLM：\n```js\nconst res = await fetch("/api/ai/chat", {\n  method: "POST",\n  body: JSON.stringify({prompt, context: {userId}})\n})\n```\n\n支持 OpenAI / 通义千问 / Ollama / Claude 等。'
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <BaseModal :open="open" @update:open="(v) => emit('update:open', v)" title="AI 助手" size="md">
    <div class="flex flex-col gap-3 h-[60vh] min-h-[400px]">
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
                ? 'bg-[var(--color-primary-500)] text-white'
                : 'bg-gradient-to-br from-amber-400 to-pink-500 text-white'
            "
          >
            <UserIcon v-if="m.role === 'user'" :size="14" />
            <Sparkles v-else :size="14" />
          </div>
          <div
            class="max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-line"
            :class="
              m.role === 'user'
                ? 'bg-[var(--color-primary-500)] text-white rounded-tr-sm'
                : 'bg-[var(--color-surface-2)] rounded-tl-sm'
            "
          >
            {{ m.content }}
          </div>
        </div>
        <div v-if="loading" class="flex items-start gap-2">
          <div
            class="size-8 shrink-0 rounded-full bg-gradient-to-br from-amber-400 to-pink-500 text-white flex items-center justify-center"
          >
            <Sparkles :size="14" />
          </div>
          <div class="px-3 py-2 rounded-2xl bg-[var(--color-surface-2)] text-sm">
            <LoaderCircle :size="14" class="animate-spin" />
          </div>
        </div>
      </div>

      <!-- 快捷指令 -->
      <div v-if="messages.length <= 1" class="flex flex-wrap gap-1.5">
        <button
          v-for="(p, i) in quickPrompts"
          :key="i"
          type="button"
          class="px-2.5 py-1.5 text-xs rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] transition-colors flex items-center gap-1.5"
          @click="send(p.label)"
        >
          <component :is="p.icon" :size="11" />
          {{ p.label }}
        </button>
      </div>

      <!-- 输入框 -->
      <div class="flex items-end gap-2 pt-2 border-t border-[var(--color-border)]">
        <div class="flex-1">
          <BaseInput ref="inputRef" v-model="input" placeholder="问点什么..." @enter="send()" />
        </div>
        <BaseButton variant="primary" :disabled="!input.trim()" @click="send()">
          <Send :size="14" />
        </BaseButton>
      </div>
    </div>
    <template #footer>
      <span class="text-xs text-[var(--color-text-muted)]">
        AI 回复为演示数据，生产环境需接入 LLM API
      </span>
      <BaseButton variant="ghost" size="sm" @click="close">关闭</BaseButton>
    </template>
  </BaseModal>
</template>
