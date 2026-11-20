/**
 * 统一任务中心 API（P1-2）。
 *
 * 后端 GET /tasks/center 已经把离线下载/解压/预览转换三类任务归一成同一状态口径，
 * 前端只负责筛选与展示；取消目前只透传离线任务，解压/预览不提供取消。
 */
import http, { type ApiResponse } from '@/utils/http'
import type { ITaskCenterItem, PageVO } from '@/types'

type Callback<T> = (res: ApiResponse<T>) => void

export interface TaskCenterQuery {
  types?: string
  status?: number
  page?: number
  pageSize?: number
}

export default {
  list(params: TaskCenterQuery, resolve: Callback<PageVO<ITaskCenterItem>>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<PageVO<ITaskCenterItem>>>('/tasks/center', { params })
      .then(resolve)
      .catch(reject)
  },

  cancelOffline(taskId: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<unknown>>(`/tasks/center/offline/${encodeURIComponent(taskId)}/cancel`)
      .then(resolve)
      .catch(reject)
  }
}
