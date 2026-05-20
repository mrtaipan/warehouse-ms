'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import shellStyles from '../arkline.module.css'

export default function ArklineProductionPlanningLayout({ children }) {
  const pathname = usePathname()

  const tabs = [
    { href: '/dashboard/arkline/production-planning', label: 'Production Orders', exact: true },
    { href: '/dashboard/arkline/production-planning/material-fulfillment', label: 'MRP', exact: true },
  ]

  return (
    <div className={shellStyles.directoryTabsPage}>
      <div className={shellStyles.directoryTabsShell}>
        <div className={shellStyles.directoryTabsBar}>
          {tabs.map((tab) => {
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`${shellStyles.directoryTabLink} ${isActive ? shellStyles.directoryTabLinkActive : ''}`}
              >
                <span className={shellStyles.directoryTabLabel}>{tab.label}</span>
                <span className={shellStyles.directoryTabUnderline} />
              </Link>
            )
          })}
        </div>
      </div>
      <div className={shellStyles.directoryTabsPanel}>{children}</div>
    </div>
  )
}
