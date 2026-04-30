import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL, getStorageFeatureAccess } from '@/utils/permissions'

export default async function StoragePage() {
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
      <div>
        <h1 style={styles.title}>Storage Menu</h1>
        <p style={styles.subtitle}>Pilih proses storage yang ingin dibuka.</p>
      </div>

      <div style={styles.grid}>
        {access.overview ? (
          <a href="/dashboard/storage/overview" style={styles.card}>
            <span style={styles.eyebrow}>Storage</span>
            <strong style={styles.cardTitle}>Storage Overview</strong>
            <span style={styles.cardText}>Lihat stok dan lakukan take/edit dari tampilan utama.</span>
          </a>
        ) : null}

        {access.registry ? (
          <a href="/dashboard/storage/registry" style={styles.card}>
            <span style={styles.eyebrow}>Storage</span>
            <strong style={styles.cardTitle}>Registry Storage</strong>
            <span style={styles.cardText}>Input barang masuk ke lokasi rack yang tepat.</span>
          </a>
        ) : null}

        {access.search ? (
          <a href="/dashboard/storage/search" style={styles.card}>
            <span style={styles.eyebrow}>Storage</span>
            <strong style={styles.cardTitle}>Search Storage</strong>
            <span style={styles.cardText}>Cari lokasi barang berdasarkan nama item.</span>
          </a>
        ) : null}

        {access.restockSubmit ? (
          <a href="/restock-request" style={styles.card}>
            <span style={styles.eyebrow}>Storage</span>
            <strong style={styles.cardTitle}>Restock Submit</strong>
            <span style={styles.cardText}>Buat request pengambilan dari dalam dashboard storage.</span>
          </a>
        ) : null}

        {access.restockPicker ? (
          <a href="/take-requests" style={styles.mobileCard}>
            <span style={styles.eyebrow}>Storage</span>
            <strong style={styles.cardTitle}>Restock Picker</strong>
            <span style={styles.cardText}>Buka halaman mobile picker untuk melihat request dan proses complete.</span>
          </a>
        ) : null}
      </div>
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  title: {
    margin: 0,
    fontSize: '30px',
  },
  subtitle: {
    marginTop: '8px',
    marginBottom: 0,
    color: '#6b7280',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '20px',
    borderRadius: '18px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    textDecoration: 'none',
    boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
  },
  mobileCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '20px',
    borderRadius: '18px',
    background: '#fff7ed',
    border: '1px solid #fdba74',
    textDecoration: 'none',
    boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
  },
  eyebrow: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#9a3412',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  cardTitle: {
    color: '#111827',
    fontSize: '20px',
  },
  cardText: {
    color: '#6b7280',
    fontSize: '14px',
    lineHeight: 1.5,
  },
}
