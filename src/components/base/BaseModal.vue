<script setup lang="ts">
/**
 * BaseModal —— 模态对话框（夸克风格）
 * 基于原生 <dialog> + Teleport
 */
import { watch, ref, nextTick, onMounted } from 'vue'
import type { PropType } from 'vue'
import { X } from '@lucide/vue'
import { cn } from '@/utils/classnames'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  size: { type: String as PropType<ModalSize>, default: 'md' },
  closeOnBackdrop: { type: Boolean, default: true },
  closeOnEsc: { type: Boolean, default: true },
  hideClose: { type: Boolean, default: false }
})

const emit = defineEmits(['update:open', 'close'])

const dialogRef = ref<HTMLDialogElement | null>(null)

const sizeClass: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-[92vw]'
}

async function syncDialog(show: boolean) {
  await nextTick()
  const dialog = dialogRef.value
  if (!dialog) return
  if (show && !dialog.open) dialog.showModal()
  if (!show && dialog.open) dialog.close()
}

watch(
  () => props.open,
  async (v) => syncDialog(!!v)
)

// 关键：当组件挂载时 `open` 可能已是 true（例如配合 `v-if` 使用，
// ConfirmHost 用 `v-if="current"` + `:open="true"`），此时 watch 不会触发，
// dialog.showModal() 永远不会被调用 → 弹窗不显示。这里在挂载后兜底一次。
onMounted(() => {
  if (props.open) syncDialog(true)
})

function onClose() {
  emit('update:open', false)
  emit('close')
}

function onBackdrop(e: MouseEvent) {
  if (props.closeOnBackdrop && e.target === dialogRef.value) onClose()
}

function onCancel(e: Event) {
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
          'm-auto p-0 text-(--color-text)',
          'rounded-xl',
          'shadow-xl',
          'w-[92vw]',
          'bg-(--color-surface) border border-(--color-border)',
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
        class="flex items-center justify-between px-5 py-4 border-b border-(--color-border)"
      >
        <h2 class="text-sm font-semibold m-0 text-(--color-text)">{{ title }}</h2>
        <button
          v-if="!hideClose"
          type="button"
          class="size-7 rounded-sm flex items-center justify-center text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-hover) transition-colors"
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
        class="px-5 py-3 flex items-center justify-end gap-2 rounded-b-xl border-t border-(--color-border) bg-(--color-surface-2)"
      >
        <slot name="footer" />
      </div>
    </dialog>
  </Teleport>
</template>
