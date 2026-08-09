<script setup>
/**
 * ConfirmHost —— 全局确认对话框宿主
 * - 监听 useToast.js 的模块级队列
 * - 支持 danger / 自定义按钮文案
 */
import {ref, onMounted, onBeforeUnmount} from 'vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import {AlertTriangle, AlertCircle} from '@lucide/vue'
import {getConfirmQueue, answerConfirm} from '@/composables/useToast'

const current = ref(null)

function refresh() {
  current.value = getConfirmQueue()[0] || null
}

function onConfirm() {
  answerConfirm('confirm')
  refresh()
}

function onCancel() {
  answerConfirm('cancel')
  refresh()
}

function onPush() {
  refresh()
}

onMounted(() => {
  refresh()
  window.addEventListener('x-pan:confirm-push', onPush)
})

onBeforeUnmount(() => {
  window.removeEventListener('x-pan:confirm-push', onPush)
})
</script>

<template>
  <BaseModal
    v-if="current"
    :open="true"
    size="sm"
    :title="current.title || '请确认'"
    :hide-close="current.hideClose"
    @close="onCancel"
  >
    <div class="flex gap-3">
      <div
        class="shrink-0 size-9 rounded-full flex items-center justify-center"
        :class="current.danger ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]' : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'"
      >
        <AlertTriangle v-if="current.danger" :size="18"/>
        <AlertCircle v-else :size="18"/>
      </div>
      <div class="flex-1 text-sm text-[var(--color-text)] leading-relaxed">
        {{ current.message }}
      </div>
    </div>
    <template #footer>
      <BaseButton variant="ghost" size="sm" @click="onCancel">
        {{ current.cancelText || '取消' }}
      </BaseButton>
      <BaseButton
        :variant="current.danger ? 'danger' : 'primary'"
        size="sm"
        @click="onConfirm"
      >
        {{ current.confirmText || '确定' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>