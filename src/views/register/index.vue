<script setup lang="ts">
/**
 * RegisterPage —— 注册页
 * 设计规范：r_pan_2/code.html + 01_g1.md (A2)
 * - 密码强度指示器：弱（danger）/ 中（warning）/ 强（success）
 * - 两次密码一致性校验
 * - 左右分栏布局（桌面端）
 */
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Cloud, User, KeyRound, UserPlus, Eye, EyeOff } from '@lucide/vue'
import { ElMessage } from '@/composables/useToast'
import userService from '@/api/user'

const router = useRouter()
const loading = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const registerForm = reactive({ username: '', password: '', rePassword: '' })

// 密码强度计算
const passwordStrength = computed(() => {
  const pwd = registerForm.password
  if (!pwd) return { level: 0, label: '', bars: 0, color: '' }
  
  const hasLength = pwd.length >= 8
  const hasLetter = /[a-zA-Z]/.test(pwd)
  const hasNumber = /[0-9]/.test(pwd)
  const hasSpecial = /[^a-zA-Z0-9]/.test(pwd)
  const isLongEnough = pwd.length >= 12
  
  if (isLongEnough && hasLetter && hasNumber && hasSpecial) {
    return { level: 3, label: '强', bars: 3, color: 'var(--color-success)' }
  } else if (hasLength && hasLetter && hasNumber) {
    return { level: 2, label: '中', bars: 2, color: 'var(--color-warning)' }
  } else {
    return { level: 1, label: '弱', bars: 1, color: 'var(--color-danger)' }
  }
})

// 两次密码一致性校验
const rePasswordError = computed(() => {
  if (!registerForm.rePassword) return ''
  return registerForm.password !== registerForm.rePassword ? '两次密码不一致' : ''
})

