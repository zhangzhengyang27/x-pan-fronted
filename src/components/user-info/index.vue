<script setup lang="ts">
/**
 * AppUserInfo —— 用户菜单 + 修改密码弹窗
 * 使用 BaseDropdown + BaseModal + BaseField + BaseInput + BaseButton
 */
import { reactive, ref, onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { ChevronDown, LogOut, KeyRound, User, Monitor, Info, Camera } from '@lucide/vue'
import userService from '@/api/user'
import { clearToken, getToken } from '@/utils/cookie'
import { useUserStore } from '@/stores/user'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import { useFileStore } from '@/stores/file'
import { useNavbarStore } from '@/stores/navbar'
import { useTaskStore } from '@/stores/task'
import { ElMessage, ElNotification, ElMessageBox } from '@/composables/useToast'

import BaseDropdown from '@/components/base/BaseDropdown.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseField from '@/components/base/BaseField.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import DeviceManagerDialog from '@/components/base/DeviceManagerDialog.vue'

const userStore = useUserStore()
const { username, avatar, usedSpace, totalSpace, usedPercent } = storeToRefs(userStore)

// 头像直链 URL（后端 avatar 已是可访问的图片 URL，方案1独立存储）
const avatarUrl = computed(() => avatar.value || '')
const avatarInput = ref<HTMLInputElement | null>(null)
const avatarUploading = ref(false)
const breadcrumbStore = useBreadcrumbStore()
const fileStore = useFileStore()
const navbarStore = useNavbarStore()
const taskStore = useTaskStore()
const router = useRouter()

// 未登录时点击触发跳转登录页
function goLogin() {
  router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
}
// 已登录判定：username 存在 或 Cookie 中存在 token（即"已登录但信息未取到"也按已登录处理）
const isLoggedIn = computed(() => !!userStore.username || !!getToken())

const open = ref(false)
const changePasswordDialogVisible = ref(false)
const deviceManagerVisible = ref(false)
const profileVisible = ref(false)
const loading = ref(false)
const profile = reactive<{
  username: string
  rootFileId: string
  rootFilename: string
}>({ username: '', rootFileId: '', rootFilename: '' })

const changePasswordForm = reactive({
  password: '',
  newPassword: '',
  reNewPassword: ''
})

function clearAll() {
  clearToken()
  breadcrumbStore.clear()
  userStore.clear()
  fileStore.clear()
  navbarStore.clear()
  taskStore.clear()
  window.location.reload()
}

async function doExit() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '退出登录', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  userService.exit(
    () => clearAll(),
    (res) => ElMessage.error(res.message)
  )
}

function openChangePassword() {
  open.value = false
  changePasswordDialogVisible.value = true
}

function openDeviceManager() {
  open.value = false
  deviceManagerVisible.value = true
}

function openProfile() {
  open.value = false
  // 用最新值填充弹窗
  profile.username = username.value || userStore.username || ''
  if (fileStore.parentId) profile.rootFileId = fileStore.parentId
  if (fileStore.defaultParentFilename) profile.rootFilename = fileStore.defaultParentFilename
  // 若信息不全，异步拉一次
  if (!profile.username || !profile.rootFileId) {
    userService.info(
      (res) => {
        profile.username = res.data.username || profile.username
        profile.rootFileId = res.data.rootFileId || profile.rootFileId
        profile.rootFilename = res.data.rootFilename || profile.rootFilename
        if (res.data.avatar) userStore.setAvatar(res.data.avatar)
      },
      () => {}
    )
  }
  profileVisible.value = true
}

function resetChangePasswordForm() {
  changePasswordForm.password = ''
  changePasswordForm.newPassword = ''
  changePasswordForm.reNewPassword = ''
}

// ─── 空间容量（配额）调整 ─────────────────────────────────
const quotaVisible = ref(false)
const quotaInputGB = ref<number | null>(null)
const quotaSaving = ref(false)

/** 字节 → 可读大小 */
function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

// ─── 头像上传 ────────────────────────────────────────────────
function triggerAvatarUpload() {
  avatarInput.value?.click()
}

function onAvatarFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error('头像文件不能超过 2MB')
    return
  }
  avatarUploading.value = true
  userService.uploadAvatar(
    file,
    (res) => {
      avatarUploading.value = false
      userStore.setAvatar(res.data)
      ElNotification.success({ title: '成功', message: '头像已更新' })
    },
    (err: any) => {
      avatarUploading.value = false
      ElMessage.error(err?.message || '头像上传失败')
    }
  )
}

/** 打开容量调整弹窗，默认填当前总量（GB） */
function openQuotaEditor() {
  quotaInputGB.value = Math.max(1, Math.round(totalSpace.value / (1024 * 1024 * 1024)))
  quotaVisible.value = true
}

