import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {scaleLinear} from '@visx/scale'
import {Group} from '@visx/group'
import {interpolateRgb} from 'd3-interpolate'
import type {TimelineBucket} from '../types/LogEntry'
import {useLogStore} from '../stores/useLogStore'
import styles from './Timeline.module.css'

interface TimelineProps {
    buckets: TimelineBucket[]
    tagColors: Record<string, string>
    timeRange: { startTimestamp: number; endTimestamp: number }
    selectedRange: { from: number; to: number } | null
    onRangeSelect: (range: { from: number; to: number } | null) => void
}

const MARGIN = {top: 10, right: 20, bottom: 50, left: 10}
const CHART_HEIGHT = 120
const MAX_SEGMENTS = 5

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

const COLD_COLOR = '#3b4cc0'
const HOT_COLOR = '#b40426'

function computeSegments(
    buckets: TimelineBucket[],
    tagColors: Record<string, string>,
    chartHeight: number
): BucketSegments[] {
    if (buckets.length === 0) return []

    const maxCount = Math.max(1, ...buckets.map(b => b.count))
    const availableHeight = chartHeight - MARGIN.top - MARGIN.bottom

    // Density color scale: blue (cold/low) → red (hot/high)
    const colorScale = scaleLinear<string>()
        .domain([0, maxCount])
        .range([COLD_COLOR, HOT_COLOR])
        .interpolate(interpolateRgb as any)

    return buckets.map((bucket) => {
        const sortedTags = Object.entries(bucket.tags)
            .sort((a, b) => b[1] - a[1])

        const topTags = sortedTags.slice(0, MAX_SEGMENTS)
        const otherTags = sortedTags.slice(MAX_SEGMENTS)
        const otherCount = otherTags.reduce((sum, [, c]) => sum + c, 0)

        const barColor = colorScale(bucket.count)

        const segments: BucketSegment[] = []
        let cumulative = 0

        for (const [tag, count] of topTags) {
            const segHeight = (count / maxCount) * availableHeight
            segments.push({
                tag,
                count,
                color: barColor,
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
                color: barColor,
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

function formatTooltip(bucket: TimelineBucket, segments: BucketSegment[], startTime: number, endTime: number): string {
    const start = formatTime(startTime, true)
    const end = formatTime(endTime, true)
    const tagLines = segments
        .map(s => `${s.tag}: ${s.count}`)
        .join(', ')
    return `${start} → ${end}  |  ${tagLines}`
}

export default function Timeline({
                                     buckets,
                                     tagColors,
                                     timeRange,
                                     selectedRange,
                                     onRangeSelect
                                 }: TimelineProps) {
    const {timelineCollapsed, toggleTimelineCollapsed} = useLogStore()
    const collapsed = timelineCollapsed
    const chartRef = useRef<HTMLDivElement>(null)
    const [containerWidth, setContainerWidth] = useState(800)

    const chartWidth = containerWidth - MARGIN.left - MARGIN.right
    const chartHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom

    const toggleCollapsed = useCallback(() => {
        toggleTimelineCollapsed()
    }, [toggleTimelineCollapsed])

    const bucketSizeMs = useMemo(() => {
        const total = timeRange.endTimestamp - timeRange.startTimestamp
        return total / buckets.length
    }, [timeRange, buckets.length])

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
            const bucketStart = buckets[bucketIndex].timestamp
            const isLastBucket = bucketIndex === buckets.length - 1
            const bucketEnd = isLastBucket
                ? timeRange.endTimestamp
                : buckets[bucketIndex + 1].timestamp
            onRangeSelect({from: bucketStart, to: bucketEnd})
        },
        [buckets, timeRange, onRangeSelect]
    )

    // Selected range overlay rect - rendered only over the selected bar, not the whole timeline
    const selectedOverlay = useMemo(() => {
        if (!selectedRange || buckets.length === 0) return null
        // Find the bar that corresponds to selectedRange
        const barIndex = buckets.findIndex((b, i) => {
            const barStart = b.timestamp
            const barEnd = i === buckets.length - 1 ? timeRange.endTimestamp : buckets[i + 1].timestamp
            return selectedRange.from >= barStart && selectedRange.from < barEnd
        })
        if (barIndex === -1) return null
        const barX = (barIndex * chartWidth) / buckets.length
        const barWidth = Math.max(2, chartWidth / buckets.length - 1)
        return {x: barX, width: barWidth}
    }, [selectedRange, buckets, timeRange, chartWidth])

    // Show time legend label every Nth bucket to avoid overlap
    const legendStep = Math.max(1, Math.floor(buckets.length / 6))

    useEffect(() => {
        if (!chartRef.current) return
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width)
            }
        })
        observer.observe(chartRef.current)
        setContainerWidth(chartRef.current.clientWidth)
        return () => observer.disconnect()
    }, [])

    return (
        <div className={styles.container}>
            <div className={styles.header} onClick={toggleCollapsed}>
                <span className={styles.title}>
                    <svg
                        className={`${styles.toggleIcon} ${collapsed ? styles.toggleIconCollapsed : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                    Timeline
                </span>
            </div>
            <div className={`${styles.chartWrapper} ${collapsed ? styles.chartWrapperCollapsed : ''}`} ref={chartRef}>
                <svg width={containerWidth} height={CHART_HEIGHT}>
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
                            const barHeight = (seg.bucket.count / Math.max(1, Math.max(...buckets.map(b => b.count)))) * chartHeight
                            const barColor = seg.segments[0]?.color || COLD_COLOR

                            // Calculate midpoint time of this bucket for legend label
                            const bucketMidTime = seg.bucket.timestamp + bucketSizeMs / 2

                            return (
                                <Group
                                    key={seg.bucket.timestamp}
                                    left={barX}
                                    onClick={() => handleBarClick(i)}
                                    style={{cursor: 'pointer'}}
                                >
                                    <rect
                                        x={0}
                                        y={chartHeight - barHeight}
                                        width={barWidth}
                                        height={barHeight}
                                        fill={barColor}
                                        opacity={0.85}
                                    >
                                        <title>{formatTooltip(seg.bucket, seg.segments, seg.bucket.timestamp, seg.bucket.timestamp + bucketSizeMs)}</title>
                                    </rect>
                                    {/* Time legend label under each bar (show every Nth to avoid overlap) */}
                                    {i % legendStep === 0 && (
                                        <text
                                            x={barWidth / 2}
                                            y={chartHeight + 14}
                                            textAnchor="middle"
                                            fill="#666"
                                            fontSize={9}
                                        >
                                            {formatTime(bucketMidTime, true)}
                                        </text>
                                    )}
                                </Group>
                            )
                        })}
                    </Group>
                </svg>
            </div>
        </div>
    )
}
