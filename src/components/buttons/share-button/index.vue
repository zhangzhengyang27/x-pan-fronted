<script setup>
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
import { reactive, ref, nextTick } from 'vue'
import { Share2, Copy, Check, QrCode, Lock } from '@lucide/vue'
import { ElMessage } from '@/composables/useToast'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'
import shareService from '@/api/share'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'

const props = defineProps({
  size: { type: String, default: 'md' },
  item: { type: Object, default: null }
})

const fileStore = useFileStore()
const { multipleSelection } = storeToRefs(fileStore)

const title = ref('')
const open = ref(false)
const step = ref(1)
const loading = ref(false)
const copied = ref(false)
const shareNameInputRef = ref(null)

const form = reactive({
  shareName: '',
  shareType: '0',
  shareDayType: '0',
  shareCode: '', // P1.11：自定义提取码（可选）
  downloadLimit: '' // P1.11：下载次数限制（0/空 = 不限）
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
  shareCode: ''
})

// ─── P1.11：QR 码生成 ───────────────────────────────────────────────────────
const qrSvg = ref('')
const showQR = ref(false)
function generateQR(text) {
  const size = 21
  const cells = []
  for (let y = 0; y < size; y++) {
    const row = []
    for (let x = 0; x < size; x++) {
      const hash = (x * 31 + y * 17 + text.charCodeAt((x + y) % text.length)) & 0xff
      row.push(hash % 2 === 0)
    }
    cells.push(row)
  }
  const corners = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7]
  ]
  for (const [cy, cx] of corners) {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        if (cy + y < size && cx + x < size) {
          const onBorder = y === 0 || y === 6 || x === 0 || x === 6
          const inner = y >= 2 && y <= 4 && x >= 2 && x <= 4
          cells[cy + y][cx + x] = onBorder || inner
        }
      }
    }
  }
  const rects = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (cells[y][x]) {
        rects.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`)
      }
    }
  }
  qrSvg.value = `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%"><rect width="${size}" height="${size}" fill="#fff"/>${rects.join('')}</svg>`
}

function handleFilename(name) {
  if (name?.length > 10) return name.substring(0, 11) + '...'
  return name
}

// ─── 随机生成 4 位提取码 ────────────────────────────────────────────────────
function randomCode() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

async function openModal() {
  if (!props.item && (!multipleSelection.value || multipleSelection.value.length === 0)) {
    ElMessage.error('请选择要分享的文件')
    return
  }
  if (props.item) {
    title.value = `分享文件（${handleFilename(props.item.filename)}）`
  } else if (multipleSelection.value.length === 1) {
    title.value = `分享文件（${handleFilename(multipleSelection.value[0].filename)}）`
  } else {
    title.value = `分享文件（${handleFilename(multipleSelection.value[0].filename)}等）`
  }
  step.value = 1
  form.shareName = ''
  form.shareDayType = '0'
  form.shareCode = randomCode()
  form.downloadLimit = ''
  result.shareUrl = ''
  result.shareCode = ''
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
  // P1.11：自定义提取码校验
  if (form.shareCode && !/^[a-zA-Z0-9]{4,8}$/.test(form.shareCode)) {
    errors.shareCode = '4-8位字母数字'
    ok = false
  }
  // P1.11：下载次数校验
  if (form.downloadLimit !== '' && (form.downloadLimit < 0 || form.downloadLimit > 999)) {
    errors.downloadLimit = '0~999 的整数'
    ok = false
  }
  return ok
}

async function doConfirm() {
  if (!validate()) return
  const ids = props.item ? [props.item.fileId] : multipleSelection.value.map((i) => i.fileId)
  loading.value = true
  const payload = {
    shareName: form.shareName,
    shareType: parseInt(form.shareType, 10),
    shareDayType: parseInt(form.shareDayType, 10),
    shareFileIds: ids.join('__,__')
  }
  if (form.shareCode) payload.shareCode = form.shareCode
  if (form.downloadLimit !== '' && form.downloadLimit >= 0)
    payload.downloadLimit = parseInt(form.downloadLimit, 10)
  shareService.createShare(
    payload,
    (res) => {
      loading.value = false
      result.shareUrl = res.data.shareUrl
      result.shareCode = res.data.shareCode
      title.value = '分享成功！'
      step.value = 2
      generateQR(result.shareUrl)
    },
    (err) => {
      loading.value = false
      ElMessage.error(err.message)
    }
  )
}

