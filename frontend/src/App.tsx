import {useEffect, useState} from 'react'
import FileDropzone from './components/FileDropzone'
import LogLevelFilter from './components/LogLevelFilter'
import FilterBar from './components/FilterBar'
import Timeline from './components/Timeline'
import LogList from './components/LogList'
import ErrorDisplay from './components/ErrorDisplay'
import {useLogStore} from './stores/useLogStore'
import styles from './App.module.css'

export default function App() {
    const {
        metadata,
        entries,
        error,
        buckets,
        tagColors,
        selectedRange,
        uploadLog,
        setSelectedRange,
        fetchFilteredLogs,
        clearLog
    } = useLogStore()

    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [errorType, setErrorType] = useState<'error' | 'warning' | 'info'>('error')

    useEffect(() => {
        if (error) {
            setErrorMessage(error)
            setErrorType('error')
        }
    }, [error])

    useEffect(() => {
        if (metadata && entries.length === 0) {
            fetchFilteredLogs()
        }
    }, [metadata])

    const handleFileSelected = async (file: File) => {
        await uploadLog(file)
    }

    const handleRangeSelect = (range: { from: number; to: number } | null) => {
        setSelectedRange(range)
    }

    const dismissError = () => {
        setErrorMessage(null)
    }

    const showDropzone = !metadata

    return (
        <div className={styles.app}>
            {errorMessage && (
                <ErrorDisplay
                    message={errorMessage}
                    type={errorType}
                    onDismiss={dismissError}
                />
            )}
            <main className={styles.main}>
                {showDropzone && (
                    <FileDropzone onFileSelected={handleFileSelected}/>
                )}

                {!showDropzone && metadata && (
                    <div className={styles.logView}>
                        <div className={styles.logHeader}>
                            <div className={styles.logMeta}>
                                <span className={styles.appName}>LogVue</span>
                                <span className={styles.separator}>|</span>
                                <span className={styles.deviceName}>{metadata.deviceName}</span>
                            </div>
                            <button className={styles.clearBtn} onClick={clearLog}>
                                Load New File
                            </button>
                        </div>
                        <LogLevelFilter/>
                        <FilterBar/>
                        <div className={styles.timelineContainer}>
                            {metadata.timeRange && (
                                <Timeline
                                    buckets={buckets}
                                    tagColors={tagColors}
                                    timeRange={metadata.timeRange}
                                    selectedRange={selectedRange}
                                    onRangeSelect={handleRangeSelect}
                                />
                            )}
                        </div>
                        <LogList/>
                    </div>
                )}
            </main>
        </div>
    )
}
