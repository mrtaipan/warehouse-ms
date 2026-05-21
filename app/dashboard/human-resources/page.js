import styles from '../dashboard.module.css'

export default function HumanResourcesPage() {
  return (
    <div className={styles.dashboardShell}>
      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.sectionKicker}>Human Resources</p>
            <h1 className={styles.sectionTitle}>Human Resources</h1>
          </div>
        </div>

        <p className={styles.sectionSubtitle}>
          This space is ready for HR features such as employee data, attendance, leave, payroll support, and organization
          records.
        </p>
      </section>
    </div>
  )
}
