import {useState} from 'react'
import {useLogStore} from '../stores/useLogStore'
import {getLogLevelColor} from '../utils/tagColors'
import styles from './Sidebar.module.css'

const LEVELS = ['VERBOSE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'ASSERT']

export default function Sidebar() {
    const {
        filters,
        setLevels,
        setTimeFrom,
        setTimeTo,
        sidebarCollapsed,
        toggleSidebarCollapsed,
        levelCounts,
        allTags,
        setTagPattern,
        fileTimeRange,
        resetTimeRange,
        hiddenTags,
        toggleHiddenTag
    } = useLogStore()

    const [tagFilter, setTagFilter] = useState('')

    const isTimeModified = fileTimeRange && (
        filters.timeFrom !== fileTimeRange.startTimestamp ||
        filters.timeTo !== fileTimeRange.endTimestamp
    )

    const handleLevelChange = (level: string, checked: boolean) => {
        const newLevels = checked
            ? [...filters.levels, level]
            : filters.levels.filter(l => l !== level)
        setLevels(newLevels)
    }

    const handleTagToggle = (tag: string, checked: boolean) => {
        if (isTagHidden(tag)) {
            toggleHiddenTag(tag)
            return
        }
        const currentTags = filters.tagPattern ? filters.tagPattern.split('|').filter(Boolean) : []
        const newTags = checked
            ? [...currentTags, tag]
            : currentTags.filter(t => t !== tag)
        setTagPattern(newTags.join('|'), false)
    }

    const isTagChecked = (tag: string) => {
        return filters.tagPattern.split('|').includes(tag)
    }

    const isTagHidden = (tag: string) => {
        return hiddenTags.includes(tag)
    }

    const sortedTags = [...allTags].sort((a, b) => {
        const aChecked = isTagChecked(a.tag)
        const bChecked = isTagChecked(b.tag)
        const aHidden = isTagHidden(a.tag)
        const bHidden = isTagHidden(b.tag)
        if (aChecked && !bChecked) return -1
        if (!aChecked && bChecked) return 1
        if (aHidden && !bHidden) return 1
        if (!aHidden && bHidden) return -1
        return b.count - a.count
    })

    // Filter only applies to unchecked tags when filter text is present
    const showFiltered = tagFilter.length > 0
    const checkedTags = sortedTags.filter(t => isTagChecked(t.tag) && !isTagHidden(t.tag))
    const uncheckedTags = showFiltered
        ? sortedTags.filter(t => !isTagChecked(t.tag) && !isTagHidden(t.tag) && t.tag.toLowerCase().includes(tagFilter.toLowerCase()))
        : sortedTags.filter(t => !isTagChecked(t.tag) && !isTagHidden(t.tag))
    const hiddenTagsList = sortedTags.filter(t => isTagHidden(t.tag))

    const handleTimeFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        if (value) {
            setTimeFrom(new Date(value).getTime())
        } else {
            setTimeFrom(null)
        }
    }

    const handleTimeToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        if (value) {
            setTimeTo(new Date(value).getTime())
        } else {
            setTimeTo(null)
        }
    }

    const formatTimestamp = (ts: number | null): string => {
        if (!ts) return ''
        const date = new Date(ts)
        const pad = (n: number) => n.toString().padStart(2, '0')
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    return (
        <aside className={styles.sidebar}>
            {/* Time filter */}
            <div className={styles.section}>
                <div className={styles.sectionHeader} onClick={() => toggleSidebarCollapsed('time')}>
                    <span className={styles.sectionTitle}>Time</span>
                    <svg
                        className={`${styles.collapseIcon} ${sidebarCollapsed.time ? styles.collapseIconCollapsed : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                </div>
                <div
                    className={`${styles.sectionContent} ${sidebarCollapsed.time ? styles.sectionContentCollapsed : ''}`}>
                    <div className={styles.timeFilters}>
                        <div className={styles.timeRow}>
                            <input
                                type="datetime-local"
                                className={styles.timeInput}
                                value={formatTimestamp(filters.timeFrom)}
                                onChange={handleTimeFromChange}
                                placeholder="From"
                            />
                            {isTimeModified && (
                                <button className={styles.resetBtn} onClick={resetTimeRange} title="Reset time range">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                              d="M4 4v5h.582m0 0a8.001 8.001 0 0115.356 2M4.582 21H5m0 0v-5m0 5a8.001 8.001 0 01-2.743-5.425M19.424 14.575A8.001 8.001 0 0119.42 19m0 0a8.001 8.001 0 01-15.356-2m15.356 2H19"/>
                                    </svg>
                                </button>
                            )}
                        </div>
                        <input
                            type="datetime-local"
                            className={styles.timeInput}
                            value={formatTimestamp(filters.timeTo)}
                            onChange={handleTimeToChange}
                            placeholder="To"
                        />
                    </div>
                </div>
            </div>

            {/* Level filter */}
            <div className={styles.section}>
                <div className={styles.sectionHeader} onClick={() => toggleSidebarCollapsed('level')}>
                    <span className={styles.sectionTitle}>
                        Level
                        <span className={styles.sectionCount}>{filters.levels.length}/{LEVELS.length}</span>
                    </span>
                    <svg
                        className={`${styles.collapseIcon} ${sidebarCollapsed.level ? styles.collapseIconCollapsed : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                </div>
                <div
                    className={`${styles.sectionContent} ${sidebarCollapsed.level ? styles.sectionContentCollapsed : ''}`}>
                    <div className={styles.levelList}>
                        {LEVELS.map(level => {
                            const isChecked = filters.levels.includes(level)
                            const color = getLogLevelColor(level)
                            return (
                                <div
                                    key={level}
                                    className={`${styles.levelButton} ${isChecked ? styles.checked : ''}`}
                                    style={{
                                        '--level-color': color,
                                        '--level-color-bg': color + '33'
                                    } as React.CSSProperties}
                                    onClick={() => handleLevelChange(level, !isChecked)}
                                >
                                    <span className={styles.levelLabel}>{level}</span>
                                    <span className={styles.levelCount}>{levelCounts[level] || 0}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Tags filter */}
            <div className={styles.section}>
                <div className={styles.sectionHeader} onClick={() => toggleSidebarCollapsed('tags')}>
                    <span className={styles.sectionTitle}>
                        Tags
                        <span className={styles.sectionCount}>{allTags.length}</span>
                    </span>
                    <svg
                        className={`${styles.collapseIcon} ${sidebarCollapsed.tags ? styles.collapseIconCollapsed : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                </div>
                <div
                    className={`${styles.sectionContent} ${sidebarCollapsed.tags ? styles.sectionContentCollapsed : ''}`}>
                    <input
                        type="text"
                        className={styles.tagFilterInput}
                        placeholder="Filter tags..."
                        value={tagFilter}
                        onChange={e => setTagFilter(e.target.value)}
                    />
                    {sortedTags.length === 0 ? (
                        <div className={styles.noTags}>No tags available</div>
                    ) : (
                        <div className={styles.tagList}>
                            {checkedTags.map(({tag, count}) => (
                                <label key={tag} className={`${styles.tagItem} ${styles.tagItemSticky}`}>
                                    <input
                                        type="checkbox"
                                        className={styles.tagCheckbox}
                                        checked={true}
                                        onChange={e => handleTagToggle(tag, e.target.checked)}
                                    />
                                    <span className={styles.tagName}>{tag}</span>
                                    <span className={styles.tagCount}>{count}</span>
                                </label>
                            ))}
                            {uncheckedTags.map(({tag, count}) => (
                                <label key={tag} className={styles.tagItem}>
                                    <input
                                        type="checkbox"
                                        className={styles.tagCheckbox}
                                        checked={false}
                                        onChange={e => handleTagToggle(tag, e.target.checked)}
                                    />
                                    <span className={styles.tagName}>{tag}</span>
                                    <span className={styles.tagCountWrapper}>
                                        <button
                                            className={styles.tagEyeBtn}
                                            onClick={e => {
                                                e.stopPropagation();
                                                toggleHiddenTag(tag)
                                            }}
                                            title="Hide tag"
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path
                                                    d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                                                <line x1="1" y1="1" x2="23" y2="23"/>
                                            </svg>
                                        </button>
                                        <span className={styles.tagCount}>{count}</span>
                                    </span>
                                </label>
                            ))}
                            {hiddenTagsList.map(({tag, count}) => (
                                <label key={tag} className={`${styles.tagItem} ${styles.tagItemHidden}`}>
                                    <input
                                        type="checkbox"
                                        className={styles.tagCheckbox}
                                        checked={false}
                                        onChange={e => handleTagToggle(tag, e.target.checked)}
                                    />
                                    <span className={styles.tagName}>{tag}</span>
                                    <span className={styles.tagCountWrapper}>
                                        <button
                                            className={`${styles.tagEyeBtn} ${styles.tagEyeBtnHidden}`}
                                            onClick={e => {
                                                e.stopPropagation();
                                                toggleHiddenTag(tag)
                                            }}
                                            title="Show tag"
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                                <circle cx="12" cy="12" r="3"/>
                                            </svg>
                                        </button>
                                        <span className={styles.tagCount}>{count}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </aside>
    )
}