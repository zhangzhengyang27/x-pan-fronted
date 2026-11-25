<script setup lang="ts">
import { computed } from 'vue'
import { UploadCloud } from '@lucide/vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { useTaskStore } from '@/stores/task'

const taskStore = useTaskStore()

// 进行中 = 解析(1)/等待(2)/上传中(3)/服务器处理中(7)；只统计 1 会导致真正上传时徽标消失
const uploadingCount = computed(() => taskStore.uploadTaskList.filter(t => [1, 2, 3, 7].includes(t.status)).length)
</script>

<template>
  <div class="relative">
    <BaseButton
      variant="ghost"
      size="sm"
      :icon="UploadCloud"
      @click="taskStore.togglePanel"
    />
    <span
      v-if="uploadingCount > 0"
      class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--color-danger-action) px-1 text-[10px] text-white"
    >
      {{ uploadingCount }}
    </span>
  </div>
</template>

<style scoped>
</style>
