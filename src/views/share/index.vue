<script setup lang="ts">
/**
 * ShareView —— 他人分享查看页
 * 设计规范：G 设计风格
 * 使用 simple-header + 提取码样式
 */
import panUtil from '@/utils/common'
import userService from '@/api/user'
import fileService from '@/api/file'
import {
  clearShareToken,
  clearToken,
  getShareToken,
  setShareToken,
  setToken
} from '@/utils/cookie'
import shareService from '@/api/share'
import { onMounted, onUnmounted, reactive, ref, computed } from 'vue'
import { useBreakpoint } from '@/composables/useMediaQuery'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import { useRoute } from 'vue-router'

import BaseButton from '@/components/base/BaseButton.vue'
import BaseField from '@/components/base/BaseField.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseTree from '@/components/base/BaseTree.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseResult from '@/components/base/BaseResult.vue'
import {
  Cloud,
  Copy,
  Download,
  Folder,
  Clock,
  LogIn,
  LogOut,
  Save,
  Eye,
  Hash,
  TrendingUp,
  Lock
} from '@lucide/vue'

const route = useRoute()
const { isMobile } = useBreakpoint()

const loginForm = reactive({ username: '', password: '' })
const shareCodeForm = reactive({ shareCode: '' })

const loading = ref(false)
const username = ref('')
const loginDialogVisible = ref(false)
const loginFlag = ref(false)
const shareCodeDialogVisible = ref(false)
const shareCodeHeader = ref('')
const shareCancelFlag = ref(false)
const tableData = ref([])
const multipleSelection = ref([])
const pageLoading = ref(true)
const shareDate = ref('')
const shareExpireDate = ref('')
const breadCrumbs = ref([{ id: '-1', name: '全部文件' }])
const treeData = ref([])
const treeDialogVisible = ref(false)
const item = ref(undefined)
const treeCheckedNode = ref(null)

const selected = ref([])

// 分享统计
const downloadCount = ref(0)
const downloadLimit = ref(0)
const countdownText = ref('')
let countdownTimer = null

function startCountdown(expireAt) {
  if (!expireAt) {
    countdownText.value = '永久有效'
    if (countdownTimer) clearInterval(countdownTimer)
    return
  }
  if (countdownTimer) clearInterval(countdownTimer)
  const target = new Date(expireAt).getTime()
  const tick = () => {
    const diff = target - Date.now()
    if (diff <= 0) {
      countdownText.value = '已过期'
      shareCancelFlag.value = true
      clearInterval(countdownTimer)
      return
    }
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    countdownText.value = d > 0 ? `${d}天${h}小时` : `${h}小时${m}分`
  }
  tick()
  countdownTimer = setInterval(tick, 60000)
}

const remainingDownloads = computed(() => {
  if (!downloadLimit.value) return null
  return Math.max(0, downloadLimit.value - downloadCount.value)
})

// 列定义
const columns = [
  { key: 'filename', title: '文件名', width: 'auto' },
  { key: 'fileSizeDesc', title: '大小', width: 120, align: 'right' as const },
  { key: 'updateTime', title: '修改日期', width: 200, align: 'center' as const },
  { key: 'actions', title: '操作', width: 180, align: 'right' as const }
]

// 移动端隐藏「修改日期」次要列，避免横向溢出
const displayColumns = computed(() =>
  isMobile.value
    ? columns.filter((c) => !['updateTime'].includes(c.key))
    : columns
)

function refreshShareInfo(data) {
  const u = data.shareUserInfoVO.username
  shareCodeHeader.value = u + '的分享：' + data.shareName
  shareDate.value = data.createTime
  shareExpireDate.value = data.shareDay === 0 ? '永久有效' : data.shareEndTime
  tableData.value = data.xPanUserFileVOList
  downloadCount.value = data.downloadCount || 0
  downloadLimit.value = data.downloadLimit || 0
  startCountdown(data.shareDay === 0 ? null : data.shareEndTime)
}

