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
  clearSession,
  getShareToken,
  setShareToken
} from '@/utils/cookie'
import shareService from '@/api/share'
import type { IFileVO, IFolderTreeNode, IShareVO } from '@/types'
import {
  E2EE_MEMORY_LIMIT_BYTES,
  decryptE2eeBlob,
  decryptE2eeToWritable,
  parseE2eeFragment,
  pickE2eeSaveHandle,
  triggerBlobDownload
} from '@/utils/e2ee-share'
import { onMounted, onUnmounted, reactive, ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import { useRoute } from 'vue-router'

import BaseButton from '@/components/base/BaseButton.vue'
import BaseField from '@/components/base/BaseField.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseTree, { type TreeNodeData } from '@/components/base/BaseTree.vue'
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
  Lock,
  ShieldCheck
} from '@lucide/vue'

const route = useRoute()

const loginForm = reactive({ username: '', password: '' })
const shareCodeForm = reactive({ shareCode: '' })

const loading = ref(false)
const username = ref('')
const loginDialogVisible = ref(false)
const loginFlag = ref(false)
const shareCodeDialogVisible = ref(false)
const shareCodeHeader = ref('')
const shareCancelFlag = ref(false)
const tableData = ref<IFileVO[]>([])
const multipleSelection = ref<IFileVO[]>([])
const pageLoading = ref(true)
const shareDate = ref('')
const shareExpireDate = ref('')
const breadCrumbs = ref<Array<{ id: string; name: string }>>([{ id: '-1', name: '全部文件' }])
const treeData = ref<IFolderTreeNode[]>([])
const treeDialogVisible = ref(false)
const item = ref<Partial<IFileVO> | undefined>(undefined)
const treeCheckedNode = ref<TreeNodeData | null>(null)

const selected = ref<(string | number)[]>([])

// 分享目录分页：进入文件夹后按 100 条/页加载，支持“加载更多”
const sharePageNum = ref(1)
const shareCurrentParentId = ref('')
const shareHasMore = ref(false)
const sharePageLoading = ref(false)

// 分享统计
const downloadCount = ref(0)
const downloadLimit = ref(0)
// P3-5 举报：必须登录后提交；理由长度与后端 PO 保持一致（500）
const reportDialogVisible = ref(false)
const reportReason = ref('')
const reportLoading = ref(false)
// P0-4 禁止转载（1=禁止转存，隐藏"保存到我的 X 盘"入口）
const forbidReshare = ref(0)
// P3-5 文件收集：分享创建者开启后，访问者可上传到被分享文件夹
const collectEnabled = ref(0)
// E2EE（1=加密分享）：下载必须走浏览器解密，页面不提供“保存到我的网盘”
const e2ee = ref(0)
const decrypting = ref(false)
const collectInput = ref<HTMLInputElement | null>(null)
const collecting = ref(false)
const countdownText = ref('')
let countdownTimer: ReturnType<typeof setInterval> | null = null

