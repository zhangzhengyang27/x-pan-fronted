<script setup lang="ts">
/**
 * BasePopover —— 内容可定制的浮层
 * 触发按钮由 slot#trigger 提供，弹窗内容由默认 slot 提供
 * 点击外部自动关闭（通过判断点击目标是否在浮层内）
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const popoverRef = ref<HTMLElement | null>(null)

function onTriggerMousedown(e: MouseEvent) {
  e.preventDefault()
  emit('update:modelValue', !props.modelValue)
}

function onClickOutside(e: MouseEvent) {
  // 点击发生在浮层（含触发器与弹窗内容）内时不关闭
  if (popoverRef.value && popoverRef.value.contains(e.target as Node)) return
  emit('update:modelValue', false)
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div ref="popoverRef" class="relative inline-block">
    <div @mousedown="onTriggerMousedown">
      <slot name="trigger" />
    </div>
    <Transition
      enter-active-class="transition-all duration-150 origin-top-left"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-100 origin-top-left"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="modelValue"
        class="absolute z-[var(--z-popover)] mt-2 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg overflow-hidden"
        @click.stop
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>
