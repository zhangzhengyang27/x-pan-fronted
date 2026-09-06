<script setup lang="ts">
/**
 * VaultPage —— 隐私保险箱（P3-4）
 *
 * 三态流程：
 *   loading → status 探测
 *   setup   → 首次设置保险箱密码（设置成功后自动解锁）
 *   unlock  → 已设置密码，输入密码解锁（缓存 30 分钟）
 *   unlocked→ 文件列表（移出 / 永久删除）
 *
 * 数据来源：api/vault/index.ts（对接后端 VaultController）
 * 安全：密码由后端 PBKDF2 加密存储，前端仅明文传输（走 HTTPS）。
 */
import { ref, onMounted } from 'vue'
import { Lock, Shield, Eye, EyeOff, Download, Trash2, LogOut, LoaderCircle, KeyRound } from '@lucide/vue'
import vaultService from '@/api/vault'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import BaseEmpty from '@/components/base/BaseEmpty.vue'
import type { IFileVO } from '@/types'

type VaultView = 'loading' | 'setup' | 'unlock' | 'unlocked'

const view = ref<VaultView>('loading')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const loading = ref(false)
const files = ref<IFileVO[]>([])

/** 从 reject 回调中安全提取后端业务错误 message */
function errMsg(err: unknown, fallback: string): string {
  const m = (err as { message?: string } | null)?.message
  return m || fallback
}

/** 进入页面：探测保险箱状态 */
function loadStatus() {
  view.value = 'loading'
  vaultService.status(
    (res) => {
      const s = res.data
      if (!s) {
        view.value = 'unlock'
        return
      }
      if (!s.hasPassword) {
        view.value = 'setup'
      } else if (s.unlocked) {
        view.value = 'unlocked'
        loadFiles()
      } else {
        view.value = 'unlock'
      }
    },
    () => {
      // 状态探测失败，降级到解锁视图
      view.value = 'unlock'
    }
  )
}

/** 首次设置保险箱密码 */
function setup() {
  if (!password.value) {
    ElMessage.warning('请输入保险箱密码')
    return
  }
  if (password.value.length < 4) {
    ElMessage.warning('密码至少 4 位')
    return
  }
  if (password.value !== confirmPassword.value) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }
  submitting.value = true
  vaultService.setup(
    password.value,
    () => {
      // 设置成功后自动解锁，进入文件列表
      vaultService.unlock(
        password.value,
        () => {
          submitting.value = false
          password.value = ''
          confirmPassword.value = ''
          view.value = 'unlocked'
          loadFiles()
        },
        (err) => {
          submitting.value = false
          // 设置成功但解锁失败，切回解锁视图让用户手动解锁
          password.value = ''
          confirmPassword.value = ''
          view.value = 'unlock'
          ElMessage.error(errMsg(err, '密码已设置，请输入密码解锁'))
        }
      )
    },
    (err) => {
      submitting.value = false
      ElMessage.error(errMsg(err, '设置密码失败'))
    }
  )
}

/** 解锁保险箱 */
function unlock() {
  if (!password.value) {
    ElMessage.warning('请输入保险箱密码')
    return
  }
  submitting.value = true
  vaultService.unlock(
    password.value,
    () => {
      submitting.value = false
      password.value = ''
      view.value = 'unlocked'
      loadFiles()
    },
    (err) => {
      submitting.value = false
      ElMessage.error(errMsg(err, '密码错误'))
    }
  )
}

/** 加载保险箱文件列表 */
function loadFiles() {
  loading.value = true
  vaultService.list(
    (res) => {
      files.value = res.data || []
      loading.value = false
    },
    (err) => {
      loading.value = false
      ElMessage.error(errMsg(err, '加载失败'))
    }
  )
}

/** 移出保险箱到原目录 */
function moveOut(row: IFileVO) {
  vaultService.moveOut(
    row.fileId,
    () => {
      ElMessage.success('已移出保险箱到原目录')
      loadFiles()
    },
    (err) => ElMessage.error(errMsg(err, '操作失败'))
  )
}

/** 永久删除保险箱文件 */
function destroy(row: IFileVO) {
  ElMessageBox.confirm('永久删除后无法恢复，确定删除吗？', '永久删除', {
    confirmButtonText: '永久删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then((ok) => {
      if (!ok) return
      vaultService.destroy(
        row.fileId,
        () => {
          ElMessage.success('已永久删除')
          loadFiles()
        },
        (err) => ElMessage.error(errMsg(err, '删除失败'))
      )
    })
    .catch(() => {})
}

/** 锁定保险箱（调用后端清除解锁状态） */
function lock() {
  vaultService.lock(
    () => {
      view.value = 'unlock'
      password.value = ''
      files.value = []
    },
    () => {
      // 后端锁定失败也前端锁定
      view.value = 'unlock'
      password.value = ''
      files.value = []
    }
  )
}

