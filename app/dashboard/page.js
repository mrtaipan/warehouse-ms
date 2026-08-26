import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { canAccessOperationsCalendar, getAllowedMenus, getStorageFeatureAccess } from '@/utils/permissions'
import { loadAccessContext } from '@/utils/access-control'
import RestockShortcutButton from './restock-shortcut-client'
import ItemSearchShortcutButton from './item-search-shortcut-client'
import GrnSummaryCopyButton from './grn-summary-copy-button'
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
  'Small progress is still progress.',
  "You don't have to be great to start, but you have to start to be great.",
  'Done is better than perfect. - Selesaikan dulu, sempurnakan belakangan.',
  'Every expert was once a beginner. - Semua orang hebat dulunya berawal dari pemula.',
  'Kalau capek, istirahat. Bukan berhenti.',
  'Jatuh tujuh kali, bangkit delapan kali!',
  'Your mindset determines your outcome.',
  'Bukan seberapa cepat, tapi seberapa konsisten kamu jalan.',
  "Comparison is the thief of joy. - Jangan bandingin progress kamu sama orang lain.",
  "Setiap 'belum bisa' itu artinya 'masih belajar', bukan 'nggak bisa'.",
  'Life is 10% what happens to you and 90% how you react to it.',
  'The best time to plant a tree was 20 years ago. The second best time is now.',
  'You are not behind. You are exactly where you need to be.',
  "Believe you can and you're halfway there.",
  'Takut itu manusiawi. Tapi maju meski takut, itu keberanian.',
  'Yang penting bukan seberapa besar langkahnya, tapi seberapa sering kamu melangkah.',
  'Doubt kills more dreams than failure ever will.',
  'Kamu udah sejauh ini bukan karena kebetulan - kamu emang layak sampai di sini.',
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

