export interface LogEntry {
    id: number
    header: LogHeader
    message: string
    timestamp: number
}

export interface LogHeader {
    logLevel: string
    pid: number
    tid: number
    applicationId: string | null
    processName: string | null
    tag: string | null
    timestamp: Timestamp
}

export interface Timestamp {
    seconds: number
    nanos: number
}

export interface LogFileMetadata {
    deviceName: string
    avdPath: string | null
    release: string | null
    apiLevel: number | null
    applicationIds: string[]
    filter: string | null
    logCount: number
    timeRange: TimeRange
}

export interface TimeRange {
    startTimestamp: number
    endTimestamp: number
}

export interface FilterRequest {
    fileId: string
    levels: string[]
    tagPattern: string
    tagRegex: boolean
    contentFilter: string
    searchQuery: string | null
    timeFrom: number | null
    timeTo: number | null
    offset: number
    limit: number
}

export interface FilterResponse {
    entries: LogEntry[]
    total: number
    hasMore: boolean
    searchHighlightRanges?: Record<string, [number, number][]>
}
