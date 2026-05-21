import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL, getQcFeatureAccess } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import DashboardSubnav from '@/components/dashboardsubnav'

export default async function QcLayout({ children }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL
  const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, 'role')

  const role = isAdmin ? 'admin' : profile?.role || 'storage_staff'
  const { data: rolePermissions } = await supabase
    .from('dir_user_roles')
    .select('permission_code')
    .eq('role', role)

  const permissions = (rolePermissions || []).map((item) => item.permission_code)
  const access = getQcFeatureAccess(permissions, isAdmin, role)

  const items = [
    access.dashboard ? { href: '/dashboard/qc', label: 'Summary', exact: true } : null,
    access.receiving ? { href: '/mobile/qc/receiving', label: 'Receiving' } : null,
    access.inspectionTask ? { href: '/mobile/qc/inspection-task', label: 'Grading Task' } : null,
    access.confirmation ? { href: '/dashboard/qc/confirmation', label: 'Confirmation' } : null,
    access.retur ? { href: '/dashboard/qc/retur-report', label: 'Retur Report' } : null,
  ].filter(Boolean)

  return <DashboardSubnav items={items}>{children}</DashboardSubnav>
}
