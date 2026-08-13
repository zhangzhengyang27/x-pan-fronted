# X-Pan Portal（前端）

X-Pan 私人分布式存储系统的前端工程。

> 后端仓库：[`../r_pan_parent`](../r_pan_parent)
> 代码百科：[`CODE_WIKI.md`](./CODE_WIKI.md)

---

## 技术栈

- **语言**：TypeScript 5.6（strict 模式）
- **框架**：Vue 3.5（Composition API + `<script setup>`）
- **构建**：Vite 5.4
- **样式**：Tailwind CSS 4（CSS-first `@theme`）+ 自研设计令牌 `src/styles/tokens.css`
- **状态**：Pinia 2.3
- **路由**：Vue Router 4.5
- **HTTP**：Axios 1.7（双实例：`http.ts` 主实例 / `simple-http.ts` 匿名实例）
- **实时**：原生 WebSocket（单例 + 指数退避重连）
- **组件库**：自研 `Base*` 组件（**未使用 Element Plus**，`ElMessage`/`ElMessageBox` 为 `useToast` 自研实现）
- **图标**：@lucide/vue
- **上传**：simple-uploader.js（分片 / 秒传 / 断点续传）
- **文件预览**：@vue-office（docx / excel / pdf / pptx）+ pdfjs-dist + ArtPlayer + APlayer + Shiki + Vditor
- **其他**：markdown-it、qrcode、fuse.js、spark-md5（秒传指纹）、js-cookie、nprogress

---

## 项目结构

```
r_pan_portal/
├── public/                      # 静态资源（不进 build）
├── src/
│   ├── api/                     # API 调用层（file/user/share/recycle/offline）
│   ├── assets/                  # 静态资源
│   ├── components/              # 公共组件
│   │   ├── base/                # 自研基础组件库（BaseButton / BaseModal ...）+ 业务浮层（ExtractDialog / FolderPickerDialog / ShortcutsPanel / AIAssistant / ContextMenu）
│   │   ├── layout/              # 布局组件（Header / Navbar / AppMain / Footer）
│   │   ├── file-table/          # 文件表格 + 工具栏 + 缩略图 + 详情面板 + 版本面板 + ImageTimeline
│   │   ├── preview/             # 各类文件预览器（drive-preview-modal 统一入口）
│   │   ├── buttons/             # 文件操作按钮组（上传/下载/分享/删除…）
│   │   └── confirm-host/        # 全局确认/输入框宿主
│   ├── composables/             # 组合式函数
│   │   ├── useWebSocket.ts      # ★ WebSocket 单例 + 自动重连
│   │   ├── useTheme.ts          # 主题（light/dark/system）
│   │   ├── useToast.ts          # 自研 ElMessage / ElMessageBox / ElNotification
│   │   ├── useUploader.ts       # 分片上传编排（MD5 秒传 → 分片 → 合并）
│   │   ├── useDrivePreview.ts   # 预览状态机
│   │   └── ...
│   ├── router/                  # 路由 + 守卫
│   │   └── index.ts
│   ├── stores/                  # Pinia（Setup Store 写法）
│   │   ├── user.ts              # 用户信息、配额
│   │   ├── file.ts              # 文件列表、面包屑、分页/排序/搜索
│   │   ├── breadcrumb.ts        # 面包屑步骤
│   │   ├── navbar.ts            # 视图模式、搜索、显示设置
│   │   └── task.ts              # 上传任务列表
│   ├── styles/                  # 全局样式（Tailwind tokens）
│   │   └── tokens.css           # 设计令牌（单一真相源）
│   ├── types/                   # 全局类型 + 第三方类型垫片
│   │   └── index.ts             # API VO + 事件总线 + WS 载荷
│   ├── utils/                   # 工具
│   │   ├── cookie.ts            # js-cookie 封装
│   │   ├── http.ts             # 主 Axios 实例（需登录）
│   │   ├── simple-http.ts       # 匿名 Axios 实例（分享/公开）
│   │   ├── common.ts            # panUtil 工具集
│   │   ├── md5.ts               # 秒传指纹
│   │   └── preview.ts           # 预览 URL（带缓存 + 并发去重）
│   ├── views/                   # 页面
│   │   ├── list-page/           # 列表页（file/doc/img/music/video/share/recycle/offline/vault/stats）
│   │   ├── preview/             # 预览页（code/office/iframe/image/music/video）
│   │   ├── share/               # 分享查看页
│   │   ├── login/ / register/ / forget/
│   │   └── error/ / protocol/
│   ├── App.vue
│   ├── main.ts                  # ★ 启动 WS + 路由守卫 + 主题防闪烁
│   └── shims.d.ts               # 类型垫片
├── Dockerfile                   # 多阶段构建（node → nginx）
├── nginx.conf                   # SPA fallback + 反代 + gzip
├── index.html
├── vite.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── package.json
└── README.md
```

