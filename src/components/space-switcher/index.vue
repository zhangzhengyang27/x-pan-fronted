<script setup lang="ts">
/**
 * SpaceSwitcher —— 个人空间 / 团队空间切换器
 */
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Check, Settings2, Users } from '@lucide/vue'
import BaseDropdown from '@/components/base/BaseDropdown.vue'
import { useSpaceStore } from '@/stores/space'
import { hasLoginSession } from '@/utils/cookie'
import type { ISpaceVO } from '@/types'

const spaceStore = useSpaceStore()
const router = useRouter()

const currentName = computed(() => {
  const current = spaceStore.currentSpace
  if (!current) return spaceStore.currentSpaceId ? '空间' : '个人空间'
  return current.spaceType === 'PERSONAL' ? '个人空间' : current.spaceName
})

onMounted(() => {
  if (hasLoginSession()) spaceStore.loadSpaces()
})

function formatSize(bytes?: number): string {
  const n = Number(bytes) || 0
  if (n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function isActive(space: ISpaceVO): boolean {
  return space.spaceType === 'PERSONAL'
    ? !spaceStore.currentSpaceId
    : space.spaceId === spaceStore.currentSpaceId
}

function pick(space: ISpaceVO): void {
  const id = space.spaceType === 'PERSONAL' ? '' : space.spaceId
  if (id === spaceStore.currentSpaceId) return
  spaceStore.switchSpace(id)
}

function goManage(): void {
  router.push('/spaces')
}
</script>

<template>
  <BaseDropdown v-if="hasLoginSession()">
    <template #trigger>
      <button
        type="button"
        class="flex items-center gap-1.5 h-7 px-2 rounded-sm text-xs font-medium transition-colors text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-hover) max-w-[150px]"
        :title="currentName"
      >
        <Users v-if="spaceStore.isTeamSpace" :size="14" :stroke-width="1.75" class="shrink-0" />
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-3.5 shrink-0">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span class="truncate">{{ currentName }}</span>
      </button>
    </template>

    <div class="px-3 py-2 text-[11px] font-medium text-(--color-text-muted)">切换空间</div>
    <div class="max-h-[320px] overflow-y-auto">
      <button
        v-for="space in spaceStore.spaces"
        :key="space.spaceId"
        type="button"
        class="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-(--color-hover)"
        @click="pick(space)"
      >
        <div class="size-7 rounded-md flex items-center justify-center shrink-0 bg-(--color-fill)">
          <Users v-if="space.spaceType === 'TEAM'" :size="14" :stroke-width="1.75" />
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-3.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <span class="text-sm truncate text-(--color-text)">
              {{ space.spaceType === 'PERSONAL' ? '个人空间' : space.spaceName }}
            </span>
            <span
              v-if="space.role === 'VIEWER'"
              class="text-[10px] px-1 py-0.5 rounded bg-(--color-fill) text-(--color-text-muted) shrink-0"
            >只读</span>
          </div>
          <div class="text-[11px] text-(--color-text-muted) truncate">
            {{ formatSize(space.usedSize) }} / {{ formatSize(space.totalSize) }}
            <template v-if="space.spaceType === 'TEAM'"> · {{ space.memberCount }} 人</template>
          </div>
        </div>
        <Check v-if="isActive(space)" :size="14" :stroke-width="2" class="shrink-0 text-primary-500" />
      </button>
      <div v-if="!spaceStore.spaces.length" class="px-3 py-4 text-xs text-center text-(--color-text-muted)">
        加载中…
      </div>
    </div>

    <div class="my-1 h-px bg-(--color-border)" />
    <button
      type="button"
      class="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-(--color-hover) text-(--color-text-secondary)"
      @click="goManage"
    >
      <Settings2 :size="14" :stroke-width="1.75" />
      团队空间管理
    </button>
  </BaseDropdown>
</template>
