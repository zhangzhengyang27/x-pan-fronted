/**
 * 文件标签 API（P3-2）
 *
 * 对接后端 FileTagController：
 * - POST   /file/auto-tag          → 自动打标（基于后端规则匹配，body: { fileId }）
 * - GET    /file/{fileId}/tags     → 查询文件标签列表
 * - POST   /file/{fileId}/tags     → 手动添加标签（body: { tagName }）
 * - DELETE /file/tags/{tagId}      → 删除标签
 *
 * 用途：当用户未配置 DeepSeek API Key 时，useFileTags 降级调用本模块的 autoTag，
 * 由后端规则匹配生成标签并持久化到 x_pan_file_tag 表。
 */
'use strict'

import http, { type ApiResponse } from '@/utils/http'

type Callback<T> = (res: ApiResponse<T>) => void

export interface FileTagItem {
  id: string
  fileId: string
  tagName: string
  /** 标签来源 0 自动 1 手动 */
  tagSource: number
  createTime: string
}

const fileTagService = {
  /** 自动打标（基于后端规则匹配） */
  autoTag(fileId: string, resolve: Callback<FileTagItem[]>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<FileTagItem[]>>('/file/auto-tag', { fileId })
      .then(resolve)
      .catch(reject)
  },

  /** 查询文件标签列表 */
  list(fileId: string, resolve: Callback<FileTagItem[]>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<FileTagItem[]>>(`/file/${fileId}/tags`)
      .then(resolve)
      .catch(reject)
  },

  /** 手动添加标签 */
  addTag(
    fileId: string,
    tagName: string,
    resolve: Callback<FileTagItem>,
    reject: Callback<unknown>
  ) {
    http
      .post<unknown, ApiResponse<FileTagItem>>(`/file/${fileId}/tags`, { tagName })
      .then(resolve)
      .catch(reject)
  },

  /** 删除标签 */
  removeTag(tagId: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .delete<unknown, ApiResponse<unknown>>(`/file/tags/${tagId}`)
      .then(resolve)
      .catch(reject)
  }
}

export default fileTagService
