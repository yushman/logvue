<script setup lang="ts">
import {ref, watch} from 'vue'
import {useLogStore} from '../stores/logStore'

const logStore = useLogStore()

function epochToDatetimeLocal(epoch: number | null): string {
    if (epoch == null) return ''
    const date = new Date(epoch)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function datetimeLocalToEpoch(datetime: string): number | null {
    if (!datetime) return null
    return new Date(datetime).getTime()
}

const timeFromLocal = ref(epochToDatetimeLocal(logStore.filters.timeFrom))
const timeToLocal = ref(epochToDatetimeLocal(logStore.filters.timeTo))

// Pre-fill from metadata when it becomes available
watch(() => logStore.metadata, (meta) => {
    if (meta?.timeRange && meta.timeRange.startTimestamp > 0) {
        if (!timeFromLocal.value) {
            timeFromLocal.value = epochToDatetimeLocal(meta.timeRange.startTimestamp)
        }
        if (!timeToLocal.value) {
            timeToLocal.value = epochToDatetimeLocal(meta.timeRange.endTimestamp)
        }
    }
}, { immediate: true })

watch(timeFromLocal, (val) => {
    logStore.setTimeFrom(datetimeLocalToEpoch(val))
})

watch(timeToLocal, (val) => {
    logStore.setTimeTo(datetimeLocalToEpoch(val))
})

function resetTimeRange() {
    const meta = logStore.metadata
    if (meta?.timeRange && meta.timeRange.startTimestamp > 0) {
        timeFromLocal.value = epochToDatetimeLocal(meta.timeRange.startTimestamp)
        timeToLocal.value = epochToDatetimeLocal(meta.timeRange.endTimestamp)
        logStore.setTimeFrom(meta.timeRange.startTimestamp)
        logStore.setTimeTo(meta.timeRange.endTimestamp)
    }
}
</script>

<template>
    <div class="time-range-picker">
        <label class="time-label">
            From:
            <input
                v-model="timeFromLocal"
                type="datetime-local"
                class="time-input"
            />
        </label>
        <label class="time-label">
            To:
            <input
                v-model="timeToLocal"
                type="datetime-local"
                class="time-input"
            />
        </label>
        <button class="reset-btn" @click="resetTimeRange">Reset</button>
    </div>
</template>

<style scoped>
.time-range-picker {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.time-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: #666;
}

.time-input {
    padding: 0.25rem 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.7rem;
    font-family: monospace;
    width: 180px;
}

.reset-btn {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    background: #e0e0e0;
    color: #333;
    transition: background-color 0.15s;
}

.reset-btn:hover {
    background: #d0d0d0;
}
</style>
