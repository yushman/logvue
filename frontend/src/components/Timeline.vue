<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { TimelineBucket } from '../types/LogEntry'

const props = defineProps<{
    buckets: TimelineBucket[]
    tagColors: Record<string, string>
    timeRange: { startTimestamp: number; endTimestamp: number }
    selectedRange: { from: number; to: number } | null
    resolution: 'sec' | 'min' | 'hour'
}>()

const emit = defineEmits<{
    (e: 'range-select', range: { from: number; to: number } | null): void
}>()

function clearSelection() {
    emit('range-select', null)
}

const containerRef = ref<HTMLDivElement | null>(null)
const containerWidth = ref(800)
const containerHeight = 120

const margin = { top: 10, right: 10, bottom: 25, left: 10 }
const chartWidth = computed(() => containerWidth.value - margin.left - margin.right)
const chartHeight = containerHeight - margin.top - margin.bottom

const bucketSizeMs = computed(() => {
    switch (props.resolution) {
        case 'min': return 60_000
        case 'hour': return 3_600_000
        default: return 1_000
    }
})

// Aggregate buckets if there are too many to render meaningfully
const MIN_BAR_WIDTH = 3 // minimum pixels per bar
const aggregatedBuckets = computed(() => {
    const buckets = props.buckets
    if (buckets.length === 0) return []

    const maxBars = Math.floor(chartWidth.value / MIN_BAR_WIDTH)

    if (buckets.length <= maxBars) {
        return buckets
    }

    // Need to aggregate
    const aggregated: TimelineBucket[] = []
    const bucketsPerGroup = Math.ceil(buckets.length / maxBars)

    for (let i = 0; i < buckets.length; i += bucketsPerGroup) {
        const group = buckets.slice(i, i + bucketsPerGroup)
        const firstTs = group[0].timestamp
        const totalCount = group.reduce((sum, b) => sum + b.count, 0)
        const mergedTags: Record<string, number> = {}

        for (const b of group) {
            for (const [tag, count] of Object.entries(b.tags)) {
                mergedTags[tag] = (mergedTags[tag] || 0) + count
            }
        }

        aggregated.push({
            timestamp: firstTs,
            count: totalCount,
            tags: mergedTags
        })
    }

    return aggregated
})

const maxCount = computed(() => Math.max(1, ...aggregatedBuckets.value.map(b => b.count)))

function timestampToX(ts: number): number {
    const { startTimestamp, endTimestamp } = props.timeRange
    const range = endTimestamp - startTimestamp
    if (range === 0) return margin.left
    return margin.left + ((ts - startTimestamp) / range) * chartWidth.value
}

function xToTimestamp(x: number): number {
    const { startTimestamp, endTimestamp } = props.timeRange
    const ratio = (x - margin.left) / chartWidth.value
    return startTimestamp + ratio * (endTimestamp - startTimestamp)
}

const barWidth = computed(() => {
    if (aggregatedBuckets.value.length === 0) return 2
    return Math.max(MIN_BAR_WIDTH, chartWidth.value / aggregatedBuckets.value.length - 1)
})

function getBarHeight(count: number): number {
    return (count / maxCount.value) * chartHeight
}

function getDominantTag(bucket: TimelineBucket): string {
    let maxCount = 0
    let dominant = '(no tag)'
    for (const [tag, count] of Object.entries(bucket.tags)) {
        if (count > maxCount) {
            maxCount = count
            dominant = tag
        }
    }
    return dominant
}

function getBarColor(bucket: TimelineBucket): string {
    const tag = getDominantTag(bucket)
    return props.tagColors[tag] || '#999999'
}

