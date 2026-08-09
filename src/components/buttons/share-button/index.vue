<script setup>
/**
 * ShareButton —— 分享文件（两步式对话框）
 * Step 1: 配置分享名 + 有效期
 * Step 2: 显示分享链接 + 提取码 + 一键复制
 */
import {reactive, ref, nextTick} from 'vue'
import {Share2, Copy, Check} from '@lucide/vue'
import {ElMessage, ElMessageBox} from '@/composables/useToast'
import {useFileStore} from '@/stores/file'
import {storeToRefs} from 'pinia'
import shareService from '@/api/share'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'

const props = defineProps({
  size: {type: String, default: 'md'},
  item: {type: Object, default: null},
})

const fileStore = useFileStore()
const {multipleSelection} = storeToRefs(fileStore)

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
})

const errors = reactive({
  shareName: '',
})

const dayTypeOptions = [
  {value: '0', label: '永久有效'},
  {value: '1', label: '7天有效'},
  {value: '2', label: '30天有效'},
]

const result = reactive({
  shareUrl: '',
  shareCode: '',
})

function handleFilename(name) {
  if (name?.length > 10) return name.substring(0, 11) + '...'
  return name
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
  result.shareUrl = ''
  result.shareCode = ''
  copied.value = false
  open.value = true
  await nextTick()
  shareNameInputRef.value?.focus?.()
}

function validate() {
  errors.shareName = ''
  if (!form.shareName.trim()) {
    errors.shareName = '请输入分享名称'
    return false
  }
  return true
}

async function doConfirm() {
  if (!validate()) return
  const ids = props.item
    ? [props.item.fileId]
    : multipleSelection.value.map((i) => i.fileId)
  loading.value = true
  shareService.createShare(
    {
      shareName: form.shareName,
      shareType: parseInt(form.shareType, 10),
      shareDayType: parseInt(form.shareDayType, 10),
      shareFileIds: ids.join('__,__'),
    },
    (res) => {
      loading.value = false
      result.shareUrl = res.data.shareUrl
      result.shareCode = res.data.shareCode
      title.value = '分享成功！'
      step.value = 2
    },
    (err) => {
      loading.value = false
      ElMessage.error(err.message)
    },
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
        <Share2 :size="14"/>
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
          <label class="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">分享类型</label>
          <BaseSelect
            v-model="form.shareType"
            :options="[{value: '0', label: '有提取码'}]"
            disabled
          />
          <p class="mt-1 text-[11px] text-[var(--color-text-muted)]">当前仅支持提取码分享</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">分享有效期</label>
          <BaseSelect v-model="form.shareDayType" :options="dayTypeOptions"/>
        </div>
      </div>

      <!-- Step 2：结果 -->
      <div v-else class="space-y-4">
        <div
          class="flex items-center justify-center size-12 mx-auto rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)]"
        >
          <Check :size="22"/>
        </div>

        <div>
          <label class="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">分享链接</label>
          <div class="flex gap-2">
            <BaseInput v-model="result.shareUrl" readonly/>
            <BaseButton variant="secondary" size="md" @click="copyAll">
              <Copy :size="14"/>
            </BaseButton>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">提取码</label>
          <div
            class="px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-center tracking-[0.5em] text-xl font-mono font-semibold text-[var(--color-primary-600)] dark:text-[var(--color-primary-400)]"
          >
            {{ result.shareCode }}
          </div>
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
              <Check v-if="copied" :size="14"/>
              <Copy v-else :size="14"/>
              {{ copied ? '已复制' : '一键复制' }}
            </span>
          </BaseButton>
        </template>
      </template>
    </BaseModal>
  </div>
</template>