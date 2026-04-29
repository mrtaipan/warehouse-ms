import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ReceivingOrdersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: orders, error } = await supabase
    .from('inbound')
    .select('*, suppliers:dir_suppliers!supplier_id (supplier_name)')
    .order('created_at', { ascending: false })

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>GRN</h1>
          <p style={styles.subtitle}>Goods received notes are now created from the Inbound form.</p>
        </div>

        <Link href="/dashboard/inbound/new" style={styles.primaryButton}>
          + New Inbound
        </Link>
      </div>

      {error ? (
        <div style={styles.emptyState}>
          <p style={styles.errorText}>Error: {error.message}</p>
        </div>
      ) : (
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.headRow}>
                <th style={th}>GRN Number</th>
                <th style={th}>Supplier</th>
                <th style={th}>Status</th>
                <th style={th}>Claimed Qty</th>
                <th style={th}>Received Qty</th>
                <th style={th}>Date</th>
                <th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders?.length === 0 ? (
                <tr>
                  <td colSpan={7} style={styles.emptyCell}>
                    No GRN records yet. Create your first one!
                  </td>
                </tr>
              ) : (
                orders?.map((order) => (
                  <tr key={order.id} style={styles.bodyRow}>
                    <td style={td}>
                      <strong>{order.grn_number}</strong>
                    </td>
                    <td style={td}>{order.suppliers?.supplier_name || '-'}</td>
                    <td style={td}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          ...getStatusStyles(order.status),
                        }}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td style={td}>{order.total_claimed_qty}</td>
                    <td style={td}>{order.total_received_qty}</td>
                    <td style={td}>
                      {order.created_at
                        ? new Date(order.created_at).toLocaleDateString('id-ID')
                        : '-'}
                    </td>
                    <td style={td}>
                      <Link
                        href={`/dashboard/inbound/${order.id}`}
                        style={styles.viewLink}
                      >
                        Open Inbound
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function getStatusStyles(status) {
  if (status === 'done') {
    return {
      background: '#dcfce7',
      color: '#16a34a',
    }
  }

  if (status === 'draft') {
    return {
      background: '#f3f4f6',
      color: '#374151',
    }
  }

  return {
    background: '#fef9c3',
    color: '#854d0e',
  }
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
  tableCard: {
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
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  viewLink: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: '500',
  },
  emptyState: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
  },
  emptyCell: {
    padding: '24px',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '14px',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
  },
}
