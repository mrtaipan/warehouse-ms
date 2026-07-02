import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getAllowedMenus } from '@/utils/permissions'
import { loadAccessContext } from '@/utils/access-control'
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

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(value || 0))
}

function addGradeTotals(total, row = {}) {
  const grade = String(row.grade || '').toUpperCase()
  const qty = Number(row.qty || 0)

  if (grade === 'A') total.gradeA += qty
  if (grade === 'B') total.gradeB += qty
  if (grade === 'C') total.gradeC += qty
}

function cleanDimension(value, fallback) {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function getVariantLabel(row = {}) {
  return cleanDimension(
    row.variant_name || row.variant_label || row.variant_code || row.model_color || row.model_colour || row.color,
    'NO VARIANT'
  )
}

function getBreakdownKey({ brand, model, variant }) {
  return `${brand}|||${model}|||${variant}`
}

function getBreakdownRow(grouped, dimensions = {}) {
  const brand = cleanDimension(dimensions.brand, 'UNBRANDED')
  const model = cleanDimension(dimensions.model, 'UNKNOWN MODEL')
  const variant = cleanDimension(dimensions.variant, 'NO VARIANT')
  const key = getBreakdownKey({ brand, model, variant })
  const current =
    grouped.get(key) || {
      key,
      brand,
      model,
      variant,
      inboundTotal: 0,
      gradeA: 0,
      gradeB: 0,
      gradeC: 0,
      qcInTotal: 0,
      qcOutTotal: 0,
    }

  grouped.set(key, current)
  return current
}

function addBreakdownGradeTotals(rowTotal, source = {}) {
  const grade = String(source.grade || '').toUpperCase()
  const qty = Number(source.qty || 0)

  if (grade === 'A') rowTotal.gradeA += qty
  if (grade === 'B') rowTotal.gradeB += qty
  if (grade === 'C') rowTotal.gradeC += qty
}

function finalizeBreakdownRows(grouped) {
  return Array.from(grouped.values())
    .map((row) => ({
      ...row,
      qcInTotal: Number(row.gradeA || 0) + Number(row.gradeB || 0) + Number(row.gradeC || 0),
      qcOutTotal: Number(row.gradeA || 0),
    }))
    .sort((left, right) => {
      const brandCompare = left.brand.localeCompare(right.brand)
      if (brandCompare) return brandCompare
      const modelCompare = left.model.localeCompare(right.model)
      if (modelCompare) return modelCompare
      return left.variant.localeCompare(right.variant, undefined, { numeric: true })
    })
}

async function loadInboundUnloadRowsForDashboard(supabase, inboundId) {
  const relationSelect = `
    id,
    qty,
    brand_id,
    category_id,
    model_name,
    brands:dir_brands!brand_id (
      id,
      brand_name
    ),
    categories:dir_categories!category_id (
      id,
      category_name,
      full_name
    )
  `
  const selectCandidates = [
    `${relationSelect}, model_color, variant_name, variant_label, variant_code`,
    `${relationSelect}, variant_name, variant_label, variant_code`,
    `${relationSelect}, model_color`,
    relationSelect,
  ]
  let lastError = null

  for (const selectColumns of selectCandidates) {
    const { data, error } = await supabase
      .from('inbound_unload')
      .select(selectColumns)
      .eq('inbound_id', inboundId)

    if (!error) {
      return { data: data || [], error: null }
    }

    lastError = error
  }

  return { data: [], error: lastError }
}

async function loadAdminGrnSummary(supabase, selectedGrn = '') {
  const { data: inboundRows, error: inboundError } = await supabase
    .from('inbound')
    .select('id, grn_number, inbound_date, item_name, total_received_qty')
    .order('created_at', { ascending: false })
    .limit(250)

  if (inboundError) {
    return { grnOptions: [], selectedGrn, selectedInbound: null, summary: null, error: inboundError.message }
  }

  let grnOptions = (inboundRows || []).filter((item) => item.grn_number)
  let selectedInbound = selectedGrn
    ? grnOptions.find((item) => item.grn_number === selectedGrn) || null
    : null

  if (selectedGrn && !selectedInbound) {
    const { data: exactInbound, error: exactInboundError } = await supabase
      .from('inbound')
      .select('id, grn_number, inbound_date, item_name, total_received_qty')
      .eq('grn_number', selectedGrn)
      .maybeSingle()

    if (exactInboundError) {
      return { grnOptions, selectedGrn, selectedInbound: null, summary: null, error: exactInboundError.message }
    }

    if (exactInbound?.grn_number) {
      selectedInbound = exactInbound
      grnOptions = [exactInbound, ...grnOptions.filter((item) => item.id !== exactInbound.id)]
    }
  }

  if (!selectedInbound) {
    return { grnOptions, selectedGrn, selectedInbound: null, summary: null, error: '' }
  }

  const [
    { data: unloadRows, error: unloadError },
    { data: qcRows, error: qcError },
    { data: confirmAdjustmentRows, error: confirmAdjustmentError },
    { data: returnAdjustmentRows, error: returnAdjustmentError },
  ] = await Promise.all([
    loadInboundUnloadRowsForDashboard(supabase, selectedInbound.id),
    supabase
      .from('qc_items')
      .select(`
        *,
        inbound_unload:inbound_unload_id (
          id,
          brand_id,
          category_id,
          model_name,
          brands:dir_brands!brand_id (
            id,
            brand_name
          ),
          categories:dir_categories!category_id (
            id,
            category_name,
            full_name
          )
        ),
        product_model:product_model_id (
          id,
          brands:dir_brands!brand_id (
            id,
            brand_name
          ),
          categories:dir_categories!category_id (
            id,
            category_name,
            full_name
          )
        )
      `)
      .eq('inbound_id', selectedInbound.id),
    supabase
      .from('qc_confirm')
      .select(`
        *,
        brands:dir_brands!brand_id (
          id,
          brand_name
        ),
        categories:dir_categories!category_id (
          id,
          category_name,
          full_name
        )
      `)
      .eq('inbound_id', selectedInbound.id)
      .eq('is_adjustment', true),
    supabase
      .from('warehouse_returns')
      .select(`
        *,
        brands:dir_brands!brand_id (
          id,
          brand_name
        ),
        categories:dir_categories!category_id (
          id,
          category_name,
          full_name
        )
      `)
      .eq('inbound_id', selectedInbound.id)
      .eq('source_phase', 'qc')
      .eq('is_adjustment', true),
  ])

  const firstError = unloadError || qcError || confirmAdjustmentError || returnAdjustmentError
  if (firstError) {
    return { grnOptions, selectedGrn, selectedInbound, summary: null, error: firstError.message }
  }

  const inboundTotalFromUnload = (unloadRows || []).reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const breakdownByKey = new Map()

  ;(unloadRows || []).forEach((item) => {
    const breakdownRow = getBreakdownRow(breakdownByKey, {
      brand: item.brands?.brand_name,
      model: item.model_name,
      variant: getVariantLabel(item),
    })
    breakdownRow.inboundTotal += Number(item.qty || 0)
  })

  const gradeTotals = (qcRows || []).reduce(
    (total, item) => {
      const breakdownRow = getBreakdownRow(breakdownByKey, {
        brand: item.product_model?.brands?.brand_name || item.inbound_unload?.brands?.brand_name,
        model: item.model_name || item.inbound_unload?.model_name,
        variant: getVariantLabel(item),
      })
      breakdownRow.gradeA += Number(item.qty_a || 0)
      breakdownRow.gradeB += Number(item.qty_b || 0)
      breakdownRow.gradeC += Number(item.qty_c || 0)
      total.gradeA += Number(item.qty_a || 0)
      total.gradeB += Number(item.qty_b || 0)
      total.gradeC += Number(item.qty_c || 0)
      return total
    },
    { gradeA: 0, gradeB: 0, gradeC: 0 }
  )

  ;[...(confirmAdjustmentRows || []), ...(returnAdjustmentRows || [])].forEach((item) => {
    addGradeTotals(gradeTotals, item)
    const breakdownRow = getBreakdownRow(breakdownByKey, {
      brand: item.brands?.brand_name,
      model: item.model_name,
      variant: getVariantLabel(item),
    })
    addBreakdownGradeTotals(breakdownRow, item)
  })

  const breakdownRows = finalizeBreakdownRows(breakdownByKey)

  return {
    grnOptions,
    selectedGrn,
    selectedInbound,
    summary: {
      inboundTotal: inboundTotalFromUnload || Number(selectedInbound.total_received_qty || 0),
      qcInTotal: gradeTotals.gradeA + gradeTotals.gradeB + gradeTotals.gradeC,
      qcOutTotal: gradeTotals.gradeA,
      gradeA: gradeTotals.gradeA,
      gradeB: gradeTotals.gradeB,
      gradeC: gradeTotals.gradeC,
      breakdownRows,
    },
    error: '',
  }
}

function AdminGrnSummaryCard({ grnOptions = [], selectedGrn = '', selectedInbound = null, summary = null, error = '' }) {
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHead}>
        <div>
          <p className={styles.sectionKicker}>QC Snapshot</p>
          <h2 className={styles.sectionTitle}>GRN Summary</h2>
        </div>
      </div>

      <form className={styles.grnSummaryForm} method="get">
        <label className={styles.grnSummaryField}>
          <span>GRN Number</span>
          <input
            name="grn"
            list="dashboard-grn-options"
            defaultValue={selectedGrn}
            className={styles.grnSummaryInput}
            placeholder="Select GRN number"
          />
          <datalist id="dashboard-grn-options">
            {grnOptions.map((item) => (
              <option key={item.id} value={item.grn_number} />
            ))}
          </datalist>
        </label>
        <button type="submit" className={styles.grnSummaryButton}>Show Summary</button>
      </form>

      {error ? <p className={styles.grnSummaryError}>{error}</p> : null}

      {!selectedGrn ? (
        <div className={styles.grnSummaryEmpty}>Choose a GRN number to show inbound and QC totals.</div>
      ) : !selectedInbound ? (
        <div className={styles.grnSummaryEmpty}>No matching GRN found.</div>
      ) : summary ? (
        <>
          <div className={styles.grnSummaryMeta}>
            <strong>{selectedInbound.grn_number}</strong>
            <span>{selectedInbound.item_name || 'Inbound item'}</span>
          </div>
          <div className={styles.grnMetricGrid}>
            <div className={styles.grnMetricCard}>
              <span>Inbound Total</span>
              <strong>{formatNumber(summary.inboundTotal)}</strong>
            </div>
            <div className={styles.grnMetricCard}>
              <span>QC In Total</span>
              <strong>{formatNumber(summary.qcInTotal)}</strong>
              <small>A {formatNumber(summary.gradeA)} / B {formatNumber(summary.gradeB)} / C {formatNumber(summary.gradeC)}</small>
            </div>
            <div className={styles.grnMetricCard}>
              <span>QC Out Total</span>
              <strong>{formatNumber(summary.qcOutTotal)}</strong>
              <small>Grade A only</small>
            </div>
          </div>
          <div className={styles.grnBreakdownWrap}>
            <div className={styles.grnBreakdownHeader}>
              <strong>Breakdown</strong>
              <span>Per brand, model, and variant</span>
            </div>
            {summary.breakdownRows?.length ? (
              <div className={styles.grnBreakdownTableWrap}>
                <table className={styles.grnBreakdownTable}>
                  <thead>
                    <tr>
                      <th>Brand</th>
                      <th>Model</th>
                      <th>Variant</th>
                      <th>Inbound</th>
                      <th>QC In</th>
                      <th>QC Out</th>
                      <th>A / B / C</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.breakdownRows.map((item) => (
                      <tr key={item.key}>
                        <td>{item.brand}</td>
                        <td>{item.model}</td>
                        <td>{item.variant}</td>
                        <td>{formatNumber(item.inboundTotal)}</td>
                        <td>{formatNumber(item.qcInTotal)}</td>
                        <td>{formatNumber(item.qcOutTotal)}</td>
                        <td>
                          A {formatNumber(item.gradeA)} / B {formatNumber(item.gradeB)} / C {formatNumber(item.gradeC)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.grnSummaryEmpty}>No brand, model, or variant detail found for this GRN.</div>
            )}
          </div>
        </>
      ) : null}
    </section>
  )
}

export default async function DashboardPage({ searchParams }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { profile, role, permissions, isAdmin } = await loadAccessContext(supabase, user, 'role, display_name')
  const menus = getAllowedMenus(role, permissions, isAdmin)

  const rawUserLabel =
    profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Team'
  const userLabel = formatDashboardName(rawUserLabel)
  const quoteOfTheDay = getDailyQuote(user.email)
  const todayDate = getTodayDateString()
  const params = await searchParams
  const selectedGrn = String(params?.grn || '').trim()

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
  const adminGrnSummary = isAdmin ? await loadAdminGrnSummary(supabase, selectedGrn) : null

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
        <div className={styles.leftColumn}>
          <AdminGrnSummaryCard
            grnOptions={adminGrnSummary?.grnOptions || []}
            selectedGrn={adminGrnSummary?.selectedGrn || ''}
            selectedInbound={adminGrnSummary?.selectedInbound || null}
            summary={adminGrnSummary?.summary || null}
            error={adminGrnSummary?.error || ''}
          />
        </div>
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

