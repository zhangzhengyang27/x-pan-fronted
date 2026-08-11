<script setup lang="ts">
/**
 * BaseTree —— 树容器
 * 数据：[{ id, label, children?: [] }]
 */
import BaseTreeNode from '@/components/base/BaseTreeNode.vue'

defineProps({
  data: { type: Array, default: () => [] }
})
const emit = defineEmits(['select', 'toggle'])
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
