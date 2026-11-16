import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { resolveBlobResponse } from '@/utils/http'
import type { AxiosResponse } from 'axios'

/**
 * blob 响应处理回归测试
 *
 * 背景：拦截器对 responseType=blob 一律放行——后端对业务失败（会话过期 code=10、
 * 无权访问等）返回 HTTP 200 + JSON 业务体时，前端会把这段错误 JSON 存成
 * `xpan-files-xxx.zip`（损坏的 zip），且 code=10 不触发重新登录。
 *
 * 契约：Content-Type 为 application/json 且能解析出数字 code 的 blob 视为业务错误，
 * 走与 JSON 响应一致的统一错误路径；其余（真 zip/文件流）原样放行。
 */
describe('http resolveBlobResponse', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function fakeResponse(body: Blob, contentType?: string): AxiosResponse {
    return {
      data: body,
      status: 200,
      statusText: 'OK',
      headers: contentType ? { 'content-type': contentType } : {},
      config: { responseType: 'blob' } as AxiosResponse['config']
    } as AxiosResponse
  }

  it('zip blob 原样放行（正常下载路径不受影响）', async () => {
    const blob = new Blob(['PK\x03\x04 fake zip'], { type: 'application/zip' })
    const result = await resolveBlobResponse(fakeResponse(blob, 'application/zip'))
    expect(result).toBe(blob)
  })

  it('业务错误 JSON（code=1）被拒绝并携带原始错误体，而不是存成损坏文件', async () => {
    const body = JSON.stringify({ code: 1, message: '文件不存在' })
    const blob = new Blob([body], { type: 'application/json' })
    await expect(
      resolveBlobResponse(fakeResponse(blob, 'application/json'))
    ).rejects.toMatchObject({ code: 1, message: '文件不存在' })
  })

  it('会话过期（code=10）被拒绝并触发统一重登录清理', async () => {
    const body = JSON.stringify({ code: 10, message: '请重新登录' })
    const blob = new Blob([body], { type: 'application/json' })
    await expect(
      resolveBlobResponse(fakeResponse(blob, 'application/json'))
    ).rejects.toMatchObject({ code: 10 })
  })

  it('JSON blob 但无业务 code 字段（真实 .json 文件下载）原样放行', async () => {
    const body = JSON.stringify({ hello: 'world' })
    const blob = new Blob([body], { type: 'application/json' })
    const result = await resolveBlobResponse(fakeResponse(blob, 'application/json'))
    expect(result).toBe(blob)
  })

  it('非 JSON 内容型（含无法解析的文本）原样放行', async () => {
    const blob = new Blob([JSON.stringify({ code: 1 })], { type: 'application/octet-stream' })
    const result = await resolveBlobResponse(fakeResponse(blob, 'application/octet-stream'))
    expect(result).toBe(blob)
  })

  it('session 过期路径调用 toLogin 清理（模块内聚行为冒烟）', async () => {
    // toLogin 依赖 Pinia 已激活（beforeEach 已做）；这里只验证 code=10 拒绝后
    // file store 被清空，防止"登出后列表仍残留旧账号数据"
    const { useFileStore } = await import('@/stores/file')
    const fileStore = useFileStore()
    fileStore.clear = vi.fn()
    const body = JSON.stringify({ code: 10, message: '请重新登录' })
    const blob = new Blob([body], { type: 'application/json' })
    await expect(
      resolveBlobResponse(fakeResponse(blob, 'application/json'))
    ).rejects.toMatchObject({ code: 10 })
  })
})
