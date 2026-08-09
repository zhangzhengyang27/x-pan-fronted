import {createApp} from 'vue'
import {createPinia} from 'pinia'

import App from './App.vue'
import router from './router'
import './styles/tokens.css'
import {initTheme} from '@/composables/useTheme.js'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// 初始化主题（在挂载前同步读取 localStorage，避免 FOUC）
initTheme()

app.mount('#app')
