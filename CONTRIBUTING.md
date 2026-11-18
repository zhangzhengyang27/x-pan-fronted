# 贡献指南

## 分支模型

- `main`：受保护分支，只接受 PR 合并
- `feat/*`、`fix/*`、`chore/*`：功能 / 修复 / 杂项分支
- 合并前必须通过 Required Checks，至少 1 名 Owner 评审

## 提交规范

使用 Conventional Commits：

```
feat(scope): 新功能
fix(scope): 缺陷修复
refactor(scope): 重构
perf(scope): 性能优化
test(scope): 测试
ci(scope): 流水线
docs(scope): 文档
chore(deps): 依赖
```

## 本地开发

```bash
# 安装提交前密钥扫描
brew install gitleaks
git config core.hooksPath .githooks

npm ci
npm run dev
npm run lint
npx vue-tsc -p tsconfig.app.json --noEmit
npm run build
```

## 代码约定

- 全部使用 TypeScript，路径别名 `@/` → `src/`
- 组件使用 `<script setup lang="ts">`
- 跨页面状态用 Pinia，单页面用 `ref`
- 列表写入统一走带 `requestSeq` 的 store 方法，避免过期响应覆盖
- 样式使用 `src/styles/tokens.css` 语义令牌，CSS 变量必须完整写 `var(--color-xxx)`
- `ElMessageBox.confirm` 返回 `Promise<boolean>`，取消不 reject
