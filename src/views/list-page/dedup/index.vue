<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Layers, FileX2, HardDrive, Trash2, RotateCcw, Folder, Check } from '@lucide/vue'
import dedupService, { type IDedupGroupVO, type IDedupItemVO, type IDedupStatVO } from '@/api/dedup'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import BaseButton from '@/components/base/BaseButton.vue'

const loading = ref(true)
const groups = ref<IDedupGroupVO[]>([])
const stat = ref<IDedupStatVO | null>(null)
const keepMap = ref<Record<string, string>>({})

function formatSize(bytes: number) {
  if (!bytes || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`
}

function load() {
  loading.value = true
  dedupService.list(
    (res) => {
      groups.value = res.data || []
      const map: Record<string, string> = {}
      groups.value.forEach((g) => {
        if (g.items && g.items.length > 0) map[String(g.realFileId)] = g.items[0].fileId
      })
      keepMap.value = map
      loading.value = false
    },
    (err) => {
      loading.value = false
      ElMessage.error(err.message || '加载失败')
    }
  )
  dedupService.stat(
    (res) => { stat.value = res.data },
    () => {}
  )
}

function selectKeep(group: IDedupGroupVO, item: IDedupItemVO) {
  keepMap.value[String(group.realFileId)] = item.fileId
}
function isKeep(group: IDedupGroupVO, item: IDedupItemVO) {
  return keepMap.value[String(group.realFileId)] === item.fileId
}

function onRelease() {
  if (groups.value.length === 0) return
  const keepIds = Object.values(keepMap.value).filter(Boolean)
  if (keepIds.length === 0) {
    ElMessage.error('请至少为每组选择一个保留文件')
    return
  }
  ElMessageBox.confirm(
    `将对 ${groups.value.length} 组重复文件释放冗余引用，每组仅保留勾选文件，其余重复引用将被删除。确定继续？`,
    '释放冗余空间',
    { confirmButtonText: '确认释放', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    dedupService.release(
      keepIds,
      () => { ElMessage.success('释放成功'); load() },
      (err) => ElMessage.error(err.message || '释放失败')
    )
  }).catch(() => {})
}

function fileIcon(t: number) { return t === 0 ? Folder : FileX2 }

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-4 px-4 py-3 h-full">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <Layers :size="16" class="text-primary-500" />
        <span class="text-sm font-medium text-(--color-text)">文件去重</span>
        <span class="text-xs text-(--color-text-muted)">找出重复文件，释放冗余占用</span>
      </div>
      <div class="flex items-center gap-2">
        <BaseButton variant="ghost" size="sm" @click="load">
          <RotateCcw :size="14" />
          刷新
        </BaseButton>
        <BaseButton variant="primary" size="sm" :disabled="groups.length === 0" @click="onRelease">
          <Trash2 :size="14" />
          释放冗余
        </BaseButton>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="rounded-xl border border-(--color-border)/60 bg-(--color-surface) p-4">
        <div class="flex items-center gap-2 text-(--color-text-muted) mb-1"><Layers :size="15" /><span class="text-xs">重复分组</span></div>
        <p class="text-2xl font-semibold tabular-nums">{{ stat?.groupCount ?? '—' }} <span class="text-xs font-normal text-(--color-text-muted)">组</span></p>
      </div>
      <div class="rounded-xl border border-(--color-border)/60 bg-(--color-surface) p-4">
        <div class="flex items-center gap-2 text-(--color-text-muted) mb-1"><FileX2 :size="15" /><span class="text-xs">冗余引用</span></div>
        <p class="text-2xl font-semibold tabular-nums">{{ stat?.redundantCount ?? '—' }} <span class="text-xs font-normal text-(--color-text-muted)">份</span></p>
      </div>
      <div class="rounded-xl border border-(--color-border)/60 bg-(--color-surface) p-4">
        <div class="flex items-center gap-2 text-(--color-text-muted) mb-1"><HardDrive :size="15" /><span class="text-xs">可释放空间</span></div>
        <p class="text-2xl font-semibold tabular-nums">{{ stat?.releasableDesc || formatSize(stat?.releasableBytes || 0) }}</p>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-sm text-(--color-text-muted)">加载中...</div>
    <div v-else-if="groups.length === 0" class="flex-1 flex flex-col items-center justify-center gap-2 text-(--color-text-muted)">
      <Layers :size="40" :stroke-width="1.2" />
      <p class="text-sm">太棒了，没有发现重复文件</p>
    </div>
    <div v-else class="flex-1 min-h-0 overflow-y-auto space-y-3">
      <div v-for="(group, gi) in groups" :key="String(group.realFileId)" class="rounded-xl border border-(--color-border)/60 bg-(--color-surface) overflow-hidden">
        <div class="flex items-center justify-between px-4 py-2.5 bg-(--color-surface-2)/60 border-b border-(--color-border)/50">
          <div class="flex items-center gap-2 text-sm">
            <span class="font-medium text-(--color-text)">第 {{ gi + 1 }} 组</span>
            <span class="text-xs text-(--color-text-muted)">{{ group.refCount }} 份引用 · {{ group.fileSizeDesc }} / 份</span>
          </div>
          <span class="text-xs font-medium text-(--color-text-secondary)">可释放 {{ formatSize(group.releasableBytes) }}</span>
        </div>
        <div class="p-2">
          <div
            v-for="item in group.items"
            :key="item.fileId"
            class="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-(--color-surface-2)/60"
            @click="selectKeep(group, item)"
          >
            <span class="flex size-5 shrink-0 rounded-md border items-center justify-center"
              :class="isKeep(group, item) ? 'bg-primary-500 border-primary-500' : 'border-(--color-border-strong)'">
              <Check v-if="isKeep(group, item)" :size="13" class="text-white" />
            </span>
            <component :is="fileIcon((item as any).fileType)" :size="16" :stroke-width="1.75" class="text-(--color-text-secondary)" />
            <span class="truncate text-sm text-(--color-text)">{{ item.filename }}</span>
            <span class="ml-auto text-[11px] shrink-0" :class="isKeep(group, item) ? 'text-primary-500' : 'text-(--color-text-muted)'">
              {{ isKeep(group, item) ? '保留' : '将释放' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
