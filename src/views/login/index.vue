<script setup lang="ts">
/**
 * LoginPage —— 登录页（夸克风格重设计）
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
        () => {
          ElMessage.error('获取用户信息失败')
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
  <div class="min-h-screen flex items-center justify-center bg-[var(--color-bg)] relative overflow-hidden">
    <!-- 夸克风格背景:简洁渐变光斑 -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute top-[-15%] left-[-5%] w-[55%] h-[55%] rounded-full blur-[140px] opacity-[0.07]" style="background-color: var(--color-primary-500);" />
      <div class="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] rounded-full blur-[120px] opacity-[0.05]" style="background-color: var(--color-primary-700);" />
    </div>

    <div class="w-full max-w-[380px] mx-4 relative z-10">
      <!-- Logo 头部 -->
      <div class="text-center mb-7">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5" style="background-color: var(--color-primary-500);">
          <Cloud :size="22" :stroke-width="2" class="text-white" />
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-[var(--color-text)]">
          欢迎回来
        </h1>
        <p class="text-sm mt-2 text-[var(--color-text-secondary)]">
          登录您的账户以继续
        </p>
      </div>

      <!-- 表单卡片(夸克风格:浅背景+无大阴影) -->
      <div class="quark-card p-7">
        <form class="space-y-5" @submit.prevent="doLogin">
          <!-- 用户名 -->
          <div>
            <label class="block text-sm font-medium mb-2 text-[var(--color-text)]">
              用户名
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--color-text-muted)]">
                <User :size="16" :stroke-width="2" />
              </div>
              <input
                v-model="loginForm.username"
                type="text"
                placeholder="输入您的账号"
                autocomplete="username"
                class="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] transition-colors duration-150 focus:outline-none focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-ring)]"
              />
            </div>
          </div>

          <!-- 密码 -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-[var(--color-text)]">密码</label>
              <button
                type="button"
                class="text-xs transition-colors text-[var(--color-primary-500)] hover:text-[var(--color-primary-600)]"
                @click="goForget"
              >
                忘记密码？
              </button>
            </div>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--color-text-muted)]">
                <KeyRound :size="16" :stroke-width="2" />
              </div>
              <input
                v-model="loginForm.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="输入您的密码"
                autocomplete="current-password"
                class="w-full pl-10 pr-10 py-2.5 text-sm rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] transition-colors duration-150 focus:outline-none focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-ring)]"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                @click="showPassword = !showPassword"
              >
                <Eye v-if="showPassword" :size="15" :stroke-width="2" />
                <EyeOff v-else :size="15" :stroke-width="2" />
              </button>
            </div>
          </div>

          <!-- 登录按钮 -->
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
            {{ loading ? '登录中...' : '登录' }}
          </button>
        </form>

        <!-- 分隔线 -->
        <div class="mt-5 flex items-center gap-3">
          <div class="flex-1 h-px bg-[var(--color-border)]" />
          <span class="text-xs text-[var(--color-text-muted)]">还没有账号？</span>
          <div class="flex-1 h-px bg-[var(--color-border)]" />
        </div>

        <!-- 注册按钮 -->
        <button
          type="button"
          class="w-full flex justify-center items-center h-10 rounded-sm text-sm font-medium mt-5 transition-colors duration-150 border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
          @click="goRegister"
        >
          注册新账号
        </button>
      </div>

      <!-- 底部协议 -->
      <p class="mt-6 text-center text-xs text-[var(--color-text-muted)] leading-relaxed">
        登录即代表您已同意
        <router-link to="/agreement" class="text-[var(--color-primary-500)] hover:underline">《服务协议》</router-link>
        和
        <router-link to="/privacy" class="text-[var(--color-primary-500)] hover:underline">《隐私政策》</router-link>
      </p>
    </div>
  </div>
</template>
