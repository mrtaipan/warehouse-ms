import DashboardSubnav from '@/components/dashboardsubnav'

const items = [
  { href: '/dashboard/qc/confirmation/next-process', label: 'Next Process', exact: true },
  { href: '/dashboard/qc/confirmation/rejection', label: 'Rejection', exact: true },
]

export default function QcConfirmationLayout({ children }) {
  return <DashboardSubnav items={items}>{children}</DashboardSubnav>
}
