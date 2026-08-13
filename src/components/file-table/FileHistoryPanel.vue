<script setup lang="ts">
/**
 * FileHistoryPanel —— 文件版本历史抽屉
 * 按 stitch_document_driven_page_design G4 设计规范修改
 * 侧滑抽屉 + 时间线展示
 */
import { computed, ref, watch } from 'vue'
import { History, RotateCcw, Trash2, Star, FileText, Upload, Edit3, X } from '@lucide/vue'
import BaseDrawer from '@/components/base/BaseDrawer.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import fileService from '@/api/file'
import { ElMessage, ElMessageBox } from '@/composables/useToast'

const props = defineProps({
  fileId: { type: String, required: true },
  open: { type: Boolean, default: false },
  filename: { type: String, default: '' }
})

const emit = defineEmits(['update:open', 'rolled-back'])

const loading = ref(false)
const versions = ref([])

async function load() {
  if (!props.fileId) return
  loading.value = true
  fileService.listVersions(
    { fileId: props.fileId },
    (res) => {
      loading.value = false
      if (res.code === 0) versions.value = res.data || []
      else ElMessage.error(res.message || '加载版本历史失败')
    },
    (err) => {
      loading.value = false
      ElMessage.error(err.message || '加载版本历史失败')
    }
  )
}

watch(
  () => props.fileId,
  () => {
    if (props.open) load()
  }
)
watch(
  () => props.open,
  (v) => {
    if (v) load()
  },
  { immediate: true }
)

function operationMeta(op) {
  return (
    {
      UPLOAD: { label: '上传', icon: Upload, variant: 'primary' },
      MODIFY: { label: '修改', icon: Edit3, variant: 'warning' },
      RENAME: { label: '改名', icon: Edit3, variant: 'neutral' },
      ROLLBACK: { label: '回滚', icon: RotateCcw, variant: 'success' },
      DELETE: { label: '删除', icon: Trash2, variant: 'danger' }
    }[op] || { label: op || '未知', icon: FileText, variant: 'neutral' }
  )
}

function versionIconBg(op) {
  const v = operationMeta(op).variant
  switch (v) {
    case 'primary':
      return 'bg-primary-50 dark:bg-primary-900/30'
    case 'warning':
      return 'bg-amber-50 dark:bg-amber-900/30'
    case 'success':
      return 'bg-emerald-50 dark:bg-emerald-900/30'
    case 'danger':
      return 'bg-red-50 dark:bg-red-900/30'
    default:
      return 'bg-(--color-surface-2)'
  }
}

function versionIconFg(op) {
  const v = operationMeta(op).variant
  switch (v) {
    case 'primary':
      return 'text-primary-600'
    case 'warning':
      return 'text-amber-600 dark:text-amber-400'
    case 'success':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'danger':
      return 'text-red-600 dark:text-red-400'
    default:
      return 'text-(--color-text-muted)'
  }
}

function shortHash(hash) {
  if (!hash) return ''
  return hash.length > 10 ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : hash
}

