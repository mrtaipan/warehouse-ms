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

function getDifference(item) {
  const supplierQty = Number(item.claimed_qty || 0)
  const sampleQty = Number(item.sample_qty || 0)
  const bongkarQty = Number(item.actual_qty || 0)
  return (bongkarQty + sampleQty) - supplierQty
}

export default async function ReceivingDetailPage({ params }) {
  const resolvedParams = await params
  const inboundId = resolvedParams.id
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [
    { data: order, error: orderError },
    { data: inboundItems, error: inboundError },
  ] = await Promise.all([
    supabase
      .from('inbound')
      .select('*, suppliers:dir_suppliers!supplier_id (supplier_name)')
      .eq('id', inboundId)
      .single(),
    supabase
      .from('inbound_receiving')
      .select('*')
      .eq('inbound_id', inboundId)
      .order('koli_sequence', { ascending: true }),
  ])

  if (orderError || !order) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <h1 style={styles.title}>Receiving Detail</h1>
          <p style={styles.errorText}>Error: {orderError?.message || 'Receiving data not found.'}</p>
          <Link href="/dashboard/inbound" style={styles.link}>
            Back to Receiving
          </Link>
        </div>
      </div>
    )
  }

  const totalQtySupplier = (inboundItems || []).reduce((sum, item) => sum + Number(item.claimed_qty || 0), 0)
  const totalQtyBongkar = (inboundItems || []).reduce(
    (sum, item) => sum + Number(item.actual_qty || 0) + Number(item.sample_qty || 0),
    0
  )

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{order.grn_number}</h1>
          <p style={styles.subtitle}>
            {order.suppliers?.supplier_name || '-'} / {order.item_name || '-'}
          </p>
        </div>

        <div style={styles.headerActions}>
          <Link href={`/dashboard/inbound/${order.id}/edit`} style={styles.primaryLink}>
            Edit Receiving
          </Link>
          <Link href="/dashboard/inbound" style={styles.secondaryLink}>
            Back to Receiving
          </Link>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Inbound Date</span>
          <strong style={styles.summaryValue}>{formatDateDisplay(order.inbound_date)}</strong>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Qty Surat Jalan</span>
          <strong style={styles.summaryValue}>{order.total_claimed_qty || 0}</strong>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Qty Supplier</span>
          <strong style={styles.summaryValue}>{totalQtySupplier}</strong>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Qty Bongkar</span>
          <strong style={styles.summaryValue}>{totalQtyBongkar}</strong>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Receiving Breakdown</h2>
        <p style={styles.sectionSubtitle}>Per-koli receiving detail for this shipment.</p>

        {inboundError ? (
          <p style={styles.errorText}>Error: {inboundError.message}</p>
        ) : inboundItems?.length === 0 ? (
          <p style={styles.emptyText}>No receiving rows found.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.headRow}>
                  <th style={th}>No</th>
                  <th style={th}>No Koli Supplier</th>
                  <th style={th}>Qty Supplier</th>
                  <th style={th}>Qty Sample</th>
                  <th style={th}>Qty Bongkar</th>
                  <th style={th}>Selisih</th>
                  <th style={th}>PIC yang Membongkar</th>
                </tr>
              </thead>
              <tbody>
                {inboundItems.map((item, index) => {
                  const difference = getDifference(item)
                  const diffStyle =
                    difference < 0
                      ? { background: '#fee2e2', color: '#dc2626' }
                      : difference > 0
                        ? { background: '#dcfce7', color: '#166534' }
                        : { background: '#f3f4f6', color: '#374151' }

                  return (
                    <tr key={item.id} style={styles.bodyRow}>
                      <td style={td}>{item.koli_sequence || index + 1}</td>
                      <td style={td}>{item.supplier_colli_no || '-'}</td>
                      <td style={td}>{item.claimed_qty || 0}</td>
                      <td style={td}>{item.sample_qty || 0}</td>
                      <td style={td}>{item.actual_qty || 0}</td>
                      <td style={td}>
                        <span style={{ ...styles.diffBadge, ...diffStyle }}>
                          {difference > 0 ? `+${difference}` : difference}
                        </span>
                      </td>
                      <td style={td}>{item.unload_pic || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Notes</h2>
        <p style={styles.emptyText}>{order.notes || 'No notes.'}</p>
      </div>
    </div>
  )
}

const th = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '14px',
  fontWeight: '600',
  color: '#374151',
}

const td = {
  padding: '12px 16px',
  fontSize: '14px',
  color: '#111827',
  verticalAlign: 'top',
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
  },
  title: {
    marginTop: 0,
    marginBottom: '8px',
    fontSize: '28px',
  },
  subtitle: {
    marginTop: 0,
    marginBottom: 0,
    color: '#6b7280',
  },
  secondaryLink: {
    display: 'inline-flex',
    alignItems: 'center',
    height: '38px',
    padding: '0 14px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    color: '#111827',
    textDecoration: 'none',
    fontWeight: '600',
    background: '#fff',
  },
  primaryLink: {
    display: 'inline-flex',
    alignItems: 'center',
    height: '38px',
    padding: '0 14px',
    borderRadius: '8px',
    color: '#fff',
    textDecoration: 'none',
    fontWeight: '600',
    background: '#111827',
  },
  link: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: '600',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '16px',
  },
  summaryCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  summaryLabel: {
    fontSize: '13px',
    color: '#6b7280',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: '18px',
    color: '#111827',
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: '8px',
    fontSize: '20px',
  },
  sectionSubtitle: {
    marginTop: 0,
    marginBottom: '16px',
    color: '#6b7280',
    fontSize: '14px',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  headRow: {
    background: '#f9fafb',
  },
  bodyRow: {
    borderTop: '1px solid #f1f5f9',
  },
  diffBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: '700',
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
