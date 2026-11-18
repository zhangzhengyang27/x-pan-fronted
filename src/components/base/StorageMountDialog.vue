<script setup lang="ts">
/**
 * StorageMountDialog —— 外部存储挂载管理弹窗
 * 列表 + 新建/编辑表单（SK 编辑留空 = 不修改）+ 连接测试 + 删除确认。
 * 对齐 DeviceManagerDialog 交互模式。
 */
import { ref, watch, reactive } from 'vue'
import { HardDrive, Plus, LoaderCircle, Pencil, Trash2, PlugZap, X, Folder, File as FileIcon, Download, ChevronRight, Upload as UploadIcon } from '@lucide/vue'
import mountService, { type MountVO, type MountSave, type S3ObjectEntry } from '@/api/mount'
import { ElMessage, ElMessageBox } from '@/composables/useToast'

const props = defineProps({
  open: { type: Boolean, default: false }
})
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const mode = ref<'list' | 'form' | 'browse'>('list')
const loading = ref(false)
const testing = ref(false)
const saving = ref(false)
const mounts = ref<MountVO[]>([])
const editingId = ref<string | null>(null)

// 浏览模式状态
const browsing = ref<MountVO | null>(null)
const browsePath = ref('')
const browseItems = ref<S3ObjectEntry[]>([])
const browseLoading = ref(false)
const browseTrail = ref<string[]>([]) // 面包屑段

function openBrowse(m: MountVO) {
  browsing.value = m
  browsePath.value = ''
  browseTrail.value = []
  browseItems.value = []
  mode.value = 'browse'
  loadBrowse()
}

function loadBrowse() {
  if (!browsing.value) return
  browseLoading.value = true
  mountService.browse(
    browsing.value.id,
    browsePath.value,
    (res) => {
      browseItems.value = res.data || []
      browseLoading.value = false
    },
    (r) => {
      browseLoading.value = false
      ElMessage.error((r as { message?: string })?.message || '目录读取失败')
    }
  )
}

function enterDir(entry: S3ObjectEntry) {
  if (!entry.dir) return
  browsePath.value = entry.key
  browseTrail.value.push(entry.display)
  loadBrowse()
}

function upLevel() {
  if (browseTrail.value.length === 0) {
    mode.value = 'list'
    return
  }
  browseTrail.value.pop()
  browsePath.value = browseTrail.value.join('/')
  loadBrowse()
}

const fileInput = ref<HTMLInputElement | null>(null)

function pickUpload() {
  fileInput.value?.click()
}

async function onUploadPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !browsing.value) return
  mountService.upload(
    browsing.value.id,
    browsePath.value,
    file,
    () => {
      ElMessage.success('上传成功')
      loadBrowse()
    },
    (r) => {
      ElMessage.error((r as { message?: string })?.message || '上传失败')
    }
  )
}

function download(entry: S3ObjectEntry) {
  if (!browsing.value) return
  mountService.previewUrl(
    browsing.value.id,
    entry.key,
    (res) => {
      window.open(res.data, '_blank', 'noopener')
    },
    (r) => {
      ElMessage.error((r as { message?: string })?.message || '获取下载链接失败')
    }
  )
}

