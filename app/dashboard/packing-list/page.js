import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

function formatDateDisplay(value) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
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
      qc_confirm_qty: 0,
    }
    const koliSequence = Number(row.koli_sequence || 0)
    const validationKey = `${inboundId}::${koliSequence}`

    current.koliSet.add(koliSequence)
    if (validationMap.has(validationKey)) {
      current.validatedSet.add(koliSequence)
    }
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
          inbound_date
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

  const rows = buildOverviewRows(confirmRows || [], validationRows || []).slice(0, 25)
  const totalKoli = rows.reduce((sum, row) => sum + row.total_koli, 0)
  const totalValidated = rows.reduce((sum, row) => sum + row.validated_koli, 0)
  const totalPending = rows.reduce((sum, row) => sum + row.pending_koli, 0)

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Packing List</p>
          <h1 style={styles.title}>Overview</h1>
          <p style={styles.subtitle}>Monitor QC Confirm data before Packing List size breakdown and storage handoff.</p>
        </div>

      </div>

      {confirmError || validationError ? (
        <div style={styles.emptyBox}>
          <p style={styles.errorText}>Error: {confirmError?.message || validationError?.message}</p>
        </div>
      ) : (
        <>
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>GRN Ready</span>
              <strong style={styles.summaryValue}>{rows.length}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Validated Koli</span>
              <strong style={styles.summaryValue}>{totalValidated}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Pending Koli</span>
              <strong style={styles.summaryValue}>{totalPending}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Total Koli</span>
              <strong style={styles.summaryValue}>{totalKoli}</strong>
            </div>
          </div>

          {rows.length ? (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.headRow}>
                    <th style={styles.th}>GRN Number</th>
                    <th style={styles.th}>Inbound Date</th>
                    <th style={styles.th}>QC Confirm Qty</th>
                    <th style={styles.th}>Validated</th>
                    <th style={styles.th}>Pending</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.inbound_id} style={styles.bodyRow}>
                      <td style={styles.td}>
                        <strong>{row.grn_number}</strong>
                      </td>
                      <td style={styles.td}>{formatDateDisplay(row.inbound_date)}</td>
                      <td style={styles.td}>{row.qc_confirm_qty}</td>
                      <td style={styles.td}>{row.validated_koli} / {row.total_koli}</td>
                      <td style={{ ...styles.td, color: row.pending_koli ? '#dc2626' : '#15803d', fontWeight: 800 }}>
                        {row.pending_koli}
                      </td>
                      <td style={styles.td}>
                        <div style={styles.rowActions}>
                          <Link href={`/dashboard/packing-list/receiving?grn=${encodeURIComponent(row.grn_number)}`} style={styles.iconButton} title="PL Receiving">
                            PL
                          </Link>
                          <Link href="/dashboard/packing-list/size-breakdown" style={styles.iconButton} title="Size Breakdown">
                            SB
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
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
    fontSize: '12px',
    fontWeight: 800,
    color: '#475569',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 14px',
    fontSize: '13px',
    color: '#0f172a',
    whiteSpace: 'nowrap',
  },
  rowActions: {
    display: 'flex',
    gap: '8px',
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
