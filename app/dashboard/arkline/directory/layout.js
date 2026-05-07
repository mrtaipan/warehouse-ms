 'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import styles from '../arkline.module.css'

export default function ArklineDirectoryLayout({ children }) {
  const pathname = usePathname()

  const tabs = [
    { href: '/dashboard/arkline/directory', label: 'Products', exact: true },
    { href: '/dashboard/arkline/directory/bom', label: 'BOM', exact: true },
  ]

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
