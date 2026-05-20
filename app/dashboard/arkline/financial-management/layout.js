'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import styles from '../arkline.module.css'

export default function ArklineFinancialManagementLayout({ children }) {
  const pathname = usePathname()

  const tabs = [{ href: '/dashboard/arkline/financial-management', label: 'Reimbursement Claim', exact: true }]

  return (
    <div className={styles.directoryTabsPage}>
      <div className={styles.directoryTabsShell}>
        <div className={styles.directoryTabsBar}>
          {tabs.map((tab) => {
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`${styles.directoryTabLink} ${isActive ? styles.directoryTabLinkActive : ''}`}
              >
                <span className={styles.directoryTabLabel}>{tab.label}</span>
                <span className={styles.directoryTabUnderline} />
              </Link>
            )
          })}
        </div>
      </div>
      <div className={styles.directoryTabsPanel}>{children}</div>
    </div>
  )
}
