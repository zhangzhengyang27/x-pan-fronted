<script setup lang="ts">
/**
 * BaseDrawer —— 侧滑抽屉
 * position: left | right | top | bottom
 */
import { watch, ref, nextTick, computed } from 'vue'
import { X } from '@lucide/vue'
import { cn } from '@/utils/classnames'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  position: { type: String, default: 'right' },
  width: { type: String, default: '420px' },
  height: { type: String, default: '60vh' }
})

const emit = defineEmits(['update:open', 'close'])
const dialogRef = ref(null)

watch(
  () => props.open,
  async (v) => {
    await nextTick()
    if (!dialogRef.value) return
    if (v && !dialogRef.value.open) dialogRef.value.show()
    if (!v && dialogRef.value.open) dialogRef.value.close()
  }
)

function onClose() {
  emit('update:open', false)
  emit('close')
}
function onBackdrop(e) {
  if (e.target === dialogRef.value) onClose()
}

const sizeStyle = computed(() =>
  props.position === 'left' || props.position === 'right'
    ? { width: props.width, maxWidth: '92vw' }
    : { height: props.height, maxHeight: '92vh' }
)
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      :class="
        cn(
          'fixed p-0 m-0 bg-transparent text-[var(--color-text)] backdrop:bg-black/50 backdrop:backdrop-blur-sm',
          position === 'right' && 'ml-auto top-0 bottom-0 right-0',
          position === 'left' && 'mr-auto top-0 bottom-0 left-0',
          position === 'top' && 'top-0 left-0 right-0',
          position === 'bottom' && 'bottom-0 left-0 right-0'
        )
      "
      :style="sizeStyle"
      @click="onBackdrop"
      @close="emit('update:open', false)"
    >
      <div
        class="h-full w-full bg-[var(--color-surface)] shadow-xl border border-[var(--color-border)] flex flex-col"
        :class="
          (position === 'right' && 'rounded-l-2xl',
          position === 'left' && 'rounded-r-2xl',
          position === 'top' && 'rounded-b-2xl',
          position === 'bottom' && 'rounded-t-2xl')
        "
      >
        <div
          class="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]"
        >
          <h2 class="text-base font-semibold m-0">{{ title }}</h2>
          <button
            type="button"
            class="text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-md p-1 hover:bg-[var(--color-surface-2)]"
            aria-label="关闭"
            @click="onClose"
          >
            <X :size="18" />
          </button>
        </div>
        <div class="flex-1 overflow-y-auto px-5 py-4">
          <slot />
        </div>
        <div
          v-if="$slots.footer"
          class="px-5 py-3 border-t border-[var(--color-border)] flex justify-end gap-2 bg-[var(--color-surface-2)]"
        >
          <slot name="footer" />
        </div>
      </div>
    </dialog>
  </Teleport>
</template>
