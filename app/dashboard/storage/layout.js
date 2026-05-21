import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL, getStorageFeatureAccess } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import DashboardSubnav from '@/components/dashboardsubnav'

export default async function StorageLayout({ children }) {
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
  const access = getStorageFeatureAccess(role, permissions, isAdmin)
  const items = [
    access.overview ? { href: '/dashboard/storage', label: 'Overview', exact: true } : null,
    access.search ? { href: '/dashboard/storage/search', label: 'Search Storage', exact: true } : null,
    access.registry ? { href: '/dashboard/storage/registry', label: 'Registry Storage', exact: true } : null,
    access.overview ? { href: '/dashboard/storage/overview', label: 'Storage Location', exact: true } : null,
    access.restockSubmit || access.restockPicker
      ? { href: '/dashboard/storage/restock-instruction', label: 'Restock Instruction', exact: true }
      : null,
  ].filter(Boolean)

  return <DashboardSubnav items={items}>{children}</DashboardSubnav>
}
