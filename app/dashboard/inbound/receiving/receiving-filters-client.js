'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/browser'

const PAGE_SIZE = 25
const supabase = createClient()

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

function formatDateDisplay(value) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function syncOverviewUrl({ supplierId, month, search, page }) {
  const params = new URLSearchParams()

  if (search) params.set('search', search)
  if (!search && supplierId) params.set('supplier', supplierId)
  if (!search && month) params.set('month', month)
  if (page > 1) params.set('page', String(page))

  const query = params.toString()
  window.history.replaceState(null, '', query ? `/dashboard/inbound/receiving?${query}` : '/dashboard/inbound/receiving')
}

function ActionIcon({ kind }) {
  const commonProps = {
    viewBox: '0 0 24 24',
    width: '18',
    height: '18',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }

  if (kind === 'unload') {
    return (
      <svg {...commonProps}>
        <path d="M9 4.5h6" />
        <path d="M9.5 3h5l1 2h2A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5h2z" />
        <path d="m8.5 12.5 2.2 2.2 4.8-5" />
      </svg>
    )
  }

  if (kind === 'receiving') {
    return (
      <svg {...commonProps}>
        <path d="M3 7.5h11v7H3z" />
        <path d="M14 10h3.5l2.5 2.5v2H14z" />
        <circle cx="7.5" cy="17.5" r="1.5" />
        <circle cx="17.5" cy="17.5" r="1.5" />
        <path d="M9 17.5h7" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 15v-4" />
      <path d="M12 15V8" />
      <path d="M16 15v-6" />
      <path d="M20 15v-2" />
    </svg>
  )
}

export default function ReceivingFiltersClient({
  suppliers = [],
  initialOrders = [],
  initialTotalItems = 0,
  initialFilters = {},
  initialError = '',
}) {
  const requestIdRef = useRef(0)
  const didMountRef = useRef(false)
  const [filters, setFilters] = useState({
    supplierId: initialFilters.supplierId || '',
    month: initialFilters.month || '',
    search: initialFilters.search || '',
  })
  const [page, setPage] = useState(initialFilters.page || 1)
  const [orders, setOrders] = useState(initialOrders)
  const [totalItems, setTotalItems] = useState(initialTotalItems)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)

  const totalPages = totalItems > 0 ? Math.ceil(totalItems / PAGE_SIZE) : 1
  const safePage = Math.min(page, totalPages)
  const hasPreviousPage = safePage > 1
  const hasNextPage = safePage < totalPages

  async function loadOrders(nextFilters, nextPage) {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    setError('')

    const search = sanitizeSearch(nextFilters.search)
    const effectiveFilters = search
      ? { supplierId: '', month: '', search }
      : { ...nextFilters, search }
    const monthBounds = getMonthBounds(effectiveFilters.month)
    const from = (nextPage - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('inbound')
      .select('id, grn_number, inbound_date, supplier_id, item_name, total_claimed_qty, created_at, suppliers:dir_suppliers!supplier_id (supplier_name)', { count: 'exact' })
      .in('status', ['draft', 'inbound'])
      .order('inbound_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (!search && effectiveFilters.supplierId) {
      query = query.eq('supplier_id', Number(effectiveFilters.supplierId))
    }

    if (search) {
      query = query.or(`grn_number.ilike.%${search}%,item_name.ilike.%${search}%`)
    }

    if (!search) {
      if (monthBounds) {
        query = query.gte('inbound_date', monthBounds.start).lt('inbound_date', monthBounds.next)
      } else {
        query = query.gte('inbound_date', getDefaultInboundStartDate())
      }
    }

    const { data, error: queryError, count } = await query.range(from, to)

    if (requestId !== requestIdRef.current) {
      return
    }

    if (queryError) {
      setError(queryError.message)
      setOrders([])
      setTotalItems(0)
    } else {
      setOrders(data || [])
      setTotalItems(count || 0)
      syncOverviewUrl({ ...effectiveFilters, page: nextPage })
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return undefined
    }

    const timer = window.setTimeout(() => {
      loadOrders(filters, page)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [filters, page])

  function updateFilter(name, value) {
    setFilters((prev) => {
      if (name === 'search' && sanitizeSearch(value)) {
        return { supplierId: '', month: '', search: value }
      }

      if ((name === 'supplierId' || name === 'month') && prev.search) {
        return { supplierId: '', month: '', search: '', [name]: value }
      }

      return {
        ...prev,
        [name]: value,
      }
    })
    setPage(1)
  }

  function resetFilters() {
    setFilters({ supplierId: '', month: '', search: '' })
    setPage(1)
  }

  function goToPage(nextPage) {
    setPage(nextPage)
  }

  return (
    <>
      <div style={styles.filters}>
        <label style={styles.field}>
          <span style={styles.label}>Search</span>
          <input
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
            placeholder="Search GRN or item"
            style={styles.input}
          />
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Supplier</span>
          <select value={filters.supplierId} onChange={(event) => updateFilter('supplierId', event.target.value)} style={styles.select}>
            <option value="">All suppliers</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.supplier_name}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Month</span>
          <input type="month" value={filters.month} onChange={(event) => updateFilter('month', event.target.value)} style={styles.input} />
        </label>

        <button type="button" onClick={resetFilters} style={styles.resetButton}>
          Reset
        </button>
      </div>

      {error ? (
        <div style={styles.emptyBox}>
          <p style={styles.errorText}>Error: {error}</p>
        </div>
      ) : orders.length === 0 ? (
        <div style={styles.emptyBox}>
          <p style={styles.emptyText}>{loading ? 'Loading receiving records...' : 'No receiving records match the selected filters.'}</p>
        </div>
      ) : (
        <>
          <div style={{ ...styles.tableWrap, opacity: loading ? 0.58 : 1 }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.headRow}>
                  <th style={th}>GRN Number</th>
                  <th style={th}>Inbound Date</th>
                  <th style={th}>Supplier</th>
                  <th style={th}>Item Name</th>
                  <th style={th}>SJ Qty</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                    <tr key={order.id} style={styles.bodyRow}>
                      <td style={td}>
                        <strong>{order.grn_number}</strong>
                      </td>
                      <td style={td}>{formatDateDisplay(order.inbound_date)}</td>
                      <td style={td}>{order.suppliers?.supplier_name || '-'}</td>
                      <td style={td}>{order.item_name || '-'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{order.total_claimed_qty || 0}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <div style={styles.actionGroup}>
                          <Link
                            href={`/dashboard/inbound/${order.id}/edit`}
                            style={styles.iconButton}
                            aria-label={`Receiving ${order.grn_number}`}
                            title="Receiving"
                          >
                            <ActionIcon kind="receiving" />
                          </Link>
                        <Link
                          href={`/dashboard/inbound/unload?grn=${encodeURIComponent(order.grn_number || '')}`}
                          style={styles.iconButton}
                          aria-label={`Sorting ${order.grn_number}`}
                          title="Sorting"
                        >
                          <ActionIcon kind="unload" />
                        </Link>
                        <Link
                          href={`/dashboard/inbound?grn=${encodeURIComponent(order.grn_number || '')}`}
                          style={styles.iconButton}
                          aria-label={`Summary ${order.grn_number}`}
                          title="Summary"
                        >
                          <ActionIcon kind="dashboard" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.pagination}>
            {hasPreviousPage ? (
              <button type="button" onClick={() => goToPage(safePage - 1)} style={styles.pageButton}>
                Previous
              </button>
            ) : (
              <span style={styles.pageButtonDisabled}>Previous</span>
            )}

            {hasNextPage ? (
              <button type="button" onClick={() => goToPage(safePage + 1)} style={styles.pageButton}>
                Next
              </button>
            ) : (
              <span style={styles.pageButtonDisabled}>Next</span>
            )}

            <span style={styles.pageMeta}>
              Page {safePage} of {totalPages}
            </span>
          </div>
        </>
      )}
    </>
  )
}

const th = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: '800',
  color: '#475569',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const td = {
  padding: '12px 16px',
  fontSize: '14px',
  color: '#111827',
  verticalAlign: 'middle',
}

const textButtonBase = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  padding: 0,
  fontSize: '13px',
  fontWeight: '800',
  lineHeight: 1.4,
}

const styles = {
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
    alignItems: 'end',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '750',
    color: '#334155',
  },
  input: {
    height: '40px',
    padding: '0 11px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    width: '100%',
    background: '#fff',
    color: '#111827',
  },
  select: {
    height: '40px',
    padding: '0 11px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    width: '100%',
    background: '#fff',
    color: '#111827',
  },
  resetButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '40px',
    padding: '0 14px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    background: '#fff',
    color: '#334155',
    cursor: 'pointer',
    fontWeight: '800',
    fontSize: '13px',
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
    transition: 'opacity 160ms ease',
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
    ...textButtonBase,
    color: '#0f172a',
    cursor: 'pointer',
  },
  pageButtonDisabled: {
    ...textButtonBase,
    color: '#94a3b8',
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
