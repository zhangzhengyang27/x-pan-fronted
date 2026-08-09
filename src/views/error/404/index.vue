<script setup>
/**
 * Error404 —— 404 错误页（带插画）
 */
import { Home, Compass } from '@lucide/vue'
import BaseResult from '@/components/base/BaseResult.vue'
import BaseButton from '@/components/base/BaseButton.vue'

const goHome = () => (window.location.href = '/')
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-6">
    <div class="max-w-md w-full text-center">
      <!-- 装饰插画 -->
      <div class="relative mb-8">
        <div class="absolute inset-0 flex items-center justify-center">
          <div
            class="size-72 rounded-full bg-gradient-to-br from-[var(--color-primary-100)] to-transparent dark:from-[var(--color-primary-900)]/30 blur-2xl"
          />
        </div>
        <svg
          class="relative mx-auto"
          width="220"
          height="180"
          viewBox="0 0 220 180"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <!-- 漂浮星球 -->
          <circle cx="170" cy="50" r="38" fill="url(#planet)" opacity="0.9" />
          <defs>
            <radialGradient id="planet" cx="0.3" cy="0.3" r="0.8">
              <stop offset="0%" stop-color="var(--color-primary-300)" />
              <stop offset="60%" stop-color="var(--color-primary-500)" />
              <stop offset="100%" stop-color="var(--color-primary-700)" />
            </radialGradient>
          </defs>

          <!-- 行星环 -->
          <ellipse
            cx="170"
            cy="50"
            rx="60"
            ry="14"
            stroke="var(--color-primary-300)"
            stroke-width="1.5"
            fill="none"
            opacity="0.6"
            transform="rotate(-20 170 50)"
          />

          <!-- 小星星 -->
          <g class="animate-pulse">
            <circle cx="40" cy="30" r="2" fill="var(--color-primary-400)" />
            <circle cx="200" cy="120" r="1.5" fill="var(--color-primary-500)" />
            <circle cx="60" cy="140" r="1" fill="var(--color-primary-400)" />
          </g>

          <!-- 404 数字 -->
          <text
            x="110"
            y="125"
            text-anchor="middle"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="84"
            font-weight="700"
            fill="var(--color-text)"
            letter-spacing="-4"
          >
            404
          </text>

          <!-- 漂浮小行星 -->
          <circle cx="20" cy="100" r="6" fill="var(--color-primary-400)" opacity="0.7">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 8,4; 0,0"
              dur="4s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="210" cy="160" r="4" fill="var(--color-primary-500)" opacity="0.6">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; -6,3; 0,0"
              dur="5s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      </div>

      <h1 class="text-2xl font-semibold text-[var(--color-text)] mb-2">页面去外太空旅行了</h1>
      <p class="text-sm text-[var(--color-text-muted)] mb-8 leading-relaxed">
        您访问的页面暂时找不到，<br />检查一下网址是否正确，或者返回首页继续探索。
      </p>

      <BaseButton variant="primary" size="lg" @click="goHome">
        <span class="inline-flex items-center gap-2"><Home :size="16" />返回首页</span>
      </BaseButton>
    </div>
  </div>
</template>