function getRestockActions(storageAccess) {
  const actions = []

  if (storageAccess.restockSubmit) {
    actions.push({
      href: '/restock-request',
      label: 'Submit Request',
      text: 'Create a new request for restock.',
      tone: 'primary',
    })
  }

  if (storageAccess.restockPicker) {
    actions.push({
      href: '/take-requests',
      label: 'Stock Replenishment',
      text: 'Pick and complete restock requests.',
      tone: 'secondary',
    })
  }

  return actions
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

function cleanSummaryText(value) {
  return String(value || '').trim()
}

function dedupeSummaryParts(parts = []) {
  const seen = new Set()

  return parts.filter((part) => {
    const normalized = cleanSummaryText(part)
    if (!normalized) return false
    const key = normalized.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getSjComparisonLabel(value) {
  if (value == null) {
    return 'Tidak ada SJ'
  }

  if (Number(value) === 0) {
    return 'sesuai SJ'
  }

  return `${Number(value) > 0 ? '+' : ''}${formatNumber(value)}pcs dari SJ`
}

function withEndingPeriod(value = '') {
  const text = cleanSummaryText(value)
  if (!text) return ''
  return /[.!?]$/.test(text) ? text : `${text}.`
}

function getGradeBreakdownLabel(row = {}, fallback = '') {
  const label = cleanSummaryText(row.pl_name) || dedupeSummaryParts([
    row.model_name,
    row.variant_name || row.variant_label || row.model_color,
  ]).join(' ')

  return label || cleanSummaryText(row.source_variant_code || row.variant_code) || cleanSummaryText(fallback) || 'Grade A item'
}

function buildGradeBreakdownRows(rows = [], fallback = '') {
  const grouped = new Map()

  const list = rows || []
  list.forEach((row) => {
    const qty = Number(row.qty || 0)
    if (qty <= 0) return

    const label = getGradeBreakdownLabel(row, fallback)
    const key = label.toLowerCase()
    const current = grouped.get(key) || { label, qty: 0 }
    current.qty += qty
    grouped.set(key, current)
  })

  return Array.from(grouped.values()).sort((left, right) => left.label.localeCompare(right.label))
}

function buildGrnSummaryCopyText(selectedInbound, summary) {
  if (!selectedInbound || !summary) return ''

  const lines = [
    `${selectedInbound.grn_number} - ${summary.supplierName}`,
    summary.productSummary ? withEndingPeriod(summary.productSummary) : '',
    `*Grade A:* ${formatNumber(summary.displayGradeAQty)} pcs.`,
  ]

  if ((summary.gradeABreakdownRows || []).length > 1) {
    summary.gradeABreakdownRows.forEach((item) => {
      lines.push(`\t- ${item.label}: ${formatNumber(item.qty)} pcs.`)
    })
  }

  if (summary.displayGradeBQty > 0) {
    lines.push(`*Grade B:* ${formatNumber(summary.displayGradeBQty)} pcs.`)
  }

  if (summary.totalReturQty > 0) {
    lines.push(`*Total Reject:* ${formatNumber(summary.totalReturQty)} pcs.`)

    if (summary.returQcQty > 0) {
      lines.push(`\t- Reject QC: ${formatNumber(summary.returQcQty)} pcs.`)
    }

    if (summary.returPlQty > 0) {
      lines.push(`\t- Reject Packing List: ${formatNumber(summary.returPlQty)} pcs.`)
    }

    if (summary.returBongkarQty > 0) {
      lines.push(`\t- Reject Bongkar: ${formatNumber(summary.returBongkarQty)} pcs.`)
    }
  }

  lines.push(`Total: ${formatNumber(summary.totalSummaryQty)} pcs [${getSjComparisonLabel(summary.sjVarianceQty)}].`)

  return lines.filter(Boolean).join('\n')
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3v3" />
      <path d="M17 3v3" />
      <path d="M4 9h16" />
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 13h.01" />
      <path d="M12 13h.01" />
      <path d="M16 13h.01" />
      <path d="M8 17h.01" />
      <path d="M12 17h.01" />
      <path d="M16 17h.01" />
    </svg>
  )
}

function DeliveryReportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4.5h14v15H5z" />
      <path d="M8 15v-3" />
      <path d="M12 15V8" />
      <path d="M16 15v-5" />
      <path d="M8 18h8" />
    </svg>
  )
}

function addGradeTotals(total, row = {}) {
  const grade = String(row.grade || '').toUpperCase()
  const qty = Number(row.qty || 0)

  if (grade === 'A') total.gradeA += qty
  if (grade === 'B') total.gradeB += qty
  if (grade === 'C') total.gradeC += qty
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
    .select('id, grn_number, inbound_date, item_name, total_received_qty, total_claimed_qty, suppliers:dir_suppliers!supplier_id (supplier_name)')
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
      .select('id, grn_number, inbound_date, item_name, total_received_qty, total_claimed_qty, suppliers:dir_suppliers!supplier_id (supplier_name)')
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
    { data: qcConfirmRows, error: qcConfirmError },
    { data: plReceivingRows, error: plReceivingError },
    { data: plBreakdownRows, error: plBreakdownError },
    { data: returnRows, error: returnError },
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
      .select('id, qty, grade')
      .eq('inbound_id', selectedInbound.id),
    supabase
      .from('pl_receiving')
      .select('id, received_qty')
      .eq('inbound_id', selectedInbound.id)
      .limit(5000),
    supabase
      .from('pl_size_breakdown')
      .select('*')
      .eq('inbound_id', selectedInbound.id)
      .limit(5000),
    supabase
      .from('warehouse_returns')
      .select('id, qty, source_phase')
      .eq('inbound_id', selectedInbound.id)
      .limit(5000),
  ])

  const firstError = unloadError || qcError || qcConfirmError || plReceivingError || plBreakdownError || returnError
  if (firstError) {
    return { grnOptions, selectedGrn, selectedInbound, summary: null, error: firstError.message }
  }

  const totalReceivingQty = Number(selectedInbound.total_received_qty || 0)
  const totalUnloadQty = (unloadRows || []).reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const totalAllocatedQty = (qcRows || []).reduce((sum, item) => sum + Number(item.allocated_qty || 0), 0)
  const totalQcIn = (qcRows || []).reduce(
    (sum, item) => sum + Number(item.qty_a || 0) + Number(item.qty_b || 0) + Number(item.qty_c || 0),
    0
  )
  const totalQcConfirm = (qcConfirmRows || []).reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const plReceivingQty = (plReceivingRows || []).reduce((sum, item) => sum + Number(item.received_qty || 0), 0)
  const plBreakdownQty = (plBreakdownRows || []).reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const qcConfirmGradeAQty = (qcConfirmRows || [])
    .filter((item) => String(item.grade || '').trim().toUpperCase() === 'A')
    .reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const qcConfirmGradeBQty = (qcConfirmRows || [])
    .filter((item) => String(item.grade || '').trim().toUpperCase() === 'B')
    .reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const returBongkarQty = (returnRows || [])
    .filter((item) => ['inbound', 'bongkar'].includes(String(item.source_phase || '').trim().toLowerCase()))
    .reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const returQcQty = (returnRows || [])
    .filter((item) => String(item.source_phase || '').trim().toLowerCase() === 'qc')
    .reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const returPlQty = (returnRows || [])
    .filter((item) => ['packing list', 'packing_list'].includes(String(item.source_phase || '').trim().toLowerCase()))
    .reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const totalReturQty = returBongkarQty + returQcQty + returPlQty
  const totalQcProcessedQty = totalQcConfirm + returQcQty
  const displayGradeAQty = plBreakdownQty
  const displayGradeBQty = qcConfirmGradeBQty
  const totalSummaryQty = displayGradeAQty + totalReturQty
  const sjQty = selectedInbound.total_claimed_qty == null ? null : Number(selectedInbound.total_claimed_qty || 0)
  const sjVarianceQty = sjQty == null ? null : totalSummaryQty - sjQty
  const supplierName = selectedInbound.suppliers?.supplier_name || '-'
  const itemName = cleanSummaryText(selectedInbound.item_name)
  const fallbackItemName = cleanSummaryText((unloadRows || [])[0]?.model_name)
  const productSummary = itemName || fallbackItemName
  const gradeABreakdownRows = buildGradeBreakdownRows(plBreakdownRows, productSummary)

  return {
    grnOptions,
    selectedGrn,
    selectedInbound,
    summary: {
      totalReceivingQty,
      totalUnloadQty,
      totalAllocatedQty,
      totalQcIn,
      totalQcConfirm,
      totalQcProcessedQty,
      plReceivingQty,
      plBreakdownQty,
      displayGradeAQty,
      displayGradeBQty,
      qcConfirmGradeAQty,
      returBongkarQty,
      returQcQty,
      returPlQty,
      totalReturQty,
      totalSummaryQty,
      sjQty,
      sjVarianceQty,
      supplierName,
      productSummary,
      gradeABreakdownRows,
    },
    error: '',
  }
}

