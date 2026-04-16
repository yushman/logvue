import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useLogStore} from '../stores/useLogStore'
import {getTagColor} from '../utils/tagColors'
import styles from './MessageInspector.module.css'

const MIN_WIDTH = 200
const MAX_WIDTH = 600

function formatDateTime(timestamp: number): string {
    const date = new Date(timestamp)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${date.getMilliseconds().toString().padStart(3, '0')}`
}

function getLevelClass(level: string): string {
    return `level${level.charAt(0) + level.slice(1).toLowerCase()}`
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export default function MessageInspector() {
    const {
        selectedEntryId,
        entries,
        pinnedEntryIds,
        togglePin,
        setSelectedEntryId,
        searchHighlightRanges
    } = useLogStore()

    const [width, setWidth] = useState(300)
    const [isResizing, setIsResizing] = useState(false)
    const panelRef = useRef<HTMLAsideElement>(null)
    const startXRef = useRef(0)
    const startWidthRef = useRef(300)

    useEffect(() => {
        if (!isResizing) return

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = startXRef.current - e.clientX
            const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + deltaX))
            setWidth(newWidth)
        }

        const handleMouseUp = () => {
            setIsResizing(false)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing])

    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        startXRef.current = e.clientX
        startWidthRef.current = panelRef.current?.offsetWidth ?? 300
        setIsResizing(true)
    }, [])

    const selectedEntry = useMemo(() => {
        return entries.find(e => e.id === selectedEntryId) || null
    }, [entries, selectedEntryId])

    const isPinned = selectedEntryId ? pinnedEntryIds.includes(selectedEntryId) : false

    const currentIndex = selectedEntry ? entries.findIndex(e => e.id === selectedEntryId) : -1
    const hasPrev = currentIndex > 0
    const hasNext = currentIndex < entries.length - 1

    const handleStar = useCallback(() => {
        if (selectedEntryId) {
            togglePin(selectedEntryId)
        }
    }, [selectedEntryId, togglePin])

    const handleCopy = useCallback(() => {
        if (selectedEntry) {
            const text = `${selectedEntry.header.tag || ''} ${selectedEntry.message}`
            navigator.clipboard.writeText(text)
        }
    }, [selectedEntry])

    const handlePrev = useCallback(() => {
        if (hasPrev) {
            setSelectedEntryId(entries[currentIndex - 1].id)
        }
    }, [hasPrev, currentIndex, entries, setSelectedEntryId])

    const handleNext = useCallback(() => {
        if (hasNext) {
            setSelectedEntryId(entries[currentIndex + 1].id)
        }
    }, [hasNext, currentIndex, entries, setSelectedEntryId])

    if (!selectedEntry) {
        return (
            <aside className={styles.inspector} ref={panelRef} style={{width}}>
                <div
                    className={`${styles.resizeHandle} ${isResizing ? styles.resizeHandleActive : ''}`}
                    onMouseDown={handleResizeStart}
                />
                <div className={styles.empty}>
                    Select a log entry to inspect
                </div>
            </aside>
        )
    }

    const ranges = searchHighlightRanges[String(selectedEntry.id)] || []
    const highlightedMessage = ranges.length === 0
        ? escapeHtml(selectedEntry.message)
        : (() => {
            const escaped = escapeHtml(selectedEntry.message)
            let result = escaped
            for (const [start, end] of ranges.reverse()) {
                const before = result.slice(0, start)
                const highlighted = result.slice(start, end)
                const after = result.slice(end)
                result = `${before}<mark>${highlighted}</mark>${after}`
            }
            return result
        })()

    return (
        <aside className={styles.inspector} ref={panelRef} style={{width}}>
            <div
                className={`${styles.resizeHandle} ${isResizing ? styles.resizeHandleActive : ''}`}
                onMouseDown={handleResizeStart}
            />
            <div className={styles.toolbar}>
                <button
                    className={`${styles.actionBtn} ${isPinned ? styles.actionBtnActive : ''}`}
                    onClick={handleStar}
                    title={isPinned ? 'Unstar' : 'Star'}
                    style={isPinned ? {color: '#9370DB'} : {}}
                >
                    <svg className={styles.actionBtnIcon} viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'}
                         stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                    </svg>
                </button>
                <button
                    className={styles.actionBtn}
                    onClick={handleCopy}
                    title="Copy to clipboard"
                >
                    <svg className={styles.actionBtnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                </button>
                <button
                    className={styles.actionBtn}
                    onClick={handlePrev}
                    disabled={!hasPrev}
                    title="Previous entry"
                >
                    <svg className={styles.actionBtnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                    </svg>
                </button>
                <button
                    className={styles.actionBtn}
                    onClick={handleNext}
                    disabled={!hasNext}
                    title="Next entry"
                >
                    <svg className={styles.actionBtnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                    </svg>
                </button>
                <div className={styles.spacer}/>
            </div>

            <div className={styles.content}>
                <div className={styles.entryHeader}>
                    <div className={styles.metaRow}>
                        <span className={`${styles.levelBadge} ${getLevelClass(selectedEntry.header.logLevel)}`}>
                            {selectedEntry.header.logLevel}
                        </span>
                        <span className={styles.timestamp}>
                            {formatDateTime(selectedEntry.timestamp)}
                        </span>
                    </div>
                    <div className={styles.metaRow}>
                        <span
                            className={styles.tag}
                            style={{color: getTagColor(selectedEntry.header.tag || '')}}
                        >
                            {selectedEntry.header.tag || '---'}
                        </span>
                        {selectedEntry.header.pid && (
                            <span className={styles.pid}>PID: {selectedEntry.header.pid}</span>
                        )}
                    </div>
                </div>
                <div
                    className={styles.messageBody}
                    dangerouslySetInnerHTML={{__html: highlightedMessage}}
                />
            </div>
        </aside>
    )
}