import type {FilterRequest, FilterResponse} from '../types/LogEntry'

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
        throw new Error(`Upload failed: ${response.statusText}`)
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