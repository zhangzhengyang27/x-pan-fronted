<script setup lang="ts">
/**
 * DirectLinkButton —— 创建文件直链（两步式对话框）
 * Step 1: 展示选中文件 + 创建按钮
 * Step 2: 展示直链 URL + 一键复制
 *
 * P0-1：直链为免登录下载链接，保险箱文件后端会拒绝（绕过解锁防护）。
 * 选中项解析逻辑与 ShareButton 保持一致（兼容 MouseEvent/数组/多选回退）。
 */
import { reactive, ref } from 'vue'
import { Link as LinkIcon, Copy, Check } from '@lucide/vue'
import { ElMessage } from '@/composables/useToast'
import { useFileStore } from '@/stores/file'
import { storeToRefs } from 'pinia'
import directLinkService, { type IDirectLinkVO } from '@/api/direct-link'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseInput from '@/components/base/BaseInput.vue'

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
const copied = ref(false)
const currentItem = ref<any>(null)
const currentItems = ref<any[]>([])
const currentFileId = ref('')

const result = reactive({
  url: ''
})

function handleFilename(name: string) {
  if (name?.length > 10) return name.substring(0, 11) + '...'
  return name
}

async function openModal(item?: any) {
  // 与 ShareButton 相同的选中项解析：丢弃 DOM 事件、按行对象过滤、回退多选
  const isDomEvent =
    item &&
    typeof item === 'object' &&
    typeof (item as any).preventDefault === 'function' &&
    typeof (item as any).stopPropagation === 'function'
  if (isDomEvent) item = undefined
  const isRow = (x: any) =>
    x && typeof x === 'object' && !(x instanceof MouseEvent) && !(x instanceof Event) && typeof (x as any).fileId !== 'undefined'

  let list: any[] = []
  if (Array.isArray(item) && item.length) list = item.filter(isRow)
  else if (item && isRow(item)) list = [item]
  else if (Array.isArray(props.item) && props.item.length) list = props.item.filter(isRow)
  else if (props.item && isRow(props.item)) list = [props.item]
  else list = (multipleSelection.value || []).filter(isRow)
  list = list.filter((i) => i && i.fileId)
  if (list.length === 0) {
    ElMessage.error('请选择要创建直链的文件')
    return
  }
  // 直链按单文件语义：多选时取第一个并提示
  if (list.length > 1) ElMessage.warning('直链为单文件链接，已取第一个选中项')
  currentItem.value = list[0]
  currentItems.value = list
  currentFileId.value = list[0].fileId
  title.value = `创建直链（${handleFilename(list[0].filename || '文件')}）`
  step.value = 1
  result.url = ''
  copied.value = false
  open.value = true
}

async function doCreate() {
  loading.value = true
  directLinkService.create(
    currentFileId.value,
    (res) => {
      loading.value = false
      const vo = res.data as IDirectLinkVO
      result.url = `${window.location.origin}/direct-link/stream?token=${vo.token}`
      title.value = '直链创建成功！'
      step.value = 2
    },
    (err) => {
      loading.value = false
      ElMessage.error(err.message)
    }
  )
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(result.url)
    copied.value = true
    ElMessage.success('直链已复制到剪贴板')
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

function onClose() {
  open.value = false
  currentItem.value = null
  currentItems.value = []
  currentFileId.value = ''
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
        <LinkIcon :size="14" />
        直链
      </span>
    </BaseButton>

    <BaseModal
      :open="open"
      :title="title"
      size="md"
      @update:open="(v) => !v && onClose()"
    >
      <!-- Step 1：确认创建 -->
      <div v-if="step === 1" class="space-y-4">
        <p class="text-sm text-(--color-text)">
          将为「{{ currentItem?.filename }}」创建免登录下载直链。
        </p>
        <p class="text-[11px] text-(--color-text-muted)">
          直链可随时在「直链管理」页停用或删除；保险箱文件不支持创建直链；任何拿到链接的人都可以下载该文件。
        </p>
      </div>

      <!-- Step 2：结果 -->
      <div v-else class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-(--color-text-muted) mb-1.5">直链地址</label>
          <div class="flex gap-2">
            <BaseInput v-model="result.url" readonly />
            <BaseButton variant="secondary" size="sm" @click="copyUrl">
              <Copy :size="14" />
            </BaseButton>
          </div>
        </div>
        <p class="text-[11px] text-(--color-text-muted)">
          任何拿到该链接的人都可以直接下载文件，请勿外传给不信任的对象。
        </p>
      </div>

      <template #footer>
        <template v-if="step === 1">
          <BaseButton variant="ghost" size="sm" @click="onClose">取消</BaseButton>
          <BaseButton variant="primary" size="sm" :loading="loading" @click="doCreate">
            创建直链
          </BaseButton>
        </template>
        <template v-else>
          <BaseButton variant="ghost" size="sm" @click="onClose">关闭</BaseButton>
          <BaseButton variant="primary" size="sm" @click="copyUrl">
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
