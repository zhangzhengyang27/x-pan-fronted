<script setup lang="ts">
/**
 * ShareButton —— 分享文件（两步式对话框）
 * Step 1: 配置分享名 + 有效期 + 提取码 + 下载次数限制
 * Step 2: 显示分享链接 + 提取码 + 一键复制 + 二维码
 *
 * P1.11 增强：
 * - 自定义提取码（4-8位字母数字）
 * - 下载次数限制
 * - 第二步显示 QR 码 + 下载统计信息
 */
import { computed, reactive, ref, nextTick } from 'vue'
import { Share2, Copy, Check, QrCode, Lock, ShieldCheck } from '@lucide/vue'
import { toDataURL } from 'qrcode'
import { ElMessage } from '@/composables/useToast'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'
import shareService from '@/api/share'
import fileService from '@/api/file'
import {
  buildE2eeShareUrl,
  encryptFileForShare,
  E2EE_MAX_PLAINTEXT_BYTES
} from '@/utils/e2ee-share'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import BaseCheckbox from '@/components/base/BaseCheckbox.vue'

const props = defineProps({
  size: { type: String, default: 'sm' },
  /** 单个文件对象、对象数组、或 null（为空时回退到 store 多选） */
  item: { type: [Object, Array] as any, default: null },
  // 为 true 时不渲染自带触发按钮，仅作为弹窗容器（由外部通过 ref.openModal 触发）
  hideTrigger: { type: Boolean, default: false }
})

const fileStore = useFileStore()
const { multipleSelection } = storeToRefs(fileStore)

const title = ref('')
const open = ref(false)
const step = ref(1)
const loading = ref(false)
const encrypting = ref(false)
const e2eeProgress = ref(0)
const copied = ref(false)
const shareNameInputRef = ref<{ focus?: () => void } | null>(null)
// 外部通过 ref.openModal(file | file[]) 传入的目标文件；为空时回退到 props.item / 多选
const currentItem = ref<any>(null)
const currentItems = ref<any[]>([])
// 文件收集只支持单个文件夹分享；多选/普通文件时禁用开关，避免后端拒绝时用户困惑
const canCollect = computed(
  () => currentItems.value.length === 1 && currentItems.value[0]?.folderFlag === 1
)
// E2EE 只支持单文件；文件夹需要先打包，超出 MVP 边界
const canE2ee = computed(
  () =>
    currentItems.value.length === 1 &&
    currentItems.value[0]?.folderFlag !== 1 &&
    Number(currentItems.value[0]?.fileSize || 0) <= E2EE_MAX_PLAINTEXT_BYTES
)
const e2eeFile = ref<File | null>(null)

const form = reactive({
  shareName: '',
  shareType: '0',
  shareDayType: '0',
  shareCode: '',
  downloadLimit: '',
  forbidReshare: false,
  collectEnabled: false,
  e2ee: false
})

const errors = reactive({
  shareName: '',
  shareCode: '',
  downloadLimit: ''
})

const dayTypeOptions = [
  { value: '0', label: '永久有效' },
  { value: '1', label: '7天有效' },
  { value: '2', label: '30天有效' }
]

const result = reactive({
  shareUrl: '',
  shareCode: '',
  e2ee: false
})

const qrDataUrl = ref('')
const showQR = ref(false)

// 生成真实可扫描的二维码（使用已安装的 qrcode 库，替代此前手写的伪二维码）
async function generateQR(text: string) {
  try {
    qrDataUrl.value = await toDataURL(text, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M'
    })
  } catch {
    qrDataUrl.value = ''
  }
}

function handleFilename(name: string) {
  if (name?.length > 10) return name.substring(0, 11) + '...'
  return name
}

function randomCode() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

