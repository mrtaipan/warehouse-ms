import styles from '../arkline.module.css'

export default function ArklineProgressOverviewPage() {
  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <p className={styles.eyebrow}>Progress Overview</p>
        <h1 className={styles.heroTitle}>Track Arkline progress in one clean dashboard.</h1>
        <p className={styles.heroText}>
          This page is ready for Arkline progress metrics, status cards, and overall operational visibility once production,
          QC, and fulfillment data are connected here.
        </p>
      </section>
    </div>
  )
}
