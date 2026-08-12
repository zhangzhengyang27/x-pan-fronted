<script setup lang="ts">
import { computed } from 'vue'
import { UploadCloud } from '@lucide/vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { useTaskStore } from '@/stores/task'

const taskStore = useTaskStore()

const uploadingCount = computed(() => taskStore.uploadTaskList.filter(t => t.status === 1).length)
</script>

<template>
  <div class="relative">
    <BaseButton
      type="text"
      size="small"
      :icon="UploadCloud"
      @click="taskStore.togglePanel"
    />
    <span
      v-if="uploadingCount > 0"
      class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white"
    >
      {{ uploadingCount }}
    </span>
  </div>
</template>

<style scoped>
</style>
