<script setup lang="ts">
/**
 * ShortcutsPanel —— 全局快捷键面板（P1.12）
 *
 * - 按 `?` 或 Shift+/ 唤出
 * - 分类展示所有可用快捷键
 * - 支持搜索过滤
 * - 一键查看
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  Keyboard,
  X,
  Search,
  Edit3,
  Grid3x3,
  Download,
  CheckSquare,
  ArrowUpDown,
  Search as SearchIcon
} from '@lucide/vue'
import BaseInput from './BaseInput.vue'

const open = ref(false)
const keyword = ref('')

/** 监听外部触发（导航栏按钮） */
function onExternalOpen() {
  open.value = true
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('xpan:open-shortcuts', onExternalOpen)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('xpan:open-shortcuts', onExternalOpen)
})

// 仅展示已真实实现的快捷键（与 useShortcuts / FileTable 实际逻辑一致）
const shortcuts = [
  {
    group: '列表导航',
    icon: ArrowUpDown,
    items: [
      { keys: ['↑', '↓'], desc: '上下移动高亮' },
      { keys: ['Enter'], desc: '打开高亮文件' },
      { keys: ['→'], desc: '进入文件夹' },
      { keys: ['←'], desc: '返回上一级' },
      { keys: ['Space'], desc: '切换高亮项选中' }
    ]
  },
  {
    group: '多选操作',
    icon: CheckSquare,
    items: [
      { keys: ['Ctrl', 'A'], desc: '全选 / 取消全选' },
      { keys: ['Delete'], desc: '删除选中文件' },
      { keys: ['Esc'], desc: '取消选择 / 收起面板' }
    ]
  },
  {
    group: '编辑操作',
    icon: Edit3,
    items: [
      { keys: ['F2'], desc: '重命名选中文件' },
      { keys: ['Ctrl', 'Shift', 'N'], desc: '新建文件夹' }
    ]
  },
  {
    group: '视图操作',
    icon: Grid3x3,
    items: [
      { keys: ['Ctrl', '1'], desc: '列表视图' },
      { keys: ['Ctrl', '2'], desc: '网格视图' },
      { keys: ['F5'], desc: '刷新当前目录' }
    ]
  },
  {
    group: '上传下载',
    icon: Download,
    items: [
      { keys: ['Ctrl', 'U'], desc: '打开上传面板' },
      { keys: ['Ctrl', 'D'], desc: '下载选中文件' }
    ]
  },
  {
    group: '搜索与导航',
    icon: SearchIcon,
    items: [
      { keys: ['Ctrl', 'K'], desc: '聚焦搜索框' },
      { keys: ['G', 'I'], desc: '跳到图片' },
      { keys: ['G', 'D'], desc: '跳到文档' },
      { keys: ['G', 'S'], desc: '跳到分享' },
      { keys: ['G', 'R'], desc: '跳到回收站' },
      { keys: ['G', 'H'], desc: '回到首页' }
    ]
  },
  {
    group: '其他',
    icon: Keyboard,
    items: [
      { keys: ['?'], desc: '显示/隐藏快捷键面板（当前）' },
      { keys: ['Ctrl', '/'], desc: '同上' }
    ]
  }
]

const filteredShortcuts = computed(() => {
  if (!keyword.value) return shortcuts
  const lower = keyword.value.toLowerCase()
  return shortcuts
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          it.desc.toLowerCase().includes(lower) || it.keys.join(' ').toLowerCase().includes(lower)
      )
    }))
    .filter((g) => g.items.length > 0)
})

/** 统一的全局键盘监听（页面级） */
function onKeydown(e) {
  // ? 唤出
  if (e.key === '?' || (e.shiftKey && e.key === '/')) {
    const t = e.target
    const isInput = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
    if (!isInput) {
      e.preventDefault()
      open.value = !open.value
      return
    }
  }
  // Ctrl+/ 同义
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault()
    open.value = !open.value
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      @click.self="open = false"
    >
      <div
        class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-[92vw] max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
      >
        <!-- Header -->
        <div
          class="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-3"
        >
          <div class="flex items-center gap-2">
            <div
              class="size-9 rounded-sm bg-gradient-to-br from-[var(--color-primary-500)] to-[var(--color-primary-700)] flex items-center justify-center text-white"
            >
              <Keyboard :size="18" />
            </div>
            <div>
              <h2 class="text-base font-semibold m-0">键盘快捷键</h2>
              <p class="text-xs text-[var(--color-text-muted)] m-0 mt-0.5">
                按
                <kbd
                  class="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[10px]"
                  >?</kbd
                >
                随时唤出
              </p>
            </div>
          </div>
          <button
            type="button"
            class="text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-1 rounded-sm hover:bg-[var(--color-surface-2)]"
            @click="open = false"
          >
            <X :size="18" />
          </button>
        </div>

        <!-- Search -->
        <div class="px-5 py-3 border-b border-[var(--color-border)]">
          <BaseInput v-model="keyword" placeholder="搜索快捷键..." :prefix="Search" />
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-5 py-4">
          <div
            v-if="filteredShortcuts.length === 0"
            class="text-center py-12 text-sm text-[var(--color-text-muted)]"
          >
            没有匹配的快捷键
          </div>
          <div v-for="(group, gi) in filteredShortcuts" :key="gi" class="mb-6 last:mb-0">
            <div
              class="flex items-center gap-2 mb-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider"
            >
              <component :is="group.icon" :size="14" />
              {{ group.group }}
            </div>
            <div class="space-y-1">
              <div
                v-for="(item, ii) in group.items"
                :key="ii"
                class="flex items-center justify-between gap-3 px-3 py-2 rounded-sm hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <span class="text-sm">{{ item.desc }}</span>
                <div class="flex items-center gap-1 shrink-0">
                  <template v-for="(k, ki) in item.keys" :key="ki">
                    <kbd
                      class="px-2 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[11px] font-mono min-w-[24px] text-center"
                    >
                      {{ k }}
                    </kbd>
                    <span
                      v-if="ki < item.keys.length - 1"
                      class="text-[var(--color-text-muted)] text-xs"
                      >+</span
                    >
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="px-5 py-3 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)]"
        >
          <span>共 {{ shortcuts.reduce((s, g) => s + g.items.length, 0) }} 个快捷键</span>
          <span
            >按
            <kbd
              class="px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px]"
              >Esc</kbd
            >
            关闭</span
          >
        </div>
      </div>
    </div>
  </Teleport>
</template>
