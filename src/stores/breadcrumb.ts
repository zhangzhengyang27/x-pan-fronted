import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface BreadcrumbItem {
  id: string
  name: string
}

export const useBreadcrumbStore = defineStore('breadcrumb', () => {
  const breadcrumbList = ref<BreadcrumbItem[]>([])

  const set = (list: BreadcrumbItem[]) => {
    breadcrumbList.value = list
  }

  const reset = (list: BreadcrumbItem[]) => {
    breadcrumbList.value = list
  }

  const addItem = (item: BreadcrumbItem) => {
    breadcrumbList.value = [...breadcrumbList.value, item]
  }

  const clear = () => {
    breadcrumbList.value = []
  }

  return { breadcrumbList, set, reset, addItem, clear }
})
