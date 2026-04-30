import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL, getStorageFeatureAccess } from '@/utils/permissions'

export default async function StorageLayout({ children }) {
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
  const access = getStorageFeatureAccess(role, permissions, isAdmin)

  return (
    <div style={styles.wrapper}>
      <div style={styles.subnav}>
        {access.overview ? (
          <Link href="/dashboard/storage/overview" style={styles.link}>
            Storage Overview
          </Link>
        ) : null}
        {access.registry ? (
          <Link href="/dashboard/storage/registry" style={styles.link}>
            Registry Storage
          </Link>
        ) : null}
        {access.search ? (
          <Link href="/dashboard/storage/search" style={styles.link}>
            Search Storage
          </Link>
        ) : null}
        {access.restockSubmit ? (
          <Link href="/restock-request" style={styles.link}>
            Restock Submit
          </Link>
        ) : null}
        {access.restockPicker ? (
          <Link href="/take-requests" style={styles.link}>
            Restock Picker
          </Link>
        ) : null}
      </div>

      {children}
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  subnav: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
  },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 14px',
    borderRadius: '10px',
    textDecoration: 'none',
    background: '#e5e7eb',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '600',
  },
}
