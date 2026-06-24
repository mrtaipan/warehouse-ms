import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getQcFeatureAccess } from '@/utils/permissions'
import { loadAccessContext } from '@/utils/access-control'
import DashboardSubnav from '@/components/dashboardsubnav'

export default async function QcLayout({ children }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { role, permissions, isAdmin } = await loadAccessContext(supabase, user, 'role')
  const access = getQcFeatureAccess(permissions, isAdmin, role)

  const items = [
    access.dashboard ? { href: '/dashboard/qc', label: 'Summary', exact: true } : null,
    access.receiving ? { href: '/mobile/qc/receiving', label: 'Receiving' } : null,
    access.inspectionTask ? { href: '/mobile/qc/inspection-task', label: 'Grading Task' } : null,
    access.confirmation ? { href: '/dashboard/qc/confirmation', label: 'Confirmation' } : null,
    access.retur ? { href: '/dashboard/qc/retur-report', label: 'Return Report' } : null,
  ].filter(Boolean)

  return <DashboardSubnav items={items}>{children}</DashboardSubnav>
}
