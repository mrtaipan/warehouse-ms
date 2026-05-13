import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import styles from './layout.module.css'

export default async function MobileQcLayout({ children }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className={styles.shell}>
      <div className={styles.viewport}>
        <div className={styles.topbar}>
          <Link href="/dashboard" className={styles.backLink}>
            <span className={styles.backIcon} aria-hidden="true">
              &larr;
            </span>
            Dashboard
          </Link>
        </div>
        {children}
      </div>
    </main>
  )
}
