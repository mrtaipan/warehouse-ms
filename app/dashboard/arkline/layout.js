'use client'

import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import styles from './arkline.module.css'
import useArklineAccess from './use-arkline-access'

function ArklineSubnav() {
  const segment = useSelectedLayoutSegment()
  const { access, loading } = useArklineAccess()
  const items = [
    { href: '/dashboard/arkline', label: 'Overview', segment: null, enabled: access.overview },
    { href: '/dashboard/arkline/directory', label: 'Directory', segment: 'directory', enabled: access.directory },
    { href: '/dashboard/arkline/progress-overview', label: 'Progress Snapshot', segment: 'progress-overview', enabled: access.progressOverview },
    { href: '/dashboard/arkline/production-planning', label: 'Production Planning', segment: 'production-planning', enabled: access.productionPlanning },
    { href: '/dashboard/arkline/financial-management', label: 'Financial Management', segment: 'financial-management', enabled: access.financialManagement },
  ]

  return (
    <nav className={styles.subnav}>
      {items.map((item) => {
        const isActive = segment === item.segment || (!segment && item.segment === null)
        const className = `${styles.subnavLink} ${isActive ? styles.subnavLinkActive : ''} ${!loading && !item.enabled ? styles.subnavLinkDisabled : ''}`.trim()

        return !loading && item.enabled ? (
          <Link key={item.href} href={item.href} className={className}>
            {item.label}
          </Link>
        ) : (
          <span key={item.href} className={className} aria-disabled={!loading && !item.enabled ? 'true' : undefined}>
            {item.label}
          </span>
        )
      })}
    </nav>
  )
}

export default function ArklineLayout({ children }) {
  return (
    <div className={styles.page}>
      <ArklineSubnav />
      {children}
    </div>
  )
}