async function doRollback(v) {
  try {
    await ElMessageBox.confirm(
      `确定回滚到 v${v.versionNo}？此操作会创建一个新的版本。`,
      '回滚版本',
      {
        confirmButtonText: '回滚',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    return
  }
  fileService.rollback(
    { fileId: props.fileId, versionNo: v.versionNo },
    (res) => {
      if (res.code === 0) {
        ElMessage.success(`已回滚到 v${v.versionNo}`)
        emit('rolled-back', v)
        load()
      } else ElMessage.error(res.message || '回滚失败')
    },
    (err) => ElMessage.error(err.message || '回滚失败')
  )
}

async function doDelete(v) {
  if (v.current) return ElMessage.warning('不能删除当前正在使用的版本')
  try {
    await ElMessageBox.confirm(`确定删除 v${v.versionNo}？此操作不可恢复。`, '删除版本', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'danger'
    })
  } catch {
    return
  }
  fileService.deleteVersion(
    { fileId: props.fileId, versionNo: v.versionNo },
    (res) => {
      if (res.code === 0) {
        ElMessage.success('已删除')
        load()
      } else ElMessage.error(res.message || '删除失败')
    },
    (err) => ElMessage.error(err.message || '删除失败')
  )
}

const stats = computed(() => {
  return {
    total: versions.value.length,
    current: versions.value.filter((v) => v.current).length
  }
})
</script>

<template>
  <BaseDrawer
    :open="open"
    @update:open="(v) => emit('update:open', v)"
    title="版本历史"
    position="right"
    width="480px"
  >
    <template #header-extra>
      <div class="flex items-center gap-2 text-xs text-(--color-text-muted)">
        <span>共 {{ stats.total }} 个版本</span>
      </div>
    </template>
    
    <div class="flex flex-col h-full">
      <!-- 文件名 -->
      <div class="mb-4 px-1">
        <p class="text-sm font-medium text-(--color-text) truncate">{{ filename || '文件' }}</p>
      </div>
      
      <!-- 加载中 -->
      <div v-if="loading" class="py-12 text-center text-sm text-(--color-text-muted)">
        加载中...
      </div>
      
      <!-- 空状态 -->
      <div v-else-if="versions.length === 0" class="py-12 text-center">
        <div class="size-12 mx-auto rounded-2xl bg-(--color-surface-2) flex items-center justify-center text-(--color-text-muted) mb-3">
          <History :size="22" />
        </div>
        <p class="text-sm text-(--color-text-muted)">暂无历史版本</p>
        <p class="text-xs text-(--color-text-muted) mt-1">上传或修改文件后会自动生成版本</p>
      </div>
      
      <!-- 时间线 -->
      <div v-else class="flex-1 overflow-y-auto pr-1 space-y-0">
        <div
          v-for="(v, index) in versions"
          :key="v.id"
          class="relative flex gap-4 pb-6 last:pb-0"
        >
          <!-- 时间线竖线 -->
          <div
            v-if="index < versions.length - 1"
            class="absolute left-4 top-10 bottom-0 w-px bg-(--color-border)"
          />
          
          <!-- 节点 -->
          <div class="relative shrink-0">
            <div
              class="size-8 rounded-full flex items-center justify-center z-10"
              :class="[
                versionIconBg(v.operation),
                v.current ? 'ring-2 ring-primary-500' : ''
              ]"
            >
              <component
                :is="operationMeta(v.operation).icon"
                :size="14"
                :class="versionIconFg(v.operation)"
              />
            </div>
          </div>
          
          <!-- 内容 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span class="font-medium text-sm">v{{ v.versionNo }}</span>
              <BaseBadge :variant="operationMeta(v.operation).variant" size="sm">
                {{ operationMeta(v.operation).label }}
              </BaseBadge>
              <BaseBadge v-if="v.current" variant="success" size="sm">
                <span class="inline-flex items-center gap-1">
                  <Star :size="10" />
                  当前
                </span>
              </BaseBadge>
            </div>
            <p class="text-sm text-(--color-text) truncate mb-1">{{ v.filename }}</p>
            <div class="flex items-center gap-3 text-xs text-(--color-text-muted) flex-wrap">
              <span class="tabular-nums">{{ v.fileSizeDesc }}</span>
              <span v-if="v.contentHash" class="font-mono">{{ shortHash(v.contentHash) }}</span>
              <span>{{ v.operationTime }}</span>
            </div>
            
            <!-- 操作按钮 -->
            <div v-if="!v.current" class="flex items-center gap-1 mt-2">
              <BaseTooltip text="回滚到此版本" position="top">
                <BaseButton variant="ghost" size="sm" @click="doRollback(v)">
                  <RotateCcw :size="14" :stroke-width="2" />
                </BaseButton>
              </BaseTooltip>
              <BaseTooltip text="删除此版本" position="top">
                <BaseButton variant="danger" size="sm" @click="doDelete(v)">
                  <Trash2 :size="14" :stroke-width="2" />
                </BaseButton>
              </BaseTooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <template #footer>
      <BaseButton variant="secondary" @click="emit('update:open', false)">关闭</BaseButton>
    </template>
  </BaseDrawer>
</template>
