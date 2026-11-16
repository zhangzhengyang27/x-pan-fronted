<script setup lang="ts">
/**
 * BaseTree —— 树容器
 * 数据：[{ id, label, children?: [] }]
 */
import type { PropType } from 'vue'
import BaseTreeNode from '@/components/base/BaseTreeNode.vue'

export interface TreeNodeData {
  id?: string | number
  label?: string
  disabled?: boolean
  children?: TreeNodeData[]
  [key: string]: unknown
}

defineProps({
  data: { type: Array as PropType<TreeNodeData[]>, default: (): TreeNodeData[] => [] }
})
const emit = defineEmits<{
  select: [node: TreeNodeData]
  toggle: [node: TreeNodeData]
}>()
</script>

<template>
  <ul class="m-0 p-0 list-none">
    <BaseTreeNode
      v-for="node in data"
      :key="node.id ?? node.label"
      :node="node"
      :level="0"
      @select="(n) => emit('select', n)"
      @toggle="(n) => emit('toggle', n)"
    />
  </ul>
</template>
