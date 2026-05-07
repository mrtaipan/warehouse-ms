import DashboardSubnav from '@/components/dashboardsubnav'

const items = [
  { href: '/dashboard/inbound', label: 'Dashboard', exact: true },
  { href: '/dashboard/inbound/receiving', label: 'Receiving' },
  { href: '/dashboard/inbound/unload', label: 'Unload' },
]

export default function InboundLayout({ children }) {
  return <DashboardSubnav items={items}>{children}</DashboardSubnav>
}
