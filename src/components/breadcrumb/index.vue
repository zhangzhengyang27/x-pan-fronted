<script setup>
/**
 * AppBreadcrumb —— 路径面包屑
 * "返回" + 分隔符 + 路径节点
 */
import { ArrowLeft, ChevronRight } from '@lucide/vue'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'

const breadcrumbStore = useBreadcrumbStore()
const fileStore = useFileStore()

const { breadcrumbList: breadCrumbs } = storeToRefs(breadcrumbStore)

function goBack() {
  fileStore.setSearchFlag(false)
  if (breadCrumbs.value.length > 1) {
    const list = [...breadCrumbs.value]
    list.pop()
    const newId = list.pop()?.id
    if (newId !== undefined) goToThis(newId)
  }
}

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
    class="flex items-center gap-1.5 text-sm py-3 px-1"
  >
    <button
      type="button"
      class="inline-flex items-center gap-1 px-2 h-7 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
      :disabled="breadCrumbs.length <= 1"
      @click="goBack"
    >
      <ArrowLeft :size="14" />
      <span>返回</span>
    </button>

    <ChevronRight :size="14" class="text-[var(--color-text-muted)] mx-0.5" />

    <ol class="flex items-center gap-1.5 flex-wrap">
      <li v-for="(item, index) in breadCrumbs" :key="index" class="flex items-center gap-1.5">
        <button
          type="button"
          :class="[
            'px-1.5 py-0.5 rounded transition-colors truncate max-w-[200px]',
            index === breadCrumbs.length - 1
              ? 'text-[var(--color-text)] font-medium cursor-default'
              : 'text-[var(--color-primary-600)] hover:underline hover:bg-[var(--color-primary-50)]'
          ]"
          :disabled="index === breadCrumbs.length - 1"
          @click="goToThis(item.id)"
        >
          {{ item.name }}
        </button>
        <ChevronRight
          v-if="index < breadCrumbs.length - 1"
          :size="12"
          class="text-[var(--color-text-muted)]"
        />
      </li>
    </ol>
  </nav>
</template>
