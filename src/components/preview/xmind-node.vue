<script setup lang="ts">
/**
 * XmindNode —— XMind 思维导图递归节点（配合 xmind-previewer.vue）
 * 自引用递归渲染主题树，支持折叠/展开。
 */
import { ChevronRight, ChevronDown, CircleDot } from '@lucide/vue'

export interface TopicNode {
  id: string
  title: string
  children: TopicNode[]
  note?: string
  branchColor?: string
}

// 递归组件自引用：显式声明组件名，让 <XmindNode> 在自身模板中可解析
defineOptions({ name: 'XmindNode' })

const props = defineProps<{
  node: TopicNode
  collapsed: Set<string>
}>()

const emit = defineEmits<{
  toggle: [id: string]
}>()

const hasChildren = () => props.node.children.length > 0
const isCollapsed = () => props.collapsed.has(props.node.id)
</script>

<template>
  <li class="xmind-node">
    <div
      class="xmind-node-row"
      :class="{ 'cursor-pointer': hasChildren() }"
      @click="hasChildren() && emit('toggle', node.id)"
    >
      <span class="xmind-toggle">
        <ChevronRight v-if="hasChildren() && isCollapsed()" :size="16" />
        <ChevronDown v-else-if="hasChildren()" :size="16" />
      </span>
      <span class="xmind-dot">
        <CircleDot :size="14" :style="{ color: node.branchColor || 'var(--color-primary)' }" />
      </span>
      <span class="xmind-title">{{ node.title }}</span>
      <span v-if="node.note" class="xmind-note-hint" :title="node.note">📝</span>
    </div>

    <ul v-if="hasChildren() && !isCollapsed()" class="xmind-children">
      <XmindNode
        v-for="c in node.children"
        :key="c.id"
        :node="c"
        :collapsed="collapsed"
        @toggle="emit('toggle', $event)"
      />
    </ul>
  </li>
</template>

<style scoped>
.xmind-node {
  list-style: none;
}
.xmind-node-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: default;
  transition: background 0.15s;
}
.xmind-node-row:hover {
  background: var(--color-surface);
}
.xmind-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}
.xmind-dot {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}
.xmind-title {
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.5;
}
.xmind-note-hint {
  font-size: 12px;
  margin-left: 4px;
}
.xmind-children {
  list-style: none;
  padding: 0;
  margin: 0 0 0 18px;
  border-left: 1px dashed var(--color-border);
  padding-left: 8px;
}
</style>
