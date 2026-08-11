<script setup lang="ts">
/**
 * BaseModal —— Teleport 到 body 的模态对话框
 * 设计规范：G 设计风格
 * - 基于原生 <dialog> 元素（自带焦点陷阱、ESC、滚动锁）
 * - 支持 v-model:open
 * - 支持 size: sm | md | lg | xl
 * - 支持 title、footer 插槽
 */
import { watch, ref, nextTick } from 'vue'
import { X } from '@lucide/vue'
import { cn } from '@/utils/classnames'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  size: { type: String, default: 'md' },
  closeOnBackdrop: { type: Boolean, default: true },
  closeOnEsc: { type: Boolean, default: true },
  hideClose: { type: Boolean, default: false }
})

const emit = defineEmits(['update:open', 'close'])

const dialogRef = ref(null)

const sizeClass = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl'
}

watch(
  () => props.open,
  async (v) => {
    await nextTick()
    if (!dialogRef.value) return
    if (v && !dialogRef.value.open) dialogRef.value.showModal()
    if (!v && dialogRef.value.open) dialogRef.value.close()
  }
)

function onClose() {
  emit('update:open', false)
  emit('close')
}

function onBackdrop(e) {
  if (props.closeOnBackdrop && e.target === dialogRef.value) onClose()
}

function onCancel(e) {
  if (!props.closeOnEsc) {
    e.preventDefault()
    return
  }
  onClose()
}
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      :class="
        cn(
          'm-auto p-0 rounded-2xl text-[var(--color-text)]',
          'shadow-xl',
          'w-[92vw]',
          'bg-[var(--color-surface)] border border-[var(--color-border)]',
          sizeClass[size]
        )
      "
      @click="onBackdrop"
      @cancel="onCancel"
      @close="emit('update:open', false)"
    >
      <div
        class="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]"
      >
        <h2 class="text-base font-semibold m-0">{{ title }}</h2>
        <button
          v-if="!hideClose"
          type="button"
          class="rounded-md p-1 transition-colors text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
          aria-label="关闭"
          @click="onClose"
        >
          <X :size="18" :stroke-width="2" />
        </button>
      </div>
      <div class="px-5 py-4 max-h-[70vh] overflow-y-auto">
        <slot />
      </div>
      <div
        v-if="$slots.footer"
        class="px-5 py-3 flex items-center justify-end gap-2 rounded-b-2xl border-t border-[var(--color-border)] bg-[var(--color-surface-2)]"
      >
        <slot name="footer" />
      </div>
    </dialog>
  </Teleport>
</template>
