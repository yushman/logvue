import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useVirtualizer} from '@tanstack/react-virtual'
import {useLogStore} from '../stores/useLogStore'
import {getTagColor} from '../utils/tagColors'
import styles from './LogList.module.css'

const ROW_HEIGHT = 28

function formatDate(timestamp: number): string {
    const date = new Date(timestamp)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

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

function getLevelClass(level: string): string {
    const levelLower = level.charAt(0) + level.slice(1).toLowerCase()
    return styles[`level${levelLower}`] || ''
}

function getLevelBgColor(level: string): string {
    const colors: Record<string, string> = {
        VERBOSE: '#999999',
        DEBUG: '#377eb8',
        INFO: '#4daf4a',
        WARN: '#ff7f00',
        ERROR: '#e41a1c',
        ASSERT: '#984ea3'
    }
    return colors[level] || '#999999'
}

function getLevelTextColor(level: string): string {
    return level === 'VERBOSE' ? '#000000' : '#ffffff'
}

export default function LogList() {
    const {
        entries,
        total,
        isLoading,
        pinnedEntryIds,
        pinnedEntriesCache,
        searchHighlightRanges,
        togglePin,
        resetFilters,
        fetchFilteredLogs,
        setSelectedEntryId,
        selectedEntryId,
        pagination,
        maxLogsReached,
        loadMore,
        filters,
        setSearchParams,
        setSearchCaseSensitive,
        setSearchRegex,
        clearSearch
    } = useLogStore()

    const hasMore = entries.length < total
    const parentRef = useRef<HTMLDivElement>(null)
    const pinnedRef = useRef<HTMLDivElement>(null)
    const [viewportHeight, setViewportHeight] = useState(0)
    const [searchInput, setSearchInput] = useState('')
    const loadMoreRef = useRef(false)
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Debounced search - uses current toggle state at debounce time
    const handleSearchChange = (value: string) => {
        setSearchInput(value)
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }
        searchTimeoutRef.current = setTimeout(() => {
            // Capture current toggle state when debounce fires
            setSearchParams(value || null, filters.searchCaseSensitive, filters.searchRegex)
        }, 500)
    }

    const handleClearSearch = () => {
        setSearchInput('')
        clearSearch()
    }

    const pinnedIdsSet = useMemo(() => new Set(pinnedEntryIds), [pinnedEntryIds])

    const filteredPinnedEntries = useMemo(() => {
        if (pinnedEntriesCache.length === 0) return []

        return pinnedEntriesCache.filter(entry => {
            if (!pinnedIdsSet.has(entry.id)) {
                return false
            }
            if (filters.levels.length > 0 && !filters.levels.includes(entry.header.logLevel)) {
                return false
            }
            if (filters.timeFrom !== null && entry.timestamp < filters.timeFrom) {
                return false
            }
            if (filters.timeTo !== null && entry.timestamp > filters.timeTo) {
                return false
            }
            if (filters.tagPattern) {
                const tag = entry.header.tag || ''
                if (filters.tagRegex) {
                    try {
                        const regex = new RegExp(filters.tagPattern)
                        if (!regex.test(tag)) return false
                    } catch {
                        return false
                    }
                } else {
                    if (!tag.includes(filters.tagPattern)) return false
                }
            }
            if (filters.contentFilter) {
                if (!entry.message.toLowerCase().includes(filters.contentFilter.toLowerCase())) {
                    return false
                }
            }
            if (filters.searchQuery) {
                if (!entry.message.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
                    return false
                }
            }
            return true
        })
    }, [pinnedEntriesCache, filters, pinnedIdsSet])

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

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const {scrollTop, scrollHeight, clientHeight} = e.currentTarget
        if (hasMore && scrollTop + clientHeight >= scrollHeight - 100) {
            if (maxLogsReached) {
                return
            }
            loadMore()
        }
    }, [hasMore, maxLogsReached, loadMore])

    const clearFiltersAndRefetch = () => {
        resetFilters()
        fetchFilteredLogs()
    }

    const handleRowClick = (entryId: number) => {
        setSelectedEntryId(entryId)
    }

    const handleStarClick = (e: React.MouseEvent, entryId: number) => {
        e.stopPropagation()
        togglePin(entryId)
    }

    if (isLoading && entries.length === 0) {
        return (
            <div className={styles.container}>
                <div className={styles.empty}>
                    <span>Loading...</span>
                </div>
            </div>
        )
    }

    if (entries.length === 0) {
        return (
            <div className={styles.container}>
                <div className={styles.toolbar}>
                    <div className={styles.searchContainer}>
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Search..."
                            value={searchInput}
                            onChange={e => handleSearchChange(e.target.value)}
                        />
                        {searchInput && (
                            <button className={styles.clearSearchBtn} onClick={handleClearSearch} title="Clear search">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                     strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        )}
                        <button
                            className={`${styles.searchToggleBtn} ${filters.searchCaseSensitive ? styles.searchToggleBtnActive : ''}`}
                            onClick={() => {
                                // Cancel any pending debounce and send all params together
                                if (searchTimeoutRef.current) {
                                    clearTimeout(searchTimeoutRef.current)
                                }
                                setSearchParams(searchInput || null, !filters.searchCaseSensitive, filters.searchRegex)
                            }}
                            title="Match case"
                        >
                            Aa
                        </button>
                        <button
                            className={`${styles.searchToggleBtn} ${filters.searchRegex ? styles.searchToggleBtnActive : ''}`}
                            onClick={() => {
                                // Cancel any pending debounce and send all params together
                                if (searchTimeoutRef.current) {
                                    clearTimeout(searchTimeoutRef.current)
                                }
                                setSearchParams(searchInput || null, filters.searchCaseSensitive, !filters.searchRegex)
                            }}
                            title="Use regex"
                        >
                            .*
                        </button>
                    </div>
                </div>
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
            <div className={styles.toolbar}>
                <div className={styles.searchContainer}>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search..."
                        value={searchInput}
                        onChange={e => handleSearchChange(e.target.value)}
                    />
                    {searchInput && (
                        <button className={styles.clearSearchBtn} onClick={handleClearSearch} title="Clear search">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    )}
                    <button
                        className={`${styles.searchToggleBtn} ${filters.searchCaseSensitive ? styles.searchToggleBtnActive : ''}`}
                        onClick={() => {
                            if (searchTimeoutRef.current) {
                                clearTimeout(searchTimeoutRef.current)
                            }
                            setSearchParams(searchInput || null, !filters.searchCaseSensitive, filters.searchRegex)
                        }}
                        title="Match case"
                    >
                        Aa
                    </button>
                    <button
                        className={`${styles.searchToggleBtn} ${filters.searchRegex ? styles.searchToggleBtnActive : ''}`}
                        onClick={() => {
                            if (searchTimeoutRef.current) {
                                clearTimeout(searchTimeoutRef.current)
                            }
                            setSearchParams(searchInput || null, filters.searchCaseSensitive, !filters.searchRegex)
                        }}
                        title="Use regex"
                    >
                        .*
                    </button>
                </div>
                <div className={styles.toolbarRight}>
                    {pinnedEntryIds.length > 0 && (
                        <div className={`${styles.infoBadge} ${styles.infoBadgeBookmarks}`}>
                            <span>★</span>
                            <span className={styles.infoBadgeCount}>{filteredPinnedEntries.length}</span>
                        </div>
                    )}
                    <div className={styles.infoBadge}>
                        <span className={styles.infoBadgeCount}>{entries.length.toLocaleString()}</span>
                        <span>/</span>
                        <span>{total.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {filteredPinnedEntries.length > 0 && (
                <div
                    ref={pinnedRef}
                    className={styles.pinnedContainer}
                >
                    <div className={styles.headerRow}>
                        <div className={`${styles.headerCell} ${styles.starCol}`}>★</div>
                        <div className={`${styles.headerCell} ${styles.dateCol}`}>Date</div>
                        <div className={`${styles.headerCell} ${styles.timeCol}`}>Time</div>
                        <div className={`${styles.headerCell} ${styles.tagCol}`}>Tag</div>
                        <div className={`${styles.headerCell} ${styles.levelCol}`}>L</div>
                        <div className={`${styles.headerCell} ${styles.messageCol}`}>Message</div>
                    </div>
                    {filteredPinnedEntries.map(item => {
                        const ranges = searchHighlightRanges[String(item.id)] || []
                        const isSelected = item.id === selectedEntryId

                        return (
                            <div
                                key={item.id}
                                className={`${styles.pinnedRow} ${isSelected ? styles.rowSelected : ''}`}
                                onClick={() => {
                                    handleRowClick(item.id)
                                    const entryIndex = entries.findIndex(e => e.id === item.id)
                                    if (entryIndex !== -1) {
                                        const virtualItems = virtualizer.getVirtualItems()
                                        const isVisible = virtualItems.some(
                                            vItem => vItem.index === entryIndex
                                        )
                                        if (!isVisible) {
                                            virtualizer.scrollToIndex(entryIndex, {align: 'auto'})
                                        }
                                    }
                                }}
                            >
                                <div className={`${styles.cell} ${styles.starCell}`}>
                                    <button
                                        className={`${styles.starBtn} ${styles.starBtnActive}`}
                                        onClick={e => handleStarClick(e, item.id)}
                                        title="Unstar"
                                    >
                                        ★
                                    </button>
                                </div>
                                <div className={`${styles.cell} ${styles.dateCell}`}>
                                    <span className={styles.dateText}>{formatDate(item.timestamp)}</span>
                                </div>
                                <div className={`${styles.cell} ${styles.timeCell}`}>
                                    <span className={styles.timeText}>{formatTime(item.timestamp)}</span>
                                </div>
                                <div
                                    className={`${styles.cell} ${styles.tagCell}`}
                                    style={{color: getTagColor(item.header.tag || '')}}
                                >
                                    <span className={styles.tagText}>
                                        {item.header.tag || '---'}
                                    </span>
                                </div>
                                <div className={`${styles.cell} ${styles.levelCell}`}>
                                    <span
                                        className={styles.levelText}
                                        style={{
                                            backgroundColor: getLevelBgColor(item.header.logLevel),
                                            color: getLevelTextColor(item.header.logLevel)
                                        }}
                                    >
                                        {item.header.logLevel.charAt(0)}
                                    </span>
                                </div>
                                <div className={`${styles.cell} ${styles.messageCell}`}>
                                    <span
                                        className={`${styles.messageText} ${getLevelClass(item.header.logLevel)}`}
                                        dangerouslySetInnerHTML={{
                                            __html: renderHighlightedMessage(item.message, ranges)
                                        }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {filteredPinnedEntries.length === 0 && (
                <div className={styles.headerRow}>
                    <div className={`${styles.headerCell} ${styles.starCol}`}>★</div>
                    <div className={`${styles.headerCell} ${styles.dateCol}`}>Date</div>
                    <div className={`${styles.headerCell} ${styles.timeCol}`}>Time</div>
                    <div className={`${styles.headerCell} ${styles.tagCol}`}>Tag</div>
                    <div className={`${styles.headerCell} ${styles.levelCol}`}>L</div>
                    <div className={`${styles.headerCell} ${styles.messageCol}`}>Message</div>
                </div>
            )}

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
                        const isEven = virtualRow.index % 2 === 0
                        const isSelected = item.id === selectedEntryId
                        const isPinned = pinnedIdsSet.has(item.id)

                        return (
                            <div
                                key={item.id}
                                className={`
                                    ${styles.row}
                                    ${isEven ? styles.rowEven : styles.rowOdd}
                                    ${isSelected ? styles.rowSelected : ''}
                                `}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    width: 'max-content'
                                }}
                                onClick={() => handleRowClick(item.id)}
                            >
                                <div className={`${styles.cell} ${styles.starCell}`}>
                                    <button
                                        className={`${styles.starBtn} ${isPinned ? styles.starBtnActive : ''}`}
                                        onClick={e => handleStarClick(e, item.id)}
                                        title={isPinned ? 'Unstar' : 'Star'}
                                    >
                                        {isPinned ? '★' : '☆'}
                                    </button>
                                </div>
                                <div className={`${styles.cell} ${styles.dateCell}`}>
                                    <span className={styles.dateText}>{formatDate(item.timestamp)}</span>
                                </div>
                                <div className={`${styles.cell} ${styles.timeCell}`}>
                                    <span className={styles.timeText}>{formatTime(item.timestamp)}</span>
                                </div>
                                <div
                                    className={`${styles.cell} ${styles.tagCell}`}
                                    style={{color: getTagColor(item.header.tag || '')}}
                                >
                                    <span className={styles.tagText}>
                                        {item.header.tag || '---'}
                                    </span>
                                </div>
                                <div className={`${styles.cell} ${styles.levelCell}`}>
                                    <span
                                        className={styles.levelText}
                                        style={{
                                            backgroundColor: getLevelBgColor(item.header.logLevel),
                                            color: getLevelTextColor(item.header.logLevel)
                                        }}
                                    >
                                        {item.header.logLevel.charAt(0)}
                                    </span>
                                </div>
                                <div className={`${styles.cell} ${styles.messageCell}`}>
                                    <span
                                        className={`${styles.messageText} ${getLevelClass(item.header.logLevel)}`}
                                        dangerouslySetInnerHTML={{
                                            __html: renderHighlightedMessage(item.message, ranges)
                                        }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
                {maxLogsReached && total > entries.length && (
                    <div className={styles.endMessage}>
                        Showing {entries.length.toLocaleString()} of {total.toLocaleString()} logs. Please change time
                        range or apply filters to see more.
                    </div>
                )}
            </div>
        </div>
    )
}