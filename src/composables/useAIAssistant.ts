/**
 * useAIAssistant —— AI 助手业务编排（P1-10）
 *
 * 负责：
 * 1. 意图识别（关键词预判 + LLM 兜底）
 * 2. 意图执行（search / summarize / rename / chat）
 * 3. 与 fileStore 联动（搜索、选中文件上下文）
 *
 * 依赖：useLLM（DeepSeek 封装）
 */
import { useLLM, type LLMMessage } from './useLLM'
import { useFileStore } from '@/stores/file'
import { ElMessage } from '@/composables/useToast'
import fileService from '@/api/file'
import type { IFileVO } from '@/types'

export type AIIntent = 'search' | 'summarize' | 'rename' | 'chat'

export interface AIContext {
  selectedFiles: IFileVO[]
  currentFolder: string
}

export function useAIAssistant() {
  const { chat, isConfigured } = useLLM()
  const fileStore = useFileStore()

  /**
   * 关键词预判意图（命中则跳过 LLM 意图识别，省一次调用）
   */
  function predictIntent(input: string, ctx: AIContext): AIIntent | null {
    const text = input.trim().toLowerCase()
    if (!text) return null

    // 搜索意图
    if (
      /^(找|搜索|查|搜|查找|列出|显示|有哪些|看看)/.test(text) ||
      /(文件|图片|视频|音乐|文档|文件夹|上周|昨天|今天|本周|本月|最近|大于|小于|超过)/.test(text)
    ) {
      return 'search'
    }

    // 摘要意图
    if (/(总结|摘要|概括|归纳|概述|梳理|整理)/.test(text) && ctx.selectedFiles.length > 0) {
      return 'summarize'
    }

    // 重命名意图
    if (/(重命名|改名|起名|换名|命名建议|规范名称)/.test(text) && ctx.selectedFiles.length > 0) {
      return 'rename'
    }

    return null
  }

  /**
   * LLM 兜底意图识别（关键词未命中时调用）
   */
  async function detectIntent(input: string, ctx: AIContext): Promise<AIIntent> {
    const systemPrompt = `你是网盘 AI 助手的意图识别模块。根据用户输入判断意图，输出 JSON（不要 markdown 代码块）。

意图类型：
- search: 搜索/查找文件
- summarize: 总结/概述选中文件（仅当用户已选中文件且表达总结意图）
- rename: 重命名建议（仅当用户已选中文件且表达改名意图）
- chat: 闲聊问答

当前上下文：用户${ctx.selectedFiles.length > 0 ? `已选中 ${ctx.selectedFiles.length} 个文件` : '未选中文件'}，当前目录：${ctx.currentFolder}。

输出格式：{"intent":"search|summarize|rename|chat","reason":"简短说明"}`

    try {
      const raw = await chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input }
        ],
        { temperature: 0.1, stream: false }
      )
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        const intent = parsed.intent as AIIntent
        if (['search', 'summarize', 'rename', 'chat'].includes(intent)) return intent
      }
    } catch {
      /* fall through to chat */
    }
    return 'chat'
  }

  /**
   * 执行搜索意图：让 LLM 解析自然语言为搜索参数，调 fileService.search
   */
  async function executeSearch(
    input: string,
    onChunk: (delta: string) => void
  ): Promise<string> {
    const systemPrompt = `你是网盘搜索助手。将用户的自然语言搜索请求解析为结构化参数，并输出 JSON（不要 markdown 代码块）。

字段：
- keyword: 文件名关键词（不含时间/类型/大小修饰词，可为空字符串）
- fileType: 文件类型码（0=文件夹,7=图片,8=音频,9=视频,3/4/10=文档；不确定填 -1）
- dateFrom: 起始日期 YYYY-MM-DD（可选）
- dateTo: 结束日期 YYYY-MM-DD（可选）
- sizeMinMB: 最小体积 MB（可选）
- sizeMaxMB: 最大体积 MB（可选）

今天日期：${new Date().toISOString().slice(0, 10)}。
"本周"=本周一至今；"上周"=上周一到上周日；"昨天"=昨天；"最近N天"=N天前至今。

示例：
"找上周的图片" → {"keyword":"","fileType":7,"dateFrom":"2026-08-04","dateTo":"2026-08-10"}
"大于100MB的视频" → {"keyword":"","fileType":9,"sizeMinMB":100}`

    let parsed: {
      keyword?: string
      fileType?: number
      dateFrom?: string
      dateTo?: string
      sizeMinMB?: number
      sizeMaxMB?: number
    } = {}

    try {
      const raw = await chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input }
        ],
        { temperature: 0.1, stream: false }
      )
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
    } catch (e) {
      // 解析失败，退化为纯关键词搜索
      parsed = { keyword: input }
    }

    // 调后端搜索（大小下限/上限转字节后交由后端过滤，去掉前端二次过滤）
    // 走 store 统一搜索入口：与目录加载共享 requestSeq，过期响应不会写列表/触发回复
    return new Promise<string>((resolve) => {
      const params: {
        keyword: string
        fileTypes?: string
        dateFrom?: string
        dateTo?: string
        sizeMin?: number
        sizeMax?: number
      } = {
        keyword: parsed.keyword || '',
        fileTypes: parsed.fileType != null ? String(parsed.fileType) : '-1'
      }
      if (parsed.dateFrom) params.dateFrom = parsed.dateFrom
      if (parsed.dateTo) params.dateTo = parsed.dateTo
      if (parsed.sizeMinMB != null) params.sizeMin = parsed.sizeMinMB * 1024 * 1024
      if (parsed.sizeMaxMB != null) params.sizeMax = parsed.sizeMaxMB * 1024 * 1024

      fileStore.setSearchKey(parsed.keyword || input)
      fileStore.searchByParams(params, {
        onFresh: (list) => {
          // 生成回复（流式模拟，逐字输出）
          const header = `🔍 已为你搜索「${input}」\n\n`
          onChunk(header)
          if (list.length === 0) {
            const empty = '没有找到匹配的文件。'
            onChunk(empty)
            resolve(header + empty)
            return
          }
          const lines = list
            .slice(0, 10)
            .map(
              (r, i) =>
                `${i + 1}. ${r.filename} · ${r.fileSizeDesc || ''} · ${r.updateTime || ''}`
            )
            .join('\n')
          const summary = `找到 ${list.length} 个结果${list.length > 10 ? '（显示前 10 个）' : ''}：\n\n${lines}\n\n结果已同步到文件列表。`
          onChunk(summary)
          resolve(header + summary)
        },
        onError: (err) => {
          const msg = `搜索失败：${err.message || '后端错误'}`
          onChunk(msg)
          resolve(msg)
        }
      })
    })
  }

  /**
   * 执行摘要意图：先提取选中文件内容（后端 text-extract），再喂 LLM 做内容摘要。
   * 提取失败的文件（图片/视频/压缩包等）降级为「仅文件名」提示。
   */
  async function executeSummarize(
    input: string,
    ctx: AIContext,
    onChunk: (delta: string) => void
  ): Promise<string> {
    const files = ctx.selectedFiles
    onChunk('🔍 正在提取文件内容…\n\n')

    // 逐个提取文本内容（最多前 5 个文件，避免上下文过长）
    const MAX_SUMMARIZE_FILES = 5
    const contents: { filename: string; text: string }[] = []
    const unextractable: string[] = []

    for (const f of files.slice(0, MAX_SUMMARIZE_FILES)) {
      const text = await extractFileText(f)
      if (text) {
        contents.push({ filename: f.filename || '', text })
      } else {
        unextractable.push(f.filename || '')
      }
    }

    // 拼接 system prompt
    const contentSections = contents
      .map((c, i) => {
        // 截断单文件内容到 6000 字符，避免超出 LLM 上下文
        const t = c.text.length > 6000 ? c.text.slice(0, 6000) + '\n…(内容过长已截断)' : c.text
        return `【文件 ${i + 1}：${c.filename}】\n${t}`
      })
      .join('\n\n')

    const fileListHint = files
      .map((f, i) => `${i + 1}. ${f.filename} (${f.fileSizeDesc || '未知大小'})`)
      .join('\n')

    let systemContent = `你是网盘文件整理助手。用户选中了以下文件，请基于「文件内容」做内容摘要、要点提炼、分类整理。

选中的文件清单：
${fileListHint}`

    if (contentSections) {
      systemContent += `\n\n以下是已成功提取的文件内容：\n${contentSections}`
    }
    if (unextractable.length > 0) {
      systemContent += `\n\n注意：以下文件无法提取文本内容（可能是图片/视频/压缩包等），请基于文件名说明即可：${unextractable.join('、')}`
    }
    if (files.length > MAX_SUMMARIZE_FILES) {
      systemContent += `\n\n（另有 ${files.length - MAX_SUMMARIZE_FILES} 个文件因数量限制未提取内容，仅基于文件名分析）`
    }

    const messages: LLMMessage[] = [
      { role: 'system', content: systemContent },
      { role: 'user', content: input || '请总结这些文件的内容要点' }
    ]

    return chat(messages, { temperature: 0.5, stream: true, onChunk })
  }

  /**
   * 提取单个文件的纯文本（调用后端 text-extract）。
   * 成功返回文本，失败/不支持返回空字符串。
   */
  function extractFileText(f: IFileVO): Promise<string> {
    return new Promise((resolve) => {
      if (!f.fileId) return resolve('')
      fileService.textExtract(
        f.fileId,
        (res) => resolve(res.data?.text || ''),
        () => resolve('') // 提取失败（图片/视频/无权限等）降级
      )
    })
  }

  /**
   * 执行重命名意图：让 LLM 基于文件名规律建议规范化名称
   */
  async function executeRename(
    input: string,
    ctx: AIContext,
    onChunk: (delta: string) => void
  ): Promise<string> {
    const fileList = ctx.selectedFiles
      .map((f, i) => `${i + 1}. ${f.filename}`)
      .join('\n')

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `你是文件命名规范助手。用户选中了以下文件，请根据文件名规律、类型、常见命名规范，为每个文件建议一个更清晰、统一的新名称。

要求：
1. 保留扩展名
2. 命名风格统一（如全部用「项目名_日期_序号」或「描述性名称」）
3. 输出表格：原文件名 → 建议名称
4. 末尾说明命名规则

选中的文件：
${fileList}`
      },
      { role: 'user', content: input || '请为这些文件建议规范名称' }
    ]

    return chat(messages, { temperature: 0.4, stream: true, onChunk })
  }

  /**
   * 执行闲聊意图：直接流式回复
   */
  async function executeChat(
    input: string,
    history: LLMMessage[],
    onChunk: (delta: string) => void
  ): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content:
          '你是 X-Pan 网盘的 AI 助手。你熟悉文件管理、网盘使用，可以帮用户搜索文件、整理文件夹、建议命名。回答简洁友好，使用中文。'
      },
      ...history.slice(-6), // 最近 3 轮对话上下文
      { role: 'user', content: input }
    ]
    return chat(messages, { temperature: 0.7, stream: true, onChunk })
  }

  /**
   * 主入口：识别意图 + 执行
   * @returns 完整回复文本
   */
  async function run(
    input: string,
    ctx: AIContext,
    history: LLMMessage[],
    onChunk: (delta: string) => void
  ): Promise<string> {
    if (!isConfigured.value) {
      throw new Error('未配置 API Key，请点击齿轮按钮填写 DeepSeek API Key')
    }

    // 1. 关键词预判
    let intent = predictIntent(input, ctx)

    // 2. 未命中 → LLM 兜底识别
    if (!intent) {
      intent = await detectIntent(input, ctx)
    }

    // 3. 执行
    switch (intent) {
      case 'search':
        return executeSearch(input, onChunk)
      case 'summarize':
        return executeSummarize(input, ctx, onChunk)
      case 'rename':
        return executeRename(input, ctx, onChunk)
      default:
        return executeChat(input, history, onChunk)
    }
  }

  return { run, isConfigured }
}
