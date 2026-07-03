'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './dashboardsubnav.module.css'

function SubnavIcon({ kind }) {
  const commonProps = {
    viewBox: '0 0 24 24',
    'aria-hidden': true,
    focusable: false,
  }

  switch (kind) {
    case 'summary':
      return (
        <svg {...commonProps}>
          <rect x="4" y="4" width="6" height="6" rx="1.2" />
          <rect x="14" y="4" width="6" height="6" rx="1.2" />
          <rect x="4" y="14" width="6" height="6" rx="1.2" />
          <rect x="14" y="14" width="6" height="6" rx="1.2" />
        </svg>
      )
    case 'receiving':
      return (
        <svg {...commonProps}>
          <path d="M12 3 4.5 7.2 12 11.4l7.5-4.2L12 3Z" />
          <path d="M4.5 7.2v8.3L12 20V11.4" />
          <path d="M19.5 7.2v8.3L12 20" />
        </svg>
      )
    case 'grading':
      return (
        <svg {...commonProps}>
          <rect x="6" y="5" width="12" height="15" rx="2" />
          <path d="M9.5 4h5l.8 2H8.7l.8-2Z" />
          <path d="m9 13 2 2 4-5" />
        </svg>
      )
    case 'confirmation':
      return (
        <svg {...commonProps}>
          <path d="M5 12.5 9.2 17 19 7" />
          <path d="M4 5h11" />
          <path d="M4 19h15" />
          <path d="M4 5v14" />
        </svg>
      )
    case 'return':
      return (
        <svg {...commonProps}>
          <path d="M8 4h8l3 3v13H8V4Z" />
          <path d="M16 4v4h3" />
          <path d="M13 11h-3.5a2.5 2.5 0 0 0 0 5H14" />
          <path d="m11 9-3 3 3 3" />
        </svg>
      )
    default:
      return null
  }
}

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

export default function DashboardSubnav({ items, children, variant = 'default' }) {
  const pathname = usePathname()
  const isMenuVariant = variant === 'qcMenu'
  const isPageTabsVariant = variant === 'pageTabs'
  const shouldHideNav =
    isMenuVariant &&
    (pathname.startsWith('/dashboard/qc/confirmation/next-process') || pathname.startsWith('/dashboard/qc/confirmation/rejection'))

  return (
    <div
      className={`${styles.wrapper} ${isMenuVariant ? styles.wrapperMenu : ''} ${isPageTabsVariant ? styles.wrapperPageTabs : ''}`.trim()}
    >
      {!shouldHideNav ? (
        <nav className={`${styles.subnav} ${isMenuVariant ? styles.menuSubnav : ''} ${isPageTabsVariant ? styles.pageTabList : ''}`.trim()}>
          {items.map((item) => {
            const isActive = isItemActive(pathname, item)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.link} ${isActive ? styles.linkActive : ''} ${isMenuVariant ? styles.menuLink : ''} ${isMenuVariant && isActive ? styles.menuLinkActive : ''} ${isPageTabsVariant ? styles.pageTab : ''} ${isPageTabsVariant && isActive ? styles.pageTabActive : ''}`.trim()}
              >
                {isMenuVariant && item.icon ? (
                  <span className={styles.menuIcon}>
                    <SubnavIcon kind={item.icon} />
                  </span>
                ) : null}
                {item.label}
              </Link>
            )
          })}
        </nav>
      ) : null}

      {children}
    </div>
  )
}
