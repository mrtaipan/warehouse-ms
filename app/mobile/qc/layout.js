import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { loadAccessContext } from '@/utils/access-control'
import { hasPermission } from '@/utils/permissions'
import styles from './layout.module.css'

export default async function MobileQcLayout({ children }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { permissions, isAdmin } = await loadAccessContext(supabase, user, 'role')
  const canOpenQcSummary = hasPermission(permissions, 'qc.summary.view', isAdmin)
  const backHref = canOpenQcSummary ? '/dashboard/qc' : '/dashboard'
  const backLabel = canOpenQcSummary ? 'Summary' : 'Dashboard'

  return (
    <main className={styles.shell}>
      <div className={styles.viewport}>
        <div className={styles.topbar}>
          <Link href={backHref} className={styles.backLink}>
            <span className={styles.backIcon} aria-hidden="true">
              &larr;
            </span>
            {backLabel}
          </Link>
        </div>
        {children}
      </div>
    </main>
  )
}
