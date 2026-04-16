import {create} from 'zustand'
import {persist} from 'zustand/middleware'
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

interface FilterState {
    levels: string[]
    tagPattern: string
    tagRegex: boolean
    contentFilter: string
    searchQuery: string | null
    searchCaseSensitive: boolean
    searchRegex: boolean
    timeFrom: number | null
    timeTo: number | null
}

interface PaginationState {
    page: number
    pageSize: number
}

interface LogState {
    metadata: LogMetadata | null
    fileTimeRange: { startTimestamp: number; endTimestamp: number } | null
    fileId: string | null
    entries: LogEntry[]
    total: number
    isLoading: boolean
    error: string | null
    pinnedEntryIds: number[]
    pinnedEntriesCache: LogEntry[]
    searchHighlightRanges: Record<string, [number, number][]>
    searchMatchCount: number
    filters: FilterState
    buckets: TimelineBucket[]
    tagColors: Record<string, string>
    selectedRange: { from: number; to: number } | null
    pagination: PaginationState
    selectedEntryId: number | null
    sidebarCollapsed: { time: boolean; level: boolean; tags: boolean }
    levelCounts: Record<string, number>
    allTags: Array<{ tag: string; count: number }>
    timelineCollapsed: boolean
    maxLogsReached: boolean
    hiddenTags: string[]
}

interface LogActions {
    uploadLog: (file: File) => Promise<void>
    fetchFilteredLogs: (append?: boolean) => Promise<void>
    loadMore: () => void
    setLevels: (levels: string[]) => void
    setTagPattern: (pattern: string, regex?: boolean) => void
    setContentFilter: (filter: string) => void
    setSearchQuery: (query: string | null) => void
    setSearchCaseSensitive: (sensitive: boolean) => void
    setSearchRegex: (regex: boolean) => void
    setSearchParams: (query: string | null, caseSensitive: boolean, regex: boolean) => void
    setTimeFrom: (time: number | null) => void
    setTimeTo: (time: number | null) => void
    clearSearch: () => void
    togglePin: (entryId: number) => void
    unpinAll: () => void
    fetchPinnedEntry: (entryId: number) => Promise<LogEntry | null>
    resetFilters: () => void
    setFileId: (id: string) => void
    clearLog: () => void
    loadTimeline: (numBuckets?: number, timeFrom?: number, timeTo?: number) => Promise<void>
    setSelectedRange: (range: { from: number; to: number } | null) => void
    resetTimeRange: () => void
    setPage: (page: number) => void
    setPageSize: (size: number) => void
    setSelectedEntryId: (id: number | null) => void
    toggleSidebarCollapsed: (section: 'time' | 'level' | 'tags') => void
    setLevelCounts: (counts: Record<string, number>) => void
    setAllTags: (tags: Array<{ tag: string; count: number }>) => void
    toggleTimelineCollapsed: () => void
    setMaxLogsReached: (reached: boolean) => void
    toggleHiddenTag: (tag: string) => void
    unhideAllTags: () => void
}

