import DashboardSubnav from '@/components/dashboardsubnav'

const items = [
  { href: '/dashboard/packing-list', label: 'Dashboard', exact: true },
  { href: '/dashboard/packing-list/receiving', label: 'Receiving' },
  { href: '/dashboard/packing-list/size-breakdown', label: 'Size Breakdown' },
]

export default function PackingListLayout({ children }) {
  return <DashboardSubnav items={items}>{children}</DashboardSubnav>
}
