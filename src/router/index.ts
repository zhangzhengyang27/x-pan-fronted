import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import 'nprogress/nprogress.css'
import NProgress from 'nprogress'
import { getToken, clearToken } from '@/utils/cookie'
import userService from '@/api/user'
import { useUserStore } from '@/stores/user'
import { useFileStore } from '@/stores/file'
import { ElMessage } from '@/composables/useToast'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Index',
    component: () => import('@/layout/index.vue'),
    children: [
      {
        path: '',
        redirect: '/files'
      },
      {
        path: '/docs',
        name: 'Docs',
        component: () => import('@/views/list-page/doc/index.vue')
      },
      {
        path: '/files',
        name: 'Files',
        component: () => import('@/views/list-page/file/index.vue')
      },
      {
        path: '/imgs',
        name: 'Imgs',
        component: () => import('@/views/list-page/img/index.vue')
      },
      {
        path: '/musics',
        name: 'Musics',
        component: () => import('@/views/list-page/music/index.vue')
      },
      {
        path: '/recycles',
        name: 'Recycles',
        component: () => import('@/views/list-page/recycle/index.vue')
      },
      {
        path: '/favorites',
        name: 'Favorites',
        component: () => import('@/views/list-page/favorite/index.vue')
      },
      {
        path: '/dedup',
        name: 'Dedup',
        component: () => import('@/views/list-page/dedup/index.vue')
      },
      {
        path: '/shares',
        name: 'Shares',
        component: () => import('@/views/list-page/share/index.vue')
      },
      {
        path: '/videos',
        name: 'Videos',
        component: () => import('@/views/list-page/video/index.vue')
      },
      {
        path: '/offline',
        name: 'Offline',
        component: () => import('@/views/list-page/offline/index.vue')
      },
      {
        path: '/vault',
        name: 'Vault',
        component: () => import('@/views/list-page/vault/index.vue')
      },
      {
        path: '/stats',
        name: 'Stats',
        component: () => import('@/views/list-page/stats/index.vue')
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue')
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/register/index.vue')
  },
  {
    path: '/forget',
    name: 'Forget',
    component: () => import('@/views/forget/index.vue')
  },
  {
    path: '/share/:shareId',
    name: 'Share',
    component: () => import('@/views/share/index.vue')
  },
  {
    path: '/preview/code/:fileId',
    name: 'PreviewCode',
    component: () => import('@/views/preview/code/index.vue')
  },
  {
    path: '/preview/office/:fileId',
    name: 'PreviewOffice',
    component: () => import('@/views/preview/office/index.vue')
  },
  {
    path: '/preview/iframe/:fileId',
    name: 'PreviewIframe',
    component: () => import('@/views/preview/iframe/index.vue')
  },
  {
    path: '/preview/image/:parentId/:fileId',
    name: 'PreviewImage',
    component: () => import('@/views/preview/image/index.vue')
  },
  {
    path: '/preview/music/:parentId/:fileId',
    name: 'PreviewMusic',
    component: () => import('@/views/preview/music/index.vue')
  },
  {
    path: '/preview/video/:fileId',
    name: 'PreviewVideo',
    component: () => import('@/views/preview/video/index.vue')
  },
  {
    path: '/500',
    name: 'Error500',
    component: () => import('@/views/error/500/index.vue')
  },
  {
    path: '/404',
    name: 'Error404',
    component: () => import('@/views/error/404/index.vue')
  },
  {
    path: '/agreement',
    name: 'Agreement',
    component: () => import('@/views/protocol/index.vue'),
    props: { type: 'agreement' },
    meta: { type: 'agreement' }
  },
  {
    path: '/privacy',
    name: 'Privacy',
    component: () => import('@/views/protocol/index.vue'),
    props: { type: 'privacy' },
    meta: { type: 'privacy' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/404' }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

const toIndexPageList = ['Login', 'Register', 'Forget']
const whiteList = ['Login', 'Register', 'Forget', 'Share', 'Agreement', 'Privacy', 'Error404', 'Error500']

router.beforeEach((to, from, next) => {
  NProgress.start()
  const hasToken = getToken()
  const userStore = useUserStore()
  const fileStore = useFileStore()
  if (hasToken && toIndexPageList.indexOf(to.name as string) !== -1) {
    next({ name: 'Index' })
    NProgress.done()
    return
  }
  if (!hasToken && whiteList.indexOf(to.name as string) === -1) {
    next({
      name: 'Login',
      query: {
        redirect: to.fullPath
      }
    })
    NProgress.done()
    return
  }
  if (hasToken && !userStore.username) {
    // 给 userService.info 加超时兜底：3 秒内未返回则放行，避免后端挂掉时卡死整个路由
    let called = false
    const finishNext = () => {
      if (called) return
      called = true
      next()
      NProgress.done()
    }
    const timeoutId = window.setTimeout(() => {
      console.warn('[router] userService.info 超时，直接放行')
      finishNext()
    }, 3000)
    userService.info(
      (res) => {
        window.clearTimeout(timeoutId)
        // 清掉上一次登录残留的目录缓存（避免新账号首屏显示旧目录）
        try { localStorage.removeItem('xpan:parentId') } catch {}
        fileStore.setParentId(res.data.rootFileId)
        fileStore.setDefaultParentId(res.data.rootFileId)
        fileStore.setDefaultParentFilename(res.data.rootFilename)
        userStore.setUsername(res.data.username)
        // 初始化存储空间（后端字段为 usedSize/totalSize）
        if (res.data.usedSize !== undefined && res.data.totalSize !== undefined) {
          userStore.setQuota(res.data.usedSize, res.data.totalSize)
        }
        finishNext()
      },
      (res) => {
        window.clearTimeout(timeoutId)
        // 区分「用户取消登录」与「真实错误」：取消时停留在当前页，不强制跳转
        if (res && (res.code === 10 || res.code === 401)) {
          clearToken()
          userStore.clear()
          next({ name: 'Login', query: { redirect: to.fullPath } })
          NProgress.done()
        } else {
          // 其它异常:Toast 提示一次并放行;若 token 实际已失效,
          // 下次进入路由仍会再次 info,避免阻塞用户当前操作
          ElMessage.error(res?.message || '获取用户信息失败')
          finishNext()
        }
      }
    )
    return
  }
  next()
  NProgress.done()
})

router.afterEach(() => {
  NProgress.done()
})

export default router
