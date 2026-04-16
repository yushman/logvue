import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {scaleBand} from '@visx/scale'
import {Group} from '@visx/group'
import {AxisBottom} from '@visx/axis'
import type {TimelineBucket} from '../types/LogEntry'
import styles from './Timeline.module.css'

interface TimelineProps {
    buckets: TimelineBucket[]
    tagColors: Record<string, string>
    timeRange: { startTimestamp: number; endTimestamp: number }
    selectedRange: { from: number; to: number } | null
    onRangeSelect: (range: { from: number; to: number } | null) => void
}

const MARGIN = {top: 10, right: 10, bottom: 40, left: 10}
const CHART_HEIGHT = 120
const MAX_SEGMENTS = 5
const GRAY = '#999999'
const NUM_BUCKETS = 30

interface BucketSegment {
    tag: string
    count: number
    color: string
    y0: number
    height: number
}

interface BucketSegments {
    bucket: TimelineBucket
    segments: BucketSegment[]
}

function computeSegments(
    buckets: TimelineBucket[],
    tagColors: Record<string, string>,
    chartHeight: number
): BucketSegments[] {
    if (buckets.length === 0) return []

    const maxCount = Math.max(1, ...buckets.map(b => b.count))
    const availableHeight = chartHeight - MARGIN.top - MARGIN.bottom

    return buckets.map((bucket) => {
        const sortedTags = Object.entries(bucket.tags)
            .sort((a, b) => b[1] - a[1])

        const topTags = sortedTags.slice(0, MAX_SEGMENTS)
        const otherTags = sortedTags.slice(MAX_SEGMENTS)
        const otherCount = otherTags.reduce((sum, [, c]) => sum + c, 0)

        const segments: BucketSegment[] = []
        let cumulative = 0

        for (const [tag, count] of topTags) {
            const segHeight = (count / maxCount) * availableHeight
            segments.push({
                tag,
                count,
                color: tagColors[tag] || GRAY,
                y0: cumulative,
                height: segHeight
            })
            cumulative += segHeight
        }

        if (otherCount > 0) {
            const segHeight = (otherCount / maxCount) * availableHeight
            segments.push({
                tag: `+${otherTags.length} more`,
                count: otherCount,
                color: GRAY,
                y0: cumulative,
                height: segHeight
            })
        }

        return {bucket, segments}
    })
}

function formatTime(ts: number, showMillis: boolean = false): string {
    const d = new Date(ts)
    const base = d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    })
    if (showMillis) {
        const millis = d.getMilliseconds()
        return `${base}.${millis.toString().padStart(3, '0')}`
    }
    return base
}

function formatTooltip(bucket: TimelineBucket, segments: BucketSegment[]): string {
    const time = formatTime(bucket.timestamp)
    const tagLines = segments
        .map(s => `${s.tag}: ${s.count}`)
        .join(', ')
    return `${time} — ${tagLines}`
}

export default function Timeline({
                                     buckets,
                                     tagColors,
                                     timeRange,
                                     selectedRange,
                                     onRangeSelect
                                 }: TimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [containerWidth, setContainerWidth] = useState(800)

    const chartWidth = containerWidth - MARGIN.left - MARGIN.right
    const chartHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom

    const bucketSizeMs = useMemo(() => {
        const total = timeRange.endTimestamp - timeRange.startTimestamp
        return total / NUM_BUCKETS
    }, [timeRange])

    const segments = useMemo(
        () => computeSegments(buckets, tagColors, chartHeight + MARGIN.top + MARGIN.bottom),
        [buckets, tagColors, chartHeight]
    )

    const timestampToX = useCallback((ts: number) => {
        const range = timeRange.endTimestamp - timeRange.startTimestamp
        if (range === 0) return MARGIN.left
        return MARGIN.left + ((ts - timeRange.startTimestamp) / range) * chartWidth
    }, [timeRange, chartWidth])

    const handleBarClick = useCallback(
        (bucketIndex: number) => {
            if (buckets[bucketIndex]?.count === 0) return
            const bucketStart = Math.floor(timeRange.startTimestamp + bucketIndex * bucketSizeMs)
            const isLastBucket = bucketIndex === buckets.length - 1
            const bucketEnd = isLastBucket
                ? timeRange.endTimestamp
                : Math.floor(bucketStart + bucketSizeMs)
            onRangeSelect({from: bucketStart, to: bucketEnd})
        },
        [timeRange, bucketSizeMs, onRangeSelect]
    )

    // Selected range overlay rect
    const selectedOverlay = useMemo(() => {
        if (!selectedRange) return null
        const x = timestampToX(selectedRange.from)
        const width = timestampToX(selectedRange.to) - x
        return {x, width}
    }, [selectedRange, timestampToX])

    // Dynamic tick labels: show ~6 evenly spaced labels
    const tickCount = 6
    const tickStep = Math.max(1, Math.floor(buckets.length / tickCount))

    useEffect(() => {
        if (!containerRef.current) return
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width)
            }
        })
        observer.observe(containerRef.current)
        setContainerWidth(containerRef.current.clientWidth)
        return () => observer.disconnect()
    }, [])

    return (
        <div className={styles.container} ref={containerRef}>
            <svg width={containerWidth} height={CHART_HEIGHT}>
                <AxisBottom
                    top={CHART_HEIGHT - MARGIN.bottom}
                    left={MARGIN.left}
                    scale={scaleBand({
                        domain: buckets.map((_, i) => i.toString()),
                        range: [0, chartWidth],
                        padding: 0.1
                    })}
                    stroke="#ccc"
                    tickFormat={(i) => {
                        const idx = parseInt(i)
                        if (idx < 0 || idx >= buckets.length) return ''
                        if (idx % tickStep !== 0) return ''
                        return formatTime(buckets[idx].timestamp, bucketSizeMs < 10_000)
                    }}
                    tickLength={4}
                    tickStroke="#ccc"
                    tickLabelProps={() => ({
                        fill: '#666',
                        fontSize: 10,
                        textAnchor: 'middle'
                    })}
                />

                {/* Selected range overlay */}
                {selectedOverlay && (
                    <rect
                        x={selectedOverlay.x}
                        y={MARGIN.top}
                        width={selectedOverlay.width}
                        height={chartHeight}
                        fill="rgba(74, 144, 217, 0.2)"
                        stroke="#4a90d9"
                        strokeWidth={1}
                    />
                )}

                <Group top={MARGIN.top} left={MARGIN.left}>
                    {segments.map((seg, i) => {
                        const barX = (i * chartWidth) / buckets.length
                        const barWidth = Math.max(2, chartWidth / buckets.length - 1)

                        return (
                            <Group
                                key={seg.bucket.timestamp}
                                left={barX}
                                onClick={() => handleBarClick(i)}
                                style={{cursor: 'pointer'}}
                            >
                                {seg.segments.map((s, si) => (
                                    <rect
                                        key={`${s.tag}-${si}`}
                                        x={0}
                                        y={chartHeight - s.y0 - s.height}
                                        width={barWidth}
                                        height={s.height}
                                        fill={s.color}
                                        opacity={0.85}
                                    >
                                        <title>{formatTooltip(seg.bucket, seg.segments)}</title>
                                    </rect>
                                ))}
                            </Group>
                        )
                    })}
                </Group>
            </svg>
        </div>
    )
}
