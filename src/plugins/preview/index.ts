/**
 * 预览插件注册入口（预览体系插件化重构 · 内置插件）
 *
 * 把 preview.ts 里原来的 if/else 判定「等价平移」为内置插件。
 * 判定顺序（通过 priority 控制）与旧 resolvePreviewKind 保持一致：
 * 先按扩展名精确匹配，再按 mimeType 前缀兜底。
 *
 * 每个插件只负责「判定 + 声明渲染组件/尺寸/新窗口策略」，
 * 不 import 任何重型渲染库（组件内部才动态 import），保证注册表轻量、不撑大首包。
 */
import { registerPreviewPlugin } from '@/utils/preview-plugin'
import {
  IMAGE_EXTS,
  VIDEO_EXTS,
  AUDIO_EXTS,
  PDF_EXTS,
  CODE_EXTS,
  resolveOfficeKind
} from '@/utils/preview'

/** 从文件输入提取小写扩展名（不含点）；文件名用 filename（与后端契约对齐） */
function extOf(input: {
  filename?: string
  extension?: string
}): string {
  const raw = input.extension || input.filename || ''
  const i = raw.lastIndexOf('.')
  return i >= 0 ? raw.slice(i + 1).toLowerCase() : ''
}

/** 注册内置预览插件（保持与旧 resolvePreviewKind 行为等价） */
export function registerBuiltinPreviewPlugins(): void {
  // 图片：扩展名匹配 或 mimeType 前缀兜底
  registerPreviewPlugin({
    id: 'image',
    match: (i) =>
      IMAGE_EXTS.includes(extOf(i)) || i.mimeType?.startsWith('image/') === true,
    component: () => import('@/components/preview/image-gallery-previewer.vue'),
    fullscreen: true,
    openInNewTab: (item, url) => {
      // 图片走画廊，不提供「新窗口打开流」；若外部需要，用 stream 策略兜底
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    }
  })

  // 视频
  registerPreviewPlugin({
    id: 'video',
    match: (i) =>
      VIDEO_EXTS.includes(extOf(i)) || i.mimeType?.startsWith('video/') === true,
    component: () => import('@/components/preview/video-previewer.vue'),
    modal: { width: 920, height: '520px' },
    openInNewTab: (item, url) => {
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    }
  })

  // 音频
  registerPreviewPlugin({
    id: 'audio',
    match: (i) =>
      AUDIO_EXTS.includes(extOf(i)) || i.mimeType?.startsWith('audio/') === true,
    component: () => import('@/components/preview/audio-previewer.vue'),
    modal: { width: 560, height: '220px' },
    openInNewTab: (item, url) => {
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    }
  })

  // PDF
  registerPreviewPlugin({
    id: 'pdf',
    match: (i) => PDF_EXTS.includes(extOf(i)),
    component: () => import('@/components/preview/pdf-previewer.vue'),
    modal: { width: 960, height: '68vh' },
    openInNewTab: (item) => {
      const fileId = encodeURIComponent(String(item.fileId))
      const filename = encodeURIComponent(item.filename || '')
      window.open(
        `${window.location.origin}/preview/iframe/${fileId}?filename=${filename}`,
        '_blank',
        'noopener,noreferrer'
      )
    }
  })

  // Markdown
  registerPreviewPlugin({
    id: 'markdown',
    match: (i) => extOf(i) === 'md',
    component: () => import('@/components/preview/markdown-previewer.vue'),
    modal: { width: 960, height: '68vh' },
    openInNewTab: (item) => {
      const fileId = encodeURIComponent(String(item.fileId))
      const filename = encodeURIComponent(item.filename || '')
      window.open(
        `${window.location.origin}/preview/iframe/${fileId}?filename=${filename}`,
        '_blank',
        'noopener,noreferrer'
      )
    }
  })

  // Office（doc/docx/xls/xlsx/ppt/pptx）→ 细分 docx/excel/pptx
  registerPreviewPlugin({
    id: 'docx',
    match: (i) => resolveOfficeKind(extOf(i)) === 'docx',
    component: () => import('@/components/preview/office-previewer.vue'),
    modal: { width: 960, height: '68vh' },
    openInNewTab: (item) => {
      const fileId = encodeURIComponent(String(item.fileId))
      const filename = encodeURIComponent(item.filename || '')
      window.open(
        `${window.location.origin}/preview/office/${fileId}?filename=${filename}`,
        '_blank',
        'noopener,noreferrer'
      )
    }
  })
  registerPreviewPlugin({
    id: 'excel',
    match: (i) => resolveOfficeKind(extOf(i)) === 'excel',
    component: () => import('@/components/preview/office-previewer.vue'),
    modal: { width: 960, height: '68vh' },
    openInNewTab: (item) => {
      const fileId = encodeURIComponent(String(item.fileId))
      const filename = encodeURIComponent(item.filename || '')
      window.open(
        `${window.location.origin}/preview/office/${fileId}?filename=${filename}`,
        '_blank',
        'noopener,noreferrer'
      )
    }
  })
  registerPreviewPlugin({
    id: 'pptx',
    match: (i) => resolveOfficeKind(extOf(i)) === 'pptx',
    component: () => import('@/components/preview/office-previewer.vue'),
    modal: { width: 960, height: '68vh' },
    openInNewTab: (item) => {
      const fileId = encodeURIComponent(String(item.fileId))
      const filename = encodeURIComponent(item.filename || '')
      window.open(
        `${window.location.origin}/preview/office/${fileId}?filename=${filename}`,
        '_blank',
        'noopener,noreferrer'
      )
    }
  })

  // 代码 / 纯文本（txt/log 单独落到 text，其余代码落到 code）
  registerPreviewPlugin({
    id: 'code',
    match: (i) => {
      const e = extOf(i)
      return CODE_EXTS.includes(e) && e !== 'txt' && e !== 'log'
    },
    component: () => import('@/components/preview/code-previewer.vue'),
    modal: { width: 960, height: '68vh' },
    openInNewTab: (item) => {
      const fileId = encodeURIComponent(String(item.fileId))
      const filename = encodeURIComponent(item.filename || '')
      window.open(
        `${window.location.origin}/preview/iframe/${fileId}?filename=${filename}`,
        '_blank',
        'noopener,noreferrer'
      )
    }
  })
  registerPreviewPlugin({
    id: 'text',
    match: (i) => {
      const e = extOf(i)
      return e === 'txt' || e === 'log'
    },
    component: () => import('@/components/preview/code-previewer.vue'),
    modal: { width: 960, height: '68vh' },
    openInNewTab: (item) => {
      const fileId = encodeURIComponent(String(item.fileId))
      const filename = encodeURIComponent(item.filename || '')
      window.open(
        `${window.location.origin}/preview/iframe/${fileId}?filename=${filename}`,
        '_blank',
        'noopener,noreferrer'
      )
    }
  })

  // P0 新增：CSV 表格预览（后端 FileType=12，纯前端解析，零后端改动）
  registerPreviewPlugin({
    id: 'csv',
    match: (i) => extOf(i) === 'csv',
    component: () => import('@/components/preview/csv-previewer.vue'),
    modal: { width: 1080, height: '68vh' },
    openInNewTab: (item) => {
      const fileId = encodeURIComponent(String(item.fileId))
      const filename = encodeURIComponent(item.filename || '')
      window.open(
        `${window.location.origin}/preview/iframe/${fileId}?filename=${filename}`,
        '_blank',
        'noopener,noreferrer'
      )
    }
  })

  // P0/P1 新增：压缩包 → 引导在线解压（后端 /file/extract 支持 zip/tar/gz/bz2）
  registerPreviewPlugin({
    id: 'archive',
    match: (i) => {
      const e = extOf(i)
      return ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(e)
    },
    component: () => import('@/components/preview/archive-previewer.vue'),
    modal: { width: 560, height: 'auto' }
  })

  // P1 新增：XMind 思维导图 → 纯前端 JSZip 解析（零后端改动）
  registerPreviewPlugin({
    id: 'xmind',
    match: (i) => extOf(i) === 'xmind',
    component: () => import('@/components/preview/xmind-previewer.vue'),
    modal: { width: 900, height: '68vh' },
    openInNewTab: (item) => {
      const fileId = encodeURIComponent(String(item.fileId))
      const filename = encodeURIComponent(item.filename || '')
      window.open(
        `${window.location.origin}/preview/iframe/${fileId}?filename=${filename}`,
        '_blank',
        'noopener,noreferrer'
      )
    }
  })
}
