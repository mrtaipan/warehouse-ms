import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import SidebarClient from './sidebar-client'
import { getAllowedMenus } from '@/utils/permissions'
import { loadAccessContext } from '@/utils/access-control'
import styles from './layout.module.css'

export default async function DashboardLayout({ children }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { role, permissions, isAdmin } = await loadAccessContext(supabase, user, 'role, display_name')
  const menus = getAllowedMenus(role, permissions, isAdmin)
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

  const settingHref = isAdmin ? '/dashboard/settings' : null

  return (
    <div className={styles.shell}>
      <SidebarClient navItems={navItems} settingHref={settingHref} />

      <main className={styles.main}>{children}</main>
    </div>
  )
}
