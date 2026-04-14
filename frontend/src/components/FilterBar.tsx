import TextFilter from './TextFilter'
import ContentFilter from './ContentFilter'
import TimeRangePicker from './TimeRangePicker'
import styles from './FilterBar.module.css'

export default function FilterBar() {
    return (
        <div className={styles.container}>
            <TextFilter/>
            <ContentFilter/>
            <TimeRangePicker/>
        </div>
    )
}
