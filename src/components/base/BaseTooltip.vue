<script setup>
/**
 * BaseTooltip —— CSS-only 悬浮提示（无需 JS 即可工作）
 * 通过 ::after 显示内容，配合 transition 实现淡入
 */
defineProps({
  text: { type: String, default: '' },
  position: { type: String, default: 'top' } // top | bottom | left | right
})
</script>

<template>
  <span class="rp-tooltip" :data-pos="position">
    <slot />
    <span v-if="text" class="rp-tooltip__bubble" role="tooltip">{{ text }}</span>
  </span>
</template>

<style scoped>
.rp-tooltip {
  position: relative;
  display: inline-flex;
}
.rp-tooltip__bubble {
  position: absolute;
  white-space: nowrap;
  background: var(--color-neutral-900);
  color: var(--color-neutral-0);
  font-size: var(--text-xs);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  pointer-events: none;
  opacity: 0;
  transform: scale(0.96);
  transition:
    opacity var(--dur-fast) var(--ease),
    transform var(--dur-fast) var(--ease);
  z-index: var(--z-tooltip);
}
.rp-tooltip:hover .rp-tooltip__bubble,
.rp-tooltip:focus-within .rp-tooltip__bubble {
  opacity: 1;
  transform: scale(1);
}
.rp-tooltip[data-pos='top'] .rp-tooltip__bubble {
  bottom: calc(100% + 6px);
  left: 50%;
  transform-origin: bottom center;
  margin-left: auto;
}
.rp-tooltip[data-pos='top']:hover .rp-tooltip__bubble,
.rp-tooltip[data-pos='top']:focus-within .rp-tooltip__bubble {
  transform: translateX(-50%) scale(1);
}
.rp-tooltip[data-pos='top'] .rp-tooltip__bubble {
  transform: translateX(-50%) scale(0.96);
}
.rp-tooltip[data-pos='bottom'] .rp-tooltip__bubble {
  top: calc(100% + 6px);
  left: 50%;
  margin-left: auto;
  transform: translateX(-50%) scale(0.96);
}
.rp-tooltip[data-pos='bottom']:hover .rp-tooltip__bubble,
.rp-tooltip[data-pos='bottom']:focus-within .rp-tooltip__bubble {
  transform: translateX(-50%) scale(1);
}
.rp-tooltip[data-pos='left'] .rp-tooltip__bubble {
  right: calc(100% + 6px);
  top: 50%;
  transform: translateY(-50%) scale(0.96);
}
.rp-tooltip[data-pos='left']:hover .rp-tooltip__bubble,
.rp-tooltip[data-pos='left']:focus-within .rp-tooltip__bubble {
  transform: translateY(-50%) scale(1);
}
.rp-tooltip[data-pos='right'] .rp-tooltip__bubble {
  left: calc(100% + 6px);
  top: 50%;
  transform: translateY(-50%) scale(0.96);
}
.rp-tooltip[data-pos='right']:hover .rp-tooltip__bubble,
.rp-tooltip[data-pos='right']:focus-within .rp-tooltip__bubble {
  transform: translateY(-50%) scale(1);
}
</style>
