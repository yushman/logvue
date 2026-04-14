interface TimeRange {
    startTimestamp: number
    endTimestamp: number
}

interface LogMetadata {
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