'use client'

import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import styles from '../arkline/arkline.module.css'

export default function HumanResourcesSubnav({ items = [] }) {
  const segment = useSelectedLayoutSegment()

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
