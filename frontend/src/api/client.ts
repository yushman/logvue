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

export async function ensureSession(): Promise<string> {
    const response = await fetch('/api/session', {
        method: 'GET',
        credentials: 'include'
    })
    if (!response.ok) {
        throw new Error('Failed to get session')
    }
    const data = await response.json()
    return data.sessionId
}

export async function uploadLogFile(file: File): Promise<LogMetadata> {
    await ensureSession()

    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/logs/upload', {
        method: 'POST',
        credentials: 'include',
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
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
    })

    const data = await response.json()
    if (!response.ok) {
        const error = new Error(data.error || `Filter failed: ${response.statusText}`)
        ;(error as any).status = response.status
        throw error
    }

    return data
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

    const response = await fetch(url, {credentials: 'include'})

    if (!response.ok) {
        throw new Error(`Timeline failed: ${response.statusText}`)
    }

    return response.json()
}

export async function getEntry(fileId: string, entryId: number): Promise<LogEntry> {
    const response = await fetch(`/api/logs/entry?fileId=${encodeURIComponent(fileId)}&entryId=${entryId}`, {
        credentials: 'include'
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch entry: ${response.statusText}`)
    }

    return response.json()
}

export async function getMetadata(fileId: string): Promise<{ tagColors: Record<string, string> }> {
    const response = await fetch(`/api/logs/metadata?fileId=${encodeURIComponent(fileId)}`, {
        credentials: 'include'
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch metadata: ${response.statusText}`)
    }

    return response.json()
}