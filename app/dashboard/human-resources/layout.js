'use client'

import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import styles from '../arkline/arkline.module.css'

function HumanResourcesSubnav() {
  const segment = useSelectedLayoutSegment()
  const items = [{ href: '/dashboard/human-resources', label: 'People Directory', segment: null }]

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

export default function HumanResourcesLayout({ children }) {
  return (
    <div className={styles.page}>
      <HumanResourcesSubnav />
      {children}
    </div>
  )
}
