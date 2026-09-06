<script setup lang="ts">
/**
 * ForgetPage —— 忘记密码（重置密码）
 * 设计规范：r_pan_3/code.html + 01_g1.md (A3)
 * - 布局：单列居中（max-w-lg），顶部 simple-header
 * - 步骤条（4步）
 * - 密码强度指示器
 */
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { User, KeyRound, Check } from '@lucide/vue'
import SimpleHeader from '@/components/simple-header/index.vue'
import { ElMessage } from '@/composables/useToast'
import userService from '@/api/user'

const router = useRouter()
const loading = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)

// 步骤配置
const steps = [
  { title: '账号', description: '输入用户名' },
  { title: '验证', description: '验证身份' },
  { title: '重置', description: '重置密码' },
  { title: '完成', description: '密码已重置' }
]

const currentStep = ref(0)

// 表单数据
const form = reactive({
  username: '',
  verifyCode: '',
  password: '',
  rePassword: ''
})

// 倒计时
const countdown = ref(0)
let countdownTimer = null

const countdownText = computed(() => {
  if (countdown.value <= 0) return '重新发送'
  return `${countdown.value}s`
})

function startCountdown() {
  countdown.value = 60
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(countdownTimer)
    }
  }, 1000)
}

// 密码强度计算
const passwordStrength = computed(() => {
  const pwd = form.password
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

// 步骤验证
const canNextStep1 = computed(() => form.username.trim().length > 0)
const canNextStep2 = computed(() => form.verifyCode.trim().length === 4)
const canNextStep3 = computed(() => {
  return form.password.length >= 8 && form.password.length <= 16 && form.password === form.rePassword
})

// 下一步
function nextStep() {
  if (currentStep.value === 0) {
    if (!form.username) return ElMessage.error('请输入用户名')
    loading.value = true
    setTimeout(() => {
      loading.value = false
      currentStep.value = 1
      startCountdown()
      ElMessage.success('验证码已发送')
    }, 500)
  } else if (currentStep.value === 1) {
    if (!form.verifyCode) return ElMessage.error('请输入验证码')
    if (form.verifyCode.length !== 4) return ElMessage.error('验证码为4位数字')
    currentStep.value = 2
  } else if (currentStep.value === 2) {
    if (form.password.length < 8 || form.password.length > 16)
      return ElMessage.error('密码为 8-16 位')
    if (form.password !== form.rePassword) return ElMessage.error('两次密码不一致')
    loading.value = true
    userService.resetPassword(
      { username: form.username, answer: form.verifyCode, newPassword: form.password },
      () => {
        loading.value = false
        currentStep.value = 3
        ElMessage.success('密码重置成功')
      },
      (res) => {
        loading.value = false
        ElMessage.error(res.message)
      }
    )
  }
}

// 上一步
function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

// 完成 - 跳转登录
function goLogin() {
  router.push({ name: 'Login' })
}

const goLoginLink = () => router.push({ name: 'Login' })
</script>

<template>
  <div class="min-h-screen flex flex-col bg-(--color-bg)">
    <!-- Simple Header -->
    <SimpleHeader />

    <!-- Main Content -->
    <main class="flex-grow flex items-center justify-center p-gutter">
      <div class="w-full max-w-lg">
        <!-- Steps -->
        <div class="mb-12">
          <ol class="flex items-center w-full">
            <!-- Step 1 -->
            <li class="flex w-full items-center text-primary-200">
              <span
                class="flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full shrink-0 bg-primary-200"
              >
                <span class="text-sm font-bold text-(--color-bg)">1</span>
              </span>
              <span
                v-if="0 < currentStep"
                class="flex-grow h-1 border-b-4 border-primary-200"
              />
              <span
                v-else
                class="flex-grow h-1 border-b-4 border-(--color-border)"
              />
            </li>
            <!-- Step 2 -->
            <li class="flex w-full items-center" :class="currentStep >= 1 ? 'text-primary-200' : 'text-(--color-text-muted)'">
              <span
                v-if="currentStep > 1"
                class="flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full shrink-0 bg-primary-200"
              >
                <Check :size="16" :stroke-width="3" class="text-(--color-bg)" />
              </span>
              <span
                v-else
                class="flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full shrink-0 border-2 border-(--color-border) bg-(--color-surface-container-high)"
              >
                <span class="text-sm text-(--color-text-muted)">2</span>
              </span>
              <span
                v-if="1 < currentStep"
                class="flex-grow h-1 border-b-4 border-primary-200"
              />
              <span
                v-else-if="currentStep >= 1"
                class="flex-grow h-1 border-b-4 border-(--color-border)"
              />
            </li>
            <!-- Step 3 -->
            <li class="flex w-full items-center" :class="currentStep >= 2 ? 'text-primary-200' : 'text-(--color-text-muted)'">
              <span
                v-if="currentStep > 2"
                class="flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full shrink-0 bg-primary-200"
              >
                <Check :size="16" :stroke-width="3" class="text-(--color-bg)" />
              </span>
              <span
                v-else
                class="flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full shrink-0 border-2 border-(--color-border) bg-(--color-surface-container-high)"
              >
                <span class="text-sm text-(--color-text-muted)">3</span>
              </span>
              <span
                v-if="2 < currentStep"
                class="flex-grow h-1 border-b-4 border-primary-200"
              />
              <span
                v-else-if="currentStep >= 2"
                class="flex-grow h-1 border-b-4 border-(--color-border)"
              />
            </li>
            <!-- Step 4 -->
            <li class="flex items-center" :class="currentStep >= 3 ? 'text-primary-200' : 'text-(--color-text-muted)'">
              <span
                v-if="currentStep > 3"
                class="flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full shrink-0 bg-primary-200"
              >
                <Check :size="16" :stroke-width="3" class="text-(--color-bg)" />
              </span>
              <span
                v-else
                class="flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full shrink-0 border-2 border-(--color-border) bg-(--color-surface-container-high)"
              >
                <span class="text-sm text-(--color-text-muted)">4</span>
              </span>
            </li>
          </ol>
          <div class="flex justify-between mt-2 px-2">
            <span class="text-xs font-medium text-primary-200">账号</span>
            <span class="text-xs font-medium ml-4" :class="currentStep >= 1 ? 'text-primary-200' : 'text-(--color-text-muted)'">验证</span>
            <span class="text-xs font-medium ml-6" :class="currentStep >= 2 ? 'text-primary-200' : 'text-(--color-text-muted)'">重置</span>
            <span class="text-xs font-medium" :class="currentStep >= 3 ? 'text-primary-200' : 'text-(--color-text-muted)'">完成</span>
          </div>
        </div>

        <!-- Card Container -->
        <div
          class="rounded-sm p-8 bg-(--color-surface) border border-(--color-border)"
        >
          <!-- Step 1: Username -->
          <div v-if="currentStep === 0">
            <div class="mb-6 text-center">
              <h1 class="text-xl font-semibold mb-2 text-(--color-text)">
                找回密码
              </h1>
              <p class="text-sm text-(--color-text-muted)">
                请输入您的用户名或绑定的邮箱地址
              </p>
            </div>
            <div class="space-y-6">
              <div>
                <label class="block text-sm font-medium mb-2 text-(--color-text)">
                  用户名 / 邮箱
                </label>
                <div class="relative">
                  <div
                    class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-(--color-text-muted)"
                  >
                    <User :size="20" :stroke-width="2" />
                  </div>
                  <input
                    v-model="form.username"
                    type="text"
                    placeholder="输入账号信息"
                    class="w-full rounded pl-10 pr-4 py-2 text-sm transition-all duration-200 bg-(--color-surface-2) border border-(--color-border) text-(--color-text) placeholder-(--color-text-muted) focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <button
                type="button"
                class="w-full py-2.5 px-4 rounded text-sm font-medium transition-colors duration-200 bg-primary-500 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!canNextStep1"
                @click="nextStep"
              >
                下一步
              </button>
              <div class="text-center mt-4">
                <button
                  type="button"
                  class="text-sm transition-colors text-(--color-text-muted) hover:text-primary-200"
                  @click="goLoginLink"
                >
                  记起密码了？返回登录
                </button>
              </div>
            </div>
          </div>

          <!-- Step 2: Verify -->
          <div v-if="currentStep === 1">
            <div class="mb-6 text-center">
              <h1 class="text-xl font-semibold mb-2 text-(--color-text)">
                验证身份
              </h1>
              <p class="text-sm text-(--color-text-muted)">
                验证码已发送至您注册的邮箱
              </p>
            </div>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-2 text-(--color-text)">
                  验证码
                </label>
                <div class="relative">
                  <input
                    v-model="form.verifyCode"
                    type="text"
                    placeholder="请输入验证码"
                    maxlength="4"
                    class="w-full rounded py-2 px-4 pr-24 text-sm text-center font-mono tracking-[0.5em] transition-all duration-200 bg-(--color-surface-2) border border-(--color-border) text-(--color-text) placeholder-(--color-text-muted) focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-sm transition-colors text-primary-200 disabled:opacity-50"
                    :disabled="countdown > 0"
                    @click="startCountdown"
                  >
                    {{ countdownText }}
                  </button>
                </div>
              </div>
              <div class="flex gap-3">
                <button
                  type="button"
                  class="flex-1 py-2.5 px-4 rounded text-sm font-medium border transition-colors duration-200 border-(--color-border) text-(--color-text) hover:bg-(--color-surface-2)"
                  @click="prevStep"
                >
                  上一步
                </button>
                <button
                  type="button"
                  class="flex-1 py-2.5 px-4 rounded text-sm font-medium transition-colors duration-200 bg-primary-500 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="!canNextStep2"
                  @click="nextStep"
                >
                  下一步
                </button>
              </div>
            </div>
          </div>

          <!-- Step 3: Reset Password -->
          <div v-if="currentStep === 2">
            <div class="mb-6 text-center">
              <h1 class="text-xl font-semibold mb-2 text-(--color-text)">
                重置密码
              </h1>
              <p class="text-sm text-(--color-text-muted)">
                请设置您的新密码
              </p>
            </div>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-2 text-(--color-text)">
                  新密码
                </label>
                <div class="relative mb-2">
                  <div
                    class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-(--color-text-muted)"
                  >
                    <KeyRound :size="20" :stroke-width="2" />
                  </div>
                  <input
                    v-model="form.password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="至少 8 位字符"
                    class="w-full rounded pl-10 pr-10 py-2 text-sm transition-all duration-200 bg-(--color-surface-2) border border-(--color-border) text-(--color-text) placeholder-(--color-text-muted) focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    class="absolute inset-y-0 right-0 pr-3 flex items-center transition-colors text-(--color-text-muted) hover:text-(--color-text)"
                    @click="showPassword = !showPassword"
                  >
                    <svg v-if="showPassword" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-8-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
                <!-- Password Strength -->
                <div v-if="form.password">
                  <div class="flex gap-1 h-1.5 w-full rounded-full overflow-hidden bg-(--color-border)">
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
              <div>
                <label class="block text-sm font-medium mb-2 text-(--color-text)">
                  确认密码
                </label>
                <div class="relative">
                  <div
                    class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-(--color-text-muted)"
                  >
                    <KeyRound :size="20" :stroke-width="2" />
                  </div>
                  <input
                    v-model="form.rePassword"
                    :type="showConfirmPassword ? 'text' : 'password'"
                    placeholder="再次输入密码"
                    class="w-full rounded pl-10 pr-10 py-2 text-sm transition-all duration-200 bg-(--color-surface-2) border border-(--color-border) text-(--color-text) placeholder-(--color-text-muted) focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    class="absolute inset-y-0 right-0 pr-3 flex items-center transition-colors text-(--color-text-muted) hover:text-(--color-text)"
                    @click="showConfirmPassword = !showConfirmPassword"
                  >
                    <svg v-if="showConfirmPassword" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-8-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="flex gap-3">
                <button
                  type="button"
                  class="flex-1 py-2.5 px-4 rounded text-sm font-medium border transition-colors duration-200 border-(--color-border) text-(--color-text) hover:bg-(--color-surface-2)"
                  @click="prevStep"
                >
                  上一步
                </button>
                <button
                  type="button"
                  class="flex-1 py-2.5 px-4 rounded text-sm font-medium transition-colors duration-200 bg-primary-500 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="!canNextStep3 || loading"
                  @click="nextStep"
                >
                  提交
                </button>
              </div>
            </div>
          </div>

          <!-- Step 4: Success -->
          <div v-if="currentStep === 3" class="text-center py-8">
            <div
              class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style="background-color: rgba(16, 185, 129, 0.1);"
            >
              <Check :size="32" :stroke-width="2" style="color: var(--color-success);" />
            </div>
            <h2 class="text-xl font-semibold mb-2 text-(--color-text)">
              密码重置成功
            </h2>
            <p class="text-sm mb-8 text-(--color-text-muted)">
              您已成功重置密码，现在可以使用新密码登录
            </p>
            <button
              type="button"
              class="inline-flex items-center gap-2 py-2.5 px-6 rounded text-sm font-medium transition-colors duration-200 bg-primary-500 text-white hover:opacity-90"
              @click="goLogin"
            >
              <Check :size="16" :stroke-width="2" />
              去登录
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer
      class="w-full py-4 px-gutter flex justify-between items-center border-t border-(--color-border) bg-(--color-bg) text-(--color-text-muted)"
    >
      <div class="text-xs">
        © 2024 X Pan Distributed Storage. All rights reserved.
      </div>
      <div class="flex gap-4">
        <a href="#" class="text-xs transition-colors hover:text-primary-200">存储统计</a>
        <a href="#" class="text-xs transition-colors hover:text-primary-200">系统状态</a>
        <a href="#" class="text-xs transition-colors hover:text-primary-200">API 文档</a>
      </div>
    </footer>
  </div>
</template>
