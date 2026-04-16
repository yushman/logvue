import {useRef} from 'react'
import {useLogStore} from '../stores/useLogStore'
import styles from './Header.module.css'

const VERSION = '0.1.0'

export default function Header() {
    const {metadata, uploadLog} = useLogStore()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const displayName = metadata?.deviceName || 'No file loaded'

    const handleLoadClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            await uploadLog(file)
        }
        e.target.value = ''
    }

    return (
        <header className={styles.header}>
            <div className={styles.left}>
                <div className={styles.logo}>
                    <svg className={styles.logoIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
                    </svg>
                    <span className={styles.appName}>LogVue</span>
                    <span className={styles.version}>{VERSION}</span>
                </div>
            </div>

            <div className={styles.center}>
                {displayName}
            </div>

            <div className={styles.right}>
                <button className={styles.loadBtn} onClick={handleLoadClick}>
                    <svg className={styles.loadBtnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                    </svg>
                    Load New File
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".log,.json,.logcat,.txt,.text,text/*,application/json"
                    className={styles.hiddenInput}
                    onChange={handleFileChange}
                />
            </div>
        </header>
    )
}