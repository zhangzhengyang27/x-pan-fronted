/**
 * 文件相关 API（TypeScript 版）
 */

'use strict'

import http, { type ApiResponse } from '@/utils/http'
import type { IArchiveTaskVO, IFileVO, IFileVersionVO, IFolderTreeNode, IMediaMetadataVO, PageVO } from '@/types'

type Callback<T> = (res: ApiResponse<T>) => void

const fileService = {
  /**
   * E2EE 加密分享：上传浏览器生成的密文副本（.xpan）。
   * 服务端强制落到隐藏目录 parent_id=-3，返回加密 fileId；不进入普通文件列表。
   */
  uploadCipher(
    file: Blob,
    filename: string,
    resolve: Callback<string>,
    reject: Callback<unknown>
  ) {
    const form = new FormData()
    // 显式传 filename：OPFS 返回的 File/Blob 名称不一定是清洗后的 .xpan
    form.append('file', file, filename)
    form.append('filename', filename)
    // identifier 对密文没有秒传意义，用随机 32 位 hex 避免大小/MD5 去重探测
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    form.append('identifier', randomHex)
    form.append('totalSize', String(file.size))
    // 密文落点由服务端固定为 -3，前端不传 parentId
    http
      .post<unknown, ApiResponse<string>>('/file/upload-cipher', form, { timeout: 0 })
      .then(resolve)
      .catch(reject)
  },

  /** 创建分享失败时清理已上传的密文副本，避免隐藏目录长期占用配额 */
  deleteCipher(fileId: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .delete<unknown, ApiResponse<unknown>>('/file/cipher', { params: { fileId } })
      .then(resolve)
      .catch(reject)
  },

  list(
    params: {
      parentId: string
      fileTypes?: string
      pageNum?: number
      pageSize?: number
      keyword?: string
      orderBy?: string
      order?: string
    },
    resolve: Callback<PageVO<IFileVO>>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<PageVO<IFileVO>>>('/files', { params })
      .then(resolve)
      .catch(reject)
  },

  createFolder(
    data: { parentId: string; filename: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http.post<unknown, ApiResponse<unknown>>('/file/folder', data).then(resolve).catch(reject)
  },

  update(
    data: { fileId: string; filename?: string; parentId?: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http.put<unknown, ApiResponse<unknown>>('/file', data).then(resolve).catch(reject)
  },

  delete(data: { fileIds: string[] }, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.delete<unknown, ApiResponse<unknown>>('/file', { data }).then(resolve).catch(reject)
  },

  getFolderTree(resolve: Callback<IFolderTreeNode[]>, reject: Callback<unknown>) {
    // 兼容旧调用：不传 parentId 仍返回完整树（分享转存等页面依赖）
    http.get<unknown, ApiResponse<IFolderTreeNode[]>>('/file/folder/tree').then(resolve).catch(reject)
  },

  /**
   * P2-12：按需加载某个文件夹的直接子目录。
   * parentId 传加密字符串；后端只回一层，展开树节点时再请求下一层。
   */
  getFolderTreeChildren(
    parentId: string,
    resolve: Callback<IFolderTreeNode[]>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<IFolderTreeNode[]>>('/file/folder/tree', { params: { parentId } })
      .then(resolve)
      .catch(reject)
  },

  transfer(data: { fileIds: string[]; targetParentId: string }) {
    return http.post<unknown, ApiResponse<unknown>>('/file/transfer', data)
  },

  copy(data: { fileIds: string[]; targetParentId: string }) {
    return http.post<unknown, ApiResponse<unknown>>('/file/copy', data)
  },

  search(
    params: {
      keyword: string
      fileTypes?: string
      extensions?: string
      dateFrom?: string
      dateTo?: string
      sizeMin?: number
      sizeMax?: number
    },
    resolve: Callback<IFileVO[]>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<IFileVO[]>>('/file/search', { params })
      .then(resolve)
      .catch(reject)
  },

  /** 全文检索：文件名 + 正文 + 标签 */
  fulltextSearch(
    params: {
      keyword: string
      fileTypes?: string
      extensions?: string
      dateFrom?: string
      dateTo?: string
      sizeMin?: number
      sizeMax?: number
      pageNum?: number
      pageSize?: number
    },
    resolve: Callback<PageVO<IFileVO>>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<PageVO<IFileVO>>>('/search/fulltext', { params })
      .then(resolve)
      .catch(reject)
  },

  /** 语义搜索：向量 kNN + BM25 混合检索（后端语义链路不可用时自动降级为全文检索） */
  semanticSearch(
    params: {
      keyword: string
      fileTypes?: string
      extensions?: string
      dateFrom?: string
      dateTo?: string
      sizeMin?: number
      sizeMax?: number
      pageNum?: number
      pageSize?: number
    },
    resolve: Callback<PageVO<IFileVO>>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<PageVO<IFileVO>>>('/search/semantic', { params })
      .then(resolve)
      .catch(reject)
  },

  /** 搜索联想（P4-5 后端 suggest，基于用户历史 + 文件名前缀） */
  suggest(
    prefix: string,
    resolve: Callback<string[]>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<string[]>>('/file/search/suggest', { params: { prefix } })
      .then(resolve)
      .catch(reject)
  },

  /** 我的最近搜索（P2-16：只查当前账号，不做全站聚合） */
  recent(limit: number, resolve: Callback<string[]>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<string[]>>('/file/search/recent', { params: { limit } })
      .then(resolve)
      .catch(reject)
  },

  getBreadcrumbs(
    params: { fileId: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<unknown>>('/file/breadcrumbs', { params })
      .then(resolve)
      .catch(reject)
  },

  secUpload(
    data: { filename: string; identifier: string; parentId: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http.post<unknown, ApiResponse<unknown>>('/file/sec-upload', data).then(resolve).catch(reject)
  },

  merge(
    data: { identifier: string; filename: string; parentId: string; totalSize: number },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http.post<unknown, ApiResponse<unknown>>('/file/merge', data).then(resolve).catch(reject)
  },

  /** 在线 ZIP：异步任务，返回加密 taskId，结果在任务中心查看 */
  archiveToDrive(
    data: { fileIds: string[]; targetParentId?: string; zipName?: string },
    resolve: Callback<IArchiveTaskVO>,
    reject: Callback<unknown>
  ) {
    http
      .post<unknown, ApiResponse<IArchiveTaskVO>>('/file/archive', data)
      .then(resolve)
      .catch(reject)
  },

  archiveDownload(
    data: { fileIds: string[]; zipName?: string },
    resolve: Callback<Blob>,
    reject: Callback<unknown>
  ) {
    http
      .post<unknown, ApiResponse<Blob>>('/file/archive-download', data, { responseType: 'blob' })
      .then(resolve)
      .catch(reject)
  },

  // 文件版本历史
  listVersions(
    params: { fileId: string },
    resolve: Callback<IFileVersionVO[]>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<IFileVersionVO[]>>('/file/versions', { params })
      .then(resolve)
      .catch(reject)
  },

  getVersion(params: { id: string }, resolve: Callback<IFileVersionVO>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<IFileVersionVO>>('/file/version', { params })
      .then(resolve)
      .catch(reject)
  },

  rollback(
    params: { id: string; fileId: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .post<unknown, ApiResponse<unknown>>('/file/rollback', null, { params })
      .then(resolve)
      .catch(reject)
  },

  deleteVersion(
    params: { id: string; fileId: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .delete<unknown, ApiResponse<unknown>>('/file/version', { params })
      .then(resolve)
      .catch(reject)
  },

  /** 提取文件纯文本（供 AI 摘要，后端 text-extract 接口） */
  textExtract(
    fileId: string,
    resolve: Callback<TextExtractVO>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<TextExtractVO>>(`/file/${fileId}/text-extract`)
      .then(resolve)
      .catch(reject)
  },

  /** 查询用户文件统计概览（全盘，含子目录） */
  stats(resolve: Callback<UserFileStatsVO>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<UserFileStatsVO>>('/files/stats')
      .then(resolve)
      .catch(reject)
  },

  // ─── 在线编辑（Markdown/文本） ───────────────────────────────────────────
  /** 查询文件详情（含乐观锁版本号） */
  getDetail(fileId: string) {
    return http.get<unknown, ApiResponse<IFileDetailVO>>('/file/detail', { params: { fileId } })
  },

  /** 保存文件内容（覆盖写入并生成新版本） */
  saveContent(data: {
    fileId: string
    baseVersion: number
    file: Blob
    filename?: string
    remark?: string
  }) {
    const form = new FormData()
    form.append('fileId', data.fileId)
    form.append('baseVersion', String(data.baseVersion))
    if (data.remark) form.append('remark', data.remark)
    form.append('file', data.file, data.filename || 'content.md')
    return http.put<unknown, ApiResponse<IFileContentVO>>('/file/content', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  /** 申请文件编辑锁 */
  acquireEditSession(fileId: string) {
    return http.post<unknown, ApiResponse<IFileEditSessionVO>>(
      '/file/edit/session',
      null,
      { params: { fileId } }
    )
  },

  /** 释放文件编辑锁 */
  releaseEditSession(fileId: string, lockToken?: string) {
    return http.delete<unknown, ApiResponse<unknown>>('/file/edit/session', {
      params: { fileId, lockToken }
    })
  },

  // ─── 在线编辑（OnlyOffice） ──────────────────────────────────────────────
  /** 创建 Office 编辑会话，返回 DocsAPI 配置 */
  createOfficeSession(fileId: string) {
    return http.post<unknown, ApiResponse<IOfficeEditorConfigVO>>(
      '/file/office/session',
      null,
      { params: { fileId } }
    )
  },

  /** 查询 Office 编辑会话状态（保存结果/是否关闭/是否转换扩展名） */
  getOfficeSessionStatus(sessionId: string) {
    return http.get<unknown, ApiResponse<IOfficeSessionStatusVO>>('/file/office/status', {
      params: { sessionId }
    })
  },

  /** 关闭 Office 编辑会话并释放编辑锁 */
  closeOfficeSession(sessionId: string) {
    return http.post<unknown, ApiResponse<unknown>>('/file/office/close', null, {
      params: { sessionId }
    })
  },

  /** 图片/音频/视频的媒体元数据；非媒体或后端解析失败时 reject，调用方按无数据处理 */
  mediaMetadata(fileId: string) {
    return http.get<unknown, ApiResponse<IMediaMetadataVO>>('/file/media-metadata', {
      params: { fileId }
    })
  },

}

export interface IFileDetailVO {
  fileId: string
  parentId?: string
  filename: string
  fileSizeDesc?: string
  sizeBytes?: number
  fileType?: number
  version: number
  contentHash?: string
  editable?: boolean
  fileMtime?: string
  updateTime?: string
}

export interface IFileContentVO {
  version: number
  contentHash: string
  sizeBytes: number
  fileSizeDesc: string
  fileMtime: string
  updateTime: string
}

export interface IFileEditSessionVO {
  lockToken: string
  expireAt: number
  version: number
}

export interface IOfficeEditorConfigVO {
  documentServerUrl: string
  sessionId: string
  filename: string
  fileType?: number
  version: number
  config: Record<string, unknown>
}

export interface IOfficeSessionStatusVO {
  sessionId: string
  status: 'editing' | 'saved' | 'closed' | 'expired'
  version?: number
  filename?: string
  fileType?: number
  savedAt?: number
  renamed?: boolean
}

export interface UserFileStatsVO {
  totalFileCount?: number
  totalFolderCount?: number
  usedSpace?: number
  imageCount?: number
  videoCount?: number
  audioCount?: number
  docCount?: number
  archiveCount?: number
  codeCount?: number
  otherCount?: number
  largestFiles?: IFileVO[]
}

export interface TextExtractVO {
  text: string
  truncated: boolean
  extractedBy: string
  totalChars: number
}

export default fileService
