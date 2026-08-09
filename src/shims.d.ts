/// <reference types="vite/client" />
/**
 * 全局类型声明 / Shim
 *
 * - 解决 .vue 文件导入
 * - 让 IDE 推断 window 下挂载的属性（panUtil 等）
 */

// .vue 文件类型支持
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// CSS Modules / 静态资源
declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.scss'
declare module '*.css'

declare module '*.svg'
declare module '*.png'
declare module '*.jpg'
declare module '*.jpeg'
declare module '*.gif'
declare module '*.webp'

declare module '*.md'

// 第三方无类型库兜底
declare module 'simple-uploader.js'
declare module 'nprogress'
declare module 'aplayer'
declare module 'artplayer'
declare module 'vditor'
declare module 'spark-md5'
declare module '@luohc92/vue3-image-viewer' {
  import type { DefineComponent } from 'vue'
  const ImageViewer: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default ImageViewer
}

// Vite 客户端类型（让 import.meta.env 在 .ts 文件中可访问）
/// <reference types="vite/client" />

// Element Plus 全局未注册组件提示（按需）
declare module 'element-plus' {
  // 允许直接 import 具体组件，类型由 element-plus/dist 提供
}