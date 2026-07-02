'use client'

import { usePathname } from 'next/navigation'

import DashboardSubnav from '@/components/dashboardsubnav'

export default function StorageSubnavClient({ items, children }) {
  const pathname = usePathname()
  const visibleItems =
    pathname === '/dashboard/storage'
      ? items.filter((item) => item.href !== '/dashboard/storage')
      : items

  return <DashboardSubnav items={visibleItems}>{children}</DashboardSubnav>
}
