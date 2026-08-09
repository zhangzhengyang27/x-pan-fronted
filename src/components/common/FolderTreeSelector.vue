<script setup>
/**
 * FolderTreeSelector —— 文件夹树选择器
 * 1:1 复现 html5-examples DrivePreviewModal MoveDialog
 * - 数据：[{ id, label, children: [] }]
 * - 根目录特殊选项（id 留空 + 家居图标）
 * - 单选高亮
 * - defaultExpandAll 选项
 * - 加载状态 / 错误状态 / 空状态
 */
import { computed, ref, watch } from 'vue'
import { Home, Loader2, AlertCircle, FolderOpen } from '@lucide/vue'
import BaseTree from '@/components/base/BaseTree.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import fileService from '@/api/file'
import { ElMessage } from '@/composables/useToast'

const props = defineProps({
  modelValue: { type: String, default: null }, // 选中的 fileId (null = 根目录)
  open: { type: Boolean, default: false },
  /** dialog title */
  title: { type: String, default: '选择文件夹' },
  /** 提交按钮文案 */
  confirmText: { type: String, default: '确定' },
  /** 禁用的 fileId 列表（不能选为目标的，例如要移动的文件夹本身） */
  excludeIds: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:open', 'update:modelValue', 'confirm'])

const treeData = ref([])
const loading = ref(false)
const initialLoading = ref(true)
const error = ref('')
const selectedId = ref(null)
const selectedLabel = ref('根目录')

// 把后端数据转成 BaseTree 格式
function normalizeTree(nodes) {
  return (nodes || []).map((n) => ({
    id: n.id ?? n.fileId,
    label: n.name ?? n.label ?? n.filename ?? '未命名',
    children: normalizeTree(n.children || []),
    disabled: props.excludeIds.includes(n.id ?? n.fileId)
  }))
}

async function loadTree() {
  loading.value = true
  error.value = ''
  try {
    const res = await new Promise((resolve, reject) => {
      fileService.getFolderTree(resolve, reject)
    })
    treeData.value = normalizeTree(res.data)
  } catch (e) {
    error.value = e?.message || '文件夹加载失败'
  } finally {
    loading.value = false
    initialLoading.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (open && initialLoading.value) {
      loadTree()
    } else if (open) {
      // 每次打开时刷新（缓存下，保持简单）
      loadTree()
    }
    if (open) {
      selectedId.value = props.modelValue ?? null
      updateSelectedLabel()
    }
  }
)

function pickRoot() {
  selectedId.value = null
  selectedLabel.value = '根目录'
}

function onTreeSelect(node) {
  if (node.disabled) {
    ElMessage.warning('不能选择该文件夹')
    return
  }
  selectedId.value = node.id
  selectedLabel.value = node.label
}

function updateSelectedLabel() {
  if (selectedId.value === null) {
    selectedLabel.value = '根目录'
  } else {
    const find = (nodes) => {
      for (const n of nodes) {
        if (n.id === selectedId.value) return n.label
        if (n.children?.length) {
          const r = find(n.children)
          if (r) return r
        }
      }
      return null
    }
    selectedLabel.value = find(treeData.value) || '已选文件夹'
  }
}

function close() {
  emit('update:open', false)
}

function confirm() {
  emit('update:modelValue', selectedId.value)
  emit('confirm', { targetId: selectedId.value, targetLabel: selectedLabel.value })
  close()
}

const hasTree = computed(() => treeData.value.length > 0)
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    @click.self="close"
  >
    <div
      class="w-[460px] max-w-[92vw] bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-xl overflow-hidden"
    >
      <header
        class="h-12 px-4 flex items-center justify-between border-b border-[var(--color-border)]"
      >
        <h3 class="text-sm font-semibold text-[var(--color-text)]">{{ title }}</h3>
        <button
          type="button"
          class="size-7 rounded-md hover:bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-text-muted)]"
          @click="close"
        >
          <span class="i-lucide-x text-base" />
        </button>
      </header>

      <div class="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
        <p class="text-xs text-[var(--color-text-muted)]">目标位置</p>
        <p class="mt-1 text-sm text-[var(--color-text)] truncate">{{ selectedLabel }}</p>
      </div>

      <div class="p-2 h-72 overflow-auto">
        <div
          v-if="loading"
          class="flex h-full items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]"
        >
          <Loader2 :size="16" class="animate-spin" />
          加载中...
        </div>
        <div
          v-else-if="error"
          class="flex h-full flex-col items-center justify-center gap-2 text-sm text-[var(--color-danger)]"
        >
          <AlertCircle :size="20" />
          {{ error }}
          <BaseButton variant="ghost" size="sm" @click="loadTree">重试</BaseButton>
        </div>
        <div
          v-else-if="!hasTree"
          class="flex h-full items-center justify-center text-sm text-[var(--color-text-muted)]"
        >
          暂无可用文件夹
        </div>
        <ul v-else class="m-0 p-0 list-none">
          <li>
            <button
              type="button"
              class="w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-sm transition-colors"
              :class="
                selectedId === null
                  ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] dark:bg-[var(--color-primary-900)]/30 dark:text-[var(--color-primary-300)]'
                  : 'hover:bg-[var(--color-surface-2)] text-[var(--color-text)]'
              "
              @click="pickRoot"
            >
              <Home :size="16" class="shrink-0" />
              <span class="truncate">根目录</span>
            </button>
          </li>
          <BaseTree :data="treeData" @select="onTreeSelect" />
        </ul>
      </div>

      <footer
        class="h-12 px-4 flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]"
      >
        <BaseButton variant="ghost" size="sm" @click="close">取消</BaseButton>
        <BaseButton variant="primary" size="sm" @click="confirm">{{ confirmText }}</BaseButton>
      </footer>
    </div>
  </div>
</template>
