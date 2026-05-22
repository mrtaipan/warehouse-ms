import styles from '../arkline.module.css'

export default function ArklineFinancialManagementPage() {
  return (
    <div className={styles.directorySection}>
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Financial Management</p>
            <h1 className={styles.sectionTitle}>Reimbursement Claim has moved</h1>
            <p className={styles.sectionSubtitle}>
              Reimbursement Claim is now handled under HRGA. This Arkline area is being kept as a placeholder while
              future financial modules are prepared.
            </p>
          </div>
        </div>

        <div className={styles.emptyState}>
          This page is intentionally disabled. Please continue reimbursement work from the HRGA reimbursement area.
        </div>
      </section>
    </div>
  )
}
