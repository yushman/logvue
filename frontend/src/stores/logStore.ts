import {defineStore} from 'pinia'
import {ref} from 'vue'
import {uploadLogFile} from '../api/client'

interface TimeRange {
    startTimestamp: number
    endTimestamp: number
}

interface LogMetadata {
    logCount: number
    deviceName: string
    timeRange: TimeRange
}

export const useLogStore = defineStore('log', () => {
    const metadata = ref<LogMetadata | null>(null)
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    async function uploadLog(file: File) {
        isLoading.value = true
        error.value = null

        try {
            metadata.value = await uploadLogFile(file)
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Upload failed'
        } finally {
            isLoading.value = false
        }
    }

    return {
        metadata,
        isLoading,
        error,
        uploadLog
    }
}, {
    persist: true
})