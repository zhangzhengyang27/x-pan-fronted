/**
 * X-Pan 业务类型定义（P4：前端 TS 化）
 *
 * 命名规范：
 *   Ixxx  → 接口/请求
 *   Txxx  → 类型别名
 *   Exxx  → 枚举
 */

// ─── 通用响应结构 ──────────────────────────────────────────────
/** 后端统一响应 R<T> */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

/** 后端分页结构 PageVO<T> */
export interface PageVO<T = unknown> {
  total: number
  totalPages?: number
  pageSize: number
  pageNum: number
  records: T[]
  /** 部分后端会附带 */
  hasMore?: boolean
}

// ─── 用户 ───────────────────────────────────────────────────────
export interface IUserInfo {
  userId: string
  username: string
  rootFileId: string
  avatar?: string
  email?: string
}

export interface ILoginReq {
  username: string
  password: string
}

export interface IRegisterReq {
  username: string
  password: string
  email?: string
  answer?: string
}

// ─── 文件 ───────────────────────────────────────────────────────
export enum FileType {
  FOLDER = 1,
  IMAGE = 2,
  VIDEO = 3,
  AUDIO = 4,
  DOC = 5,
  OTHER = 6
}

export interface IFileVO {
  fileId: string
  parentId: string
  filename: string
  fileSize: string | number
  fileType: FileType
  fileCover?: string
  folderFlag: 0 | 1
  createTime: string
  updateTime: string
  realPath?: string
  identifier?: string
}

export interface IUploadChunkReq {
  identifier: string
  chunkNumber: number
  totalChunks: number
  filename: string
  totalSize: number
  currentChunkSize: number
  file: File | Blob
}

export interface IUploaderOption {
  target: string
  chunkSize: number
  testChunks: boolean
  simultaneousUploads: number
  maxChunkRetries: number
  chunkRetryInterval: number
  headers: Record<string, string>
  query: (file: File, chunk: unknown) => Record<string, string>
  successStatuses: number[]
  failedStatuses: number[]
  permanentErrors: number[]
}

export interface IFileSearchReq {
  keyword: string
  parentId?: string
  fileTypes?: FileType[]
  pageNum?: number
  pageSize?: number
  extensions?: string[]
  minSize?: number
  maxSize?: number
  startDate?: string
  endDate?: string
}

// ─── 分享 ───────────────────────────────────────────────────────
export interface IShareCreateReq {
  fileIds: string[]
  shareType: number  // 1=公开 2=需要提取码 3=指定用户
  shareCode?: string
  expireHours?: number
  downloadLimit?: number
}

export interface IShareVO {
  shareId: string
  shareCode: string
  shareUrl: string
  shareType: number
  downloadCount: number
  downloadLimit?: number
  expireAt?: string
  createTime: string
  fileList?: IFileVO[]
  fileId?: string
  fileName?: string
  filename?: string
  _statusText?: string
}

export interface IShareStatsVO {
  total: number
  active: number
  totalDownloads: number
  totalRemainingQuota: number
}

// ─── 回收站 ─────────────────────────────────────────────────────
export interface IRecycleItemVO extends IFileVO {
  deleteTime: string
}

// ─── 离线下载 ──────────────────────────────────────────────────
/** 后端 status: 0=待开始 1=下载中 2=已完成 3=失败 4=已取消 */
export type OfflineTaskStatusCode = 0 | 1 | 2 | 3 | 4

export interface IOfflineTaskVO {
  id: string
  taskId?: string  // 兼容字段
  url: string
  filename: string
  totalSize: number
  downloadedSize: number
  progress: number
  status: OfflineTaskStatusCode
  statusText?: string
  errorMsg?: string
  errorMessage?: string  // 兼容字段
  fileId?: string
  createTime: string
  finishTime?: string
}

export interface IOfflineCreateReq {
  url: string
  targetFolderId?: string
}

// ─── 文件版本 ───────────────────────────────────────────────────
export type VersionOperation = 'UPLOAD' | 'ROLLBACK' | 'UPDATE' | 'DELETE'

export interface IFileVersionVO {
  id: string
  fileId: string
  versionNumber: number
  filename: string
  fileSize: string | number
  realPath: string
  identifier: string
  operation: VersionOperation
  operatorId: string
  operatorName?: string
  comment?: string
  current: boolean
  createTime: string
}

// ─── 通用筛选/排序 ─────────────────────────────────────────────
export type SortField = 'filename' | 'fileSize' | 'createTime' | 'updateTime'
export type SortOrder = 'asc' | 'desc'

export interface ISortConfig {
  field: SortField
  order: SortOrder
}

// ─── 通用分页参数 ──────────────────────────────────────────────
export interface IPageParam {
  pageNum?: number
  pageSize?: number
}

// ─── 自定义事件总线（替代 mitt） ───────────────────────────────
export interface AppEvents {
  'xpan:open-mobile-nav': void
  'xpan:close-mobile-nav': void
  'xpan:reload-files': void
  'xpan:open-share': { fileIds: string[] }
  'xpan:open-folder-picker': { mode: 'move' | 'copy', fileIds: string[] }
  'xpan:show-shortcuts': void
  'xpan:open-ai': void
}

// ─── WebSocket 推送载荷 ────────────────────────────────────────
/** 服务端下发的离线任务对象 */
export interface IWsOfflineTaskPayload extends Partial<IOfflineTaskVO> {
  statusText?: string
  progress?: number
}

/** OFFLINE_TASK_REMOVED 载荷 */
export interface IWsOfflineTaskRemovedPayload {
  taskId: string
}