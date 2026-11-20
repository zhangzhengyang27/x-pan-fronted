<script setup lang="ts">
/**
 * AclPanel —— 团队空间用户组与目录级 ACL 管理。
 *
 * 设计取舍：
 * - 用户组只作为 ACL 主体容器，不参与空间角色；OWNER/ADMIN 仍由空间成员体系管理。
 * - 目录授权按“最近一层有 ACL 的目录”生效，子目录可再次覆盖，避免全空间一刀切。
 * - 管理入口只对 OWNER/ADMIN 展示；后端接口仍会二次校验，前端显隐不作为授权依据。
 */
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, FolderLock, Plus, Trash2, UserPlus, X, Users } from '@lucide/vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import { spaceAclService } from '@/api/space'
import { ElMessage, ElMessageBox } from '@/composables/useToast'
import type {
  IFolderTreeNode,
  ISpaceAclVO,
  ISpaceGroupVO,
  ISpaceMemberVO
} from '@/types'

const props = defineProps<{
  open: boolean
  spaceId: string
  members: ISpaceMemberVO[]
}>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const groups = ref<ISpaceGroupVO[]>([])
const acls = ref<ISpaceAclVO[]>([])
const aclTotal = ref(0)
const aclPage = ref(1)
const aclPageSize = 20
const folderOptions = ref<Array<{ label: string; value: string }>>([])
const loading = ref(false)

const newGroupName = ref('')
const creatingGroup = ref(false)

const activeGroupId = ref('')
const addMemberId = ref('')
const selectedFolderId = ref('')
/** 列表过滤目录，与“新增授权”选择互不影响 */
const aclFolderFilter = ref('')
const subjectType = ref<'USER' | 'GROUP'>('USER')
const subjectId = ref('')
const permission = ref<'READ' | 'WRITE'>('READ')
const savingAcl = ref(false)

const activeGroup = computed(() => groups.value.find((g) => g.groupId === activeGroupId.value))
const userOptions = computed(() => props.members.map((m) => ({ label: m.username, value: m.userId })))
const groupOptions = computed(() => groups.value.map((g) => ({ label: g.groupName, value: g.groupId })))
const subjectOptions = computed(() => (subjectType.value === 'USER' ? userOptions.value : groupOptions.value))
const addableMembers = computed(() => {
  const current = activeGroup.value?.members.map((m) => m.userId) || []
  return userOptions.value.filter((o) => !current.includes(o.value))
})

watch(
  () => props.open,
  (open) => {
    if (open) {
      loadAll()
    } else {
      resetState()
    }
  }
)

function resetState(): void {
  newGroupName.value = ''
  activeGroupId.value = ''
  addMemberId.value = ''
  selectedFolderId.value = ''
  aclFolderFilter.value = ''
  subjectType.value = 'USER'
  subjectId.value = ''
  permission.value = 'READ'
  aclPage.value = 1
  aclTotal.value = 0
}

watch(aclFolderFilter, () => {
  aclPage.value = 1
  loadAcls(1)
})

async function loadAll(): Promise<void> {
  if (!props.spaceId) return
  loading.value = true
  try {
    await Promise.all([loadGroups(), loadAcls(), loadFolders()])
  } finally {
    loading.value = false
  }
}

function loadGroups(): Promise<void> {
  return new Promise((resolve, reject) => {
    spaceAclService.listGroups(
      props.spaceId,
      (res) => {
        groups.value = res.data || []
        if (!activeGroupId.value && groups.value.length > 0) {
          activeGroupId.value = groups.value[0]?.groupId || ''
        }
        resolve()
      },
      (err) => {
        ElMessage.error(err.message || '用户组加载失败')
        reject(err)
      }
    )
  })
}

