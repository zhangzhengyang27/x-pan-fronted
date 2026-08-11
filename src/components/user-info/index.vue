<script setup lang="ts">
/**
 * AppUserInfo —— 用户菜单 + 修改密码弹窗
 * 使用 BaseDropdown + BaseModal + BaseField + BaseInput + BaseButton
 */
import { reactive, ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { ChevronDown, LogOut, KeyRound, User } from '@lucide/vue'
import userService from '@/api/user'
import { clearToken } from '@/utils/cookie'
import { useUserStore } from '@/stores/user'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import { useFileStore } from '@/stores/file'
import { useNavbarStore } from '@/stores/navbar'
import { useTaskStore } from '@/stores/task'
import { ElMessage, ElNotification } from '@/composables/useToast'

import BaseDropdown from '@/components/base/BaseDropdown.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseField from '@/components/base/BaseField.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseButton from '@/components/base/BaseButton.vue'

const userStore = useUserStore()
const { username } = storeToRefs(userStore)
const breadcrumbStore = useBreadcrumbStore()
const fileStore = useFileStore()
const navbarStore = useNavbarStore()
const taskStore = useTaskStore()

const open = ref(false)
const changePasswordDialogVisible = ref(false)
const loading = ref(false)

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

function doExit() {
  if (!window.confirm('确定要退出登录吗？')) return
  userService.exit(
    () => clearAll(),
    (res) => ElMessage.error(res.message)
  )
}

function openChangePassword() {
  open.value = false
  changePasswordDialogVisible.value = true
}

function resetChangePasswordForm() {
  changePasswordForm.password = ''
  changePasswordForm.newPassword = ''
  changePasswordForm.reNewPassword = ''
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
      password: changePasswordForm.password,
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
      },
      (res) => ElMessage.error(res.message)
    )
  }
}

onMounted(initUserInfoIfNecessary)
</script>

<template>
  <div>
    <BaseDropdown v-model="open">
      <template #trigger>
        <button
          type="button"
          class="flex items-center gap-2 px-2.5 h-9 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors text-sm"
        >
          <span
            class="size-7 rounded-full bg-[var(--color-primary-100)] dark:bg-[var(--color-primary-900)]/40 flex items-center justify-center text-[var(--color-primary-700)] dark:text-[var(--color-primary-300)]"
          >
            <User :size="14" />
          </span>
          <span class="hidden sm:inline text-[var(--color-text)] max-w-[120px] truncate">{{
            username || '未登录'
          }}</span>
          <ChevronDown :size="14" class="text-[var(--color-text-muted)]" />
        </button>
      </template>
      <button
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors text-left"
        @click="openChangePassword"
      >
        <KeyRound :size="14" />
        修改密码
      </button>
      <button
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-surface-2)] transition-colors text-left"
        @click="doExit"
      >
        <LogOut :size="14" />
        退出登录
      </button>
    </BaseDropdown>

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
  </div>
</template>
