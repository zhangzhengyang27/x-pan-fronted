<script setup>
/**
 * ContextMenu —— 右键菜单（P1.12）
 *
 * 设计：
 * - 基于 Teleport + 动态定位
 * - 自适应视口边缘
 * - 支持快捷键提示
 * - 子菜单支持
 *
 * 用法：
 * <ContextMenu :items="menuItems" @select="onSelect"/>
 */
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'

const props = defineProps({
  visible: {type: Boolean, default: false},
  x: {type: Number, default: 0},
  y: {type: Number, default: 0},
  items: {type: Array, required: true},
})

const emit = defineEmits(['select', 'close'])

const menuRef = ref(null)
const adjusted = ref({x: 0, y: 0})

/** 自适应视口边界 */
function adjustPosition() {
  if (!menuRef.value) return
  const rect = menuRef.value.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  let nx = props.x
  let ny = props.y
  if (nx + rect.width > vw - 8) nx = vw - rect.width - 8
  if (ny + rect.height > vh - 8) ny = vh - rect.height - 8
  if (nx < 8) nx = 8
  if (ny < 8) ny = 8
  adjusted.value = {x: nx, y: ny}
}

watch(() => props.visible, async (v) => {
  if (v) {
    await nextTick()
    adjustPosition()
  }
})

/** 全局点击外部关闭 */
function onDocMouseDown(e) {
  if (!props.visible) return
  if (menuRef.value && !menuRef.value.contains(e.target)) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocMouseDown)
  document.addEventListener('contextmenu', onDocContextMenu)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMouseDown)
  document.removeEventListener('contextmenu', onDocContextMenu)
})

/** 阻止自身的默认右键 */
function onDocContextMenu(e) {
  if (props.visible && menuRef.value && menuRef.value.contains(e.target)) {
    e.preventDefault()
  }
}

function onSelect(item, index) {
  if (item.disabled) return
  if (item.divider) return
  emit('select', item, index)
  emit('close')
}

/** ESC 关闭 */
function onKeyDown(e) {
  if (props.visible && e.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <Teleport to="body">
    <Transition name="ctx">
      <div
        v-if="visible"
        ref="menuRef"
        class="fixed z-[100] min-w-[200px] py-1.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl backdrop-blur-sm"
        :style="{left: adjusted.x + 'px', top: adjusted.y + 'px'}"
        @contextmenu.prevent
      >
        <template v-for="(item, idx) in items" :key="idx">
          <div
            v-if="item.divider"
            class="my-1 h-px bg-[var(--color-border)]"
          />
          <button
            v-else
            type="button"
            :disabled="item.disabled"
            class="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-sm text-left transition-colors"
            :class="[
              item.disabled
                ? 'text-[var(--color-text-muted)] cursor-not-allowed opacity-50'
                : item.danger
                  ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10'
                  : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
            ]"
            @click="onSelect(item, idx)"
          >
            <span class="flex items-center gap-2.5 min-w-0">
              <component
                v-if="item.icon"
                :is="item.icon"
                :size="15"
                :class="item.danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'"
              />
              <span class="truncate">{{ item.label }}</span>
            </span>
            <kbd
              v-if="item.shortcut"
              class="ml-2 px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)] shrink-0"
            >
              {{ item.shortcut }}
            </kbd>
          </button>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ctx-enter-active, .ctx-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.ctx-enter-from, .ctx-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>