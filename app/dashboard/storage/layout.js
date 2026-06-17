import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getStorageFeatureAccess } from '@/utils/permissions'
import { loadAccessContext } from '@/utils/access-control'
import DashboardSubnav from '@/components/dashboardsubnav'

export default async function StorageLayout({ children }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { role, permissions, isAdmin } = await loadAccessContext(supabase, user, 'role')
  const access = getStorageFeatureAccess(role, permissions, isAdmin)
  const items = [
    access.overview ? { href: '/dashboard/storage', label: 'Overview', exact: true } : null,
    access.search ? { href: '/dashboard/storage/search', label: 'Search Storage', exact: true } : null,
    access.registry ? { href: '/dashboard/storage/registry', label: 'Registry Storage', exact: true } : null,
    access.location ? { href: '/dashboard/storage/overview', label: 'Storage Location', exact: true } : null,
    access.restockSubmit || access.restockPicker
      ? { href: '/dashboard/storage/restock-instruction', label: 'Restock Instruction', exact: true }
      : null,
  ].filter(Boolean)

  return <DashboardSubnav items={items}>{children}</DashboardSubnav>
}
