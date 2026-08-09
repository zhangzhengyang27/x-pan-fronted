<script setup>
/**
 * ForgetPage —— 忘记密码（重置密码）
 */
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { User, KeyRound, ShieldCheck } from '@lucide/vue'
import { ElMessage } from '@/composables/useToast'
import userService from '@/api/user'

import BaseField from '@/components/base/BaseField.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseButton from '@/components/base/BaseButton.vue'

const router = useRouter()
const loading = ref(false)
const form = reactive({ username: '', password: '', rePassword: '' })

function doReset() {
  if (!form.username) return ElMessage.error('请输入用户名')
  if (form.password.length < 8 || form.password.length > 16)
    return ElMessage.error('密码为 8-16 位')
  if (form.password !== form.rePassword) return ElMessage.error('两次密码不一致')
  loading.value = true
  userService.resetPassword(
    { username: form.username, password: form.password },
    () => {
      loading.value = false
      ElMessage.success('密码已重置，请登录')
      router.push({ name: 'Login' })
    },
    (res) => {
      ElMessage.error(res.message)
      loading.value = false
    }
  )
}

const goLogin = () => router.push({ name: 'Login' })
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-[var(--color-bg)] p-6">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div
          class="size-14 mx-auto rounded-2xl bg-[var(--color-primary-50)] dark:bg-[var(--color-primary-900)]/30 flex items-center justify-center mb-4 text-[var(--color-primary-600)]"
        >
          <ShieldCheck :size="28" />
        </div>
        <h1 class="text-2xl font-semibold text-[var(--color-text)] mb-2">重置密码</h1>
        <p class="text-sm text-[var(--color-text-muted)]">通过用户名与新密码重置</p>
      </div>

      <form class="flex flex-col gap-4" @submit.prevent="doReset">
        <BaseField label="用户名" required>
          <BaseInput v-model="form.username" placeholder="请输入用户名" :prefix="User" />
        </BaseField>
        <BaseField label="新密码" required>
          <BaseInput
            v-model="form.password"
            type="password"
            show-password
            placeholder="8-16 位"
            :prefix="KeyRound"
          />
        </BaseField>
        <BaseField label="确认密码" required>
          <BaseInput
            v-model="form.rePassword"
            type="password"
            show-password
            placeholder="再次输入"
            :prefix="KeyRound"
          />
        </BaseField>

        <BaseButton variant="primary" size="lg" :loading="loading" block @click="doReset"
          >重置密码</BaseButton
        >
      </form>

      <div class="mt-6 text-center text-sm text-[var(--color-text-muted)]">
        想起来了？
        <button
          type="button"
          class="text-[var(--color-primary-600)] hover:underline"
          @click="goLogin"
        >
          返回登录
        </button>
      </div>
    </div>
  </div>
</template>