async function openModal(item?: any) {
  // 兼容：传入单个对象、对象数组，或为空时回退到 props.item / store 多选
  // 注意：Vue 模板里 `@click="openModal"` 会把 MouseEvent 当作 item 传入，
  // 这里要先识别并丢弃 DOM 事件，避免它被当作"选中项"参与后续 fileId 过滤。
  const isDomEvent =
    item &&
    typeof item === 'object' &&
    typeof (item as any).preventDefault === 'function' &&
    typeof (item as any).stopPropagation === 'function'
  if (isDomEvent) item = undefined
  const isRow = (x: any) => x && typeof x === 'object' && !(x instanceof MouseEvent) && !(x instanceof Event) && typeof (x as any).fileId !== 'undefined'

  let list: any[] = []
  if (Array.isArray(item) && item.length) list = item.filter(isRow)
  else if (item && isRow(item)) list = [item]
  else if (Array.isArray(props.item) && props.item.length) list = props.item.filter(isRow)
  else if (props.item && isRow(props.item)) list = [props.item]
  else list = (multipleSelection.value || []).filter(isRow)
  // 过滤掉缺失 fileId 的脏数据，确保提交的 ID 有效
  list = list.filter((i) => i && i.fileId)
  if (list.length === 0) {
    ElMessage.error('请选择要分享的文件')
    return
  }
  currentItem.value = list.length === 1 ? list[0] : null
  currentItems.value = list
  const fileName = list[0].filename || '分享'
  if (list.length === 1) {
    title.value = `分享文件（${handleFilename(list[0].filename || '分享')}）`
  } else {
    title.value = `分享文件（${handleFilename(list[0].filename || '分享')}等）`
  }
  step.value = 1
  // 默认填充文件名作为分享名称，减少用户输入；清空旧错误避免红框残留
  form.shareName = fileName
  form.shareDayType = '0'
  form.shareCode = randomCode()
  form.downloadLimit = ''
  form.forbidReshare = false
  form.collectEnabled = false
  form.e2ee = false
  e2eeFile.value = null
  errors.shareName = ''
  errors.shareCode = ''
  errors.downloadLimit = ''
  result.shareUrl = ''
  result.shareCode = ''
  result.e2ee = false
  copied.value = false
  showQR.value = false
  open.value = true
  await nextTick()
  shareNameInputRef.value?.focus?.()
}

function validate() {
  errors.shareName = ''
  errors.shareCode = ''
  errors.downloadLimit = ''
  let ok = true
  if (!form.shareName.trim()) {
    errors.shareName = '请输入分享名称'
    ok = false
  }
  if (form.shareCode && !/^[a-zA-Z0-9]{4,8}$/.test(form.shareCode)) {
    errors.shareCode = '4-8位字母数字'
    ok = false
  }
  if (form.downloadLimit !== '' && (Number(form.downloadLimit) < 0 || Number(form.downloadLimit) > 999)) {
    errors.downloadLimit = '0~999 的整数'
    ok = false
  }
  return ok
}

function pickE2eeFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    if (file.size > E2EE_MAX_PLAINTEXT_BYTES) {
      ElMessage.error('加密分享暂支持 20GB 以内文件')
      e2eeFile.value = null
      return
    }
    e2eeFile.value = file
  }
  input.click()
}

function submitShare(payload: Record<string, unknown>, key = '', iv = '', cipherFileId = '') {
  shareService.createShare(
    payload as never,
    (res) => {
      loading.value = false
      // 用浏览器当前地址动态拼接分享链接，避免后端 shareUrl 指向后端端口（如 127.0.0.1:8081）打不开前端分享页面
      const baseUrl = `${window.location.origin}/share/${res.data.shareId}`
      result.shareUrl = key && iv ? buildE2eeShareUrl(baseUrl, key, iv) : baseUrl
      result.shareCode = res.data.shareCode
      result.e2ee = payload.e2ee === true
      title.value = result.e2ee ? '加密分享创建成功！' : '分享成功！'
      step.value = 2
      generateQR(result.shareUrl)
    },
    (err) => {
      loading.value = false
      // 业务错误说明分享没创建成功，可以安全清掉刚上传的密文；
      // 网络错误不清理：请求可能已到达服务端，贸然删除会让已创建的分享 404
      const businessError = err && typeof err === 'object' && 'code' in err
      if (cipherFileId && businessError) {
        fileService.deleteCipher(cipherFileId, () => {}, () => {})
      }
      ElMessage.error((err as { message?: string })?.message || '分享创建失败')
    }
  )
}

