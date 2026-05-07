'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './dashboardsubnav.module.css'

function isItemActive(pathname, item) {
  const targets = item.match && item.match.length ? item.match : [item.href]
  const exact = item.exact === true

  return targets.some((target) => {
    if (exact) {
      return pathname === target
    }

    return pathname === target || pathname.startsWith(`${target}/`)
  })
}

export default function DashboardSubnav({ items, children }) {
  const pathname = usePathname()

  return (
    <div className={styles.wrapper}>
      <nav className={styles.subnav}>
        {items.map((item) => {
          const isActive = isItemActive(pathname, item)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.link} ${isActive ? styles.linkActive : ''}`.trim()}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
