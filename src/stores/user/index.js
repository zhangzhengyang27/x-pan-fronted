import {ref, computed} from 'vue'
import {defineStore} from 'pinia'

export const useUserStore = defineStore('user', () => {
  const username = ref('')
  // 后端 RPanUserVO 包含 username / rootFileId / rootFilename 等；
  // 用户空间配额按需扩展（前端 mock 默认 100GB，演示用）
  const usedSpace = ref(0)
  const totalSpace = ref(100 * 1024 * 1024 * 1024) // 100 GB

  const usedPercent = computed(() => {
    if (!totalSpace.value) return 0
    return Math.min(100, (usedSpace.value / totalSpace.value) * 100)
  })

  function setUsername(newUsername) {
    username.value = newUsername
  }

  function setQuota(used, total) {
    if (typeof used === 'number') usedSpace.value = used
    if (typeof total === 'number' && total > 0) totalSpace.value = total
  }

  function clear() {
    username.value = ''
    usedSpace.value = 0
    totalSpace.value = 100 * 1024 * 1024 * 1024
  }

  return {username, usedSpace, totalSpace, usedPercent, setUsername, setQuota, clear}
})