# R Pan · Code Wiki

> 本文档为 **R Pan（X-Pan）私人分布式存储系统** 的结构化代码百科，覆盖项目整体架构、主要模块职责、关键类与函数说明、依赖关系与运行方式。
> 文档分前端（`r_pan_portal`，主体）与后端（`r_pan_parent`，概览）两部分。

---

## 目录

- [1. 项目简介](#1-项目简介)
- [2. 技术栈](#2-技术栈)
- [3. 仓库结构与工程布局](#3-仓库结构与工程布局)
- [4. 整体架构](#4-整体架构)
- [5. 前端架构详解（r_pan_portal）](#5-前端架构详解r_pan_portal)
  - [5.1 启动入口与初始化](#51-启动入口与初始化)
  - [5.2 路由系统](#52-路由系统)
  - [5.3 状态管理（Pinia）](#53-状态管理pinia)
  - [5.4 网络层](#54-网络层)
  - [5.5 API 服务层](#55-api-服务层)
  - [5.6 组合式函数（composables）](#56-组合式函数composables)
  - [5.7 类型系统](#57-类型系统)
  - [5.8 组件体系](#58-组件体系)
  - [5.9 视图与页面](#59-视图与页面)
  - [5.10 样式与设计令牌](#510-样式与设计令牌)
- [6. 后端架构概览（r_pan_parent）](#6-后端架构概览r_pan_parent)
- [7. 前后端集成契约](#7-前后端集成契约)
- [8. 依赖关系](#8-依赖关系)
- [9. 项目运行方式](#9-项目运行方式)
- [10. 开发约定与规范](#10-开发约定与规范)
- [11. 已知问题与注意事项](#11-已知问题与注意事项)

---

## 1. 项目简介

R Pan（仓库内称 **X-Pan**）是一个面向个人的、可扩展的分布式云存储系统，提供文件管理、分片上传/秒传/断点续传、分享链接、离线下载、回收站、文件版本历史、WebSocket 实时通知等能力。

仓库由两个子工程组成：

| 子工程 | 角色 | 技术栈 |
|---|---|---|
| `r_pan_portal` | 前端 SPA | Vue 3.5 + TypeScript + Vite + Tailwind CSS v4 + Pinia |
| `r_pan_parent` | 后端服务 | Spring Boot 3.4 + Java 17 + MyBatis-Plus + 多存储引擎 |

> 说明：仓库根目录名含 "Element Plus"，但前端**实际未使用 Element Plus**。`ElMessage` / `ElMessageBox` 等为自研轻量实现（见 [5.6 useToast](#useToast)）；UI 由 Tailwind CSS v4 + 自研 `Base*` 组件库承担。

---

## 2. 技术栈

### 前端

| 类别 | 选型 |
|---|---|
| 语言 | TypeScript 5.6（strict） |
| 框架 | Vue 3.5（Composition API + `<script setup>`） |
| 构建 | Vite 5.4 |
| 样式 | Tailwind CSS v4（CSS-first `@theme`，`@custom-variant dark`） |
| 状态 | Pinia 2.3 |
| 路由 | Vue Router 4.5 |
| HTTP | Axios 1.7 |
| 实时 | 原生 WebSocket（单例 + 指数退避重连） |
| 图标 | @lucide/vue |
| 上传 | simple-uploader.js（分片/秒传/断点续传） |
| 预览 | @vue-office（docx/excel/pdf/pptx）、pdfjs-dist、ArtPlayer、APlayer、markdown-it、Shiki、Vditor |
| 工具 | spark-md5（秒传指纹）、js-cookie、nprogress |

### 后端

| 类别 | 选型 |
|---|---|
| 语言/框架 | Java 17 / Spring Boot 3.4.13 |
| 持久化 | MyBatis-Plus 3.5.9 + MySQL 8.0 + Druid 1.2.25 |
| 缓存 | Spring Cache + Caffeine + Redis |
| 安全 | JWT（jjwt 0.12.6）+ Salted MD5 |
| 存储 | 本地 / MinIO / 阿里云 OSS / FastDFS（按大小路由） |
| 实时 | Spring WebSocket（原生） |
| 熔断 | Resilience4j 2.2.0 |
| 链路/监控 | OpenTelemetry + Micrometer + Prometheus |
| 序列化/工具 | Fastjson2、Hutool、MapStruct、Lombok |

---

## 3. 仓库结构与工程布局

```
资料代码 2/
├── r_pan_parent/                      # 后端（Maven 多模块）
│   ├── pom.xml                        # 父 POM，统一版本管理
│   ├── framework/                     # 通用框架层
│   │   ├── core/                      # 工具、JWT、异常、统一响应
│   │   ├── web/                       # Web、AOP、Swagger
│   │   ├── cache/                     # cache-core / cache-caffeine / cache-redis
│   │   ├── orm/mybatis-plus/          # ORM 封装
│   │   ├── schedule/                  # 定时任务
│   │   ├── swagger2/                  # API 文档
│   │   └── storage-engine/            # core / local / minio / oss / fastdfs
│   ├── server/                        # 业务服务（含启动类 + 业务模块）
│   ├── distribution/                  # 启动配置 + 打包（application.yaml / db.sql / bin）
│   ├── deploy/                        # docker-compose / grafana / prometheus / nginx
│   └── README.md
│
├── r_pan_portal/                      # 前端（Vite + Vue 3，本文档主体）
│   ├── src/
│   │   ├── api/                       # API 调用层（file/user/share/recycle/offline）
│   │   ├── assets/                    # 静态资源（imgs / base.css / main.css）
│   │   ├── components/                # 公共组件
│   │   │   ├── base/                  # 自研基础组件库（Base* + 全局浮层）
│   │   │   ├── breadcrumb/            # 面包屑
│   │   │   ├── buttons/               # 文件操作按钮组（上传/下载/分享/删除…）
│   │   │   ├── confirm-host/          # 全局确认/输入框宿主
│   │   │   ├── file-table/            # 文件表格 + 工具栏 + 缩略图 + 版本面板
│   │   │   ├── preview/               # 各类文件预览器
│   │   │   ├── dashboard/             # 仪表盘卡片/图表
│   │   │   ├── header / navbar / footer / app-main / search / task-list …
│   │   ├── composables/               # 组合式函数（WS/主题/Toast/上传/预览…）
│   │   ├── layout/                    # 主布局壳
│   │   ├── router/                    # 路由 + 守卫
│   │   ├── stores/                    # Pinia（user/file/breadcrumb/navbar/task）
│   │   ├── styles/tokens.css          # Tailwind v4 设计令牌（单一真相源）
│   │   ├── types/                     # 全局类型 + 第三方类型垫片
│   │   ├── utils/                     # http / simple-http / cookie / common / md5 / preview / classnames
│   │   ├── views/                     # 页面（login/forget/list-page/preview/error…）
│   │   ├── App.vue
│   │   └── main.ts                    # 入口：Pinia + Router + 主题 + WS
│   ├── public/                        # 静态资源（layui 遗留、favicon）
│   ├── Dockerfile                     # 多阶段构建（node → nginx）
│   ├── nginx.conf                     # SPA fallback + /api 反代 + gzip + 安全头
│   ├── eslint.config.js               # ESLint flat config
│   ├── index.html                     # FOUC 防闪烁主题预置
│   └── package.json
│
├── .github/workflows/ci.yml           # GitHub Actions CI
├── CHANGELOG.md
└── README.md
```

---

## 4. 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                 浏览器 · Vue 3 SPA（r_pan_portal）                   │
│   Router 守卫 · Pinia · Axios(http/simple-http) · WebSocket 单例     │
└──────────────────┬───────────────────────────────────┬──────────────┘
                   │ HTTPS (REST /api)                  │ WSS (/ws/notification)
┌──────────────────▼───────────────────────────────────▼──────────────┐
│                       Nginx 反向代理                                │
│         / → 静态 SPA   /api/ → 后端 8081   /ws → 后端 WS             │
└──────────────────┬───────────────────────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────────────────────┐
│            Spring Boot 3.4（r_pan_parent/server）                    │
│  modules: user | file | share | recycle | offline | log | webdav     │
│  common:  WebSocket | AOP | 事件 | 定时任务 | 熔断 | 指标 | 链路      │
└────────┬──────────────────┬──────────────────┬───────────────────────┘
         │                  │                  │
┌────────▼────────┐ ┌───────▼───────┐ ┌────────▼────────────┐
│  MySQL 8.0      │ │   Redis       │ │  Storage Engines    │
│ (MyBatis-Plus)  │ │ (Cache/限流)  │ │ Local/MinIO/OSS/FDFS│
└─────────────────┘ └───────────────┘ └─────────────────────┘
```

**关键数据流**

1. **认证流**：登录 → 后端下发 JWT → 前端 `js-cookie` 持久化（`login_token`，1 天，SameSite=Lax）→ 路由守卫放行 → Axios 请求头注入 `Authorization` → 路由 `afterEach` 触发 WebSocket 建连。
2. **上传流**：`useUploader` → MD5 指纹 → `sec-upload`（秒传判定）→ 命中即完成；未命中走 `chunk-upload`（分片）→ `merge`（合并落盘）。
3. **实时流**：后端业务事件 → `Notifier` 推送 WS 消息 → 前端单例分发到对应 `handler`（离线任务进度 / 分享统计 / 系统通知…）。

---

## 5. 前端架构详解（r_pan_portal）

### 5.1 启动入口与初始化

入口：[`src/main.ts`](src/main.ts)

启动顺序：

1. `createApp(App)`，注册全局错误处理器（`app.config.errorHandler`）；
2. `app.use(createPinia())` + `app.use(router)`；
3. `initTheme()`：**挂载前同步**读取 `localStorage('x-pan:theme')` 并切换 `.dark` 类，防止主题闪烁（FOUC）；与 [`index.html`](index.html) 内联脚本双重保险；
4. 取单例 `useWebSocket()`，在 `router.afterEach` 中按登录态自动 **建连 / 断开**；
5. 全局订阅 `SYSTEM_NOTICE` → 顶部 Toast；
6. `app.mount('#app')`；
7. 开发环境把 ws 实例挂到 `window.__ws` 便于调试。

根组件 [`src/App.vue`](src/App.vue) 仅承载 `<router-view />` + 全局浮层 `ConfirmHost` + `ShortcutsPanel`。

### 5.2 路由系统

定义：[`src/router/index.ts`](src/router/index.ts)

- **模式**：`createWebHistory`，懒加载全部页面。
- **主布局**：`/` 下挂 `@/layout/index.vue` 作为父路由，子路由为各列表页（`/files`、`/docs`、`/imgs`、`/musics`、`/videos`、`/shares`、`/recycles`、`/offline`）。
- **独立页**：`/login`、`/register`、`/forget`、`/share/:shareId`、`/agreement`、`/privacy`、`/404`、`/500`。
- **预览页**：`/preview/code|office|iframe|image|music|video/...`。
- **兜底**：`/:pathMatch(.*)* → /404`。

**路由守卫（`beforeEach`）核心逻辑**

| 条件 | 行为 |
|---|---|
| 已登录访问 `Login/Register/Forget` | 重定向到 `Index` |
| 未登录访问非白名单 | 重定向到 `Login`，带 `redirect` query |
| 已登录但 `userStore.username` 为空 | 调 `userService.info()`，3s 超时兜底放行；`code=10/401` 跳登录，其余错误放行 |
| 其余 | `next()` |

白名单：`Login / Register / Forget / Share / Agreement / Privacy / Error404 / Error500`。

全局使用 `nprogress` 顶部进度条（`beforeEach` start、`afterEach` done）。

### 5.3 状态管理（Pinia）

全部采用 **Setup Store** 写法。位于 [`src/stores/`](src/stores/)。

| Store | 文件 | 职责 |
|---|---|---|
| `useUserStore` | [user.ts](src/stores/user.ts) | 当前用户名、已用/总空间（默认 100GB）、配额百分比；`setUsername/setQuota/clear` |
| `useFileStore` | [file.ts](src/stores/file.ts) | 文件列表核心 store，见下文 |
| `useBreadcrumbStore` | [breadcrumb.ts](src/stores/breadcrumb.ts) | 面包屑步骤数组 |
| `useNavbarStore` | [navbar.ts](src/stores/navbar.ts) | 视图模式（`list/grid/gallery`）、激活项、搜索关键字、显示设置 |
| `useTaskStore` | [task.ts](src/stores/task.ts) | 上传任务列表与面板开关；以 `filename` 为唯一键去重更新 |

**`useFileStore` 关键设计**（[file.ts](src/stores/file.ts)）

- `parentId` / `defaultParentId`：当前目录与用户根目录；`paramParentId` 计算属性把 `-1` 映射为根目录 id。
- 分页：`pageNum/pageSize(50)/total/hasMore/isLoadingMore`，支持 `loadFileList` / `loadMore` / `loadAllForFilter`。
- 排序：`sortProp/sortOrder`，`toggleSort` 三态循环（asc → desc → null），`sortItems<T>` 通用排序（数值减法 / 字符串 `localeCompare('zh-CN')`）。
- 搜索：`searchFlag/searchKey` + `searchWithFilter(filter)`，支持扩展名、日期服务端过滤，**大小范围**在前端二次过滤（`parseFileSizeDesc` 解析 `"1.5 MB"`）。
- `applyPageResponse`：兼容 `PageVO<T>`（带 `records`）与裸数组两种后端返回形态。

### 5.4 网络层

两个 Axios 实例，均位于 [`src/utils/`](src/utils/)。

#### [`http.ts`](src/utils/http.ts) — 主实例（需登录）

- `baseURL`：`panUtil.getUrlPrefix()`（优先 `VITE_API_BASE_URL`，缺省 `http://127.0.0.1:8081`）。
- **请求拦截**：注入 `Authorization`（来自 cookie）、`X-Pan-Trace-Id`（`web-<时间36进制>-<随机>`）；把 `data` 对象序列化为字符串。
- **响应拦截**：
  - `code === 10` → `toLogin()`（清 token + 清所有 store + 弹确认框 → 刷新或跳登录）；
  - `code !== 0` → `reject(res.data)`；
  - 正常 → 直接返回 `res.data`（业务层拿到 `ApiResponse<T>`）。
- **错误归一化**：401/403/413/5xx/ECONNABORTED/离线 均映射为中文提示并附带 `x-pan-trace-id` 追踪码。

#### [`simple-http.ts`](src/utils/simple-http.ts) — 匿名实例（分享/公开接口）

不带 `Authorization`，仅注入 `Trace-Id`；响应仅判断 `code !== 0` 即 reject，不触发登录跳转。

#### [`cookie.ts`](src/utils/cookie.ts)

封装 `js-cookie`：`login_token` / `share_token` 两个键，1 天有效期，`SameSite=Lax` 防 CSRF。

#### [`common.ts`](src/utils/common.ts) — `panUtil` 工具集

| 方法 | 作用 |
|---|---|
| `EFileStatus` | 上传状态枚举：1 解析中 / 2 等待 / 3 上传中 / 4 暂停 / 5 成功 / 6 失败 / 7 服务器处理中 |
| `translateFileSize/translateSpeed/translateTime` | 字节→K/M/G、速率、剩余时间格式化 |
| `checkUsername/checkPassword` | 用户名 6-16 位字母数字、密码 8-16 位 |
| `getFileFontElement(type)` | 文件类型 → Lucide 图标名映射 |
| `getUrlPrefix()` | 解析后端地址，支持完整 URL 与相对路径（nginx 反代） |
| `getChunkSize/getMaxFileSize/getChunkUploadSwitch` | 分片 1MB、单文件上限 3GB、默认开启分片 |
| `getPreviewUrl(fileId)` | 拼 `/file/preview?fileId=...&authorization=...` |
| `handleId(id)` | URL 编码 `+` `/`，避免 base64 id 在 URL 中出错 |

### 5.5 API 服务层

统一回调风格 `(resolve, reject)`，位于 [`src/api/`](src/api/)。

| Service | 文件 | 主要接口 |
|---|---|---|
| `fileService` | [api/file](src/api/file/index.ts) | `list`、`createFolder`、`update`、`delete`、`getFolderTree`、`transfer`、`copy`、`search`、`getBreadcrumbs`、`secUpload`、`merge`、`archiveDownload`、`listVersions`、`getVersion`、`rollback`、`deleteVersion` |
| `userService` | [api/user](src/api/user/index.ts) | `login`、`register`、`info`、`checkUsername`、`checkAnswer`、`resetPassword`、`changePassword`、`exit`、`searchHistories`、`checkUserLoginStatus`、`infoWithoutPageJump`（匿名） |
| `shareService` | [api/share](src/api/share/index.ts) | `getShareDetail`、`createShare`、`cancelShare`、`checkShareCode`、`getShareFiles`、`saveShareFiles`、`getShares`、`getSimpleShareDetail`（公开走 `simpleHttp`） |
| `recycleService` | [api/recycle](src/api/recycle/index.ts) | `recycles`、`restoreRecycle`、`deleteRecycle` |
| `offlineService` | [api/offline](src/api/offline/index.ts) | `create`、`list`、`cancel`、`delete` |

### 5.6 组合式函数（composables）

<a id="useToast"></a>
#### [`useToast.ts`](src/composables/useToast.ts) — 自研提示/确认体系（非 Element Plus）

- `ElMessage`：四色 Toast（success/error/warning/info），DOM 挂载到 `#__x_pan_toast_container`，2.4s 自动消失，同步写 console。
- `ElNotification`：`ElMessage` 的薄封装。
- `ElMessageBox.confirm/prompt/alert`：基于 **事件总线队列**（`window.dispatchEvent('x-pan:confirm-push'|'x-pan:prompt-push')`），由全局 [`components/confirm-host`](src/components/confirm-host/index.vue) 消费渲染；`answerConfirm/answerPrompt` 解析 Promise。支持输入校验（`inputPattern/inputValidator`）。
- `ElLoading`：占位实现（`noop`），保留接口兼容。

#### [`useWebSocket.ts`](src/composables/useWebSocket.ts) — 实时通知单例

- **单例**：模块级 `_singleton`，全应用共享一个 WS 连接与 handler Map。
- **建连**：`buildWsUrl` 优先用 `VITE_WS_URL`，否则用当前 host + 后端端口 + `/ws/notification?token=`。
- **心跳**：每 25s 发 `{type:'PING'}`（小于服务端 30s）；另设静默检测，超过 2 倍心跳间隔未收到任何消息则主动 `close(4000)` 触发重连。
- **重连**：指数退避 `min(1000*2^n, 30s)`，最多 8 次。
- **订阅**：`on<T>(type, handler)` 返回解绑函数；`once` 自动解绑；`useWebSocketAuto` 在组件卸载时仅移除本次注册的 handler（不断开连接，防泄漏）。
- **消息类型**：`CONNECTED / PING / PONG / OFFLINE_TASK_UPDATE / OFFLINE_TASK_REMOVED / SHARE_STATS_UPDATE / UPLOAD_FINISHED / SYSTEM_NOTICE`。

#### [`useTheme.ts`](src/composables/useTheme.ts) — 主题

- 三态：`light / dark / system`，持久化到 `localStorage('x-pan:theme')`。
- `isDark` 计算：`dark` 或（`system` 且 `prefers-color-scheme: dark`）。
- `apply()`：切换 `<html>.dark` 与 `data-theme` 属性；`watch` + `onMounted` 双触发。
- `initTheme()`：挂载前同步执行，防 FOUC。

#### [`useUploader.ts`](src/composables/useUploader.ts) — 分片上传编排

- 持有 `simple-uploader.js` 单例（`_uploader`）+ 引用计数 `_attachCount`。
- **三段流程**：`filesAdded` → 暂停 → `MD5` 计算指纹 → `secUpload`（秒传）→ 命中即移除任务；未命中 `resumeWaiting` → `fileProgress` 更新进度 → `fileSuccess` 判定 `mergeFlag` 或全分片上传完成 → `merge` 合并。
- 进度/状态全部同步到 `useTaskStore`；完成时累加 `useUserStore.usedSpace`（前端估算）并 `loadFileList()` 刷新。
- `addFiles(FileList|File[]|File)`：统一喂入入口，供按钮与拖拽复用。
- 配置：`chunkSize=1MB`、`simultaneousUploads=3`、`testChunks=true`、`checkChunkUploadedByResponse` 解析秒传/断点已上传分片。

#### [`useDrivePreview.ts`](src/composables/useDrivePreview.ts) — 预览状态机

- 维护 `open/item/kind/galleryItems/galleryIndex`；`openPreview` 解析预览类型，图片类自动收集同目录图片组建画廊；`resolvePreviewUrl` 复用 [`utils/preview.ts`](src/utils/preview.ts)（带缓存 + 并发去重）。

#### 其他 composables

| 文件 | 作用 |
|---|---|
| `useFavorites.ts` / `useRecent.ts` | 收藏 / 最近访问（前端 localStorage） |
| `useIcon.ts` | 文件类型 → Lucide 图标 |
| `useMediaQuery.ts` | 响应式断点 |
| `usePdfSearch.ts` | PDF 内文本搜索 |
| `useResizable.ts` | 可拖拽分栏尺寸 |
| `useTableSort.ts` | 表格排序类型（`SortOrder`） |

### 5.7 类型系统

集中定义于 [`src/types/index.ts`](src/types/index.ts)，命名规范 `I*` 接口 / `T*` 别名 / `E*` 枚举。

- **通用响应**：`ApiResponse<T> { code, message, data }`（`code===0` 成功，`code===10` 需登录）；`PageVO<T> { total, pageSize, pageNum, records, hasMore }`。
- **业务 VO**：`IUserInfo`、`IFileVO`（含 `FileType` 枚举 1=文件夹/2=图/3=视频/4=音频/5=文档/6=其他）、`IShareVO`、`IRecycleItemVO`、`IOfflineTaskVO`（`OfflineTaskStatusCode=0|1|2|3|4`）、`IFileVersionVO`。
- **请求 DTO**：`ILoginReq`、`IRegisterReq`、`IShareCreateReq`、`IUploadChunkReq`、`IFileSearchReq` 等。
- **事件总线**：`AppEvents`（`xpan:reload-files`、`xpan:open-share`、`xpan:open-folder-picker`、`xpan:show-shortcuts`、`xpan:open-ai`…）。
- **WS 载荷**：`IWsOfflineTaskPayload`、`IWsOfflineTaskRemovedPayload`。
- 第三方垫片：[`types/simple-uploader.d.ts`](src/types/simple-uploader.d.ts)、[`types/pdfjs-dist.d.ts`](src/types/pdfjs-dist.d.ts)、[`types/third-party-stubs.d.ts`](src/types/third-party-stubs.d.ts)、`shims.d.ts`。

### 5.8 组件体系

#### 自研基础组件库 [`components/base/`](src/components/base/)

`BaseButton / BaseInput / BaseSelect / BaseCheckbox / BaseRadioGroup / BaseModal / BaseDrawer / BaseDropdown / BasePopover / BaseTooltip / BaseTable / BaseTree / BaseTreeNode / BaseSteps / BaseProgress / BaseBadge / BaseDivider / BaseField / BaseAutocomplete / BaseResult`，外加业务级 `ContextMenu / FolderPickerDialog / ShortcutsPanel / AIAssistant`。

> 这些 `Base*` 组件即项目实际的"组件库"，替代了 README 中提及但未实际使用的 Element Plus。

#### 全局浮层

- [`components/confirm-host/index.vue`](src/components/confirm-host/index.vue)：消费 `useToast` 的事件队列，渲染全局确认框/输入框。
- [`components/base/ShortcutsPanel.vue`](src/components/base/ShortcutsPanel.vue)：快捷键面板，挂在 `App.vue`。
- `task-list` / `upload-task-panel`：上传任务可视化。
- `AIAssistant`：AI 助手浮层。

#### 布局组件

| 组件 | 职责 |
|---|---|
| [`layout/index.vue`](src/layout/index.vue) | `Header + (Navbar + AppMain) + Footer`，含路由过渡 `route-fade`、移动端汉堡触发 `xpan:open-mobile-nav` |
| `header` / `simple-header` | 顶栏（登录态/匿名态） |
| `navbar` | 侧栏导航，支持移动端抽屉 |
| `breadcrumb` | 面包屑 |
| `footer` | 底栏 |
| `app-main` | 主内容容器 |

#### 文件操作

- [`components/buttons/`](src/components/buttons/)：`upload-button / download-button / create-folder-button / delete-button / rename-button / copy-button / share-button / transfer-button`，每个按钮自包含交互逻辑。
- `file-button-group` / `file-type-filter` / `file-table`（含 `FileTableToolbar`、`FileThumbnail`、`FileHistoryPanel`）。
- `common/FolderTreeSelector.vue`：移动/复制目标选择。

#### 预览组件 [`components/preview/`](src/components/preview/)

`drive-preview-modal`（统一入口）+ 各类型预览器：`image-gallery-previewer`、`video-previewer`（ArtPlayer）、`audio-previewer`（APlayer）、`pdf-previewer`（pdfjs-dist）、`office-previewer`（@vue-office docx/excel/pptx）、`code-previewer`（Shiki）、`markdown-previewer`（markdown-it / Vditor）。

### 5.9 视图与页面

位于 [`src/views/`](src/views/)：

- `login/`、`register/`（路由引用，目录未单独列出）、`forget/`：认证流程。
- `list-page/`：`file`（全部文件）、`doc`、`img`、`music`、`video`、`share`（我的分享）、`recycle`（回收站）、`offline`（离线下载）。
- `preview/`：`code`、`office`、`iframe`、`image`、`music`、`video`（独立路由页）。
- `share/`：分享查看页（公开，`/share/:shareId`）。
- `error/404`、`error/500`。
- `protocol/`：协议/隐私页（`/agreement`、`/privacy`，复用同一组件 + `props.type`）。

### 5.10 样式与设计令牌

单一真相源：[`src/styles/tokens.css`](src/styles/tokens.css)（Tailwind v4 CSS-first）。

- **暗色变体**：`@custom-variant dark (&:where(.dark, .dark *));`（v4 语法，非 v3）。
- **品牌色**：专业蓝 `--color-primary-500: #0070f3`（Vercel/Linear 风格），9 阶 + fixed 系列。
- **中性灰**：9 阶 + Material 3 风格 `surface-container` 色阶。
- **语义令牌**：`--color-bg / surface / surface-2 / text / text-muted / border / border-strong / ring`，组件优先使用语义令牌。
- **暗色**：纯黑 `--color-bg: #000000`，分层 surface。
- **排版**：`Be Vietnam Pro`（正文）+ `JetBrains Mono`（等宽）。
- **尺寸系统**：圆角 `--radius-*`、阴影 `--shadow-*`、动效 `--dur-*` / `--ease-*`、布局 `--header-h: 64px` / `--navbar-w: 240px` / `--content-max-w: 1600px`、Z 轴 `--z-modal: 1300` 等。
- **全局特性**：滚动条美化、选区配色、`focus-visible` 焦点环、路由过渡动画、抽屉动画、`prefers-reduced-motion` 降级、`.glass-panel` 毛玻璃。

---

## 6. 后端架构概览（r_pan_parent）

### 6.1 Maven 多模块

父 POM [`r_pan_parent/pom.xml`](../r_pan_parent/pom.xml) 继承 `spring-boot-starter-parent:3.4.13`，统一管理 30+ 依赖版本，下含三大模块：

```
framework/   通用框架（被 server 依赖）
server/      业务服务（启动类 + 业务模块）
distribution/ 启动打包（application.yaml / db.sql / bin 脚本）
```

`framework` 进一步拆分：

| 子模块 | 职责 |
|---|---|
| `core` | 工具、JWT、异常、统一响应 `R<T>` |
| `web` | Web 配置、AOP、Swagger |
| `cache/{core,caffeine,redis}` | 缓存抽象与实现 |
| `orm/mybatis-plus` | ORM 封装 |
| `schedule` | 定时任务 |
| `swagger2` | API 文档 |
| `storage-engine/{core,local,minio,oss,fastdfs}` | 存储引擎抽象与四种实现 |

### 6.2 server 业务模块

包根：`com.xiaoye.pan.server`，启动类 [`XPanServerLauncher.java`](../r_pan_parent/server/src/main/java/com/xiaoye/pan/server/XPanServerLauncher.java)。各业务模块统一 `controller / service(+impl) / mapper / entity / po / vo / context / converter / enums / constants` 分层。

| 模块 | 关键类 | 职责 |
|---|---|---|
| `user` | `UserController`、`UserServiceImpl`、`UserConverter` | 注册/登录/信息/改密/找回/用户名校验/搜索历史 |
| `file` | `FileController`、`FileServiceImpl`、`FileChunkServiceImpl`、`FileHistoryServiceImpl`、`ThumbnailServiceImpl`、`UserFileServiceImpl` | 文件 CRUD、分片上传/秒传/合并、目录树、转移/复制、搜索、面包屑、归档下载、版本历史/回滚、缩略图 |
| `share` | `ShareController`、`ShareServiceImpl`、`ShareFileServiceImpl` | 创建/取消分享、详情、校验提取码、保存到网盘 |
| `recycle` | `RecycleController`、`RecycleServiceImpl` | 回收站列表/恢复/彻底删除 |
| `offline` | `OfflineTaskController`、`OfflineTaskServiceImpl` | 离线下载创建/列表/取消/删除 |
| `log` | `IErrorLogServiceImpl`、`XPanErrorLog` | 错误日志持久化 |
| `webdav` | `WebDavController` | WebDAV 协议接入 |
| `test` | `TestController` | 调试接口 |

**分层约定**：Controller 收 `PO` → 转 `Context`（Service 入参聚合）→ Service 调用 → `Converter`（MapStruct）实体↔`VO` 转换 → 统一 `R<T>` 返回。

### 6.3 common 横切能力

| 包 | 关键类 | 职责 |
|---|---|---|
| `common/websocket` | `WebSocketConfig`、`NotificationWebSocketHandler`、`Notifier`、`WebSocketHeartbeat` | WS 端点 `/ws/notification`、心跳、消息推送 |
| `common/event` + `listenner` | `DeleteFileEvent`、`FilePhysicalDeleteEvent`、`ErrorLogEvent`、`UserSearchEvent`、`ShareStatusChangeListener`… | Spring 事件解耦（删除/物理删除/错误日志/搜索/分享状态） |
| `common/schedule` | `CleanExpireRecycleFileTask`、`CleanExpireChunkFileTask` + Launcher | 定时清理过期回收站文件与孤儿分片 |
| `common/resilience` | `MinioCircuit`、`CircuitBreakerFallback` | Resilience4j 熔断（MinIO 存储） |
| `common/ratelimit` | `RedisRateLimiter` | Redis 限流 |
| `common/metrics` | `ApiMetricsFilter`、`BusinessMetrics` | HTTP 耗时分布、业务计数器 |
| `common/log` | `LogMdcFilter` | MDC 注入 `userId/requestId/traceId` |
| `common/migration` | `StorageMigrationRunner` | 存储迁移 |
| `common/gc` | `OrphanFileGc` | 孤儿文件回收 |
| `common/exception` | `GlobalExceptionHandler` | 全局异常 → 统一响应 + 脱敏 |
| `common/aspect` | `CommonLoginAspect`、`ShareCodeAspect` | 登录校验、分享提取码校验 AOP |
| `common/annotation` | `@LoginIgnore`、`@NeedShareCode` | 标记免登录 / 需提取码 |
| `common/config` | `PanServerConfig`、`ThreadPoolConfig`、`OpenApiConfig`、`AesKeyConfig` | 业务/线程池/Swagger/AES 配置 |
| `common/health` | `HealthIndicators` | 健康检查 |

---

## 7. 前后端集成契约

### 7.1 REST API 契约

- **统一响应**：`{ code, message, data }`，`code===0` 成功，`code===10` 需重新登录，其余为业务错误。
- **分页**：`PageVO<T> { total, pageSize, pageNum, records, hasMore }`。
- **路径前缀**（经 nginx `/api/` 反代到后端 `/`）：`/user`、`/files`、`/file/...`、`/share`、`/recycles`、`/offline/...`。
- **认证**：请求头 `Authorization: <jwt>`（前端直接放 token 字符串，非 `Bearer ` 前缀）。
- **链路追踪**：前端注入 `X-Pan-Trace-Id`，后端日志/响应头回传，错误提示附追踪码。

### 7.2 WebSocket 协议

- 端点：`ws://<host>:<port>/ws/notification?token=<jwt>`
- 客户端 → 服务端：`{ "type": "PING", "ts": ... }`
- 服务端 → 客户端：`CONNECTED` / `PING` / `OFFLINE_TASK_UPDATE` / `OFFLINE_TASK_REMOVED` / `SHARE_STATS_UPDATE` / `UPLOAD_FINISHED` / `SYSTEM_NOTICE`，均带 `payload` 与 `ts`。

### 7.3 上传三段流程

1. `POST /file/sec-upload` `{ filename, identifier(MD5), parentId }` → 命中即秒传；
2. `POST /file/chunk-upload`（分片，`checkChunkUploadedByResponse` 实现断点续传）；
3. `POST /file/merge` `{ identifier, filename, parentId, totalSize }` → 合并落盘。

状态机：解析中(1) → 等待(2) → 上传中(3) → 服务器处理中(7) → 成功(5)；异常 暂停(4)/失败(6)。

---

## 8. 依赖关系

### 8.1 前端依赖（package.json）

**生产依赖**

| 依赖 | 用途 |
|---|---|
| `vue@^3.5.13` | 框架 |
| `vue-router@^4.5.0` | 路由 |
| `pinia@^2.3.0` | 状态管理 |
| `axios@^1.7.9` | HTTP |
| `@lucide/vue@^1.30.0` | 图标 |
| `simple-uploader.js@^0.6.0` | 分片上传 |
| `spark-md5@^3.0.2` | 秒传 MD5 指纹 |
| `js-cookie@^3.0.5` | Cookie |
| `nprogress@^0.2.0` | 顶部进度条 |
| `pdfjs-dist@^6.2.108` | PDF 预览 |
| `@vue-office/{docx,excel,pdf,pptx}` | Office 预览 |
| `artplayer@^5.4.0` | 视频播放 |
| `aplayer@^1.10.1` | 音频播放 |
| `markdown-it@^15` / `vditor@^3.11` | Markdown 渲染/编辑 |
| `shiki@^4.4.2` | 代码高亮 |
| `@luohc92/vue3-image-viewer@^1.0.0` | 图片查看器 |

**开发依赖**

| 依赖 | 用途 |
|---|---|
| `vite@^5.4.11` + `@vitejs/plugin-vue` | 构建 |
| `tailwindcss@^4.3.3` + `@tailwindcss/vite` | 样式（v4 Vite 插件） |
| `typescript@^5.6` + `vue-tsc@^2.1.10` | 类型检查 |
| `eslint@^9.17` + `eslint-plugin-vue` + `typescript-eslint` + `prettier` | 代码规范 |
| `unplugin-auto-import` + `unplugin-vue-components` | 自动导入（已在 devDependencies，需 vite.config 启用） |
| `@types/node` / `@types/js-cookie` / `@types/markdown-it` / `@types/nprogress` / `@types/spark-md5` | 类型定义 |

### 8.2 后端依赖（pom.xml 版本管理）

`spring-boot-starter-parent:3.4.13`、`mybatis-plus:3.5.9`、`mysql-connector-j:8.4.0`、`druid:1.2.25`、`jjwt:0.12.6`、`fastjson2:2.0.64`、`hutool:5.8.47`、`mapstruct:1.6.3`、`lombok:1.18.46`、`resilience4j:2.2.0`、`springdoc-openapi:2.8.6`、`aliyun-sdk-oss:3.18.5`、`fastdfs-client:1.27.2`、`rocketmq-spring-boot-starter:2.3.6`、`guava:33.6.0-jre`、`commons-*`。

### 8.3 模块依赖图

```
前端 r_pan_portal
  └─ views/components ──> composables ──> stores ──> api ──> utils/http
  └─ composables ──> utils/{common,md5,cookie,preview}
  └─ http.ts ──> stores/{user,file,breadcrumb,navbar} + useToast + cookie + common

后端 r_pan_parent
  └─ server ──> framework/{core,web,cache,orm,schedule,swagger2,storage-engine}
  └─ storage-engine-{local,minio,oss,fastdfs} ──> storage-engine-core
  └─ cache-{caffeine,redis} ──> cache-core
  └─ server/modules/* ──> common/{websocket,event,schedule,resilience,metrics...}
```

---

## 9. 项目运行方式

### 9.1 环境要求

| 工具 | 版本 | 说明 |
|---|---|---|
| Node.js | 20+ | 前端 |
| npm 10+ / pnpm 8+ | — | 前端包管理 |
| JDK | 17+ | 后端 |
| Maven | 3.8+ | 后端构建 |
| MySQL | 8.0+ | 持久化 |
| Redis | 7.0+ | 缓存（可选） |
| MinIO | 8.0+ | 对象存储（可选） |

### 9.2 前端

```bash
cd r_pan_portal
npm install            # 或 pnpm install
```

环境变量（创建 `.env.local`，不入库）：

```bash
VITE_API_BASE_URL=/api                       # 或 http://127.0.0.1:8081
VITE_WS_URL=ws://localhost:8081/ws/notification
```

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动 Vite 开发服务器（默认 5173） |
| `npm run build` | `vue-tsc` 类型检查 + Vite 打包 |
| `npm run build:nocheck` | 跳过类型检查打包（紧急发布） |
| `npm run typecheck` | 仅类型检查 |
| `npm run lint` / `lint:fix` | ESLint 检查/修复 |
| `npm run format` | Prettier 格式化 |

### 9.3 后端

```bash
cd r_pan_parent

# 初始化数据库
mysql -u root -p < server/src/main/resources/sql/schema.sql

# 必填：JWT 密钥
export RPAN_JWT_SECRET=$(head -c 48 /dev/urandom | base64)

# 编译 + 启动
mvn clean install -DskipTests
mvn -pl server spring-boot:run     # 默认 8081
```

配置文件：`server/src/main/resources/application.yaml.example`（DB/Redis/MyBatis-Plus/Actuator/Swagger）。关键环境变量：`DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD`、`REDIS_HOST/REDIS_PORT/REDIS_PASSWORD`、`RPAN_JWT_SECRET`。

### 9.4 Docker

前端镜像（[`Dockerfile`](Dockerfile)）：`node:20-alpine` 构建 → `nginx:1.27-alpine` 提供静态服务，[`nginx.conf`](nginx.conf) 配置 SPA fallback、`/api/` 反代（`http://x-pan-backend:8081/`，10G body / 600s 读超时）、静态资源 1 年 immutable 缓存、gzip、安全头、`/health` 健康检查。

后端镜像：见 `r_pan_parent/server/Dockerfile`。

一键启动可参考 `r_pan_parent/deploy/docker-compose.yml`（含 Grafana/Prometheus）。

### 9.5 可观测性端点

- Swagger UI：`http://localhost:8081/swagger-ui.html`
- OpenAPI JSON：`http://localhost:8081/v3/api-docs`
- Prometheus：`http://localhost:8081/actuator/prometheus`
- 健康：`http://localhost:8081/actuator/health`

---

## 10. 开发约定与规范

### 前端

- **TypeScript**：所有新文件 `.ts` / `.vue`（`<script setup lang="ts">`）。
- **路径别名**：`@/` → `src/`。
- **状态**：跨页面共享用 Pinia，单页面用 `ref`。
- **API**：集中在 `src/api/`，统一回调风格，错误由 `http` 拦截器兜底。
- **WebSocket**：业务事件用 `useWebSocket().on('TYPE', handler)` 订阅，组件内用 `useWebSocketAuto` 自动清理。
- **类型**：跨模块类型必须在 [`src/types/index.ts`](src/types/index.ts) 导出；`I*` 接口 / `T*` 别名 / `E*` 枚举。
- **样式**：优先使用 `tokens.css` 语义令牌；暗色用 `.dark` class 切换（v4 `@custom-variant`）。
- **ESLint**：flat config，`*.config.*` / `dist` / `public` 被忽略；`@typescript-eslint/no-explicit-any: off`。

### 后端

- **包结构**：`com.xiaoye.pan.server.modules.{module}.{layer}`。
- **Service 入参**：用 `XxxContext` 聚合；Controller 收 `PO`。
- **VO 转换**：MapStruct `XxxConverter` 统一处理。
- **异常**：业务异常抛 `RPanBusinessException`，`GlobalExceptionHandler` 统一返回 + 脱敏。
- **日志**：禁止打印密码/token；MDC 注入 `userId/requestId/traceId`。
- **Git 提交**：`feat/fix/docs/refactor/ci/test/chore(scope): ...`。

---

## 11. 已知问题与注意事项

1. **构建配置现状**：`vite.config.ts` / `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` 均已存在且可用。`tsconfig` 三件套采用 references 模式（strict、`@/*` paths、`vite/client` 经 `shims.d.ts` 引入），无需改动。`vite.config.ts` 已增强 `server.proxy`（`/api` → `:8081` 去前缀、`/ws` → `:8081`）与 `build.target: esnext`，端口固定 5179。注意：`package.json` 声明了 `unplugin-auto-import` / `unplugin-vue-components` 但**未在 vite.config 中启用**（源码全部显式导入，启用反而可能引入自动注册冲突），属有意保留。
2. **README 信息滞后**：[`README.md`](README.md) 与后端 README 多处仍写 "Element Plus"，实际前端 UI 由 Tailwind v4 + 自研 `Base*` 组件承担；`ElMessage/ElMessageBox` 为 [`useToast.ts`](src/composables/useToast.ts) 自研实现。
3. **后端默认地址一致**：前端 `panUtil.getUrlPrefix()` 缺省 `http://127.0.0.1:8081`，后端实际监听 `8081`；本地直连需通过 `VITE_API_BASE_URL` 显式指定，或经 nginx `/api/` 反代。
4. **layui 遗留资源**：`public/static/layui/` 为旧版静态资源，未在当前源码中引用，可清理。
5. **路由引用的页面**：`router/index.ts` 引用的 `@/views/register`、`@/views/preview/{code,office,iframe,image,music,video}`、`@/views/protocol`、`@/views/share` 等目录均已确认存在，无缺失。
6. **前端配额估算**：上传完成时 `useUserStore.usedSpace` 仅前端累加，后端 `UserInfoVO` 暂未暴露真实用量字段，刷新后会被 `info()` 覆盖。
7. **秒传唯一键**：`useTaskStore` 以 `filename` 作为任务去重键（而非 `uniqueIdentifier`），以规避 MD5 计算前后 id 变化导致的匹配失败；同名并发上传会互相覆盖任务条目。

---

> 文档生成依据：当前工作树源码 + `r_pan_parent/README.md` + `r_pan_portal/README.md`。如有结构与代码不一致，以源码为准。
