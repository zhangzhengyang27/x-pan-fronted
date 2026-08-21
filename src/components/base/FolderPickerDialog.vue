<script setup lang="ts">
/**
 * FolderPickerDialog —— 文件夹选择对话框（P0）
 *
 * 用法：
 * - 右键菜单 / 工具栏 → "移动到" 触发
 * - 树形展开目标文件夹 → 确认 → 调用 userFileService.transfer / copy
 *
 * Props:
 *  - open: 是否打开
 *  - mode: 'move' | 'copy'
 *  - row:  单个文件/文件夹（移动时必需）；批量时传入数组
 *
 * Emits:
 *  - update:open
 *  - complete (targetParentId)
 */
import { computed, ref, watch } from 'vue'
import type { PropType } from 'vue'
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Check,
  ArrowRight,
  Copy as CopyIcon
} from '@lucide/vue'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'
import { ElMessage } from '@/composables/useToast'
import fileService from '@/api/file'
import { useFileStore } from '@/stores/file'
import type { IFileVO } from '@/types'
import { FileType } from '@/types'

interface TreeNode {
  id: string
  name: string
  loaded: boolean
  children: TreeNode[]
}

const props = defineProps({
  open: { type: Boolean, default: false },
  mode: { type: String as PropType<'move' | 'copy'>, default: 'move' },
  row: { type: [Object, Array] as PropType<IFileVO | IFileVO[]>, default: null }
})

const emit = defineEmits(['update:open', 'complete'])

const fileStore = useFileStore()
const expanded = ref<Set<string>>(new Set()) // 已展开的文件夹 ID
const tree = ref<TreeNode[]>([]) // [{id, name, children: [...]}]
const selectedId = ref<string | null>(null) // 当前选中的目标 parentId（null = 根目录）
const submitting = ref(false)

const isMove = computed(() => props.mode === 'move')

const title = computed(() => (isMove.value ? '移动到' : '复制到'))

// ─── 树形数据 ────────────────────────────────────────────────────────────
async function loadRoot() {
  await fileStore.loadFileList()
  buildTreeFromStore()
}

function buildTreeFromStore() {
  // 用 fileStore.fileList 作为顶层，加载时按需展开子节点
  // 注意：文件夹的 fileType 为 0（后端 createFolder 传 null → DB 默认值 0），
  // 与 FileType.FOLDER = 0 对齐，必须用枚举判断。
  tree.value = fileStore.fileList.filter((f) => f.fileType === FileType.FOLDER).map(toTreeNode)
}

function toTreeNode(item: IFileVO): TreeNode {
  return {
    id: item.fileId,
    name: item.filename,
    loaded: false,
    children: []
  }
}

async function loadChildren(node: TreeNode) {
  if (node.loaded) return
  return new Promise<void>((resolve) => {
    fileService.list(
      { parentId: node.id, fileTypes: '', pageNum: 1, pageSize: 1000 },
      (res) => {
        const rows = (res.data && res.data.records) || []
        node.children = rows.filter((f) => f.fileType === FileType.FOLDER).map(toTreeNode)
        node.loaded = true
        resolve()
      },
      () => resolve()
    )
  })
}

async function toggle(node: TreeNode) {
  if (expanded.value.has(node.id)) {
    expanded.value.delete(node.id)
  } else {
    expanded.value.add(node.id)
    await loadChildren(node)
  }
  // 触发响应式更新
  expanded.value = new Set(expanded.value)
}

function isExpanded(id: string) {
  return expanded.value.has(id)
}

function selectRoot() {
  selectedId.value = null
}

function selectNode(node: TreeNode) {
  selectedId.value = node.id
}

// ─── 提交 ────────────────────────────────────────────────────────────
async function submit() {
  if (!props.row) return
  submitting.value = true
  const rows = Array.isArray(props.row) ? props.row : [props.row]
  const fileIds = rows.map((r) => r.fileId)

  const api = isMove.value ? fileService.transfer : fileService.copy
  api(
    { fileIds, targetParentId: selectedId.value == null ? '' : String(selectedId.value) },
    () => {
      ElMessage.success(isMove.value ? '移动成功' : '复制成功')
      submitting.value = false
      emit('complete', selectedId.value)
      emit('update:open', false)
    },
    (err: { message?: string }) => {
      ElMessage.error(err?.message || '操作失败')
      submitting.value = false
    }
  )
}

function close() {
  emit('update:open', false)
}

// 打开时刷新一次
watch(
  () => props.open,
  (v) => {
    if (v) loadRoot()
  },
  { immediate: true }
)
</script>

<template>
  <BaseModal :open="open" @update:open="(v) => emit('update:open', v)" :title="title" size="md">
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2 text-xs text-(--color-text-muted)">
        <component :is="isMove ? ArrowRight : CopyIcon" :size="14" />
        将
        <strong class="text-(--color-text)">{{
          Array.isArray(row) ? `${row.length} 项` : row?.filename || ''
        }}</strong>
        {{ isMove ? '移动' : '复制' }} 到：
      </div>

      <!-- 目标文件夹树 -->
      <div
        class="max-h-[50vh] overflow-y-auto rounded-xl border border-(--color-border) p-2 bg-(--color-surface-2)/40"
      >
        <!-- 根目录 -->
        <button
          type="button"
          class="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-sm text-sm transition-colors"
          :class="
            selectedId === null
              ? 'bg-primary-50 text-primary-700 font-medium'
              : 'hover:bg-(--color-surface-2)'
          "
          @click="selectRoot"
        >
          <Folder :size="16" />
          <span>我的网盘（根目录）</span>
          <Check
            v-if="selectedId === null"
            :size="14"
            class="ml-auto text-primary-600"
          />
        </button>

        <!-- 子树 -->
        <div v-for="node in tree" :key="node.id" class="ml-2">
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="size-6 flex items-center justify-center text-(--color-text-muted) hover:text-(--color-text)"
              @click="toggle(node)"
            >
              <ChevronDown v-if="isExpanded(node.id)" :size="14" />
              <ChevronRight v-else :size="14" />
            </button>
            <button
              type="button"
              class="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-sm text-sm transition-colors"
              :class="
                selectedId === node.id
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'hover:bg-(--color-surface-2)'
              "
              @click="selectNode(node)"
            >
              <component :is="isExpanded(node.id) ? FolderOpen : Folder" :size="16" />
              <span class="truncate">{{ node.name }}</span>
              <Check
                v-if="selectedId === node.id"
                :size="14"
                class="ml-auto text-primary-600"
              />
            </button>
          </div>

          <div v-if="isExpanded(node.id) && node.children.length" class="ml-6">
            <div v-for="child in node.children" :key="child.id" class="flex items-center gap-1">
              <div class="size-6" />
              <button
                type="button"
                class="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-sm text-sm transition-colors"
                :class="
                  selectedId === child.id
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'hover:bg-(--color-surface-2)'
                "
                @click="selectNode(child)"
              >
                <Folder :size="16" />
                <span class="truncate">{{ child.name }}</span>
                <Check
                  v-if="selectedId === child.id"
                  :size="14"
                  class="ml-auto text-primary-600"
                />
              </button>
            </div>
          </div>
        </div>

        <div v-if="!tree.length" class="py-8 text-center text-sm text-(--color-text-muted)">
          暂无文件夹
        </div>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="close">取消</BaseButton>
      <BaseButton variant="primary" :loading="submitting" @click="submit">
        <span class="inline-flex items-center gap-1.5">
          <Check :size="14" /> 确认{{ isMove ? '移动' : '复制' }}
        </span>
      </BaseButton>
    </template>
  </BaseModal>
</template>
