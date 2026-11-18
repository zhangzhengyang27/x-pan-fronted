/**
 * 直链 URL 拼接（P0-1 终审修复）
 *
 * 直链是后端端点（/direct-link/stream），必须带 API 前缀（panUtil.getUrlPrefix），
 * 不能直接拼 window.location.origin + 端点路径——默认部署（nginx 只反代 /api/）
 * 与 dev 代理下那样拼出的直链 404。规则：
 * - 相对前缀（如 /api）→ 拼上 window.location.origin 成绝对 URL（可脱离前端站点使用）
 * - 完整地址（如 http://localhost:8081）→ 直接拼端点路径
 */
import panUtil from '@/utils/common'

export function buildDirectLinkUrl(token: string): string {
  const prefix = panUtil.getUrlPrefix()
  if (prefix.startsWith('http')) {
    return `${prefix}/direct-link/stream?token=${token}`
  }
  return `${window.location.origin}${prefix}/direct-link/stream?token=${token}`
}