function loadAcls(targetPage = aclPage.value): Promise<void> {
  return new Promise((resolve, reject) => {
    spaceAclService.listAcls(
      props.spaceId,
      {
        folderId: aclFolderFilter.value || undefined,
        page: targetPage,
        pageSize: aclPageSize
      },
      (res) => {
        const page = res.data
        acls.value = page?.records || []
        aclTotal.value = page?.total || 0
        aclPage.value = page?.pageNum || targetPage
        // 删除最后一条后当前页会空，自动回退上一页而不是停在空列表
        if (acls.value.length === 0 && aclPage.value > 1 && aclTotal.value > 0) {
          void loadAcls(aclPage.value - 1)
        }
        resolve()
      },
      (err) => {
        ElMessage.error(err.message || '目录权限加载失败')
        reject(err)
      }
    )
  })
}

function loadFolders(): Promise<void> {
  return new Promise((resolve, reject) => {
    spaceAclService.listFolders(
      props.spaceId,
      (res) => {
        folderOptions.value = flattenFolders(res.data || [])
        resolve()
      },
      (err) => {
        ElMessage.error(err.message || '文件夹加载失败')
        reject(err)
      }
    )
  })
}

/** 把树拍平成带缩进的下拉选项；根目录由后端返回的真实文件夹节点表达。 */
function flattenFolders(nodes: IFolderTreeNode[], depth = 0): Array<{ label: string; value: string }> {
  const result: Array<{ label: string; value: string }> = []
  for (const node of nodes) {
    result.push({
      label: `${'　'.repeat(depth)}${node.label || '未命名'}`,
      value: String(node.id)
    })
    if (node.children?.length) {
      result.push(...flattenFolders(node.children, depth + 1))
    }
  }
  return result
}

function createGroup(): void {
  const name = newGroupName.value.trim()
  if (!name) return ElMessage.error('请输入用户组名称')
  creatingGroup.value = true
  spaceAclService.createGroup(
    props.spaceId,
    { groupName: name },
    (res) => {
      creatingGroup.value = false
      newGroupName.value = ''
      const created = res.data
      if (created) activeGroupId.value = created.groupId
      ElMessage.success('用户组已创建')
      loadGroups()
    },
    (err) => {
      creatingGroup.value = false
      ElMessage.error(err.message || '创建用户组失败')
    }
  )
}

async function deleteGroup(group: ISpaceGroupVO): Promise<void> {
  const ok = await ElMessageBox.confirm(
    `删除用户组“${group.groupName}”会同时移除该组的所有目录授权，确定继续？`,
    '删除用户组',
    { type: 'danger' }
  )
  if (!ok) return
  spaceAclService.deleteGroup(
    props.spaceId,
    group.groupId,
    () => {
      ElMessage.success('用户组已删除')
      if (activeGroupId.value === group.groupId) activeGroupId.value = ''
      loadGroups()
      loadAcls()
    },
    (err) => ElMessage.error(err.message || '删除用户组失败')
  )
}

function addMember(): void {
  const group = activeGroup.value
  if (!group) return
  if (!addMemberId.value) return ElMessage.error('请选择要加入的成员')
  spaceAclService.addGroupMembers(
    props.spaceId,
    group.groupId,
    [addMemberId.value],
    () => {
      addMemberId.value = ''
      ElMessage.success('成员已加入用户组')
      loadGroups()
    },
    (err) => ElMessage.error(err.message || '添加成员失败')
  )
}

function removeMember(userId: string): void {
  const group = activeGroup.value
  if (!group) return
  spaceAclService.removeGroupMembers(
    props.spaceId,
    group.groupId,
    [userId],
    () => {
      ElMessage.success('成员已移出用户组')
      loadGroups()
    },
    (err) => ElMessage.error(err.message || '移除成员失败')
  )
}

function saveAcl(): void {
  if (!selectedFolderId.value) return ElMessage.error('请选择目录')
  if (!subjectId.value) return ElMessage.error('请选择授权主体')
  savingAcl.value = true
  spaceAclService.saveAcl(
    props.spaceId,
    {
      folderId: selectedFolderId.value,
      subjectType: subjectType.value,
      subjectId: subjectId.value,
      permission: permission.value
    },
    () => {
      savingAcl.value = false
      ElMessage.success('目录授权已保存')
      loadAcls()
    },
    (err) => {
      savingAcl.value = false
      ElMessage.error(err.message || '保存目录授权失败')
    }
  )
}

