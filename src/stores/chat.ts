/**
 * chat store —— 站内 IM 状态：会话列表 / 消息缓存 / 好友与申请 / WS 事件接入
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import chatApi, {
  type IChatConversationVO,
  type IChatFriendApplyVO,
  type IChatFriendVO,
  type IChatMessageVO
} from '@/api/chat'
import { useWebSocket } from '@/composables/useWebSocket'
import { useUserStore } from '@/stores/user'

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<IChatConversationVO[]>([])
  const activeConversationId = ref<number | null>(null)
  /** 会话消息缓存：conversationId → 升序消息数组 */
  const messagesByConv = ref<Record<number, IChatMessageVO[]>>({})
  const friends = ref<IChatFriendVO[]>([])
  const applies = ref<IChatFriendApplyVO[]>([])
  const conversationsLoaded = ref(false)

  const totalUnread = computed(() =>
    conversations.value.reduce((sum, c) => sum + (c.unread > 0 ? c.unread : 0), 0)
  )
  const pendingApplies = computed(() => applies.value.length)

  // 当前用户名：消息归属判定用（VO 携带 senderUsername，无需 userId 状态）
  const currentUsername = computed(() => {
    try {
      const userStore = useUserStore()
      return userStore.username || ''
    } catch {
      return ''
    }
  })

  function activeMessages(): IChatMessageVO[] {
    return activeConversationId.value == null
      ? []
      : messagesByConv.value[activeConversationId.value] || []
  }

  function loadConversations() {
    chatApi.listConversations((res) => {
      if (res.code === 0) {
        conversations.value = res.data || []
        conversationsLoaded.value = true
      }
    }, () => {})
  }

  function loadFriends() {
    chatApi.listFriends((res) => {
      if (res.code === 0) friends.value = res.data || []
    }, () => {})
  }

  function loadApplies() {
    chatApi.listFriendApplies((res) => {
      if (res.code === 0) applies.value = res.data || []
    }, () => {})
  }

  function openConversation(conversationId: number) {
    activeConversationId.value = conversationId
    if (!messagesByConv.value[conversationId]) {
      messagesByConv.value[conversationId] = []
      chatApi.history(conversationId, {}, (res) => {
        if (res.code === 0 && activeConversationId.value === conversationId) {
          messagesByConv.value[conversationId] = res.data || []
          markReadIfBehind(conversationId)
        }
      }, () => {})
    } else {
      // 已有缓存 → 增量拉取断线期间的消息
      const cached = messagesByConv.value[conversationId]
      const lastSeq = cached.length ? cached[cached.length - 1].seq : 0
      chatApi.history(conversationId, { afterSeq: lastSeq }, (res) => {
        if (res.code === 0 && activeConversationId.value === conversationId) {
          appendMessages(conversationId, res.data || [])
          markReadIfBehind(conversationId)
        }
      }, () => {})
    }
  }

  function closeConversation() {
    activeConversationId.value = null
  }

  function appendMessages(conversationId: number, incoming: IChatMessageVO[]) {
    const list = messagesByConv.value[conversationId] || (messagesByConv.value[conversationId] = [])
    const seen = new Set(list.map((m) => m.id))
    for (const message of incoming) {
      if (!seen.has(message.id)) list.push(message)
    }
    list.sort((a, b) => a.seq - b.seq)
  }

  function markReadIfBehind(conversationId: number) {
    const conv = conversations.value.find((c) => c.conversationId === conversationId)
    const list = messagesByConv.value[conversationId] || []
    const lastSeq = list.length ? list[list.length - 1].seq : conv?.maxSeq ?? 0
    if (conv && conv.lastReadSeq < lastSeq) {
      chatApi.markRead(conversationId, lastSeq, () => {
        conv.lastReadSeq = lastSeq
        conv.unread = Math.max(0, conv.maxSeq - lastSeq)
      }, () => {})
    }
  }

  function sendText(conversationId: number, content: string) {
    chatApi.sendMessage(
      { conversationId, msgType: 'TEXT', content },
      (res) => {
        if (res.code === 0) appendMessages(conversationId, [res.data])
      },
      () => {}
    )
  }

  function sendFileCard(conversationId: number, fileId: string, filename: string) {
    chatApi.sendMessage(
      { conversationId, msgType: 'FILE_CARD', fileId, content: filename },
      (res) => {
        if (res.code === 0) appendMessages(conversationId, [res.data])
      },
      () => {}
    )
  }

  function sendImage(conversationId: number, file: File) {
    chatApi.uploadMedia(file, 'IMAGE', null, (res) => {
      if (res.code === 0 && res.data.mediaId != null) {
        chatApi.sendMessage(
          { conversationId, msgType: 'IMAGE', mediaId: res.data.mediaId },
          (res2) => {
            if (res2.code === 0) appendMessages(conversationId, [res2.data])
          },
          () => {}
        )
      }
    }, () => {})
  }

  function sendVoice(conversationId: number, blob: Blob, durationMs: number) {
    const file = new File([blob], 'voice.webm', { type: blob.type || 'audio/webm' })
    chatApi.uploadMedia(file, 'VOICE', durationMs, (res) => {
      if (res.code === 0 && res.data.mediaId != null) {
        chatApi.sendMessage(
          { conversationId, msgType: 'VOICE', mediaId: res.data.mediaId, content: String(durationMs) },
          (res2) => {
            if (res2.code === 0) appendMessages(conversationId, [res2.data])
          },
          () => {}
        )
      }
    }, () => {})
  }

  function recall(message: IChatMessageVO) {
    chatApi.recallMessage(message.id, () => {
      markRecalled(message.conversationId, message.id)
    }, () => {})
  }

  function forward(message: IChatMessageVO, targetIds: number[]) {
    chatApi.forwardMessage(message.id, targetIds, () => {
      // 目标会话的列表预览由下次 conversations 刷新兜底
    }, () => {})
  }

  function markRecalled(conversationId: number, messageId: number) {
    const list = messagesByConv.value[conversationId] || []
    const target = list.find((m) => m.id === messageId)
    if (target) target.status = 'RECALLED'
  }

  function loadOlder(conversationId: number): Promise<boolean> {
    return new Promise((resolve) => {
      const list = messagesByConv.value[conversationId] || []
      if (!list.length) return resolve(false)
      const firstSeq = list[0].seq
      chatApi.history(conversationId, { beforeSeq: firstSeq, limit: 50 }, (res) => {
        if (res.code === 0 && activeConversationId.value === conversationId) {
          const older = res.data || []
          messagesByConv.value[conversationId] = [...older, ...list]
          resolve(older.length >= 50)
          return
        }
        resolve(false)
      }, () => resolve(false))
    })
  }

  // ─── WS 事件接入（useWebSocket 单例） ─────────────────
  const ws = useWebSocket()
  ws.on('CHAT_NEW', (payload) => {
    const message = payload as unknown as IChatMessageVO
    if (!message || !message.conversationId) return
    appendMessages(message.conversationId, [message])
    const conv = conversations.value.find((c) => c.conversationId === message.conversationId)
    if (conv) {
      conv.maxSeq = message.seq
      conv.lastMsgPreview = previewOf(message)
      // 非当前打开的会话或页面隐藏 → 累计未读；当前会话直接前推已读
      if (activeConversationId.value === message.conversationId && !document.hidden) {
        if (message.senderUsername !== currentUsername.value) {
          chatApi.markRead(message.conversationId, message.seq, () => {
            conv.lastReadSeq = message.seq
            conv.unread = Math.max(0, conv.maxSeq - conv.lastReadSeq)
          }, () => {})
        } else {
          conv.unread = Math.max(0, conv.maxSeq - conv.lastReadSeq)
        }
      } else if (message.senderUsername !== currentUsername.value) {
        conv.unread = Math.max(0, conv.maxSeq - conv.lastReadSeq)
      }
    } else {
      loadConversations()
    }
  })
  ws.on('CHAT_RECALL', (payload) => {
    const p = payload as { conversationId?: number; messageId?: number }
    if (p?.conversationId && p?.messageId) markRecalled(p.conversationId, p.messageId)
  })
  ws.on('CHAT_READ', () => {
    // 对方已读回执：首期单聊气泡展示由 conversations 刷新兜底
  })
  ws.on('CHAT_FRIEND_APPLY', () => {
    loadApplies()
    loadFriends()
  })
  ws.on('CHAT_GROUP_INVITE', () => loadConversations())
  ws.on('CHAT_GROUP_DISMISSED', () => loadConversations())

  function previewOf(message: IChatMessageVO): string {
    if (message.msgType === 'IMAGE') return '[图片]'
    if (message.msgType === 'VOICE') return '[语音]'
    if (message.msgType === 'FILE_CARD') return `[文件] ${message.fileCardName || ''}`
    if (message.msgType === 'SYSTEM') return message.content || ''
    return message.content || ''
  }

  return {
    conversations,
    activeConversationId,
    friends,
    applies,
    conversationsLoaded,
    totalUnread,
    pendingApplies,
    currentUsername,
    loadConversations,
    loadFriends,
    loadApplies,
    openConversation,
    closeConversation,
    activeMessages,
    sendText,
    sendFileCard,
    sendImage,
    sendVoice,
    recall,
    forward,
    markRecalled,
    loadOlder
  }
})
