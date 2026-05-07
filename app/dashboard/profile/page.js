import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL } from '@/utils/permissions'
import { updateOwnProfile } from './actions'
import styles from './page.module.css'

function getInitials(value) {
  return String(value || 'WM')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0])
    .join('')
    .toUpperCase()
}

export default async function ProfilePage() {
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
    .select('display_name, role')
    .eq('email', user.email?.toLowerCase())
    .maybeSingle()

  const displayName =
    profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || ''
  const role = isAdmin ? 'admin' : profile?.role || 'storage_staff'

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Profile Settings</p>
          <h1 className={styles.title}>Keep your workspace identity tidy.</h1>
          <p className={styles.subtitle}>
            Update the display name shown across the dashboard so navigation, QC assignment, and operational views stay
            easy to read for the whole team.
          </p>
        </div>

        <div className={styles.avatar}>{getInitials(displayName)}</div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Edit profile</h2>
        <p className={styles.sectionSubtitle}>Only your display name is editable here for now.</p>

        <form action={updateOwnProfile} className={styles.form}>
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.label}>Display Name</span>
              <input
                className={styles.input}
                type="text"
                name="display_name"
                defaultValue={displayName}
                placeholder="Enter display name"
                required
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input className={styles.input} type="email" value={user.email || ''} readOnly />
            </label>
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.label}>Role</span>
              <input className={styles.input} type="text" value={role.replaceAll('_', ' ')} readOnly />
            </label>

            <div className={styles.field}>
              <span className={styles.label}>Notes</span>
              <p className={styles.note}>
                Role and access permissions are managed separately from User Access. This page only updates how your
                name appears in the app.
              </p>
            </div>
          </div>

          <div className={styles.buttonRow}>
            <button type="submit" className={styles.button}>
              Save Profile
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
