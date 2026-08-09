# X-Pan Portal（前端）

X-Pan 私人分布式存储系统的前端工程。

> 后端仓库：[`../r_pan_parent`](../r_pan_parent)
> 文档：[`../README.md`](../README.md) · [`../CHANGELOG.md`](../CHANGELOG.md)

---

## 技术栈

- **语言**：TypeScript 5.6（strict 模式）
- **框架**：Vue 3.5（Composition API）
- **构建**：Vite 5.4
- **UI**：Element Plus + Tailwind CSS 4
- **状态**：Pinia 2.3
- **路由**：Vue Router 4.5
- **HTTP**：Axios 1.7
- **实时**：原生 WebSocket（指数退避重连）
- **图标**：@lucide/vue / Iconify
- **代码高亮**：Shiki
- **文件预览**：@vue-office（docx / excel / pdf / pptx）+ pdfjs-dist + ArtPlayer

---

## 项目结构

```
r_pan_portal/
├── public/                      # 静态资源（不进 webpack）
├── src/
│   ├── api/                     # API 调用层（已 100% TS 化）
│   │   ├── user.ts
│   │   ├── file.ts
│   │   ├── share.ts
│   │   ├── recycle.ts
│   │   └── offline.ts
│   ├── assets/                  # 静态资源
│   ├── components/              # 公共组件
│   │   ├── base/                # 基础组件（BaseButton / BaseInput ...）
│   │   ├── layout/              # 布局组件
│   │   ├── preview/             # 文件预览
│   │   └── ...
│   ├── composables/             # 组合式函数（已 100% TS 化）
│   │   ├── useWebSocket.ts      # ★ WebSocket 单例 + 自动重连
│   │   ├── useTheme.ts
│   │   ├── useToast.ts          # ElMessage / ElMessageBox
│   │   └── ...
│   ├── router/                  # 路由
│   │   └── index.ts
│   ├── stores/                  # Pinia 状态
│   │   ├── user.ts
│   │   ├── file.ts
│   │   └── breadcrumb/
│   ├── styles/                  # 全局样式（Tailwind tokens）
│   ├── types/                   # 全局类型
│   │   └── index.ts             # API VO + 事件总线 + WS 载荷
│   ├── utils/                   # 工具（已 100% TS 化）
│   │   ├── cookie.ts
│   │   ├── http.ts
│   │   ├── simple-http.ts
│   │   └── common.ts
│   ├── views/                   # 页面
│   │   ├── list-page/
│   │   │   ├── all-files/
│   │   │   ├── offline/         # ★ 已接入 WebSocket（取代轮询）
│   │   │   ├── recent/
│   │   │   └── recycle/
│   │   ├── share/
│   │   ├── login/
│   │   └── ...
│   ├── App.vue
│   ├── main.ts                  # ★ 启动 WS + 路由守卫
│   └── shims.d.ts               # 类型垫片
├── Dockerfile                   # 多阶段构建（node → nginx）
├── nginx.conf                   # SPA fallback + 反代 + gzip
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
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
VITE_API_BASE_URL=/api
VITE_WS_URL=ws://localhost:8080/ws/notification
```

### 开发

```bash
npm run dev
```

默认 [http://localhost:5173](http://localhost:5173)

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
| `npm run preview` | 预览构建产物 |

---

## 核心功能

### WebSocket 实时通知

[`src/composables/useWebSocket.ts`](./src/composables/useWebSocket.ts) 提供单例 WebSocket 客户端：

- **自动重连**：指数退避（1s → 2s → 4s → ... → 30s 上限），最多 8 次
- **心跳**：客户端 25s 发 PONG，应答服务端 30s PING
- **路由感知**：登录后自动连接，登出自动断开
- **类型安全**：完整 TypeScript 泛型支持

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

#### 手动连接

```typescript
import { useWebSocket } from '@/composables/useWebSocket'
import { getToken } from '@/utils/cookie'

const ws = useWebSocket()
const token = getToken()
if (token) ws.connect(token)
```

#### 主动断开

```typescript
ws.disconnect()
```

详见 `src/main.ts` 中的全局启动逻辑。

---

## 状态管理（Pinia）

```
src/stores/
├── user.ts          # 当前登录用户、token
├── file.ts          # 当前文件列表、面包屑
└── breadcrumb/
    └── index.js     # 面包屑步骤（保留 JS，遗留）
```

### 使用示例

```typescript
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const userId = userStore.userInfo?.userId
```

---

## 路由

主要路由：

| Path | 页面 | 权限 |
|---|---|---|
| `/login` | 登录 | 公开 |
| `/main/all` | 全部文件 | 登录 |
| `/main/recent` | 最近文件 | 登录 |
| `/main/recycle` | 回收站 | 登录 |
| `/main/offline` | 离线下载 | 登录 |
| `/share/:shareId` | 分享查看 | 公开 |
| `/admin/...` | 管理后台 | 管理员 |

---

## 样式

- **Tailwind CSS 4**：原子化 + 设计 token（`src/styles/tokens.css`）
- **Element Plus**：主题覆盖通过 CSS 变量
- **暗色模式**：通过 `useTheme()` 切换，状态持久化在 localStorage

### 设计 Token

```css
:root {
  --color-primary-50: #f0f9ff;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  /* ... */
}
```

详见 `src/styles/tokens.css`。

---

## 类型系统

`src/types/index.ts` 集中管理全局类型：

```typescript
// API VO
export interface IUserInfo { ... }
export interface IFileVO { ... }
export interface IOfflineTaskVO { ... }

// 事件总线
export interface AppEvents {
  'xpan:reload-files': void
  'xpan:open-share': { fileIds: string[] }
  // ...
}

// WebSocket 载荷
export interface IWsOfflineTaskPayload extends Partial<IOfflineTaskVO> { ... }
```

### 类型约定

1. **API 响应**：统一 `Promise<ApiResponse<T>>`，`code: 0` 表示成功
2. **DTO 命名**：`I` 前缀 + 名词（`IUserInfo` / `IFileVO`）
3. **状态枚举**：数字字面量联合（`OfflineTaskStatusCode = 0 | 1 | 2 | 3 | 4`）
4. **跨模块类型**：必须在 `src/types/index.ts` 导出
5. **组件 Props**：用 `defineProps<{ ... }>()` 显式声明

---

## 国际化（i18n）

> P6 计划中。当前所有文案为中文内置。

---

## 测试

> P5 计划中。

---

## 贡献

详见 [`../README.md`](../README.md) 的开发约定章节。

---

## 协议

[MIT](../LICENSE)