/** 保存新的空间容量 */
async function saveQuota() {
  const gb = Number(quotaInputGB.value)
  if (!gb || gb <= 0) {
    return ElMessage.error('请输入有效的容量（GB）')
  }
  const maxGb = 10 * 1024 // 10TB
  if (gb > maxGb) {
    return ElMessage.error(`容量不能超过 ${maxGb} GB（10TB）`)
  }
  const newTotal = gb * 1024 * 1024 * 1024
  const used = usedSpace.value || 0
  if (newTotal < used) {
    return ElMessage.error('容量不能小于当前已用空间')
  }
  quotaSaving.value = true
  userService.updateQuota(
    { totalSize: newTotal },
    () => {
      quotaSaving.value = false
      quotaVisible.value = false
      userStore.setQuota(used, newTotal)
      ElNotification.success({ title: '成功', message: '空间容量已更新' })
    },
    (res: any) => {
      quotaSaving.value = false
      ElMessage.error(res.message || '调整容量失败')
    }
  )
}

function doChangePassword() {
  if (!changePasswordForm.password || changePasswordForm.password.length < 8) {
    return ElMessage.error('请输入 8-16 位旧密码')
  }
  if (!changePasswordForm.newPassword || changePasswordForm.newPassword.length < 8) {
    return ElMessage.error('请输入 8-16 位新密码')
  }
  if (changePasswordForm.newPassword !== changePasswordForm.reNewPassword) {
    return ElMessage.error('两次密码不一致')
  }
  loading.value = true
  userService.changePassword(
    {
      oldPassword: changePasswordForm.password,
      newPassword: changePasswordForm.newPassword
    },
    () => {
      loading.value = false
      changePasswordDialogVisible.value = false
      ElNotification.success({
        title: '成功',
        message: '密码修改成功，即将跳转至登录页'
      })
      setTimeout(clearAll, 1200)
    },
    (res) => {
      ElMessage.error(res.message)
      loading.value = false
    }
  )
}

function initUserInfoIfNecessary() {
  if (!username.value) {
    userService.info(
      (res) => {
        fileStore.setParentId(res.data.rootFileId)
        fileStore.setDefaultParentId(res.data.rootFileId)
        fileStore.setDefaultParentFilename(res.data.rootFilename)
        userStore.setUsername(res.data.username)
        if (res.data.avatar) userStore.setAvatar(res.data.avatar)
        // 同步存储空间数据（后端 UserInfoVO 字段为 usedSize/totalSize）
        if (res.data.usedSize !== undefined && res.data.totalSize !== undefined) {
          userStore.setQuota(res.data.usedSize, res.data.totalSize)
        }
      },
      (res) => ElMessage.error(res.message)
    )
  }
}

onMounted(initUserInfoIfNecessary)
</script>

