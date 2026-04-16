import {useLogStore} from '../stores/useLogStore'
import styles from './LogLevelFilter.module.css'

const LEVELS = ['VERBOSE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'ASSERT']

export default function LogLevelFilter() {
    const {filters, total, metadata, setLevels} = useLogStore()

    const isChecked = (level: string) => filters.levels.includes(level)

    const toggleLevel = (level: string) => {
        if (filters.levels.includes(level)) {
            setLevels(filters.levels.filter(l => l !== level))
        } else {
            setLevels([...filters.levels, level])
        }
    }

    return (
        <div className={styles.container}>
            {LEVELS.map(level => (
                <div
                    key={level}
                    className={`${styles.levelButton} ${styles[level.toLowerCase()]} ${isChecked(level) ? styles.checked : ''}`}
                    onClick={() => toggleLevel(level)}
                >
                    {level}
                </div>
            ))}
            <span className={styles.badge}>
                {total} / {metadata?.logCount} entries
            </span>
        </div>
    )
}
