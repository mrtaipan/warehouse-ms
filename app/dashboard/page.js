import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL, getAllowedMenus } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import styles from './dashboard.module.css'

const DAILY_QUOTES = [
  "Take it one step at a time - you're doing better than you think.",
  'Consistency will take you further than motivation ever could.',
  'Not everything needs to be perfect to be meaningful.',
  'Some things fall into place when you stop forcing them.',
  'Do the work, and let the results speak for themselves.',
  'Growth is quiet, but it changes everything.',
  'The right things will stay - the rest will fade.',
  'Progress is built on the days you feel like doing nothing.',
  'A calm mind makes better decisions.',
  "You don't have to rush what's meant to last.",
]

function formatToday() {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date())
}

function getDailyQuote(email = '') {
  const now = new Date()
  const dateSeed = Number(
    `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`
  )
  const emailSeed = String(email)
    .toLowerCase()
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0)

  return DAILY_QUOTES[(dateSeed + emailSeed) % DAILY_QUOTES.length]
}

function toProperCase(value = '') {
  return String(value || '')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDashboardName(value = '') {
  const parts = toProperCase(value).split(' ').filter(Boolean)
  if (parts.length <= 3) {
    return parts.join(' ')
  }

  const visibleParts = parts.slice(0, 2)
  const lastInitial = parts[2]?.charAt(0) || ''
  return `${visibleParts.join(' ')} ${lastInitial}.`.trim()
}

function getBirthDateValue(row = {}) {
  return row.date_of_birth || row.birthdate || row.birth_date || null
}

function getUpcomingBirthdayOffset(value) {
  if (!value) return null

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null

  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let upcoming = new Date(today.getFullYear(), parsed.getMonth(), parsed.getDate())

  if (upcoming < todayStart) {
    upcoming = new Date(today.getFullYear() + 1, parsed.getMonth(), parsed.getDate())
  }

  return Math.floor((upcoming.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))
}

function getUpcomingBirthdayLabel(offset) {
  if (offset === 0) return 'Today'
  return `H-${offset}`
}

function getTodayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL
  const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, 'role, display_name')

  const role = isAdmin ? 'admin' : profile?.role || 'storage_staff'
  const { data: rolePermissions } = await supabase
    .from('dir_user_roles')
    .select('permission_code')
    .eq('role', role)

  const permissions = (rolePermissions || []).map((item) => item.permission_code)
  const menus = getAllowedMenus(role, permissions, isAdmin)

  const rawUserLabel =
    profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Team'
  const userLabel = formatDashboardName(rawUserLabel)
  const quoteOfTheDay = getDailyQuote(user.email)
  const todayDate = getTodayDateString()

  const { data: announcementRows } = await supabase.from('dir_user_profiles').select('*')
  const { data: broadcastRows, error: broadcastError } = await supabase
    .from('hrd_announcement')
    .select('id, title, message, start_date, end_date, is_active')
    .eq('is_active', true)
    .lte('start_date', todayDate)
    .gte('end_date', todayDate)
    .order('start_date', { ascending: false })

  const activeBroadcasts = (broadcastError ? [] : broadcastRows || []).map((item) => ({
    id: item.id,
    title: item.title || 'Announcement',
    message: item.message || '',
    dateLabel:
      item.start_date && item.end_date
        ? item.start_date === item.end_date
          ? item.start_date
          : `${item.start_date} to ${item.end_date}`
        : 'Active now',
  }))
  const birthdayAnnouncements = (announcementRows || [])
    .map((person) => {
      const offset = getUpcomingBirthdayOffset(getBirthDateValue(person))
      if (offset == null || offset < 0 || offset > 3) {
        return null
      }

      return {
        id: person.id,
        name: formatDashboardName(person.display_name || person.email || 'Team'),
        offset,
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.offset - right.offset || left.name.localeCompare(right.name))

  const showMyArklifeButton = true

  if (!isAdmin) {
    return (
      <div className={styles.dashboardShell}>
        <section className={styles.heroCard}>
          <div className={styles.heroCopy}>
          <div className={styles.heroTopBar}>
            <span className={styles.heroKicker}>{formatToday()}</span>
            {showMyArklifeButton ? (
              <Link href={menus.myArklifeHref} className={styles.heroProfileLink} aria-label="Open MyARKLIFE">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="8" r="4" />
                </svg>
              </Link>
            ) : null}
          </div>
          <h1 className={styles.heroTitle}>Hello {userLabel}!</h1>
            <p className={styles.heroSupport}>Glad to have you back.</p>
            <p className={styles.heroQuote}>&ldquo;{quoteOfTheDay}&rdquo;</p>
          </div>
        </section>

        <section className={`${styles.sectionCard} ${styles.compactCard}`}>
          <p className={styles.sectionKicker}>News &amp; Updates</p>

          <div className={styles.insightStack}>
            {activeBroadcasts.length ? (
              activeBroadcasts.map((item) => (
                <div key={item.id} className={styles.insightCard}>
                  <span className={styles.insightLabel}>{item.dateLabel}</span>
                  <strong
                    className={styles.insightValue}
                    style={{ fontSize: '22px', lineHeight: 1.2, textTransform: 'none' }}
                  >
                    {item.title}
                  </strong>
                  <p className={styles.insightNote}>{item.message || 'No Announcement'}</p>
                </div>
              ))
            ) : birthdayAnnouncements.length ? (
              birthdayAnnouncements.map((item) => (
                <div key={`${item.id}-${item.offset}`} className={styles.insightCard}>
                  <span className={styles.insightLabel}>
                    {item.offset === 0 ? 'Happy Birthday' : 'Celebrating Soon'}
                  </span>
                  <strong
                    className={styles.insightValue}
                    style={{ fontSize: '22px', lineHeight: 1.2, textTransform: 'none' }}
                  >
                    {item.offset === 0 ? item.name : `Poke ${item.name}`}
                  </strong>
                  <p className={styles.insightNote}>
                    {item.offset === 0
                      ? 'Terima kasih telah ada. Semoga kamu selalu bersinar terang. Selamat ulang tahun!'
                      : `${getUpcomingBirthdayLabel(item.offset)} birthday reminder from People Directory.`}
                  </p>
                </div>
              ))
            ) : (
              <div className={styles.insightCard}>
                <strong className={styles.insightValue}>No Announcement</strong>
                <span className={styles.insightLabel}>Today</span>
                <p className={styles.insightNote}>No Announcement</p>
              </div>
            )}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.dashboardShell}>
      <section className={styles.heroCard}>
        <div className={styles.heroCopy}>
          <div className={styles.heroTopBar}>
            <span className={styles.heroKicker}>{formatToday()}</span>
            {showMyArklifeButton ? (
              <Link href={menus.myArklifeHref} className={styles.heroProfileLink} aria-label="Open MyARKLIFE">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="8" r="4" />
                </svg>
              </Link>
            ) : null}
          </div>
          <h1 className={styles.heroTitle}>Hello {userLabel}!</h1>
          <p className={styles.heroSupport}>Glad to have you back.</p>
          <p className={styles.heroQuote}>&ldquo;{quoteOfTheDay}&rdquo;</p>
        </div>
      </section>

      <div className={styles.contentGrid}>
        <div className={styles.rightColumn}>
        <section className={`${styles.sectionCard} ${styles.compactCard}`}>
          <p className={styles.sectionKicker}>News &amp; Updates</p>

          <div className={styles.insightStack}>
            {activeBroadcasts.length ? (
                activeBroadcasts.map((item) => (
                  <div key={item.id} className={styles.insightCard}>
                    <span className={styles.insightLabel}>{item.dateLabel}</span>
                    <strong
                      className={styles.insightValue}
                      style={{ fontSize: '22px', lineHeight: 1.2, textTransform: 'none' }}
                    >
                      {item.title}
                    </strong>
                    <p className={styles.insightNote}>{item.message || 'No Announcement'}</p>
                  </div>
                ))
              ) : birthdayAnnouncements.length ? (
                birthdayAnnouncements.map((item) => (
                  <div key={`${item.id}-${item.offset}`} className={styles.insightCard}>
                    <span className={styles.insightLabel}>
                      {item.offset === 0 ? 'Happy Birthday' : 'Celebrating Soon'}
                    </span>
                    <strong
                      className={styles.insightValue}
                      style={{ fontSize: '22px', lineHeight: 1.2, textTransform: 'none' }}
                    >
                      {item.offset === 0 ? item.name : `Poke ${item.name}`}
                    </strong>
                    <p className={styles.insightNote}>
                      {item.offset === 0
                        ? 'Terima kasih telah ada. Semoga kamu selalu bersinar terang. Selamat ulang tahun!'
                        : `${getUpcomingBirthdayLabel(item.offset)} birthday reminder from People Directory.`}
                    </p>
                  </div>
                ))
              ) : (
                <div className={styles.insightCard}>
                  <strong className={styles.insightValue}>No Announcement</strong>
                  <span className={styles.insightLabel}>Today</span>
                  <p className={styles.insightNote}>No Announcement</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

