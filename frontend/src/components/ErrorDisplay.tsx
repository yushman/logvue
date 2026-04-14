import {useEffect, useState} from 'react'
import styles from './ErrorDisplay.module.css'

interface ErrorDisplayProps {
    message: string
    type: 'error' | 'warning' | 'info'
    onDismiss: () => void
}

export default function ErrorDisplay({message, type, onDismiss}: ErrorDisplayProps) {
    const [visible, setVisible] = useState(true)

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setVisible(false)
            setTimeout(onDismiss, 300)
        }, 5000)
        return () => clearTimeout(timeoutId)
    }, [onDismiss])

    const dismiss = () => {
        setVisible(false)
        setTimeout(onDismiss, 300)
    }

    return (
        <div className={`${styles.toast} ${styles[type]} ${visible ? styles.enter : styles.leave}`}>
            <span className={styles.message}>{message}</span>
            <button className={styles.dismiss} onClick={dismiss}>✕</button>
        </div>
    )
}
