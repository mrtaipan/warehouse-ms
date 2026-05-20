'use client'

import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import styles from './arkline.module.css'

function ArklineSubnav() {
  const segment = useSelectedLayoutSegment()
  const items = [
    { href: '/dashboard/arkline', label: 'Overview', segment: null },
    { href: '/dashboard/arkline/directory', label: 'Product Directory', segment: 'directory' },
    { href: '/dashboard/arkline/progress-overview', label: 'Progress Snapshot', segment: 'progress-overview' },
    { href: '/dashboard/arkline/production-planning', label: 'Production Planning', segment: 'production-planning' },
    { href: '/dashboard/arkline/financial-management', label: 'Financial Management', segment: 'financial-management' },
  ]

  return (
    <nav className={styles.subnav}>
      {items.map((item) => {
        const isActive = segment === item.segment || (!segment && item.segment === null)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.subnavLink} ${isActive ? styles.subnavLinkActive : ''}`.trim()}
          >
            {item.label}
          </Link>
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
