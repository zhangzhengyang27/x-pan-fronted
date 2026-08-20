# 预览体系插件化重构方案

> 目标：把当前散落在 `src/utils/preview.ts`（类型判定 if/else）和 `src/components/preview/drive-preview-modal.vue`（渲染分发 v-if 链）的逻辑，统一收敛为「插件注册表」模式，实现「加一种格式 = 加一个插件」。
> 本文为**方案设计**，不涉及代码实施。

## 一、现状问题

### 1. 类型判定分散且不可扩展
`resolvePreviewKind` 是「一个大函数 + 一堆硬编码扩展名数组 + if/else」，新增格式要同时改：
- 扩展名数组（`IMAGE_EXTS`/`VIDEO_EXTS`/`CODE_EXTS`...）
- `PreviewKind` 类型联合
- `resolvePreviewKind` 的判定顺序

### 2. 渲染分发靠 v-if 链
`drive-preview-modal.vue` 模板里按 `state.kind` 用 `v-if/v-else-if` 分发到 7 个预览器；`modalWidth`/`contentHeight` 用 switch 硬编码；`openInNewTab` 按 kind 分三种路由。`views/preview/iframe/index.vue` 又重复一套 v-if 链。

**新增一个格式，要改 4 处以上的散点逻辑。**

---

## 二、插件接口设计

### 2.1 插件契约 `PreviewPlugin`

新建 `src/utils/preview-plugin.ts`：

```typescript
import type { Component } from 'vue'

// 复用现有 PreviewInput（来自 preview.ts）
interface PreviewInput {
  name?: string
  filename?: string
  mimeType?: string
  extension?: string
  fileType?: number
  type?: string
}

// 预览文件项（与 useDrivePreview 的 PreviewItem 对齐）
interface PreviewItem {
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

// 插件唯一标识：与现有 PreviewKind 完全对齐（保证 resolvePreviewKind 向后兼容）
export type PreviewPluginId =
  | 'image' | 'video' | 'audio' | 'pdf'
  | 'docx' | 'excel' | 'pptx'
  | 'markdown' | 'code' | 'text'
  // 新增格式的 id
  | 'csv' | 'archive' | 'xmind'

export interface PreviewPlugin {
  /** 插件唯一标识，同时充当对外暴露的 kind */
  id: PreviewPluginId
  /** 判定：给定文件输入，返回是否由本插件负责（替代 if/else） */
  match(input: PreviewInput): boolean
  /** 优先级：多个插件同时 match 时取最高（默认 0） */
  priority?: number
  /** 渲染组件工厂（懒加载，复用 defineAsyncComponent 语义） */
  component: () => Promise<Component>
  /** 是否走全屏浮层（如图片画廊），而非 BaseModal 弹窗 */
  fullscreen?: boolean
  /** 弹窗尺寸配置（替代 modalWidth/contentHeight 的 switch） */
  modal?: { width: number; height: string }
  /** 新窗口打开策略（替代 openInNewTab 的 if/else） */
  openInNewTab?: (item: PreviewItem, previewUrl: string) => void
}
```

### 2.2 关键设计决策

**决策 1：`id` 直接复用现有 `PreviewKind` 字符串。**
这样 `resolvePreviewKind` 可以「查插件表 → 返回插件 `id`」，**现有所有调用方（`useDrivePreview.ts`、`iframe/index.vue`）零改动**，`state.kind` 的值语义不变。

**决策 2：`match` 保持「扩展名 + mimeType」判定，不引入 fileType 强耦合。**
现有判定对 `fileType===0`/`folder` 的过滤放在入口统一处理（见 3.2），插件 `match` 只关心「自己能渲染什么」，职责更纯粹。

**决策 3：`component` 用函数返回 `Promise<Component>`，而非直接 `Component`。**
配合 `defineAsyncComponent` / `<component :is>` 的懒加载，保证每个重型渲染器独立分包。

---

## 三、注册表与 resolvePreviewKind 替换

### 3.1 注册表

```typescript
// preview-plugin.ts
const registry: PreviewPlugin[] = []

export function registerPreviewPlugin(plugin: PreviewPlugin): void {
  // 去重：同 id 覆盖
  const idx = registry.findIndex((p) => p.id === plugin.id)
  if (idx >= 0) registry[idx] = plugin
  else registry.push(plugin)
  // 按优先级降序 + 注册顺序稳定排序
  registry.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}

export function resolvePreviewPlugin(input: PreviewInput): PreviewPlugin | null {
  for (const p of registry) {
    if (p.match(input)) return p
  }
  return null
}
```

### 3.2 `resolvePreviewKind` 向后兼容替换

在 `preview.ts` 中，`resolvePreviewKind` 内部改为查注册表，**对外签名和返回值完全不变**：

```typescript
export function resolvePreviewKind(input: PreviewInput): PreviewKind {
  // 文件夹 / 目录兜底（与现有逻辑一致）
  if (input.fileType === 0 || input.type === 'folder') return 'unsupported'
  const plugin = resolvePreviewPlugin(input)
  return (plugin?.id as PreviewKind) ?? 'unsupported'
}
```

