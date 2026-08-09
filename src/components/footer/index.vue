<script setup>
/**
 * AppFooter —— 极简底部
 */
const year = new Date().getFullYear()
</script>

<template>
  <footer
    class="h-12 px-6 flex items-center justify-between text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)] bg-[var(--color-surface)]"
  >
    <span>© {{ year }} R Pan · 个人分布式存储</span>
    <span class="flex items-center gap-3">
      <a class="hover:text-[var(--color-text)] transition-colors" href="javascript:void(0)">关于</a>
      <a class="hover:text-[var(--color-text)] transition-colors" href="javascript:void(0)">协议</a>
      <span class="text-[var(--color-border-strong)]">v0.1.0</span>
    </span>
  </footer>
</template>