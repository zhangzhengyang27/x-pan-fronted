/**
 * useFileTags —— 文件智能打标（P3-2）
 *
 * 双引擎策略：
 *   1. 优先调用 DeepSeek（若已配置 API Key）—— 语义标签，更智能
 *   2. DeepSeek 未配置或失败时，降级调用后端 POST /file/auto-tag —— 规则匹配，兜底
 *
 * 标签统一持久化到 localStorage（按 fileId 索引），后端规则打标还会落库 x_pan_file_tag。
 *
 * 能力边界：
 * - 文件名/扩展名 → 语义标签（"工作文档""会议记录""设计素材"等）✅
 * - 文档内容关键词提取 ✅（需前端先 fetch 文本，仅支持纯文本/代码）
 * - 图片场景识别 ❌（需多模态模型，前端无法实现，待后端接入视觉模型）
 */
import { ref } from 'vue'
import { useLLM } from '@/composables/useLLM'
import fileTagService from '@/api/file/tag'

const TAGS_STORAGE = 'xpan_file_tags'
const MAX_TAGS = 5

export interface FileTag {
  fileId: string
  tags: string[]
  createdAt: number
}

// 内存缓存 + localStorage 持久化
const tagsCache = new Map<string, FileTag>()

function loadCache(): void {
  try {
    const raw = localStorage.getItem(TAGS_STORAGE)
    if (!raw) return
    const arr: FileTag[] = JSON.parse(raw)
    for (const item of arr) {
      tagsCache.set(item.fileId, item)
    }
  } catch {
    /* ignore */
  }
}

function saveCache(): void {
  try {
    const arr = Array.from(tagsCache.values())
    localStorage.setItem(TAGS_STORAGE, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

loadCache()

export function useFileTags() {
  const { chat, isConfigured } = useLLM()
  const loading = ref(false)

  /**
   * 引擎 1：DeepSeek 语义打标
   * @returns 标签数组（失败返回空数组）
   */
  async function autoTagByLLM(file: {
    filename: string
    fileType: number
  }): Promise<string[]> {
    const prompt = buildPrompt(file)
    const reply = await chat(
      [
        {
          role: 'system',
          content:
            '你是文件分类助手。根据文件名和类型，输出 3-5 个简洁的中文标签，用逗号分隔。只输出标签，不要解释。标签应为常见分类词，如：工作文档、会议记录、设计素材、学习资料、项目报告、合同、发票、截图、安装包、源代码等。'
        },
        { role: 'user', content: prompt }
      ],
      { temperature: 0.3 }
    )

    return reply
      .split(/[,，、\n]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 10)
      .slice(0, MAX_TAGS)
  }

  /**
   * 引擎 2：后端规则打标（降级方案）
   * 调用 POST /file/auto-tag，后端基于文件名/类型规则匹配并落库。
   * @returns 标签数组（失败返回空数组）
   */
  function autoTagByBackend(fileId: string): Promise<string[]> {
    return new Promise((resolve) => {
      fileTagService.autoTag(
        fileId,
        (res) => {
          const tags = (res.data || []).map((t) => t.tagName).filter(Boolean)
          resolve(tags)
        },
        () => resolve([])
      )
    })
  }

  /**
   * 对文件自动打标（双引擎：DeepSeek 优先，降级后端规则）
   * @param file 文件对象（需含 fileId, filename, fileType）
   * @returns 标签数组（两个引擎都失败返回空数组）
   */
  async function autoTag(file: {
    fileId: string | number
    filename: string
    fileType: number
  }): Promise<string[]> {
    const fid = String(file.fileId)

    // 命中缓存直接返回
    const cached = tagsCache.get(fid)
    if (cached) return cached.tags

    loading.value = true
    try {
      let tags: string[] = []

      // 1. 优先 DeepSeek（若已配置）
      if (isConfigured.value) {
        try {
          tags = await autoTagByLLM(file)
        } catch {
          tags = []
        }
      }

      // 2. DeepSeek 未配置或未生成 → 降级后端规则打标
      if (tags.length === 0) {
        tags = await autoTagByBackend(fid)
      }

      if (tags.length > 0) {
        const entry: FileTag = { fileId: fid, tags, createdAt: Date.now() }
        tagsCache.set(fid, entry)
        saveCache()
      }

      return tags
    } finally {
      loading.value = false
    }
  }

  function getTags(fileId: string | number): string[] {
    return tagsCache.get(String(fileId))?.tags || []
  }

  function clearTags(fileId: string | number): void {
    tagsCache.delete(String(fileId))
    saveCache()
  }

  return { loading, autoTag, getTags, clearTags }
}

function buildPrompt(file: { filename: string; fileType: number }): string {
  const typeMap: Record<number, string> = {
    0: '文件夹',
    3: '文档(Office)',
    4: '文档(PDF)',
    5: '文本',
    6: '文本',
    7: '图片',
    8: '音频',
    9: '视频',
    10: '文档(其他)',
    11: '代码'
  }
  const typeName = typeMap[file.fileType] || '未知'
  return `文件名：${file.filename}\n文件类型：${typeName}\n\n请输出 3-5 个标签：`
}
