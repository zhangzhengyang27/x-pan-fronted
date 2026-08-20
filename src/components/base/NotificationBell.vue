<script setup lang="ts">
/**
 * NotificationBell —— 通知铃铛
 * 展示未读角标，点击展开最近通知列表，支持单条/全部已读。
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { Bell, CheckCheck } from '@lucide/vue'
import notificationService, { type INotificationVO } from '@/api/notification'
import { getToken } from '@/utils/cookie'
import { ElMessage } from '@/composables/useToast'
import BasePopover from '@/components/base/BasePopover.vue'

const open = ref(false)
const loading = ref(false)
const unread = ref(0)
const list = ref<INotificationVO[]>([])

/** 拉取未读数 + 列表 */
async function refresh() {
  try {
    await new Promise<void>((resolve, reject) => {
      notificationService.unreadCount(
        (res) => {
          unread.value = Number(res.data || 0)
          resolve()
        },
        (err) => {
          unread.value = 0
          resolve()
        }
      )
    })
    if (open.value) {
      await new Promise<void>((resolve, reject) => {
        notificationService.list(50, (res) => {
          list.value = res.data || []
          resolve()
        }, (err) => resolve())
      })
    }
  } catch {
    /* 忽略 */
  }
}

function openPanel() {
  open.value = true
  loading.value = true
  notificationService.list(
    50,
    (res) => {
      list.value = res.data || []
      loading.value = false
    },
    () => {
      loading.value = false
    }
  )
}

function markRead(n: INotificationVO) {
  if (n.readFlag === 1) return
  notificationService.markRead(
    n.id,
    () => {
      n.readFlag = 1
      unread.value = Math.max(0, unread.value - 1)
    },
    () => {}
  )
}

function markAllRead() {
  notificationService.markAllRead(
    () => {
      list.value.forEach((n) => (n.readFlag = 1))
      unread.value = 0
      ElMessage.success('已全部标记为已读')
    },
    () => {}
  )
}

function fmtTime(t: string): string {
  if (!t) return ''
  const d = new Date(t)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 3600 * 1000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 24 * 3600 * 1000) return `${Math.floor(diff / 3600000)} 小时前`
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 未读角标：挂载时刷新 + 定时轮询（简单可靠，不依赖 WS 消息类型）
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  refresh()
  timer = setInterval(() => {
    if (!open.value) refresh()
  }, 60000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <BasePopover v-model="open" placement="bottom-end" trigger="click" @update:modelValue="(v: boolean) => v && openPanel()">
    <template #trigger>
      <button
        type="button"
        class="relative flex items-center justify-center size-8 rounded-sm text-(--color-text-muted) hover:bg-(--color-surface-2) hover:text-(--color-text) transition-colors"
      >
        <Bell :size="17" />
        <span
          v-if="unread > 0"
          class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] leading-4 text-center"
        >
          {{ unread > 99 ? '99+' : unread }}
        </span>
      </button>
    </template>

    <div class="w-[320px] max-w-[90vw] bg-(--color-surface) border border-(--color-border) rounded-md shadow-lg overflow-hidden">
      <div class="flex items-center justify-between px-3 py-2 border-b border-(--color-border)">
        <span class="text-sm font-medium text-(--color-text)">通知</span>
        <button
          v-if="unread > 0"
          type="button"
          class="inline-flex items-center gap-1 text-xs text-(--color-primary) hover:underline"
          @click="markAllRead"
        >
          <CheckCheck :size="13" />
          全部已读
        </button>
      </div>
      <div v-if="loading" class="py-8 text-center text-xs text-(--color-text-muted)">加载中...</div>
      <div v-else-if="list.length === 0" class="py-8 text-center text-xs text-(--color-text-muted)">
        暂无通知
      </div>
      <div v-else class="max-h-[360px] overflow-y-auto divide-y divide-(--color-border)">
        <button
          v-for="n in list"
          :key="n.id"
          type="button"
          class="w-full text-left px-3 py-2.5 hover:bg-(--color-surface-2) transition-colors"
          @click="markRead(n)"
        >
          <div class="flex items-center gap-2">
            <span
              class="size-1.5 rounded-full shrink-0"
              :class="n.readFlag === 1 ? 'bg-transparent' : 'bg-(--color-primary)'"
            />
            <span
              class="text-sm font-medium truncate text-(--color-text)"
              :class="n.readFlag === 1 ? 'font-normal text-(--color-text-muted)' : ''"
            >
              {{ n.title || '通知' }}
            </span>
            <span class="ml-auto text-[10px] text-(--color-text-muted) shrink-0">{{
              fmtTime(n.createTime)
            }}</span>
          </div>
          <p class="mt-0.5 pl-3.5 text-xs text-(--color-text-muted) line-clamp-2">
            {{ n.content }}
          </p>
        </button>
      </div>
    </div>
  </BasePopover>
</template>
