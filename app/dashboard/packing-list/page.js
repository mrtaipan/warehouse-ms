import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { loadAccessContext } from '@/utils/access-control'

function formatDateDisplay(value) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function ReceivingIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3h6l4 4v8a2 2 0 0 1-2 2h-2" />
      <path d="M15 3v5h4" />
      <path d="M8 8h4" />
      <path d="M8 12h6" />
      <path d="M3 16h4l2 2h4a2 2 0 0 0 2-2" />
      <path d="M3 20h8l6-3a2 2 0 0 0-2-3l-4 2" />
    </svg>
  )
}

function BreakdownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 15 15 4l5 5L9 20H4v-5z" />
      <path d="m14 5 5 5" />
      <path d="m11 8 2 2" />
      <path d="m8 11 2 2" />
      <path d="m5 14 2 2" />
    </svg>
  )
}

function buildOverviewRows(confirmRows = [], validationRows = []) {
  const validationMap = new Map()

  validationRows.forEach((row) => {
    const key = `${row.inbound_id}::${Number(row.source_koli_sequence || 0)}`
    validationMap.set(key, true)
  })

  const grouped = new Map()

  confirmRows.forEach((row) => {
    const inboundId = row.inbound_id || row.inbound?.id || 0
    const grnNumber = row.inbound?.grn_number || '-'
    const current = grouped.get(inboundId) || {
      inbound_id: inboundId,
      grn_number: grnNumber,
      inbound_date: row.inbound?.inbound_date || null,
      koliSet: new Set(),
      validatedSet: new Set(),
      item_name: row.inbound?.item_name || '-',
      qc_confirm_qty: 0,
      pending_qty: 0,
    }
    const koliSequence = Number(row.koli_sequence || 0)
    const validationKey = `${inboundId}::${koliSequence}`
    const isValidated = validationMap.has(validationKey)

    current.koliSet.add(koliSequence)
    if (isValidated) {
      current.validatedSet.add(koliSequence)
    } else {
      current.pending_qty += Number(row.qty || 0)
    }
    current.item_name = current.item_name === '-' ? row.inbound?.item_name || '-' : current.item_name
    current.qc_confirm_qty += Number(row.qty || 0)
    current.inbound_date = current.inbound_date || row.inbound?.inbound_date || null
    grouped.set(inboundId, current)
  })

  return Array.from(grouped.values())
    .map((row) => ({
      inbound_id: row.inbound_id,
      grn_number: row.grn_number,
      inbound_date: row.inbound_date,
      total_koli: row.koliSet.size,
      validated_koli: row.validatedSet.size,
      pending_koli: Math.max(0, row.koliSet.size - row.validatedSet.size),
      qc_confirm_qty: row.qc_confirm_qty,
      pending_qty: row.pending_qty,
      item_name: row.item_name || '-',
    }))
    .sort((a, b) => new Date(b.inbound_date || 0).getTime() - new Date(a.inbound_date || 0).getTime())
}