async function doConfirm() {
  if (!validate()) return
  const list = currentItems.value.length
    ? currentItems.value
    : currentItem.value
      ? [currentItem.value]
      : multipleSelection.value || []
  let ids = list.map((i) => i && i.fileId).filter(Boolean)
  if (!ids.length) {
    ElMessage.error('请选择要分享的文件')
    return
  }
  const payload: {
    shareName: string
    shareType: number
    shareDayType: number
    shareFileIds: any[]
    shareCode?: string
    downloadLimit?: number
    forbidReshare?: boolean
    collectEnabled?: boolean
    e2ee?: boolean
  } = {
    shareName: form.shareName,
    shareType: parseInt(form.shareType, 10),
    shareDayType: parseInt(form.shareDayType, 10),
    shareFileIds: ids
  }
  if (form.shareCode) payload.shareCode = form.shareCode
  if (form.downloadLimit !== '' && Number(form.downloadLimit) >= 0)
    payload.downloadLimit = parseInt(form.downloadLimit, 10)

  if (form.e2ee) {
    if (!canE2ee.value) {
      ElMessage.error('加密分享仅支持 20GB 以内的单个文件')
      return
    }
    if (!e2eeFile.value) {
      ElMessage.error('请选择要加密的原文件')
      return
    }
    loading.value = true
    try {
      encrypting.value = true
      e2eeProgress.value = 0
      const cipher = await encryptFileForShare(e2eeFile.value, {
        onProgress: (ratio) => {
          e2eeProgress.value = ratio
        }
      })
      encrypting.value = false
      // OPFS 临时密文只用于本次上传；无论上传成功与否都要清理，服务端已有独立副本。
      const cleanup = () => {
        cipher.cleanup?.().catch(() => undefined)
      }
      fileService.uploadCipher(
        cipher.blob,
        cipher.filename,
        (uploadRes) => {
          cleanup()
          ids = [uploadRes.data]
          payload.shareFileIds = ids
          payload.e2ee = true
          // 加密分享不参与文件收集；前端隐藏开关，后端也会拒绝
          submitShare(payload, cipher.key, cipher.iv, uploadRes.data)
        },
        (err) => {
          cleanup()
          loading.value = false
          ElMessage.error(err.message || '密文上传失败')
        }
      )
    } catch (e) {
      encrypting.value = false
      loading.value = false
      ElMessage.error(e instanceof Error ? e.message : '加密失败')
    }
    return
  }

  if (form.forbidReshare) payload.forbidReshare = true
  if (form.collectEnabled && canCollect.value) payload.collectEnabled = true
  loading.value = true
  submitShare(payload)
}

