import {fileURLToPath, URL} from 'node:url'

import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 与项目历史运行端口一致；如被占用可改
    port: 5179,
    host: true,
    open: true,
    proxy: {
      // 仅当 VITE_API_BASE_URL=/api 时走此代理（与 nginx.conf 反代规则对齐：去 /api 前缀）
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      // WebSocket：useWebSocket 在 VITE_WS_URL 缺省时会按 host+port 拼 /ws/notification
      '/ws': {
        target: 'ws://localhost:8081',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    // pdf/office/shiki 预览器体积由第三方库本身决定且均为按需懒加载（不进首屏），
    // 已通过 manualChunks 独立成块以便浏览器缓存，此处放宽告警阈值避免无意义噪音。
    chunkSizeWarningLimit: 12000,
    rollupOptions: {
      output: {
        // 将体积大且可独立缓存的第三方库拆分为 vendor chunk，
        // 避免被并入业务/预览器 chunk，提升浏览器缓存命中率。
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // 预览器重型依赖：各自独立成块
          if (id.includes('@vue-office')) return 'vendor-vue-office'
          if (id.includes('pdfjs-dist')) return 'vendor-pdfjs'
          if (id.includes('mammoth') || id.includes('docx-preview')) return 'vendor-docx'
          if (id.includes('xlsx') || id.includes('exceljs')) return 'vendor-excel'
          if (id.includes('pptxgenjs') || id.includes('jszip')) return 'vendor-pptx'
          // 代码高亮 / 编辑器内核
          if (id.includes('@codemirror') || id.includes('@lezer')) return 'vendor-codemirror'
          if (id.includes('shiki')) return 'vendor-shiki'
          if (id.includes('monaco-editor')) return 'vendor-monaco'
          // 通用 UI / 工具大库
          if (id.includes('@lucide')) return 'vendor-lucide'
        },
      },
    },
  },
})
