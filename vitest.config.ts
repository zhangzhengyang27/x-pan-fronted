import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/utils/**/*.ts', 'src/stores/**/*.ts', 'src/composables/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/types/**'],
      // 基线：statements/lines 27.5%、branches 71%、functions 43%。阈值留缓冲，
      // 低于阈值说明新增逻辑没有配套单测，CI 直接失败而不是只上传报告。
      thresholds: {
        statements: 25,
        branches: 50,
        functions: 35,
        lines: 25
      }
    }
  }
})
