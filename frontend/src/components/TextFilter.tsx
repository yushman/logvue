import {useEffect, useRef, useState} from 'react'
import {useLogStore} from '../stores/useLogStore'
import styles from './TextFilter.module.css'

export default function TextFilter() {
    const {filters, setTagPattern} = useLogStore()
    const [localPattern, setLocalPattern] = useState(filters.tagPattern)
    const [isRegex, setIsRegex] = useState(filters.tagRegex)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            setTagPattern(localPattern, isRegex)
        }, 300)
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [localPattern])

    const handleRegexChange = () => {
        const newRegex = !isRegex
        setIsRegex(newRegex)
        setTagPattern(localPattern, newRegex)
    }

    return (
        <div className={styles.container}>
            <label className={styles.label}>
                Tag:
                <input
                    type="text"
                    className={styles.input}
                    placeholder="filter tag..."
                    value={localPattern}
                    onChange={e => setLocalPattern(e.target.value)}
                />
            </label>
            <label className={styles.regexToggle}>
                <input
                    type="checkbox"
                    checked={isRegex}
                    onChange={handleRegexChange}
                />
                <span>Regex</span>
            </label>
        </div>
    )
}
