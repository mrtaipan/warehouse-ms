import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { loadAccessContext } from '@/utils/access-control'
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

  const { profile, role } = await loadAccessContext(
    supabase,
    user,
    'id, display_name, role, reimbursement_bank_name, reimbursement_account_name, reimbursement_account_number'
  )

  const displayName =
    profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || ''

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

          <div className={styles.bankSection}>
            <div>
              <h3 className={styles.bankSectionTitle}>Reimbursement Account</h3>
              <p className={styles.sectionSubtitle}>This account will be used automatically when you choose your own account in reimbursement claims.</p>
            </div>

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Bank Name</span>
                <input
                  className={styles.input}
                  type="text"
                  name="reimbursement_bank_name"
                  defaultValue={profile?.reimbursement_bank_name || ''}
                  placeholder="Enter bank name"
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Account Name</span>
                <input
                  className={styles.input}
                  type="text"
                  name="reimbursement_account_name"
                  defaultValue={profile?.reimbursement_account_name || ''}
                  placeholder="Enter account name"
                />
              </label>
            </div>

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Account Number</span>
                <input
                  className={styles.input}
                  type="text"
                  name="reimbursement_account_number"
                  defaultValue={profile?.reimbursement_account_number || ''}
                  placeholder="Enter account number"
                />
              </label>
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
