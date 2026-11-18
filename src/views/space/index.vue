<script setup lang="ts">
/**
 * SpacesPage —— 团队空间管理
 * 创建团队、成员与角色管理、邀请链接、空间配额、重命名/解散
 */
import { computed, onMounted, reactive, ref } from 'vue'
import {
  Users,
  Plus,
  Copy,
  Trash2,
  Link2,
  Crown,
  Shield,
  User as UserIcon,
  Eye,
  Loader2,
  X
} from '@lucide/vue'
import spaceService from '@/api/space'
import { useSpaceStore } from '@/stores/space'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import type { ISpaceInviteVO, ISpaceMemberVO, ISpaceVO } from '@/types'

const spaceStore = useSpaceStore()

const loading = ref(false)
const activeSpaceId = ref<string>('')
const members = ref<ISpaceMemberVO[]>([])
const invites = ref<ISpaceInviteVO[]>([])
const detailLoading = ref(false)

const createVisible = ref(false)
const createName = ref('')
const creating = ref(false)

const inviteVisible = ref(false)
const inviteExpireHours = ref(72)
const inviteMaxUses = ref(0)
const creatingInvite = ref(false)

const quotaVisible = ref(false)
const quotaGb = ref(100)
const savingQuota = ref(false)

const renameVisible = ref(false)
const renameName = ref('')
const renaming = ref(false)

const spaces = computed(() => spaceStore.spaces)
const activeSpace = computed<ISpaceVO | undefined>(() =>
  spaces.value.find((s) => s.spaceId === activeSpaceId.value)
)
const isOwner = computed(() => activeSpace.value?.role === 'OWNER')
const canManage = computed(
  () => activeSpace.value?.role === 'OWNER' || activeSpace.value?.role === 'ADMIN'
)
const isPersonal = computed(() => activeSpace.value?.spaceType === 'PERSONAL')

onMounted(async () => {
  await loadSpaces()
  const team = spaces.value.find((s) => s.spaceType === 'TEAM')
  if (team) selectSpace(team)
  else if (spaces.value[0]) selectSpace(spaces.value[0])
})

async function loadSpaces(): Promise<void> {
  loading.value = true
  await spaceStore.loadSpaces()
  loading.value = false
}

function selectSpace(space: ISpaceVO): void {
  activeSpaceId.value = space.spaceId
  if (space.spaceType === 'TEAM') {
    loadMembers(space.spaceId)
    loadInvites(space.spaceId)
  } else {
    members.value = []
    invites.value = []
  }
}

function loadMembers(spaceId: string): void {
  detailLoading.value = true
  spaceService.listMembers(
    spaceId,
    (res) => {
      members.value = res.data || []
      detailLoading.value = false
    },
    (res) => {
      ElMessage.error(res.message || '成员加载失败')
      detailLoading.value = false
    }
  )
}

function loadInvites(spaceId: string): void {
  spaceService.listInvites(
    spaceId,
    (res) => {
      invites.value = res.data || []
    },
    () => {
      invites.value = []
    }
  )
}

