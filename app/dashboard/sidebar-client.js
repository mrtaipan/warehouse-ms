'use client'

import { useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

import LogoutButton from '@/components/logoutbutton'
import styles from './layout.module.css'

function NavIcon({ kind }) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.9',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }

  switch (kind) {
    case 'inbound':
      return (
        <svg {...commonProps}>
          <path d="M3 7.5h11v7H3z" />
          <path d="M14 10h3.5l2.5 2.5v2H14z" />
          <circle cx="7.5" cy="17.5" r="1.5" />
          <circle cx="17.5" cy="17.5" r="1.5" />
          <path d="M9 17.5h7" />
        </svg>
      )
    case 'qc':
      return (
        <svg {...commonProps}>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4.2-4.2" />
        </svg>
      )
    case 'packing':
      return (
        <svg {...commonProps}>
          <path d="M7 3.5h7l3 3V20.5H7z" />
          <path d="M14 3.5v4h3" />
          <path d="M9.5 12h5" />
          <path d="M9.5 15.5h5" />
        </svg>
      )
    case 'storage':
      return (
        <svg {...commonProps}>
          <path d="M4 20V6.5h16V20" />
          <path d="M2.5 20h19" />
          <path d="M4 10.5h16" />
          <path d="M8 6.5V20" />
          <path d="M16 6.5V20" />
        </svg>
      )
    case 'human-resources':
      return (
        <svg {...commonProps}>
          <circle cx="9" cy="8" r="2.5" />
          <circle cx="16.5" cy="9.5" r="2" />
          <path d="M4.8 18c.8-2.7 2.8-4 4.9-4s4.1 1.3 4.9 4" />
          <path d="M13.8 18c.4-1.8 1.6-2.9 3.1-3.4 1-.3 2-.3 3.1 0" />
        </svg>
      )
    case 'myarklife':
      return (
        <svg {...commonProps}>
          <path d="M12 20s-6.5-4.2-8.3-8.1C2.3 8.9 4 6 7 6c1.9 0 3 1 5 3 2-2 3.1-3 5-3 3 0 4.7 2.9 3.3 5.9C18.5 15.8 12 20 12 20Z" />
          <path d="M10 11h4" />
          <path d="M12 9v4" />
        </svg>
      )
    case 'arkline':
      return (
        <svg {...commonProps}>
          <path d="M8 6.5 5.5 9l1.7 2.2 1.8-1V19.5h6v-9.3l1.8 1 1.7-2.2L16 6.5l-2 1.2a4.7 4.7 0 0 1-4 0z" />
          <path d="M10 7.2 12 10l2-2.8" />
        </svg>
      )
    case 'dashboard':
    default:
      return (
        <svg {...commonProps}>
          <path d="M3.5 10.5 12 4l8.5 6.5" />
          <path d="M5.5 9.5v10h13v-10" />
          <path d="M10 19.5v-5h4v5" />
        </svg>
      )
  }
}

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.9 1.9 0 0 1 0 2.7 1.9 1.9 0 0 1-2.7 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.9 1.9 0 0 1-1.9 1.9 1.9 1.9 0 0 1-1.9-1.9v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.9 1.9 0 0 1-2.7 0 1.9 1.9 0 0 1 0-2.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1.9 1.9 0 0 1-1.9-1.9A1.9 1.9 0 0 1 4 11h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.9 1.9 0 0 1 0-2.7 1.9 1.9 0 0 1 2.7 0l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4A1.9 1.9 0 0 1 12 2.1 1.9 1.9 0 0 1 13.9 4v.2a1 1 0 0 0 .6.9h.1a1 1 0 0 0 1.1-.2l.1-.1a1.9 1.9 0 0 1 2.7 0 1.9 1.9 0 0 1 0 2.7l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20A1.9 1.9 0 0 1 21.9 12 1.9 1.9 0 0 1 20 13.9h-.2a1 1 0 0 0-.9.6z" />
    </svg>
  )
}

export default function SidebarClient({ navItems, settingHref }) {
  const [isMobileExpanded, setIsMobileExpanded] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const shouldHideSidebar =
    pathname === '/dashboard/qc/confirmation/next-process' &&
    searchParams.get('form') === '1'

  function collapseMobileSidebarOnNavigate() {
    setIsMobileExpanded(false)
  }

  if (shouldHideSidebar) {
    return <aside className={styles.sidebarHidden} aria-hidden="true" />
  }

  return (
    <aside
      className={`${styles.sidebar} ${isMobileExpanded ? styles.sidebarMobileExpanded : styles.sidebarMobileCollapsed}`.trim()}
    >
      <div className={styles.mobileSidebarHeader}>
        <Link href="/dashboard" className={styles.brandLink} title="Dashboard" onClick={collapseMobileSidebarOnNavigate}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <Image src="/mob-text-logo.png" alt="MOB" width={40} height={18} className={styles.brandLogo} priority />
          </div>

          <div className={styles.brandCopy}>
            <h2 className={styles.brandTitle}>Warehouse</h2>
            <p className={styles.brandSubtitle}>Management System</p>
          </div>
        </div>
        </Link>

        <button
          type="button"
          className={styles.mobileToggle}
          onClick={() => setIsMobileExpanded((prev) => !prev)}
          aria-expanded={isMobileExpanded}
          aria-label={isMobileExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`${styles.mobileToggleIcon} ${isMobileExpanded ? styles.mobileToggleIconOpen : ''}`.trim()}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      <div className={styles.sidebarInner}>
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.navLink}
              title={item.label}
              onClick={collapseMobileSidebarOnNavigate}
            >
              <span className={styles.navIcon}>
                <NavIcon kind={item.icon} />
              </span>
              {item.isWordmark ? (
                <span className={`${styles.linkLabel} ${styles.wordmarkLabel}`}>
                  <span className={styles.wordmarkText}>ARKLINE</span>
                </span>
              ) : (
                <span className={styles.linkLabel}>{item.label}</span>
              )}
            </Link>
          ))}

          {settingHref ? (
            <Link href={settingHref} className={styles.navLink} title="Setting" onClick={collapseMobileSidebarOnNavigate}>
              <span className={styles.navIcon}>
                <GearIcon />
              </span>
              <span className={styles.linkLabel}>Setting</span>
            </Link>
          ) : null}
        </nav>

        <div className={styles.spacer} />

        <div className={styles.footer}>
          <LogoutButton
            className={styles.logoutButton}
            iconClassName={styles.logoutIcon}
            labelClassName={styles.logoutLabel}
          />
        </div>
      </div>
    </aside>
  )
}
