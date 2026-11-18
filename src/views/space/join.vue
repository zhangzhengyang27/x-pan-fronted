<script setup lang="ts">
/**
 * JoinSpacePage —— 通过邀请链接加入团队空间
 */
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Cloud, Users, Loader2, CheckCircle2, AlertCircle } from '@lucide/vue'
import spaceService from '@/api/space'
import { useSpaceStore } from '@/stores/space'
import type { ISpaceInvitePreviewVO, ISpaceVO } from '@/types'

const route = useRoute()
const router = useRouter()
const spaceStore = useSpaceStore()

const loading = ref(true)
const joining = ref(false)
const preview = ref<ISpaceInvitePreviewVO | null>(null)
const error = ref('')

const inviteCode = String(route.query.code || '').trim()

onMounted(() => {
  if (!inviteCode) {
    loading.value = false
    error.value = '邀请链接缺少邀请码'
    return
  }
  spaceService.previewInvite(
    inviteCode,
    (res) => {
      preview.value = res.data
      loading.value = false
    },
    (res) => {
      error.value = res.message || '邀请无效或已过期'
      loading.value = false
    }
  )
})

function doJoin(): void {
  if (!inviteCode) return
  joining.value = true
  spaceService.join(
    { inviteCode },
    (res: { data: ISpaceVO }) => {
      const space = res.data
      // 加入成功：刷新空间列表并切换到该团队空间
      spaceStore.loadSpaces().then(() => {
        spaceStore.switchSpace(space.spaceId)
      })
    },
    (res) => {
      joining.value = false
      error.value = res.message || '加入失败'
    }
  )
}

function goHome(): void {
  router.push('/files')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-(--color-bg) relative overflow-hidden">
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute top-[-15%] left-[-5%] w-[55%] h-[55%] rounded-full blur-[140px] opacity-[0.07]" style="background-color: var(--color-primary-500);" />
    </div>

    <div class="w-full max-w-[420px] mx-4 relative z-10">
      <div class="text-center mb-7">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5" style="background-color: var(--color-primary-500);">
          <Cloud :size="22" :stroke-width="2" class="text-white" />
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-(--color-text)">加入团队空间</h1>
      </div>

      <div class="quark-card p-7">
        <div v-if="loading" class="flex items-center justify-center gap-2 py-8 text-sm text-(--color-text-muted)">
          <Loader2 :size="16" class="animate-spin" />
          正在校验邀请…
        </div>

        <template v-else-if="error">
          <div class="flex flex-col items-center gap-3 py-4 text-center">
            <AlertCircle :size="28" :stroke-width="1.75" style="color: var(--color-danger)" />
            <p class="text-sm text-(--color-text-secondary)">{{ error }}</p>
            <button
              type="button"
              class="mt-2 h-9 px-4 rounded-sm text-sm text-white"
              style="background-color: var(--color-primary-500);"
              @click="goHome"
            >
              返回我的文件
            </button>
          </div>
        </template>

        <template v-else-if="preview">
          <div class="flex flex-col items-center gap-2 py-2 text-center">
            <div class="size-14 rounded-2xl flex items-center justify-center" style="background-color: var(--color-fill);">
              <Users :size="26" :stroke-width="1.75" />
            </div>
            <div class="text-lg font-semibold text-(--color-text)">{{ preview.spaceName }}</div>
            <div class="text-xs text-(--color-text-muted)">
              {{ preview.ownerUsername }} 创建的团队空间 · {{ preview.memberCount }} 名成员
            </div>
            <div class="text-xs text-(--color-text-muted)">邀请人：{{ preview.inviterUsername }}</div>
          </div>

          <div v-if="preview.alreadyMember" class="mt-5">
            <div class="flex items-center justify-center gap-2 text-sm mb-4" style="color: var(--color-success)">
              <CheckCircle2 :size="16" :stroke-width="1.75" />
              你已经是该空间成员
            </div>
            <button
              type="button"
              class="w-full h-10 rounded-sm text-sm font-medium text-white"
              style="background-color: var(--color-primary-500);"
              @click="spaceStore.switchSpace(preview.spaceId)"
            >
              进入空间
            </button>
          </div>
          <button
            v-else
            type="button"
            :disabled="joining"
            class="w-full h-10 mt-6 rounded-sm text-sm font-medium text-white flex items-center justify-center gap-2"
            style="background-color: var(--color-primary-500);"
            :style="{ opacity: joining ? 0.7 : 1 }"
            @click="doJoin"
          >
            <Loader2 v-if="joining" :size="15" class="animate-spin" />
            {{ joining ? '加入中…' : '加入空间' }}
          </button>
          <button
            type="button"
            class="w-full h-9 mt-2 rounded-sm text-xs text-(--color-text-secondary) hover:bg-(--color-hover)"
            @click="goHome"
          >
            暂不加入
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
