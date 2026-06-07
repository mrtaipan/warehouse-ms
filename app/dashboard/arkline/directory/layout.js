 'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import styles from '../arkline.module.css'
import useArklineAccess from '../use-arkline-access'

export default function ArklineDirectoryLayout({ children }) {
  const pathname = usePathname()
  const { access } = useArklineAccess()

  const tabs = [
    { href: '/dashboard/arkline/directory', label: 'Products', exact: true, enabled: access.directoryProducts || access.directory },
    { href: '/dashboard/arkline/directory/materials', label: 'Materials', exact: true, enabled: access.directoryMaterials },
    { href: '/dashboard/arkline/directory/bom', label: 'BOM', exact: true, enabled: access.directoryBom },
  ]

  return (
    <div className={styles.directoryTabsPage}>
      <div className={styles.directoryTabsShell}>
        <div className={styles.directoryTabsBar}>
          {tabs.map((tab) => {
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
            const className = `${styles.directoryTabLink} ${isActive ? styles.directoryTabLinkActive : ''} ${tab.enabled ? '' : styles.directoryTabLinkDisabled}`.trim()

            return tab.enabled ? (
              <Link key={tab.href} href={tab.href} className={className}>
                <span className={styles.directoryTabLabel}>{tab.label}</span>
                <span className={styles.directoryTabUnderline} />
              </Link>
            ) : (
              <span key={tab.href} className={className} aria-disabled="true">
                <span className={styles.directoryTabLabel}>{tab.label}</span>
                <span className={styles.directoryTabUnderline} />
              </span>
            )
          })}
        </div>
      </div>
      <div className={styles.directoryTabsPanel}>{children}</div>
    </div>
  )
}