<template>
  <div>
    <!-- 未登录：点击直接跳转登录页，不展开下拉菜单 -->
    <button
      v-if="!isLoggedIn"
      type="button"
      class="flex items-center gap-2 px-2.5 h-9 rounded-sm hover:bg-(--color-surface-2) transition-colors text-sm"
      @click="goLogin"
    >
      <span
        class="size-7 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300"
      >
        <User :size="14" />
      </span>
      <span class="hidden sm:inline text-(--color-text) max-w-[120px] truncate">未登录</span>
      <LogOut :size="14" class="text-(--color-text-muted)" />
    </button>

    <BaseDropdown v-else v-model="open">
      <template #trigger>
        <button
          type="button"
          class="flex items-center gap-2 px-2.5 h-9 rounded-sm hover:bg-(--color-surface-2) transition-colors text-sm"
        >
          <span
            class="size-7 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center overflow-hidden"
          >
            <img
              v-if="avatarUrl"
              :src="avatarUrl"
              alt="avatar"
              class="size-full object-cover"
            />
            <User v-else :size="14" />
          </span>
          <span class="hidden sm:inline text-(--color-text) max-w-[120px] truncate">{{
            username || '已登录'
          }}</span>
          <ChevronDown :size="14" class="text-(--color-text-muted)" />
        </button>
      </template>
      <button
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-(--color-text) hover:bg-(--color-surface-2) transition-colors text-left"
        @click="openProfile"
      >
        <Info :size="14" />
        查看用户信息
      </button>
      <button
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-(--color-text) hover:bg-(--color-surface-2) transition-colors text-left"
        @click="openChangePassword"
      >
        <KeyRound :size="14" />
        修改密码
      </button>
      <button
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-(--color-text) hover:bg-(--color-surface-2) transition-colors text-left"
        @click="openDeviceManager"
      >
        <Monitor :size="14" />
        设备管理
      </button>
      <button
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-(--color-surface-2) transition-colors text-left"
        @click="doExit"
      >
        <LogOut :size="14" />
        退出登录
      </button>
    </BaseDropdown>

    <!-- P3-5 设备管理弹窗 -->
    <DeviceManagerDialog v-model:open="deviceManagerVisible" />

    <BaseModal
      v-model:open="changePasswordDialogVisible"
      title="修改密码"
      size="md"
      @close="resetChangePasswordForm"
    >
      <div class="flex flex-col gap-4">
        <BaseField label="旧密码" required>
          <BaseInput
            v-model="changePasswordForm.password"
            type="password"
            show-password
            placeholder="请输入旧密码"
          />
        </BaseField>
        <BaseField label="新密码" required>
          <BaseInput
            v-model="changePasswordForm.newPassword"
            type="password"
            show-password
            placeholder="8-16 位"
          />
        </BaseField>
        <BaseField label="确认密码" required>
          <BaseInput
            v-model="changePasswordForm.reNewPassword"
            type="password"
            show-password
            placeholder="再次输入新密码"
          />
        </BaseField>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="changePasswordDialogVisible = false"
          >取消</BaseButton
        >
        <BaseButton variant="primary" :loading="loading" @click="doChangePassword">确定</BaseButton>
      </template>
    </BaseModal>

    <!-- 用户信息弹窗 -->
    <BaseModal
      v-model:open="profileVisible"
      title="用户信息"
      size="sm"
    >
      <div class="flex flex-col gap-3 text-sm">
        <!-- 头像 -->
        <div class="flex items-center gap-3 py-1">
          <span
            class="size-12 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center overflow-hidden shrink-0"
          >
            <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" class="size-full object-cover" />
            <User v-else :size="22" />
          </span>
          <div class="flex flex-col gap-1">
            <span class="text-(--color-text) font-medium truncate">{{
              profile.username || username || '未设置'
            }}</span>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs text-(--color-primary) hover:underline disabled:opacity-50"
              :disabled="avatarUploading"
              @click="triggerAvatarUpload"
            >
              <Camera :size="12" />
              {{ avatarUploading ? '上传中...' : avatar ? '更换头像' : '设置头像' }}
            </button>
          </div>
          <input
            ref="avatarInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onAvatarFileChange"
          />
        </div>
        <div class="flex items-center justify-between py-2 border-b border-(--color-border)">
          <span class="text-(--color-text-muted)">用户名</span>
          <span class="font-medium text-(--color-text) truncate max-w-[60%]">{{
            profile.username || '-'
          }}</span>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-(--color-border)">
          <span class="text-(--color-text-muted)">根目录 ID</span>
          <span class="font-mono text-xs text-(--color-text) truncate max-w-[60%]">{{
            profile.rootFileId || '-'
          }}</span>
        </div>
        <div class="flex items-center justify-between py-2">
          <span class="text-(--color-text-muted)">根目录名</span>
          <span class="text-(--color-text) truncate max-w-[60%]">{{
            profile.rootFilename || '-'
          }}</span>
        </div>
        <!-- 空间容量 -->
        <div class="py-2 border-t border-(--color-border)">
          <div class="flex items-center justify-between mb-2">
            <span class="text-(--color-text-muted)">空间容量</span>
            <button
              type="button"
              class="text-xs text-(--color-primary) hover:underline"
              @click="openQuotaEditor"
            >
              调整
            </button>
          </div>
          <div class="h-2 w-full rounded-full bg-(--color-surface-2) overflow-hidden">
            <div
              class="h-full rounded-full bg-(--color-primary) transition-all"
              :style="{ width: `${usedPercent}%` }"
            ></div>
          </div>
          <div class="mt-1 text-xs text-(--color-text-muted)">
            已用 {{ formatSize(usedSpace) }} / {{ formatSize(totalSpace) }}
          </div>
        </div>
      </div>
      <template #footer>
        <BaseButton variant="primary" @click="profileVisible = false">知道了</BaseButton>
      </template>
    </BaseModal>

    <!-- 空间容量调整弹窗 -->
    <BaseModal v-model:open="quotaVisible" title="调整空间容量" size="sm">
      <div class="flex flex-col gap-3 text-sm">
        <p class="text-(--color-text-muted)">
          当前已用 {{ formatSize(usedSpace) }}，总容量 {{ formatSize(totalSpace) }}。设置新的总容量（GB），不能小于已用空间，上限 10TB。
        </p>
        <BaseField label="总容量（GB）" required>
          <BaseInput v-model.number="quotaInputGB" type="number" placeholder="请输入总容量（GB）" />
        </BaseField>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="quotaVisible = false">取消</BaseButton>
        <BaseButton variant="primary" :loading="quotaSaving" @click="saveQuota">保存</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
