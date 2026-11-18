<script setup lang="ts">
/**
 * ChatPage —— 站内 IM：会话列表 + 聊天窗 + 好友管理抽屉
 * 消息类型：文本 / 图片 / 文件卡片（转存）/ 语音条；撤回（2 分钟内）/ 转发 / emoji
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  MessageSquare as MessageIcon,
  Users as UsersIcon,
  UserPlus as UserPlusIcon,
  Send as SendIcon,
  Image as ImageIcon,
  Mic as MicIcon,
  Smile as SmileIcon,
  X as CloseIcon,
  ChevronLeft as BackIcon,
  FileText as FileCardIcon,
  RotateCcw as RecallIcon,
  Forward as ForwardIcon,
  Check as CheckIcon
} from '@lucide/vue'
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'
import chatApi, { type IChatMessageVO } from '@/api/chat'
import fileService from '@/api/file'
import { ElMessage } from '@/composables/useToast'
import { useFileStore } from '@/stores/file'

const chatStore = useChatStore()
const userStore = useUserStore()
const fileStore = useFileStore()

const view = ref<'chats' | 'friends'>('chats')
const showFriendDrawer = ref(false)
const showFilePicker = ref(false)
const showForwardPicker = ref<IChatMessageVO | null>(null)
const forwardTargets = ref<Set<number>>(new Set())
const showEmoji = ref(false)
const showGroupCreate = ref(false)
const draft = ref('')
const listLoading = ref(false)
const hasOlder = ref(true)
const recording = ref(false)
const recordTimer = ref<number | null>(null)
const recordSeconds = ref(0)
let mediaRecorder: MediaRecorder | null = null
let recordChunks: Blob[] = []
const emojiList = ['😀', '😂', '🤝', '👍', '🎉', '🔥', '❤️', '🙏', '😮', '😢', '🚀', '✅', '📎', '👀', '🤔', '💪']

const friendTab = ref<'list' | 'applies'>('list')
const applyFormUserId = ref('')
const applyFormMessage = ref('')
const remarkDraft = ref<Record<string, string>>({})

const activeConv = computed(() =>
  chatStore.conversations.find((c) => c.conversationId === chatStore.activeConversationId)
)
const activeMessages = computed(() => chatStore.activeMessages())
const scrollRef = ref<HTMLElement | null>(null)

// 好友选择（建群/拉人共用）
const friendSelection = ref<Set<string>>(new Set())
const groupNameDraft = ref('')

// 文件卡片选择：拉我的网盘文件（当前目录列表）
const fileList = computed(() => fileStore.fileList.filter((f) => f.folderFlag !== 1))

onMounted(() => {
  chatStore.loadConversations()
  chatStore.loadFriends()
  chatStore.loadApplies()
})

// 卸载清理：停止录音并释放麦克风（否则离开页面后持续采集、倒计时到点还会替用户发送）
onBeforeUnmount(() => {
  try {
    mediaRecorder?.state === 'recording' && mediaRecorder.stop()
    mediaRecorder?.stream.getTracks().forEach((t) => t.stop())
  } catch {
    // 忽略
  }
  if (recordTimer.value != null) clearInterval(recordTimer.value)
  recording.value = false
})

watch(
  () => chatStore.activeConversationId,
  async () => {
    draft.value = ''
    showEmoji.value = false
    showForwardPicker.value = null
    forwardTargets.value = new Set()
    hasOlder.value = true
    await nextTick()
    scrollToBottom()
  }
)

watch(
  () => activeMessages.value.length,
  async () => {
    await nextTick()
    scrollToBottom()
  }
)

function scrollToBottom() {
  if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight
}

function openConversation(id: number) {
  chatStore.openConversation(id)
}

async function loadOlder() {
  if (chatStore.activeConversationId == null || listLoading.value) return
  // 近顶才触发（防滚动事件风暴）；0 条返回表示已到顶
  if (scrollRef.value && scrollRef.value.scrollTop > 120) return
  listLoading.value = true
  const fetched = await chatStore.loadOlder(chatStore.activeConversationId)
  if (fetched === 0) hasOlder.value = false
  listLoading.value = false
}

function sendDraft() {
  const content = draft.value.trim()
  if (!content || chatStore.activeConversationId == null) return
  chatStore.sendText(chatStore.activeConversationId, content)
  draft.value = ''
  showEmoji.value = false
}

function appendEmoji(e: string) {
  draft.value += e
}

function pickImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file && chatStore.activeConversationId != null) {
    chatStore.sendImage(chatStore.activeConversationId, file)
  }
  input.value = ''
}

function sendFileCard(fileId: string, filename: string) {
  if (chatStore.activeConversationId == null) return
  chatStore.sendFileCard(chatStore.activeConversationId, fileId, filename)
  showFilePicker.value = false
}

// ─── 语音（MediaRecorder） ─────────────────────────────
async function toggleRecord() {
  if (recording.value) {
    mediaRecorder?.stop()
    return
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    recordChunks = []
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordChunks.push(event.data)
    }
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      const seconds = recordSeconds.value
      recording.value = false
      if (recordTimer.value != null) {
        clearInterval(recordTimer.value)
        recordTimer.value = null
      }
      recordSeconds.value = 0
      const blob = new Blob(recordChunks, { type: 'audio/webm' })
      if (blob.size > 0 && chatStore.activeConversationId != null) {
        chatStore.sendVoice(chatStore.activeConversationId, blob, seconds * 1000)
      }
    }
    mediaRecorder.start()
    recording.value = true
    recordSeconds.value = 0
    recordTimer.value = window.setInterval(() => {
      recordSeconds.value++
      if (recordSeconds.value >= 60) mediaRecorder?.stop()
    }, 1000)
  } catch {
    ElMessage.error('麦克风不可用')
  }
}

// ─── 好友操作 ──────────────────────────────────────────
function submitFriendApply() {
  const target = applyFormUserId.value.trim()
  if (!target) return
  if (!/^\d+$/.test(target)) {
    ElMessage.error('好友 ID 为数字（可在对方头像-个人信息中查看）')
    return
  }
  chatApi.applyFriend(target, applyFormMessage.value.trim(), (res) => {
    if (res.code === 0) {
      ElMessage.success('申请已发送')
      applyFormUserId.value = ''
      applyFormMessage.value = ''
      chatStore.loadFriends()
    } else {
      ElMessage.error(res.message || '申请失败')
    }
  }, () => ElMessage.error('申请失败'))
}

function acceptApply(id: number) {
  chatApi.acceptFriendApply(id, () => {
    chatStore.loadApplies()
    chatStore.loadFriends()
    ElMessage.success('已添加好友')
  }, () => {})
}

function rejectApply(id: number) {
  chatApi.rejectFriendApply(id, () => chatStore.loadApplies(), () => {})
}

function saveRemark(friendUserId: string) {
  const remark = remarkDraft.value[friendUserId]
  if (remark == null) return
  chatApi.setFriendRemark(friendUserId, remark, () => {
    chatStore.loadFriends()
    ElMessage.success('备注已保存')
  }, () => {})
}

function removeFriend(friendUserId: string) {
  if (!window.confirm('删除后双方好友关系解除（历史会话保留），确定？')) return
  chatApi.deleteFriend(friendUserId, () => {
    chatStore.loadFriends()
    chatStore.loadConversations()
    ElMessage.success('已删除好友')
  }, () => {})
}

function toggleFriendSelection(friendUserId: string) {
  const next = new Set(friendSelection.value)
  if (next.has(friendUserId)) next.delete(friendUserId)
  else next.add(friendUserId)
  friendSelection.value = next
}

function createGroup() {
  const groupName = groupNameDraft.value.trim()
  if (!groupName) {
    ElMessage.error('请输入群名称')
    return
  }
  const memberIds = [...friendSelection.value]
  if (memberIds.length < 1) {
    ElMessage.error('请至少选择 1 位好友')
    return
  }
  chatApi.createGroup(groupName, memberIds, (res) => {
    if (res.code === 0) {
      ElMessage.success('群聊已创建')
      showGroupCreate.value = false
      groupNameDraft.value = ''
      friendSelection.value = new Set()
      chatStore.loadConversations()
      if (res.data?.conversationId) chatStore.openConversation(res.data.conversationId)
    } else {
      ElMessage.error(res.message || '创建失败')
    }
  }, () => ElMessage.error('创建失败'))
}

function startDirectChat(friendUserId: string) {
  chatApi.getDirectConversation(friendUserId, (res) => {
    if (res.code === 0 && res.data?.conversationId) {
      chatStore.loadConversations()
      chatStore.openConversation(res.data.conversationId)
      view.value = 'chats'
    } else {
      ElMessage.error(res.message || '无法发起会话')
    }
  }, () => {})
}

function recallMessage(message: IChatMessageVO) {
  chatStore.recall(message)
}

/** 文件卡片转存：复用既有 transfer 接口（校验配额/引用计数），转入我的网盘根目录 */
function transferFileCard(message: IChatMessageVO) {
  if (!message.fileId) return
  fileService
    .transfer({ fileIds: [message.fileId], targetParentId: fileStore.defaultParentId || '-1' })
    .then((res) => {
      if (res.code === 0) ElMessage.success('已转存到我的网盘')
      else ElMessage.error(res.message || '转存失败')
    })
    .catch(() => ElMessage.error('转存失败'))
}