function formatTime(ts: number): string {
    const d = new Date(ts)
    if (props.resolution === 'hour') {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (props.resolution === 'min') {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatTooltip(bucket: TimelineBucket): string {
    const time = formatTime(bucket.timestamp)
    const tagLines = Object.entries(bucket.tags)
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => `${tag}: ${count}`)
        .join(', ')
    return `${time} — ${tagLines}`
}

// Drag selection state
const isDragging = ref(false)
const dragStart = ref<number | null>(null)
const dragEnd = ref<number | null>(null)

const selectionRect = computed(() => {
    if (!isDragging.value || dragStart.value === null || dragEnd.value === null) return null
    const from = Math.min(dragStart.value, dragEnd.value)
    const to = Math.max(dragStart.value, dragEnd.value)
    return {
        x: timestampToX(from),
        width: timestampToX(to) - timestampToX(from)
    }
})

function handleMouseDown(event: MouseEvent) {
    if (event.button !== 0) return
    isDragging.value = true
    dragStart.value = xToTimestamp(event.offsetX)
    dragEnd.value = dragStart.value
}

function handleMouseMove(event: MouseEvent) {
    if (!isDragging.value) return
    dragEnd.value = xToTimestamp(event.offsetX)
}

function handleMouseUp(_event: MouseEvent) {
    if (!isDragging.value || dragStart.value === null || dragEnd.value === null) {
        isDragging.value = false
        return
    }
    const from = Math.min(dragStart.value, dragEnd.value)
    const to = Math.max(dragStart.value, dragEnd.value)
    isDragging.value = false
    dragEnd.value = null
    dragStart.value = null

    // Only emit if it's a meaningful selection (more than one bucket)
    if (to - from >= bucketSizeMs.value) {
        emit('range-select', { from, to: to + bucketSizeMs.value })
    } else {
        // Single click - filter from log start to clicked bucket end
        // Use timestamp 0 as the start (will be clamped by actual log start)
        emit('range-select', { from: 0, to: from + bucketSizeMs.value })
    }
}

function handleClick(event: MouseEvent) {
    if (isDragging.value) return
    const ts = xToTimestamp(event.offsetX)

    // If clicking on the already selected range, clear it (toggle behavior)
    if (props.selectedRange && ts >= props.selectedRange.from && ts <= props.selectedRange.to) {
        emit('range-select', null)
        return
    }

    emit('range-select', { from: ts, to: ts + bucketSizeMs.value })
}

// Resize observer
let resizeObserver: ResizeObserver | null = null

function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && props.selectedRange) {
        emit('range-select', null)
    }
}

onMounted(() => {
    if (containerRef.value) {
        resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                containerWidth.value = entry.contentRect.width
            }
        })
        resizeObserver.observe(containerRef.value)
        containerWidth.value = containerRef.value.clientWidth
    }
    window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
    resizeObserver?.disconnect()
    window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
    <div class="timeline" ref="containerRef">
        <svg
            :width="containerWidth"
            :height="containerHeight"
            @mousedown="handleMouseDown"
            @mousemove="handleMouseMove"
            @mouseup="handleMouseUp"
            @mouseleave="handleMouseUp"
        >
            <!-- Background -->
            <rect
                :x="margin.left"
                :y="margin.top"
                :width="chartWidth"
                :height="chartHeight"
                fill="#f5f5f5"
                @click="handleClick"
            />

            <!-- Selection highlight -->
            <rect
                v-if="selectionRect"
                :x="selectionRect.x"
                :y="margin.top"
                :width="selectionRect.width"
                :height="chartHeight"
                fill="rgba(74, 144, 217, 0.3)"
            />

            <!-- Selected range from store -->
            <rect
                v-if="selectedRange"
                :x="timestampToX(selectedRange.from)"
                :y="margin.top"
                :width="timestampToX(selectedRange.to) - timestampToX(selectedRange.from)"
                :height="chartHeight"
                fill="rgba(74, 144, 217, 0.3)"
                stroke="#4a90d9"
                stroke-width="2"
            />

            <!-- Bucket bars -->
            <g v-for="bucket in aggregatedBuckets" :key="bucket.timestamp">
                <rect
                    :x="timestampToX(bucket.timestamp) - barWidth / 2"
                    :y="margin.top + chartHeight - getBarHeight(bucket.count)"
                    :width="barWidth"
                    :height="getBarHeight(bucket.count)"
                    :fill="getBarColor(bucket)"
                    opacity="0.8"
                >
                    <title>{{ formatTooltip(bucket) }}</title>
                </rect>
            </g>

            <!-- Time axis -->
            <line
                :x1="margin.left"
                :y1="margin.top + chartHeight"
                :x2="margin.left + chartWidth"
                :y2="margin.top + chartHeight"
                stroke="#ccc"
                stroke-width="1"
            />
        </svg>

        <!-- Tick labels -->
        <div class="timeline-labels" v-if="aggregatedBuckets.length > 0">
            <span>{{ formatTime(timeRange.startTimestamp) }}</span>
            <span>{{ formatTime(timeRange.endTimestamp) }}</span>
        </div>
    </div>
</template>

<style scoped>
.timeline {
    width: 100%;
    background: #fff;
    border-bottom: 1px solid #ddd;
    user-select: none;
    cursor: crosshair;
}

.timeline svg {
    display: block;
}

.timeline-labels {
    display: flex;
    justify-content: space-between;
    padding: 0.2rem 0.5rem;
    font-size: 0.7rem;
    color: #666;
}
</style>
