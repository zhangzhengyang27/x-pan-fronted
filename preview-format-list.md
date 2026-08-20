# 预览格式补充清单（当前 unsupported，网盘高频）

> 对照 `src/utils/preview.ts` 的 `resolvePreviewKind` 现有覆盖，梳理出「当前 unsupported、但网盘用户高频」的格式，按 P0/P1/P2 分级。
> 已按需求剔除：邮件（eml/msg）、P2 长尾/重格式（CAD/3D/OFD/GIS）。

## 现有已覆盖格式（基线）

| 类别 | 扩展名 | kind |
| --- | --- | --- |
| 图片 | jpg/jpeg/png/gif/webp/bmp/svg/ico/heic/avif | image |
| 视频 | mp4/webm/mov/mkv/avi/wmv/flv/ogv | video |
| 音频 | mp3/wav/ogg/aac/flac/m4a/wma | audio |
| PDF | pdf | pdf |
| Office | doc/docx（docx）、xls/xlsx（excel）、ppt/pptx（pptx） | office 细分 |
| Markdown | md | markdown |
| 代码/文本 | js/ts/tsx/jsx/vue/html/css/scss/less/json/java/py/go/c/cpp/h/sh/yml/yaml/xml/txt/log/sql | code/text |

---

## P0 —— 高优先级（网盘高频 + 后端已具备基础能力，落地成本最低）

### 1. CSV（逗号分隔表格）

| 项 | 值 |
| --- | --- |
| 扩展名 | `csv` |
| 后端 FileType | **CSV(12)** —— 后端类型枚举已定义，说明是后端已知类型 |
| 当前状态 | `resolvePreviewKind` 未识别，落到 `unsupported` |
| 渲染策略 | **纯前端解析为表格**（复用现有文本链路 + 轻量 CSV 解析），或最低成本方案：把 `csv` 加进 `CODE_EXTS` 复用 `CodePreviewer` 纯文本展示 |
| 优先级理由 | 后端已有 CSV(12) 类型码；表格数据在网盘场景高频（导出的报表、通讯录、日志统计）；纯前端解析零后端改动，成本极低 |

**落地建议**：优先做「表格化渲染」（新的 `CsvPreviewer` 组件，用简单 CSV 解析器 + 表格），体验远超纯文本；若人力有限，先加进 `CODE_EXTS` 走 `CodePreviewer` 兜底。

### 2. 压缩包 ZIP

| 项 | 值 |
| --- | --- |
| 扩展名 | `zip` |
| 后端 FileType | **ARCHIVE(2)** |
| 当前状态 | `resolvePreviewKind` 未识别；但 `common.ts` 的 `ARCHIVE_EXTS` 已含 `.zip`，右键菜单/详情面板已能识别「是压缩包」 |
| 渲染策略 | **复用后端在线解压能力**，不做「预览压缩包内容」——后端 P3-3 已有 `/file/extract` 异步解压接口（仅 ZIP），解压后直接入库到目标目录 |
| 优先级理由 | 网盘高频；后端解压链路已就绪；前端只需把「ZIP 预览」映射为「引导在线解压」的交互（而非打开空白预览器） |

**落地建议**：压缩包不是「可渲染文件」，而是「可解压文件」。方案是新增一个 `ArchivePreviewer`（或直接复用现有右键「在线解压」入口），双击/预览 ZIP 时展示「文件清单占位 + 在线解压按钮」，点击走现有 `extractService.extract` + 进度轮询。

---

## P1 —— 中优先级（网盘常见，但需额外解析能力或后端扩展）

### 3. 压缩包 RAR / 7Z / TAR / GZ / BZ2

| 项 | 值 |
| --- | --- |
| 扩展名 | `rar` / `7z` / `tar` / `gz` / `bz2` |
| 后端 FileType | **ARCHIVE(2)** |
| 当前状态 | `ARCHIVE_EXTS` 已识别展示，但后端在线解压**仅支持 ZIP**，这些格式无法解压 |
| 渲染策略 | 需后端扩展解压能力（当前不支持），或纯前端解析（rar/7z 需 `libarchive` WASM，成本高；tar/gz/bz2 可用轻量 JS 库） |
| 优先级理由 | 网盘常见，但后端暂不支持解压，需后端配合或引入 WASM，成本高于 P0 |

**落地建议**：`tar`/`gz` 可考虑纯前端 JS 库（体积小），`rar`/`7z` 建议推动后端扩展解压格式（收益最大）。前端判定层面可先识别为「压缩包」（与 ZIP 同走 ArchivePreviewer），渲染时提示「暂不支持解压该格式」。

### 4. 思维导图 XMind

| 项 | 值 |
| --- | --- |
| 扩展名 | `xmind` |
| 后端 FileType | NORMAL(1) |
| 当前状态 | `unsupported` |
| 渲染策略 | 纯前端解析（xmind 本质是 zip 结构，内部 `content.json` 存储节点树，用 JSZip 解析后渲染成树形图） |
| 优先级理由 | 知识管理场景常见；纯前端可行；但受众相对垂直 |

---

## 明确不纳入（本次需求剔除）

- **邮件（eml/msg）**：归档场景频率低，且 msg 是 OLE 私有格式解析成本高。
- **P2 长尾/重格式**：CAD（dxf/dwg）、3D（gltf/glb/obj/stl）、国产版式 OFD、GIS（geojson/kml）——需 WASM/WebGL/服务端转换，受众小，本次不纳入。

> 补充说明：若未来想低成本覆盖 GIS 文本类（geojson 本质 JSON、kml 本质 XML），只需把扩展名加进 `CODE_EXTS` 即可复用现有 `CodePreviewer`，无需新插件。但本次按需求不纳入正式清单。

---

## 优先级总览

| 优先级 | 格式 | 后端 FileType | 渲染策略 | 关键依赖 |
| --- | --- | --- | --- | --- |
| P0 | CSV | CSV(12) | 纯前端表格渲染 | 无（零后端改动） |
| P0 | ZIP | ARCHIVE(2) | 引导在线解压（后端已有能力） | 复用 `/file/extract` |
| P1 | rar/7z/tar/gz/bz2 | ARCHIVE(2) | 后端扩展解压 或 前端 WASM | 后端扩展 |
| P1 | xmind | NORMAL(1) | 纯前端 JSZip 解析 | 引入 JSZip |

## 落地顺序建议

1. **先 P0**：CSV 表格渲染 + ZIP 解压引导，两个都能在纯前端 + 复用现有后端能力的前提下完成，性价比最高。
2. **后 P1**：xmind 可独立做（纯前端）；rar/7z 依赖后端扩展解压格式，需与后端协同排期。
3. 所有新格式都通过「插件化注册表」注册（见《预览体系插件化重构方案》），不侵入现有 if/else 判定。
