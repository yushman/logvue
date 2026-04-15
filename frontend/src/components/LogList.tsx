import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useVirtualizer} from '@tanstack/react-virtual'
import {useLogStore} from '../stores/useLogStore'
import {getLogLevelColor, getTagColor} from '../utils/tagColors'
import type {LogEntry} from '../types/LogEntry'
import styles from './LogList.module.css'

const ROW_HEIGHT = 28

function formatTime(timestamp: number): string {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
    })
}

function formatDate(timestamp: number): string {
    const date = new Date(timestamp)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function renderHighlightedMessage(message: string, ranges: [number, number][]): string {
    if (ranges.length === 0) return escapeHtml(message)

    const escaped = escapeHtml(message)
    let result = escaped
    for (const [start, end] of ranges.reverse()) {
        const before = result.slice(0, start)
        const highlighted = result.slice(start, end)
        const after = result.slice(end)
        result = `${before}<mark>${highlighted}</mark>${after}`
    }
    return result
}

interface ColumnWidths {
    pin: number
    level: number
    date: number
    time: number
    tag: number
}

export default function LogList() {
    const {
        entries,
        total,
        isLoading,
        pinnedEntryIds,
        pinnedEntriesCache,
        searchHighlightRanges,
        loadMore,
        togglePin,
        resetFilters,
        fetchFilteredLogs
    } = useLogStore()

    const hasMore = entries.length < total

    const parentRef = useRef<HTMLDivElement>(null)
    const [scrollTop, setScrollTop] = useState(0)
    const [viewportHeight, setViewportHeight] = useState(0)
    const [columnWidths, setColumnWidths] = useState<ColumnWidths>({
        pin: 36,
        level: 60,
        date: 100,
        time: 100,
        tag: 120
    })
    const [dragging, setDragging] = useState<string | null>(null)
    const [dragStartX, setDragStartX] = useState(0)
    const [dragStartWidth, setDragStartWidth] = useState(0)
    const loadMoreRef = useRef(false)

    const pinnedIdsSet = useMemo(() => new Set(pinnedEntryIds), [pinnedEntryIds])

    const virtualizer = useVirtualizer({
        count: entries.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 20
    })

    useEffect(() => {
        if (parentRef.current) {
            const updateHeight = () => {
                setViewportHeight(parentRef.current!.clientHeight)
            }
            updateHeight()
            const resizeObserver = new ResizeObserver(updateHeight)
            resizeObserver.observe(parentRef.current)
            return () => resizeObserver.disconnect()
        }
    }, [])

    const stickyPinnedEntries = useMemo(() => {
        if (pinnedEntryIds.length === 0) return []

        return pinnedEntryIds
            .map(id => entries.find(e => e.id === id) ?? pinnedEntriesCache.find(e => e.id === id))
            .filter((e): e is LogEntry => e !== undefined)
    }, [pinnedEntryIds, entries, pinnedEntriesCache])

    const startDrag = useCallback((key: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragging(key)
        setDragStartX(e.clientX)
        setDragStartWidth(columnWidths[key as keyof ColumnWidths])
    }, [columnWidths])

    useEffect(() => {
        if (!dragging) return

        const onDrag = (e: MouseEvent) => {
            const delta = e.clientX - dragStartX
            setColumnWidths(prev => ({
                ...prev,
                [dragging]: Math.max(30, dragStartWidth + delta)
            }))
        }

        const onUp = () => {
            setDragging(null)
            document.removeEventListener('mousemove', onDrag)
            document.removeEventListener('mouseup', onUp)
        }

        document.addEventListener('mousemove', onDrag)
        document.addEventListener('mouseup', onUp)

        return () => {
            document.removeEventListener('mousemove', onDrag)
            document.removeEventListener('mouseup', onUp)
        }
    }, [dragging, dragStartX, dragStartWidth])

    useEffect(() => {
        if (!isLoading) {
            loadMoreRef.current = false
        }
    }, [isLoading])

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop)
        const {scrollTop, scrollHeight, clientHeight} = e.currentTarget
        console.log('scroll', {
            scrollTop,
            scrollHeight,
            clientHeight,
            diff: scrollHeight - scrollTop - clientHeight,
            hasMore
        })
        if (hasMore && !loadMoreRef.current && scrollTop + clientHeight >= scrollHeight - 100) {
            console.log('triggering loadMore')
            loadMoreRef.current = true
            loadMore()
        }
    }, [hasMore, loadMore])

    const clearFiltersAndRefetch = () => {
        resetFilters()
        fetchFilteredLogs()
    }

    const getLevelClass = (level: string) => `log-level--${level.toLowerCase()}`

    if (isLoading && entries.length === 0) {
        return (
            <div className={styles.container}>
                <div className={styles.empty}>Loading...</div>
            </div>
        )
    }

    if (entries.length === 0 && stickyPinnedEntries.length === 0) {
        return (
            <div className={styles.container}>
                <div className={styles.empty}>
                    <span>No log entries match your filters</span>
                    <button className={styles.clearFiltersBtn} onClick={clearFiltersAndRefetch}>
                        Clear filters
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <div className={styles.headerRow}>
                <div className={styles.headerCell} style={{width: columnWidths.pin}}>
                    <span>PIN</span>
                    <div className={styles.resizer} onMouseDown={e => startDrag('pin', e)}/>
                </div>
                <div className={styles.headerCell} style={{width: columnWidths.level}}>
                    <span>LEVEL</span>
                    <div className={styles.resizer} onMouseDown={e => startDrag('level', e)}/>
                </div>
                <div className={styles.headerCell} style={{width: columnWidths.date}}>
                    <span>DATE</span>
                    <div className={styles.resizer} onMouseDown={e => startDrag('date', e)}/>
                </div>
                <div className={styles.headerCell} style={{width: columnWidths.time}}>
                    <span>TIME</span>
                    <div className={styles.resizer} onMouseDown={e => startDrag('time', e)}/>
                </div>
                <div className={styles.headerCell} style={{width: columnWidths.tag}}>
                    <span>TAG</span>
                    <div className={styles.resizer} onMouseDown={e => startDrag('tag', e)}/>
                </div>
                <div className={`${styles.headerCell} ${styles.headerCellMessage}`}>
                    <span>MESSAGE</span>
                </div>
            </div>

            {stickyPinnedEntries.length > 0 && (
                <div className={styles.stickyContainer}>
                    {stickyPinnedEntries.map(item => (
                        <div key={`sticky-${item.id}`} className={`${styles.row} ${styles.pinnedRow}`}>
                            <div className={styles.cell} style={{width: columnWidths.pin}}>
                                <button
                                    className={`${styles.pinBtn} ${styles.pinBtnActive}`}
                                    onClick={() => togglePin(item.id)}
                                    title="Unpin"
                                >
                                    ★
                                </button>
                            </div>
                            <div className={styles.cell} style={{width: columnWidths.level}}>
                                <span
                                    className={getLevelClass(item.header.logLevel)}
                                    style={{color: getLogLevelColor(item.header.logLevel)}}
                                >
                                    {item.header.logLevel}
                                </span>
                            </div>
                            <div className={styles.cell} style={{width: columnWidths.date}}>
                                {formatDate(item.timestamp)}
                            </div>
                            <div className={styles.cell} style={{width: columnWidths.time}}>
                                {formatTime(item.timestamp)}
                            </div>
                            <div className={styles.cell}
                                 style={{width: columnWidths.tag, color: getTagColor(item.header.tag || '')}}>
                                {item.header.tag || '---'}
                            </div>
                            <div
                                className={`${styles.cell} ${styles.cellMessage}`}
                                dangerouslySetInnerHTML={{
                                    __html: renderHighlightedMessage(
                                        item.message,
                                        searchHighlightRanges[String(item.id)] || []
                                    )
                                }}
                            />
                        </div>
                    ))}
                </div>
            )}

            <div className={styles.hScrollWrapper}>
                <div
                    ref={parentRef}
                    className={styles.scrollArea}
                    onScroll={handleScroll}
                >
                    <div
                        style={{
                            height: `${virtualizer.getTotalSize()}px`,
                            minWidth: 'max-content',
                            position: 'relative'
                        }}
                    >
                        {virtualizer.getVirtualItems().map(virtualRow => {
                            const item = entries[virtualRow.index]
                            if (!item) return null
                            const ranges = searchHighlightRanges[String(item.id)] || []

                            return (
                                <div
                                    key={item.id}
                                    className={`${styles.row} ${pinnedIdsSet.has(item.id) ? styles.pinnedRow : ''}`}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        height: `${virtualRow.size}px`,
                                        transform: `translateY(${virtualRow.start}px)`,
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div className={styles.cell} style={{width: columnWidths.pin}}>
                                        <button
                                            className={`${styles.pinBtn} ${pinnedIdsSet.has(item.id) ? styles.pinBtnActive : ''}`}
                                            onClick={() => togglePin(item.id)}
                                            title={pinnedIdsSet.has(item.id) ? 'Unpin' : 'Pin this row'}
                                        >
                                            {pinnedIdsSet.has(item.id) ? '★' : '☆'}
                                        </button>
                                    </div>
                                    <div className={styles.cell} style={{width: columnWidths.level}}>
                                        <span
                                            className={getLevelClass(item.header.logLevel)}
                                            style={{color: getLogLevelColor(item.header.logLevel)}}
                                        >
                                            {item.header.logLevel}
                                        </span>
                                    </div>
                                    <div className={styles.cell} style={{width: columnWidths.date}}>
                                        {formatDate(item.timestamp)}
                                    </div>
                                    <div className={styles.cell} style={{width: columnWidths.time}}>
                                        {formatTime(item.timestamp)}
                                    </div>
                                    <div className={styles.cell}
                                         style={{width: columnWidths.tag, color: getTagColor(item.header.tag || '')}}>
                                        {item.header.tag || '---'}
                                    </div>
                                    <div
                                        className={`${styles.cell} ${styles.cellMessage}`}
                                        dangerouslySetInnerHTML={{
                                            __html: renderHighlightedMessage(item.message, ranges)
                                        }}
                                    />
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            <div className={styles.statusBar}>
                {entries.length} / {total} entries
            </div>
        </div>
    )
}
