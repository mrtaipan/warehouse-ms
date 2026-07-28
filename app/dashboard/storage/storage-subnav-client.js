'use client'

import DashboardSubnav from '@/components/dashboardsubnav'

export default function StorageSubnavClient({ items, children }) {
  return <DashboardSubnav items={items} variant="qcMenu">{children}</DashboardSubnav>
}
