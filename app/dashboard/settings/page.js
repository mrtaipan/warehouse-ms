import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL } from '@/utils/permissions'
import styles from './settings.module.css'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL
  const { data: profile } = await supabase
    .from('dir_user_profiles')
    .select('role')
    .eq('email', user.email?.toLowerCase())
    .maybeSingle()

  const role = isAdmin ? 'admin' : profile?.role || 'storage_staff'
  const { data: rolePermissions } = await supabase
    .from('dir_user_roles')
    .select('permission_code')
    .eq('role', role)

  const permissions = (rolePermissions || []).map((item) => item.permission_code)
  const canViewMasterData = isAdmin || permissions.includes('masterdata.view')
  const canManageAccess = isAdmin || permissions.includes('useraccess.manage')

  if (!canViewMasterData && !canManageAccess) {
    redirect('/dashboard')
  }

  const modules = [
    canManageAccess ? { href: '/dashboard/user-access', title: 'USER ACCESS' } : null,
    canViewMasterData ? { href: '/dashboard/suppliers', title: 'SUPPLIERS' } : null,
    canViewMasterData ? { href: '/dashboard/brands', title: 'BRANDS' } : null,
    canViewMasterData ? { href: '/dashboard/categories', title: 'CATEGORIES' } : null,
    canViewMasterData ? { href: '/dashboard/skus', title: 'SKUS' } : null,
    canViewMasterData ? { href: '/dashboard/rack-locations', title: 'RACK LOCATIONS' } : null,
  ].filter(Boolean)

  return (
    <div className={styles.page}>
      <section className={styles.board}>
        {modules.map((item) => (
          <Link key={item.href} href={item.href} className={styles.link}>
            <span className={styles.arrow}>↗</span>
            <span>{item.title}</span>
          </Link>
        ))}
      </section>
    </div>
  )
}
