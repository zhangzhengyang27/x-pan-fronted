<script setup>
/**
 * FileHistoryPanel —— 文件版本历史弹窗（P1.13）
 *
 * 设计：
 * - 时间线展示（最新在上）
 * - 当前版本标星
 * - 支持回滚（生成新版本，不丢历史）
 * - 支持删除旧版本
 * - 显示 hash 截断便于识别
 */
import {computed, ref, watch} from 'vue'
import {History, RotateCcw, Trash2, Star, FileText, Upload as UploadIcon, Edit3} from '@lucide/vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import fileService from '@/api/file'
import {ElMessage, ElMessageBox} from '@/composables/useToast'

const props = defineProps({
  fileId: {type: String, required: true},
  open: {type: Boolean, default: false},
})

const emit = defineEmits(['update:open', 'rolled-back'])

const loading = ref(false)
const versions = ref([])

async function load() {
  if (!props.fileId) return
  loading.value = true
  fileService.listVersions(
    {fileId: props.fileId},
    (res) => {
      loading.value = false
      if (res.code === 0) versions.value = res.data || []
      else ElMessage.error(res.message || '加载版本历史失败')
    },
    (err) => {
      loading.value = false
      ElMessage.error(err.message || '加载版本历史失败')
    },
  )
}

// 切换文件时重新加载
watch(() => props.fileId, () => {
  if (props.open) load()
})
// 打开时也加载
watch(() => props.open, (v) => { if (v) load() }, {immediate: true})

function operationMeta(op) {
  return {
    UPLOAD:   {label: '上传', icon: UploadIcon, variant: 'primary'},
    MODIFY:   {label: '修改', icon: Edit3,     variant: 'warning'},
    RENAME:   {label: '改名', icon: Edit3,     variant: 'neutral'},
    ROLLBACK: {label: '回滚', icon: RotateCcw, variant: 'success'},
    DELETE:   {label: '删除', icon: Trash2,    variant: 'danger'},
  }[op] || {label: op || '未知', icon: FileText, variant: 'neutral'}
}

function versionIconBg(op) {
  const v = operationMeta(op).variant
  switch (v) {
    case 'primary': return 'bg-[var(--color-primary-50)] dark:bg-[var(--color-primary-900)]/30'
    case 'warning': return 'bg-amber-50 dark:bg-amber-900/30'
    case 'success': return 'bg-emerald-50 dark:bg-emerald-900/30'
    case 'danger':  return 'bg-red-50 dark:bg-red-900/30'
    default:        return 'bg-[var(--color-surface-2)]'
  }
}

function versionIconFg(op) {
  const v = operationMeta(op).variant
  switch (v) {
    case 'primary': return 'text-[var(--color-primary-600)]'
    case 'warning': return 'text-amber-600 dark:text-amber-400'
    case 'success': return 'text-emerald-600 dark:text-emerald-400'
    case 'danger':  return 'text-red-600 dark:text-red-400'
    default:        return 'text-[var(--color-text-muted)]'
  }
}

function shortHash(hash) {
  if (!hash) return ''
  return hash.length > 10 ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : hash
}

