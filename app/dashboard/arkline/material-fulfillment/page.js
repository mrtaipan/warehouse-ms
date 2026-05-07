import styles from '../arkline.module.css'

export default function ArklineMaterialFulfillmentPage() {
  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <p className={styles.eyebrow}>Material Fulfillment</p>
        <h1 className={styles.heroTitle}>Keep material readiness visible before production moves.</h1>
        <p className={styles.heroText}>
          This page is ready for Arkline material requests, fulfillment status, shortages, and availability monitoring so the
          next production flow can be built here cleanly.
        </p>
      </section>
    </div>
  )
}
