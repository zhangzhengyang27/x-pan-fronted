<script setup lang="ts">
/**
 * AppFileButtonGroup —— 操作按钮组
 * 8 个 button × visibility 标志位；视觉统一使用 BaseButton 圆角胶囊
 *
 * 通过 `selectedRows` prop 把页面层的多选对象数组显式注入到 ShareButton，
 * 避免子按钮依赖内部 store 状态出现"已选但报错"的同步问题。
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useBreakpoint } from '@/composables/useMediaQuery'
import { useFileStore } from '@/stores/file'
import UploadButton from '@/components/buttons/upload-button/index.vue'
import CreateFolderButton from '@/components/buttons/create-folder-button/index.vue'
import DownloadButton from '@/components/buttons/download-button/index.vue'
import DeleteButton from '@/components/buttons/delete-button/index.vue'
import RenameButton from '@/components/buttons/rename-button/index.vue'
import ShareButton from '@/components/buttons/share-button/index.vue'
import CopyButton from '@/components/buttons/copy-button/index.vue'
import TransferButton from '@/components/buttons/transfer-button/index.vue'

const props = defineProps({
  buttonArray: { type: Array, default: () => [] },
  /** 显式传入选中行数组；未提供时回退到 store 多选 */
  selectedRows: { type: Array, default: undefined }
})

const map = {
  upload: UploadButton,
  createFolder: CreateFolderButton,
  download: DownloadButton,
  delete: DeleteButton,
  rename: RenameButton,
  share: ShareButton,
  copy: CopyButton,
  transfer: TransferButton
}

const enabled = computed(() => new Set(props.buttonArray || []))
const { isMobile } = useBreakpoint()

// 默认从 Pinia store 读取多选（向后兼容老用法）
// 注意：必须用 storeToRefs 解构拿到 ref，否则 fileStore.multipleSelection 拿到的是
// ref 对象本身（不会被自动 unwrap），传给 ShareButton 会导致 `list = [ref]` →
// 过滤 fileId 后为空 → 误报"请选择要分享的文件"。
const fileStore = useFileStore()
const { multipleSelection } = storeToRefs(fileStore)
const fallbackSelected = computed<any[]>(() => multipleSelection.value || [])
const items = computed<any[]>(() =>
  Array.isArray(props.selectedRows) ? props.selectedRows : fallbackSelected.value
)
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <UploadButton v-if="enabled.has('upload')" :size="isMobile ? 'small' : 'default'" />
    <CreateFolderButton v-if="enabled.has('createFolder')" :size="isMobile ? 'small' : 'default'" />
    <DownloadButton v-if="enabled.has('download')" :size="isMobile ? 'small' : 'default'" />
    <!-- DeleteButton 显式接收选中行数组 -->
    <DeleteButton v-if="enabled.has('delete')" :size="isMobile ? 'small' : 'default'" :item="items" />
    <RenameButton v-if="enabled.has('rename')" :size="isMobile ? 'small' : 'default'" />
    <!-- ShareButton 显式接收选中行数组（这是修复点：保证无参点击也能拿到完整对象） -->
    <ShareButton v-if="enabled.has('share')" :size="isMobile ? 'small' : 'default'" :item="items" />
    <CopyButton v-if="enabled.has('copy')" :size="isMobile ? 'small' : 'default'" />
    <TransferButton v-if="enabled.has('transfer')" :size="isMobile ? 'small' : 'default'" />
  </div>
</template>