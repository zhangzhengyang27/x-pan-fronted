<script setup lang="ts">
/**
 * StatsPage —— 统计概览页
 * 存放 DashboardCards + DashboardCharts，与文件列表分离
 */
import { computed } from 'vue'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'
import DashboardCards from '@/components/dashboard/DashboardCards.vue'
import DashboardCharts from '@/components/dashboard/DashboardCharts.vue'

const fileStore = useFileStore()
const { fileList } = storeToRefs(fileStore)

const hasFiles = computed(() => fileList.value.length > 0)
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-xl font-semibold text-(--color-text)">统计概览</h1>

    <DashboardCards v-if="hasFiles" :files="fileList" />
    <div
      v-else
      class="flex flex-col items-center justify-center gap-2 py-12 text-(--color-text-muted)"
    >
      <p class="text-sm">暂无文件数据</p>
      <p class="text-xs">上传文件后即可查看统计信息</p>
    </div>

    <DashboardCharts v-if="hasFiles" :files="fileList" />
  </div>
</template>