function removeEntry(entry: S3ObjectEntry) {
  if (!browsing.value) return
  ElMessageBox.confirm(
    entry.dir
      ? `删除目录"${entry.display}"及其全部内容？外部存储删除不可恢复。`
      : `删除文件"${entry.display}"？外部存储删除不可恢复。`,
    '删除',
    { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
  )
    .then((ok) => {
      if (!ok) return
      mountService.deleteObject(
        browsing.value!.id,
        entry.key,
        entry.dir,
        (res) => {
          const failed = res.data || []
          ElMessage.success(failed.length ? `删除完成（${failed.length} 项失败）` : '已删除')
          loadBrowse()
        },
        (r) => {
          ElMessage.error((r as { message?: string })?.message || '删除失败')
        }
      )
    })
    .catch(() => {})
}

const form = reactive({
  name: '',
  endpoint: '',
  bucket: '',
  accessKey: '',
  secretKey: '',
  basePrefix: '',
  enabled: true
})

watch(
  () => props.open,
  (v) => {
    if (v) {
      mode.value = 'list'
      loadMounts()
    }
  }
)

function loadMounts() {
  loading.value = true
  mountService.list(
    (res) => {
      mounts.value = res.data || []
      loading.value = false
    },
    () => {
      loading.value = false
      ElMessage.error('加载挂载点列表失败')
    }
  )
}

function openCreate() {
  editingId.value = null
  Object.assign(form, {
    name: '',
    endpoint: '',
    bucket: '',
    accessKey: '',
    secretKey: '',
    basePrefix: '',
    enabled: true
  })
  mode.value = 'form'
}

function openEdit(m: MountVO) {
  editingId.value = m.id
  Object.assign(form, {
    name: m.name,
    endpoint: m.endpoint,
    bucket: m.bucket,
    accessKey: m.accessKey,
    secretKey: '',
    basePrefix: m.basePrefix,
    enabled: m.enabled
  })
  mode.value = 'form'
}

function validate(): string {
  if (!form.name.trim()) return '请填写显示名称'
  if (!/^https?:\/\//.test(form.endpoint.trim())) return '端点必须以 http:// 或 https:// 开头'
  if (!form.bucket.trim()) return '请填写 bucket'
  if (!form.accessKey.trim()) return '请填写 AccessKey'
  if (editingId.value === null && !form.secretKey.trim()) return '新建时必须填写 SecretKey'
  return ''
}

function save() {
  const err = validate()
  if (err) {
    ElMessage.warning(err)
    return
  }
  const po: MountSave = {
    id: editingId.value ?? undefined,
    name: form.name.trim(),
    endpoint: form.endpoint.trim(),
    bucket: form.bucket.trim(),
    accessKey: form.accessKey.trim(),
    secretKey: form.secretKey.trim(),
    basePrefix: form.basePrefix.trim(),
    enabled: form.enabled
  }
  saving.value = true
  const done = () => {
    saving.value = false
    ElMessage.success(editingId.value ? '已更新' : '已创建')
    mode.value = 'list'
    loadMounts()
  }
  const fail = (r: unknown) => {
    saving.value = false
    ElMessage.error((r as { message?: string })?.message || '保存失败')
  }
  if (editingId.value) mountService.update(po, done, fail)
  else mountService.create(po, done, fail)
}

function testConnection() {
  const err = editingId.value === null && !form.secretKey.trim()
    ? '新建时必须填写 SecretKey 才能测试'
    : ''
  if (err) {
    ElMessage.warning(err)
    return
  }
  const po: MountSave = {
    id: editingId.value ?? undefined,
    name: form.name.trim(),
    endpoint: form.endpoint.trim(),
    bucket: form.bucket.trim(),
    accessKey: form.accessKey.trim(),
    secretKey: form.secretKey.trim(),
    basePrefix: form.basePrefix.trim(),
    enabled: form.enabled
  }
  testing.value = true
  mountService.testRaw(
    po,
    (res) => {
      testing.value = false
      ElMessage.success(res.data || '连接成功')
    },
    (r) => {
      testing.value = false
      ElMessage.error((r as { message?: string })?.message || '连接失败')
    }
  )
}

function testSaved(m: MountVO) {
  testing.value = true
  mountService.testSaved(
    m.id,
    (res) => {
      testing.value = false
      ElMessage.success(res.data || '连接成功')
    },
    (r) => {
      testing.value = false
      ElMessage.error((r as { message?: string })?.message || '连接失败')
    }
  )
}

function remove(m: MountVO) {
  ElMessageBox.confirm(
    `确定要删除挂载"${m.name}"吗？仅移除挂载关系，外部存储中的内容不受影响。`,
    '删除挂载',
    { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
  )
    .then((ok) => {
      if (!ok) return
      mountService.remove(
        m.id,
        () => {
          ElMessage.success('已删除')
          loadMounts()
        },
        () => ElMessage.error('删除失败')
      )
    })
    .catch(() => {})
}
</script>

<template>
  <BaseModal :open="open" title="外部存储" size="md" @update:open="emit('update:open', $event)">
    <!-- 列表模式 -->
    <div v-if="mode === 'list'" class="flex flex-col gap-3">
      <div v-if="loading" class="flex justify-center py-6">
        <LoaderCircle :size="20" class="animate-spin text-(--color-text-secondary)" />
      </div>
      <div v-else-if="mounts.length === 0" class="py-6 text-center text-sm text-(--color-text-secondary)">
        暂无挂载点，点击下方按钮添加你的 S3 兼容存储
      </div>
      <div
        v-for="m in mounts"
        v-else
        :key="m.id"
        class="flex items-center gap-3 rounded-lg border border-(--color-border) px-3 py-2.5"
      >
        <HardDrive :size="16" class="text-(--color-text-secondary)" />
        <div class="min-w-0 flex-1 cursor-pointer" title="进入浏览" @click="openBrowse(m)">
          <div class="flex items-center gap-2">
            <span class="truncate text-sm font-medium text-(--color-text)">{{ m.name }}</span>
            <span
              class="rounded px-1.5 py-0.5 text-[10px]"
              :class="m.enabled ? 'bg-(--color-surface-2) text-(--color-success)' : 'bg-(--color-surface-2) text-(--color-text-secondary)'"
            >
              {{ m.enabled ? '已启用' : '已停用' }}
            </span>
          </div>
          <div class="truncate text-xs text-(--color-text-secondary)">{{ m.bucket }} · {{ m.endpoint }}</div>
        </div>
        <button
          type="button"
          class="text-(--color-text-secondary) hover:text-(--color-brand) transition-colors"
          :disabled="testing"
          title="连接测试"
          @click="testSaved(m)"
        >
          <PlugZap :size="14" />
        </button>
        <button
          type="button"
          class="text-(--color-text-secondary) hover:text-(--color-brand) transition-colors"
          title="编辑"
          @click="openEdit(m)"
        >
          <Pencil :size="14" />
        </button>
        <button
          type="button"
          class="text-(--color-text-secondary) hover:text-danger transition-colors"
          title="删除"
          @click="remove(m)"
        >
          <Trash2 :size="14" />
        </button>
      </div>

      <button
        type="button"
        class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-(--color-border) py-2.5 text-sm text-(--color-text-secondary) hover:border-(--color-brand) hover:text-(--color-brand) transition-colors"
        @click="openCreate"
      >
        <Plus :size="14" />
        添加挂载点
      </button>
    </div>

    <!-- 浏览模式 -->
    <div v-else-if="mode === 'browse' && browsing" class="flex flex-col gap-3">
      <div class="flex items-center gap-1.5 text-sm">
        <button type="button" class="text-(--color-text-secondary) hover:text-(--color-brand)" @click="upLevel">
          {{ browseTrail.length ? '上级' : '返回' }}
        </button>
        <ChevronRight v-if="browseTrail.length" :size="12" class="text-(--color-text-secondary)" />
        <span class="truncate font-medium text-(--color-text)">
          {{ browsing.name }}{{ browseTrail.length ? ' / ' + browseTrail.join(' / ') : '' }}
        </span>
        <button
          type="button"
          class="ml-auto flex items-center gap-1 text-xs text-(--color-brand) hover:opacity-80"
          @click="pickUpload"
        >
          <UploadIcon :size="12" />
          上传到此目录
        </button>
        <input ref="fileInput" type="file" class="hidden" @change="onUploadPicked" />
      </div>

      <div v-if="browseLoading" class="flex justify-center py-6">
        <LoaderCircle :size="20" class="animate-spin text-(--color-text-secondary)" />
      </div>
      <div v-else-if="browseItems.length === 0" class="py-6 text-center text-sm text-(--color-text-secondary)">
        此目录为空
      </div>
      <div v-else class="flex max-h-80 flex-col divide-y divide-(--color-border) overflow-y-auto">
        <div v-for="entry in browseItems" :key="entry.key" class="flex items-center gap-2 py-2">
          <Folder v-if="entry.dir" :size="14" class="text-(--color-brand)" />
          <FileIcon v-else :size="14" class="text-(--color-text-secondary)" />
          <button
            type="button"
            class="min-w-0 flex-1 truncate text-left text-sm text-(--color-text) hover:text-(--color-brand)"
            @click="entry.dir ? enterDir(entry) : download(entry)"
          >
            {{ entry.display }}
          </button>
          <span v-if="!entry.dir" class="shrink-0 text-xs text-(--color-text-secondary)">
            {{ (entry.size / 1024).toFixed(1) }} KB
          </span>
          <button
            v-if="!entry.dir"
            type="button"
            class="text-(--color-text-secondary) hover:text-(--color-brand)"
            title="下载"
            @click="download(entry)"
          >
            <Download :size="13" />
          </button>
          <button
            type="button"
            class="text-(--color-text-secondary) hover:text-danger"
            title="删除"
            @click="removeEntry(entry)"
          >
            <Trash2 :size="13" />
          </button>
        </div>
      </div>
    </div>

    <!-- 表单模式 -->
    <div v-else-if="mode === 'form'" class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-(--color-text)">
          {{ editingId ? '编辑挂载点' : '添加挂载点' }}
        </span>
        <button type="button" class="text-(--color-text-secondary) hover:text-(--color-text)" @click="mode = 'list'">
          <X :size="14" />
        </button>
      </div>
      <label class="flex flex-col gap-1 text-xs text-(--color-text-secondary)">
        显示名称
        <input v-model="form.name" class="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) outline-none focus:border-(--color-brand)" placeholder="如：我的 OSS" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-(--color-text-secondary)">
        S3 端点（http(s)://…）
        <input v-model="form.endpoint" class="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) outline-none focus:border-(--color-brand)" placeholder="https://s3.cn-beijing.aliyuncs.com" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-(--color-text-secondary)">
        Bucket
        <input v-model="form.bucket" class="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) outline-none focus:border-(--color-brand)" placeholder="my-bucket" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-(--color-text-secondary)">
        AccessKey
        <input v-model="form.accessKey" class="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) outline-none focus:border-(--color-brand)" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-(--color-text-secondary)">
        SecretKey{{ editingId ? '（留空 = 不修改）' : '' }}
        <input v-model="form.secretKey" type="password" class="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) outline-none focus:border-(--color-brand)" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-(--color-text-secondary)">
        基础前缀（可选，bucket 内子路径）
        <input v-model="form.basePrefix" class="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) outline-none focus:border-(--color-brand)" placeholder="如：backup" />
      </label>
      <label class="flex items-center gap-2 text-sm text-(--color-text)">
        <input v-model="form.enabled" type="checkbox" />
        启用
      </label>
      <div class="flex gap-2 pt-1">
        <button
          type="button"
          class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-(--color-border) py-2 text-sm text-(--color-text) hover:border-(--color-brand) transition-colors"
          :disabled="testing"
          @click="testConnection"
        >
          <PlugZap :size="14" />
          连接测试
        </button>
        <button
          type="button"
          class="flex flex-1 items-center justify-center rounded-lg bg-(--color-brand) py-2 text-sm text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          :disabled="saving"
          @click="save"
        >
          <LoaderCircle v-if="saving" :size="14" class="animate-spin" />
          <span v-else>保存</span>
        </button>
      </div>
    </div>
  </BaseModal>
</template>
