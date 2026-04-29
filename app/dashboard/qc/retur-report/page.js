import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import ReturReportClient from './retur-report-client'

export default async function QcReturReportPage({ searchParams }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
  const selectedGrn = params?.grn || ''
  const selectedSupplier = params?.supplier || ''
  const selectedStatus = params?.status || ''

  const { data: rows, error } = await supabase
    .from('warehouse_returns')
    .select(`
      *,
      inbound:inbound_id (
        id,
        grn_number,
        inbound_date,
        payment_on_site,
        suppliers:dir_suppliers!supplier_id (
          supplier_name
        )
      ),
      brands:dir_brands!brand_id (
        brand_name
      ),
      categories:dir_categories!category_id (
        category_name,
        full_name
      )
    `)
    .order('created_at', { ascending: false })

  const grnOptions = Array.from(new Set((rows || []).map((row) => row.inbound?.grn_number).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  )
  const supplierOptions = Array.from(
    new Set((rows || []).map((row) => row.inbound?.suppliers?.supplier_name).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b))
  const statusOptions = Array.from(new Set((rows || []).map((row) => row.status || 'waiting').filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  )
  const filteredRows = (rows || []).filter((row) => {
    const matchesGrn = !selectedGrn || row.inbound?.grn_number === selectedGrn
    const matchesSupplier = !selectedSupplier || row.inbound?.suppliers?.supplier_name === selectedSupplier
    const matchesStatus = !selectedStatus || String(row.status || 'waiting') === selectedStatus
    return matchesGrn && matchesSupplier && matchesStatus
  })

  return (
    <div style={styles.wrapper}>
      <div>
        <h1 style={styles.title}>Retur Report</h1>
        <p style={styles.subtitle}>Daftar barang retur dari inbound, QC, dan phase berikutnya.</p>
      </div>

      <form method="get" style={styles.card}>
        <div style={styles.filterGrid}>
          <div style={styles.field}>
            <label style={styles.label}>GRN Number</label>
            <input
              name="grn"
              list="qc-retur-report-grn-options"
              defaultValue={selectedGrn}
              style={styles.input}
              placeholder="All GRN"
            />
            <datalist id="qc-retur-report-grn-options">
              {grnOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Supplier</label>
            <input
              name="supplier"
              list="qc-retur-report-supplier-options"
              defaultValue={selectedSupplier}
              style={styles.input}
              placeholder="All Supplier"
            />
            <datalist id="qc-retur-report-supplier-options">
              {supplierOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Status</label>
            <input
              name="status"
              list="qc-retur-report-status-options"
              defaultValue={selectedStatus}
              style={styles.input}
              placeholder="All Status"
            />
            <datalist id="qc-retur-report-status-options">
              {statusOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
        </div>

        <div style={styles.buttonRow}>
          <Link href="/dashboard/qc/retur-report" style={styles.secondaryButton}>
            Reset
          </Link>
          <button type="submit" style={styles.primaryButton}>
            Filter
          </button>
        </div>
      </form>

      {error ? (
        <div style={styles.card}>
          <p style={styles.errorText}>Error: {error.message}</p>
        </div>
      ) : !filteredRows.length ? (
        <div style={styles.card}>
          <p style={styles.emptyText}>
            {selectedGrn || selectedSupplier || selectedStatus ? 'No retur rows found for this filter.' : 'No retur rows yet.'}
          </p>
        </div>
      ) : (
        <ReturReportClient rows={filteredRows} />
      )}
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
  },
  subtitle: {
    color: '#6b7280',
    margin: '4px 0 0',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
  },
  input: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  secondaryButton: {
    padding: '10px 16px',
    background: '#fff',
    color: '#111827',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontWeight: '600',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  primaryButton: {
    padding: '10px 16px',
    background: '#111827',
    color: '#fff',
    borderRadius: '8px',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer',
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
