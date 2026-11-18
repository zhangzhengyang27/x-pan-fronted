/**
 * 站内 IM API（好友 / 会话 / 消息 / 媒体）
 */

'use strict'

import http, { type ApiResponse } from '@/utils/http'
import panUtil from '@/utils/common'

type Callback<T> = (res: ApiResponse<T>) => void

export interface IChatFriendVO {
  friendUserId: string
  username: string
  remark: string
  online: boolean
}

export interface IChatFriendApplyVO {
  id: number
  fromUserId: string
  fromUsername: string
  applyMessage: string
  createTime: string
}

export interface IChatConversationVO {
  conversationId: number
  type: 'DIRECT' | 'GROUP'
  groupName: string | null
  displayName: string
  peerUserId: string | null
  peerOnline: boolean | null
  lastMsgPreview: string
  maxSeq: number
  lastReadSeq: number
  unread: number
  role: 'OWNER' | 'MEMBER'
}

export interface IChatMessageVO {
  id: number
  conversationId: number
  seq: number
  senderId: string
  senderUsername: string
  msgType: 'TEXT' | 'IMAGE' | 'FILE_CARD' | 'VOICE' | 'SYSTEM'
  content: string | null
  fileId: string | null
  fileCardName: string | null
  fileCardSize: number | null
  mediaId: number | null
  status: 'SENT' | 'RECALLED'
  recallable: boolean
  createTime: string
}

export interface IChatPresenceVO {
  userId: string
  online: boolean
}

