<script setup lang="ts">
/**
 * DeviceManagerDialog —— 设备管理弹窗（P3-5 UI 骨架 + Mock）
 *
 * 展示当前账号登录的设备列表，支持远程下线非当前设备。
 * 数据来源：api/device/index.ts（当前 Mock，后端就绪后自动生效）
 */
import { ref, watch } from 'vue'
import { Monitor, Smartphone, LogOut, LoaderCircle, X, MapPin, Clock } from '@lucide/vue'
import deviceService, { type DeviceInfo } from '@/api/device'
import { ElMessage, ElMessageBox } from '@/composables/useToast'

const props = defineProps({
  open: { type: Boolean, default: false }
})
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const loading = ref(false)
const devices = ref<DeviceInfo[]>([])

watch(
  () => props.open,
  (v) => {
    if (v) loadDevices()
  }
)

function loadDevices() {
  loading.value = true
  deviceService.list(
    (res) => {
      devices.value = res.data || []
      loading.value = false
    },
    () => {
      loading.value = false
      ElMessage.error('加载设备列表失败')
    }
  )
}

function deviceIcon(d: DeviceInfo) {
  return d.os?.toLowerCase().includes('ios') || d.os?.toLowerCase().includes('android')
    ? Smartphone
    : Monitor
}

function logout(d: DeviceInfo) {
  ElMessageBox.confirm(`确定要下线"${d.deviceName}"吗？该设备将被强制退出登录。`, '远程下线', {
    confirmButtonText: '下线',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      deviceService.logout(
        d.deviceId,
        () => {
          ElMessage.success('已下线该设备')
          loadDevices()
        },
        () => ElMessage.error('操作失败')
      )
    })
    .catch(() => {})
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="close"
      >
        <div class="w-[560px] max-w-[90vw] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
          <!-- 头部 -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <h3 class="text-base font-medium text-[var(--color-text)]">设备管理</h3>
            <button
              class="p-1.5 rounded-md hover:bg-[var(--color-surface-container-low)] text-[var(--color-text-muted)]"
              @click="close"
            >
              <X :size="16" />
            </button>
          </div>

          <!-- 内容区 -->
          <div class="px-5 py-4">
            <p class="text-xs text-[var(--color-text-muted)] mb-4">
              以下是当前账号登录的设备，如发现陌生设备请立即下线并修改密码。
            </p>

            <!-- 加载中 -->
            <div v-if="loading" class="flex items-center justify-center py-12">
              <LoaderCircle :size="24" class="animate-spin text-[var(--color-primary-500)]" />
            </div>

            <!-- 设备列表 -->
            <div v-else class="space-y-2">
              <div
                v-for="d in devices"
                :key="d.deviceId"
                class="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-container-low)]"
              >
                <div
                  class="size-10 rounded-lg flex items-center justify-center shrink-0"
                  :style="d.isCurrent ? 'background: rgba(34, 197, 94, 0.1);' : 'background: var(--color-surface-container-low);'"
                >
                  <component
                    :is="deviceIcon(d)"
                    :size="20"
                    :class="d.isCurrent ? 'text-green-500' : 'text-[var(--color-text-muted)]'"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-[var(--color-text)]">{{ d.deviceName }}</span>
                    <span
                      v-if="d.isCurrent"
                      class="px-1.5 py-0.5 rounded text-[10px] font-medium text-green-600"
                      style="background: rgba(34, 197, 94, 0.1);"
                    >
                      当前设备
                    </span>
                  </div>
                  <div class="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-muted)]">
                    <span>{{ d.browser }} · {{ d.os }}</span>
                  </div>
                  <div class="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-muted)]">
                    <span class="flex items-center gap-1">
                      <MapPin :size="11" />
                      {{ d.location }} ({{ d.ip }})
                    </span>
                    <span class="flex items-center gap-1">
                      <Clock :size="11" />
                      {{ d.lastLoginTime }}
                    </span>
                  </div>
                </div>
                <button
                  v-if="!d.isCurrent"
                  class="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0"
                  @click="logout(d)"
                >
                  <LogOut :size="12" />
                  下线
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
