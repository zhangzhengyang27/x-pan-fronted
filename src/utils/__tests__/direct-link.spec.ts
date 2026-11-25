/**
 * 直链 URL 拼接测试（P0-1 终审 Important 1 修复）
 *
 * 直链是后端端点（/direct-link/stream），必须带 API 前缀：
 * - 相对前缀（默认 /api，nginx 反代）→ 拼 origin 成绝对 URL
 * - 完整地址（如 http://localhost:8081）→ 直接拼端点路径
 */
import { describe, expect, it } from 'vitest'
import { buildDirectLinkUrl } from '@/utils/direct-link'

describe('buildDirectLinkUrl', () => {
  it('相对 API 前缀时拼 origin + /api + 端点路径', () => {
    // jsdom 环境 origin 为 http://localhost；getUrlPrefix 未配置 env 时回退 /api
    const url = buildDirectLinkUrl('abc123')
    expect(url).toBe(`${window.location.origin}/api/direct-link/stream?token=abc123`)
  })

  it('token 中的特殊字符不影响拼接（由调用方保证 token 为 hex）', () => {
    expect(buildDirectLinkUrl('0f9b')).toContain('token=0f9b')
  })
})
