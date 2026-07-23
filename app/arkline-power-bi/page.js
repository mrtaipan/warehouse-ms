'use client'

import Link from 'next/link'

import useArklineAccess from '../dashboard/arkline/use-arkline-access'
import styles from './power-bi.module.css'

const ARKLINE_POWERBI_EMBED_URL =
  'https://app.powerbi.com/reportEmbed?reportId=ec1df29a-b8da-4011-a674-82c461184f76&autoAuth=true&embeddedDemo=true'

export default function ArklinePowerBiPage() {
  const { loading, role } = useArklineAccess()

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.stateCard}>Loading report access...</div>
      </main>
    )
  }

  if (role !== 'admin') {
    return (
      <main className={styles.page}>
        <div className={styles.stateCard}>
          <p className={styles.eyebrow}>Arkline</p>
          <h1>Admin access only</h1>
          <p>This Power BI report is only available for admin users.</p>
          <Link className={styles.backButton} href="/dashboard/arkline/progress-overview">
            Back
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <Link className={styles.floatingBackButton} href="/dashboard/arkline/progress-overview" aria-label="Back to Progress Snapshot">
        Back
      </Link>
      <iframe
        title="Arkline Report Reborn"
        className={styles.reportFrame}
        src={ARKLINE_POWERBI_EMBED_URL}
        frameBorder="0"
        allowFullScreen
      />
    </main>
  )
}