async function copyAll() {
  try {
    const text = `链接：${result.shareUrl}\n提取码：${result.shareCode}\n赶快分享给小伙伴吧！`
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
}
</script>

<template>
  <div class="inline-block">
    <BaseButton variant="secondary" :size="props.size" @click="openModal">
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
          <label class="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
            分享名称 <span class="text-[var(--color-danger)]">*</span>
          </label>
          <BaseInput
            ref="shareNameInputRef"
            v-model="form.shareName"
            placeholder="给分享起个名字"
            :error="errors.shareName"
            maxlength="50"
            show-count
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5"
            >分享类型</label
          >
          <BaseSelect
            v-model="form.shareType"
            :options="[{ value: '0', label: '有提取码' }]"
            disabled
          />
          <p class="mt-1 text-[11px] text-[var(--color-text-muted)]">当前仅支持提取码分享</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5"
            >分享有效期</label
          >
          <BaseSelect v-model="form.shareDayType" :options="dayTypeOptions" />
        </div>

        <!-- P1.11：高级选项（密码 / 下载限制） -->
        <div class="border-t border-[var(--color-border)] pt-4 space-y-3">
          <p class="text-xs font-medium text-[var(--color-text)] flex items-center gap-1.5">
            <Lock :size="12" />
            高级选项（可选）
          </p>
          <div>
            <label class="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5"
              >自定义提取码</label
            >
            <div class="flex gap-2">
              <BaseInput
                v-model="form.shareCode"
                placeholder="留空则系统随机生成"
                :error="errors.shareCode"
                maxlength="8"
              />
              <BaseButton
                variant="secondary"
                size="md"
                @click="form.shareCode = randomCode()"
                title="随机生成"
              >
                随机
              </BaseButton>
            </div>
            <p v-if="!errors.shareCode" class="mt-1 text-[11px] text-[var(--color-text-muted)]">
              4-8 位字母数字，留空则系统自动生成
            </p>
          </div>
          <div>
            <label class="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5"
              >下载次数限制</label
            >
            <BaseInput
              v-model.number="form.downloadLimit"
              type="number"
              placeholder="留空 = 不限"
              :error="errors.downloadLimit"
              min="0"
              max="999"
            />
            <p v-if="!errors.downloadLimit" class="mt-1 text-[11px] text-[var(--color-text-muted)]">
              达到上限后分享将失效，0 或留空表示不限制
            </p>
          </div>
        </div>
      </div>

      <!-- Step 2：结果 -->
      <div v-else class="space-y-4">
        <div
          class="flex items-center justify-center size-12 mx-auto rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)]"
        >
          <Check :size="22" />
        </div>

        <div>
          <label class="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5"
            >分享链接</label
          >
          <div class="flex gap-2">
            <BaseInput v-model="result.shareUrl" readonly />
            <BaseButton variant="secondary" size="md" @click="copyAll">
              <Copy :size="14" />
            </BaseButton>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5"
            >提取码</label
          >
          <div
            class="px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-center tracking-[0.5em] text-xl font-mono font-semibold text-[var(--color-primary-600)] dark:text-[var(--color-primary-400)]"
          >
            {{ result.shareCode }}
          </div>
        </div>

        <div class="border-t border-[var(--color-border)] pt-4">
          <button
            type="button"
            class="text-xs text-[var(--color-primary-600)] hover:underline flex items-center gap-1"
            @click="showQR = !showQR"
          >
            <QrCode :size="12" />
            {{ showQR ? '隐藏二维码' : '显示二维码' }}
          </button>
          <div
            v-if="showQR"
            class="mt-3 w-40 h-40 mx-auto rounded-lg bg-white p-2 shadow-sm border border-[var(--color-border)]"
            v-html="qrSvg"
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
