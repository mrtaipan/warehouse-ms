import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import LogoutButton from '@/components/logoutbutton'
import { ADMIN_EMAIL, getAllowedMenus } from '@/utils/permissions'

export default async function DashboardLayout({ children }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const isAdminEmail = user.email?.toLowerCase() === ADMIN_EMAIL
  const { data: profile } = await supabase
    .from('dir_user_profiles')
    .select('role')
    .eq('email', user.email?.toLowerCase())
    .maybeSingle()
  const role = isAdminEmail ? 'admin' : profile?.role || 'storage_staff'
  const { data: rolePermissions } = await supabase
    .from('role_permissions')
    .select('permission_code')
    .eq('role', role)
  const permissions = (rolePermissions || []).map((item) => item.permission_code)
  const menus = getAllowedMenus(role, permissions, isAdminEmail)

  return (
    <div style={styles.wrapper}>
      <aside style={styles.sidebar}>
        <h2 style={styles.logo}>Warehouse MS</h2>

        <nav style={styles.nav}>
          {menus.inbound ? <Link href="/dashboard/inbound" style={styles.link}>Inbound</Link> : null}
          {menus.qc ? (
            <Link href={menus.qcInspectorOnly ? '/dashboard/qc/inspection-task' : '/dashboard/qc'} style={styles.link}>
              QC
            </Link>
          ) : null}
          {menus.packing ? <Link href="/dashboard/packing-list" style={styles.link}>Packing List</Link> : null}
          {menus.storage ? <Link href="/dashboard/storage" style={styles.link}>Storage</Link> : null}

          {menus.masterData ? (
            <>
              <div style={styles.group}>
                <span style={styles.groupLabel}>Master Data Directory</span>

                <div style={styles.groupLinks}>
                  <Link href="/dashboard/suppliers" style={styles.subLink}>Suppliers</Link>
                  <Link href="/dashboard/brands" style={styles.subLink}>Brands</Link>
                  <Link href="/dashboard/categories" style={styles.subLink}>Categories</Link>
                  <Link href="/dashboard/skus" style={styles.subLink}>SKUs</Link>
                  <Link href="/dashboard/rack-locations" style={styles.subLink}>Rack Locations</Link>
                  {menus.userAccess ? <Link href="/dashboard/user-access" style={styles.subLink}>User Access</Link> : null}
                </div>
              </div>
            </>
          ) : null}
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <p style={styles.user}>{user.email}</p>
          <LogoutButton />
        </div>
      </aside>

      <main style={styles.main}>
        {children}
      </main>
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f5f7fb',
  },
  sidebar: {
    width: '260px',
    backgroundColor: '#111827',
    color: '#fff',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  logo: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '700',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '4px',
  },
  groupLabel: {
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#9ca3af',
    padding: '0 12px',
  },
  groupLinks: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  link: {
    color: '#e5e7eb',
    textDecoration: 'none',
    padding: '10px 12px',
    borderRadius: '8px',
    backgroundColor: 'transparent',
  },
  subLink: {
    color: '#d1d5db',
    textDecoration: 'none',
    padding: '10px 12px 10px 24px',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    fontSize: '14px',
  },
  user: {
    fontSize: '14px',
    color: '#d1d5db',
    marginBottom: '12px',
    wordBreak: 'break-word',
  },
  main: {
    flex: 1,
    padding: '32px',
  },
}
