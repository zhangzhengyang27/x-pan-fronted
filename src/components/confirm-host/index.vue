<script setup lang="ts">
/**
 * ConfirmHost —— 全局确认/输入对话框宿主
 * - 监听 useToast.ts 的模块级 confirm 队列与 prompt 队列
 * - 支持 danger / 自定义按钮文案 / 输入校验
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { AlertTriangle, AlertCircle } from '@lucide/vue'
import {
  getConfirmQueue,
  answerConfirm,
  getPromptQueue,
  answerPrompt
} from '@/composables/useToast'

const current = ref(null)
const promptCurrent = ref(null)
const inputValue = ref('')
const inputError = ref('')

function refresh() {
  current.value = getConfirmQueue()[0] || null
  promptCurrent.value = getPromptQueue()[0] || null
  if (promptCurrent.value) {
    inputValue.value = promptCurrent.value.inputValue ?? ''
    inputError.value = ''
  }
}

function onConfirm() {
  answerConfirm('confirm')
  refresh()
}

function onCancel() {
  answerConfirm('cancel')
  refresh()
}

function validateInput(): string {
  const item = promptCurrent.value
  if (!item) return ''
  const value = inputValue.value
  // 优先使用调用方提供的 inputValidator 回调（返回 true 或错误文案）
  if (item.inputValidator) {
    const result = item.inputValidator(value)
    return result === true ? '' : (result || '输入格式不正确')
  }
  if (!item.inputPattern) return ''
  const pattern = item.inputPattern
  if (pattern instanceof RegExp) {
    return pattern.test(value) ? '' : (item.inputErrorMessage || '输入格式不正确')
  }
  const regex = new RegExp(pattern)
  return regex.test(value) ? '' : (item.inputErrorMessage || '输入格式不正确')
}

function onPromptConfirm() {
  const err = validateInput()
  if (err) {
    inputError.value = err
    return
  }
  answerPrompt('confirm', inputValue.value)
  refresh()
}

function onPromptCancel() {
  answerPrompt('cancel')
  refresh()
}

function onPush() {
  refresh()
}

onMounted(() => {
  refresh()
  window.addEventListener('x-pan:confirm-push', onPush)
  window.addEventListener('x-pan:prompt-push', onPush)
})

onBeforeUnmount(() => {
  window.removeEventListener('x-pan:confirm-push', onPush)
  window.removeEventListener('x-pan:prompt-push', onPush)
})
</script>

<template>
  <!-- 确认对话框 -->
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
        :class="
          current.danger
            ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
            : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
        "
      >
        <AlertTriangle v-if="current.danger" :size="18" />
        <AlertCircle v-else :size="18" />
      </div>
      <div class="flex-1 text-sm text-[var(--color-text)] leading-relaxed">
        {{ current.message }}
      </div>
    </div>
    <template #footer>
      <BaseButton variant="ghost" size="sm" @click="onCancel">
        {{ current.cancelText || '取消' }}
      </BaseButton>
      <BaseButton :variant="current.danger ? 'danger' : 'primary'" size="sm" @click="onConfirm">
        {{ current.confirmText || '确定' }}
      </BaseButton>
    </template>
  </BaseModal>

  <!-- 输入对话框（prompt） -->
  <BaseModal
    v-if="promptCurrent"
    :open="true"
    size="sm"
    :title="promptCurrent.title || '请输入'"
    :hide-close="promptCurrent.hideClose"
    @close="onPromptCancel"
  >
    <div class="space-y-3">
      <div class="text-sm text-[var(--color-text)] leading-relaxed">
        {{ promptCurrent.message }}
      </div>
      <input
        v-model="inputValue"
        type="text"
        class="w-full h-9 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary-500)]"
        :class="{ '!border-[var(--color-danger)]': inputError }"
        @keydown.enter.prevent="onPromptConfirm"
      />
      <p v-if="inputError" class="text-xs text-[var(--color-danger)]">
        {{ inputError }}
      </p>
    </div>
    <template #footer>
      <BaseButton variant="ghost" size="sm" @click="onPromptCancel">
        {{ promptCurrent.cancelText || '取消' }}
      </BaseButton>
      <BaseButton variant="primary" size="sm" @click="onPromptConfirm">
        {{ promptCurrent.confirmText || '确定' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
