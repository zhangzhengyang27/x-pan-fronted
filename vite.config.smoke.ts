import {fileURLToPath, URL} from 'node:url'
import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// 冒烟专用：仓库 vite.config.ts 的复制，仅改端口与后端代理目标（指向本机冒烟后端 18082）
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {'@': fileURLToPath(new URL('./src', import.meta.url))},
  },
  server: {
    port: 5180,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:18082',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'ws://localhost:18082',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