function formatSize(bytes?: number): string {
  const n = Number(bytes) || 0
  if (n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function roleLabel(role: string): string {
  return { OWNER: '所有者', ADMIN: '管理员', MEMBER: '成员', VIEWER: '只读' }[role] || role
}

function roleIcon(role: string) {
  return role === 'OWNER' ? Crown : role === 'ADMIN' ? Shield : role === 'VIEWER' ? Eye : UserIcon
}

function doCreateTeam(): void {
  const name = createName.value.trim()
  if (!name) return ElMessage.error('请输入空间名称')
  creating.value = true
  spaceService.createTeam(
    { spaceName: name },
    () => {
      creating.value = false
      createVisible.value = false
      createName.value = ''
      ElMessage.success('团队空间已创建')
      loadSpaces().then(() => {
        const created = spaces.value.find((s) => s.spaceName === name && s.spaceType === 'TEAM')
        if (created) selectSpace(created)
      })
    },
    (res) => {
      creating.value = false
      ElMessage.error(res.message || '创建失败')
    }
  )
}

function openInvite(): void {
  inviteExpireHours.value = 72
  inviteMaxUses.value = 0
  inviteVisible.value = true
}

function doCreateInvite(): void {
  if (!activeSpace.value) return
  creatingInvite.value = true
  spaceService.createInvite(
    activeSpace.value.spaceId,
    { expireHours: inviteExpireHours.value, maxUses: inviteMaxUses.value },
    () => {
      creatingInvite.value = false
      inviteVisible.value = false
      ElMessage.success('邀请链接已创建')
      if (activeSpace.value) loadInvites(activeSpace.value.spaceId)
    },
    (res) => {
      creatingInvite.value = false
      ElMessage.error(res.message || '创建邀请失败')
    }
  )
}

async function copyText(text: string, successMsg: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(successMsg)
  } catch {
    ElMessage.error(`复制失败，请手动复制：${text}`)
  }
}

async function copyInvite(code: string, url: string): Promise<void> {
  const link = url || `${window.location.origin}/join?code=${code}`
  await copyText(link, '邀请链接已复制')
}

async function copyAppInvite(code: string): Promise<void> {
  await copyText(`xpan://join?code=${code}`, 'App 邀请链接已复制')
}

function revokeInvite(invite: ISpaceInviteVO): void {
  if (!activeSpace.value) return
  ElMessageBox.confirm('撤销后该邀请链接将立即失效，确定撤销？', '撤销邀请', {
    confirmButtonText: '撤销',
    cancelButtonText: '取消',
    type: 'warning'
  }).then((ok) => {
    if (!ok || !activeSpace.value) return
    spaceService.revokeInvite(
      activeSpace.value.spaceId,
      invite.id,
      () => {
        ElMessage.success('已撤销')
        if (activeSpace.value) loadInvites(activeSpace.value.spaceId)
      },
      (res) => ElMessage.error(res.message || '撤销失败')
    )
  })
}

function changeRole(member: ISpaceMemberVO, role: string): void {
  if (!activeSpace.value) return
  spaceService.updateMemberRole(
    activeSpace.value.spaceId,
    member.userId,
    { role },
    () => {
      member.role = role
      ElMessage.success('角色已更新')
    },
    (res) => ElMessage.error(res.message || '修改失败')
  )
}

function removeMember(member: ISpaceMemberVO): void {
  if (!activeSpace.value) return
  ElMessageBox.confirm(`确定将 ${member.username} 移出空间？`, '移除成员', {
    confirmButtonText: '移除',
    cancelButtonText: '取消',
    type: 'warning'
  }).then((ok) => {
    if (!ok || !activeSpace.value) return
    spaceService.removeMember(
      activeSpace.value.spaceId,
      member.userId,
      () => {
        ElMessage.success('已移除')
        if (activeSpace.value) loadMembers(activeSpace.value.spaceId)
      },
      (res) => ElMessage.error(res.message || '操作失败')
    )
  })
}

function openRename(): void {
  renameName.value = activeSpace.value?.spaceName || ''
  renameVisible.value = true
}

function doRename(): void {
  const name = renameName.value.trim()
  if (!name || !activeSpace.value) return ElMessage.error('请输入空间名称')
  renaming.value = true
  spaceService.rename(
    activeSpace.value.spaceId,
    { spaceName: name },
    () => {
      renaming.value = false
      renameVisible.value = false
      ElMessage.success('已重命名')
      loadSpaces()
    },
    (res) => {
      renaming.value = false
      ElMessage.error(res.message || '重命名失败')
    }
  )
}

function openQuota(): void {
  quotaGb.value = Math.max(1, Math.round((activeSpace.value?.totalSize || 0) / 1024 / 1024 / 1024))
  quotaVisible.value = true
}

function doUpdateQuota(): void {
  if (!activeSpace.value) return
  const totalSize = Math.floor(quotaGb.value * 1024 * 1024 * 1024)
  if (totalSize <= 0) return ElMessage.error('请输入有效容量')
  savingQuota.value = true
  spaceService.updateQuota(
    activeSpace.value.spaceId,
    { totalSize },
    () => {
      savingQuota.value = false
      quotaVisible.value = false
      ElMessage.success('容量已调整')
      loadSpaces()
    },
    (res) => {
      savingQuota.value = false
      ElMessage.error(res.message || '调整失败')
    }
  )
}

function dissolve(): void {
  if (!activeSpace.value) return
  ElMessageBox.confirm(
    '解散后空间将不可访问，且必须已清空全部文件。确定解散？',
    '解散团队空间',
    { confirmButtonText: '解散', cancelButtonText: '取消', type: 'warning' }
  ).then((ok) => {
    if (!ok || !activeSpace.value) return
    spaceService.dissolve(
      activeSpace.value.spaceId,
      () => {
        ElMessage.success('空间已解散')
        activeSpaceId.value = ''
        loadSpaces().then(() => {
          if (spaces.value[0]) selectSpace(spaces.value[0])
        })
      },
      (res) => ElMessage.error(res.message || '解散失败')
    )
  })
}

function usedPercent(space: ISpaceVO): number {
  if (!space.totalSize) return 0
  return Math.min(100, (Number(space.usedSize) / Number(space.totalSize)) * 100)
}
</script>

<template>
  <div class="h-full overflow-y-auto p-4 sm:p-6">
    <div class="max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-5">
        <div>
          <h1 class="text-xl font-semibold text-(--color-text)">团队空间</h1>
          <p class="text-xs mt-1 text-(--color-text-muted)">与团队成员共享文件，独立容量与权限管理</p>
        </div>
        <button
          type="button"
          class="flex items-center gap-1.5 h-9 px-3.5 rounded-sm text-sm font-medium text-white"
          style="background-color: var(--color-primary-500)"
          @click="createVisible = true"
        >
          <Plus :size="15" :stroke-width="2" />
          创建团队空间
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <!-- 空间列表 -->
        <div class="space-y-2">
          <div v-if="loading" class="text-xs text-(--color-text-muted) p-3">加载中…</div>
          <button
            v-for="space in spaces"
            :key="space.spaceId"
            type="button"
            class="w-full text-left p-3 rounded-sm border transition-colors"
            :style="{
              borderColor: activeSpaceId === space.spaceId ? 'var(--color-primary-500)' : 'var(--color-border)',
              backgroundColor: 'var(--color-surface)'
            }"
            @click="selectSpace(space)"
          >
            <div class="flex items-center gap-2">
              <Users v-if="space.spaceType === 'TEAM'" :size="15" :stroke-width="1.75" />
              <UserIcon v-else :size="15" :stroke-width="1.75" />
              <span class="text-sm font-medium truncate text-(--color-text)">
                {{ space.spaceType === 'PERSONAL' ? '个人空间' : space.spaceName }}
              </span>
              <span class="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-(--color-fill) text-(--color-text-muted)">
                {{ roleLabel(space.role) }}
              </span>
            </div>
            <div class="mt-2 h-1 rounded-full overflow-hidden bg-(--color-fill)">
              <div class="h-full rounded-full" :style="{ width: usedPercent(space) + '%', backgroundColor: 'var(--color-primary-500)' }" />
            </div>
            <div class="mt-1.5 text-[11px] text-(--color-text-muted)">
              {{ formatSize(space.usedSize) }} / {{ formatSize(space.totalSize) }}
              <template v-if="space.spaceType === 'TEAM'"> · {{ space.memberCount }} 名成员</template>
            </div>
          </button>
        </div>

        <!-- 详情 -->
        <div v-if="activeSpace" class="rounded-sm border border-(--color-border) bg-(--color-surface)">
          <div class="flex flex-wrap items-center gap-2 p-4 border-b border-(--color-border)">
            <div class="min-w-0">
              <div class="text-base font-semibold truncate text-(--color-text)">
                {{ activeSpace.spaceType === 'PERSONAL' ? '个人空间' : activeSpace.spaceName }}
              </div>
              <div class="text-[11px] mt-0.5 text-(--color-text-muted)">
                <template v-if="isPersonal">仅自己可见</template>
                <template v-else>所有者 {{ activeSpace.ownerUsername }} · {{ activeSpace.memberCount }} 名成员</template>
              </div>
            </div>
            <div class="ml-auto flex items-center gap-2">
              <template v-if="!isPersonal">
                <button
                  v-if="canManage"
                  type="button"
                  class="flex items-center gap-1 h-8 px-2.5 rounded-sm text-xs border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-hover)"
                  @click="openInvite"
                >
                  <Link2 :size="13" :stroke-width="1.75" />
                  邀请成员
                </button>
                <button
                  v-if="isOwner"
                  type="button"
                  class="h-8 px-2.5 rounded-sm text-xs border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-hover)"
                  @click="openQuota"
                >
                  调整容量
                </button>
                <button
                  v-if="isOwner"
                  type="button"
                  class="h-8 px-2.5 rounded-sm text-xs border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-hover)"
                  @click="openRename"
                >
                  重命名
                </button>
                <button
                  v-if="isOwner"
                  type="button"
                  class="h-8 px-2.5 rounded-sm text-xs border border-(--color-border) hover:bg-(--color-hover)"
                  style="color: var(--color-danger)"
                  @click="dissolve"
                >
                  解散
                </button>
              </template>
            </div>
          </div>

          <div v-if="isPersonal" class="p-6 text-sm text-(--color-text-secondary)">
            个人空间用于存放仅自己可见的文件。切换到团队空间即可与成员协作。
          </div>

          <template v-else>
            <!-- 成员 -->
            <div class="p-4">
              <div class="flex items-center gap-2 mb-3">
                <Users :size="15" :stroke-width="1.75" class="text-(--color-text-secondary)" />
                <span class="text-sm font-medium text-(--color-text)">成员</span>
                <span class="text-[11px] text-(--color-text-muted)">{{ members.length }}</span>
              </div>
              <div v-if="detailLoading" class="text-xs text-(--color-text-muted) py-3">加载中…</div>
              <div v-else class="divide-y divide-(--color-border) border border-(--color-border) rounded-sm">
                <div v-for="member in members" :key="member.userId" class="flex items-center gap-2.5 px-3 py-2.5">
                  <div class="size-7 rounded-full flex items-center justify-center bg-(--color-fill)">
                    <component :is="roleIcon(member.role)" :size="14" :stroke-width="1.75" />
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm truncate text-(--color-text)">{{ member.username }}</div>
                    <div class="text-[11px] text-(--color-text-muted)">{{ roleLabel(member.role) }}</div>
                  </div>
                  <div v-if="canManage && member.role !== 'OWNER'" class="ml-auto flex items-center gap-1.5">
                    <select
                      class="h-7 px-2 rounded-sm text-xs border border-(--color-border) bg-(--color-surface) text-(--color-text)"
                      :value="member.role"
                      @change="changeRole(member, ($event.target as HTMLSelectElement).value)"
                    >
                      <option value="ADMIN">管理员</option>
                      <option value="MEMBER">成员</option>
                      <option value="VIEWER">只读</option>
                    </select>
                    <button
                      type="button"
                      class="size-7 rounded-sm flex items-center justify-center hover:bg-(--color-hover)"
                      style="color: var(--color-danger)"
                      title="移除成员"
                      @click="removeMember(member)"
                    >
                      <Trash2 :size="14" :stroke-width="1.75" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 邀请 -->
            <div class="p-4 pt-0">
              <div class="flex items-center gap-2 mb-3">
                <Link2 :size="15" :stroke-width="1.75" class="text-(--color-text-secondary)" />
                <span class="text-sm font-medium text-(--color-text)">有效邀请</span>
              </div>
              <div v-if="!invites.length" class="text-xs text-(--color-text-muted) py-2">
                暂无有效邀请，点击右上角"邀请成员"创建。
              </div>
              <div v-else class="divide-y divide-(--color-border) border border-(--color-border) rounded-sm">
                <div v-for="invite in invites" :key="invite.id" class="flex items-center gap-3 px-3 py-2.5">
                  <div class="min-w-0">
                    <div class="text-xs font-mono text-(--color-text)">{{ invite.inviteCode }}</div>
                    <div class="text-[11px] text-(--color-text-muted)">
                      {{ invite.expireTime ? '到期 ' + new Date(invite.expireTime).toLocaleString() : '永久有效' }}
                      · 已用 {{ invite.usedCount }}{{ invite.maxUses ? '/' + invite.maxUses : '' }} 次
                    </div>
                  </div>
                  <div class="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      class="h-7 px-2 rounded-sm text-xs border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-hover)"
                      @click="copyInvite(invite.inviteCode, invite.inviteUrl)"
                    >
                      <Copy :size="12" :stroke-width="1.75" class="inline mr-1" />复制链接
                    </button>
                    <button
                      type="button"
                      class="h-7 px-2 rounded-sm text-xs border border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-hover)"
                      title="复制移动端 App 深链"
                      @click="copyAppInvite(invite.inviteCode)"
                    >
                      App 链接
                    </button>
                    <button
                      v-if="canManage"
                      type="button"
                      class="size-7 rounded-sm flex items-center justify-center hover:bg-(--color-hover)"
                      style="color: var(--color-danger)"
                      title="撤销"
                      @click="revokeInvite(invite)"
                    >
                      <X :size="14" :stroke-width="1.75" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 创建团队 -->
    <div v-if="createVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="createVisible = false">
      <div class="w-full max-w-sm rounded-sm bg-(--color-surface) border border-(--color-border) p-5">
        <h2 class="text-base font-semibold mb-4 text-(--color-text)">创建团队空间</h2>
        <input
          v-model="createName"
          maxlength="32"
          placeholder="空间名称（最多 32 字）"
          class="w-full h-9 px-3 text-sm rounded-sm border border-(--color-border) bg-(--color-surface) text-(--color-text) focus:outline-none focus:border-(--color-border-focus)"
          @keyup.enter="doCreateTeam"
        />
        <div class="flex justify-end gap-2 mt-5">
          <button type="button" class="h-8 px-3 rounded-sm text-xs border border-(--color-border) text-(--color-text-secondary)" @click="createVisible = false">取消</button>
          <button type="button" class="h-8 px-3 rounded-sm text-xs text-white inline-flex items-center gap-1" style="background-color: var(--color-primary-500)" @click="doCreateTeam">
            <Loader2 v-if="creating" :size="13" class="animate-spin" />
            创建
          </button>
        </div>
      </div>
    </div>

    <!-- 创建邀请 -->
    <div v-if="inviteVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="inviteVisible = false">
      <div class="w-full max-w-sm rounded-sm bg-(--color-surface) border border-(--color-border) p-5">
        <h2 class="text-base font-semibold mb-4 text-(--color-text)">邀请成员</h2>
        <label class="block text-xs mb-1.5 text-(--color-text-secondary)">有效期</label>
        <select v-model.number="inviteExpireHours" class="w-full h-9 px-2 mb-3 text-sm rounded-sm border border-(--color-border) bg-(--color-surface) text-(--color-text)">
          <option :value="24">24 小时</option>
          <option :value="72">3 天</option>
          <option :value="168">7 天</option>
          <option :value="0">永久有效</option>
        </select>
        <label class="block text-xs mb-1.5 text-(--color-text-secondary)">最大使用次数（0 = 不限）</label>
        <input v-model.number="inviteMaxUses" type="number" min="0" class="w-full h-9 px-3 text-sm rounded-sm border border-(--color-border) bg-(--color-surface) text-(--color-text)" />
        <div class="flex justify-end gap-2 mt-5">
          <button type="button" class="h-8 px-3 rounded-sm text-xs border border-(--color-border) text-(--color-text-secondary)" @click="inviteVisible = false">取消</button>
          <button type="button" class="h-8 px-3 rounded-sm text-xs text-white inline-flex items-center gap-1" style="background-color: var(--color-primary-500)" @click="doCreateInvite">
            <Loader2 v-if="creatingInvite" :size="13" class="animate-spin" />
            生成链接
          </button>
        </div>
      </div>
    </div>

    <!-- 调整容量 -->
    <div v-if="quotaVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="quotaVisible = false">
      <div class="w-full max-w-sm rounded-sm bg-(--color-surface) border border-(--color-border) p-5">
        <h2 class="text-base font-semibold mb-4 text-(--color-text)">调整空间容量</h2>
        <label class="block text-xs mb-1.5 text-(--color-text-secondary)">总容量（GB，最大 10240 GB）</label>
        <input v-model.number="quotaGb" type="number" min="1" max="10240" class="w-full h-9 px-3 text-sm rounded-sm border border-(--color-border) bg-(--color-surface) text-(--color-text)" />
        <div class="flex justify-end gap-2 mt-5">
          <button type="button" class="h-8 px-3 rounded-sm text-xs border border-(--color-border) text-(--color-text-secondary)" @click="quotaVisible = false">取消</button>
          <button type="button" class="h-8 px-3 rounded-sm text-xs text-white inline-flex items-center gap-1" style="background-color: var(--color-primary-500)" @click="doUpdateQuota">
            <Loader2 v-if="savingQuota" :size="13" class="animate-spin" />
            保存
          </button>
        </div>
      </div>
    </div>

    <!-- 重命名 -->
    <div v-if="renameVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="renameVisible = false">
      <div class="w-full max-w-sm rounded-sm bg-(--color-surface) border border-(--color-border) p-5">
        <h2 class="text-base font-semibold mb-4 text-(--color-text)">重命名空间</h2>
        <input v-model="renameName" maxlength="32" class="w-full h-9 px-3 text-sm rounded-sm border border-(--color-border) bg-(--color-surface) text-(--color-text) focus:outline-none focus:border-(--color-border-focus)" @keyup.enter="doRename" />
        <div class="flex justify-end gap-2 mt-5">
          <button type="button" class="h-8 px-3 rounded-sm text-xs border border-(--color-border) text-(--color-text-secondary)" @click="renameVisible = false">取消</button>
          <button type="button" class="h-8 px-3 rounded-sm text-xs text-white inline-flex items-center gap-1" style="background-color: var(--color-primary-500)" @click="doRename">
            <Loader2 v-if="renaming" :size="13" class="animate-spin" />
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