async function doRollback(v) {
  try {
    await ElMessageBox({
      title: '回滚版本',
      message: `确定回滚到 v${v.versionNo}？此操作会创建一个新的版本。`,
      confirmText: '回滚',
      cancelText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  fileService.rollback(
    {fileId: props.fileId, versionNo: v.versionNo},
    (res) => {
      if (res.code === 0) {
        ElMessage.success(`已回滚到 v${v.versionNo}`)
        emit('rolled-back', v)
        load()
      } else ElMessage.error(res.message || '回滚失败')
    },
    (err) => ElMessage.error(err.message || '回滚失败'),
  )
}

async function doDelete(v) {
  if (v.current) return ElMessage.warning('不能删除当前正在使用的版本')
  try {
    await ElMessageBox({
      title: '删除版本',
      message: `确定删除 v${v.versionNo}？此操作不可恢复。`,
      confirmText: '删除',
      cancelText: '取消',
      type: 'danger',
    })
  } catch {
    return
  }
  fileService.deleteVersion(
    {fileId: props.fileId, versionNo: v.versionNo},
    (res) => {
      if (res.code === 0) {
        ElMessage.success('已删除')
        load()
      } else ElMessage.error(res.message || '删除失败')
    },
    (err) => ElMessage.error(err.message || '删除失败'),
  )
}

const stats = computed(() => {
  return {
    total: versions.value.length,
    current: versions.value.filter((v) => v.current).length,
  }
})
</script>

<template>
  <BaseModal
    :open="open"
    @update:open="(v) => emit('update:open', v)"
    title="版本历史"
    size="lg"
  >
    <template #header-extra>
      <div class="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
        <span>共 {{ stats.total }} 个版本</span>
        <BaseBadge variant="success" size="sm">
          <span class="inline-flex items-center gap-1">
            <Star :size="11"/>当前 v{{ versions.find((v) => v.current)?.versionNo || '?' }}
          </span>
        </BaseBadge>
      </div>
    </template>
    <div v-if="loading" class="py-12 text-center text-sm text-[var(--color-text-muted)]">
      加载中...
    </div>
    <div v-else-if="versions.length === 0" class="py-12 text-center">
      <div class="size-12 mx-auto rounded-2xl bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-text-muted)] mb-3">
        <History :size="22"/>
      </div>
      <p class="text-sm text-[var(--color-text-muted)]">暂无版本记录</p>
      <p class="text-xs text-[var(--color-text-muted)] mt-1">上传或修改文件后会自动生成版本</p>
    </div>
    <div v-else class="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
      <div
        v-for="v in versions"
        :key="v.id"
        class="group relative flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors"
        :class="v.current ? 'border-[var(--color-primary-500)] bg-[var(--color-primary-50)]/40 dark:bg-[var(--color-primary-900)]/10' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]'"
      >
        <!-- 图标 -->
        <div class="size-9 shrink-0 rounded-lg flex items-center justify-center" :class="versionIconBg(v.operation)">
          <component :is="operationMeta(v.operation).icon" :size="16" :class="versionIconFg(v.operation)"/>
        </div>
        <!-- 内容 -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-medium text-sm">v{{ v.versionNo }}</span>
            <BaseBadge :variant="operationMeta(v.operation).variant" size="sm">
              {{ operationMeta(v.operation).label }}
            </BaseBadge>
            <BaseBadge v-if="v.current" variant="success" size="sm">
              <span class="inline-flex items-center gap-1"><Star :size="10"/>当前</span>
            </BaseBadge>
          </div>
          <p class="mt-1 text-sm text-[var(--color-text)] truncate">{{ v.filename }}</p>
          <div class="mt-1 flex items-center gap-3 text-xs text-[var(--color-text-muted)] flex-wrap">
            <span>{{ v.fileSizeDesc }}</span>
            <span v-if="v.contentHash" class="font-mono">{{ shortHash(v.contentHash) }}</span>
            <span>{{ v.operationTime }}</span>
            <span v-if="v.remark" class="italic">— {{ v.remark }}</span>
          </div>
        </div>
        <!-- 操作 -->
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <BaseTooltip v-if="!v.current" text="回滚到此版本" position="top">
            <BaseButton variant="ghost" size="sm" @click="doRollback(v)">
              <RotateCcw :size="14"/>
            </BaseButton>
          </BaseTooltip>
          <BaseTooltip v-if="!v.current" text="删除此版本" position="top">
            <BaseButton variant="danger" size="sm" @click="doDelete(v)">
              <Trash2 :size="14"/>
            </BaseButton>
          </BaseTooltip>
        </div>
      </div>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('update:open', false)">关闭</BaseButton>
    </template>
  </BaseModal>
</template>