**要点**：
- `isPreviewable`、`isOfficeKind` 等下游函数不受影响。
- `PreviewKind` 类型联合可扩展（加 `'csv' | 'archive' | 'xmind'`），但已有字符串值不变。

### 3.3 内置插件初始化

新建 `src/plugins/preview/index.ts`，把现有 if/else 判定「平移」为内置插件，行为等价：

```typescript
// 示意：每个格式一个插件文件，或集中在 index.ts 注册
registerPreviewPlugin({
  id: 'image',
  match: (i) => IMAGE_EXTS.includes(extOf(i)) || i.mimeType?.startsWith('image/') === true,
  component: () => import('@/components/preview/image-gallery-previewer.vue'),
  fullscreen: true
})
registerPreviewPlugin({
  id: 'video',
  match: (i) => VIDEO_EXTS.includes(extOf(i)) || i.mimeType?.startsWith('video/') === true,
  component: () => import('@/components/preview/video-previewer.vue'),
  modal: { width: 920, height: '520px' }
})
// ... audio / pdf / docx / excel / pptx / markdown / code / text 同理
```

---

## 四、渲染分发改造

### 4.1 `drive-preview-modal.vue` 从 v-if 链 → 插件表驱动

**改造前**（现状）：模板里 7 个 `v-if/v-else-if` + `modalWidth`/`contentHeight` 两个 switch + `openInNewTab` 三路 if/else。

**改造后**：

```vue
<script setup lang="ts">
import { resolvePreviewPlugin } from '@/utils/preview-plugin'

// 根据当前 kind 反查插件（kind 就是 plugin.id）
const plugin = computed(() => {
  const input = { name: currentItem.value?.name, mimeType: currentItem.value?.mimeType, ... }
  return resolvePreviewPlugin(input)
})

// 尺寸从插件配置读取，替代 switch
const modalWidth = computed(() => plugin.value?.modal?.width ?? 960)
const contentHeight = computed(() => plugin.value?.modal?.height ?? '68vh')

// 渲染组件懒加载
const ActiveComponent = computed(() => plugin.value?.component
  ? defineAsyncComponent(plugin.value.component)
  : null
)
</script>

<template>
  <ImageGalleryPreviewer v-if="plugin?.fullscreen && state.open" ... />

  <BaseModal v-else ...>
    <div :style="{ height: contentHeight }">
      <div v-if="urlLoading">...</div>
      <div v-else-if="urlError">...</div>
      <!-- 插件表驱动：替代 v-if 链 -->
      <component
        v-else-if="previewUrl && currentItem && ActiveComponent"
        :is="ActiveComponent"
        :url="previewUrl"
        :file-id="currentItem.fileId || currentItem.id"
        :title="fileName"
        :filename="fileName"
        :kind="state.kind"
      />
      <div v-else>暂不支持的预览类型：{{ state.kind }}</div>
    </div>
  </BaseModal>
</template>
```

**注意**：不同预览器 props 略有差异（video/audio 要 `title`、code 要 `filename`、office 要 `kind`）。统一传齐这 4 个 prop（`url`/`file-id`/`title`/`filename`/`kind`），各组件按需取用，多余 prop 会被 Vue 忽略（或用 `v-bind` 透传）。这是把「异构 props」收敛到统一契约的代价。

### 4.2 `openInNewTab` 收敛

把现状三路 if/else 下沉为各插件的 `openInNewTab` 默认实现，集中在一个工具函数：

```typescript
// 默认策略（集中在 preview-plugin.ts 或单独 utils）
export const DEFAULT_OPEN_IN_NEW_TAB = {
  // 图片/视频/音频：直接打开预览流
  stream: (item, url) => window.open(url, '_blank', 'noopener,noreferrer'),
  // office：打开 /preview/office 路由
  office: (item) => {
    const fileId = encodeURIComponent(item.fileId || item.id)
    const filename = encodeURIComponent(item.name || item.filename || '')
    window.open(`${location.origin}/preview/office/${fileId}?filename=${filename}`, '_blank', 'noopener,noreferrer')
  },
  // pdf/markdown/code/text：打开 /preview/iframe 路由
  iframe: (item) => {
    const fileId = encodeURIComponent(item.fileId || item.id)
    const filename = encodeURIComponent(item.name || item.filename || '')
    window.open(`${location.origin}/preview/iframe/${fileId}?filename=${filename}`, '_blank', 'noopener,noreferrer')
  }
}
```

各插件在定义时挂上对应的 `openInNewTab`；`drive-preview-modal` 的 `openInNewTab()` 改为：

```typescript
function openInNewTab() {
  const item = currentItem.value
  if (!item) return
  const fn = plugin.value?.openInNewTab
  if (fn) fn(item, previewUrl.value)
  else DEFAULT_OPEN_IN_NEW_TAB.iframe(item) // 兜底
}
```

