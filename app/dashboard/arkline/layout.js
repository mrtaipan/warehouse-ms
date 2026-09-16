'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import DashboardSubnav from '@/components/dashboardsubnav'

import styles from './arkline.module.css'
import useArklineAccess from './use-arkline-access'

function ArklineSubnav({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { access, loading, role } = useArklineAccess()
  const isExternal = role === 'external'

  useEffect(() => {
    if (!isExternal || !pathname || pathname.startsWith('/dashboard/arkline/progress-overview')) return
    router.replace('/dashboard/arkline/progress-overview')
  }, [isExternal, pathname, router])

  const items = [
    { href: '/dashboard/arkline/directory', label: 'Directory', enabled: access.directory },
    { href: '/dashboard/arkline/progress-overview', label: 'Progress Snapshot', enabled: access.progressOverview },
    { href: '/dashboard/arkline/production-planning', label: 'Production Planning', enabled: access.productionPlanning },
    {
      href: access.financialManagementHref || '/dashboard/arkline/financial-management',
      label: 'Financial Management',
      enabled: access.financialManagement,
    },
  ].filter((item) => item.enabled)

  if (isExternal) {
    return pathname.startsWith('/dashboard/arkline/progress-overview') ? children : null
  }

  if (pathname === '/dashboard/arkline' || pathname === '/dashboard/arkline/' || loading || items.length <= 1) {
    return children
  }

  return <DashboardSubnav items={items} variant="qcMenu">{children}</DashboardSubnav>
}

export default function ArklineLayout({ children }) {
  return (
    <div className={styles.page}>
      <ArklineSubnav>{children}</ArklineSubnav>
    </div>
  )
}
