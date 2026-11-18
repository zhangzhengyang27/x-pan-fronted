/**
 * 外部存储挂载 API
 *
 * 对接后端 MountController：
 * - GET    /mount/manage/list          → 当前用户挂载点列表（永不回传 SK）
 * - POST   /mount/manage/create        → 创建（SK 必填）
 * - PUT    /mount/manage/update        → 更新（SK 留空 = 不修改）
 * - DELETE /mount/manage/{id}          → 删除（仅移除挂载，外部内容不受影响）
 * - POST   /mount/manage/test          → 连接测试（未保存表单）
 * - POST   /mount/manage/{id}/test     → 连接测试（已保存）
 * - GET    /mount/{id}/list            → 枚举目录内容
 * - GET    /mount/{id}/download        → 下载
 * - GET    /mount/{id}/preview-url     → 预签名直链
 * - POST   /mount/{id}/upload          → 直传（≤100MB）
 * - PUT    /mount/{id}/dir             → 创建目录
 * - DELETE /mount/{id}                 → 删除对象/目录
 */
'use strict'

import http, { type ApiResponse } from '@/utils/http'

type Callback<T> = (res: ApiResponse<T>) => void

export interface MountVO {
  id: string
  name: string
  endpoint: string
  bucket: string
  accessKey: string
  basePrefix: string
  enabled: boolean
  createTime: string
}

export interface MountSave {
  id?: string
  name: string
  endpoint: string
  bucket: string
  accessKey: string
  /** 编辑留空 = 不修改 */
  secretKey?: string
  basePrefix?: string
  enabled: boolean
}

export interface S3ObjectEntry {
  key: string
  display: string
  size: number
  dir: boolean
}

const mountService = {
  list(resolve: Callback<MountVO[]>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<MountVO[]>>('/mount/manage/list').then(resolve).catch(reject)
  },

  create(po: MountSave, resolve: Callback<string>, reject: Callback<unknown>) {
    http.post<unknown, ApiResponse<string>>('/mount/manage/create', po).then(resolve).catch(reject)
  },

  update(po: MountSave, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.put<unknown, ApiResponse<unknown>>('/mount/manage/update', po).then(resolve).catch(reject)
  },

  remove(id: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.delete<unknown, ApiResponse<unknown>>(`/mount/manage/${id}`).then(resolve).catch(reject)
  },

  testSaved(id: string, resolve: Callback<string>, reject: Callback<unknown>) {
    http.post<unknown, ApiResponse<string>>(`/mount/manage/${id}/test`).then(resolve).catch(reject)
  },

  testRaw(po: MountSave, resolve: Callback<string>, reject: Callback<unknown>) {
    http.post<unknown, ApiResponse<string>>('/mount/manage/test', po).then(resolve).catch(reject)
  },

  /** 枚举挂载目录内容（path 相对挂载根；空 = 根） */
  browse(id: string, path: string, resolve: Callback<S3ObjectEntry[]>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<S3ObjectEntry[]>>(`/mount/${id}/list`, { params: { path, maxKeys: 200 } })
      .then(resolve)
      .catch(reject)
  },

  /** 上传（multipart 直传 ≤100MB；path 为目标目录） */
  upload(id: string, path: string, file: File, resolve: Callback<string>, reject: Callback<unknown>) {
    const form = new FormData()
    form.append('file', file)
    if (path) form.append('path', path)
    http
      .post<unknown, ApiResponse<string>>(`/mount/${id}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      .then(resolve)
      .catch(reject)
  },

  /** 删除对象（dir=true 删除整个目录前缀，真删） */
  deleteObject(id: string, path: string, isDir: boolean, resolve: Callback<string[]>, reject: Callback<unknown>) {
    http
      .delete<unknown, ApiResponse<string[]>>(`/mount/${id}`, {
        params: { path, dir: isDir }
      })
      .then(resolve)
      .catch(reject)
  },

  /** 预签名直链（预览/下载用） */
  previewUrl(id: string, path: string, resolve: Callback<string>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<string>>(`/mount/${id}/preview-url`, { params: { path } })
      .then(resolve)
      .catch(reject)
  },
}

export default mountService
