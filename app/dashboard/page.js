import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL, getAllowedMenus } from '@/utils/permissions'
import styles from './dashboard.module.css'

const DAILY_QUOTES = [
  'Take it one step at a time — you’re doing better than you think.',
  'Consistency will take you further than motivation ever could.',
  'Not everything needs to be perfect to be meaningful.',
  'Some things fall into place when you stop forcing them.',
  'Do the work, and let the results speak for themselves.',
  'Growth is quiet, but it changes everything.',
  'The right things will stay — the rest will fade.',
  'Progress is built on the days you feel like doing nothing.',
  'A calm mind makes better decisions.',
  'You don’t have to rush what’s meant to last.',
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

function getAccentClass(accent) {
  switch (accent) {
    case 'sky':
      return styles.actionSky
    case 'ink':
      return styles.actionInk
    case 'sand':
      return styles.actionSand
    case 'platinum':
      return styles.actionPlatinum
    default:
      return styles.actionSlate
  }
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
  const { data: profile } = await supabase
    .from('dir_user_profiles')
    .select('role, display_name')
    .eq('email', user.email?.toLowerCase())
    .maybeSingle()

  const role = isAdmin ? 'admin' : profile?.role || 'storage_staff'
  const { data: rolePermissions } = await supabase
    .from('dir_user_roles')
    .select('permission_code')
    .eq('role', role)

  const permissions = (rolePermissions || []).map((item) => item.permission_code)
  const menus = getAllowedMenus(role, permissions, isAdmin)

  const userLabel =
    profile?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Team'
  const quoteOfTheDay = getDailyQuote(user.email)

  const quickActions = [
    menus.storage
      ? {
          href: menus.storageHref,
          title: 'Storage',
          eyebrow: 'Operations',
          description: 'Open storage tools, stock visibility, and replenishment flow.',
          accent: 'slate',
        }
      : null,
    menus.inbound
      ? {
          href: '/dashboard/inbound',
          title: 'Inbound',
          eyebrow: 'Operations',
          description: 'Continue receiving, unload, and inbound monitoring.',
          accent: 'sky',
        }
      : null,
    menus.qc
      ? {
          href: menus.qcInspectorOnly ? '/dashboard/qc/inspection-task' : '/dashboard/qc',
          title: menus.qcInspectorOnly ? 'Inspection Task' : 'Quality Control',
          eyebrow: 'Quality',
          description: menus.qcInspectorOnly
            ? 'See your active queue and continue inspection tasks.'
            : 'Open quality control dashboard, planning, confirmation, and return flow.',
          accent: 'ink',
        }
      : null,
    menus.packing
      ? {
          href: '/dashboard/packing-list',
          title: 'Packing List',
          eyebrow: 'Operations',
          description: 'Review outgoing preparation and packing progress.',
          accent: 'sand',
        }
      : null,
    menus.userAccess
      ? {
          href: '/dashboard/user-access',
          title: 'User Access',
          eyebrow: 'Control',
          description: 'Manage role mapping and permission access from one place.',
          accent: 'platinum',
        }
      : null,
  ].filter(Boolean)

  const insights = [
    {
      value: quickActions.length,
      label: 'Available Modules',
      note: 'Visible based on your role and permission settings.',
    },
    {
      value: role.replaceAll('_', ' '),
      label: 'Current Role',
      note: 'This dashboard adapts to the access assigned to your account.',
    },
    {
      value: permissions.length,
      label: 'Active Permissions',
      note: 'Permission rules are now configurable from User Access.',
    },
  ]

  const focusList = quickActions.slice(0, 4)

  if (!isAdmin) {
    return (
      <div className={styles.dashboardShell}>
        <section className={styles.heroCard}>
          <div className={styles.heroCopy}>
            <span className={styles.heroKicker}>{formatToday()}</span>
            <h1 className={styles.heroTitle}>Hello {userLabel}!</h1>
            <p className={styles.heroSupport}>Glad to have you back.</p>
            <p className={styles.heroQuote}>&ldquo;{quoteOfTheDay}&rdquo;</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.dashboardShell}>
      <section className={styles.heroCard}>
        <div className={styles.heroCopy}>
          <span className={styles.heroKicker}>{formatToday()}</span>
          <h1 className={styles.heroTitle}>Hello {userLabel}!</h1>
          <p className={styles.heroSupport}>Glad to have you back.</p>
          <p className={styles.heroQuote}>&ldquo;{quoteOfTheDay}&rdquo;</p>
        </div>
      </section>

      <div className={styles.contentGrid}>
        <div className={styles.leftColumn}>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.sectionKicker}>Quick Access</p>
                <h2 className={styles.sectionTitle}>Your modules</h2>
              </div>
            </div>

            <div className={styles.actionGrid}>
              {quickActions.map((item) => (
                <Link key={item.href} href={item.href} className={`${styles.actionCard} ${getAccentClass(item.accent)}`}>
                  <span className={styles.actionEyebrow}>{item.eyebrow}</span>
                  <strong className={styles.actionTitle}>{item.title}</strong>
                  <span className={styles.actionText}>{item.description}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.sectionKicker}>Today&apos;s Focus</p>
                <h2 className={styles.sectionTitle}>Recommended next steps</h2>
              </div>
            </div>

            <div className={styles.focusList}>
              {focusList.map((item, index) => (
                <Link key={item.href} href={item.href} className={styles.focusRow}>
                  <span className={styles.focusIndex}>{String(index + 1).padStart(2, '0')}</span>
                  <div className={styles.focusCopy}>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </div>
                  <span className={styles.focusArrow}>&rarr;</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className={styles.rightColumn}>
          <section className={`${styles.sectionCard} ${styles.compactCard}`}>
            <p className={styles.sectionKicker}>Snapshot</p>
            <h2 className={styles.sectionTitle}>Role insights</h2>

            <div className={styles.insightStack}>
              {insights.map((item) => (
                <div key={item.label} className={styles.insightCard}>
                  <strong className={styles.insightValue}>{item.value}</strong>
                  <span className={styles.insightLabel}>{item.label}</span>
                  <p className={styles.insightNote}>{item.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={`${styles.sectionCard} ${styles.compactCard} ${styles.accentCard}`}>
            <p className={styles.sectionKicker}>Access Design</p>
            <h2 className={styles.sectionTitle}>Responsive by role</h2>
            <p className={styles.accentCopy}>
              Mobile keeps actions concise and stacked. Desktop expands into a broader operational overview with more
              breathing room.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
