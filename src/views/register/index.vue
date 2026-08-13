<script setup lang="ts">
/**
 * RegisterPage —— 注册页（夸克风格重设计）
 * 密码强度指示器 + 两次密码校验
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

const passwordStrength = computed(() => {
  const pwd = registerForm.password
  if (!pwd) return { level: 0, label: '', bars: 0, color: '' }
  const hasLength = pwd.length >= 8
  const hasLetter = /[a-zA-Z]/.test(pwd)
  const hasNumber = /[0-9]/.test(pwd)
  const hasSpecial = /[^a-zA-Z0-9]/.test(pwd)
  const isLongEnough = pwd.length >= 12

  if (isLongEnough && hasLetter && hasNumber && hasSpecial) {
    return { level: 3, label: '强', bars: 3, color: 'varsuccess' }
  } else if (hasLength && hasLetter && hasNumber) {
    return { level: 2, label: '中', bars: 2, color: 'varwarning' }
  } else {
    return { level: 1, label: '弱', bars: 1, color: 'vardanger' }
  }
})

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
  <div class="min-h-screen flex items-center justify-center bg-(--color-bg) relative overflow-hidden">
    <!-- 夸克风格背景 -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute top-[-15%] right-[-5%] w-[50%] h-[50%] rounded-full blur-[130px] opacity-[0.07]" style="background-color: var(--color-primary-500);" />
    </div>

    <div class="w-full max-w-[380px] mx-4 relative z-10">
      <!-- Logo 头部 -->
      <div class="text-center mb-7">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-sm mb-5" style="background-color: var(--color-primary-500);">
          <Cloud :size="22" :stroke-width="2" class="text-white" />
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-(--color-text)">
          创建账号
        </h1>
        <p class="text-sm mt-2 text-(--color-text-secondary)">
          加入 X Pan 分布式存储
        </p>
      </div>

      <!-- 表单卡片 -->
      <div class="quark-card p-7">
        <form class="space-y-5" @submit.prevent="doRegister">
          <!-- 用户名 -->
          <div>
            <label class="block text-sm font-medium mb-2 text-(--color-text)">用户名</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-(--color-text-muted)">
                <User :size="16" :stroke-width="2" />
              </div>
              <input
                v-model="registerForm.username"
                type="text"
                placeholder="6-16 位字母数字"
                autocomplete="username"
                class="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-sm border border-(--color-border) bg-(--color-surface) text-(--color-text) placeholder-(--color-text-muted) transition-colors duration-150 focus:outline-none focus:border-(--color-border-focus) focus:ring-2 focus:ring-(--color-ring)"
              />
            </div>
          </div>

          <!-- 密码 -->
          <div>
            <label class="block text-sm font-medium mb-2 text-(--color-text)">密码</label>
            <div class="relative mb-2">
              <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-(--color-text-muted)">
                <KeyRound :size="16" :stroke-width="2" />
              </div>
              <input
                v-model="registerForm.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="8-16 位字符"
                autocomplete="new-password"
                class="w-full pl-10 pr-10 py-2.5 text-sm rounded-sm border border-(--color-border) bg-(--color-surface) text-(--color-text) placeholder-(--color-text-muted) transition-colors duration-150 focus:outline-none focus:border-(--color-border-focus) focus:ring-2 focus:ring-(--color-ring)"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-(--color-text-muted) hover:text-(--color-text) transition-colors"
                @click="showPassword = !showPassword"
              >
                <Eye v-if="showPassword" :size="15" :stroke-width="2" />
                <EyeOff v-else :size="15" :stroke-width="2" />
              </button>
            </div>
            <!-- 夸克式密码强度条 -->
            <div v-if="registerForm.password" class="space-y-1.5">
              <div class="flex gap-1 h-1 rounded-full overflow-hidden bg-(--color-border)">
                <div
                  v-for="i in 3"
                  :key="i"
                  class="flex-1 rounded-full transition-colors duration-300"
                  :style="{ backgroundColor: passwordStrength.bars >= i ? passwordStrength.color : 'transparent' }"
                />
              </div>
              <p class="text-xs text-right font-medium" :style="{ color: passwordStrength.color || 'var(--color-text-muted)' }">
                密码强度: {{ passwordStrength.label }}
              </p>
            </div>
          </div>

          <!-- 确认密码 -->
          <div>
            <label class="block text-sm font-medium mb-2 text-(--color-text)">确认密码</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-(--color-text-muted)">
                <KeyRound :size="16" :stroke-width="2" />
              </div>
              <input
                v-model="registerForm.rePassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                placeholder="再次输入密码"
                autocomplete="new-password"
                class="w-full pl-10 pr-10 py-2.5 text-sm rounded-sm border bg-(--color-surface) text-(--color-text) placeholder-(--color-text-muted) transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-(--color-ring)"
                :style="{
                  borderColor: rePasswordError ? 'vardanger' : 'var(--color-border)',
                }"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-(--color-text-muted) hover:text-(--color-text) transition-colors"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                <Eye v-if="showConfirmPassword" :size="15" :stroke-width="2" />
                <EyeOff v-else :size="15" :stroke-width="2" />
              </button>
            </div>
            <p v-if="rePasswordError" class="text-xs mt-1.5 text-danger">{{ rePasswordError }}</p>
          </div>

          <!-- 注册按钮 -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full flex justify-center items-center h-10 rounded-sm text-sm font-medium transition-all duration-150 text-white mt-1"
            style="background-color: var(--color-primary-500);"
            :style="{ opacity: loading ? 0.7 : 1 }"
          >
            <svg v-if="loading" class="animate-spin size-4 mr-2" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ loading ? '注册中...' : '注册' }}
          </button>
        </form>

        <!-- 分隔线 -->
        <div class="mt-5 flex items-center gap-3">
          <div class="flex-1 h-px bg-(--color-border)" />
          <span class="text-xs text-(--color-text-muted)">已有账号？</span>
          <div class="flex-1 h-px bg-(--color-border)" />
        </div>

        <!-- 去登录 -->
        <button
          type="button"
          class="w-full flex justify-center items-center h-10 rounded-sm text-sm font-medium mt-5 transition-colors duration-150 border border-(--color-border) bg-(--color-surface) text-(--color-text) hover:bg-(--color-surface-2)"
          @click="goLogin"
        >
          去登录
        </button>
      </div>

      <!-- 底部协议 -->
      <p class="mt-6 text-center text-xs text-(--color-text-muted) leading-relaxed">
        注册即代表您已同意
        <router-link to="/agreement" class="text-primary-500 hover:underline">《服务协议》</router-link>
        和
        <router-link to="/privacy" class="text-primary-500 hover:underline">《隐私政策》</router-link>
      </p>
    </div>
  </div>
</template>
