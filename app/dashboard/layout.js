import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import LogoutButton from '@/components/logoutbutton'

export default async function DashboardLayout({ children }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div style={styles.wrapper}>
      <aside style={styles.sidebar}>
        <h2 style={styles.logo}>Warehouse MS</h2>

        <nav style={styles.nav}>
          <Link href="/dashboard/storage" style={styles.link}>Storage</Link>
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
  link: {
    color: '#e5e7eb',
    textDecoration: 'none',
    padding: '10px 12px',
    borderRadius: '8px',
    backgroundColor: 'transparent',
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
