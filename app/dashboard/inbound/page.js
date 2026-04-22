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

export default async function InboundPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: orders, error } = await supabase
    .from('inbound')
    .select('*, suppliers(supplier_name)')
    .in('status', ['draft', 'inbound'])
    .order('created_at', { ascending: false })

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Receiving</h1>
          <p style={styles.subtitle}>Create and continue receiving records from one place.</p>
        </div>

        <Link href="/dashboard/inbound/new" style={styles.primaryButton}>
          + New Receiving
        </Link>
      </div>

      {error ? (
        <div style={styles.card}>
          <p style={styles.errorText}>Error: {error.message}</p>
        </div>
      ) : orders?.length === 0 ? (
        <div style={styles.card}>
          <p style={styles.emptyText}>No receiving records yet. Create your first receiving entry.</p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.headRow}>
                <th style={th}>GRN Number</th>
                <th style={th}>Inbound Date</th>
                <th style={th}>Supplier</th>
                <th style={th}>Barang</th>
                <th style={th}>Pay on Site</th>
                <th style={th}>Qty Surat Jalan</th>
                <th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} style={styles.bodyRow}>
                  <td style={td}>
                    <strong>{order.grn_number}</strong>
                  </td>
                  <td style={td}>
                    {formatDateDisplay(order.inbound_date)}
                  </td>
                  <td style={td}>{order.suppliers?.supplier_name || '-'}</td>
                  <td style={td}>{order.item_name || '-'}</td>
                  <td style={td}>{order.payment_on_site ? 'Yes' : 'No'}</td>
                  <td style={td}>{order.total_claimed_qty || 0}</td>
                  <td style={td}>
                    <div style={styles.actionGroup}>
                      <Link
                        href={`/dashboard/inbound/${order.id}`}
                        style={styles.iconButton}
                        aria-label={`Preview ${order.grn_number}`}
                        title="Preview"
                      >
                        👁
                      </Link>
                      <Link
                        href={`/dashboard/inbound/${order.id}/edit`}
                        style={styles.iconButton}
                        aria-label={`Edit ${order.grn_number}`}
                        title="Edit"
                      >
                        ✎
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
    gap: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: '28px',
  },
  subtitle: {
    color: '#6b7280',
    margin: '4px 0 0',
  },
  primaryButton: {
    padding: '10px 16px',
    background: '#111827',
    color: '#fff',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: '600',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
  },
  tableWrap: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
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
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#111827',
    border: '1px solid #d1d5db',
    textDecoration: 'none',
    fontSize: '16px',
    fontWeight: '600',
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