function AdminGrnSummaryCard({ grnOptions = [], selectedGrn = '', selectedInbound = null, summary = null, error = '' }) {
  const copyText = buildGrnSummaryCopyText(selectedInbound, summary)

  return (
    <section className={styles.sectionCard}>
      <div className={styles.grnSummaryTopRow}>
        <h2 className={styles.grnSummaryTitle}>GRN Summary</h2>
        <form className={styles.grnSummaryInlineForm} method="get">
          <label className={styles.grnSummaryInlineField}>
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
          <button type="submit" className={styles.grnSummaryIconButton} aria-label="Show summary" title="Show summary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
        </form>
      </div>

      {error ? <p className={styles.grnSummaryError}>{error}</p> : null}

      {!selectedGrn ? (
        <div className={styles.grnSummaryEmpty}>Choose a GRN number to show the operational summary.</div>
      ) : !selectedInbound ? (
        <div className={styles.grnSummaryEmpty}>No matching GRN found.</div>
      ) : summary ? (
        <>
          <div className={styles.grnSummaryMeta}>
            <strong>{selectedInbound.grn_number}</strong>
            <span>{summary.supplierName}</span>
          </div>
          <div className={styles.grnMetricGrid}>
            <div className={styles.grnMetricCard}>
              <span>Inbound</span>
              <strong>{formatNumber(summary.totalUnloadQty)}</strong>
              <small>
                Total Receiving Qty {formatNumber(summary.totalReceivingQty)}<br />
                Total Unload Qty {formatNumber(summary.totalUnloadQty)}
              </small>
            </div>
            <div className={styles.grnMetricCard}>
              <span>QC</span>
              <strong>{formatNumber(summary.totalQcProcessedQty)}</strong>
              <small>
                Total Allocated {formatNumber(summary.totalAllocatedQty)}<br />
                QC Confirm {formatNumber(summary.totalQcConfirm)}<br />
                Reject QC {formatNumber(summary.returQcQty)}
              </small>
            </div>
            <div className={styles.grnMetricCard}>
              <span>Packing List</span>
              <strong>{formatNumber(summary.plBreakdownQty)}</strong>
              <small>
                PL Receiving {formatNumber(summary.plReceivingQty)}<br />
                PL Breakdown {formatNumber(summary.plBreakdownQty)}
              </small>
            </div>
            <div className={styles.grnMetricCard}>
              <span>Retur</span>
              <strong>{formatNumber(summary.totalReturQty)}</strong>
              <small>
                Retur Bongkar {formatNumber(summary.returBongkarQty)}<br />
                Retur QC {formatNumber(summary.returQcQty)}<br />
                Retur Packing List {formatNumber(summary.returPlQty)}
              </small>
            </div>
          </div>
          <div className={styles.grnSummaryDetailCard}>
            <div className={styles.grnSummaryDetailHeader}>
              <strong className={styles.grnSummaryDetailTitle}>
                {selectedInbound.grn_number} - {summary.supplierName}
              </strong>
              <GrnSummaryCopyButton text={copyText} />
            </div>
            <div className={styles.grnSummaryNarrative}>
              {summary.productSummary ? <p>{withEndingPeriod(summary.productSummary)}</p> : null}
              <p className={styles.grnSummaryStrongLine}>Grade A: {formatNumber(summary.displayGradeAQty)} pcs.</p>
              {(summary.gradeABreakdownRows || []).length > 1 ? (
                <div className={styles.grnSummarySubLines}>
                  {summary.gradeABreakdownRows.map((item) => (
                    <p key={item.label}>- {item.label}: {formatNumber(item.qty)} pcs.</p>
                  ))}
                </div>
              ) : null}
              {summary.displayGradeBQty > 0 ? (
                <p className={styles.grnSummaryStrongLine}>Grade B: {formatNumber(summary.displayGradeBQty)} pcs.</p>
              ) : null}
              {summary.totalReturQty > 0 ? (
                <div className={styles.grnSummaryRejectBlock}>
                  <p className={styles.grnSummaryStrongLine}>Total Reject: {formatNumber(summary.totalReturQty)} pcs.</p>
                  <div className={styles.grnSummarySubLines}>
                    {summary.returQcQty > 0 ? <p>- Reject QC: {formatNumber(summary.returQcQty)} pcs.</p> : null}
                    {summary.returPlQty > 0 ? <p>- Reject Packing List: {formatNumber(summary.returPlQty)} pcs.</p> : null}
                    {summary.returBongkarQty > 0 ? <p>- Reject Bongkar: {formatNumber(summary.returBongkarQty)} pcs.</p> : null}
                  </div>
                </div>
              ) : null}
              <p>Total: {formatNumber(summary.totalSummaryQty)} pcs [{getSjComparisonLabel(summary.sjVarianceQty)}].</p>
            </div>
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
  const storageAccess = getStorageFeatureAccess(role, permissions, isAdmin)
  const restockActions = getRestockActions(storageAccess)

  const rawUserLabel =
    profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Team'
  const userLabel = formatDashboardName(rawUserLabel)
  const quoteOfTheDay = getDailyQuote(user.email)
  const todayDate = getTodayDateString()
  const params = await searchParams
  const selectedGrn = String(params?.grn || '').trim()
  const showOperationsCalendarButton = canAccessOperationsCalendar(role, permissions, isAdmin)

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
              <div className={styles.heroQuickActions}>
                <ItemSearchShortcutButton />
                <RestockShortcutButton actions={restockActions} />
                {showOperationsCalendarButton ? (
                  <Link href="/operations-calendar" className={styles.heroProfileLink} aria-label="Open Operations Calendar">
                    <span className={styles.heroActionIcon}>
                      <CalendarIcon />
                    </span>
                  </Link>
                ) : null}
                {showMyArklifeButton ? (
                  <Link href={menus.myArklifeHref} className={styles.heroProfileLink} aria-label="Open MyARKLIFE">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 21a8 8 0 0 0-16 0" />
                      <circle cx="12" cy="8" r="4" />
                    </svg>
                  </Link>
                ) : null}
              </div>
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
            <div className={styles.heroQuickActions}>
              <ItemSearchShortcutButton />
              <RestockShortcutButton actions={restockActions} />
              <Link href="/dashboard/delivery-report" className={styles.heroProfileLink} aria-label="Open Delivery Report" title="Delivery Report">
                <DeliveryReportIcon />
              </Link>
              {showOperationsCalendarButton ? (
                <Link href="/operations-calendar" className={styles.heroProfileLink} aria-label="Open Operations Calendar">
                  <span className={styles.heroActionIcon}>
                    <CalendarIcon />
                  </span>
                </Link>
              ) : null}
              {showMyArklifeButton ? (
                <Link href={menus.myArklifeHref} className={styles.heroProfileLink} aria-label="Open MyARKLIFE">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 21a8 8 0 0 0-16 0" />
                    <circle cx="12" cy="8" r="4" />
                  </svg>
                </Link>
              ) : null}
            </div>
          </div>
          <h1 className={styles.heroTitle}>Hello {userLabel}!</h1>
          <p className={styles.heroSupport}>Glad to have you back.</p>
          <p className={styles.heroQuote}>&ldquo;{quoteOfTheDay}&rdquo;</p>
        </div>
      </section>

      <div className={styles.contentGrid}>
        <div className={styles.fullColumn}>
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

          <AdminGrnSummaryCard
            grnOptions={adminGrnSummary?.grnOptions || []}
            selectedGrn={adminGrnSummary?.selectedGrn || ''}
            selectedInbound={adminGrnSummary?.selectedInbound || null}
            summary={adminGrnSummary?.summary || null}
            error={adminGrnSummary?.error || ''}
          />
        </div>
      </div>
    </div>
  )
}

