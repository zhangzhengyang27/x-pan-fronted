<script setup lang="ts">
/**
 * BaseDropdown —— 零依赖下拉菜单
 * 不依赖原生 <details> 的默认行为（其内部嵌套 button 时各浏览器 toggle 行为不一致），
 * 改用 JS 控制 open 状态，并通过 clickoutside 关闭。
 */
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const rootRef = ref<HTMLElement | null>(null)
const open = ref(props.modelValue)

watch(
  () => props.modelValue,
  (v) => {
    open.value = v
  }
)
watch(open, (v) => emit('update:modelValue', v))

function toggle() {
  open.value = !open.value
}
function close() {
  open.value = false
}

function onClickOutside(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))

defineExpose({ close })
</script>

<template>
  <div ref="rootRef" class="relative inline-block">
    <div class="cursor-pointer select-none" @click="toggle">
      <slot name="trigger" />
    </div>
    <div
      v-show="open"
      class="absolute right-0 top-full mt-2 z-[var(--z-dropdown)] min-w-[180px] rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg py-1.5 overflow-hidden"
      role="menu"
    >
      <slot />
    </div>
  </div>
</template>
