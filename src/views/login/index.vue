<script setup lang="ts">
/**
 * LoginPage —— 登录页
 * 设计规范：r_pan_1/code.html + 01_g1.md
 * - 左侧品牌区（桌面端 lg:w-1/2）
 * - 右侧表单区（移动端全宽）
 */
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Cloud, User, KeyRound, LogIn, Eye, EyeOff } from '@lucide/vue'
import { ElMessage } from '@/composables/useToast'
import userService from '@/api/user'
import { setToken } from '@/utils/cookie'
import { useFileStore } from '@/stores/file'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const loading = ref(false)
const showPassword = ref(false)

const loginForm = reactive({ username: '', password: '' })
const fileStore = useFileStore()
const userStore = useUserStore()
const { setParentId, setDefaultParentId, setDefaultParentFilename } = fileStore
const { setUsername } = userStore

function doLogin() {
  if (!loginForm.username) return ElMessage.error('请输入用户名')
  if (!loginForm.password) return ElMessage.error('请输入密码')
  loading.value = true
  userService.login(
    loginForm,
    (res) => {
      setToken(res.data)
      userService.info(
        (res) => {
          setParentId(res.data.rootFileId)
          setDefaultParentId(res.data.rootFileId)
          setDefaultParentFilename(res.data.rootFilename)
          setUsername(res.data.username)
          loading.value = false
          router.push({ name: 'Index' })
        },
        (res) => {
          ElMessage.error(res.message)
          loading.value = false
        }
      )
    },
    (res) => {
      ElMessage.error(res.message)
      loading.value = false
    }
  )
}

const goForget = () => router.push({ name: 'Forget' })
const goRegister = () => router.push({ name: 'Register' })

onMounted(() => {
  const input = document.querySelector('input[placeholder="输入您的账号"]') as HTMLInputElement
  input?.focus()
})
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
          欢迎回来
        </h1>
        <p class="text-base mt-2 text-[var(--color-text-muted)]">
          请登录您的账户以继续访问
        </p>
      </div>

      <!-- 表单卡片 -->
      <div
        class="rounded-xl p-8 shadow-2xl"
        style="background: var(--color-surface-container-low); border: 1px solid var(--color-border);"
      >
        <form class="space-y-6" @submit.prevent="doLogin">
          <!-- 用户名字段 -->
          <div>
            <label class="block text-sm font-medium mb-2 text-[var(--color-text)]">
              用户名或邮箱
            </label>
            <div class="relative">
              <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]"
              >
                <User :size="18" :stroke-width="2" />
              </div>
              <input
                v-model="loginForm.username"
                type="text"
                placeholder="输入您的账号"
                autocomplete="username"
                class="w-full pl-10 pr-3 py-2 text-sm rounded-lg transition-all duration-200 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent"
              />
            </div>
          </div>

          <!-- 密码字段 -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-[var(--color-text)]">
                密码
              </label>
              <button
                type="button"
                class="text-sm transition-colors text-[var(--color-primary-200)] hover:text-[var(--color-primary-100)]"
                @click="goForget"
              >
                忘记密码？
              </button>
            </div>
            <div class="relative">
              <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]"
              >
                <KeyRound :size="18" :stroke-width="2" />
              </div>
              <input
                v-model="loginForm.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="输入您的密码"
                autocomplete="current-password"
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
          </div>

          <!-- 提交按钮 -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 bg-[var(--color-primary-500)] text-white hover:opacity-90 hover:bg-[var(--color-primary-600)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading" class="inline-flex items-center gap-2">
              <svg class="animate-spin size-4" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              登录中...
            </span>
            <span v-else class="inline-flex items-center gap-2">
              <LogIn :size="16" :stroke-width="2" />
              登录
            </span>
          </button>
        </form>

        <!-- 分隔线 -->
        <div class="mt-6 flex items-center">
          <div class="w-full h-px bg-[var(--color-border)]" />
          <div class="px-3 text-xs whitespace-nowrap text-[var(--color-text-muted)]">
            还没有账号？
          </div>
          <div class="w-full h-px bg-[var(--color-border)]" />
        </div>

        <!-- 注册按钮 -->
        <div class="mt-6">
          <button
            type="button"
            class="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]"
            @click="goRegister"
          >
            注册新账号
          </button>
        </div>
      </div>

      <!-- 底部说明 -->
      <p class="mt-8 text-center text-xs text-[var(--color-text-muted)]">
        登录即代表您已同意
        <router-link to="/agreement" class="text-[var(--color-primary-200)] hover:underline">《服务协议》</router-link>
        和
        <router-link to="/privacy" class="text-[var(--color-primary-200)] hover:underline">《隐私政策》</router-link>
      </p>
    </div>
  </div>
</template>
