<script setup lang="ts">
/**
 * StatsPage —— 统计概览页
 * 存放 DashboardCards + DashboardCharts。
 *
 * 数据来源：后端 /files/stats 聚合统计接口（全盘，含子目录），
 * 不再依赖共享 fileList 硬算（旧实现只统计根目录一层、且会受其它页残留状态影响）。
 */
import { computed, ref } from 'vue'
import DashboardCards from '@/components/dashboard/DashboardCards.vue'
import DashboardCharts from '@/components/dashboard/DashboardCharts.vue'
import fileService, { type UserFileStatsVO } from '@/api/file'
import { ElMessage } from '@/composables/useToast'

const stats = ref<UserFileStatsVO | null>(null)
const loading = ref(false)

const hasStats = computed(() => stats.value != null)

async function loadStats() {
  loading.value = true
  try {
    await new Promise<void>((resolve, reject) => {
      fileService.stats(
        (res) => {
          stats.value = (res?.data as UserFileStatsVO) || null
          resolve()
        },
        () => {
          stats.value = null
          reject()
        }
      )
    })
  } catch {
    ElMessage.error('获取统计数据失败')
  } finally {
    loading.value = false
  }
}

loadStats()
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-xl font-semibold text-(--color-text)">统计概览</h1>

    <div v-if="loading" class="py-12 text-center text-sm text-(--color-text-muted)">加载中…</div>

    <DashboardCards v-else-if="hasStats" :stats="stats" />

    <div
      v-else
      class="flex flex-col items-center justify-center gap-2 py-12 text-(--color-text-muted)"
    >
      <p class="text-sm">暂无文件数据</p>
      <p class="text-xs">上传文件后即可查看统计信息</p>
    </div>

    <DashboardCharts v-if="hasStats" :stats="stats" />
  </div>
</template>
