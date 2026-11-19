/**
 * 文档在线预览 API —— 对接后端 P4 PreviewController（异步任务模型）
 * - POST /preview/office/{fileId}?targetType=pdf  创建/获取预览任务
 * - GET  /preview/url/{taskId}                    轮询拿预览直链（完成后有值）
 *
 * taskId 为后端加密字符串。status: 0 待处理 1 转换中 2 完成 3 失败。
 * previewUrl 为实时生成的预签名直链（浏览器可直访）。
 */
'use strict'

import http, { type ApiResponse } from '@/utils/http'
import panUtil from '@/utils/common'

type Callback<T> = (res: ApiResponse<T>) => void

export interface IPreviewTaskVO {
  taskId: string
  status: number
  previewUrl: string
  errorMsg: string
  createTime: string
}

export interface IPreviewUrlVO {
  previewUrl: string
  status: number
}

const previewService = {
  /** 创建 / 获取文档预览任务（fileId 为加密文件ID） */
  office(
    fileId: string,
    resolve: Callback<IPreviewTaskVO>,
    reject: Callback<unknown>,
    targetType = 'pdf'
  ) {
    http
      .post<unknown, ApiResponse<IPreviewTaskVO>>(
        `/preview/office/${encodeURIComponent(fileId)}`,
        null,
        { params: { targetType } }
      )
      .then(resolve)
      .catch(reject)
  },

  /** 创建 / 获取视频 HLS 转码任务（手动触发，360p+720p） */
  async hls(fileId: string): Promise<IPreviewTaskVO> {
    const res = await http.post<unknown, ApiResponse<IPreviewTaskVO>>(
      `/preview/hls/${encodeURIComponent(fileId)}`
    )
    return res.data
  },

  /** 轮询预览直链（taskId 为加密任务ID） */
  url(taskId: string, resolve: Callback<IPreviewUrlVO>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<IPreviewUrlVO>>(`/preview/url/${encodeURIComponent(taskId)}`)
      .then(resolve)
      .catch(reject)
  },

  /**
   * 视频旁挂字幕（同目录同名 .srt/.vtt，后端统一转 VTT）。
   *
   * 返回 null 表示没有字幕，属于正常降级；用原生 fetch 是因为响应是
   * text/vtt 而不是项目统一的 ApiResponse JSON，不能复用 http 拦截器。
   * 仍带 credentials 与空间头，保证个人空间/团队空间归属校验都成立。
   */
  async videoSubtitle(fileId: string): Promise<string | null> {
    const headers: Record<string, string> = {}
    try {
      const spaceId = localStorage.getItem('xpan_space_id')
      if (spaceId) headers['X-Space-Id'] = spaceId
    } catch {
      /* 隐私模式：按个人空间处理 */
    }
    try {
      const response = await fetch(
        `${panUtil.getUrlPrefix()}/preview/subtitle/${encodeURIComponent(fileId)}`,
        { credentials: 'include', headers, cache: 'no-store' }
      )
      if (!response.ok) return null
      const text = await response.text()
      return text && text.trim() ? text : null
    } catch {
      // 字幕是增强项，网络失败不能阻断视频播放
      return null
    }
  }
}

export default previewService
