<script setup>
/**
 * BasePopover —— 内容可定制的浮层
 * 通过 details+summary 实现 trigger；内容由 slot 提供
 */
import {ref, watch} from 'vue'

const props = defineProps({
  modelValue: {type: Boolean, default: false},
  position: {type: String, default: 'bottom-start'},
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
  <details ref="detailsRef" :open="modelValue || undefined" @toggle="onToggle">
    <summary class="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
      <slot name="trigger"/>
    </summary>
    <div
      class="absolute z-[var(--z-popover)] mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg overflow-hidden"
      :data-pos="position"
      role="dialog"
    >
      <slot/>
    </div>
  </details>
</template>

<style scoped>
details {
  position: relative;
}
</style>