async function deleteAcl(acl: ISpaceAclVO): Promise<void> {
  const ok = await ElMessageBox.confirm(
    `确定移除“${acl.folderName || acl.folderPath || '该目录'}”对 ${acl.subjectName || acl.subjectId} 的授权？`,
    '移除授权',
    { type: 'danger' }
  )
  if (!ok) return
  spaceAclService.deleteAcl(
    props.spaceId,
    acl.id,
    () => {
      ElMessage.success('授权已移除')
      loadAcls()
    },
    (err) => ElMessage.error(err.message || '移除授权失败')
  )
}

function goAclPage(target: number): void {
  const totalPages = Math.max(1, Math.ceil(aclTotal.value / aclPageSize))
  if (target < 1 || target > totalPages || target === aclPage.value) return
  loadAcls(target)
}

function close(): void {
  emit('update:open', false)
}

function subjectLabel(acl: ISpaceAclVO): string {
  const name = acl.subjectName || acl.subjectId
  return `${acl.subjectType === 'GROUP' ? '用户组' : '成员'} · ${name}`
}

function permissionLabel(value: string): string {
  return value === 'WRITE' ? '读写' : '只读'
}
</script>

<template>
  <BaseModal
    :open="open"
    title="用户组与目录权限"
    size="xl"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="loading" class="py-10 text-center text-sm text-(--color-text-muted)">加载中...</div>
    <div v-else class="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <!-- 用户组 -->
      <section class="rounded-sm border border-(--color-border) p-4">
        <div class="mb-3 flex items-center gap-2">
          <Users :size="16" class="text-primary-500" />
          <h4 class="text-sm font-medium text-(--color-text)">用户组</h4>
        </div>
        <div class="flex gap-2">
          <BaseInput v-model="newGroupName" placeholder="新用户组名称" @keydown.enter="createGroup" />
          <BaseButton variant="primary" size="sm" :loading="creatingGroup" @click="createGroup">
            <Plus :size="14" class="mr-1" />新建
          </BaseButton>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="group in groups"
            :key="group.groupId"
            class="flex items-center gap-1 rounded-sm border px-2 py-1 text-xs"
            :class="
              group.groupId === activeGroupId
                ? 'border-primary-500 text-primary-600 bg-primary-50'
                : 'border-(--color-border) text-(--color-text-muted) hover:bg-(--color-surface-container-low)'
            "
            @click="activeGroupId = group.groupId"
          >
            {{ group.groupName }}
            <span class="text-(--color-text-muted)">({{ group.memberCount }})</span>
          </button>
          <span v-if="groups.length === 0" class="text-xs text-(--color-text-muted)">
            还没有用户组，先创建一个
          </span>
        </div>

        <div v-if="activeGroup" class="mt-4 rounded-sm bg-(--color-surface-container-low) p-3">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-xs text-(--color-text-muted)">{{ activeGroup.groupName }} 成员</span>
            <button
              class="text-xs text-danger hover:underline"
              @click="deleteGroup(activeGroup)"
            >
              删除用户组
            </button>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="member in activeGroup.members"
              :key="member.userId"
              class="inline-flex items-center gap-1 rounded-full bg-(--color-surface) px-2 py-0.5 text-xs text-(--color-text)"
            >
              {{ member.username }}
              <button class="text-(--color-text-muted) hover:text-danger" @click="removeMember(member.userId)">
                <X :size="12" />
              </button>
            </span>
            <span v-if="activeGroup.members.length === 0" class="text-xs text-(--color-text-muted)">
              暂无成员
            </span>
          </div>
          <div class="mt-3 flex gap-2">
            <BaseSelect v-model="addMemberId" :options="addableMembers" placeholder="选择成员" size="sm" />
            <BaseButton variant="secondary" size="sm" @click="addMember">
              <UserPlus :size="14" class="mr-1" />加入
            </BaseButton>
          </div>
        </div>
      </section>

      <!-- 目录授权 -->
      <section class="rounded-sm border border-(--color-border) p-4">
        <div class="mb-3 flex items-center gap-2">
          <FolderLock :size="16" class="text-primary-500" />
          <h4 class="text-sm font-medium text-(--color-text)">目录授权</h4>
        </div>
        <div class="space-y-2">
          <BaseSelect v-model="selectedFolderId" :options="folderOptions" placeholder="选择目录" size="sm" />
          <div class="grid grid-cols-2 gap-2">
            <BaseSelect
              v-model="subjectType"
              :options="[
                { label: '成员', value: 'USER' },
                { label: '用户组', value: 'GROUP' }
              ]"
              size="sm"
            />
            <BaseSelect v-model="subjectId" :options="subjectOptions" placeholder="选择授权主体" size="sm" />
          </div>
          <div class="flex gap-2">
            <BaseSelect
              v-model="permission"
              :options="[
                { label: '只读', value: 'READ' },
                { label: '读写', value: 'WRITE' }
              ]"
              size="sm"
            />
            <BaseButton variant="primary" size="sm" :loading="savingAcl" @click="saveAcl">
              授权
            </BaseButton>
          </div>
          <p class="text-xs text-(--color-text-muted)">
            授权按目录整棵子树生效；子目录可再次授权覆盖。所有者/管理员始终拥有全部权限。
          </p>
        </div>

        <div class="mt-4 flex items-center justify-between gap-2">
          <p class="text-xs text-(--color-text-muted)">目录授权列表</p>
          <div class="w-56">
            <BaseSelect
              v-model="aclFolderFilter"
              :options="[{ label: '全部目录', value: '' }, ...folderOptions]"
              placeholder="按目录筛选"
              size="sm"
            />
          </div>
        </div>

        <div class="mt-2 max-h-[260px] overflow-y-auto rounded-sm border border-(--color-border)">
          <div
            v-for="acl in acls"
            :key="acl.id"
            class="flex items-center gap-2 border-b border-(--color-border) px-3 py-2 last:border-b-0"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs text-(--color-text)">{{ acl.folderPath || acl.folderName }}</p>
              <p class="truncate text-[11px] text-(--color-text-muted)">
                {{ subjectLabel(acl) }}
              </p>
            </div>
            <span
              class="rounded-sm px-1.5 py-0.5 text-[11px]"
              :class="
                acl.permission === 'WRITE'
                  ? 'bg-primary-50 text-primary-600'
                  : 'bg-(--color-surface-container-low) text-(--color-text-muted)'
              "
            >
              {{ permissionLabel(acl.permission) }}
            </span>
            <button class="text-(--color-text-muted) hover:text-danger" @click="deleteAcl(acl)">
              <Trash2 :size="14" />
            </button>
          </div>
          <div v-if="acls.length === 0" class="px-3 py-6 text-center text-xs text-(--color-text-muted)">
            暂无目录授权
          </div>
        </div>
        <div v-if="aclTotal > aclPageSize" class="mt-2 flex items-center justify-end gap-2">
          <BaseButton variant="ghost" size="sm" :disabled="aclPage <= 1" @click="goAclPage(aclPage - 1)">
            <ChevronLeft :size="14" :stroke-width="2" />
          </BaseButton>
          <span class="text-xs tabular-nums" style="color: var(--color-text-muted);">
            {{ aclPage }} / {{ Math.max(1, Math.ceil(aclTotal / aclPageSize)) }}
          </span>
          <BaseButton
            variant="ghost"
            size="sm"
            :disabled="aclPage >= Math.max(1, Math.ceil(aclTotal / aclPageSize))"
            @click="goAclPage(aclPage + 1)"
          >
            <ChevronRight :size="14" :stroke-width="2" />
          </BaseButton>
        </div>
      </section>
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="close">关闭</BaseButton>
    </template>
  </BaseModal>
</template>
