/**
 * 第三方库类型兜底（无官方类型 / 自带 .es.ts 触发 implicit any）
 * - @luohc92/vue3-image-viewer: 包自带源码会被 vue-tsc 检查，这里统一兜底为 any
 */
declare module '@luohc92/vue3-image-viewer' {
  import type { DefineComponent } from 'vue'
  const ImageViewer: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default ImageViewer
  export { ImageViewer }
}

declare module 'aplayer'
declare module 'artplayer'
declare module 'vditor'
declare module 'nprogress'
