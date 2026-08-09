<script setup>
/**
 * Error404 —— 404 错误页
 */
import {Compass, Home} from '@lucide/vue'
import BaseResult from '@/components/base/BaseResult.vue'
import BaseButton from '@/components/base/BaseButton.vue'

const goHome = () => (window.location.href = '/')
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
    <BaseResult status="warning" title="404 · 页面丢失" description="啊欧，您访问的页面被外星人带走了~">
      <template #extra>
        <BaseButton variant="primary" @click="goHome">
          <span class="inline-flex items-center gap-1.5"><Home :size="16"/>返回首页</span>
        </BaseButton>
      </template>
    </BaseResult>
  </div>
</template>