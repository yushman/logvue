import {useEffect, useState} from 'react'
import {useLogStore} from '../stores/useLogStore'
import styles from './TimeRangePicker.module.css'

function epochToDatetimeLocal(epoch: number | null): string {
    if (epoch == null) return ''
    const date = new Date(epoch)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function datetimeLocalToEpoch(datetime: string): number | null {
    if (!datetime) return null
    return new Date(datetime).getTime()
}

export default function TimeRangePicker() {
    const {filters, metadata, setTimeFrom, setTimeTo} = useLogStore()
    const [timeFromLocal, setTimeFromLocal] = useState(epochToDatetimeLocal(filters.timeFrom))
    const [timeToLocal, setTimeToLocal] = useState(epochToDatetimeLocal(filters.timeTo))

    useEffect(() => {
        if (metadata?.timeRange && metadata.timeRange.startTimestamp > 0) {
            if (!timeFromLocal) {
                setTimeFromLocal(epochToDatetimeLocal(metadata.timeRange.startTimestamp))
            }
            if (!timeToLocal) {
                setTimeToLocal(epochToDatetimeLocal(metadata.timeRange.endTimestamp))
            }
        }
    }, [metadata])

    const handleTimeFromChange = (value: string) => {
        setTimeFromLocal(value)
        setTimeFrom(datetimeLocalToEpoch(value))
    }

    const handleTimeToChange = (value: string) => {
        setTimeToLocal(value)
        setTimeTo(datetimeLocalToEpoch(value))
    }

    const resetTimeRange = () => {
        if (metadata?.timeRange && metadata.timeRange.startTimestamp > 0) {
            setTimeFromLocal(epochToDatetimeLocal(metadata.timeRange.startTimestamp))
            setTimeToLocal(epochToDatetimeLocal(metadata.timeRange.endTimestamp))
            setTimeFrom(metadata.timeRange.startTimestamp)
            setTimeTo(metadata.timeRange.endTimestamp)
        }
    }

    return (
        <div className={styles.container}>
            <label className={styles.label}>
                From:
                <input
                    type="datetime-local"
                    className={styles.input}
                    value={timeFromLocal}
                    onChange={e => handleTimeFromChange(e.target.value)}
                />
            </label>
            <label className={styles.label}>
                To:
                <input
                    type="datetime-local"
                    className={styles.input}
                    value={timeToLocal}
                    onChange={e => handleTimeToChange(e.target.value)}
                />
            </label>
            <button className={styles.resetBtn} onClick={resetTimeRange}>Reset</button>
        </div>
    )
}