function toggleForwardTarget(conversationId: number) {
  const next = new Set(forwardTargets.value)
  if (next.has(conversationId)) next.delete(conversationId)
  else next.add(conversationId)
  forwardTargets.value = next
}

function confirmForward() {
  const message = showForwardPicker.value
  if (!message || forwardTargets.value.size === 0) return
  chatStore.forward(message, [...forwardTargets.value])
  showForwardPicker.value = null
  forwardTargets.value = new Set()
  ElMessage.success('已转发')
}

function fmtSize(bytes: number | null): string {
  const v = Number(bytes || 0)
  if (v <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = v
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function fmtTime(time: string): string {
  if (!time) return ''
  return time.slice(5, 16)
}
</script>

<template>
  <div class="flex h-full min-h-0">
    <!-- ─── 左栏：会话/好友切换 ─────────────────────────── -->
    <aside class="w-72 shrink-0 border-r border-(--color-border) bg-(--color-surface) flex flex-col min-h-0">
      <div class="flex items-center gap-2 p-3 border-b border-(--color-border)">
        <button
          class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-sm text-sm transition-colors"
          :class="view === 'chats' ? 'bg-primary-500/10 text-primary-600 font-medium' : 'text-(--color-text-muted) hover:bg-(--color-surface-2)'"
          @click="view = 'chats'"
        >
          <MessageIcon :size="15" /> 消息
        </button>
        <button
          class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-sm text-sm transition-colors relative"
          :class="view === 'friends' ? 'bg-primary-500/10 text-primary-600 font-medium' : 'text-(--color-text-muted) hover:bg-(--color-surface-2)'"
          @click="view = 'friends'"
        >
          <UsersIcon :size="15" /> 好友
          <span
            v-if="chatStore.pendingApplies > 0"
            class="absolute top-1 right-2 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center"
          >{{ chatStore.pendingApplies }}</span>
        </button>
      </div>

      <!-- 会话列表 -->
      <div v-if="view === 'chats'" class="flex-1 overflow-y-auto min-h-0">
        <button
          v-for="conv in chatStore.conversations"
          :key="conv.conversationId"
          class="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-(--color-border)/60"
          :class="chatStore.activeConversationId === conv.conversationId ? 'bg-primary-500/10' : 'hover:bg-(--color-surface-2)'"
          @click="openConversation(conv.conversationId)"
        >
          <span
            class="size-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
            :class="conv.type === 'GROUP' ? 'bg-violet-500' : 'bg-primary-500'"
          >{{ conv.type === 'GROUP' ? '群' : (conv.displayName || '?').slice(0, 1) }}</span>
          <span class="flex-1 min-w-0">
            <span class="flex items-center justify-between gap-2">
              <span class="truncate text-sm text-(--color-text) font-medium">{{ conv.displayName }}</span>
              <span v-if="conv.type === 'DIRECT'" class="size-1.5 rounded-full shrink-0" :class="conv.peerOnline ? 'bg-green-500' : 'bg-(--color-text-muted)/40'" />
            </span>
            <span class="block truncate text-xs text-(--color-text-muted) mt-0.5">{{ conv.lastMsgPreview || '…' }}</span>
          </span>
          <span v-if="conv.unread > 0" class="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] leading-5 text-center shrink-0">{{ conv.unread > 99 ? '99+' : conv.unread }}</span>
        </button>
        <p v-if="chatStore.conversations.length === 0" class="p-4 text-xs text-(--color-text-muted)">
          暂无会话。到「好友」页添加好友或创建群聊开始聊天。
        </p>
      </div>

      <!-- 好友列表 -->
      <div v-else class="flex-1 overflow-y-auto min-h-0">
        <div class="p-3 border-b border-(--color-border) space-y-2">
          <div class="flex gap-2">
            <input
              v-model="applyFormUserId"
              placeholder="输入好友数字 ID"
              class="flex-1 h-8 px-2 rounded-sm border border-(--color-border) bg-(--color-surface-2) text-xs outline-none"
            />
            <button class="h-8 px-2 rounded-sm bg-primary-500 text-white text-xs flex items-center gap-1" @click="submitFriendApply">
              <UserPlusIcon :size="13" /> 添加
            </button>
          </div>
          <input
            v-model="applyFormMessage"
            placeholder="验证消息（可选）"
            class="w-full h-8 px-2 rounded-sm border border-(--color-border) bg-(--color-surface-2) text-xs outline-none"
          />
          <button
            class="w-full h-8 rounded-sm border border-dashed border-(--color-border) text-xs text-(--color-text-muted) hover:text-primary-500"
            @click="showGroupCreate = true"
          >+ 创建群聊（勾选好友）</button>
        </div>

        <!-- 待处理申请 -->
        <div v-if="chatStore.pendingApplies > 0" class="px-3 pt-2 pb-1 text-[11px] font-semibold text-(--color-text-muted)">待处理申请</div>
        <div v-for="apply in chatStore.applies" :key="apply.id" class="px-3 py-2 border-b border-(--color-border)/60 flex items-center gap-2">
          <span class="flex-1 min-w-0">
            <span class="block text-sm text-(--color-text)">{{ apply.fromUsername }}</span>
            <span class="block text-xs text-(--color-text-muted) truncate">{{ apply.applyMessage || '请求添加你为好友' }}</span>
          </span>
          <button class="h-7 px-2 rounded-sm bg-primary-500 text-white text-xs" @click="acceptApply(apply.id)">同意</button>
          <button class="h-7 px-2 rounded-sm border border-(--color-border) text-xs" @click="rejectApply(apply.id)">拒绝</button>
        </div>

        <!-- 好友列表 -->
        <div v-for="friend in chatStore.friends" :key="friend.friendUserId" class="px-3 py-2 border-b border-(--color-border)/60">
          <div class="flex items-center gap-2">
            <span class="size-1.5 rounded-full shrink-0" :class="friend.online ? 'bg-green-500' : 'bg-(--color-text-muted)/40'" />
            <span class="flex-1 min-w-0 truncate text-sm text-(--color-text)">{{ friend.remark || friend.username }}</span>
            <button class="text-xs text-primary-500 hover:underline" @click="startDirectChat(friend.friendUserId)">发消息</button>
          </div>
          <div class="flex items-center gap-2 mt-1 pl-3.5">
            <input
              v-model="remarkDraft[friend.friendUserId]"
              :placeholder="'备注：' + friend.username"
              class="flex-1 h-6 px-1.5 rounded-sm border border-(--color-border) bg-(--color-surface-2) text-[11px] outline-none"
            />
            <button v-if="remarkDraft[friend.friendUserId] != null" class="text-[11px] text-primary-500" @click="saveRemark(friend.friendUserId)">
              <CheckIcon :size="12" />
            </button>
            <button class="text-[11px] text-(--color-text-muted) hover:text-red-500" @click="removeFriend(friend.friendUserId)">删除</button>
          </div>
        </div>
        <p v-if="chatStore.friends.length === 0" class="p-4 text-xs text-(--color-text-muted)">
          还没有好友。输入对方的数字用户 ID 发送申请。
        </p>
      </div>
    </aside>

    <!-- ─── 右侧：聊天窗 ─────────────────────────────────── -->
    <section class="flex-1 flex flex-col min-h-0 min-w-0 bg-(--color-surface)">
      <template v-if="activeConv">
        <div class="flex items-center gap-2 px-4 h-12 border-b border-(--color-border) shrink-0">
          <strong class="text-sm text-(--color-text)">{{ activeConv.displayName }}</strong>
          <span v-if="activeConv.type === 'DIRECT'" class="text-xs" :class="activeConv.peerOnline ? 'text-green-600' : 'text-(--color-text-muted)'">
            {{ activeConv.peerOnline ? '在线' : '离线' }}
          </span>
          <span v-else class="text-xs text-(--color-text-muted)">群聊 · {{ activeConv.role === 'OWNER' ? '你是群主' : '成员' }}</span>
        </div>

        <div ref="scrollRef" class="flex-1 overflow-y-auto min-h-0 p-4 space-y-3" @scroll.passive="loadOlder">
          <p v-if="listLoading && hasOlder" class="text-center text-xs text-(--color-text-muted)">加载更早的消息…</p>
          <div
            v-for="message in activeMessages"
            :key="message.id"
            class="flex gap-2"
          >
            <!-- SYSTEM 居中 -->
            <template v-if="message.msgType === 'SYSTEM'">
              <p class="w-full text-center text-[11px] text-(--color-text-muted)">{{ message.content }}</p>
            </template>
            <template v-else>
              <div class="flex flex-col max-w-[70%]" :class="message.senderUsername === userStore.username ? 'ml-auto items-end' : 'items-start'">
                <span v-if="message.senderUsername !== userStore.username" class="text-[11px] text-(--color-text-muted) mb-0.5">
                  {{ message.senderUsername }}
                </span>
                <!-- 气泡 -->
                <div
                  class="px-3 py-2 rounded-lg text-sm break-words"
                  :class="[
                    message.senderUsername === userStore.username ? 'bg-primary-500 text-white' : 'bg-(--color-surface-2) text-(--color-text)',
                    message.status === 'RECALLED' ? 'opacity-60 italic' : ''
                  ]"
                >
                  <p v-if="message.status === 'RECALLED'" class="text-xs">消息已撤回</p>
                  <template v-else-if="message.msgType === 'TEXT'">{{ message.content }}</template>
                  <template v-else-if="message.msgType === 'IMAGE'">
                    <img :src="chatApi.mediaUrl(Number(message.mediaId))" class="max-w-56 max-h-56 rounded cursor-pointer" alt="图片" />
                  </template>
                  <template v-else-if="message.msgType === 'VOICE'">
                    <audio :src="chatApi.mediaUrl(Number(message.mediaId))" controls class="max-w-56 h-8" />
                  </template>
                  <template v-else-if="message.msgType === 'FILE_CARD'">
                    <div class="flex items-center gap-2 min-w-40">
                      <FileCardIcon :size="20" class="shrink-0" />
                      <span class="flex-1 min-w-0">
                        <span class="block truncate">{{ message.fileCardName || message.content }}</span>
                        <span class="block text-[11px] opacity-80">{{ fmtSize(message.fileCardSize) }}</span>
                      </span>
                      <button
                        v-if="message.senderUsername !== userStore.username"
                        class="text-xs px-2 py-1 rounded bg-white/20 hover:bg-white/30"
                        @click="transferFileCard(message)"
                      >转存</button>
                    </div>
                  </template>
                </div>
                <span class="text-[10px] text-(--color-text-muted) mt-0.5 flex items-center gap-1">
                  {{ fmtTime(message.createTime) }}
                  <button
                    v-if="message.recallable"
                    class="hover:text-red-500 inline-flex items-center gap-0.5"
                    @click="recallMessage(message)"
                  ><RecallIcon :size="11" /> 撤回</button>
                  <button
                    v-if="message.status === 'SENT'"
                    class="hover:text-primary-500 inline-flex items-center gap-0.5"
                    @click="showForwardPicker = message"
                  ><ForwardIcon :size="11" /> 转发</button>
                </span>
              </div>
            </template>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="border-t border-(--color-border) p-3 shrink-0">
          <div class="flex items-center gap-2 mb-2 text-(--color-text-muted)">
            <button class="p-1 hover:text-primary-500" title="图片" @click="($refs.imageInput as HTMLInputElement).click()">
              <ImageIcon :size="17" />
            </button>
            <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="pickImage" />
            <button class="p-1 relative hover:text-primary-500" :class="recording ? 'text-red-500' : ''" @click="toggleRecord">
              <MicIcon :size="17" />
              <span v-if="recording" class="absolute -top-3 left-4 text-[10px] text-red-500">{{ recordSeconds }}s</span>
            </button>
            <button class="p-1 hover:text-primary-500" @click="showFilePicker = true">
              <FileCardIcon :size="17" />
            </button>
            <button class="p-1 hover:text-primary-500" @click="showEmoji = !showEmoji">
              <SmileIcon :size="17" />
            </button>
          </div>
          <div v-if="showEmoji" class="flex flex-wrap gap-1 p-2 mb-2 rounded border border-(--color-border) bg-(--color-surface-2)">
            <button v-for="e in emojiList" :key="e" class="text-lg hover:scale-110" @click="appendEmoji(e)">{{ e }}</button>
          </div>
          <div class="flex gap-2">
            <textarea
              v-model="draft"
              rows="2"
              placeholder="输入消息，Enter 发送"
              class="flex-1 resize-none rounded-sm border border-(--color-border) bg-(--color-surface-2) p-2 text-sm outline-none"
              @keydown.enter.exact.prevent="sendDraft"
            />
            <button class="self-end h-9 px-4 rounded-sm bg-primary-500 text-white text-sm flex items-center gap-1 disabled:opacity-50" :disabled="!draft.trim()" @click="sendDraft">
              <SendIcon :size="15" /> 发送
            </button>
          </div>
        </div>
      </template>
      <div v-else class="flex-1 flex flex-col items-center justify-center text-(--color-text-muted) gap-2">
        <MessageIcon :size="40" class="opacity-40" />
        <p class="text-sm">选择左侧会话开始聊天</p>
      </div>
    </section>

    <!-- ─── 文件卡片选择弹层 ─────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showFilePicker" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showFilePicker = false">
        <div class="w-96 max-h-[60vh] bg-(--color-surface) rounded-lg shadow-xl flex flex-col overflow-hidden">
          <div class="flex items-center justify-between px-4 h-11 border-b border-(--color-border)">
            <strong class="text-sm">选择要发送的网盘文件</strong>
            <button @click="showFilePicker = false"><CloseIcon :size="16" /></button>
          </div>
          <div class="flex-1 overflow-y-auto p-2">
            <button
              v-for="file in fileList"
              :key="file.fileId"
              class="w-full flex items-center gap-2 px-3 py-2 rounded-sm text-left hover:bg-(--color-surface-2)"
              @click="sendFileCard(file.fileId as string, file.filename || '')"
            >
              <FileCardIcon :size="16" class="shrink-0 text-primary-500" />
              <span class="flex-1 min-w-0 truncate text-sm">{{ file.filename }}</span>
              <span class="text-xs text-(--color-text-muted) shrink-0">{{ file.fileSizeDesc }}</span>
            </button>
            <p v-if="fileList.length === 0" class="p-4 text-xs text-(--color-text-muted) text-center">
              当前目录没有可发送的文件——先到「全部文件」浏览后再试
            </p>
          </div>
        </div>
      </div>

      <!-- 转发弹层 -->
      <div v-if="showForwardPicker" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showForwardPicker = null">
        <div class="w-96 max-h-[60vh] bg-(--color-surface) rounded-lg shadow-xl flex flex-col overflow-hidden">
          <div class="flex items-center justify-between px-4 h-11 border-b border-(--color-border)">
            <strong class="text-sm">转发到…</strong>
            <button @click="showForwardPicker = null"><CloseIcon :size="16" /></button>
          </div>
          <div class="flex-1 overflow-y-auto p-2">
            <label
              v-for="conv in chatStore.conversations.filter((c) => c.conversationId !== chatStore.activeConversationId)"
              :key="conv.conversationId"
              class="flex items-center gap-2 px-3 py-2 rounded-sm text-left hover:bg-(--color-surface-2) cursor-pointer"
            >
              <input
                type="checkbox"
                class="accent-primary-500"
                :checked="forwardTargets.has(conv.conversationId)"
                @change="toggleForwardTarget(conv.conversationId)"
              />
              <span class="size-7 rounded-full bg-primary-500/20 text-primary-600 flex items-center justify-center text-xs font-bold shrink-0">
                {{ conv.type === 'GROUP' ? '群' : (conv.displayName || '?').slice(0, 1) }}
              </span>
              <span class="flex-1 truncate text-sm">{{ conv.displayName }}</span>
            </label>
          </div>
          <div class="px-4 py-3 border-t border-(--color-border)">
            <button
              class="w-full h-9 rounded-sm bg-primary-500 text-white text-sm disabled:opacity-50"
              :disabled="forwardTargets.size === 0"
              @click="confirmForward"
            >转发（{{ forwardTargets.size }}）</button>
          </div>
        </div>
      </div>

      <!-- 建群弹层 -->
      <div v-if="showGroupCreate" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showGroupCreate = false">
        <div class="w-96 bg-(--color-surface) rounded-lg shadow-xl flex flex-col overflow-hidden">
          <div class="flex items-center justify-between px-4 h-11 border-b border-(--color-border)">
            <strong class="text-sm">创建群聊</strong>
            <button @click="showGroupCreate = false"><CloseIcon :size="16" /></button>
          </div>
          <div class="p-4 space-y-3">
            <input
              v-model="groupNameDraft"
              placeholder="群名称"
              class="w-full h-9 px-2 rounded-sm border border-(--color-border) bg-(--color-surface-2) text-sm outline-none"
            />
            <div class="max-h-48 overflow-y-auto">
              <label
                v-for="friend in chatStore.friends"
                :key="friend.friendUserId"
                class="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-(--color-surface-2) cursor-pointer"
              >
                <input
                  type="checkbox"
                  class="accent-primary-500"
                  :checked="friendSelection.has(friend.friendUserId)"
                  @change="toggleFriendSelection(friend.friendUserId)"
                />
                <span class="text-sm">{{ friend.remark || friend.username }}</span>
              </label>
              <p v-if="chatStore.friends.length === 0" class="text-xs text-(--color-text-muted)">还没有好友可拉入群聊</p>
            </div>
            <button class="w-full h-9 rounded-sm bg-primary-500 text-white text-sm" @click="createGroup">创建（{{ friendSelection.size + 1 }} 人）</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
