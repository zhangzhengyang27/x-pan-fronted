/**
 * useLLM —— LLM 调用封装（P1-10）
 *
 * 当前接入：DeepSeek（兼容 OpenAI Chat Completions 格式）
 * 切换其他厂商：改 DEEPSEEK_ENDPOINT / MODEL 即可，或扩展为多 provider
 *
 * 安全说明：前端直连方案，API Key 存 localStorage。
 * 仅适用于个人网盘场景；多人/生产环境应走后端代理（见 backend-issues BE-03）。
 */
import { ref } from 'vue'

const API_KEY_STORAGE = 'xpan_ai_apikey'
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions'
const MODEL = 'deepseek-chat'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMChatOptions {
  temperature?: number
  stream?: boolean
  onChunk?: (delta: string) => void
  signal?: AbortSignal
}

export function useLLM() {
  const apiKey = ref<string>(localStorage.getItem(API_KEY_STORAGE) || '')
  const isConfigured = ref<boolean>(!!apiKey.value)

  function setApiKey(key: string): void {
    const trimmed = key.trim()
    apiKey.value = trimmed
    isConfigured.value = !!trimmed
    if (trimmed) localStorage.setItem(API_KEY_STORAGE, trimmed)
    else localStorage.removeItem(API_KEY_STORAGE)
  }

  /**
   * 对话接口（兼容流式 / 非流式）
   * @returns 完整回复文本
   */
  async function chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<string> {
    if (!apiKey.value) {
      throw new Error('未配置 API Key，请点击右上角齿轮按钮填写 DeepSeek API Key')
    }

    const useStream = options?.stream ?? false

    const res = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.value}`
      },
      signal: options?.signal,
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: options?.temperature ?? 0.7,
        stream: useStream
      })
    })

    if (!res.ok) {
      let errMsg = `请求失败 (${res.status})`
      try {
        const errBody = await res.json()
        errMsg = errBody?.error?.message || errMsg
      } catch {
        /* ignore */
      }
      if (res.status === 401) errMsg = 'API Key 无效或已过期，请重新配置'
      if (res.status === 429) errMsg = '请求过于频繁，请稍后再试'
      throw new Error(errMsg)
    }

    if (useStream && options?.onChunk && res.body) {
      // 流式读取 SSE
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') continue
          try {
            const json = JSON.parse(data)
            const delta = json.choices?.[0]?.delta?.content || ''
            if (delta) {
              full += delta
              options.onChunk(delta)
            }
          } catch {
            /* skip malformed chunk */
          }
        }
      }
      return full
    } else {
      const json = await res.json()
      return json.choices?.[0]?.message?.content || ''
    }
  }

  return { apiKey, isConfigured, setApiKey, chat }
}
