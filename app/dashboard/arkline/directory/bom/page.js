import styles from '../../arkline.module.css'

export default function ArklineBomPage() {
  return (
    <div className={styles.page}>
      <section className={styles.directorySection}>
        <div className={styles.sectionHeader}>
          <div>
            <h1 className={styles.sectionTitle}>BOM</h1>
          </div>
        </div>

        <div className={styles.emptyState}>BOM workspace is ready to be built here.</div>
      </section>
    </div>
  )
}
