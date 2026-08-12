<script setup lang="ts">
/**
 * UploadTaskPanel —— 右下角悬浮上传任务卡片
 * - Teleport 到 body
 * - 显示所有进行中 / 已完成 / 失败的任务
 * - 可手动清除已完成
 */
import { storeToRefs } from 'pinia'
import { X, Check, LoaderCircle, FileWarning } from '@lucide/vue'
import { useTaskStore } from '@/stores/task'
import { computed } from 'vue'

const taskStore = useTaskStore()
const { uploadTaskList: taskList, panelVisible } = storeToRefs(taskStore)

const visible = computed(() => taskList.value.length > 0 && panelVisible.value)

function remove(filename) {
  taskStore.cancel(filename)
}

function clearFinished() {
  taskList.value
    .filter((t) => t.status !== 0 && t.status !== 1 && t.status !== 3) // 非解析/非上传中
    .forEach((t) => taskStore.remove(t.filename))
}

function closePanel() {
  taskStore.hidePanel()
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="fixed bottom-6 right-6 z-50 w-80 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
        role="region"
        aria-label="上传任务"
      >
        <div
          class="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5"
        >
          <span class="text-sm font-medium text-[var(--color-text)]">上传任务</span>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
              @click="clearFinished"
            >
              清除已完成
            </button>
            <button
              type="button"
              class="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              aria-label="关闭上传任务面板"
              @click="closePanel"
            >
              <X :size="14" />
            </button>
          </div>
        </div>
        <div class="max-h-64 space-y-3 overflow-y-auto p-4">
          <div v-for="task in taskList" :key="task.filename">
            <div class="flex items-center justify-between gap-2">
              <span class="truncate text-xs font-medium text-[var(--color-text)]">
                {{ task.filename }}
              </span>
              <button
                v-if="task.status !== 1"
                type="button"
                class="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                :aria-label="`移除 ${task.filename}`"
                @click="remove(task.filename)"
              >
                <X :size="14" />
              </button>
            </div>
            <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
              <div
                class="h-full rounded-full transition-all duration-300"
                :class="
                  task.status === 6
                    ? 'bg-[var(--color-danger)]'
                    : task.status === 4 || task.status === 5
                      ? 'bg-[var(--color-success)]'
                      : 'bg-[var(--color-primary)]'
                "
                :style="{ width: `${task.percentage}%` }"
              />
            </div>
            <p class="mt-1 flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
              <LoaderCircle v-if="task.status === 1" :size="11" class="animate-spin" />
              <Check
                v-else-if="task.status === 4 || task.status === 5"
                :size="11"
                class="text-[var(--color-success)]"
              />
              <FileWarning
                v-else-if="task.status === 6"
                :size="11"
                class="text-[var(--color-danger)]"
              />
              <span>{{ task.statusText }} · {{ task.percentage }}%</span>
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
