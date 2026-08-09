import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { defineStore } from 'pinia'

export interface UserStore {
  username: Ref<string>
  usedSpace: Ref<number>
  totalSpace: Ref<number>
  usedPercent: ComputedRef<number>
  setUsername: (newUsername: string) => void
  setQuota: (used: number, total: number) => void
  clear: () => void
}

export const useUserStore = defineStore('user', (): UserStore => {
  const username = ref<string>('')
  const usedSpace = ref<number>(0)
  const totalSpace = ref<number>(100 * 1024 * 1024 * 1024) // 100 GB

  const usedPercent = computed<number>(() => {
    if (!totalSpace.value) return 0
    return Math.min(100, (usedSpace.value / totalSpace.value) * 100)
  })

  function setUsername(newUsername: string): void {
    username.value = newUsername
  }

  function setQuota(used: number, total: number): void {
    if (typeof used === 'number') usedSpace.value = used
    if (typeof total === 'number' && total > 0) totalSpace.value = total
  }

  function clear(): void {
    username.value = ''
    usedSpace.value = 0
    totalSpace.value = 100 * 1024 * 1024 * 1024
  }

  return { username, usedSpace, totalSpace, usedPercent, setUsername, setQuota, clear }
})
