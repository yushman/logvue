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
    timeFrom: number | null
    timeTo: number | null
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
}

interface LogActions {
    uploadLog: (file: File) => Promise<void>
    fetchFilteredLogs: (append?: boolean) => Promise<void>
    loadMore: () => void
    setLevels: (levels: string[]) => void
    setTagPattern: (pattern: string, regex?: boolean) => void
    setContentFilter: (filter: string) => void
    setSearchQuery: (query: string | null) => void
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
}

const DEFAULT_LEVELS = ['VERBOSE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'ASSERT']

type LogStore = LogState & LogActions

const getDefaultFilters = (): FilterState => ({
    levels: [...DEFAULT_LEVELS],
    tagPattern: '',
    tagRegex: false,
    contentFilter: '',
    searchQuery: null,
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
                const {fileId, filters} = get()
                console.log('[LogStore] fetchFilteredLogs called, fileId:', fileId, 'filters:', JSON.stringify(filters))
                if (!fileId) {
                    console.log('[LogStore] fetchFilteredLogs early return - no fileId')
                    return
                }

                set({isLoading: true, error: null})

                try {
                    const request: FilterRequest = {
                        fileId,
                        levels: filters.levels,
                        tagPattern: filters.tagPattern,
                        tagRegex: filters.tagRegex,
                        contentFilter: filters.contentFilter,
                        searchQuery: filters.searchQuery,
                        timeFrom: filters.timeFrom,
                        timeTo: filters.timeTo,
                        offset: append ? get().entries.length : 0,
                        limit: 200
                    }
                    console.log('[LogStore] Sending filter request:', JSON.stringify(request))
                    const result = await filterLogs(request)
                    console.log('[LogStore] Filter response:', JSON.stringify({
                        total: result.total,
                        entriesCount: result.entries.length
                    }))
                    const {pinnedEntryIds, pinnedEntriesCache} = get()
                    const pinnedIdsSet = new Set(pinnedEntryIds)
                    const existingCacheIds = new Set(pinnedEntriesCache.map(e => e.id))
                    const newCacheEntries = result.entries.filter(e => pinnedIdsSet.has(e.id) && !existingCacheIds.has(e.id))
                    set({
                        entries: append ? [...get().entries, ...result.entries] : result.entries,
                        total: result.total,
                        searchHighlightRanges: result.searchHighlightRanges || {},
                        pinnedEntriesCache: [...pinnedEntriesCache, ...newCacheEntries]
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
                    filters: {...state.filters, searchQuery: null},
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
                            pinnedEntriesCache: [...pinnedEntriesCache, entryToPin]
                        })
                    } else {
                        set({pinnedEntryIds: [...pinnedEntryIds, entryId]})
                        const {fileId} = get()
                        if (fileId) {
                            getEntry(fileId, entryId).then(entry => {
                                if (entry) {
                                    set(state => ({
                                        pinnedEntriesCache: [...state.pinnedEntriesCache, entry]
                                    }))
                                }
                            })
                        }
                    }
                } else {
                    set({pinnedEntryIds: pinnedEntryIds.filter(id => id !== entryId)})
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
                    selectedRange: null
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