export default async function PackingListOverviewPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { role, isAdmin } = await loadAccessContext(supabase, user, 'role')
  const isPackingStaff = !isAdmin && role === 'packing_staff'

  const [
    { data: confirmRows, error: confirmError },
    { data: validationRows, error: validationError },
  ] = await Promise.all([
    supabase
      .from('qc_confirm')
      .select(`
        id,
        inbound_id,
        qty,
        koli_sequence,
        inbound:inbound_id (
          id,
          grn_number,
          inbound_date,
          item_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('pl_receiving')
      .select('id, inbound_id, source_koli_sequence, validated_at')
      .order('validated_at', { ascending: false })
      .limit(500),
  ])

  const allRows = buildOverviewRows(confirmRows || [], validationRows || [])
  const rows = allRows.slice(0, 25)
  const totalPending = allRows.reduce((sum, row) => sum + row.pending_koli, 0)
  const totalPendingQty = allRows.reduce((sum, row) => sum + row.pending_qty, 0)

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div style={styles.headerText}>
          <p style={styles.eyebrow}>Packing List</p>
          <h1 style={styles.title}>Overview</h1>
          <p style={styles.subtitle}>Monitor QC Confirm data before Packing List size breakdown and storage handoff.</p>
        </div>

        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>GRN Ready</span>
            <strong style={styles.summaryValue}>{allRows.length}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Pending Koli</span>
            <strong style={styles.summaryValue}>{totalPending}</strong>
          </div>
          <div
            style={styles.summaryCard}
            title="Not yet received by Packing List"
            aria-label="Total Pending Qty. Not yet received by Packing List"
          >
            <span style={styles.summaryLabel}>Total Pending Qty</span>
            <strong style={styles.summaryValue}>{totalPendingQty}</strong>
          </div>
        </div>
      </div>

      {confirmError || validationError ? (
        <div style={styles.emptyBox}>
          <p style={styles.errorText}>Error: {confirmError?.message || validationError?.message}</p>
        </div>
      ) : (
        <>
          {rows.length ? (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.headRow}>
                    <th style={styles.th}>GRN Number</th>
                    <th style={styles.th}>Inbound Date</th>
                    <th style={styles.numberTh}>QC Confirm Qty</th>
                    <th style={styles.numberTh}>Pending Koli</th>
                    <th style={styles.th}>Item Name</th>
                    <th style={styles.actionTh}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.inbound_id} style={styles.bodyRow}>
                      <td style={styles.td}>
                        <strong>{row.grn_number}</strong>
                      </td>
                      <td style={styles.td}>{formatDateDisplay(row.inbound_date)}</td>
                      <td style={styles.numberTd}>{row.qc_confirm_qty}</td>
                      <td style={{ ...styles.numberTd, color: row.pending_koli ? '#dc2626' : '#15803d', fontWeight: 800 }}>
                        {row.pending_koli}
                      </td>
                      <td style={styles.itemTd}>{row.item_name}</td>
                      <td style={styles.actionTd}>
                        <div style={styles.rowActions}>
                          <Link
                            href={
                              isPackingStaff
                                ? `/dashboard/packing-list/receiving/input?grn=${encodeURIComponent(row.grn_number)}`
                                : `/dashboard/packing-list/receiving?grn=${encodeURIComponent(row.grn_number)}`
                            }
                            style={styles.iconButton}
                            title="PL Receiving"
                            aria-label={`PL Receiving ${row.grn_number}`}
                          >
                            <ReceivingIcon />
                          </Link>
                          <Link
                            href={
                              isPackingStaff
                                ? `/mobile/packing-list/item-storing?grn=${encodeURIComponent(row.grn_number)}`
                                : `/dashboard/packing-list/size-breakdown?grn=${encodeURIComponent(row.grn_number)}`
                            }
                            style={styles.iconButton}
                            title="PL Breakdown"
                            aria-label={`PL Breakdown ${row.grn_number}`}
                          >
                            <BreakdownIcon />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={styles.emptyBox}>
              <p style={styles.emptyText}>No QC Confirm data is ready for Packing List yet.</p>
            </div>
          )}
        </>
      )}
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
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  headerText: {
    flex: '1 1 280px',
    minWidth: 0,
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
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#475569',
    fontSize: '13px',
    lineHeight: 1.45,
    maxWidth: '640px',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
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
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '40px',
    padding: '0 16px',
    background: '#fff',
    color: '#111827',
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: '800',
    whiteSpace: 'nowrap',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))',
    gap: '12px',
    flex: '1 1 520px',
    maxWidth: '720px',
  },
  summaryCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  summaryLabel: {
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#64748b',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: 900,
    color: '#0f172a',
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
  th: {
    padding: '12px 14px',
    textAlign: 'left',
    verticalAlign: 'middle',
    fontSize: '12px',
    fontWeight: 800,
    color: '#475569',
    whiteSpace: 'nowrap',
  },
  numberTh: {
    padding: '12px 14px',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: '12px',
    fontWeight: 800,
    color: '#475569',
    whiteSpace: 'nowrap',
  },
  actionTh: {
    padding: '12px 14px',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: '12px',
    fontWeight: 800,
    color: '#475569',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 14px',
    verticalAlign: 'middle',
    fontSize: '13px',
    color: '#0f172a',
    whiteSpace: 'nowrap',
  },
  numberTd: {
    padding: '12px 14px',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: '13px',
    color: '#0f172a',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  itemTd: {
    padding: '12px 14px',
    verticalAlign: 'middle',
    fontSize: '13px',
    color: '#0f172a',
    minWidth: '220px',
    maxWidth: '360px',
    whiteSpace: 'normal',
    lineHeight: 1.45,
  },
  actionTd: {
    padding: '12px 14px',
    textAlign: 'center',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  },
  rowActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#fff',
    color: '#111827',
    border: '1px solid #d1d5db',
    textDecoration: 'none',
    fontSize: '12px',
    fontWeight: 900,
  },
  emptyBox: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '18px',
    padding: '18px',
  },
  emptyText: {
    margin: 0,
    color: '#64748b',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
    fontWeight: 700,
  },
}
