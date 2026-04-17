import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function SuppliersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('id', { ascending: true })

  return (
    <div>
      <h1 style={styles.title}>Suppliers</h1>
      <p style={styles.subtitle}>List of supplier master data</p>

      <div style={{ marginBottom: '16px' }}>
        <Link href="/dashboard/suppliers/new" style={styles.addButton}>
          + Add Supplier
        </Link>
      </div>

      {error ? (
        <p style={styles.error}>Error: {error.message}</p>
      ) : suppliers?.length === 0 ? (
        <div style={styles.emptyBox}>
          <p style={{ margin: 0 }}>No suppliers yet.</p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Code</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Contact Person</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Active</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((item) => (
                <tr key={item.id}>
                  <td style={styles.td}>{item.supplier_code}</td>
                  <td style={styles.td}>{item.supplier_name}</td>
                  <td style={styles.td}>{item.contact_person || '-'}</td>
                  <td style={styles.td}>{item.phone || '-'}</td>
                  <td style={styles.td}>{item.is_active ? 'Yes' : 'No'}</td>
                  <td style={styles.td}>
                    <Link href={`/dashboard/suppliers/${item.id}`} style={styles.editButton}>
                    Edit
                    </Link>
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

const styles = {
  title: {
    marginTop: 0,
    marginBottom: '8px',
    fontSize: '28px',
  },
  subtitle: {
    marginTop: 0,
    marginBottom: '24px',
    color: '#6b7280',
  },
  error: {
    color: 'red',
  },
  emptyBox: {
    background: '#fff',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #e5e7eb',
  },
  tableWrap: {
    background: '#fff',
    borderRadius: '12px',
    overflowX: 'auto',
    border: '1px solid #e5e7eb',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '14px',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '14px',
  },
  td: {
    padding: '14px',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '14px',
  },
  addButton: {
    display: 'inline-block',
    padding: '10px 14px',
    background: '#111827',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
  },
  editButton: {
  display: 'inline-block',
  padding: '8px 12px',
  background: '#2563eb',
  color: '#fff',
  textDecoration: 'none',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: '600',
},
}
