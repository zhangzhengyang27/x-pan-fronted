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
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      // WebSocket：useWebSocket 在 VITE_WS_URL 缺省时会按 host+port 拼 /ws/notification
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
})
