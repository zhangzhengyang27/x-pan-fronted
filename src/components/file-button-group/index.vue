<script setup>
/**
 * AppFileButtonGroup —— 操作按钮组
 * 8 个 button × visibility 标志位；视觉统一使用 BaseButton 圆角胶囊
 */
import { computed } from 'vue'
import UploadButton from '@/components/buttons/upload-button/index.vue'
import CreateFolderButton from '@/components/buttons/create-folder-button/index.vue'
import DownloadButton from '@/components/buttons/download-button/index.vue'
import DeleteButton from '@/components/buttons/delete-button/index.vue'
import RenameButton from '@/components/buttons/rename-button/index.vue'
import ShareButton from '@/components/buttons/share-button/index.vue'
import CopyButton from '@/components/buttons/copy-button/index.vue'
import TransferButton from '@/components/buttons/transfer-button/index.vue'

const props = defineProps({
  buttonArray: { type: Array, default: () => [] }
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
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <component
      v-for="(Cmp, key) in map"
      v-show="enabled.has(key)"
      :is="Cmp"
      :key="key"
      size="default"
    />
  </div>
</template>
