import {defineStore} from 'pinia'
import {computed, ref} from 'vue'
import {filterLogs, getEntry, getTimeline, uploadLogFile} from '../api/client'
import type {FilterRequest, LogEntry, TimelineBucket} from '../types/LogEntry'

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
    const pinnedEntryIds = ref<number[]>([])
    const searchHighlightRanges = ref<Record<string, [number, number][]>>({})

    const filters = ref({
        levels: [...DEFAULT_LEVELS],
        tagPattern: '',
        tagRegex: false,
        contentFilter: '',
        searchQuery: null as string | null,
        timeFrom: null as number | null,
        timeTo: null as number | null
    })

    // Timeline state
    const resolution = ref<'sec' | 'min' | 'hour'>('sec')
    const buckets = ref<TimelineBucket[]>([])
    const tagColors = ref<Record<string, string>>({})
    const selectedRange = ref<{ from: number; to: number } | null>(null)

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

    async function fetchFilteredLogs(append = false) {
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
                offset: append ? entries.value.length : 0,
                limit: 200
            }
            console.log('[LogStore] Sending filter request:', JSON.stringify(request))
            const result = await filterLogs(request)
            console.log('[LogStore] Filter response:', JSON.stringify({
                total: result.total,
                entriesCount: result.entries.length
            }))
            if (append) {
                entries.value = [...entries.value, ...result.entries]
            } else {
                entries.value = result.entries
            }
            total.value = result.total
            searchHighlightRanges.value = result.searchHighlightRanges || {}
        } catch (e) {
            console.error('[LogStore] Filter error:', e)
            error.value = e instanceof Error ? e.message : 'Filter failed'
        } finally {
            isLoading.value = false
        }
    }

    function loadMore() {
        if (!isLoading.value && hasMore.value) {
            fetchFilteredLogs(true)
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

    function setSearchQuery(query: string | null) {
        filters.value.searchQuery = query
        fetchFilteredLogs()
    }

    function setTimeFrom(time: number | null) {
        filters.value.timeFrom = time
        fetchFilteredLogs()
    }

    function setTimeTo(time: number | null) {
        filters.value.timeTo = time
        fetchFilteredLogs()
    }

    function clearSearch() {
        filters.value.searchQuery = null
        searchHighlightRanges.value = {}
        fetchFilteredLogs()
    }

    function togglePin(entryId: number) {
        const idx = pinnedEntryIds.value.indexOf(entryId)
        if (idx === -1) {
            pinnedEntryIds.value = [...pinnedEntryIds.value, entryId]
        } else {
            pinnedEntryIds.value = pinnedEntryIds.value.filter(id => id !== entryId)
        }
    }

    function unpinAll() {
        pinnedEntryIds.value = []
    }

    async function fetchPinnedEntry(entryId: number): Promise<LogEntry | null> {
        if (!fileId.value) return null
        // Check if already in entries
        const existing = entries.value.find(e => e.id === entryId)
        if (existing) return existing
        // Fetch from API
        try {
            const entry = await getEntry(fileId.value, entryId)
            return entry
        } catch (e) {
            console.error('[LogStore] fetchPinnedEntry error:', e)
            return null
        }
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
        pinnedEntryIds.value = []
        resetFilters()
        buckets.value = []
        tagColors.value = {}
        selectedRange.value = null
    }

    async function loadTimeline(newResolution: string) {
        if (!fileId.value) return
        resolution.value = newResolution as 'sec' | 'min' | 'hour'
        try {
            const result = await getTimeline(fileId.value, newResolution)
            buckets.value = result.buckets
            tagColors.value = result.tagColors
        } catch (e) {
            console.error('[LogStore] loadTimeline error:', e)
        }
    }

    function setSelectedRange(range: { from: number; to: number } | null) {
        selectedRange.value = range
        if (range) {
            filters.value.timeFrom = range.from
            filters.value.timeTo = range.to
        } else {
            filters.value.timeFrom = null
            filters.value.timeTo = null
        }
        fetchFilteredLogs()
    }

    return {
        metadata,
        fileId,
        entries,
        total,
        isLoading,
        error,
        pinnedEntryIds,
        searchHighlightRanges,
        filters,
        hasMore,
        resolution,
        buckets,
        tagColors,
        selectedRange,
        uploadLog,
        fetchFilteredLogs,
        loadMore,
        setLevels,
        setTagPattern,
        setContentFilter,
        setSearchQuery,
        setTimeFrom,
        setTimeTo,
        clearSearch,
        togglePin,
        fetchPinnedEntry,
        unpinAll,
        resetFilters,
        setFileId,
        clearLog,
        loadTimeline,
        setSelectedRange
    }
}, {
    persist: {
        paths: ['fileId', 'filters', 'pinnedEntryIds', 'resolution', 'selectedRange']
    }
})
