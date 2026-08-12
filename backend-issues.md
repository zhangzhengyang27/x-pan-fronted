# 后端问题记录

> 记录前端改造过程中发现的后端接口/能力缺失问题，需后端协同解决。

## 问题清单

### BE-01 · 创建文件夹接口 500（createFolder）

- **接口**：`POST /createFolder`
- **现象**：传 `{ parentId: '0', filename: '测试文件夹A' }` 返回 500「服务器内部错误」
- **复现**：登录后（cookie `login_token` 有效），fetch 调用返回 `code: 500, message: "服务器内部错误，请稍后重试"`
- **可能原因**：
  1. `parentId` 根目录 ID 非 `'0'`，需为实际根目录 ID（fileStore `defaultParentId` 动态获取）
  2. 参数名/类型不匹配（后端期望 Long 而非 String？）
  3. 新注册用户根目录未初始化
- **影响**：前端测试账号无法创建文件，无法完整验证框选/收藏/最近访问联动
- **建议**：后端确认 `createFolder` 入参 schema，并校验根目录 ID 获取方式

### BE-02 · 文件列表接口 500（getFileList）

- **接口**：`POST /getFileList`
- **现象**：传 `{ parentId: '-1', pageNo: 1, pageSize: 10 }` 返回 500
- **可能原因**：`parentId: '-1'` 是前端 fileStore 内部约定，后端可能不识别
- **建议**：确认根目录 parentId 约定（前端 `parentId === '-1'` 时取 `defaultParentId`）

### BE-03 · 缺失接口（P2/P3 任务依赖）

以下任务需后端新增接口：

> ✅ **本批接口已由后端实现并完成前端对接（2026-08-12）**，详见 BE-09。

| 任务 | 后端接口 | 说明 | 前端状态 |
|---|---|---|---|
| P3-3 在线解压 | `POST /file/extract` | 云端解压 ZIP（仅 ZIP） | ✅ 已对接（`api/file/extract.ts`） |
| P3-4 隐私保险箱 | `/vault/*` 8 个接口 | 独立密码表 + PBKDF2 + 缓存解锁 | ✅ 已对接（`api/vault/index.ts`） |
| P3-5 设备管理 | `GET /device/list` `POST /device/logout` | 登录设备指纹 + 远程下线 | ✅ 已对接（`api/device/index.ts`） |
| P3-1 视频关键帧 | `GET /file/video-thumbnails` | 接口骨架（当前返回未生成） | ⚠️ 后端骨架 + 前端 canvas 采样兜底 |
| P3-2 自动打标 | `POST /file/auto-tag` | 后端规则匹配打标 | ✅ 已对接（DeepSeek 未配置时降级） |

### BE-08 · P3 阶段前端已实现（历史快照）

> 下表为 P3 阶段前端 Mock 骨架的历史快照，当前已全部替换为真实后端对接，最新状态见 BE-09。

| 任务 | 实现方式 | 文件 | 备注 |
|---|---|---|---|
| P3-1 视频关键帧 | canvas 采样 20 帧生成 dataURL，注入 ArtPlayer thumbnails | `composables/useVideoThumbnails.ts`、`preview/video-previewer.vue` | 纯前端，无后端依赖；CORS 失败时降级为无缩略图 |
| P3-2 自动打标 | 复用 DeepSeek 对文件名/类型提取 3-5 个标签，localStorage 持久化 | `composables/useFileTags.ts`、`file-table/index.vue` 右键菜单 | 图片场景识别需多模态模型，前端无法实现 |
| P3-3 在线解压 | UI 骨架 + Mock 数据（进度弹窗 + 文件列表） | `api/file/extract.ts`、`base/ExtractDialog.vue` | ⚠️ Mock 数据，后端就绪后替换 `extractService.extract` |
| P3-4 隐私保险箱 | /vault 路由 + 二次验证 + Mock 文件列表 | `api/vault/index.ts`、`views/list-page/vault/index.vue` | ⚠️ Mock 密码 123456，后端就绪后替换为真实加密验证 |
| P3-5 设备管理 | 用户菜单入口 + 设备列表弹窗 + Mock 下线 | `api/device/index.ts`、`base/DeviceManagerDialog.vue`、`user-info/index.vue` | ⚠️ Mock 数据，后端就绪后替换 `deviceService` 方法 |

#### BE-08a · 后端接口对接指引（已实施 ✅）

> 以下对接指引已于 2026-08-12 全部实施完毕，保留作为接口契约备忘。

1. **在线解压** `api/file/extract.ts`：
   - `extract(fileId, resolve, reject, targetParentId?)` → `http.post('/file/extract', { fileId, targetParentId? })`
   - 后端同步返回解压后文件列表，直接入库到目标父目录

2. **隐私保险箱** `api/vault/index.ts`：
   - `status()` → `GET /vault/status` 返回 `{ hasPassword, unlocked }`
   - `setup(password)` → `POST /vault/setup`（首次设置，PBKDF2 加密落库）
   - `unlock(password)` → `POST /vault/unlock`（校验密码，缓存解锁状态 30 分钟）
   - `lock()` → `POST /vault/lock`（清除解锁缓存）
   - `list()` → `GET /vault/files`（后端按登录态 + 解锁缓存校验，无需额外 token 头）
   - `move(fileIds)` → `POST /vault/move`（fileIds 为逗号分隔加密ID）
   - `moveOut(fileId)` → `POST /vault/file/{id}/out`
   - `destroy(fileId)` → `DELETE /vault/file/{id}`

3. **设备管理** `api/device/index.ts`：
   - `list()` → `GET /device/list`（后端依据 UA + IP 标记 isCurrent）
   - `logout(deviceId)` → `POST /device/logout`（body: `{ deviceId }`）

