import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { hasPermission } from '@/utils/permissions'
import { loadAccessContext } from '@/utils/access-control'
import ReceivingFiltersClient from './receiving-filters-client'

const PAGE_SIZE = 25

function getSingleValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function getPage(value) {
  const parsed = Number.parseInt(getSingleValue(value) || '1', 10)
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed
}

function sanitizeSearch(value) {
  return String(value || '').trim().replace(/[%,()]/g, ' ')
}

function formatDateValue(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function getDefaultInboundStartDate() {
  const jakartaParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const day = Number(jakartaParts.find((part) => part.type === 'day')?.value || 1)
  const month = Number(jakartaParts.find((part) => part.type === 'month')?.value || 1)
  const year = Number(jakartaParts.find((part) => part.type === 'year')?.value || 1970)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() - 30)

  return formatDateValue(date)
}

function getMonthBounds(value) {
  const month = String(value || '').trim()

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return null
  }

  const [year, monthNumber] = month.split('-').map(Number)
  const start = `${year}-${String(monthNumber).padStart(2, '0')}-01`
  const nextMonthDate = new Date(Date.UTC(year, monthNumber, 1))
  const next = `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, '0')}-01`

  return { start, next }
}

function createOverviewHref({ supplierId, month, search, page }) {
  const params = new URLSearchParams()

  if (search) params.set('search', search)
  if (!search && supplierId) params.set('supplier', supplierId)
  if (!search && month) params.set('month', month)
  if (page > 1) params.set('page', String(page))

  const query = params.toString()
  return query ? `/dashboard/inbound/receiving?${query}` : '/dashboard/inbound/receiving'
}

export default async function InboundReceivingPage({ searchParams }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { role, permissions, isAdmin } = await loadAccessContext(supabase, user, 'role')
  const isInboundStaff = role === 'inbound_staff'
  const canCreateReceiving =
    !isInboundStaff &&
    (isAdmin || role === 'admin' || role === 'inbound_coordinator' || hasPermission(permissions, 'inbound.new.add', isAdmin))
  const canEditReceiving =
    !isInboundStaff &&
    (isAdmin || role === 'admin' || role === 'inbound_coordinator' || hasPermission(permissions, 'inbound.edit.edit', isAdmin))

  const params = await searchParams
  const search = sanitizeSearch(getSingleValue(params?.search))
  const supplierId = search ? '' : (getSingleValue(params?.supplier) || '').trim()
  const month = search ? '' : (getSingleValue(params?.month) || '').trim()
  const currentPage = getPage(params?.page)
  const from = (currentPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const monthBounds = getMonthBounds(month)
  const defaultInboundStartDate = getDefaultInboundStartDate()

  const supplierQuery = supabase
    .from('dir_suppliers')
    .select('id, supplier_name, group')
    .eq('is_active', true)
    .ilike('group', 'MOB')
    .order('supplier_name', { ascending: true })

  let ordersQuery = supabase
    .from('inbound')
    .select('*, suppliers:dir_suppliers!supplier_id (supplier_name)', { count: 'exact' })
    .in('status', ['draft', 'inbound'])
    .order('inbound_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (!search && supplierId) {
    ordersQuery = ordersQuery.eq('supplier_id', Number(supplierId))
  }

  if (search) {
    ordersQuery = ordersQuery.or(`grn_number.ilike.%${search}%,item_name.ilike.%${search}%`)
  }

  if (!search) {
    if (monthBounds) {
      ordersQuery = ordersQuery.gte('inbound_date', monthBounds.start).lt('inbound_date', monthBounds.next)
    } else {
      ordersQuery = ordersQuery.gte('inbound_date', defaultInboundStartDate)
    }
  }

  const [
    { data: suppliers, error: supplierError },
    { data: orders, error, count },
  ] = await Promise.all([
    supplierQuery,
    ordersQuery.range(from, to),
  ])

  const totalItems = count || 0
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / PAGE_SIZE) : 1

  if (totalItems > 0 && currentPage > totalPages) {
    redirect(createOverviewHref({ supplierId, month, search, page: totalPages }))
  }

  const safeCurrentPage = Math.min(currentPage, totalPages)

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Inbound</p>
          <h1 style={styles.title}>Overview</h1>
          <p style={styles.subtitle}>Track recent receiving records, find older GRNs by search, and continue inbound work from one place.</p>
        </div>

        {canCreateReceiving ? (
          <Link href="/dashboard/inbound/new" style={styles.primaryButton}>
            + New Receiving
          </Link>
        ) : null}
      </div>

      <ReceivingFiltersClient
        key={`${supplierId}-${month}-${search}`}
        suppliers={suppliers || []}
        initialOrders={orders || []}
        initialTotalItems={totalItems}
        initialFilters={{ supplierId, month, search, page: safeCurrentPage }}
        initialError={supplierError?.message || error?.message || ''}
        canEditReceiving={canEditReceiving}
        isInboundStaff={isInboundStaff}
      />
    </section>
  )
}

const styles = {
  panel: {
    background: '#f7f9fb',
    border: '1px solid #e2e8f0',
    borderRadius: '22px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  eyebrow: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#64748b',
  },
  title: {
    margin: '4px 0 0',
    fontSize: '28px',
    lineHeight: 1.05,
    fontWeight: 900,
    color: '#0f172a',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#475569',
    fontSize: '13px',
    lineHeight: 1.45,
    maxWidth: '640px',
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '40px',
    padding: '0 16px',
    background: '#111827',
    color: '#fff',
    borderRadius: '999px',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: '800',
    whiteSpace: 'nowrap',
  },
  emptyBox: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '18px',
    padding: '18px',
  },
  tableWrap: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '18px',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  headRow: {
    background: '#f8fafc',
  },
  bodyRow: {
    borderTop: '1px solid #f1f5f9',
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'nowrap',
  },
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    textDecoration: 'none',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  pageButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0f172a',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: '800',
    lineHeight: 1.4,
  },
  pageButtonDisabled: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    fontSize: '13px',
    fontWeight: '800',
    lineHeight: 1.4,
  },
  pageMeta: {
    color: '#64748b',
    fontSize: '13px',
    fontWeight: '700',
    lineHeight: 1.4,
  },
  emptyText: {
    margin: 0,
    color: '#6b7280',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
  },
}
