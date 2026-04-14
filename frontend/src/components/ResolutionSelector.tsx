import styles from './ResolutionSelector.module.css'

interface ResolutionSelectorProps {
    value: 'sec' | 'min' | 'hour'
    onChange: (value: 'sec' | 'min' | 'hour') => void
}

export default function ResolutionSelector({value, onChange}: ResolutionSelectorProps) {
    return (
        <div className={styles.container}>
            <span className={styles.label}>Resolution:</span>
            <div className={styles.options}>
                {(['sec', 'min', 'hour'] as const).map(res => (
                    <button
                        key={res}
                        type="button"
                        className={`${styles.btn} ${value === res ? styles.active : ''}`}
                        onClick={() => onChange(res)}
                    >
                        {res.charAt(0).toUpperCase() + res.slice(1)}
                    </button>
                ))}
            </div>
        </div>
    )
}
