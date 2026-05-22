import styles from '../arkline/arkline.module.css'
import localStyles from './human-resources.module.css'

export default function HumanResourcesLayout({ children }) {
  return (
    <div className={styles.page}>
      <div className={localStyles.pageCompact}>{children}</div>
    </div>
  )
}