const chatService = {
  // ─── 好友 ─────────────────────────────────────────────
  applyFriend(targetUserId: string, applyMessage: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<unknown>>('/chat/friend/apply', { targetUserId, applyMessage })
      .then(resolve)
      .catch(reject)
  },

  listFriendApplies(resolve: Callback<IChatFriendApplyVO[]>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<IChatFriendApplyVO[]>>('/chat/friend/applies').then(resolve).catch(reject)
  },

  acceptFriendApply(id: number, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.put<unknown, ApiResponse<unknown>>(`/chat/friend/applies/${id}/accept`).then(resolve).catch(reject)
  },

  rejectFriendApply(id: number, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.put<unknown, ApiResponse<unknown>>(`/chat/friend/applies/${id}/reject`).then(resolve).catch(reject)
  },

  listFriends(resolve: Callback<IChatFriendVO[]>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<IChatFriendVO[]>>('/chat/friend/list').then(resolve).catch(reject)
  },

  setFriendRemark(friendUserId: string, remark: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.put<unknown, ApiResponse<unknown>>(`/chat/friend/${friendUserId}/remark`, { remark }).then(resolve).catch(reject)
  },

  blockFriend(friendUserId: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.put<unknown, ApiResponse<unknown>>(`/chat/friend/${friendUserId}/block`).then(resolve).catch(reject)
  },

  unblockFriend(friendUserId: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.put<unknown, ApiResponse<unknown>>(`/chat/friend/${friendUserId}/unblock`).then(resolve).catch(reject)
  },

  deleteFriend(friendUserId: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.delete<unknown, ApiResponse<unknown>>(`/chat/friend/${friendUserId}`).then(resolve).catch(reject)
  },

  // ─── 会话 ─────────────────────────────────────────────
  listConversations(resolve: Callback<IChatConversationVO[]>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<IChatConversationVO[]>>('/chat/conversations').then(resolve).catch(reject)
  },

  getDirectConversation(peerUserId: string, resolve: Callback<IChatConversationVO>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<IChatConversationVO>>(`/chat/conversations/direct/${peerUserId}`)
      .then(resolve)
      .catch(reject)
  },

  createGroup(groupName: string, memberUserIds: string[], resolve: Callback<IChatConversationVO>, reject: Callback<unknown>) {
    http
      .post<unknown, ApiResponse<IChatConversationVO>>('/chat/conversations/group', { groupName, memberUserIds })
      .then(resolve)
      .catch(reject)
  },

  markRead(conversationId: number, seq: number, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.put<unknown, ApiResponse<unknown>>(`/chat/conversations/${conversationId}/read`, { seq }).then(resolve).catch(reject)
  },

  presence(userIds: string[], resolve: Callback<IChatPresenceVO[]>, reject: Callback<unknown>) {
    http
      .get<unknown, ApiResponse<IChatPresenceVO[]>>('/chat/presence', { params: { userIds: userIds.join(',') } })
      .then(resolve)
      .catch(reject)
  },

  // ─── 消息 ─────────────────────────────────────────────
  sendMessage(
    body: { conversationId: number; msgType: string; content?: string; fileId?: string; mediaId?: number },
    resolve: Callback<IChatMessageVO>,
    reject: Callback<unknown>
  ) {
    http.post<unknown, ApiResponse<IChatMessageVO>>('/chat/messages', body).then(resolve).catch(reject)
  },

  history(
    conversationId: number,
    params: { afterSeq?: number; beforeSeq?: number; limit?: number },
    resolve: Callback<IChatMessageVO[]>,
    reject: Callback<unknown>
  ) {
    http
      .get<unknown, ApiResponse<IChatMessageVO[]>>('/chat/messages', {
        params: { conversationId, ...params }
      })
      .then(resolve)
      .catch(reject)
  },

  recallMessage(messageId: number, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.put<unknown, ApiResponse<unknown>>(`/chat/messages/${messageId}/recall`).then(resolve).catch(reject)
  },

  forwardMessage(
    messageId: number,
    targetConversationIds: number[],
    resolve: Callback<unknown>,
    reject: Callback<unknown>
  ) {
    http
      .post<unknown, ApiResponse<unknown>>('/chat/messages/forward', { messageId, targetConversationIds })
      .then(resolve)
      .catch(reject)
  },

  // ─── 群管理 ───────────────────────────────────────────
  listGroupMembers(groupId: number, resolve: Callback<{ userId: string; username: string; role: string; online: boolean }[]>, reject: Callback<unknown>) {
    http.get<unknown, ApiResponse<{ userId: string; username: string; role: string; online: boolean }[]>>(`/chat/groups/${groupId}/members`).then(resolve).catch(reject)
  },

  addGroupMembers(groupId: number, userIds: string[], resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.post<unknown, ApiResponse<unknown>>(`/chat/groups/${groupId}/members`, { userIds }).then(resolve).catch(reject)
  },

  kickGroupMember(groupId: number, userId: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.delete<unknown, ApiResponse<unknown>>(`/chat/groups/${groupId}/members/${userId}`).then(resolve).catch(reject)
  },

  exitGroup(groupId: number, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.put<unknown, ApiResponse<unknown>>(`/chat/groups/${groupId}/exit`).then(resolve).catch(reject)
  },

  dismissGroup(groupId: number, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.put<unknown, ApiResponse<unknown>>(`/chat/groups/${groupId}/dismiss`).then(resolve).catch(reject)
  },

  transferGroupOwner(groupId: number, userId: string, resolve: Callback<unknown>, reject: Callback<unknown>) {
    http.put<unknown, ApiResponse<unknown>>(`/chat/groups/${groupId}/owner`, { userId }).then(resolve).catch(reject)
  },

  // ─── 媒体 ─────────────────────────────────────────────
  uploadMedia(file: File, mediaType: 'IMAGE' | 'VOICE', durationMs: number | null, resolve: Callback<{ mediaId: number; mediaType: string; sizeBytes: number; durationMs: number | null }>, reject: Callback<unknown>) {
    const form = new FormData()
    form.append('file', file)
    form.append('mediaType', mediaType)
    if (durationMs != null) form.append('durationMs', String(durationMs))
    http.post<unknown, ApiResponse<{ mediaId: number; mediaType: string; sizeBytes: number; durationMs: number | null }>>('/chat/media', form).then(resolve).catch(reject)
  },

  /** 媒体访问地址（Cookie 鉴权，img/audio 直接引用；与 http baseURL 同源策略） */
  mediaUrl(mediaId: number): string {
    return `${panUtil.getUrlPrefix()}/chat/media/${mediaId}`
  }
}

export default chatService