### BE-09 · P3 后端模块实现 + 前端对接完成（2026-08-12）

后端在 `r_pan_parent` 新增 4 个模块，前端已全部对接真实接口（Mock 已清除），`vue-tsc --noEmit` 通过。

#### 后端新增模块

| 模块 | Controller | 核心能力 | 数据表 |
|---|---|---|---|
| 在线解压 | `ExtractController` | ZIP 解压 + 文件入库 + 路径穿越防护 + 条目数上限 | 复用 x_pan_user_file |
| 隐私保险箱 | `VaultController` | 独立密码表 + PBKDF2 校验 + 缓存解锁 + 文件隐藏(parent_id=-2) | x_pan_vault_password、x_pan_vault_user_file |
| 设备管理 | `DeviceController` | UA/IP 指纹 + 登录记录 + 远程下线 | x_pan_device |
| 文件标签 | `FileTagController` | 规则打标 + 标签 CRUD | x_pan_file_tag |
| 视频关键帧 | `VideoThumbnailController` | 接口骨架（返回未生成） | 无 |

#### 前端对接清单

| 文件 | 改动 | 对接接口 |
|---|---|---|
| `api/device/index.ts` | 重写，移除 Mock | `GET /device/list`、`POST /device/logout` |
| `api/vault/index.ts` | 重写，补全 8 个方法 | `/vault/status\|setup\|unlock\|lock\|files\|move`、`/vault/file/{id}/out`、`DELETE /vault/file/{id}` |
| `api/file/extract.ts` | 重写，移除 Mock，新增 targetParentId 可选参数 | `POST /file/extract` |
| `api/file/tag.ts` | 新增 | `POST /file/auto-tag`、`GET /file/{id}/tags`、`POST /file/{id}/tags`、`DELETE /file/tags/{id}` |
| `views/list-page/vault/index.vue` | 三态改造（loading/setup/unlock/unlocked） | status 探测 + setup 自动解锁 + lock 调后端 |
| `composables/useFileTags.ts` | 双引擎：DeepSeek 优先，降级后端规则打标 | `POST /file/auto-tag` |
| `components/file-table/index.vue` | 打标失败提示文案调整 | — |

#### 待办（非阻塞）

- **P3-1 视频关键帧**：后端 `VideoThumbnailController` 仅为骨架（始终返回 `generated=false`），前端继续用 canvas 采样。后续可接入 FFmpeg/JCodec 生成 sprite 图后启用。
- **保险箱移入入口**：当前 `vault/index.vue` 仅支持查看/移出/删除，"移入保险箱"操作需在文件右键菜单接入 `vaultService.move(fileIds)`（fileIds 为逗号分隔串）。
- **标签管理 UI**：`api/file/tag.ts` 已封装 list/addTag/removeTag，但前端尚未提供标签管理面板，可在文件详情侧栏接入。

### BE-07 · P2 阶段前端已实现（无后端依赖）

以下 P2 任务已由前端独立完成，无需后端改动：

| 任务 | 实现方式 | 备注 |
|---|---|---|
| P2-8 类型筛选 query 模式 | 路由 `/files?type=xxx` + watch 保留 parentId | 切类型不丢目录上下文 |
| P2-5 PDF 工具（旋转/提取页面） | `pdf-lib` 纯前端处理 | 依赖预览 URL 可直接 fetch（见 BE-07a） |
| P2-10 空态/加载态品牌化 | `BaseEmpty` 组件 + BaseTable empty 插槽 | 列表/网格双视图品牌插画 |

#### BE-07a · PDF 工具 fetch 预览 URL 鉴权

- **场景**：`pdf-lib` 需 `fetch(previewUrl).arrayBuffer()` 加载 PDF 原始字节
- **现状**：`getPreviewUrl` 返回的 URL 由 `panUtil.getPreviewUrl` 构造，`usePdfSearch` 已用 `pdfjs.getDocument({ url })` 直接加载（说明 URL 可直接访问）
- **风险**：若后端对预览 URL 加鉴权（如 cookie/token 校验），`fetch` 可能 401
- **建议**：后端确认 `/file/preview` 返回的 URL 是否免鉴权；若需鉴权，前端改用 `getDownloadUrl`（带 authorization 参数）fetch

### BE-04 · 搜索能力不足

- **现状**：`/file/search` 仅支持文件名 + 扩展名 + 日期范围过滤
- **P1-5 需求**：语义搜索（"上周的图片""大于100MB"等自然语言解析）
- **建议**：后端接 Elasticsearch 或 Meilisearch 做全文检索 + NLP 解析

### BE-05 · 用户信息字段缺失

- **现状**：UserInfoVO 未暴露 `usedSpace` / `totalSpace` 字段（前端靠上传估算）
- **建议**：用户信息接口补充空间配额字段

### BE-06 · AI 助手文件摘要能力受限（P1-10）

- **现状**：AI 助手已接入 DeepSeek（前端直连），支持自然语言搜索/重命名建议/闲聊
- **瓶颈**：文件摘要能力仅能基于文件名分析，无法读取文件内容
- **所需接口**：`GET /file/{fileId}/text-extract` 返回纯文本（PDF/DOCX/TXT 等）
- **建议**：后端集成 Apache Tika 或 pdf.js 做服务端文本提取，供 AI 摘要调用

## 前端临时规避

- 测试数据：用已有账号（如 `xiaoye`）测试，或等待后端修复 BE-01
- AI 助手：当前为模拟响应，接入真实 LLM 需后端提供 `/api/ai/chat` 代理
- 搜索增强：前端用 Fuse.js 做本地模糊匹配（已用文件名），但无法替代后端全文检索

---

> 更新时间：2026-08-12
> 关联文档：[product-optimization-plan.md](./product-optimization-plan.md) Step 7
