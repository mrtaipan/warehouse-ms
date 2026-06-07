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

  if (user.email?.toLowerCase() !== ADMIN_EMAIL) {
    redirect('/dashboard')
  }

  const modules = [
    { href: '/dashboard/user-access', title: 'USER ACCESS' },
    { href: '/dashboard/suppliers', title: 'SUPPLIERS' },
    { href: '/dashboard/brands', title: 'BRANDS' },
    { href: '/dashboard/categories', title: 'CATEGORIES' },
    { href: '/dashboard/skus', title: 'SKUS' },
    { href: '/dashboard/rack-locations', title: 'RACK LOCATIONS' },
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
