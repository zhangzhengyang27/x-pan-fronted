import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface BreadcrumbItem {
  name: string
  fileId: string
  disable: boolean
}

export const useBreadcrumbStore = defineStore('breadcrumb', () => {
  const breadcrumbList = ref<BreadcrumbItem[]>([])

  const set = (list: BreadcrumbItem[]) => {
    breadcrumbList.value = list
  }

  const clear = () => {
    breadcrumbList.value = []
  }

  return { breadcrumbList, set, clear }
})
