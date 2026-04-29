import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

function getModelLabel(item) {
  return item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name
}

function formatDateDisplay(value) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function getStatusLabel(value) {
  return String(value || 'waiting').replaceAll('_', ' ').toUpperCase()
}

export default async function QcReturContinuePage({ searchParams }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
  const inboundId = Number(params?.inbound_id || 0)

  if (!inboundId) {
    return <p style={styles.emptyText}>Choose a return row first from Retur Report.</p>
  }

  const [{ data: inboundRow, error: inboundError }, { data: rows, error: rowsError }] = await Promise.all([
    supabase
      .from('inbound')
      .select(`
        id,
        grn_number,
        inbound_date,
        suppliers:dir_suppliers!supplier_id (
          supplier_name
        )
      `)
      .eq('id', inboundId)
      .single(),
    supabase
      .from('warehouse_returns')
      .select(`
        *,
        brands:dir_brands!brand_id (
          brand_name
        ),
        categories:dir_categories!category_id (
          category_name,
          full_name
        )
      `)
      .eq('inbound_id', inboundId)
      .order('koli_sequence', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  if (inboundError || rowsError) {
    return <p style={styles.errorText}>Error: {inboundError?.message || rowsError?.message}</p>
  }

  const totalQty = (rows || []).reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const totalKoli = new Set((rows || []).map((row) => row.koli_sequence).filter(Boolean)).size
  const waitingQty = (rows || []).reduce((sum, row) => {
    if (String(row.status || 'waiting').toLowerCase() === 'waiting') {
      return sum + Number(row.qty || 0)
    }

    return sum
  }, 0)
  const groupedByKoli = (rows || []).reduce((accumulator, row) => {
    const key = row.koli_sequence || `no-koli-${row.id}`

    if (!accumulator[key]) {
      accumulator[key] = {
        key,
        label: row.koli_sequence ? `Koli ${row.koli_sequence}` : 'Tanpa Koli',
        rows: [],
        totalQty: 0,
      }
    }

    accumulator[key].rows.push(row)
    accumulator[key].totalQty += Number(row.qty || 0)
    return accumulator
  }, {})
  const koliGroups = Object.values(groupedByKoli)
  const handlePrint = `
    (() => {
      const title = ${JSON.stringify(`Draft Surat Jalan Retur - ${inboundRow?.grn_number || '-'}`)};
      const source = document.getElementById('retur-delivery-note-print');
      if (!source) return;
      const win = window.open('', '_blank', 'width=960,height=720');
      if (!win) return;
      win.document.write(\`
        <html>
          <head>
            <title>\${title}</title>
            <style>
              @page { size: A4; margin: 14mm; }
              body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
              h1 { margin: 0 0 8px; font-size: 24px; }
              h2 { margin: 0 0 10px; font-size: 16px; }
              .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0 20px; }
              .meta-card { border: 1px solid #d1d5db; border-radius: 10px; padding: 10px 12px; }
              .meta-label { display: block; color: #6b7280; font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; }
              .meta-value { font-size: 18px; font-weight: 800; }
              .group { margin-top: 18px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
              .group-head { background: #f9fafb; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
              .group-title { font-size: 16px; font-weight: 800; }
              .group-total { font-size: 13px; color: #6b7280; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border-top: 1px solid #e5e7eb; padding: 10px 14px; text-align: left; vertical-align: middle; font-size: 13px; }
              th { background: #fff; color: #374151; font-size: 12px; text-transform: uppercase; }
            </style>
          </head>
          <body>
            \${source.innerHTML}
          </body>
        </html>
      \`);
      win.document.close();
      win.focus();
      win.print();
    })();
  `

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Continue Return</h1>
            <p style={styles.subtitle}>Lanjutan retur untuk menyiapkan draft surat jalan per GRN.</p>
          </div>

          <button type="button" style={styles.primaryButton} onClick={handlePrint}>
            Print Draft
          </button>
        </div>

        <div style={styles.metaGrid}>
          <div style={styles.metaCard}>
            <span style={styles.metaLabel}>GRN</span>
            <strong style={styles.metaValue}>{inboundRow?.grn_number || '-'}</strong>
          </div>
          <div style={styles.metaCard}>
            <span style={styles.metaLabel}>Supplier</span>
            <strong style={styles.metaValue}>{inboundRow?.suppliers?.supplier_name || '-'}</strong>
          </div>
          <div style={styles.metaCard}>
            <span style={styles.metaLabel}>Inbound Date</span>
            <strong style={styles.metaValue}>{formatDateDisplay(inboundRow?.inbound_date)}</strong>
          </div>
          <div style={styles.metaCard}>
            <span style={styles.metaLabel}>Total Return Qty</span>
            <strong style={styles.metaValue}>{totalQty}</strong>
          </div>
          <div style={styles.metaCard}>
            <span style={styles.metaLabel}>Waiting Qty</span>
            <strong style={styles.metaValue}>{waitingQty}</strong>
          </div>
          <div style={styles.metaCard}>
            <span style={styles.metaLabel}>Total Koli</span>
            <strong style={styles.metaValue}>{totalKoli}</strong>
          </div>
        </div>

        <p style={styles.note}>Data di bawah sudah siap dipakai sebagai draft surat jalan retur. Nanti tahap berikutnya tinggal sambungkan ke nomor surat jalan final dan proses print operasional.</p>
      </div>

      <div id="retur-delivery-note-print">
        <div style={styles.printOnlyHeader}>
          <h1 style={styles.printTitle}>Draft Surat Jalan Retur</h1>
          <h2 style={styles.printSubtitle}>{inboundRow?.grn_number || '-'}</h2>
        </div>

        <div style={styles.metaGrid}>
          <div style={styles.metaCard}>
            <span style={styles.metaLabel}>GRN</span>
            <strong style={styles.metaValue}>{inboundRow?.grn_number || '-'}</strong>
          </div>
          <div style={styles.metaCard}>
            <span style={styles.metaLabel}>Supplier</span>
            <strong style={styles.metaValue}>{inboundRow?.suppliers?.supplier_name || '-'}</strong>
          </div>
          <div style={styles.metaCard}>
            <span style={styles.metaLabel}>Waiting Qty</span>
            <strong style={styles.metaValue}>{waitingQty}</strong>
          </div>
          <div style={styles.metaCard}>
            <span style={styles.metaLabel}>Total Koli</span>
            <strong style={styles.metaValue}>{totalKoli}</strong>
          </div>
        </div>

        <div style={styles.groupList}>
          {koliGroups.map((group) => (
            <section key={group.key} style={styles.groupCard}>
              <div style={styles.groupHeader}>
                <strong style={styles.groupTitle}>{group.label}</strong>
                <span style={styles.groupTotal}>Total Qty: {group.totalQty}</span>
              </div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.headRow}>
                      <th style={styles.th}>Phase</th>
                      <th style={styles.th}>Brand</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Product</th>
                      <th style={styles.th}>Grade</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.id} style={styles.bodyRow}>
                        <td style={styles.td}>{String(row.source_phase || '-').toUpperCase()}</td>
                        <td style={styles.td}>{row.brands?.brand_name || '-'}</td>
                        <td style={styles.td}>{row.categories?.full_name || row.categories?.category_name || '-'}</td>
                        <td style={styles.td}>{getModelLabel(row)}</td>
                        <td style={styles.td}>{row.grade || '-'}</td>
                        <td style={styles.td}>{getStatusLabel(row.status)}</td>
                        <td style={styles.td}>{row.qty || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
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
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
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
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer',
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
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '16px',
  },
  metaCard: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  metaLabel: {
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  metaValue: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#111827',
  },
  note: {
    margin: 0,
    padding: '14px 16px',
    borderRadius: '12px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  printOnlyHeader: {
    display: 'none',
  },
  printTitle: {
    margin: 0,
    fontSize: '24px',
  },
  printSubtitle: {
    margin: '4px 0 0',
    color: '#4b5563',
    fontSize: '16px',
  },
  groupList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  groupCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  groupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    background: '#f9fafb',
  },
  groupTitle: {
    fontSize: '16px',
    color: '#111827',
  },
  groupTotal: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#6b7280',
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
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#111827',
    verticalAlign: 'top',
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
