<script setup lang="ts">
/**
 * BaseModal —— 模态对话框（夸克风格）
 * 基于原生 <dialog> + Teleport
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
  xl: 'max-w-2xl',
  full: 'max-w-[92vw]'
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
  if (!props.closeOnEsc) { e.preventDefault(); return }
  onClose()
}
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      :class="
        cn(
          'm-auto p-0 text-[var(--color-text)]',
          'rounded-xl',
          'shadow-xl',
          'w-[92vw]',
          'bg-[var(--color-surface)] border border-[var(--color-border)]',
          'overflow-visible',
          sizeClass[size]
        )
      "
      @click="onBackdrop"
      @cancel="onCancel"
      @close="emit('update:open', false)"
    >
      <!-- 头部 -->
      <div
        v-if="title || !hideClose"
        class="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]"
      >
        <h2 class="text-sm font-semibold m-0 text-[var(--color-text)]">{{ title }}</h2>
        <button
          v-if="!hideClose"
          type="button"
          class="size-7 rounded-sm flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors"
          aria-label="关闭"
          @click="onClose"
        >
          <X :size="16" :stroke-width="2" />
        </button>
      </div>
      <!-- 内容 -->
      <div class="px-5 py-4 max-h-[70vh] overflow-y-auto">
        <slot />
      </div>
      <!-- 底部 -->
      <div
        v-if="$slots.footer"
        class="px-5 py-3 flex items-center justify-end gap-2 rounded-b-xl border-t border-[var(--color-border)] bg-[var(--color-surface-2)]"
      >
        <slot name="footer" />
      </div>
    </dialog>
  </Teleport>
</template>
