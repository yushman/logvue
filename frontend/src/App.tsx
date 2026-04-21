import {useEffect, useState} from 'react'
import Header from './components/Header'
import Timeline from './components/Timeline'
import Sidebar from './components/Sidebar'
import LogList from './components/LogList'
import MessageInspector from './components/MessageInspector'
import FileDropzone from './components/FileDropzone'
import ErrorDisplay from './components/ErrorDisplay'
import {useLogStore} from './stores/useLogStore'
import {ensureSession} from './api/client'
import styles from './App.module.css'

export default function App() {
    const {
        metadata,
        fileId,
        buckets,
        tagColors,
        selectedRange,
        uploadLog,
        setSelectedRange,
        fetchFilteredLogs,
        error
    } = useLogStore()

    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [errorType, setErrorType] = useState<'error' | 'warning' | 'info'>('error')

    useEffect(() => {
        ensureSession()
            .then(() => {
                // Clear old fileId from persist if session changed
                const currentFileId = fileId
                if (currentFileId) {
                    // Keep fileId - it will be validated against session on filter request
                }
            })
            .catch(console.error)
    }, [])

    useEffect(() => {
        if (error) {
            setErrorMessage(error)
            setErrorType('error')
        }
    }, [error])

    useEffect(() => {
        if (metadata && fileId) {
            fetchFilteredLogs()
        }
    }, [metadata, fileId])

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

            <Header/>

            {showDropzone && (
                <main className={styles.main}>
                    <FileDropzone onFileSelected={handleFileSelected}/>
                </main>
            )}

            {!showDropzone && metadata && (
                <>
                    <div className={styles.logView}>
                        {metadata.timeRange && (
                            <Timeline
                                buckets={buckets}
                                tagColors={tagColors}
                                timeRange={metadata.timeRange}
                                selectedRange={selectedRange}
                                onRangeSelect={handleRangeSelect}
                            />
                        )}

                        <div className={styles.contentArea}>
                            <Sidebar/>
                            <LogList/>
                            <MessageInspector/>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}