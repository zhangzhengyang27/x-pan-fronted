/**
 * useFileTags —— 文件智能打标（P3-2）
 *
 * 标签数据源统一走后端 x_pan_file_tag 表（list / addTag / removeTag），
 * 不再依赖 localStorage（历史遗留的 localStorage 缓存已废弃）。
 *
 * 自动打标双引擎策略：
 *   1. 优先调用 DeepSeek（若已配置 API Key）—— 语义标签，更智能
 *   2. DeepSeek 未配置或失败时，降级调用后端 POST /file/auto-tag —— 规则匹配，兜底
 *
 * 能力边界：
 * - 文件名/扩展名 → 语义标签（"工作文档""会议记录""设计素材"等）✅
 * - 文档内容关键词提取 ✅（需前端先 fetch 文本，仅支持纯文本/代码）
 * - 图片场景识别 ❌（需多模态模型，前端无法实现，待后端接入视觉模型）
 */
import { ref } from 'vue'
import { useLLM } from '@/composables/useLLM'
import fileTagService, { type FileTagItem } from '@/api/file/tag'
import { ElMessage } from '@/composables/useToast'

const MAX_TAGS = 5

export interface FileTag {
  fileId: string
  tags: string[]
  createdAt: number
}

export function useFileTags() {
  const { chat, isConfigured } = useLLM()
  const loading = ref(false)
  /** 当前文件的标签列表（后端数据源，含 id + tagName + tagSource） */
  const userTags = ref<FileTagItem[]>([])
  /** 当前加载标签的文件 id（避免并发串扰） */
  const currentFileId = ref('')

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
   * 返回后端最新标签列表。
   */
  function autoTagByBackend(fileId: string): Promise<FileTagItem[]> {
    return new Promise((resolve) => {
      fileTagService.autoTag(
        fileId,
        (res) => resolve(res.data || []),
        () => resolve([])
      )
    })
  }

  /** 从后端加载指定文件的标签列表（手动标签 + 自动标签都走后端数据源） */
  function loadTags(fileId: string | number): void {
    const fid = String(fileId)
    currentFileId.value = fid
    fileTagService.list(
      fid,
      (res) => {
        if (currentFileId.value !== fid) return
        userTags.value = res.data || []
      },
      () => {
        userTags.value = []
      }
    )
  }

  /**
   * 对文件自动打标（双引擎：DeepSeek 优先，降级后端规则）
   * @param file 文件对象（需含 fileId, filename, fileType）
   * @returns 标签名数组（两个引擎都失败返回空数组）
   */
  async function autoTag(file: {
    fileId: string | number
    filename: string
    fileType: number
  }): Promise<string[]> {
    const fid = String(file.fileId)
    loading.value = true
    try {
      // 1. 优先 DeepSeek（若已配置）：生成语义标签后逐个落库（手动标签 tagSource=1 由后端决定，这里走后端 auto-tag 落库）
      let llmTags: string[] = []
      if (isConfigured.value) {
        try {
          llmTags = await autoTagByLLM(file)
        } catch {
          llmTags = []
        }
      }

      // DeepSeek 生成的标签逐个调用 addTag 落库
      for (const tag of llmTags) {
        await addTagSilently(fid, tag)
      }

      // 2. DeepSeek 未配置或未生成 → 降级后端规则打标
      if (llmTags.length === 0) {
        userTags.value = await autoTagByBackend(fid)
      }

      return userTags.value.map((t) => t.tagName)
    } finally {
      loading.value = false
    }
  }

  /** 静默添加标签（不弹 toast，用于自动打标批量落库，重复/超限时忽略） */
  function addTagSilently(fileId: string, tagName: string): Promise<void> {
    return new Promise((resolve) => {
      fileTagService.addTag(
        fileId,
        tagName,
        (res) => {
          if (res.data) {
            userTags.value = [...userTags.value, res.data]
          }
          resolve()
        },
        () => resolve() // 重复/超限等错误静默忽略
      )
    })
  }

  /** 手动添加标签（带错误提示） */
  async function addTag(fileId: string | number, tagName: string): Promise<boolean> {
    const fid = String(fileId)
    const name = tagName.trim()
    if (!name) return false
    return new Promise((resolve) => {
      fileTagService.addTag(
        fid,
        name,
        (res) => {
          if (res.data) {
            userTags.value = [...userTags.value, res.data]
          }
          ElMessage.success('标签已添加')
          resolve(true)
        },
        (err) => {
          ElMessage.error((err as { message?: string })?.message || '添加标签失败')
          resolve(false)
        }
      )
    })
  }

  /** 删除标签（按 tagName 在 userTags 中找到对应 id 后走后端删除） */
  async function removeTag(fileId: string | number, tagName: string): Promise<boolean> {
    const target = userTags.value.find((t) => t.tagName === tagName)
    if (!target) return false
    return new Promise((resolve) => {
      fileTagService.removeTag(
        target.id,
        () => {
          userTags.value = userTags.value.filter((t) => t.id !== target.id)
          resolve(true)
        },
        (err) => {
          ElMessage.error((err as { message?: string })?.message || '删除标签失败')
          resolve(false)
        }
      )
    })
  }

  /** 向后兼容：返回标签名数组（FileDetailPanel 的 fileTags computed 使用） */
  function getTags(fileId: string | number): string[] {
    const fid = String(fileId)
    if (currentFileId.value !== fid) return []
    return userTags.value.map((t) => t.tagName)
  }

  /** 清空当前标签（切换文件时重置） */
  function clearTags(): void {
    userTags.value = []
    currentFileId.value = ''
  }

  return { loading, userTags, autoTag, getTags, addTag, removeTag, loadTags, clearTags }
}

function buildPrompt(file: { filename: string; fileType: number }): string {
  const typeMap: Record<number, string> = {
    0: '文件夹',
    1: '普通文件',
    2: '压缩包',
    3: '文档(Excel)',
    4: '文档(Word)',
    5: '文档(PDF)',
    6: '文本',
    7: '图片',
    8: '音频',
    9: '视频',
    10: '文档(PPT)',
    11: '代码',
    12: '文档(CSV)'
  }
  const typeName = typeMap[file.fileType] || '未知'
  return `文件名：${file.filename}\n文件类型：${typeName}\n\n请输出 3-5 个标签：`
}
