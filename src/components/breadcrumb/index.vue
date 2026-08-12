<script setup lang="ts">
/**
 * AppBreadcrumb —— 路径面包屑（夸克风格:无返回按钮,大字号）
 */
import { ChevronRight } from '@lucide/vue'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'

const breadcrumbStore = useBreadcrumbStore()
const fileStore = useFileStore()

const { breadcrumbList: breadCrumbs } = storeToRefs(breadcrumbStore)

function goToThis(id) {
  if (id === '-1') return
  const next = []
  for (const item of breadCrumbs.value) {
    next.push(item)
    if (item.id == id) break
  }
  breadcrumbStore.reset(next)
  fileStore.setParentId(id)
  fileStore.setSearchFlag(false)
  fileStore.loadFileList()
}
</script>

<template>
  <nav
    v-if="breadCrumbs.length"
    aria-label="面包屑"
    class="flex items-center gap-2 text-base"
  >
    <ol class="flex items-center gap-1.5 flex-wrap">
      <li v-for="(item, index) in breadCrumbs" :key="index" class="flex items-center gap-1.5">
        <button
          type="button"
          :class="[
            'transition-colors truncate max-w-[280px]',
            index === breadCrumbs.length - 1
              ? 'text-[var(--color-text)] font-semibold cursor-default'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-primary-500)] hover:underline'
          ]"
          :disabled="index === breadCrumbs.length - 1"
          @click="goToThis(item.id)"
        >
          {{ item.name }}
        </button>
        <ChevronRight
          v-if="index < breadCrumbs.length - 1"
          :size="14"
          class="text-[var(--color-text-muted)] shrink-0"
        />
      </li>
    </ol>
  </nav>
</template>
