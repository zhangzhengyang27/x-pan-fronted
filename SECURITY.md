# 安全策略

## 报告漏洞

请**不要**通过公开 Issue 报告安全问题。

请使用 GitHub 仓库的 **Security → Advisories → Report a vulnerability** 私密报告，并提供影响范围、复现步骤与潜在影响。

## 安全基线

- 登录凭证通过 HttpOnly Cookie 传递，禁止写入 localStorage
- 所有请求携带 CSRF Token，状态变更接口必须校验
- 提交前执行 `gitleaks protect --staged`，CI 强制执行 Secret Scan
- 生产环境必须启用 HTTPS，并配置 CSP / HSTS 安全头
- 依赖漏洞由 Dependabot 与 `npm audit` 持续扫描
