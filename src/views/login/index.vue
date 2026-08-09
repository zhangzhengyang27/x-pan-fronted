<script setup>
/**
 * LoginPage —— 登录页
 */
import {onMounted, reactive, ref} from 'vue'
import {useRouter} from 'vue-router'
import {Cloud, User, KeyRound, LogIn} from '@lucide/vue'
import {ElMessage} from '@/composables/useToast'
import userService from '@/api/user'
import {setToken} from '@/utils/cookie'
import {useFileStore} from '@/stores/file'
import {useUserStore} from '@/stores/user'

import BaseField from '@/components/base/BaseField.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseButton from '@/components/base/BaseButton.vue'

const router = useRouter()
const loading = ref(false)

const loginForm = reactive({username: '', password: ''})
const fileStore = useFileStore()
const userStore = useUserStore()
const {setParentId, setDefaultParentId, setDefaultParentFilename} = fileStore
const {setUsername} = userStore

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
          router.push({name: 'Index'})
        },
        (res) => {
          ElMessage.error(res.message)
          loading.value = false
        },
      )
    },
    (res) => {
      ElMessage.error(res.message)
      loading.value = false
    },
  )
}

const goForget = () => router.push({name: 'Forget'})
const goRegister = () => router.push({name: 'Register'})

onMounted(() => {
  // 自动聚焦
})
</script>

<template>
  <div class="min-h-screen flex items-stretch bg-[var(--color-bg)]">
    <!-- 左侧品牌区 -->
    <div class="hidden lg:flex flex-col justify-between p-12 lg:w-1/2 bg-gradient-to-br from-[var(--color-primary-600)] to-[var(--color-primary-800)] text-white relative overflow-hidden">
      <!-- 装饰 -->
      <div class="absolute -top-32 -right-32 size-96 rounded-full bg-white/10 blur-3xl"/>
      <div class="absolute -bottom-32 -left-32 size-96 rounded-full bg-white/10 blur-3xl"/>

      <div class="relative flex items-center gap-2.5">
        <div class="size-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
          <Cloud :size="22" :stroke-width="2.25"/>
        </div>
        <span class="text-xl font-semibold tracking-tight">R Pan</span>
      </div>

      <div class="relative">
        <h1 class="text-4xl xl:text-5xl font-bold leading-tight tracking-tight mb-4">
          个人分布式存储<br/>随时随地，安全可靠
        </h1>
        <p class="text-white/80 text-base max-w-md leading-relaxed">
          统一管理您的文件、图片、视频与音乐，支持多端同步、加密分享与回收站。
        </p>
      </div>

      <div class="relative text-xs text-white/60">© R Pan · 自托管个人云盘</div>
    </div>

    <!-- 右侧表单 -->
    <div class="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">
      <div class="w-full max-w-sm">
        <h2 class="text-2xl font-semibold text-[var(--color-text)] mb-1">登录</h2>
        <p class="text-sm text-[var(--color-text-muted)] mb-8">输入您的账号信息继续</p>

        <form class="flex flex-col gap-4" @submit.prevent="doLogin">
          <BaseField label="用户名">
            <BaseInput v-model="loginForm.username" placeholder="请输入用户名" :prefix="User" @enter="doLogin"/>
          </BaseField>

          <BaseField label="密码">
            <BaseInput v-model="loginForm.password" type="password" show-password placeholder="请输入密码" :prefix="KeyRound" @enter="doLogin"/>
          </BaseField>

          <div class="flex items-center justify-between text-sm">
            <button type="button" class="text-[var(--color-primary-600)] hover:underline" @click="goForget">忘记密码？</button>
          </div>

          <BaseButton variant="primary" size="lg" :loading="loading" block @click="doLogin">
            <span class="inline-flex items-center gap-2"><LogIn :size="16"/> 登录</span>
          </BaseButton>
        </form>

        <div class="my-8 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          <span class="flex-1 h-px bg-[var(--color-border)]"/>
          <span>还没有账号？</span>
          <span class="flex-1 h-px bg-[var(--color-border)]"/>
        </div>

        <BaseButton variant="secondary" size="lg" block @click="goRegister">注册新账号</BaseButton>
      </div>
    </div>
  </div>
</template>