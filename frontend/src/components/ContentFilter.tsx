import {useState} from 'react'
import {useLogStore} from '../stores/useLogStore'
import styles from './ContentFilter.module.css'

export default function ContentFilter() {
    const {filters, total, entries, setContentFilter, setSearchQuery, clearSearch} = useLogStore()
    const [localFilter, setLocalFilter] = useState(filters.contentFilter)

    const applyFilter = () => {
        setContentFilter(localFilter)
        if (localFilter.trim()) {
            setSearchQuery(localFilter)
        }
    }

    const clearFilter = () => {
        setLocalFilter('')
        setContentFilter('')
        clearSearch()
    }

    const matchText = () => {
        if (!filters.searchQuery) return ''
        const shown = entries.length
        const hasMore = shown < total
        return hasMore ? `1-${shown} of ${total}` : `${total}`
    }

    return (
        <div className={styles.container}>
            <label className={styles.label}>
                Content:
                <input
                    type="text"
                    className={styles.input}
                    placeholder="filter content..."
                    value={localFilter}
                    onChange={e => setLocalFilter(e.target.value)}
                    onKeyUp={e => e.key === 'Enter' && applyFilter()}
                />
            </label>
            <button className={`${styles.btn} ${styles.searchBtn}`} onClick={applyFilter}>Search</button>
            <button className={`${styles.btn} ${styles.clearBtn}`} onClick={clearFilter}>Clear</button>
            {filters.searchQuery && (
                <span className={styles.matchCounter}>
                    {matchText()} matches
                </span>
            )}
        </div>
    )
}
