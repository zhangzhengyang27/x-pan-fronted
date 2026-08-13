<script setup lang="ts">
/**
 * ConfirmHost —— 全局确认/输入对话框宿主
 * 设计规范：G 设计风格
 * - Teleport to body
 * - 全屏遮罩 + 居中卡片
 * - 队列式渲染
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
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
        class="shrink-0 size-10 rounded-full flex items-center justify-center"
        :style="
          current.danger
            ? 'background-color: rgba(239, 68, 68, 0.1); color: vardanger;'
            : 'background-color: rgba(245, 158, 11, 0.1); color: varwarning;'
        "
      >
        <AlertTriangle v-if="current.danger" :size="20" :stroke-width="2" />
        <AlertCircle v-else :size="20" :stroke-width="2" />
      </div>
      <div class="flex-1 text-sm leading-relaxed text-(--color-text)">
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
      <div class="text-sm leading-relaxed text-(--color-text)">
        {{ promptCurrent.message }}
      </div>
      <BaseInput
        v-model="inputValue"
        type="text"
        :error="!!inputError"
        @keydown.enter.prevent="onPromptConfirm"
      />
      <p v-if="inputError" class="text-xs" style="color: vardanger;">
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