const DEFAULT_LEVELS = ['VERBOSE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'ASSERT']
const MAX_LOGS = 1000

type LogStore = LogState & LogActions

const getDefaultFilters = (): FilterState => ({
    levels: [...DEFAULT_LEVELS],
    tagPattern: '',
    tagRegex: false,
    contentFilter: '',
    searchQuery: null,
    searchCaseSensitive: false,
    searchRegex: false,
    timeFrom: null,
    timeTo: null
})

export const useLogStore = create<LogStore>()(
    persist(
        (set, get) => ({
            metadata: null,
            fileTimeRange: null,
            fileId: null,
            entries: [],
            total: 0,
            isLoading: false,
            error: null,
            pinnedEntryIds: [],
            pinnedEntriesCache: [],
            searchHighlightRanges: {},
            searchMatchCount: 0,
            filters: getDefaultFilters(),
            buckets: [],
            tagColors: {},
            selectedRange: null,
            pagination: {page: 1, pageSize: 200},
            selectedEntryId: null,
            sidebarCollapsed: {time: false, level: false, tags: false},
            levelCounts: {},
            allTags: [],
            timelineCollapsed: false,
            maxLogsReached: false,
            hiddenTags: [],

            uploadLog: async (file: File) => {
                console.log('[LogStore] uploadLog called with file:', file.name)
                set({isLoading: true, error: null})

                try {
                    const result = await uploadLogFile(file)
                    console.log('[LogStore] uploadLogFile returned:', JSON.stringify({
                        fileId: result.fileId,
                        logCount: result.logCount
                    }))
                    set({
                        metadata: result,
                        fileId: result.fileId,
                        fileTimeRange: {
                            startTimestamp: result.timeRange.startTimestamp,
                            endTimestamp: result.timeRange.endTimestamp
                        }
                    })
                    const timeFrom = result.timeRange.startTimestamp
                    const timeTo = result.timeRange.endTimestamp
                    set({
                        filters: {
                            levels: [...DEFAULT_LEVELS],
                            tagPattern: '',
                            tagRegex: false,
                            contentFilter: '',
                            searchQuery: null,
                            searchCaseSensitive: false,
                            searchRegex: false,
                            timeFrom,
                            timeTo
                        }
                    })
                    console.log('[LogStore] calling fetchFilteredLogs after upload')
                    await get().fetchFilteredLogs()
                    console.log('[LogStore] fetchFilteredLogs completed')
                    await get().loadTimeline(20, timeFrom, timeTo)
                } catch (e) {
                    console.error('[LogStore] uploadLog error:', e)
                    set({error: e instanceof Error ? e.message : 'Upload failed'})
                } finally {
                    set({isLoading: false})
                }
            },

            fetchFilteredLogs: async (append = false) => {
                const {fileId, filters, pagination} = get()
                console.log('[LogStore] fetchFilteredLogs called, fileId:', fileId, 'filters:', JSON.stringify(filters), 'append:', append)
                if (!fileId) {
                    console.log('[LogStore] fetchFilteredLogs early return - no fileId')
                    return
                }

                set({isLoading: true, error: null, maxLogsReached: false})

                try {
                    const offset = append ? get().entries.length : (pagination.page - 1) * pagination.pageSize
                    const request: FilterRequest = {
                        fileId,
                        levels: filters.levels,
                        tagPattern: filters.tagPattern,
                        tagRegex: filters.tagRegex,
                        contentFilter: filters.contentFilter,
                        searchQuery: filters.searchQuery,
                        searchCaseSensitive: filters.searchCaseSensitive,
                        searchRegex: filters.searchRegex,
                        timeFrom: filters.timeFrom,
                        timeTo: filters.timeTo,
                        hiddenTags: get().hiddenTags.join('|'),
                        offset,
                        limit: pagination.pageSize
                    }
                    console.log('[LogStore] Sending filter request:', JSON.stringify(request))
                    const result = await filterLogs(request)
                    console.log('[LogStore] Filter response:', JSON.stringify({
                        total: result.total,
                        entriesCount: result.entries.length
                    }))
                    const {pinnedEntryIds, pinnedEntriesCache, allTags: existingTags} = get()
                    const pinnedIdsSet = new Set(pinnedEntryIds)
                    const existingCacheIds = new Set(pinnedEntriesCache.map(e => e.id))
                    const newCacheEntries = result.entries.filter(e => pinnedIdsSet.has(e.id) && !existingCacheIds.has(e.id))

                    // Update allTags: preserve existing tags unless no filters active
                    let updatedAllTags = existingTags
                    if (existingTags.length === 0 && result.tagCounts) {
                        // First load - populate from tagCounts
                        updatedAllTags = result.tagCounts
                    } else if (!filters.tagPattern && result.tagCounts && result.tagCounts.length > 0) {
                        // No tag filter active and we have tagCounts - update
                        // This happens when user clears the tag filter
                        updatedAllTags = result.tagCounts
                    }
                    // If tag filter is active, keep existing allTags to preserve full tag list

                    // Preserve hidden tags in allTags so they stay visible in sidebar with last count
                    const {hiddenTags: currentHiddenTags} = get()
                    if (currentHiddenTags.length > 0) {
                        const missingHidden = currentHiddenTags.filter(h => !updatedAllTags.some(t => t.tag === h))
                        if (missingHidden.length > 0) {
                            const hiddenTagEntries = missingHidden.map(h => ({tag: h, count: 0}))
                            updatedAllTags = [...updatedAllTags, ...hiddenTagEntries]
                        }
                    }

                    set({
                        entries: append ? [...get().entries, ...result.entries] : result.entries,
                        total: result.total,
                        searchHighlightRanges: result.searchHighlightRanges || {},
                        pinnedEntriesCache: [...pinnedEntriesCache, ...newCacheEntries],
                        levelCounts: result.levelCounts || {},
                        allTags: updatedAllTags
                    })
                } catch (e) {
                    console.error('[LogStore] Filter error:', e)
                    set({error: e instanceof Error ? e.message : 'Filter failed'})
                } finally {
                    set({isLoading: false})
                }
            },

            loadMore: () => {
                const {isLoading, entries, total} = get()
                if (!isLoading && entries.length < total) {
                    if (entries.length >= MAX_LOGS) {
                        set({maxLogsReached: true})
                        return
                    }
                    get().fetchFilteredLogs(true)
                }
            },

            setLevels: (levels: string[]) => {
                set(state => ({filters: {...state.filters, levels}}))
                get().fetchFilteredLogs()
            },

            setTagPattern: (pattern: string, regex = false) => {
                set(state => ({filters: {...state.filters, tagPattern: pattern, tagRegex: regex}}))
                get().fetchFilteredLogs()
            },

            setContentFilter: (filter: string) => {
                set(state => ({filters: {...state.filters, contentFilter: filter}}))
                get().fetchFilteredLogs()
            },

            setSearchQuery: (query: string | null) => {
                set(state => ({filters: {...state.filters, searchQuery: query}}))
                get().fetchFilteredLogs()
            },

            setSearchCaseSensitive: (sensitive: boolean) => {
                set(state => ({filters: {...state.filters, searchCaseSensitive: sensitive}}))
                get().fetchFilteredLogs()
            },

            setSearchRegex: (regex: boolean) => {
                set(state => ({filters: {...state.filters, searchRegex: regex}}))
                get().fetchFilteredLogs()
            },

            setSearchParams: (query: string | null, caseSensitive: boolean, regex: boolean) => {
                set(state => ({
                    filters: {
                        ...state.filters,
                        searchQuery: query,
                        searchCaseSensitive: caseSensitive,
                        searchRegex: regex
                    }
                }))
                get().fetchFilteredLogs()
            },

            setTimeFrom: (time: number | null) => {
                set(state => ({filters: {...state.filters, timeFrom: time}}))
                get().fetchFilteredLogs()
            },

            setTimeTo: (time: number | null) => {
                set(state => ({filters: {...state.filters, timeTo: time}}))
                get().fetchFilteredLogs()
            },

            clearSearch: () => {
                set(state => ({
                    filters: {
                        ...state.filters,
                        searchQuery: null,
                        searchCaseSensitive: false,
                        searchRegex: false
                    },
                    searchHighlightRanges: {}
                }))
                get().fetchFilteredLogs()
            },

            togglePin: (entryId: number) => {
                const {pinnedEntryIds, entries, pinnedEntriesCache} = get()
                const idx = pinnedEntryIds.indexOf(entryId)
                if (idx === -1) {
                    const entryToPin = entries.find(e => e.id === entryId)
                    if (entryToPin) {
                        set({
                            pinnedEntryIds: [...pinnedEntryIds, entryId],
                            pinnedEntriesCache: [...pinnedEntriesCache.filter(e => e.id !== entryId), entryToPin]
                        })
                    } else {
                        set({pinnedEntryIds: [...pinnedEntryIds, entryId]})
                        const {fileId} = get()
                        if (fileId) {
                            getEntry(fileId, entryId).then(entry => {
                                if (entry) {
                                    set(state => ({
                                        pinnedEntriesCache: [...state.pinnedEntriesCache.filter(e => e.id !== entryId), entry]
                                    }))
                                }
                            })
                        }
                    }
                } else {
                    set({
                        pinnedEntryIds: pinnedEntryIds.filter(id => id !== entryId),
                        pinnedEntriesCache: pinnedEntriesCache.filter(e => e.id !== entryId)
                    })
                }
            },

            unpinAll: () => {
                set({pinnedEntryIds: []})
            },

            fetchPinnedEntry: async (entryId: number): Promise<LogEntry | null> => {
                const {fileId, entries} = get()
                if (!fileId) return null
                const existing = entries.find(e => e.id === entryId)
                if (existing) return existing
                try {
                    const entry = await getEntry(fileId, entryId)
                    return entry
                } catch (e) {
                    console.error('[LogStore] fetchPinnedEntry error:', e)
                    return null
                }
            },

            resetFilters: () => {
                set({filters: getDefaultFilters()})
            },

            setFileId: (id: string) => {
                set({fileId: id})
            },

            clearLog: () => {
                set({
                    metadata: null,
                    fileTimeRange: null,
                    fileId: null,
                    entries: [],
                    total: 0,
                    pinnedEntryIds: [],
                    pinnedEntriesCache: [],
                    filters: getDefaultFilters(),
                    buckets: [],
                    tagColors: {},
                    selectedRange: null,
                    pagination: {page: 1, pageSize: 200},
                    selectedEntryId: null,
                    sidebarCollapsed: {time: false, level: false, tags: false},
                    levelCounts: {},
                    allTags: [],
                    timelineCollapsed: false,
                    maxLogsReached: false,
                    hiddenTags: []
                })
            },

            loadTimeline: async (numBuckets?: number, timeFrom?: number, timeTo?: number) => {
                const {fileId, metadata} = get()
                if (!fileId) return
                try {
                    const effectiveTimeFrom = timeFrom ?? metadata?.timeRange?.startTimestamp
                    const effectiveTimeTo = timeTo ?? metadata?.timeRange?.endTimestamp
                    const result = await getTimeline(fileId, numBuckets, effectiveTimeFrom, effectiveTimeTo)
                    set({
                        buckets: result.buckets,
                        tagColors: result.tagColors,
                        metadata: metadata ? {...metadata, timeRange: result.timeRange} : metadata
                    })
                } catch (e) {
                    console.error('[LogStore] loadTimeline error:', e)
                }
            },

            setSelectedRange: (range: { from: number; to: number } | null) => {
                set({
                    selectedRange: range,
                    filters: {
                        ...get().filters,
                        timeFrom: range?.from ?? null,
                        timeTo: range?.to ?? null
                    }
                })
                get().fetchFilteredLogs()
                if (range) {
                    get().loadTimeline(20, range.from, range.to)
                }
            },

            resetTimeRange: () => {
                const {fileTimeRange} = get()
                if (!fileTimeRange) return
                const from = fileTimeRange.startTimestamp
                const to = fileTimeRange.endTimestamp
                set({
                    selectedRange: null,
                    filters: {
                        ...get().filters,
                        timeFrom: from,
                        timeTo: to
                    }
                })
                get().fetchFilteredLogs()
                get().loadTimeline(20, from, to)
            },

            setPage: (page: number) => {
                set(state => ({pagination: {...state.pagination, page}}))
                get().fetchFilteredLogs()
            },

            setPageSize: (size: number) => {
                set(state => ({pagination: {...state.pagination, pageSize: size, page: 1}}))
                get().fetchFilteredLogs()
            },

            setSelectedEntryId: (id: number | null) => {
                set({selectedEntryId: id})
            },

            toggleSidebarCollapsed: (section: 'time' | 'level' | 'tags') => {
                set(state => ({
                    sidebarCollapsed: {
                        ...state.sidebarCollapsed,
                        [section]: !state.sidebarCollapsed[section]
                    }
                }))
            },

            setLevelCounts: (counts: Record<string, number>) => {
                set({levelCounts: counts})
            },

            setAllTags: (tags: Array<{ tag: string; count: number }>) => {
                set({allTags: tags})
            },

            toggleTimelineCollapsed: () => {
                set(state => ({timelineCollapsed: !state.timelineCollapsed}))
            },

            setMaxLogsReached: (reached: boolean) => {
                set({maxLogsReached: reached})
            },

            toggleHiddenTag: (tag: string) => {
                const {hiddenTags, allTags} = get()
                const isHidden = hiddenTags.includes(tag)
                const newHiddenTags = isHidden
                    ? hiddenTags.filter(t => t !== tag)
                    : [...hiddenTags, tag]
                // Also preserve in allTags so it stays visible
                let updatedAllTags = allTags
                if (!isHidden && !allTags.some(t => t.tag === tag)) {
                    updatedAllTags = [...allTags, {tag, count: 0}]
                }
                set({hiddenTags: newHiddenTags, allTags: updatedAllTags})
                get().fetchFilteredLogs()
            },

            unhideAllTags: () => {
                set({hiddenTags: []})
                get().fetchFilteredLogs()
            }
        }),
        {
            name: 'logvue-storage',
            partialize: (state) => ({
                metadata: state.metadata,
                fileId: state.fileId,
                filters: state.filters,
                pinnedEntryIds: state.pinnedEntryIds,
                selectedRange: state.selectedRange
            })
        }
    )
)

export const hasMore = (state: LogState) => state.entries.length < state.total