function startCountdown(expireAt: string | null) {
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
      if (countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
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

function refreshShareInfo(data: IShareVO) {
  const u = data.shareUserInfoVO?.username || '分享者'
  shareCodeHeader.value = u + '的分享：' + data.shareName
  shareDate.value = data.createTime
  shareExpireDate.value = data.shareDay === 0 ? '永久有效' : (data.shareEndTime || '')
  // 后端 getXPanUserFileVOList 的 Jackson 序列化名是 xpanUserFileVOList（首字母小写），
  // 前端历史字段是 xPanUserFileVOList；两者都兼容，避免单文件分享页显示为空列表。
  tableData.value = data.xPanUserFileVOList || data.xpanUserFileVOList || []
  shareHasMore.value = false
  sharePageNum.value = 1
  shareCurrentParentId.value = ''
  selected.value = []
  downloadCount.value = data.downloadCount || 0
  downloadLimit.value = data.downloadLimit || 0
  forbidReshare.value = data.forbidReshare || 0
  collectEnabled.value = data.collectEnabled || 0
  e2ee.value = data.e2ee || 0
  startCountdown(data.shareDay === 0 ? null : (data.shareEndTime ?? null))
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
      shareCodeHeader.value = (res.data.shareUserInfoVO?.username || '分享者') + '的分享：' + (res.data.shareName || '')
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
      clearSession()
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
    () => {
      loading.value = false
      // 登录成功：后端已写入 HttpOnly Cookie
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

function handleSelectionChange(keys: (string | number)[]) {
  // keys 由 BaseTable 按 rowKey=fileId 生成；fileId 对分享文件必存在，
  // 用 index 兜底反而与 keys 不匹配，直接按 fileId 过滤即可。
  const rows = tableData.value.filter((r) => keys.includes(r.fileId))
  multipleSelection.value = rows
}

function clickFilename(row: Partial<IFileVO>) {
  if (row.folderFlag === 1) goInFolder(row)
}

function goInFolder(row: Partial<IFileVO>) {
  if (!row.fileId) return
  breadCrumbs.value.push({ id: row.fileId, name: row.filename || '' })
  reloadTableData(row.fileId)
}

function reloadTableData(parentId: string, pageNum = 1, append = false) {
  sharePageLoading.value = true
  shareService.getShareFiles(
    { parentId, pageNum, pageSize: 100 },
    (res) => {
      sharePageLoading.value = false
      if (res.code === 0) {
        const page = res.data
        tableData.value = append
          ? [...tableData.value, ...(page.records || [])]
          : page.records || []
        shareHasMore.value = !!page.hasMore
        sharePageNum.value = page.pageNum || pageNum
        shareCurrentParentId.value = parentId
        if (!append) selected.value = []
      } else {
        window.location.reload()
      }
    }
  )
}

function loadMoreShareFiles() {
  if (!shareHasMore.value || sharePageLoading.value) return
  reloadTableData(shareCurrentParentId.value, sharePageNum.value + 1, true)
}

function goToThis(id: string) {
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

function doDownLoads(items: IFileVO[], i = 0) {
  if (items.length === i) return
  setTimeout(() => {
    doDownload(items[i])
    doDownLoads(items, i + 1)
  }, 500)
}

async function downloadE2ee(item: Partial<IFileVO>) {
  const fragment = parseE2eeFragment(window.location.hash)
  if (!fragment) {
    return ElMessage.error('链接缺少解密密钥，请向分享者索取完整链接（# 后部分不能丢）')
  }
  decrypting.value = true
  let saveHandle: Awaited<ReturnType<typeof pickE2eeSaveHandle>> = null
  try {
    const fileId = String(item.fileId || '').replace(/\+/g, '%2B')
    const url = `${panUtil.getUrlPrefix()}/share/file/download?fileId=${fileId}&shareToken=${getShareToken() ?? ''}`
    // 超过内存阈值时必须先让用户选目标文件，再用 File System Access API 流式写入。
    // showSaveFilePicker 依赖用户激活；等 fetch 完成后再弹可能已被浏览器判定为失效。
    const cipherSize = Number(item.fileSize || 0)
    if (cipherSize > E2EE_MEMORY_LIMIT_BYTES) {
      saveHandle = await pickE2eeSaveHandle(
        String(item.filename || 'download').replace(/\.xpan$/i, '')
      )
      if (!saveHandle) {
        throw new Error('当前浏览器不支持大文件流式保存，请使用 Chrome/Edge')
      }
    }

    // 不能用 <a download>：这里必须拿到密文字节流，用 WebCrypto 解密后再触发保存。
    // 匿名分享下载只认 URL 上的 shareToken，不需要登录 Cookie；用 omit 可避免
    // 后端下载响应重置 CORS 头后与 credentials 模式冲突（生产同源时同样成立）。
    const response = await fetch(url, { credentials: 'omit' })
    if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）`)
    // 后端业务错误通常是 HTTP 200 + JSON（如分享过期/次数用尽），先识别再当密文解密
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = (await response.json()) as { message?: string }
      throw new Error(body.message || '下载失败')
    }
    if (saveHandle) {
      if (!response.body) throw new Error('浏览器未提供流式响应体')
      await decryptE2eeToWritable(response.body, fragment.key, fragment.iv, saveHandle)
      await saveHandle.close()
    } else {
      const cipher = await response.blob()
      const plain = await decryptE2eeBlob(cipher, fragment.key, fragment.iv)
      triggerBlobDownload(plain.blob, plain.name)
    }
    ElMessage.success('解密完成，已开始下载')
  } catch (e) {
    if (saveHandle) await saveHandle.abort().catch(() => undefined)
    ElMessage.error(e instanceof Error ? e.message : '解密下载失败')
  } finally {
    decrypting.value = false
  }
}

function doDownload(item: Partial<IFileVO>) {
  if (!item || !item.fileId) return ElMessage.warning('文件信息缺失，无法下载')
  if (item.folderFlag === 1) return ElMessage.error('文件夹暂不支持下载')
  if (e2ee.value === 1) return void downloadE2ee(item)
  userService.infoWithoutPageJump((res) => {
    if (res.code === 0) {
      shareService.getSimpleShareDetail({ shareId: getShareId() }, (res) => {
        if (res.code === 0) {
          const fileId = String(item.fileId).replace(/\+/g, '%2B')
          // 登录 token 不再拼进 URL（authorization 参数已移除）：原生 <a> 跳转同源
          // 自动携带 Cookie，后端从 Cookie 读取登录态（与 panUtil.getPreviewUrl 同一
          // 模式），避免 token 泄露到日志/Referer。shareToken 需保留在 URL 上，
          // 后端靠它识别分享上下文（提取码校验通过后下发的分享凭证）。
          const url = `${panUtil.getUrlPrefix()}/share/file/download?fileId=${fileId}&shareToken=${getShareToken() ?? ''}`
          const link = document.createElement('a')
          link.style.display = 'none'
          link.href = url
          link.setAttribute('download', item.filename || 'download')
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

function openReport() {
  if (!loginFlag.value) {
    ElMessage.warning('请先登录后再举报')
    login()
    return
  }
  reportReason.value = ''
  reportDialogVisible.value = true
}

function chooseCollectFile() {
  if (collecting.value) return
  collectInput.value?.click()
}

function onCollectFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 2 * 1024 * 1024 * 1024) {
    return ElMessage.warning('文件收集单文件不能超过 2GB')
  }
  collecting.value = true
  shareService.collectShare(
    file,
    () => {
      collecting.value = false
      ElMessage.success('文件已上传到收集箱')
      loadShareInfo()
    },
    () => {
      collecting.value = false
    }
  )
}

function doReport() {
  const reason = reportReason.value.trim()
  if (!reason) return ElMessage.warning('请填写举报理由')
  if (reason.length > 500) return ElMessage.warning('举报理由不能超过500字')
  reportLoading.value = true
  shareService.reportShare(
    { shareId: getShareId(), reason },
    () => {
      reportLoading.value = false
      reportDialogVisible.value = false
      ElMessage.success('举报已提交，管理员会尽快处理')
    },
    () => {
      reportLoading.value = false
    }
  )
}

function doChoseTreeNodeCallBack() {
  if (!treeCheckedNode.value) return ElMessage.error('请选择文件夹')
  const targetId = treeCheckedNode.value.id
  if (targetId === undefined || targetId === null) return ElMessage.error('请选择文件夹')
  loading.value = true
  doSaveFiles(String(targetId))
}

function saveFiles(newItem?: Partial<IFileVO>) {
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

function doSaveFiles(targetParentId: string) {
  let fileIds: string[] = []
  if (item.value?.fileId) fileIds = [item.value.fileId]
  else fileIds = multipleSelection.value.map((it) => it.fileId)
  if (fileIds.length === 0) return ElMessage.error('请选择要保存的文件')
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
      class="sticky top-0 z-40 h-16 border-b flex items-center justify-between bg-(--color-surface) border-(--color-border) px-6"
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
            <BaseBadge v-if="e2ee === 1" variant="success" size="sm">
              <span class="inline-flex items-center gap-1">
                <ShieldCheck :size="11" :stroke-width="2" />
                端到端加密
              </span>
            </BaseBadge>
          </div>

          <!-- 操作按钮 -->
          <div class="flex items-center gap-2">
            <BaseBadge v-if="e2ee === 1" variant="success" size="sm">
              <span class="inline-flex items-center gap-1">加密分享不支持转存，请在浏览器中解密下载</span>
            </BaseBadge>
            <BaseBadge v-else-if="forbidReshare === 1" variant="neutral" size="sm">
              <span class="inline-flex items-center gap-1">该分享禁止转载，仅支持下载</span>
            </BaseBadge>
            <BaseButton
              v-else
              variant="primary"
              size="lg"
              block
              @click="saveFiles(undefined)"
            >
              <span class="inline-flex items-center gap-2">
                <Save :size="16" :stroke-width="2" />
                保存到我的 X 盘
              </span>
            </BaseButton>
          </div>

          <div v-if="collectEnabled === 1" class="mt-3 flex items-center justify-between gap-3 rounded-md border border-(--color-border) px-3 py-2">
            <div class="min-w-0">
              <p class="text-xs font-medium text-(--color-text)">文件收集箱</p>
              <p class="text-[11px]" style="color: var(--color-text-muted);">分享者已开启收集，上传的文件会进入该分享文件夹</p>
            </div>
            <BaseButton size="sm" variant="secondary" :loading="collecting" @click="chooseCollectFile">
              上传文件
            </BaseButton>
            <input ref="collectInput" type="file" class="hidden" @change="onCollectFile" />
          </div>

          <div class="mt-3 flex justify-end">
            <button
              type="button"
              class="text-[11px] inline-flex items-center gap-1 transition-colors"
              style="color: var(--color-text-muted);"
              @click="openReport"
            >
              <Flag :size="11" :stroke-width="2" />
              举报该分享
            </button>
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
              :columns="columns"
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
                  class="flex items-center gap-1 justify-end transition-opacity opacity-0 group-hover:opacity-100"
                >
                  <BaseButton
                    v-if="forbidReshare !== 1 && e2ee !== 1"
                    variant="primary"
                    size="sm"
                    @click="saveFiles(row)"
                    title="保存到我的R盘"
                  >
                    <Copy :size="14" :stroke-width="2" />
                  </BaseButton>
                  <BaseButton
                    variant="secondary"
                    size="sm"
                    :loading="decrypting"
                    @click="doDownload(row)"
                    title="下载"
                  >
                    <Download :size="14" :stroke-width="2" />
                  </BaseButton>
                </div>
              </template>
            </BaseTable>
            <div v-if="shareHasMore" class="mt-4 flex justify-center">
              <BaseButton
                variant="secondary"
                size="sm"
                :loading="sharePageLoading"
                @click="loadMoreShareFiles"
              >
                加载更多
              </BaseButton>
            </div>
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

    <!-- P3-5 分享举报 -->
    <BaseModal v-model:open="reportDialogVisible" title="举报该分享" size="md">
      <BaseField label="举报理由">
        <textarea
          v-model="reportReason"
          rows="4"
          maxlength="500"
          placeholder="请描述违规内容，例如侵权、违法信息、恶意链接等"
          class="w-full rounded-md border border-(--color-border) bg-(--color-surface) p-2.5 text-sm text-(--color-text) resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        />
      </BaseField>
      <p class="text-[11px] mt-2" style="color: var(--color-text-muted);">
        举报仅限登录用户；同一分享重复提交会提示等待处理，请勿滥用。
      </p>
      <template #footer>
        <BaseButton variant="secondary" @click="reportDialogVisible = false">取消</BaseButton>
        <BaseButton variant="primary" :loading="reportLoading" @click="doReport">提交举报</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
