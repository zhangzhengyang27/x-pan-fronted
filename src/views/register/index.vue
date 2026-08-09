<script setup>
/**
 * RegisterPage —— 注册页
 */
import {reactive, ref} from 'vue'
import {useRouter} from 'vue-router'
import {User, KeyRound, UserPlus} from '@lucide/vue'
import {ElMessage} from '@/composables/useToast'
import userService from '@/api/user'

import BaseField from '@/components/base/BaseField.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseButton from '@/components/base/BaseButton.vue'

const router = useRouter()
const loading = ref(false)

const registerForm = reactive({username: '', password: '', rePassword: ''})

function doRegister() {
  if (!/^[0-9A-Za-z]{6,16}$/.test(registerForm.username)) return ElMessage.error('用户名为 6-16 位字母数字')
  if (registerForm.password.length < 8 || registerForm.password.length > 16) return ElMessage.error('密码为 8-16 位')
  if (registerForm.password !== registerForm.rePassword) return ElMessage.error('两次密码不一致')
  loading.value = true
  userService.register(
    registerForm,
    () => {
      loading.value = false
      ElMessage.success('注册成功，请登录')
      router.push({name: 'Login'})
    },
    (res) => {
      ElMessage.error(res.message)
      loading.value = false
    },
  )
}

const goLogin = () => router.push({name: 'Login'})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-[var(--color-bg)] p-6">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-semibold text-[var(--color-text)] mb-2">注册新账号</h1>
        <p class="text-sm text-[var(--color-text-muted)]">创建您的 R Pan 账户</p>
      </div>

      <form class="flex flex-col gap-4" @submit.prevent="doRegister">
        <BaseField label="用户名" required>
          <BaseInput v-model="registerForm.username" placeholder="6-16 位字母数字" :prefix="User"/>
        </BaseField>
        <BaseField label="密码" required>
          <BaseInput v-model="registerForm.password" type="password" show-password placeholder="8-16 位" :prefix="KeyRound"/>
        </BaseField>
        <BaseField label="确认密码" required>
          <BaseInput v-model="registerForm.rePassword" type="password" show-password placeholder="再次输入" :prefix="KeyRound"/>
        </BaseField>

        <BaseButton variant="primary" size="lg" :loading="loading" block @click="doRegister">
          <span class="inline-flex items-center gap-2"><UserPlus :size="16"/> 注册</span>
        </BaseButton>
      </form>

      <div class="mt-6 text-center text-sm text-[var(--color-text-muted)]">
        已有账号？
        <button type="button" class="text-[var(--color-primary-600)] hover:underline" @click="goLogin">返回登录</button>
      </div>
    </div>
  </div>
</template>