function doRegister() {
  if (!/^[0-9A-Za-z]{6,16}$/.test(registerForm.username))
    return ElMessage.error('用户名为 6-16 位字母数字')
  if (registerForm.password.length < 8 || registerForm.password.length > 16)
    return ElMessage.error('密码为 8-16 位')
  if (registerForm.password !== registerForm.rePassword) return ElMessage.error('两次密码不一致')
  loading.value = true
  userService.register(
    registerForm,
    () => {
      loading.value = false
      ElMessage.success('注册成功，请登录')
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
  <div class="min-h-screen flex items-center justify-center p-gutter bg-[var(--color-bg)] relative overflow-hidden">
    <!-- 背景光晕 -->
    <div class="absolute top-[-20%] left-[-10%] size-[50%] rounded-full blur-[120px] opacity-10 pointer-events-none" style="background-color: var(--color-primary-500);" />
    <div class="absolute bottom-[-20%] right-[-10%] size-[50%] rounded-full blur-[120px] opacity-10 pointer-events-none" style="background-color: var(--color-warning);" />

    <div class="w-full max-w-md relative z-10">
      <!-- Logo 头部 -->
      <div class="text-center mb-8">
        <div
          class="inline-flex items-center justify-center size-12 rounded-lg mb-4"
          style="background-color: var(--color-surface-container-low); border: 1px solid var(--color-border);"
        >
          <Cloud :size="24" :stroke-width="2" style="color: var(--color-primary-200);" />
        </div>
        <h1 class="text-2xl font-semibold tracking-tight text-[var(--color-text)]">
          创建账号
        </h1>
        <p class="text-base mt-2 text-[var(--color-text-muted)]">
          加入 X Pan 分布式存储网络
        </p>
      </div>

      <!-- 表单卡片 -->
      <div
        class="rounded-xl p-8 shadow-2xl"
        style="background: var(--color-surface-container-low); border: 1px solid var(--color-border);"
      >
        <form class="space-y-6" @submit.prevent="doRegister">
          <!-- 用户名字段 -->
          <div>
            <label class="block text-sm font-medium mb-2 text-[var(--color-text)]">
              用户名
            </label>
            <div class="relative">
              <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]"
              >
                <User :size="18" :stroke-width="2" />
              </div>
              <input
                v-model="registerForm.username"
                type="text"
                placeholder="输入您的用户名"
                autocomplete="username"
                class="w-full pl-10 pr-3 py-2 text-sm rounded-lg transition-all duration-200 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent"
              />
            </div>
          </div>

          <!-- 密码字段 -->
          <div>
            <label class="block text-sm font-medium mb-2 text-[var(--color-text)]">
              密码
            </label>
            <div class="relative mb-2">
              <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]"
              >
                <KeyRound :size="18" :stroke-width="2" />
              </div>
              <input
                v-model="registerForm.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="至少 8 位字符"
                autocomplete="new-password"
                class="w-full pl-10 pr-10 py-2 text-sm rounded-lg transition-all duration-200 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                @click="showPassword = !showPassword"
              >
                <Eye v-if="showPassword" :size="18" :stroke-width="2" />
                <EyeOff v-else :size="18" :stroke-width="2" />
              </button>
            </div>

            <!-- 密码强度指示器 -->
            <div v-if="registerForm.password">
              <div class="flex gap-1 h-1.5 w-full rounded-full overflow-hidden bg-[var(--color-border)]">
                <div
                  class="h-full flex-1 rounded-full transition-colors duration-300"
                  :style="{ backgroundColor: passwordStrength.bars >= 1 ? passwordStrength.color : 'var(--color-border)' }"
                />
                <div
                  class="h-full flex-1 rounded-full transition-colors duration-300"
                  :style="{ backgroundColor: passwordStrength.bars >= 2 ? passwordStrength.color : 'var(--color-border)' }"
                />
                <div
                  class="h-full flex-1 rounded-full transition-colors duration-300"
                  :style="{ backgroundColor: passwordStrength.bars >= 3 ? passwordStrength.color : 'var(--color-border)' }"
                />
              </div>
              <p class="text-xs mt-1 text-right" :style="{ color: passwordStrength.color || 'var(--color-text-muted)' }">
                密码强度: {{ passwordStrength.label || '弱' }}
              </p>
            </div>
          </div>

          <!-- 确认密码字段 -->
          <div>
            <label class="block text-sm font-medium mb-2 text-[var(--color-text)]">
              确认密码
            </label>
            <div class="relative">
              <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]"
              >
                <KeyRound :size="18" :stroke-width="2" />
              </div>
              <input
                v-model="registerForm.rePassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                placeholder="再次输入密码"
                autocomplete="new-password"
                class="w-full pl-10 pr-10 py-2 text-sm rounded-lg transition-all duration-200 bg-[var(--color-surface)] border text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent"
                :style="{
                  borderColor: rePasswordError ? 'var(--color-danger)' : 'var(--color-border)',
                }"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                <Eye v-if="showConfirmPassword" :size="18" :stroke-width="2" />
                <EyeOff v-else :size="18" :stroke-width="2" />
              </button>
            </div>
            <p v-if="rePasswordError" class="text-xs mt-1" style="color: var(--color-danger);">
              {{ rePasswordError }}
            </p>
          </div>

          <!-- 提交按钮 -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 bg-[var(--color-primary-500)] text-white hover:opacity-90 hover:bg-[var(--color-primary-600)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading" class="inline-flex items-center gap-2">
              <svg class="animate-spin size-4" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              注册中...
            </span>
            <span v-else class="inline-flex items-center gap-2">
              <UserPlus :size="16" :stroke-width="2" />
              注册
            </span>
          </button>
        </form>

        <!-- 分隔线 -->
        <div class="mt-6 flex items-center">
          <div class="w-full h-px bg-[var(--color-border)]" />
          <div class="px-3 text-xs whitespace-nowrap text-[var(--color-text-muted)]">
            已有账号？
          </div>
          <div class="w-full h-px bg-[var(--color-border)]" />
        </div>

        <!-- 登录按钮 -->
        <div class="mt-6">
          <button
            type="button"
            class="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]"
            @click="goLogin"
          >
            去登录
          </button>
        </div>
      </div>

      <!-- 底部说明 -->
      <p class="mt-8 text-center text-xs text-[var(--color-text-muted)]">
        注册即代表您已同意
        <router-link to="/agreement" class="text-[var(--color-primary-200)] hover:underline">《服务协议》</router-link>
        和
        <router-link to="/privacy" class="text-[var(--color-primary-200)] hover:underline">《隐私政策》</router-link>
      </p>
    </div>
  </div>
</template>
