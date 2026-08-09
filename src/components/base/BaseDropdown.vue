<script setup>
/**
 * BaseDropdown —— 基于 <details> 的零依赖下拉菜单
 * 支持 v-model 绑定 open；clickoutside 通过 <details> 的 toggle 原生处理
 */
import {ref, watch} from 'vue'

const props = defineProps({
  modelValue: {type: Boolean, default: false},
})
const emit = defineEmits(['update:modelValue'])
const detailsRef = ref(null)

watch(
  () => props.modelValue,
  (v) => {
    if (detailsRef.value && detailsRef.value.open !== v) detailsRef.value.open = v
  },
)

function onToggle() {
  emit('update:modelValue', !!detailsRef.value?.open)
}
</script>

<template>
  <details ref="detailsRef" class="relative" :open="modelValue || undefined" @toggle="onToggle">
    <summary
      class="list-none cursor-pointer select-none [&::-webkit-details-marker]:hidden"
    >
      <slot name="trigger"/>
    </summary>
    <div
      class="absolute right-0 top-full mt-2 z-[var(--z-dropdown)] min-w-[180px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg py-1.5 overflow-hidden"
      role="menu"
    >
      <slot/>
    </div>
  </details>
</template>