import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function InboundDashboardPage({ searchParams }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
  const selectedGrn = params?.grn || ''
  const selectedPhoto = params?.photo || ''
  const selectedPhotoTitle = params?.photoTitle || ''

  const [{ data: inboundRows, error: inboundError }, { data: unloadRows, error: unloadError }] = await Promise.all([
    supabase.from('inbound').select('id, grn_number, item_name').order('created_at', { ascending: false }),
    supabase.from('inbound_unload').select('id, inbound_id, model_name, model_color, qty, is_sample, photo_url').order('created_at', { ascending: false }),
  ])

  const selectedInbound = (inboundRows || []).find((item) => item.grn_number === selectedGrn) || null
  const summaryMap = new Map()

  ;(unloadRows || [])
    .filter((row) => Number(row.inbound_id) === Number(selectedInbound?.id))
    .forEach((row) => {
      const label = row.model_color ? `${row.model_name} / ${row.model_color}` : row.model_name

      if (!summaryMap.has(label)) {
        summaryMap.set(label, {
          modelLabel: label,
          modelQty: 0,
          photoUrl: row.photo_url || '',
        })
      }

      const current = summaryMap.get(label)
      current.modelQty += Number(row.qty || 0)

      if (!current.photoUrl && row.photo_url) {
        current.photoUrl = row.photo_url
      }
    })

  const summaryRows = [...summaryMap.values()].sort((a, b) => a.modelLabel.localeCompare(b.modelLabel))
  const totalQty = summaryRows.reduce((sum, row) => sum + Number(row.modelQty || 0), 0)

  return (
    <div style={styles.wrapper}>
      <div>
        <h1 style={styles.title}>Inbound Dashboard</h1>
        <p style={styles.subtitle}>Choose a GRN Number first to see model summary from inbound unload.</p>
      </div>

      <form method="get" style={styles.card}>
        <div style={styles.field}>
          <label style={styles.label}>GRN Number</label>
          <input
            name="grn"
            list="inbound-dashboard-grn-options"
            defaultValue={selectedGrn}
            style={styles.input}
            placeholder="Type or choose GRN Number"
          />
          <datalist id="inbound-dashboard-grn-options">
            {(inboundRows || []).map((item) => (
              <option key={item.id} value={item.grn_number} />
            ))}
          </datalist>
        </div>

        <div style={styles.buttonRow}>
          <button type="submit" style={styles.primaryButton}>
            Show Summary
          </button>
        </div>

        {inboundError || unloadError ? (
          <p style={styles.errorText}>Error: {inboundError?.message || unloadError?.message}</p>
        ) : null}
      </form>

      {!selectedGrn ? (
        <div style={styles.card}>
          <p style={styles.emptyText}>Choose a GRN Number first.</p>
        </div>
      ) : !selectedInbound ? (
        <div style={styles.card}>
          <p style={styles.emptyText}>GRN Number not found.</p>
        </div>
      ) : (
        <div style={styles.card}>
          <div style={styles.header}>
            <div>
              <h2 style={styles.sectionTitle}>Model Summary</h2>
              <p style={styles.sectionSubtitle}>
                Summary for <strong>{selectedInbound.grn_number}</strong>
                {selectedInbound.item_name ? ` - ${selectedInbound.item_name}` : ''}
              </p>
            </div>
            <div style={styles.totalBox}>
              <span style={styles.totalLabel}>Total Qty</span>
              <strong style={styles.totalValue}>{totalQty}</strong>
            </div>
          </div>

          {summaryRows.length === 0 ? (
            <p style={styles.emptyText}>No model summary yet for this GRN.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Photo</th>
                    <th style={styles.th}>Model</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row) => (
                    <tr key={row.modelLabel}>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        {row.photoUrl ? (
                          <Link
                            href={`/dashboard/inbound?grn=${encodeURIComponent(selectedGrn)}&photo=${encodeURIComponent(row.photoUrl)}&photoTitle=${encodeURIComponent(row.modelLabel)}`}
                            style={styles.thumbLink}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={row.photoUrl} alt={row.modelLabel} style={styles.thumb} />
                          </Link>
                        ) : (
                          <div style={styles.thumbEmpty}>NO PHOTO</div>
                        )}
                      </td>
                      <td style={styles.td}>{row.modelLabel}</td>
                      <td style={{ ...styles.td, textAlign: 'center', fontWeight: '700' }}>{row.modelQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedPhoto ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.header}>
              <div>
                <h2 style={styles.sectionTitle}>Photo Preview</h2>
                <p style={styles.sectionSubtitle}>{selectedPhotoTitle || 'Model Photo'}</p>
              </div>
              <Link href={`/dashboard/inbound?grn=${encodeURIComponent(selectedGrn)}`} style={styles.closeButton}>
                Close
              </Link>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedPhoto} alt={selectedPhotoTitle || 'Model Photo'} style={styles.previewImage} />
          </div>
        </div>
      ) : null}
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '20px',
  },
  sectionSubtitle: {
    margin: '4px 0 0',
    color: '#6b7280',
  },
  totalBox: {
    minWidth: '140px',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  totalValue: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#111827',
  },
  tableWrap: {
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    background: '#f9fafb',
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#111827',
    borderTop: '1px solid #f1f5f9',
    verticalAlign: 'middle',
  },
  thumb: {
    width: '56px',
    height: '56px',
    objectFit: 'cover',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
  thumbLink: {
    display: 'inline-flex',
  },
  thumbEmpty: {
    width: '56px',
    height: '56px',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
    fontSize: '10px',
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
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 50,
  },
  modal: {
    width: '100%',
    maxWidth: '720px',
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
  },
  closeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '38px',
    padding: '0 14px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    maxHeight: '70vh',
    objectFit: 'contain',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
}
