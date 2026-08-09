<script setup>
/**
 * BaseTreeNode —— 树节点（递归组件自己）
 */
import {ref} from 'vue'
import {ChevronRight, Folder, FolderOpen, File} from '@lucide/vue'
import {cn} from '@/utils/classnames'

defineProps({
  node: {type: Object, required: true},
  level: {type: Number, default: 0},
})
const emit = defineEmits(['select', 'toggle'])

const expanded = ref(false)
const selected = ref(false)
</script>

<template>
  <li>
    <div
      :class="cn(
        'flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer text-sm transition-colors',
        'hover:bg-[var(--color-surface-2)]',
        selected && 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)]',
        selected && 'dark:bg-[var(--color-primary-900)]/30 dark:text-[var(--color-primary-300)]',
      )"
      :style="{paddingLeft: `${level * 16 + 8}px`}"
      @click="emit('select', node)"
    >
      <button
        v-if="node.children?.length || node.expandable"
        type="button"
        class="size-4 flex items-center justify-center text-[var(--color-text-muted)] transition-transform"
        :class="expanded && 'rotate-90'"
        @click.stop="expanded = !expanded; emit('toggle', node)"
      >
        <ChevronRight :size="14" :stroke-width="2.5"/>
      </button>
      <span v-else class="size-4"/>
      <component
        :is="node.children?.length ? (expanded ? FolderOpen : Folder) : File"
        :size="16"
        class="shrink-0 text-[var(--color-text-muted)]"
      />
      <span class="truncate">{{ node.label }}</span>
    </div>
    <ul v-if="expanded && node.children?.length" class="m-0 p-0 list-none">
      <BaseTreeNode
        v-for="child in node.children"
        :key="child.id ?? child.label"
        :node="child"
        :level="level + 1"
        @select="(n) => emit('select', n)"
        @toggle="(n) => emit('toggle', n)"
      />
    </ul>
  </li>
</template>