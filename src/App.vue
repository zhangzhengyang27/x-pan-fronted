<template>
  <router-view />
  <ConfirmHost />
  <ShortcutsPanel />
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import ConfirmHost from '@/components/confirm-host/index.vue'
import ShortcutsPanel from '@/components/base/ShortcutsPanel.vue'
</script>

<style scoped></style>
