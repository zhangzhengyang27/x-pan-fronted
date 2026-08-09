import {computed, ref} from 'vue'
import {defineStore} from 'pinia'
import fileService from '@/api/file'
import {ElMessage} from '@/composables/useToast'

export const useFileStore = defineStore('file', () => {

    const parentId = ref('')
    const defaultParentId = ref('')
    const defaultParentFilename = ref('')
    const fileList = ref([])
    const multipleSelection = ref([])
    const fileTypes = ref('-1')
    const searchFlag = ref(false)
    const searchKey = ref('')
    const tableLoading = ref(true)

    // ─── P1.2 分页状态 ─────────────────────────────────────────────────────────
    const pageNum = ref(1)
    const pageSize = ref(50)
    const total = ref(0)
    const hasMore = ref(false)
    const isLoadingMore = ref(false)

    const paramParentId = computed(() => parentId.value === '-1' ? defaultParentId.value : parentId.value)

    function setParentId(newParentId) {
        parentId.value = newParentId
        pageNum.value = 1
        hasMore.value = false
        total.value = 0
    }

    function refreshParentId() {
        parentId.value = defaultParentId.value
        pageNum.value = 1
        hasMore.value = false
        total.value = 0
    }

    function setDefaultParentId(newDefaultParentId) {
        defaultParentId.value = newDefaultParentId
    }

    function setDefaultParentFilename(newDefaultParentFilename) {
        defaultParentFilename.value = newDefaultParentFilename
    }

    function setFileList(newFileList) {
        fileList.value = newFileList
    }

    function appendFileList(more) {
        fileList.value = fileList.value.concat(more)
    }

    function setMultipleSelection(newMultipleSelection) {
        multipleSelection.value = newMultipleSelection
    }

    function setFileTypes(newFileTypes) {
        fileTypes.value = newFileTypes
        pageNum.value = 1
        hasMore.value = false
        total.value = 0
    }

    function setSearchFlag(newSearchFlag) {
        if (!newSearchFlag) {
            searchKey.value = ''
        }
        searchFlag.value = newSearchFlag
    }

    function setSearchKey(newSearchKey) {
        searchKey.value = newSearchKey
    }

    function setTableLoading(newTableLoading) {
        tableLoading.value = newTableLoading
    }

    function resetPagination() {
        pageNum.value = 1
        hasMore.value = false
        total.value = 0
    }

    function clear(state) {
        parentId.value = ''
        defaultParentId.value = ''
        defaultParentFilename.value = ''
        fileList.value = new Array()
        multipleSelection.value = new Array()
        fileTypes.value = '-1'
        searchFlag.value = false
        searchKey.value = ''
        tableLoading.value = true
        pageNum.value = 1
        hasMore.value = false
        total.value = 0
    }

    function loadFileList() {
        setTableLoading(true)
        pageNum.value = 1
        if (searchFlag.value) {
            fileService.search({
                keyword: searchKey.value,
                fileTypes: '-1'
            }, res => {
                setFileList(res.data)
                setTableLoading(false)
                hasMore.value = false
                total.value = res.data?.length || 0
            }, res => {
                setTableLoading(false)
                ElMessage.error(res.message)
            })
        } else {
            fileService.list({
                parentId: paramParentId.value,
                fileTypes: fileTypes.value,
                pageNum: 1,
                pageSize: pageSize.value,
            }, res => {
                setTableLoading(false)
                applyPageResponse(res.data, false)
            }, res => {
                setTableLoading(false)
                ElMessage.error(res.message)
            })
        }
    }

    function loadMore() {
        if (searchFlag.value || !hasMore.value || isLoadingMore.value) return
        isLoadingMore.value = true
        const next = pageNum.value + 1
        fileService.list({
            parentId: paramParentId.value,
            fileTypes: fileTypes.value,
            pageNum: next,
            pageSize: pageSize.value,
        }, res => {
            isLoadingMore.value = false
            applyPageResponse(res.data, true)
        }, res => {
            isLoadingMore.value = false
            ElMessage.error(res.message)
        })
    }

    /**
     * 强制拉取全量（前端筛选时使用，避免被服务端分页截断）
     */
    function loadAllForFilter() {
        if (searchFlag.value) return
        setTableLoading(true)
        fileService.list({
            parentId: paramParentId.value,
            fileTypes: fileTypes.value,
            pageNum: 1,
            pageSize: 9999,
        }, res => {
            setTableLoading(false)
            applyPageResponse(res.data, false)
        }, res => {
            setTableLoading(false)
            ElMessage.error(res.message)
        })
    }

    /**
     * 解析分页响应：兼容 PageVO（{ records, total, hasMore }）与旧版数组
     */
    function applyPageResponse(payload, append) {
        if (payload && Array.isArray(payload.records)) {
            if (append) {
                appendFileList(payload.records)
                pageNum.value = payload.pageNum || pageNum.value
            } else {
                setFileList(payload.records)
                pageNum.value = payload.pageNum || 1
            }
            hasMore.value = !!payload.hasMore
            total.value = Number(payload.total || 0)
        } else if (Array.isArray(payload)) {
            // 旧版无分页响应（向后兼容）
            setFileList(payload)
            hasMore.value = false
            total.value = payload.length
        } else {
            setFileList([])
            hasMore.value = false
            total.value = 0
        }
    }

    return {
        parentId,
        defaultParentId,
        defaultParentFilename,
        fileList,
        multipleSelection,
        fileTypes,
        searchFlag,
        searchKey,
        tableLoading,
        pageNum,
        pageSize,
        total,
        hasMore,
        isLoadingMore,
        paramParentId,
        setParentId,
        refreshParentId,
        setDefaultParentId,
        setDefaultParentFilename,
        setFileList,
        appendFileList,
        setMultipleSelection,
        setFileTypes,
        setSearchFlag,
        setSearchKey,
        setTableLoading,
        resetPagination,
        clear,
        loadFileList,
        loadMore,
        loadAllForFilter,
    }
})
