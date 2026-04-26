import {useRef, useState} from 'react'
import styles from './FileDropzone.module.css'

interface FileDropzoneProps {
    onFileSelected: (file: File) => void
}

export default function FileDropzone({onFileSelected}: FileDropzoneProps) {
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const files = e.dataTransfer.files
        if (files && files.length > 0) {
            onFileSelected(files[0])
        }
    }

    const handleClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            onFileSelected(files[0])
        }
    }

    return (
        <div
            className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept=".log,.json,.logcat,.txt,.text,text/*,application/json"
                className={styles.input}
                onChange={handleFileChange}
            />
            <div className={styles.content}>
                <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                </svg>
                <p className={styles.text}>
                    Drag and drop a log file here, or click to select
                </p>
                <p className={styles.hint}>
                    Most log formats
                </p>
            </div>
        </div>
    )
}
