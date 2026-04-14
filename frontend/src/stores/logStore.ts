import {defineStore} from 'pinia'
import {computed, ref} from 'vue'
import {filterLogs, uploadLogFile} from '../api/client'
import type {FilterRequest, LogEntry} from '../types/LogEntry'

interface TimeRange {
    startTimestamp: number
    endTimestamp: number
}

interface LogMetadata {
    logCount: number
    deviceName: string
    timeRange: TimeRange
}

const DEFAULT_LEVELS = ['VERBOSE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'ASSERT']

export const useLogStore = defineStore('log', () => {
    const metadata = ref<LogMetadata | null>(null)
    const fileId = ref<string | null>(null)
    const entries = ref<LogEntry[]>([])
    const total = ref(0)
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const pinnedEntryId = ref<number | null>(null)

    const filters = ref({
        levels: [...DEFAULT_LEVELS],
        tagPattern: '',
        tagRegex: false,
        contentFilter: '',
        searchQuery: null as string | null,
        timeFrom: null as number | null,
        timeTo: null as number | null
    })

    const hasMore = computed(() => entries.value.length < total.value)

    async function uploadLog(file: File) {
        console.log('[LogStore] uploadLog called with file:', file.name)
        isLoading.value = true
        error.value = null

        try {
            const result = await uploadLogFile(file)
            console.log('[LogStore] uploadLogFile returned:', JSON.stringify({
                fileId: result.fileId,
                logCount: result.logCount
            }))
            metadata.value = result
            fileId.value = result.fileId
            // Reset filters and fetch entries
            resetFilters()
            console.log('[LogStore] calling fetchFilteredLogs after upload')
            await fetchFilteredLogs()
            console.log('[LogStore] fetchFilteredLogs completed')
        } catch (e) {
            console.error('[LogStore] uploadLog error:', e)
            error.value = e instanceof Error ? e.message : 'Upload failed'
        } finally {
            isLoading.value = false
        }
    }

    async function fetchFilteredLogs() {
        console.log('[LogStore] fetchFilteredLogs called, fileId:', fileId.value, 'filters:', JSON.stringify(filters.value))
        if (!fileId.value) {
            console.log('[LogStore] fetchFilteredLogs early return - no fileId')
            return
        }

        isLoading.value = true
        error.value = null

        try {
            const request: FilterRequest = {
                fileId: fileId.value,
                levels: filters.value.levels,
                tagPattern: filters.value.tagPattern,
                tagRegex: filters.value.tagRegex,
                contentFilter: filters.value.contentFilter,
                searchQuery: filters.value.searchQuery,
                timeFrom: filters.value.timeFrom,
                timeTo: filters.value.timeTo,
                offset: 0,
                limit: 200
            }
            console.log('[LogStore] Sending filter request:', JSON.stringify(request))
            const result = await filterLogs(request)
            console.log('[LogStore] Filter response:', JSON.stringify({
                total: result.total,
                entriesCount: result.entries.length
            }))
            entries.value = result.entries
            total.value = result.total
        } catch (e) {
            console.error('[LogStore] Filter error:', e)
            error.value = e instanceof Error ? e.message : 'Filter failed'
        } finally {
            isLoading.value = false
        }
    }

    function setLevels(levels: string[]) {
        filters.value.levels = levels
        fetchFilteredLogs()
    }

    function setTagPattern(pattern: string, regex: boolean = false) {
        filters.value.tagPattern = pattern
        filters.value.tagRegex = regex
        fetchFilteredLogs()
    }

    function setContentFilter(filter: string) {
        filters.value.contentFilter = filter
        fetchFilteredLogs()
    }

    function resetFilters() {
        filters.value.levels = [...DEFAULT_LEVELS]
        filters.value.tagPattern = ''
        filters.value.tagRegex = false
        filters.value.contentFilter = ''
        filters.value.searchQuery = null
        filters.value.timeFrom = null
        filters.value.timeTo = null
    }

    function setFileId(id: string) {
        fileId.value = id
    }

    function clearLog() {
        metadata.value = null
        fileId.value = null
        entries.value = []
        total.value = 0
        pinnedEntryId.value = null
        resetFilters()
    }

    return {
        metadata,
        fileId,
        entries,
        total,
        isLoading,
        error,
        pinnedEntryId,
        filters,
        hasMore,
        uploadLog,
        fetchFilteredLogs,
        setLevels,
        setTagPattern,
        setContentFilter,
        resetFilters,
        setFileId,
        clearLog
    }
}, {
    persist: {
        paths: ['metadata', 'fileId']
    }
})
