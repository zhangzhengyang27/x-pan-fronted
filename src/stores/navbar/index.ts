import { defineStore } from 'pinia'
import { ref } from 'vue'

export const NAVBAR_MODES = ['list', 'grid', 'gallery'] as const
export type NavbarMode = (typeof NAVBAR_MODES)[number]

export const useNavbarStore = defineStore('navbar', () => {
  // 视图切换：list 列表 / grid 网格 / gallery 画廊
  const mode = ref<NavbarMode>('grid')

  // 搜索关键字
  const searchKey = ref('')

  // 显示设置
  const settings = ref({
    showHidden: false,
    onlyDoc: false,
    onlyVideo: false,
    onlyMusic: false,
    onlyImg: false
  })

  const setMode = (m: NavbarMode) => {
    mode.value = m
  }

  const setSearchKey = (key: string) => {
    searchKey.value = key
  }

  const updateSettings = (patch: Partial<typeof settings.value>) => {
    settings.value = { ...settings.value, ...patch }
  }

  const clear = () => {
    mode.value = 'grid'
    searchKey.value = ''
    settings.value = {
      showHidden: false,
      onlyDoc: false,
      onlyVideo: false,
      onlyMusic: false,
      onlyImg: false
    }
  }

  return { mode, searchKey, settings, setMode, setSearchKey, updateSettings, clear }
})
