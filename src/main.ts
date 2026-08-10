import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './styles/tokens.css'
import { initTheme } from '@/composables/useTheme'
import { useWebSocket } from '@/composables/useWebSocket'
import { useUserStore } from '@/stores/user'
import { getToken } from '@/utils/cookie'

const app = createApp(App)
app.config.errorHandler = (err, instance, info) => {
  console.error('[APP-ERROR]', info, err)
}
app.use(createPinia())
app.use(router)

// 初始化主题（在挂载前同步读取 localStorage，避免 FOUC）
initTheme()

// P4：启动 WebSocket 通知连接（登录后自动重连）
const ws = useWebSocket()
const userStore = useUserStore()

// 监听路由：登录页 → 自动连接；登出 → 断开
router.afterEach((to) => {
  const token = getToken()
  if (token && !ws.isConnected.value && to.path !== '/login') {
    console.log('[WS] 检测到登录态，建立连接')
    ws.connect(token)
  } else if (!token && ws.isConnected.value) {
    console.log('[WS] 检测到登出，断开连接')
    ws.disconnect()
  }
})

// 暴露调试接口
if (import.meta.env.DEV) {
  ;(window as unknown as { __ws?: unknown }).__ws = ws
}

// 全局通知监听 → 顶部 toast
ws.on('SYSTEM_NOTICE', (payload: { level?: string; message?: string }) => {
  const lvl = (payload?.level || 'info') as 'success' | 'error' | 'warning' | 'info'
  const msg = payload?.message || ''
  // 延迟加载避免循环
  import('@/composables/useToast').then(({ ElMessage }) => {
    ElMessage[lvl](msg)
  })
})

app.mount('#app')

// 防止 userStore 未使用警告（保留以备扩展）
void userStore
