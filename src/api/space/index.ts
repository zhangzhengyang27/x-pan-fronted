/**
 * 团队空间相关 API
 */
'use strict'

import http, { type ApiResponse } from '@/utils/http'
import type { ISpaceInvitePreviewVO, ISpaceInviteVO, ISpaceMemberVO, ISpaceVO } from '@/types'

type Callback<T> = (res: ApiResponse<T>) => void

const spaceService = {
  list(resolve: Callback<ISpaceVO[]>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<ISpaceVO[]>>('/space/list').then(resolve).catch(reject)
  },

  createTeam(
    data: { spaceName: string },
    resolve: Callback<ISpaceVO>,
    reject: Callback<unknown>
  ) {
    http.post<unknown, ApiResponse<ISpaceVO>>('/space/team', data).then(resolve).catch(reject)
  },

  rename(
    spaceId: string,
    data: { spaceName: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .put<unknown, ApiResponse<unknown>>(`/space/team/${spaceId}`, data)
      .then(resolve)
      .catch(reject)
  },

  dissolve(spaceId: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .delete<unknown, ApiResponse<unknown>>(`/space/team/${spaceId}`)
      .then(resolve)
      .catch(reject)
  },

  updateQuota(
    spaceId: string,
    data: { totalSize: number },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .put<unknown, ApiResponse<unknown>>(`/space/team/${spaceId}/quota`, data)
      .then(resolve)
      .catch(reject)
  },

  createInvite(
    spaceId: string,
    data: { expireHours: number; maxUses: number; role?: 'MEMBER' | 'VIEWER' },
    resolve: Callback<ISpaceInviteVO>,
    reject: Callback<unknown>
  ) {
    http
      .post<unknown, ApiResponse<ISpaceInviteVO>>(`/space/team/${spaceId}/invite`, data)
      .then(resolve)
      .catch(reject)
  },

  listInvites(
    spaceId: string,
    resolve: Callback<ISpaceInviteVO[]>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<ISpaceInviteVO[]>>(`/space/team/${spaceId}/invites`)
      .then(resolve)
      .catch(reject)
  },

  revokeInvite(
    spaceId: string,
    inviteId: string,
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .delete<unknown, ApiResponse<unknown>>(`/space/team/${spaceId}/invites/${inviteId}`)
      .then(resolve)
      .catch(reject)
  },

  previewInvite(
    inviteCode: string,
    resolve: Callback<ISpaceInvitePreviewVO>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<ISpaceInvitePreviewVO>>(`/space/invite/${inviteCode}`)
      .then(resolve)
      .catch(reject)
  },

  join(data: { inviteCode: string }, resolve: Callback<ISpaceVO>, reject: Callback<unknown>) {
    http.post<unknown, ApiResponse<ISpaceVO>>('/space/join', data).then(resolve).catch(reject)
  },

  listMembers(
    spaceId: string,
    resolve: Callback<ISpaceMemberVO[]>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<ISpaceMemberVO[]>>(`/space/team/${spaceId}/members`)
      .then(resolve)
      .catch(reject)
  },

  updateMemberRole(
    spaceId: string,
    userId: string,
    data: { role: string },
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .put<unknown, ApiResponse<unknown>>(`/space/team/${spaceId}/members/${userId}`, data)
      .then(resolve)
      .catch(reject)
  },

  removeMember(
    spaceId: string,
    userId: string,
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .delete<unknown, ApiResponse<unknown>>(`/space/team/${spaceId}/members/${userId}`)
      .then(resolve)
      .catch(reject)
  }
}

export default spaceService
