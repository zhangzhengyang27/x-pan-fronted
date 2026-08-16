/**
 * preview-plugin —— 预览插件化注册表（预览体系插件化重构 · 核心）
 *
 * 目标：把散落在 preview.ts（类型判定 if/else）和 drive-preview-modal.vue（渲染分发 v-if 链）
 * 的逻辑统一收敛为「插件注册表」—— 加一种格式 = 加一个插件，不再触碰判定函数和分发模板。
 *
 * 关键设计：
 * - PreviewPluginId 与 preview.ts 的 PreviewKind 完全对齐，保证 resolvePreviewKind 向后兼容；
 * - component 用懒加载工厂 `() => import(...)`，配合 <component :is> 实现按 chunk 分包；
 * - match 只关心「自己能渲染什么」（扩展名 + mimeType），文件夹过滤在入口统一处理。
 */
import type { Component } from 'vue'

/** 与 preview.ts 的 PreviewInput 对齐（避免循环依赖，这里独立声明） */
export interface PreviewInput {
  name?: string
  filename?: string
  mimeType?: string
  extension?: string
  fileType?: number
  type?: string
}

/** 预览文件项（与 useDrivePreview 的 PreviewItem 对齐） */
export interface PreviewItem {
  fileId?: string | number
  id?: string | number
  name?: string
  filename?: string
  mimeType?: string
  extension?: string
  fileType?: number
  type?: string
  [key: string]: unknown
}

/**
 * 插件唯一标识，与现有 PreviewKind 完全对齐（保证向后兼容）。
 * 新增格式的 id 也在这里扩展（csv / archive）。
 */
export type PreviewPluginId =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'docx'
  | 'excel'
  | 'pptx'
  | 'markdown'
  | 'code'
  | 'text'
  // 新增格式
  | 'csv'
  | 'archive'
  | 'xmind'

export interface PreviewPlugin {
  /** 插件唯一标识，同时充当对外暴露的 kind */
  id: PreviewPluginId
  /** 判定：给定文件输入，返回是否由本插件负责（替代 if/else） */
  match(input: PreviewInput): boolean
  /** 优先级：多个插件同时 match 时取最高（默认 0） */
  priority?: number
  /** 渲染组件工厂（懒加载，替代 defineAsyncComponent 声明） */
  component: () => Promise<Component>
  /** 是否走全屏浮层（如图片画廊），而非 BaseModal 弹窗 */
  fullscreen?: boolean
  /** 弹窗尺寸配置（替代 modalWidth/contentHeight 的 switch） */
  modal?: { width: number; height: string }
  /** 新窗口打开策略（替代 openInNewTab 的 if/else）；不传则用 DEFAULT_OPEN_IN_NEW_TAB.iframe 兜底 */
  openInNewTab?: (item: PreviewItem, previewUrl: string) => void
}

// ─── 注册表 ─────────────────────────────────────────────────────────────────

const registry: PreviewPlugin[] = []

/**
 * 注册一个预览插件（同 id 覆盖，按优先级降序稳定排序）。
 */
export function registerPreviewPlugin(plugin: PreviewPlugin): void {
  const idx = registry.findIndex((p) => p.id === plugin.id)
  if (idx >= 0) registry[idx] = plugin
  else registry.push(plugin)
  registry.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}

/**
 * 根据文件输入解析出负责渲染的插件（返回 null 表示无插件支持）。
 */
export function resolvePreviewPlugin(input: PreviewInput): PreviewPlugin | null {
  for (const p of registry) {
    if (p.match(input)) return p
  }
  return null
}

/** 按插件 id 反查插件（供 drive-preview-modal 用 state.kind 定位渲染器） */
export function getPreviewPluginById(id: string): PreviewPlugin | null {
  return registry.find((p) => p.id === id) ?? null
}

// ─── 默认「新窗口打开」策略 ─────────────────────────────────────────────────

export const DEFAULT_OPEN_IN_NEW_TAB = {
  /** 图片/视频/音频：直接打开预览流 URL（浏览器原生渲染） */
  stream: (item: PreviewItem, url: string) => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  },
  /** office：打开 /preview/office 路由（后端转 PDF 后由 PdfPreviewer 渲染） */
  office: (item: PreviewItem) => {
    const fileId = encodeURIComponent(String(item.fileId ?? item.id))
    const filename = encodeURIComponent(item.name || item.filename || '')
    window.open(
      `${window.location.origin}/preview/office/${fileId}?filename=${filename}`,
      '_blank',
      'noopener,noreferrer'
    )
  },
  /** pdf/markdown/code/text：打开 /preview/iframe 路由，由对应 Previewer 正确解析渲染 */
  iframe: (item: PreviewItem) => {
    const fileId = encodeURIComponent(String(item.fileId ?? item.id))
    const filename = encodeURIComponent(item.name || item.filename || '')
    window.open(
      `${window.location.origin}/preview/iframe/${fileId}?filename=${filename}`,
      '_blank',
      'noopener,noreferrer'
    )
  }
}
