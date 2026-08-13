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

  /** 轮询预览直链（taskId 为加密任务ID） */
  url(taskId: string, resolve: Callback<IPreviewUrlVO>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<IPreviewUrlVO>>(`/preview/url/${encodeURIComponent(taskId)}`)
      .then(resolve)
      .catch(reject)
  }
}

export default previewService
