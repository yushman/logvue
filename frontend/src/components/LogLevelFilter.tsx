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
                <label
                    key={level}
                    className={`${styles.checkbox} ${styles[level.toLowerCase()]}`}
                >
                    <input
                        type="checkbox"
                        checked={isChecked(level)}
                        onChange={() => toggleLevel(level)}
                    />
                    <span className={styles.label}>{level}</span>
                </label>
            ))}
            <span className={styles.badge}>
                {total} / {metadata?.logCount} entries
            </span>
        </div>
    )
}
