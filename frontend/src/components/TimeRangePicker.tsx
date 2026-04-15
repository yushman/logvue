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
    const {filters, setTimeFrom, setTimeTo, resetTimeRange} = useLogStore()

    // Sync local state when filters change externally (e.g., from timeline drill-down)
    const [timeFromLocal, setTimeFromLocal] = useState(epochToDatetimeLocal(filters.timeFrom))
    const [timeToLocal, setTimeToLocal] = useState(epochToDatetimeLocal(filters.timeTo))

    useEffect(() => {
        setTimeFromLocal(epochToDatetimeLocal(filters.timeFrom))
    }, [filters.timeFrom])

    useEffect(() => {
        setTimeToLocal(epochToDatetimeLocal(filters.timeTo))
    }, [filters.timeTo])

    const handleTimeFromChange = (value: string) => {
        setTimeFromLocal(value)
        setTimeFrom(datetimeLocalToEpoch(value))
    }

    const handleTimeToChange = (value: string) => {
        setTimeToLocal(value)
        setTimeTo(datetimeLocalToEpoch(value))
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
