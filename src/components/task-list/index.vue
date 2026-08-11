<template>
  <div class="task-list-content">
    <BasePopover v-model="viewFlag" position="bottom-end" class="task-popover">
      <template #trigger>
        <button
          type="button"
          class="relative inline-flex items-center justify-center"
          aria-label="上传任务列表"
        >
          <ListOrdered :size="18" />
          <span
            v-if="!uploadTaskFlag"
            class="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[var(--color-danger)] text-white text-[10px] leading-4 text-center"
          >
            {{ uploadTaskNum > 99 ? '99+' : uploadTaskNum }}
          </span>
        </button>
      </template>

      <div class="w-[min(90vw,600px)]">
        <div class="px-4 py-2.5 border-b border-[var(--color-border)] font-medium text-sm">
          上传任务列表
        </div>
        <BaseTable
          :columns="tableColumns"
          :data="taskList"
          row-key="filename"
          empty-text="暂无传输任务"
          :skeleton="false"
        >
          <template #cell-filename="{ row }">
            <span class="block truncate max-w-[120px]" :title="row.filename">{{
              row.filename
            }}</span>
          </template>

          <template #cell-status="{ row }">
            <span class="rp-tooltip" data-pos="top">
              <span class="inline-flex items-center gap-1">
                <Clock
                  v-if="row.status === fileStatus.WAITING.code"
                  :size="16"
                  class="text-[var(--color-text-muted)]"
                />
                <Play
                  v-else-if="row.status === fileStatus.PAUSE.code"
                  :size="16"
                  class="text-[var(--color-warning)]"
                />
                <Upload
                  v-else-if="row.status === fileStatus.UPLOADING.code"
                  :size="16"
                  class="text-[var(--color-primary-600)]"
                />
                <TriangleAlert
                  v-else-if="row.status === fileStatus.FAIL.code"
                  :size="16"
                  class="text-[var(--color-danger)]"
                />
                <LoaderCircle
                  v-else-if="row.status === fileStatus.PARSING.code"
                  :size="16"
                  class="text-[var(--color-primary-600)] animate-spin"
                />
                <Coins
                  v-else-if="row.status === fileStatus.MERGE.code"
                  :size="16"
                  class="text-[var(--color-warning)]"
                />
              </span>
              <span class="rp-tooltip__bubble" role="tooltip">{{ row.statusText }}</span>
            </span>
          </template>

          <template #cell-progress="{ row }">
            <span class="rp-tooltip block w-full" data-pos="top">
              <BaseProgress :value="row.percentage" size="sm" />
              <span class="rp-tooltip__bubble" role="tooltip">
                上传速度: {{ row.speed }}<br />上传大小: {{ row.uploadedSize }}/{{ row.fileSize
                }}<br />剩余时间:
                {{ row.timeRemaining }}
              </span>
            </span>
          </template>

          <template #cell-action="{ row }">
            <span class="flex items-center gap-1">
              <span class="rp-tooltip" data-pos="top">
                <BaseButton
                  v-show="row.status === fileStatus.UPLOADING.code"
                  variant="secondary"
                  size="sm"
                  class="rounded-full !px-1.5 !w-7 !h-7"
                  @click="pause(row.filename)"
                >
                  <Pause :size="13" />
                </BaseButton>
                <span class="rp-tooltip__bubble" role="tooltip">暂停上传</span>
              </span>

              <span class="rp-tooltip" data-pos="top">
                <BaseButton
                  v-show="row.status === fileStatus.PAUSE.code"
                  variant="secondary"
                  size="sm"
                  class="rounded-full !px-1.5 !w-7 !h-7"
                  @click="resume(row.filename)"
                >
                  <Play :size="13" />
                </BaseButton>
                <span class="rp-tooltip__bubble" role="tooltip">继续上传</span>
              </span>

              <span class="rp-tooltip" data-pos="top">
                <BaseButton
                  v-show="
                    row.status === fileStatus.UPLOADING.code ||
                    row.status === fileStatus.WAITING.code ||
                    row.status === fileStatus.PAUSE.code ||
                    row.status === fileStatus.FAIL.code
                  "
                  variant="danger"
                  size="sm"
                  class="rounded-full !px-1.5 !w-7 !h-7"
                  @click="cancel(row.filename)"
                >
                  <CircleX :size="13" />
                </BaseButton>
                <span class="rp-tooltip__bubble" role="tooltip">取消上传</span>
              </span>

              <span class="rp-tooltip" data-pos="top">
                <BaseButton
                  v-show="row.status === fileStatus.FAIL.code"
                  variant="secondary"
                  size="sm"
                  class="rounded-full !px-1.5 !w-7 !h-7"
                  @click="retry(row.filename)"
                >
                  <RefreshCw :size="13" />
                </BaseButton>
                <span class="rp-tooltip__bubble" role="tooltip">重新上传</span>
              </span>
            </span>
          </template>
        </BaseTable>
      </div>
    </BasePopover>
  </div>
</template>

<script setup lang="ts">
import { useTaskStore } from '@/stores/task'
import { storeToRefs } from 'pinia'
import panUtil from '@/utils/common'
import BasePopover from '@/components/base/BasePopover.vue'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseProgress from '@/components/base/BaseProgress.vue'
import {
  ListOrdered,
  Clock,
  Play,
  Upload,
  TriangleAlert,
  LoaderCircle,
  Coins,
  Pause,
  CircleX,
  RefreshCw
} from '@lucide/vue'

const taskStore = useTaskStore()

const { uploadTaskNum, uploadTaskFlag, viewFlag, taskList } = storeToRefs(taskStore)
const { pause, resume, cancel, retry } = taskStore

const fileStatus = panUtil.fileStatus

const tableColumns = [
  { key: 'filename', title: '文件名称', width: 120, align: 'left' },
  { key: 'status', title: '文件状态', width: 120, align: 'center' },
  { key: 'progress', title: '上传进度', width: 180, align: 'center' },
  { key: 'action', title: '操作', width: 180, align: 'center' }
]
</script>

<style scoped>
.task-list-content {
  display: inline-block;
}
.task-popover {
  position: relative;
}
/* 复用全局 rp-tooltip 气泡样式（BaseTooltip 的 scoped 样式不在此组件作用域，此处补全） */
.rp-tooltip {
  position: relative;
  display: inline-flex;
}
.rp-tooltip .rp-tooltip__bubble {
  position: absolute;
  white-space: nowrap;
  background: var(--color-neutral-900);
  color: var(--color-neutral-0);
  font-size: var(--text-xs);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  pointer-events: none;
  opacity: 0;
  transform: translateX(-50%) scale(0.96);
  transition:
    opacity var(--dur-fast) var(--ease),
    transform var(--dur-fast) var(--ease);
  z-index: var(--z-tooltip);
  bottom: calc(100% + 6px);
  left: 50%;
}
.rp-tooltip:hover .rp-tooltip__bubble,
.rp-tooltip:focus-within .rp-tooltip__bubble {
  opacity: 1;
  transform: translateX(-50%) scale(1);
}
</style>
