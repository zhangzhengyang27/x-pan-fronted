/**
 * 在线解压 API（P3-3）
 *
 * 对接后端 ExtractController：
 * - POST /file/extract  body: { fileId, targetParentId? }  → 同步返回解压后文件列表
 *
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

const extractService = {
  /**
   * 在线解压
   * @param fileId          压缩文件加密ID
   * @param resolve         成功回调，data 为解压后文件列表
   * @param reject          失败回调
   * @param targetParentId  可选，解压目标父目录加密ID（不传则解压到当前目录）
   */
  extract(
    fileId: string,
    resolve: Callback<ExtractedFile[]>,
    reject: Callback<unknown>,
    targetParentId?: string
  ) {
    const data: { fileId: string; targetParentId?: string } = { fileId }
    if (targetParentId) data.targetParentId = targetParentId
    http
      .post<unknown, ApiResponse<ExtractedFile[]>>('/file/extract', data)
      .then(resolve)
      .catch(reject)
  }
}

export default extractService