### 4.3 `iframe/index.vue` 同样收敛

`views/preview/iframe/index.vue` 的 v-if 链改为「查插件 → 动态渲染」，与 4.1 同构，仅保留 pdf/markdown/code/text 这几个能独立路由渲染的插件。

---

## 五、懒加载 / 代码分包策略

| 项 | 方案 |
| --- | --- |
| 渲染组件 | 插件 `component` 用 `() => import('@/components/preview/xxx.vue')`，Vite 自动按 chunk 分包 |
| 注册表文件 | 保持轻量，只 import 类型和判定逻辑，不 import 任何渲染组件 |
| 重型库 | ArtPlayer（video）、APlayer（audio）、Vditor（markdown）、@vue-office（office/pdf）、shiki（code）、pdf-lib（pdf 工具）随各自组件 chunk 按需加载，不进首包 |
| 新增格式 | xmind 的 JSZip、csv 解析器等按插件独立 chunk，仅当用户真正预览该格式时才加载 |
| 运行时扩展 | `registerPreviewPlugin` 支持后续动态注册，但默认只内置现有格式，不引入额外依赖 |

---

## 六、与现有能力兼容

| 现有能力 | 是否受影响 | 说明 |
| --- | --- | --- |
| ptoken 鉴权（`resolvePreviewUrl`） | **不受影响** | 插件只负责「判定 + 渲染分发」，URL 获取仍统一走 `resolvePreviewUrl`，鉴权模型不变 |
| 缩略图缓存（IndexedDB + LRU，`thumbnail-cache.ts`） | **不受影响** | 独立于插件体系 |
| 文本编码识别（`decodeTextContent`） | **不受影响** | 保持独立工具，markdown/code/text 插件复用 |
| shiki grammar 裁剪（`SUPPORTED_SHIKI_LANGS`） | **不受影响** | code 插件复用 `resolveShikiLanguage` |
| 视频封面（`resolveVideoCoverUrl`） | **不受影响** | 独立于插件体系 |
| 画廊组建（`useDrivePreview` 的 image 兄弟项收集） | **需微调** | image 插件需暴露「是否组建画廊」的标志（`fullscreen` 字段已涵盖），画廊逻辑保持在 `useDrivePreview` 不变 |

---

## 七、分阶段迁移路径（不破坏现有功能）

| 阶段 | 内容 | 风险 | 验证 |
| --- | --- | --- | --- |
| **阶段一** | 新增 `preview-plugin.ts` + `plugins/preview/index.ts`，把现有 if/else 判定「平移」为内置插件；`resolvePreviewKind` 内部改为查注册表（对外签名不变） | 极低（纯等价重构） | 现有所有格式预览行为逐一回归，`kind` 值不变 |
| **阶段二** | `drive-preview-modal.vue` v-if 链改为插件表驱动 | 中 | 每个 kind（image/video/audio/pdf/office/markdown/code/text）弹窗渲染一致，尺寸一致 |
| **阶段三** | 收敛 `openInNewTab` 与 `iframe/index.vue` 分发 | 中 | 新窗口打开三类路由行为一致 |
| **阶段四** | 按格式清单增量注册新插件（P0：csv/archive → P1：xmind/rar-7z），每个独立验证 | 低（增量） | 新格式单独验收，不影响旧格式 |

**关键原则**：阶段一完成即达到「等价重构」里程碑，可独立交付、独立回滚；阶段四才是真正「加新格式」的收益兑现点，且每加一个格式都是「新增一个插件文件 + 一行 register」，不再触碰判定函数和分发模板。

---

## 八、目录结构（方案新增/修改文件）

```
src/
├── utils/
│   ├── preview.ts                # [修改] resolvePreviewKind 内部改为查注册表，保持签名兼容
│   └── preview-plugin.ts         # [新增] PreviewPlugin 接口 + registry + resolvePreviewPlugin + 默认 openInNewTab
├── plugins/
│   └── preview/
│       ├── index.ts              # [新增] 内置插件注册入口（image/video/audio/pdf/office/markdown/code/text）
│       ├── image-plugin.ts       # [新增] 图片插件
│       ├── video-plugin.ts       # [新增] 视频插件
│       ├── ...                   # 每个格式一个插件文件
│       ├── csv-plugin.ts         # [P0] CSV 插件
│       ├── archive-plugin.ts     # [P0] 压缩包插件（引导在线解压）
│       └── xmind-plugin.ts       # [P1] 思维导图插件
├── components/preview/
│   ├── drive-preview-modal.vue   # [修改] v-if 链 → 插件表驱动 <component :is>
│   ├── csv-previewer.vue         # [P0 新增] CSV 表格渲染器
│   └── archive-previewer.vue     # [P0 新增] 压缩包解压引导
└── views/preview/iframe/
    └── index.vue                 # [修改] v-if 链 → 插件表驱动
```