---

## 快速开始

### 环境要求

- Node.js 20+
- npm 10+ 或 pnpm 8+

### 安装

```bash
npm install
# 或
pnpm install
```

### 配置

创建 `.env.local`（不要提交）：

```bash
VITE_API_BASE_URL=/api                       # 或 http://127.0.0.1:8081（后端实际监听 8081，本地直连需显式指定）
VITE_WS_URL=ws://localhost:8081/ws/notification
```

### 开发

```bash
npm run dev
```

默认 [http://localhost:5179](http://localhost:5179)（端口在 `vite.config.ts` 固定为 5179）

### 类型检查

```bash
npm run typecheck
```

### 构建

```bash
# 含类型检查
npm run build

# 跳过类型检查（紧急发布）
npm run build:nocheck
```

### 预览构建产物

```bash
npm run preview
```

---

## 脚本

| 脚本 | 说明 |
|---|---|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | vue-tsc 类型检查 + Vite 打包 |
| `npm run build:nocheck` | 仅 Vite 打包（跳过类型检查） |
| `npm run typecheck` | 仅类型检查 |
| `npm run lint` / `lint:fix` | ESLint 检查 / 修复 |
| `npm run format` | Prettier 格式化 |

---

## 核心功能

### WebSocket 实时通知

[`src/composables/useWebSocket.ts`](./src/composables/useWebSocket.ts) 提供单例 WebSocket 客户端：

- **自动重连**：指数退避（1s → 2s → 4s → ... → 30s 上限），最多 8 次
- **心跳**：客户端 25s 发 PING，应答服务端 PONG；超过 2 倍心跳间隔静默未收到消息则主动关闭触发重连
- **路由感知**：登录后自动连接，登出自动断开
- **消息类型**：`CONNECTED` / `PING` / `PONG` / `OFFLINE_TASK_UPDATE` / `OFFLINE_TASK_REMOVED` / `SHARE_STATS_UPDATE` / `UPLOAD_FINISHED` / `SYSTEM_NOTICE`
- **类型安全**：`on<T>(type, handler)` 返回解绑函数；`useWebSocketAuto` 在组件卸载时仅移除本次注册的 handler（不断开连接，防泄漏）

#### 订阅消息

```typescript
import { useWebSocket } from '@/composables/useWebSocket'

const ws = useWebSocket()

ws.on<IOfflineTaskPayload>('OFFLINE_TASK_UPDATE', (payload) => {
  console.log('任务更新:', payload)
})

ws.on<{ taskId: string }>('OFFLINE_TASK_REMOVED', (payload) => {
  console.log('任务删除:', payload.taskId)
})

ws.on<{ level: string; message: string }>('SYSTEM_NOTICE', (payload) => {
  ElMessage[payload.level as 'success'](payload.message)
})
```

#### 手动连接 / 断开

```typescript
import { useWebSocket } from '@/composables/useWebSocket'
import { getToken } from '@/utils/cookie'

const ws = useWebSocket()
const token = getToken()
if (token) ws.connect(token)
// 主动断开
ws.disconnect()
```

详见 `src/main.ts` 中的全局启动逻辑。

### 分片上传与秒传

[`src/composables/useUploader.ts`](./src/composables/useUploader.ts) 编排 `simple-uploader.js`：

1. `filesAdded` → 暂停 → 计算 MD5 指纹（`spark-md5`）；
2. `secUpload` 秒传判定，命中即完成；
3. 未命中走 `chunk-upload`（分片 1MB、并发 3、`testChunks` 断点续传）→ `merge` 合并落盘。

进度/状态同步到 `useTaskStore`；完成时累加 `useUserStore.usedSpace`（前端估算）并刷新文件列表。

### 文件提取（ExtractDialog）

`src/components/base/ExtractDialog.vue` 提供文件提取能力（如从第三方网盘/链接提取文件），配套 `src/api/file/extract.ts` 接口，可在文件详情面板与表格工具栏入口触发。

### 图片时间线（ImageTimeline）

`src/components/file-table/ImageTimeline.vue` 以时间维度聚合图片类文件，为图片列表页（`/imgs`）提供按时间浏览的视图。

---

## 状态管理（Pinia）

全部采用 **Setup Store** 写法，位于 [`src/stores/`](./src/stores/)。

| Store | 文件 | 职责 |
|---|---|---|
| `useUserStore` | user.ts | 当前用户、已用/总空间（默认 100GB）、配额百分比 |
| `useFileStore` | file.ts | 文件列表核心 store（当前目录、分页、排序、搜索、面包屑） |
| `useBreadcrumbStore` | breadcrumb.ts | 面包屑步骤数组 |
| `useNavbarStore` | navbar.ts | 视图模式（list/grid/gallery）、搜索关键字、显示设置 |
| `useTaskStore` | task.ts | 上传任务列表与面板开关；以 `filename` 为唯一键去重更新 |

### 使用示例

```typescript
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const userId = userStore.userInfo?.userId
```

---

## 路由

主要路由（`src/router/index.ts`）：

| Path | 页面 | 权限 |
|---|---|---|
| `/login` · `/register` · `/forget` | 认证 | 公开 |
| `/files` · `/docs` · `/imgs` · `/musics` · `/videos` | 全部/文档/图片/音乐/视频 | 登录 |
| `/shares` | 我的分享 | 登录 |
| `/recycles` | 回收站 | 登录 |
| `/offline` | 离线下载 | 登录 |
| `/vault` | 加密保险箱 | 登录 |
| `/stats` | 统计面板 | 登录 |
| `/share/:shareId` | 分享查看 | 公开 |
| `/preview/code\|office\|iframe\|image\|music\|video/...` | 文件预览 | 登录 |
| `/agreement` · `/privacy` | 协议/隐私 | 公开 |
| `/404` · `/500` | 错误页 | 公开 |

**路由守卫（`beforeEach`）核心逻辑**

| 条件 | 行为 |
|---|---|
| 已登录访问 `Login/Register/Forget` | 重定向到 `Index` |
| 未登录访问非白名单 | 重定向到 `Login`，带 `redirect` query |
| 已登录但 `userStore.username` 为空 | 调 `userService.info()`，3s 超时兜底放行；`code=10/401` 跳登录，其余错误放行 |
| 其余 | `next()` |

白名单：`Login / Register / Forget / Share / Agreement / Privacy / Error404 / Error500`。

全局使用 `nprogress` 顶部进度条（`beforeEach` start、`afterEach` done）。

---

## 样式

- **Tailwind CSS 4**：CSS-first（`@theme`），原子化 + 设计 token（`src/styles/tokens.css` 单一真相源）
- **自研组件库**：`Base*` 组件替代 Element Plus，主题由 CSS 变量与语义令牌驱动
- **暗色模式**：通过 `useTheme()` 切换（light / dark / system），状态持久化在 `localStorage('x-pan:theme')`，挂载前同步执行防 FOUC

### 设计 Token

```css
:root {
  --color-primary-500: #0070f3; /* 品牌蓝（Vercel/Linear 风格） */
  --color-bg: #ffffff;
  --color-surface: #f7f8fa;
  --color-text: #1a1a1a;
  /* ... 详见 src/styles/tokens.css */
}
```

详见 `src/styles/tokens.css`。

---

## 类型系统

[`src/types/index.ts`](./src/types/index.ts) 集中管理全局类型（命名规范 `I*` 接口 / `T*` 别名 / `E*` 枚举）：

- **通用响应**：`ApiResponse<T> { code, message, data }`（`code===0` 成功，`code===10` 需登录）；`PageVO<T> { total, pageSize, pageNum, records, hasMore }`
- **业务 VO**：`IUserInfo`、`IFileVO`（`FileType`：1=文件夹/2=图/3=视频/4=音频/5=文档/6=其他）、`IShareVO`、`IRecycleItemVO`、`IOfflineTaskVO`（`OfflineTaskStatusCode=0|1|2|3|4`）、`IFileVersionVO`
- **事件总线**：`AppEvents`（`xpan:reload-files`、`xpan:open-share`、`xpan:open-folder-picker`、`xpan:show-shortcuts`、`xpan:open-ai`…）
- **WS 载荷**：`IWsOfflineTaskPayload`、`IWsOfflineTaskRemovedPayload`

### 类型约定

1. **API 响应**：统一 `Promise<ApiResponse<T>>`，`code: 0` 表示成功
2. **DTO 命名**：`I` 前缀 + 名词（`IUserInfo` / `IFileVO`）
3. **状态枚举**：数字字面量联合（`OfflineTaskStatusCode = 0 | 1 | 2 | 3 | 4`）
4. **跨模块类型**：必须在 `src/types/index.ts` 导出
5. **组件 Props**：用 `defineProps<{ ... }>()` 显式声明

---

## 网络层

两个 Axios 实例（`src/utils/`）：

- **`http.ts`**（主实例，需登录）：请求拦截注入 `Authorization`（来自 cookie）与 `X-Pan-Trace-Id`；响应拦截 `code===10` 触发 `toLogin()`（清 token + 清所有 store + 跳登录），`code!==0` reject，正常返回 `res.data`。
- **`simple-http.ts`**（匿名实例，分享/公开接口）：不带 `Authorization`，响应仅判断 `code!==0` 即 reject，不触发登录跳转。

---

## 国际化（i18n）

> 计划中。当前所有文案为中文内置。

## 测试

> 计划中。

## 部署

多阶段构建（见 `Dockerfile`）：`node:20-alpine` 构建 → `nginx:1.27-alpine` 提供静态服务；`nginx.conf` 配置 SPA fallback、`/api/` 反代（后端 8081）、gzip、安全头。`vite.config.ts` 已增强 `server.proxy`（`/api` → `:8081` 去前缀、`/ws` → `:8081`）。

---

## 开发约定

- 路径别名：`@/` → `src/`
- 跨页面共享状态用 Pinia，单页面用 `ref`
- API 集中在 `src/api/`，统一回调风格，错误由 `http` 拦截器兜底
- WebSocket 业务事件用 `useWebSocket().on('TYPE', handler)` 订阅，组件内用 `useWebSocketAuto` 自动清理
- 跨模块类型必须在 `src/types/index.ts` 导出；`I*` 接口 / `T*` 别名 / `E*` 枚举
- 样式优先使用 `tokens.css` 语义令牌；暗色用 `.dark` class 切换
- ESLint flat config；`@typescript-eslint/no-explicit-any: off`

详见 [`CODE_WIKI.md`](./CODE_WIKI.md) 的「开发约定与规范」章节。

---

## 已知问题

1. **README 信息滞后修正**：前端**未使用 Element Plus**，UI 由 Tailwind v4 + 自研 `Base*` 组件承担；`ElMessage/ElMessageBox` 为 `useToast.ts` 自研实现。
2. **后端默认地址不一致**：`panUtil.getUrlPrefix()` 缺省 `http://127.0.0.1:8081`，而后端实际监听 `8081`；本地直连需经 `VITE_API_BASE_URL` 显式指定或 nginx `/api/` 反代。
3. **前端配额估算**：上传完成时 `useUserStore.usedSpace` 仅前端累加，刷新后会被 `info()` 覆盖（后端暂未暴露真实用量字段）。
4. **秒传唯一键**：`useTaskStore` 以 `filename` 作为任务去重键，同名并发上传会互相覆盖任务条目。
5. **layui 遗留资源**：`public/static/layui/` 为旧版静态资源，未在当前源码中引用，可清理。

---

## 贡献

详见 [`../README.md`](../README.md) 的开发约定章节。

## 协议

[MIT](../LICENSE)
