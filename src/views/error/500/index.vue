<script setup>
/**
 * Error500 —— 500 错误页
 */
import { ServerCrash, Home, RotateCcw } from '@lucide/vue'
import BaseResult from '@/components/base/BaseResult.vue'
import BaseButton from '@/components/base/BaseButton.vue'

const goHome = () => (window.location.href = '/')
const reload = () => window.location.reload()
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
    <BaseResult
      status="error"
      title="500 · 服务器开了个小差"
      description="我们的工程师已收到通知，请稍后再试"
    >
      <template #extra>
        <BaseButton variant="secondary" @click="reload">
          <span class="inline-flex items-center gap-1.5"><RotateCcw :size="16" />刷新</span>
        </BaseButton>
        <BaseButton variant="primary" @click="goHome">
          <span class="inline-flex items-center gap-1.5"><Home :size="16" />返回首页</span>
        </BaseButton>
      </template>
    </BaseResult>
  </div>
</template>
