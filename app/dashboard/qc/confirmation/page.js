import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import GradingVerificationFiltersClient from './grading-verification-filters-client'

function getSingleValue(value) {
  return Array.isArray(value) ? value[0] : value
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
  date.setUTCMonth(date.getUTCMonth() - 2)

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

function buildVerificationRows(inboundRows = [], qcRows = []) {
  const rowsByInbound = new Map()

  inboundRows.forEach((inbound) => {
    rowsByInbound.set(String(inbound.id), {
      inboundId: inbound.id,
      grnNumber: inbound.grn_number || '-',
      supplierName: inbound.suppliers?.supplier_name || '-',
      itemName: inbound.item_name || '-',
      passingSourceQty: 0,
      rejectionSourceQty: 0,
    })
  })

  qcRows.forEach((item) => {
    const row = rowsByInbound.get(String(item.inbound_id || ''))
    if (!row) return

    row.passingSourceQty += Number(item.qty_a || 0)
    row.rejectionSourceQty += Number(item.qty_b || 0) + Number(item.qty_c || 0)
  })

  return Array.from(rowsByInbound.values()).filter((row) => row.passingSourceQty > 0 || row.rejectionSourceQty > 0)
}

export default async function QcConfirmationPage({ searchParams }) {
  const supabase = await createClient()
  const params = await searchParams
  const search = sanitizeSearch(getSingleValue(params?.search))
  const supplierId = search ? '' : String(getSingleValue(params?.supplier) || '').trim()
  const month = search ? '' : String(getSingleValue(params?.month) || '').trim()
  const monthBounds = getMonthBounds(month)
  const defaultInboundStartDate = getDefaultInboundStartDate()

  const supplierQuery = supabase
    .from('dir_suppliers')
    .select('id, supplier_name')
    .eq('is_active', true)
    .order('supplier_name', { ascending: true })

  let inboundQuery = supabase
    .from('inbound')
    .select('id, grn_number, inbound_date, supplier_id, item_name, total_claimed_qty, suppliers:dir_suppliers!supplier_id (supplier_name)')
    .order('inbound_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(250)

  if (search) {
    inboundQuery = inboundQuery.or(`grn_number.ilike.%${search}%,item_name.ilike.%${search}%`)
  } else {
    if (supplierId) {
      inboundQuery = inboundQuery.eq('supplier_id', Number(supplierId))
    }

    if (monthBounds) {
      inboundQuery = inboundQuery.gte('inbound_date', monthBounds.start).lt('inbound_date', monthBounds.next)
    } else {
      inboundQuery = inboundQuery.gte('inbound_date', defaultInboundStartDate)
    }
  }

  const [
    { data: suppliers, error: supplierError },
    { data: inboundRows, error: inboundError },
  ] = await Promise.all([supplierQuery, inboundQuery])

  const inboundIds = (inboundRows || []).map((row) => row.id).filter(Boolean)
  let qcRows = []
  let qcError = null

  if (inboundIds.length) {
    const qcResult = await supabase
      .from('qc_items')
      .select('inbound_id, qty_a, qty_b, qty_c')
      .eq('status', 'done')
      .in('inbound_id', inboundIds)

    qcRows = qcResult.data || []
    qcError = qcResult.error
  }

  const error = supplierError?.message || inboundError?.message || qcError?.message || ''
  const rows = error ? [] : buildVerificationRows(inboundRows || [], qcRows)

  return (
    <section style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Quality Control</p>
          <h1 style={styles.title}>Grading Verification</h1>
          <p style={styles.subtitle}>Review completed GRNs and continue to Passing Grade or Rejection Grade verification.</p>
        </div>
      </div>

      <GradingVerificationFiltersClient
        suppliers={suppliers || []}
        initialFilters={{ search, supplierId, month }}
      />

      {error ? (
        <div style={styles.emptyBox}>
          <p style={styles.errorText}>Error: {error}</p>
        </div>
      ) : rows.length ? (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.headRow}>
                <th style={th}>GRN Number</th>
                <th style={th}>Supplier</th>
                <th style={th}>Item Name</th>
                <th style={{ ...th, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const grnParam = encodeURIComponent(row.grnNumber || '')
                return (
                  <tr key={row.inboundId} style={styles.bodyRow}>
                    <td style={td}>
                      <strong>{row.grnNumber}</strong>
                    </td>
                    <td style={td}>{row.supplierName}</td>
                    <td style={td}>{row.itemName}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <div style={styles.actionGroup}>
                        <Link
                          href={`/dashboard/qc/confirmation/next-process?grn=${grnParam}`}
                          style={{ ...styles.actionButton, ...styles.passingButton }}
                          aria-label={`Passing Grade ${row.grnNumber}`}
                          title="Passing Grade"
                        >
                          Passing Grade
                        </Link>
                        <Link
                          href={`/dashboard/qc/confirmation/rejection?grn=${grnParam}`}
                          style={{ ...styles.actionButton, ...styles.rejectionButton }}
                          aria-label={`Rejection Grade ${row.grnNumber}`}
                          title="Rejection Grade"
                        >
                          Rejection Grade
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={styles.emptyBox}>
          <p style={styles.emptyText}>No completed grading data matches the selected filters.</p>
        </div>
      )}
    </section>
  )
}

const th = {
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: '800',
  color: '#475569',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid #e2e8f0',
}

const td = {
  padding: '12px 14px',
  fontSize: '13px',
  color: '#111827',
  verticalAlign: 'middle',
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    padding: '18px',
    border: '1px solid #dbe4f0',
    borderRadius: '22px',
    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(245, 248, 252, 0.97) 100%)',
    boxShadow: '0 24px 54px rgba(15, 23, 42, 0.08)',
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
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    margin: '4px 0 0',
    color: '#0f172a',
    fontSize: '28px',
    fontWeight: '900',
    lineHeight: 1.05,
    letterSpacing: 0,
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  tableWrap: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    minWidth: '680px',
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
    justifyContent: 'center',
    gap: '10px',
    flexWrap: 'nowrap',
  },
  actionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '34px',
    minWidth: '112px',
    padding: '0 12px',
    height: '34px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '12px',
    fontWeight: '800',
    whiteSpace: 'nowrap',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
  },
  passingButton: {
    border: '1px solid #065f46',
    background: '#064e3b',
    color: '#ecfdf5',
  },
  rejectionButton: {
    border: '1px solid #991b1b',
    background: '#7f1d1d',
    color: '#fef2f2',
  },
  emptyBox: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '18px',
  },
  emptyText: {
    margin: 0,
    color: '#64748b',
    fontSize: '13px',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
    fontSize: '13px',
  },
}
