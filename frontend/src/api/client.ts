import type {FilterRequest, FilterResponse, LogEntry, TimelineResponse} from '../types/LogEntry'

interface TimeRange {
    startTimestamp: number
    endTimestamp: number
}

interface LogMetadata {
    fileId: string
    logCount: number
    deviceName: string
    timeRange: TimeRange
}

export async function uploadLogFile(file: File): Promise<LogMetadata> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/logs/upload', {
        method: 'POST',
        body: formData
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Upload failed: ${response.statusText}`)
    }

    return response.json()
}

export async function filterLogs(request: FilterRequest): Promise<FilterResponse> {
    const response = await fetch('/api/logs/filter', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
    })

    if (!response.ok) {
        throw new Error(`Filter failed: ${response.statusText}`)
    }

    return response.json()
}

export async function getTimeline(
    fileId: string,
    numBuckets?: number,
    timeFrom?: number,
    timeTo?: number
): Promise<TimelineResponse> {
    let url = `/api/logs/timeline?fileId=${encodeURIComponent(fileId)}`
    if (numBuckets !== undefined) url += `&numBuckets=${numBuckets}`
    if (timeFrom !== undefined) url += `&timeFrom=${timeFrom}`
    if (timeTo !== undefined) url += `&timeTo=${timeTo}`

    const response = await fetch(url)

    if (!response.ok) {
        throw new Error(`Timeline failed: ${response.statusText}`)
    }

    return response.json()
}

export async function getEntry(fileId: string, entryId: number): Promise<LogEntry> {
    const response = await fetch(`/api/logs/entry?fileId=${encodeURIComponent(fileId)}&entryId=${entryId}`)

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch entry: ${response.statusText}`)
    }

    return response.json()
}

export async function getMetadata(fileId: string): Promise<{ tagColors: Record<string, string> }> {
    const response = await fetch(`/api/logs/metadata?fileId=${encodeURIComponent(fileId)}`)

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch metadata: ${response.statusText}`)
    }

    return response.json()
}