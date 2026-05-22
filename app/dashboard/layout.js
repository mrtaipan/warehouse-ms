import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import SidebarClient from './sidebar-client'
import { ADMIN_EMAIL, getAllowedMenus } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import styles from './layout.module.css'

export default async function DashboardLayout({ children }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const isAdminEmail = user.email?.toLowerCase() === ADMIN_EMAIL
  const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, 'role, display_name')

  const role = isAdminEmail ? 'admin' : profile?.role || 'storage_staff'
  const { data: rolePermissions } = await supabase
    .from('dir_user_roles')
    .select('permission_code')
    .eq('role', role)

  const permissions = (rolePermissions || []).map((item) => item.permission_code)
  const menus = getAllowedMenus(role, permissions, isAdminEmail)
  const navItems = [
    { href: '/dashboard/inbound', label: 'Inbound', icon: 'inbound', show: menus.inbound },
    {
      href: menus.qcHref,
      label: menus.qcInspectorOnly ? 'Inspection Task' : 'Quality Control',
      icon: 'qc',
      show: menus.qc,
    },
    { href: '/dashboard/packing-list', label: 'Packing List', icon: 'packing', show: menus.packing },
    { href: menus.storageHref, label: 'Storage', icon: 'storage', show: menus.storage },
    { href: menus.humanResourcesHref, label: 'HRGA', icon: 'human-resources', show: menus.humanResources },
    { href: menus.arklineHref, label: 'ARKLINE', icon: 'arkline', show: menus.arkline, isWordmark: true },
  ].filter((item) => item.show)

  const settingHref = menus.masterData || menus.userAccess ? '/dashboard/settings' : null

  return (
    <div className={styles.shell}>
      <SidebarClient navItems={navItems} settingHref={settingHref} />

      <main className={styles.main}>{children}</main>
    </div>
  )
}
