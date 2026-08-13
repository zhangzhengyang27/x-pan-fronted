<script setup lang="ts">
/**
 * Error404 —— 404 错误页
 * 设计规范：G6 风格
 * - 大号"404"装饰数字（primary 色，低透明度）
 * - Glass panel 卡片
 * - 背景网格装饰
 */
import { Home, ArrowLeft, AlertCircle } from '@lucide/vue'

const goHome = () => (window.location.href = '/')
const goBack = () => window.history.back()
</script>

<template>
  <div class="min-h-screen flex items-center justify-center relative overflow-hidden bg-(--color-bg)">
    <!-- 背景网格装饰 -->
    <div
      class="absolute inset-0 z-0 opacity-20 pointer-events-none"
      style="background-image: radial-gradient(circle, var(--color-border-strong) 1px, transparent 1px); background-size: 32px 32px;"
    />

    <!-- 环境光晕 -->
    <div
      class="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] opacity-10 pointer-events-none"
      style="background-color: var(--color-primary-500);"
    />
    <div
      class="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-[120px] opacity-5 pointer-events-none"
      style="background-color: varwarning;"
    />

    <!-- 404 View -->
    <div class="relative z-10 flex flex-col items-center justify-center w-full max-w-2xl px-gutter text-center">
      <!-- 大号背景数字 -->
      <div class="error-code-bg text-primary-500">404</div>

      <!-- Glass Panel 卡片 -->
      <div
        class="rounded-sm p-8 relative z-10 w-full max-w-md mx-auto transform hover:scale-[1.01] transition-transform duration-300"
        style="background: var(--color-surface-container-low); border: 1px solid var(--color-border);"
      >
        <div
          class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style="background-color: var(--color-surface-container-high); border: 1px solid var(--color-border-strong);"
        >
          <AlertCircle :size="32" :stroke-width="2" style="color: varwarning;" />
        </div>

        <h1 class="text-3xl font-bold mb-4 tracking-tight text-(--color-text)">
          页面不存在
        </h1>

        <p class="text-base mb-8 text-(--color-text-muted)">
          您寻找的文件或页面似乎已经漂流到数字虚空之中。请检查链接是否正确。
        </p>

        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            type="button"
            class="flex items-center justify-center gap-2 py-3 px-6 rounded-sm text-sm font-medium transition-colors border border-(--color-border) bg-(--color-surface-2) text-(--color-text) hover:bg-(--color-surface-container-high)"
            @click="goBack"
          >
            <ArrowLeft :size="18" :stroke-width="2" />
            返回上一页
          </button>

          <button
            type="button"
            class="flex items-center justify-center gap-2 py-3 px-6 rounded-sm text-sm font-medium transition-colors bg-primary-500 text-white hover:opacity-90"
            @click="goHome"
          >
            <Home :size="18" :stroke-width="2" />
            返回首页
          </button>
        </div>
      </div>

      <!-- 底部信息 -->
      <div class="mt-12 text-center z-10">
        <p class="text-xs font-mono text-(--color-text-muted)">
          X Pan Distributed Storage • Error: NOT_FOUND_404
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error-code-bg {
  font-size: 12rem;
  line-height: 1;
  font-weight: 900;
  opacity: 0.08;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 0;
  pointer-events: none;
  user-select: none;
  letter-spacing: -0.05em;
}
</style>