onMounted(() => {
  loadStatus()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 加载状态 -->
    <div v-if="view === 'loading'" class="flex items-center justify-center min-h-[400px]">
      <LoaderCircle :size="28" class="animate-spin text-primary-500" />
    </div>

    <!-- 设置密码（首次） -->
    <div v-else-if="view === 'setup'" class="flex items-center justify-center min-h-[400px]">
      <div class="w-[380px] max-w-[90vw] rounded-2xl border border-(--color-border) bg-(--color-surface) p-8 text-center shadow-sm">
        <div
          class="size-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
          style="background: linear-gradient(135deg, rgba(0, 178, 255, 0.12), rgba(0, 178, 255, 0.04));"
        >
          <KeyRound :size="32" :stroke-width="1.5" class="text-primary-500" />
        </div>
        <h2 class="text-lg font-medium text-(--color-text) mb-2">设置保险箱密码</h2>
        <p class="text-sm text-(--color-text-muted) mb-6 leading-relaxed">
          首次使用请设置独立密码，保险箱中的文件将加密存储。
          <br />
          <span class="text-xs">该密码与登录密码独立，丢失后无法找回。</span>
        </p>
        <div class="relative mb-4">
          <Lock :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入保险箱密码"
            class="w-full pl-10 pr-10 py-2.5 rounded-sm border border-(--color-border) bg-(--color-surface) text-sm text-(--color-text) focus:outline-none focus:border-primary-500"
            @keyup.enter="setup"
          />
          <button
            class="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-text-muted) hover:text-(--color-text)"
            @click="showPassword = !showPassword"
          >
            <component :is="showPassword ? EyeOff : Eye" :size="16" />
          </button>
        </div>
        <div class="relative mb-4">
          <Lock :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
          <input
            v-model="confirmPassword"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请再次输入密码"
            class="w-full pl-10 pr-10 py-2.5 rounded-sm border border-(--color-border) bg-(--color-surface) text-sm text-(--color-text) focus:outline-none focus:border-primary-500"
            @keyup.enter="setup"
          />
        </div>
        <button
          class="w-full py-2.5 rounded-sm text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-60"
          style="background: var(--color-primary-500);"
          :disabled="submitting"
          @click="setup"
        >
          <LoaderCircle v-if="submitting" :size="16" class="animate-spin" />
          <KeyRound v-else :size="16" />
          设置并解锁
        </button>
      </div>
    </div>

    <!-- 解锁 -->
    <div v-else-if="view === 'unlock'" class="flex items-center justify-center min-h-[400px]">
      <div class="w-[380px] max-w-[90vw] rounded-2xl border border-(--color-border) bg-(--color-surface) p-8 text-center shadow-sm">
        <div
          class="size-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
          style="background: linear-gradient(135deg, rgba(0, 178, 255, 0.12), rgba(0, 178, 255, 0.04));"
        >
          <Shield :size="32" :stroke-width="1.5" class="text-primary-500" />
        </div>
        <h2 class="text-lg font-medium text-(--color-text) mb-2">隐私保险箱</h2>
        <p class="text-sm text-(--color-text-muted) mb-6 leading-relaxed">
          保险箱中的文件经过加密存储，需输入独立密码才能访问。
        </p>
        <div class="relative mb-4">
          <Lock :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入保险箱密码"
            class="w-full pl-10 pr-10 py-2.5 rounded-sm border border-(--color-border) bg-(--color-surface) text-sm text-(--color-text) focus:outline-none focus:border-primary-500"
            @keyup.enter="unlock"
          />
          <button
            class="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-text-muted) hover:text-(--color-text)"
            @click="showPassword = !showPassword"
          >
            <component :is="showPassword ? EyeOff : Eye" :size="16" />
          </button>
        </div>
        <button
          class="w-full py-2.5 rounded-sm text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-60"
          style="background: var(--color-primary-500);"
          :disabled="submitting"
          @click="unlock"
        >
          <LoaderCircle v-if="submitting" :size="16" class="animate-spin" />
          <Lock v-else :size="16" />
          解锁保险箱
        </button>
      </div>
    </div>

    <!-- 解锁状态：文件列表 -->
    <template v-else>
      <div class="flex items-center justify-between py-2">
        <div class="flex items-center gap-3">
          <h1 class="text-xl font-semibold tracking-tight text-(--color-text)">隐私保险箱</h1>
          <span class="px-2 py-0.5 rounded-full font-mono text-xs" style="background-color: var(--color-surface-container-low); color: var(--color-text-muted);">
            {{ files.length }} items · 加密存储
          </span>
        </div>
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm text-(--color-text-muted) hover:bg-(--color-surface-container-low)"
          @click="lock"
        >
          <LogOut :size="14" />
          锁定
        </button>
      </div>

      <div class="rounded-sm border border-(--color-border) bg-(--color-surface-container-low)">
        <!-- 加载中 -->
        <div v-if="loading" class="flex items-center justify-center py-20">
          <LoaderCircle :size="24" class="animate-spin text-primary-500" />
        </div>

        <!-- 空态 -->
        <BaseEmpty
          v-else-if="files.length === 0"
          :icon="Shield"
          title="保险箱为空"
          description="将敏感文件移入保险箱以加密存储"
        />

        <!-- 文件列表 -->
        <div v-else>
          <div
            v-for="f in files"
            :key="f.fileId"
            class="flex items-center gap-3 px-4 py-3 border-b border-(--color-border) last:border-b-0 hover:bg-(--color-surface-container)"
          >
            <Lock :size="16" class="text-primary-500 shrink-0" />
            <span class="text-sm text-(--color-text) truncate flex-1">{{ f.filename }}</span>
            <span class="text-xs text-(--color-text-muted) tabular-nums shrink-0">{{ f.fileSizeDesc }}</span>
            <span class="text-xs text-(--color-text-muted) shrink-0 hidden sm:inline">{{ f.updateTime }}</span>
            <div class="flex items-center gap-1 shrink-0">
              <button
                class="p-1.5 rounded-sm hover:bg-(--color-surface) text-(--color-text-muted) hover:text-(--color-text)"
                title="移出保险箱"
                @click="moveOut(f)"
              >
                <Download :size="14" />
              </button>
              <button
                class="p-1.5 rounded-sm hover:bg-(--color-surface) text-red-400 hover:text-red-500"
                title="永久删除"
                @click="destroy(f)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
