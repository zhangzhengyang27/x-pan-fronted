<template>
  <router-view />
  <ConfirmHost />
  <ShortcutsPanel />
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import ConfirmHost from '@/components/confirm-host/index.vue'
import ShortcutsPanel from '@/components/base/ShortcutsPanel.vue'
import { useShortcuts } from '@/composables/useShortcuts'

// 全局快捷键（Ctrl+K / G 系列导航 / 文件操作派发）
useShortcuts()
</script>

<style scoped></style>