async function copyAll() {
  try {
    const text = result.e2ee
      ? `链接：${result.shareUrl}\n提取码：${result.shareCode}\n此链接包含解密密钥，请通过可信渠道发送。`
      : `链接：${result.shareUrl}\n提取码：${result.shareCode}\n赶快分享给小伙伴吧！`
    await navigator.clipboard.writeText(text)
    copied.value = true
    ElMessage.success('已复制到剪贴板')
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

function onClose() {
  open.value = false
  currentItem.value = null
  currentItems.value = []
}

defineExpose({ openModal })
</script>

<template>
  <div class="inline-block">
    <BaseButton
      v-if="!hideTrigger"
      variant="secondary"
      :size="props.size === 'small' ? 'sm' : 'md'"
      @click="() => openModal()"
    >
      <span class="inline-flex items-center gap-1.5">
        <Share2 :size="14" />
        分享
      </span>
    </BaseButton>

    <BaseModal
      :open="open"
      :title="title"
      size="md"
      :hide-close="step === 2"
      @update:open="(v) => !v && onClose()"
    >
      <!-- Step 1：配置 -->
      <div v-if="step === 1" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-(--color-text-muted) mb-1.5">
            分享名称 <span class="text-(--color-danger-text)">*</span>
          </label>
          <BaseInput
            ref="shareNameInputRef"
            v-model="form.shareName"
            placeholder="给分享起个名字"
            :error="!!errors.shareName"
            maxlength="50"
            show-count
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-(--color-text-muted) mb-1.5"
            >分享类型</label
          >
          <BaseSelect
            v-model="form.shareType"
            :options="[{ value: '0', label: '有提取码' }]"
            disabled
          />
          <p class="mt-1 text-[11px] text-(--color-text-muted)">当前仅支持提取码分享</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-(--color-text-muted) mb-1.5"
            >分享有效期</label
          >
          <BaseSelect v-model="form.shareDayType" :options="dayTypeOptions" />
        </div>

        <!-- 高级选项 -->
        <div class="border-t border-(--color-border) pt-4 space-y-3">
          <p class="text-xs font-medium text-(--color-text) flex items-center gap-1.5">
            <Lock :size="12" />
            高级选项（可选）
          </p>
          <div>
            <label class="block text-xs font-medium text-(--color-text-muted) mb-1.5"
              >自定义提取码</label
            >
            <div class="flex gap-2">
              <BaseInput
                v-model="form.shareCode"
                placeholder="留空则系统随机生成"
                :error="!!errors.shareCode"
                maxlength="8"
              />
              <BaseButton
                variant="secondary"
                size="sm"
                @click="form.shareCode = randomCode()"
                title="随机生成"
              >
                随机
              </BaseButton>
            </div>
            <p v-if="!errors.shareCode" class="mt-1 text-[11px] text-(--color-text-muted)">
              4-8 位字母数字，留空则系统自动生成
            </p>
          </div>
          <div>
            <label class="block text-xs font-medium text-(--color-text-muted) mb-1.5"
              >下载次数限制</label
            >
            <BaseInput
              v-model.number="form.downloadLimit"
              type="number"
              placeholder="留空 = 不限"
              :error="!!errors.downloadLimit"
              min="0"
              max="999"
            />
            <p v-if="!errors.downloadLimit" class="mt-1 text-[11px] text-(--color-text-muted)">
              达到上限后分享将失效，0 或留空表示不限制
            </p>
          </div>
          <div class="space-y-2">
            <BaseCheckbox v-model="form.forbidReshare" label="禁止转载（他人不可转存到自己网盘）" />
            <BaseCheckbox
              v-model="form.collectEnabled"
              label="开启文件收集（仅单个文件夹分享，访问者可上传到该文件夹）"
              :disabled="!canCollect || form.e2ee"
            />
            <p v-if="!canCollect" class="text-[11px] text-(--color-text-muted)">
              {{ form.e2ee ? '加密分享不支持文件收集' : '文件收集仅支持单个文件夹分享' }}
            </p>
          </div>

          <!-- E2EE：密钥只在浏览器生成，服务端拿到的是密文副本 -->
          <div class="border-t border-(--color-border) pt-3 space-y-2">
            <BaseCheckbox
              v-model="form.e2ee"
              label="端到端加密分享（浏览器加密，服务端无法解密）"
              :disabled="!canE2ee"
            />
            <p v-if="!canE2ee" class="text-[11px] text-(--color-text-muted)">
              加密分享仅支持 20GB 以内的单个文件
            </p>
            <div v-if="form.e2ee" class="rounded-sm bg-(--color-surface-2) p-3 space-y-2">
              <div class="flex items-center gap-2">
                <BaseButton variant="secondary" size="sm" @click="pickE2eeFile">
                  <span class="inline-flex items-center gap-1.5">
                    <ShieldCheck :size="14" />
                    选择原文件
                  </span>
                </BaseButton>
                <span v-if="encrypting" class="text-xs text-(--color-text-muted)">
                  加密中 {{ Math.round(e2eeProgress * 100) }}%
                </span>
                <span v-else class="text-xs text-(--color-text-muted) truncate">
                  {{ e2eeFile ? e2eeFile.name : '尚未选择' }}
                </span>
              </div>
              <p class="text-[11px] text-(--color-text-muted)">
                浏览器会生成随机密钥并加密上传；分享链接 # 后携带密钥，请通过可信渠道发送。
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2：结果 -->
      <div v-else class="space-y-4">
        <div
          class="flex items-center justify-center size-12 mx-auto rounded-full bg-success/10 text-(--color-success-text)"
        >
          <Check :size="22" />
        </div>

        <div>
          <label class="block text-xs font-medium text-(--color-text-muted) mb-1.5"
            >分享链接</label
          >
          <div class="flex gap-2">
            <BaseInput v-model="result.shareUrl" readonly />
            <BaseButton variant="secondary" size="sm" @click="copyAll">
              <Copy :size="14" />
            </BaseButton>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-(--color-text-muted) mb-1.5"
            >提取码</label
          >
          <div
            class="px-4 py-3 rounded-sm border border-(--color-border) bg-(--color-surface-2) text-center tracking-[0.5em] text-xl font-mono font-semibold text-primary-600 dark:text-primary-400"
          >
            {{ result.shareCode }}
          </div>
        </div>

        <div
          v-if="result.e2ee"
          class="rounded-sm border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] leading-5 text-(--color-warning-text)"
        >
          这是端到端加密分享：链接 # 后包含解密密钥，服务端和日志都看不到。请通过可信渠道发送，任何拿到完整链接的人都能解密。
        </div>

        <div class="border-t border-(--color-border) pt-4">
          <button
            type="button"
            class="text-xs text-primary-600 hover:underline flex items-center gap-1"
            @click="showQR = !showQR"
          >
            <QrCode :size="12" />
            {{ showQR ? '隐藏二维码' : '显示二维码' }}
          </button>
          <img
            v-if="showQR && qrDataUrl"
            :src="qrDataUrl"
            alt="分享二维码"
            class="mt-3 w-40 h-40 mx-auto rounded-sm bg-white p-2 shadow-sm border border-(--color-border) object-contain"
          />
        </div>
      </div>

      <template #footer>
        <template v-if="step === 1">
          <BaseButton variant="ghost" size="sm" @click="onClose">取消</BaseButton>
          <BaseButton variant="primary" size="sm" :loading="loading" @click="doConfirm">
            生成分享链接
          </BaseButton>
        </template>
        <template v-else>
          <BaseButton variant="ghost" size="sm" @click="onClose">关闭</BaseButton>
          <BaseButton variant="primary" size="sm" @click="copyAll">
            <span class="inline-flex items-center gap-1.5">
              <Check v-if="copied" :size="14" />
              <Copy v-else :size="14" />
              {{ copied ? '已复制' : '一键复制' }}
            </span>
          </BaseButton>
        </template>
      </template>
    </BaseModal>
  </div>
</template>
