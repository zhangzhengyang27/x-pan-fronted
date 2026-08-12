<script setup lang="ts">
/**
 * Error500 —— 500 错误页
 * 设计规范：stitch_document_driven_page_design/06_g6.md (G2)
 * - 大号"500"装饰数字（danger 色，opacity-5）
 * - Glass panel 卡片 + danger 边框
 * - Trace ID 显示
 */
import { Home, RefreshCw } from '@lucide/vue'

const reload = () => window.location.reload()
const goHome = () => (window.location.href = '/')
</script>

<template>
  <div class="min-h-screen flex items-center justify-center relative overflow-hidden bg-[var(--color-bg-dark)]">
    <!-- 背景网格装饰 -->
    <div
      class="absolute inset-0 z-0 opacity-20 pointer-events-none"
      style="background-image: radial-gradient(circle at center, var(--color-surface-variant) 1px, transparent 1px); background-size: 32px 32px;"
    />

    <!-- 500 View -->
    <div class="relative z-10 flex flex-col items-center justify-center w-full max-w-2xl px-gutter text-center">
      <!-- 大号背景数字 -->
      <div class="error-code-bg text-[var(--color-danger)]">500</div>

      <!-- Glass Panel 卡片 -->
      <div
        class="rounded-xl p-8 relative z-10 w-full max-w-md mx-auto transform hover:scale-[1.01] transition-transform duration-300 border-t-4"
        :class="'bg-[var(--color-surface-container-lowest)]/60 dark:bg-[var(--color-surface-container-low)]/60 backdrop-blur-xl border border-[var(--color-border)]/50 dark:border-[var(--color-border-dark)]/50'"
        style="border-top-color: var(--color-danger);"
      >
        <div
          class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          :class="'bg-[var(--color-error-container)]/20 border border-[var(--color-danger)]/30'"
        >
          <svg
            class="w-8 h-8"
            :class="'text-[var(--color-danger)]'"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 class="text-3xl font-bold mb-4 tracking-tight" :class="'text-[var(--color-text-dark)]'">
          服务器错误
        </h1>

        <p class="text-lg mb-8" :class="'text-[var(--color-text-muted-dark)]'">
          我们在处理您的请求时遇到了意外的节点错误。分布式存储网络正在尝试自我修复。
        </p>

        <!-- 重试按钮 -->
        <button
          type="button"
          class="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-sm text-sm font-medium transition-colors mb-4"
          :class="
            'bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/80 text-white'
          "
          @click="reload"
        >
          <RefreshCw :size="18" :stroke-width="2" />
          重试连接
        </button>

        <!-- Trace ID -->
        <div
          class="p-4 rounded text-left"
          :class="'bg-[var(--color-surface-container)] dark:bg-[var(--color-surface-container)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)]'"
        >
          <p class="text-xs font-mono mb-1" :class="'text-[var(--color-text-muted-dark)]'">
            Trace ID:
          </p>
          <code class="text-xs font-mono break-all" :class="'text-[var(--color-danger)]'">
            err_req_8f92a1b_cluster_timeout
          </code>
        </div>
      </div>

      <!-- 底部信息 -->
      <div class="mt-12 text-center z-10">
        <p class="text-xs font-mono" :class="'text-[var(--color-text-muted-dark)]'">
          X Pan Distributed Storage • Error: INTERNAL_SERVER_ERROR
        </p>
      </div>
    </div>

    <!-- 环境光晕 -->
    <div
      class="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] opacity-10 pointer-events-none transition-all duration-1000"
      :class="'bg-[var(--color-danger)]'"
    />
  </div>
</template>

<style scoped>
.error-code-bg {
  font-size: 12rem;
  line-height: 1;
  font-weight: 900;
  opacity: 0.05;
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
