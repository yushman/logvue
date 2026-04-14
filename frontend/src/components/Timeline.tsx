import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import type {TimelineBucket} from '../types/LogEntry'
import styles from './Timeline.module.css'

interface TimelineProps {
    buckets: TimelineBucket[]
    tagColors: Record<string, string>
    timeRange: { startTimestamp: number; endTimestamp: number }
    selectedRange: { from: number; to: number } | null
    resolution: 'sec' | 'min' | 'hour'
    onRangeSelect: (range: { from: number; to: number } | null) => void
}

const MARGIN = {top: 10, right: 10, bottom: 25, left: 10}
const MIN_BAR_WIDTH = 3

export default function Timeline({
                                     buckets,
                                     tagColors,
                                     timeRange,
                                     selectedRange,
                                     resolution,
                                     onRangeSelect
                                 }: TimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [containerWidth, setContainerWidth] = useState(800)
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState<number | null>(null)
    const [dragEnd, setDragEnd] = useState<number | null>(null)

    const chartHeight = 120 - MARGIN.top - MARGIN.bottom
    const chartWidth = containerWidth - MARGIN.left - MARGIN.right

    const bucketSizeMs = useMemo(() => {
        switch (resolution) {
            case 'min':
                return 60_000
            case 'hour':
                return 3_600_000
            default:
                return 1_000
        }
    }, [resolution])

    const aggregatedBuckets = useMemo(() => {
        if (buckets.length === 0) return []

        const maxBars = Math.floor(chartWidth / MIN_BAR_WIDTH)
        if (buckets.length <= maxBars) return buckets

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
    }, [buckets, chartWidth])

    const maxCount = useMemo(() => Math.max(1, ...aggregatedBuckets.map(b => b.count)), [aggregatedBuckets])

    const timestampToX = useCallback((ts: number) => {
        const range = timeRange.endTimestamp - timeRange.startTimestamp
        if (range === 0) return MARGIN.left
        return MARGIN.left + ((ts - timeRange.startTimestamp) / range) * chartWidth
    }, [timeRange, chartWidth])

    const xToTimestamp = useCallback((x: number) => {
        const ratio = (x - MARGIN.left) / chartWidth
        return timeRange.startTimestamp + ratio * (timeRange.endTimestamp - timeRange.startTimestamp)
    }, [timeRange, chartWidth])

    const barWidth = useMemo(() => {
        if (aggregatedBuckets.length === 0) return 2
        return Math.max(MIN_BAR_WIDTH, chartWidth / aggregatedBuckets.length - 1)
    }, [aggregatedBuckets, chartWidth])

    const getBarHeight = (count: number) => (count / maxCount) * chartHeight

    const getDominantTag = (bucket: TimelineBucket): string => {
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

    const getBarColor = (bucket: TimelineBucket) => {
        const tag = getDominantTag(bucket)
        return tagColors[tag] || '#999999'
    }

    const formatTime = (ts: number) => {
        const d = new Date(ts)
        return d.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: resolution === 'hour' || resolution === 'min' ? undefined : '2-digit'
        })
    }

    const formatTooltip = (bucket: TimelineBucket) => {
        const time = formatTime(bucket.timestamp)
        const tagLines = Object.entries(bucket.tags)
            .sort((a, b) => b[1] - a[1])
            .map(([tag, count]) => `${tag}: ${count}`)
            .join(', ')
        return `${time} — ${tagLines}`
    }

    const selectionRect = useMemo(() => {
        if (!isDragging || dragStart === null || dragEnd === null) return null
        const from = Math.min(dragStart, dragEnd)
        const to = Math.max(dragStart, dragEnd)
        return {
            x: timestampToX(from),
            width: timestampToX(to) - timestampToX(from)
        }
    }, [isDragging, dragStart, dragEnd, timestampToX])

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return
        setIsDragging(true)
        setDragStart(xToTimestamp(e.nativeEvent.offsetX))
        setDragEnd(xToTimestamp(e.nativeEvent.offsetX))
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return
        setDragEnd(xToTimestamp(e.nativeEvent.offsetX))
    }

    const handleMouseUp = () => {
        if (!isDragging || dragStart === null || dragEnd === null) {
            setIsDragging(false)
            return
        }
        const from = Math.min(dragStart, dragEnd)
        const to = Math.max(dragStart, dragEnd)
        setIsDragging(false)
        setDragEnd(null)
        setDragStart(null)

        if (to - from >= bucketSizeMs) {
            onRangeSelect({from, to: to + bucketSizeMs})
        } else {
            onRangeSelect({from: 0, to: from + bucketSizeMs})
        }
    }

    const handleClick = (e: React.MouseEvent) => {
        if (isDragging) return
        const ts = xToTimestamp(e.nativeEvent.offsetX)

        if (selectedRange && ts >= selectedRange.from && ts <= selectedRange.to) {
            onRangeSelect(null)
            return
        }

        onRangeSelect({from: ts, to: ts + bucketSizeMs})
    }

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape' && selectedRange) {
            onRangeSelect(null)
        }
    }, [selectedRange, onRangeSelect])

    useEffect(() => {
        if (containerRef.current) {
            const observer = new ResizeObserver(entries => {
                for (const entry of entries) {
                    setContainerWidth(entry.contentRect.width)
                }
            })
            observer.observe(containerRef.current)
            setContainerWidth(containerRef.current.clientWidth)
            return () => observer.disconnect()
        }
    }, [])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    return (
        <div className={styles.container} ref={containerRef}>
            <svg
                width={containerWidth}
                height={120}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <rect
                    x={MARGIN.left}
                    y={MARGIN.top}
                    width={chartWidth}
                    height={chartHeight}
                    fill="#f5f5f5"
                    onClick={handleClick}
                />

                {selectionRect && (
                    <rect
                        x={selectionRect.x}
                        y={MARGIN.top}
                        width={selectionRect.width}
                        height={chartHeight}
                        fill="rgba(74, 144, 217, 0.3)"
                    />
                )}

                {selectedRange && (
                    <rect
                        x={timestampToX(selectedRange.from)}
                        y={MARGIN.top}
                        width={timestampToX(selectedRange.to) - timestampToX(selectedRange.from)}
                        height={chartHeight}
                        fill="rgba(74, 144, 217, 0.3)"
                        stroke="#4a90d9"
                        strokeWidth={2}
                    />
                )}

                {aggregatedBuckets.map(bucket => (
                    <rect
                        key={bucket.timestamp}
                        x={timestampToX(bucket.timestamp) - barWidth / 2}
                        y={MARGIN.top + chartHeight - getBarHeight(bucket.count)}
                        width={barWidth}
                        height={getBarHeight(bucket.count)}
                        fill={getBarColor(bucket)}
                        opacity={0.8}
                    >
                        <title>{formatTooltip(bucket)}</title>
                    </rect>
                ))}

                <line
                    x1={MARGIN.left}
                    y1={MARGIN.top + chartHeight}
                    x2={MARGIN.left + chartWidth}
                    y2={MARGIN.top + chartHeight}
                    stroke="#ccc"
                    strokeWidth={1}
                />
            </svg>

            {aggregatedBuckets.length > 0 && (
                <div className={styles.labels}>
                    <span>{formatTime(timeRange.startTimestamp)}</span>
                    <span>{formatTime(timeRange.endTimestamp)}</span>
                </div>
            )}
        </div>
    )
}
