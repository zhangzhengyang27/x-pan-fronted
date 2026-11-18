import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { defineStore } from 'pinia'
import spaceService from '@/api/space'
import { useUserStore } from '@/stores/user'
import type { ISpaceVO } from '@/types'

/** 本地存储键：当前团队空间 ID（空/不存在表示个人空间） */
export const SPACE_STORAGE_KEY = 'xpan_space_id'

export interface SpaceStore {
  spaces: Ref<ISpaceVO[]>
  currentSpaceId: Ref<string>
  currentSpace: ComputedRef<ISpaceVO | undefined>
  isTeamSpace: ComputedRef<boolean>
  canWrite: ComputedRef<boolean>
  canManage: ComputedRef<boolean>
  loadSpaces: () => Promise<void>
  switchSpace: (spaceId: string) => void
  reset: () => void
}

function readStoredSpaceId(): string {
  try {
    return localStorage.getItem(SPACE_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export const useSpaceStore = defineStore('space', (): SpaceStore => {
  const spaces = ref<ISpaceVO[]>([])
  const currentSpaceId = ref<string>(readStoredSpaceId())

  const currentSpace = computed<ISpaceVO | undefined>(() =>
    spaces.value.find((s) => s.spaceId === currentSpaceId.value)
  )
  const isTeamSpace = computed<boolean>(
    () => !!currentSpace.value && currentSpace.value.spaceType === 'TEAM'
  )
  const canWrite = computed<boolean>(() => currentSpace.value?.role !== 'VIEWER')
  const canManage = computed<boolean>(
    () => currentSpace.value?.role === 'OWNER' || currentSpace.value?.role === 'ADMIN'
  )

  /** 拉取空间列表，并用当前空间配额刷新用户容量展示 */
  async function loadSpaces(): Promise<void> {
    try {
      const list = await new Promise<ISpaceVO[]>((resolve, reject) => {
        spaceService.list(
          (res) => resolve(res.data || []),
          (err) => reject(err)
        )
      })
      spaces.value = list
      const current = list.find((s) => s.spaceId === currentSpaceId.value)
      if (!current) {
        // 空间已解散/被移除：回退到个人空间，避免残留头导致接口 403
        currentSpaceId.value = ''
        try {
          localStorage.removeItem(SPACE_STORAGE_KEY)
        } catch {
          /* ignore */
        }
      }
      const active = current || list.find((s) => s.spaceType === 'PERSONAL')
      if (active) {
        useUserStore().setQuota(Number(active.usedSize) || 0, Number(active.totalSize) || 0)
      }
    } catch {
      /* 空间列表加载失败不阻塞主流程 */
    }
  }

  /** 切换空间：写入本地存储并整页刷新，彻底清理目录/搜索等缓存 */
  function switchSpace(spaceId: string): void {
    try {
      if (spaceId) localStorage.setItem(SPACE_STORAGE_KEY, spaceId)
      else localStorage.removeItem(SPACE_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    currentSpaceId.value = spaceId
    window.location.assign('/files')
  }

  function reset(): void {
    spaces.value = []
    currentSpaceId.value = ''
    try {
      localStorage.removeItem(SPACE_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  return {
    spaces,
    currentSpaceId,
    currentSpace,
    isTeamSpace,
    canWrite,
    canManage,
    loadSpaces,
    switchSpace,
    reset
  }
})
