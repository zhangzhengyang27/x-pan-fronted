/**
 * 团队空间相关 API
 */
'use strict'

import http, { type ApiResponse } from '@/utils/http'
import type {
  IFolderTreeNode,
  ISpaceAclVO,
  ISpaceGroupVO,
  ISpaceInvitePreviewVO,
  ISpaceInviteVO,
  ISpaceMemberVO,
  ISpaceVO
} from '@/types'

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

/**
 * 目录 ACL 与用户组管理。
 * 仅团队空间使用；调用方需具备 OWNER/ADMIN。
 */
export const spaceAclService = {
  listGroups(spaceId: string, resolve: Callback<ISpaceGroupVO[]>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<ISpaceGroupVO[]>>(`/space/team/${spaceId}/groups`)
      .then(resolve)
      .catch(reject)
  },

  createGroup(
    spaceId: string,
    data: { groupName: string },
    resolve: Callback<ISpaceGroupVO>,
    reject: Callback<unknown>
  ) {
    http
      .post<unknown, ApiResponse<ISpaceGroupVO>>(`/space/team/${spaceId}/groups`, data)
      .then(resolve)
      .catch(reject)
  },

  deleteGroup(spaceId: string, groupId: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .delete<unknown, ApiResponse<unknown>>(`/space/team/${spaceId}/groups/${groupId}`)
      .then(resolve)
      .catch(reject)
  },

  addGroupMembers(
    spaceId: string,
    groupId: string,
    userIds: string[],
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .post<unknown, ApiResponse<unknown>>(`/space/team/${spaceId}/groups/${groupId}/members`, { userIds })
      .then(resolve)
      .catch(reject)
  },

  removeGroupMembers(
    spaceId: string,
    groupId: string,
    userIds: string[],
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .post<unknown, ApiResponse<unknown>>(`/space/team/${spaceId}/groups/${groupId}/members/remove`, {
        userIds
      })
      .then(resolve)
      .catch(reject)
  },

  listAcls(
    spaceId: string,
    folderId: string | undefined,
    resolve: Callback<ISpaceAclVO[]>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<ISpaceAclVO[]>>(`/space/team/${spaceId}/acls`, {
        params: folderId ? { folderId } : {}
      })
      .then(resolve)
      .catch(reject)
  },

  saveAcl(
    spaceId: string,
    data: { folderId: string; subjectType: 'USER' | 'GROUP'; subjectId: string; permission: 'READ' | 'WRITE' },
    resolve: Callback<ISpaceAclVO>,
    reject: Callback<unknown>
  ) {
    http
      .post<unknown, ApiResponse<ISpaceAclVO>>(`/space/team/${spaceId}/acls`, data)
      .then(resolve)
      .catch(reject)
  },

  deleteAcl(spaceId: string, aclId: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .delete<unknown, ApiResponse<unknown>>(`/space/team/${spaceId}/acls/${aclId}`)
      .then(resolve)
      .catch(reject)
  },

  listFolders(spaceId: string, resolve: Callback<IFolderTreeNode[]>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<IFolderTreeNode[]>>(`/space/team/${spaceId}/folders`)
      .then(resolve)
      .catch(reject)
  }
}
