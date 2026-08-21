/**
 * 在线解压 API（P3-3）
 *
 * 对接后端 ExtractController（异步任务模型）：
 * - POST /file/extract        body: { fileId, targetParentId? }  → 立即返回 taskId
 * - GET  /file/extract/progress?taskId=xxx                        → 轮询进度/结果
 *
 * taskId 为后端加密字符串，前端原样透传即可（接口内部会解密）。
 * 当前后端仅支持 ZIP 格式。解压后的文件会直接入库到目标父目录。
 */
'use strict'

import http, { type ApiResponse } from '@/utils/http'

type Callback<T> = (res: ApiResponse<T>) => void

export interface ExtractedFile {
  filename: string
  fileSize: number
  fileSizeDesc: string
  fileType: number
  isDir: boolean
}

/** 任务状态：0 待开始 1 解压中 2 完成 3 失败 */
export interface ExtractTask {
  taskId: string
  status: number
  statusText: string
  totalCount: number
  processedCount: number
  progress: number
  errorMsg?: string
  result?: ExtractedFile[]
}

const extractService = {
  /**
   * 创建在线解压任务（HTTP 立即返回，不阻塞）
   * @param fileId          压缩文件加密ID
   * @param resolve         成功回调，data 为 ExtractTask（含 taskId）
   * @param reject          失败回调
   * @param targetParentId  可选，解压目标父目录加密ID（不传则解压到当前目录）
   */
  extract(
    fileId: string,
    resolve: Callback<ExtractTask>,
    reject: Callback<unknown>,
    targetParentId?: string
  ) {
    const data: { fileId: string; targetParentId?: string } = { fileId }
    if (targetParentId) data.targetParentId = targetParentId
    http
      .post<unknown, ApiResponse<ExtractTask>>('/file/extract', data)
      .then(resolve)
      .catch(reject)
  },

  /**
   * 查询解压任务进度与结果
   * @param taskId  任务加密ID（来自 createExtract 的返回）
   * @param resolve 成功回调，data 为 ExtractTask（status=2 时携带 result 列表）
   * @param reject  失败回调
   */
  progress(taskId: string, resolve: Callback<ExtractTask>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<ExtractTask>>('/file/extract/progress', { params: { taskId } })
      .then(resolve)
      .catch(reject)
  }
}

export default extractService