// 死代码清理记录：分享二维码弹窗（qrDialogVisible）无任何入口置 true、永远不可见，
// 已连同仅为它服务的 shareUrl/qrDataUrl/copyOk/copyShareLink/generateQR/selectAll、
// 模板弹窗与 qrcode 依赖一并删除；downloadFile（多选下载）同样无任何调用点，已删除
const getShareId = () => String(route.params.shareId || '')
const openShareExpirePage = () => (shareCancelFlag.value = true)

function goRegister() {
  window.location.href = '/register'
}

function goHome() {
  window.location.href = '/'
}

function openShareCodePage() {
  shareService.getSimpleShareDetail({ shareId: getShareId() }, (res) => {
    if (res.code === 0) {
      shareCodeDialogVisible.value = true
      shareCodeHeader.value = res.data.shareUserInfoVO.username + '的分享：' + res.data.shareName
    } else {
      shareCodeDialogVisible.value = false
      openShareExpirePage()
    }
  })
}

function loadShareInfo() {
  shareService.getShareDetail((res) => {
    if (res.code === 0) refreshShareInfo(res.data)
    else if (res.code === 4) openShareCodePage()
    else openShareExpirePage()
  })
}

function loadUserInfo() {
  userService.infoWithoutPageJump((res) => {
    if (res.code === 0) {
      username.value = res.data.username
      loginFlag.value = true
    } else {
      username.value = ''
      loginFlag.value = false
    }
  })
}

function login() {
  loginDialogVisible.value = true
}

