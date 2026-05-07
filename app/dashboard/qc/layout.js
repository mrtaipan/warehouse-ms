import DashboardSubnav from '@/components/dashboardsubnav'

const items = [
  { href: '/dashboard/qc', label: 'Dashboard', exact: true },
  { href: '/dashboard/qc/receiving', label: 'Receiving' },
  { href: '/dashboard/qc/inspection-task', label: 'Grading Task' },
  { href: '/dashboard/qc/confirmation', label: 'Confirmation' },
  { href: '/dashboard/qc/retur-report', label: 'Retur Report' },
]

export default function QcLayout({ children }) {
  return <DashboardSubnav items={items}>{children}</DashboardSubnav>
}