async function exit() {
  // ElMessageBox.confirm 恒 resolve(true/false)、永不 reject（见 useToast），
  // 取消时 ok=false 直接返回；不能用 try/catch 等 reject（永远不会触发，导致取消也退出）
  const ok = await ElMessageBox.confirm('确定要退出登录吗？', '退出登录', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
  if (!ok) return
  userService.exit(
    () => {
      clearToken()
      loginFlag.value = false
      username.value = ''
    },
    (res) => ElMessage.error(res.message)
  )
}

function doLogin() {
  if (!panUtil.checkUsername(loginForm.username))
    return ElMessage.error('请输入6-16位只包含数字和字母的用户名')
  if (!panUtil.checkPassword(loginForm.password)) return ElMessage.error('请输入8-16位的密码')
  loading.value = true
  userService.login(
    { username: loginForm.username, password: loginForm.password },
    (res) => {
      loading.value = false
      setToken(res.data as unknown as string)
      loginDialogVisible.value = false
      loadUserInfo()
    },
    (res) => {
      loading.value = false
      ElMessage.error(res.message)
    }
  )
}

function doCheckShareCode() {
  if (!shareCodeForm.shareCode) return ElMessage.error('请输入提取码')
  loading.value = true
  shareService.checkShareCode(
    { shareId: getShareId(), shareCode: shareCodeForm.shareCode },
    (res) => {
      if (res.code === 0) {
        loading.value = false
        setShareToken(res.data as string)
        shareCodeDialogVisible.value = false
        loadShareInfo()
      } else {
        loading.value = false
        ElMessage.error('提取码错误')
      }
    }
  )
}

function handleSelectionChange(keys) {
  // keys 由 BaseTable 按 rowKey=fileId 生成；fileId 对分享文件必存在，
  // 用 index 兜底反而与 keys 不匹配，直接按 fileId 过滤即可。
  const rows = tableData.value.filter((r) => keys.includes(r.fileId))
  multipleSelection.value = rows
}

function clickFilename(row) {
  if (row.folderFlag === 1) goInFolder(row)
}

function goInFolder(row) {
  breadCrumbs.value.push({ id: row.fileId, name: row.filename })
  reloadTableData(row.fileId)
}

function reloadTableData(parentId) {
  shareService.getShareFiles({ parentId }, (res) => {
    if (res.code === 0) tableData.value = res.data
    else window.location.reload()
  })
}

function goToThis(id) {
  if (id === '-1') {
    breadCrumbs.value = [{ id: '-1', name: '全部文件' }]
    loadShareInfo()
  } else {
    const next = []
    for (const it of breadCrumbs.value) {
      next.push(it)
      if (it.id === id) break
    }
    breadCrumbs.value = next
    reloadTableData(id)
  }
}

function doDownLoads(items, i = 0) {
  if (items.length === i) return
  setTimeout(() => {
    doDownload(items[i])
    doDownLoads(items, i + 1)
  }, 500)
}

function doDownload(item) {
  if (!item || !item.fileId) return ElMessage.warning('文件信息缺失，无法下载')
  if (item.folderFlag === 1) return ElMessage.error('文件夹暂不支持下载')
  userService.infoWithoutPageJump((res) => {
    if (res.code === 0) {
      shareService.getSimpleShareDetail({ shareId: getShareId() }, (res) => {
        if (res.code === 0) {
          const fileId = String(item.fileId).replace(/\+/g, '%2B')
          // 登录 token 不再拼进 URL（authorization 参数已移除）：原生 <a> 跳转同源
          // 自动携带 Cookie，后端从 Cookie 读取登录态（与 panUtil.getPreviewUrl 同一
          // 模式），避免 token 泄露到日志/Referer。shareToken 需保留在 URL 上，
          // 后端靠它识别分享上下文（提取码校验通过后下发的分享凭证）。
          const url = `${panUtil.getUrlPrefix()}/share/file/download?fileId=${fileId}&shareToken=${getShareToken()}`
          const link = document.createElement('a')
          link.style.display = 'none'
          link.href = url
          link.setAttribute('download', item.filename)
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        } else window.location.reload()
      })
    } else {
      loadUserInfo()
      login()
    }
  })
}

function doChoseTreeNodeCallBack() {
  if (!treeCheckedNode.value) return ElMessage.error('请选择文件夹')
  loading.value = true
  doSaveFiles(treeCheckedNode.value.id)
}

function saveFiles(newItem) {
  if (newItem) item.value = newItem
  else if (!multipleSelection.value.length) return ElMessage.error('请选择要保存的文件')
  userService.infoWithoutPageJump((res) => {
    if (res.code === 0) {
      // 登录态：先拉取文件夹树填充 treeData 再打开弹窗。此前 treeData 从未赋值，
      // 弹窗永远显示「暂无文件夹数据」、无法选择保存位置
      fileService.getFolderTree(
        (tree) => {
          treeData.value = tree.data || []
          treeDialogVisible.value = true
        },
        () => {
          ElMessage.error('文件夹树加载失败，请稍后重试')
        }
      )
    } else login()
  })
}

function doSaveFiles(targetParentId) {
  let fileIds: string[] = []
  if (item.value) fileIds = [item.value.fileId]
  else fileIds = multipleSelection.value.map((it) => it.fileId)
  shareService.saveShareFiles({ fileIds, targetParentId }, (res) => {
    if (res.code === 0) {
      ElMessage.success('保存成功')
      treeDialogVisible.value = false
    } else if (res.code === 10) {
      treeDialogVisible.value = false
      loadUserInfo()
      login()
    } else ElMessage.error(res.message)
    loading.value = false
  })
}

onMounted(() => {
  clearShareToken()
  loadShareInfo()
  loadUserInfo()
  pageLoading.value = false
})

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-(--color-bg)">
    <!-- Simple Header -->
    <header
      class="sticky top-0 z-40 h-16 border-b flex items-center justify-between bg-(--color-surface) border-(--color-border)"
      :class="isMobile ? 'px-4 pt-(--safe-top)' : 'px-6'"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-9 rounded-sm flex items-center justify-center shadow-sm"
          style="background: linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-700) 100%);"
        >
          <Cloud :size="18" class="text-white" :stroke-width="2" />
        </div>
        <span class="text-lg font-semibold tracking-tight text-(--color-text)">X Pan</span>
      </div>
      <div v-if="loginFlag" class="flex items-center gap-3 text-sm">
        <span class="text-(--color-text-muted)">欢迎您，{{ username }}</span>
        <BaseButton variant="ghost" size="sm" @click="exit">
          <span class="inline-flex items-center gap-1.5">
            <LogOut :size="14" :stroke-width="2" />
            退出
          </span>
        </BaseButton>
      </div>
      <div v-else class="flex items-center gap-2">
        <BaseButton variant="ghost" size="sm" @click="login">
          <span class="inline-flex items-center gap-1.5">
            <LogIn :size="14" :stroke-width="2" />
            登录
          </span>
        </BaseButton>
        <BaseButton variant="primary" size="sm" @click="goRegister">
          注册
        </BaseButton>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 px-6 py-8 mx-auto w-full max-w-2xl">
      <!-- 过期/失效状态 -->
      <div v-if="shareCancelFlag" class="py-20">
        <BaseResult
          status="error"
          title="分享不存在或已取消"
          description="该分享链接已过期或已被分享者取消"
        >
          <template #extra>
            <BaseButton variant="primary" @click="goHome">
              <span class="inline-flex items-center gap-2">
                <Cloud :size="16" :stroke-width="2" />
                返回首页
              </span>
            </BaseButton>
          </template>
        </BaseResult>
      </div>

      <!-- 分享内容 -->
      <div v-else class="flex flex-col gap-6">
        <!-- 分享信息卡 -->
        <div class="rounded-sm border border-(--color-border) p-6 bg-(--color-surface)">
          <div class="flex items-start gap-4 mb-4">
            <div class="size-16 rounded-sm flex items-center justify-center shrink-0" style="background-color: rgba(0, 112, 243, 0.1);">
              <Folder :size="32" :stroke-width="1.5" style="color: var(--color-primary-500);" />
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-xl font-semibold text-(--color-text)">{{ shareCodeHeader }}</h2>
              <div class="flex items-center gap-4 mt-2 text-xs" style="color: var(--color-text-muted);">
                <span class="inline-flex items-center gap-1">
                  <Clock :size="12" :stroke-width="2" />
                  {{ shareDate }}
                </span>
                <span
                  :style="shareExpireDate === '永久有效' ? 'color: var(--color-success);' : 'color: var(--color-warning);'"
                  class="inline-flex items-center gap-1"
                >
                  <Lock :size="12" :stroke-width="2" />
                  {{ shareExpireDate }}
                </span>
              </div>
            </div>
          </div>

          <!-- 分享统计 -->
          <div class="flex items-center gap-2 flex-wrap mb-4">
            <BaseBadge variant="primary" size="sm">
              <span class="inline-flex items-center gap-1">
                <Eye :size="11" :stroke-width="2" />
                浏览 {{ downloadCount }} 次
              </span>
            </BaseBadge>
            <BaseBadge v-if="downloadLimit > 0" variant="warning" size="sm">
              <span class="inline-flex items-center gap-1">
                <TrendingUp :size="11" :stroke-width="2" />
                剩余 {{ remainingDownloads }} / {{ downloadLimit }} 次
              </span>
            </BaseBadge>
            <BaseBadge v-else variant="neutral" size="sm">
              <span class="inline-flex items-center gap-1">
                <Hash :size="11" :stroke-width="2" />
                下载不限次
              </span>
            </BaseBadge>
          </div>

          <!-- 操作按钮 -->
          <div class="flex items-center gap-2">
            <BaseButton variant="primary" size="lg" block @click="saveFiles(undefined)">
              <span class="inline-flex items-center gap-2">
                <Save :size="16" :stroke-width="2" />
                保存到我的 X 盘
              </span>
            </BaseButton>
          </div>
        </div>

        <!-- 文件列表 -->
        <div class="rounded-sm border border-(--color-border) overflow-hidden bg-(--color-surface)">
          <!-- 面包屑 -->
          <div class="px-4 py-3 flex items-center gap-1.5 text-sm border-b border-(--color-border)">
            <button
              v-for="(bc, i) in breadCrumbs"
              :key="i"
              type="button"
              class="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors"
              :style="[
                i === breadCrumbs.length - 1
                  ? 'color: var(--color-text); font-weight: 500; cursor: default;'
                  : 'color: var(--color-primary-500); cursor: pointer;'
              ]"
              :disabled="i === breadCrumbs.length - 1"
              @click="goToThis(bc.id)"
            >
              {{ bc.name }}
            </button>
          </div>

          <!-- 表格 -->
          <div class="p-4">
            <BaseTable
              :columns="displayColumns"
              :data="tableData"
              :selected="selected"
              selectable
              row-key="fileId"
              empty-text="该文件夹为空"
              @update:selected="(v) => { selected = v; handleSelectionChange(v) }"
            >
              <template #cell-filename="{ row }">
                <button
                  type="button"
                  class="flex items-center gap-3 text-left w-full"
                  :style="row.folderFlag === 1 ? 'cursor: pointer;' : 'cursor: default;'"
                  @click="clickFilename(row)"
                >
                  <component
                    :is="row.folderFlag === 1 ? Folder : Save"
                    :size="20"
                    :stroke-width="2"
                    class="shrink-0"
                    style="color: var(--color-primary-500);"
                  />
                  <span class="truncate text-(--color-text)">{{ row.filename }}</span>
                </button>
              </template>
              <template #cell-actions="{ row }">
                <div
                  class="flex items-center gap-1 justify-end transition-opacity"
                  :class="isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                >
                  <BaseButton variant="primary" size="sm" @click="saveFiles(row)" title="保存到我的R盘">
                    <Copy :size="14" :stroke-width="2" />
                  </BaseButton>
                  <BaseButton variant="secondary" size="sm" @click="doDownload(row)" title="下载">
                    <Download :size="14" :stroke-width="2" />
                  </BaseButton>
                </div>
              </template>
            </BaseTable>
          </div>
        </div>
      </div>
    </main>

    <!-- 登录弹窗 -->
    <BaseModal v-model:open="loginDialogVisible" title="欢迎登录" size="md">
      <div class="flex flex-col gap-4">
        <BaseField label="用户名">
          <BaseInput
            v-model="loginForm.username"
            placeholder="6-16 位字母数字"
            :prefix="LogIn"
            @enter="doLogin"
          />
        </BaseField>
        <BaseField label="密码">
          <BaseInput
            v-model="loginForm.password"
            type="password"
            show-password
            placeholder="8-16 位"
            @enter="doLogin"
          />
        </BaseField>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="loginDialogVisible = false">取消</BaseButton>
        <BaseButton variant="primary" :loading="loading" @click="doLogin">确定</BaseButton>
      </template>
    </BaseModal>

    <!-- 提取码弹窗 -->
    <BaseModal v-model:open="shareCodeDialogVisible" size="md" :hide-close="true">
      <div class="text-center py-2">
        <div
          class="size-14 mx-auto rounded-sm flex items-center justify-center mb-4"
          style="background-color: rgba(0, 112, 243, 0.1);"
        >
          <Lock :size="28" :stroke-width="2" style="color: var(--color-primary-500);" />
        </div>
        <h3 class="text-lg font-semibold m-0 mb-1 text-(--color-text)">{{ shareCodeHeader }}</h3>
        <p class="text-sm mb-6" style="color: var(--color-text-muted);">请输入提取码以查看分享</p>
        <BaseField label="提取码">
          <BaseInput
            v-model="shareCodeForm.shareCode"
            placeholder="请输入4位提取码"
            maxlength="4"
            class="text-center font-mono tracking-[0.5em]"
            @enter="doCheckShareCode"
          />
        </BaseField>
      </div>
      <template #footer>
        <BaseButton variant="primary" :loading="loading" block @click="doCheckShareCode">
          提取
        </BaseButton>
      </template>
    </BaseModal>

    <!-- 文件夹选择 -->
    <BaseModal v-model:open="treeDialogVisible" title="保存到我的 X 盘" size="md">
      <div class="max-h-96 overflow-y-auto">
        <BaseTree
          v-if="treeData.length > 0"
          :data="treeData"
          @select="(n) => (treeCheckedNode = n)"
        />
        <p v-else class="text-center py-8" style="color: var(--color-text-muted);">暂无文件夹数据</p>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="treeDialogVisible = false">取消</BaseButton>
        <BaseButton variant="primary" :loading="loading" @click="doChoseTreeNodeCallBack">
          确定
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
