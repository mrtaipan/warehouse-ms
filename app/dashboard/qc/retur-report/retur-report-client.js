'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'

function formatDateDisplay(value) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function getModelLabel(item) {
  return item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name
}

function getStatusLabel(value) {
  return String(value || 'waiting').replaceAll('_', ' ').toUpperCase()
}

export default function ReturReportClient({ rows }) {
  const router = useRouter()
  const supabase = createClient()
  const [selectedIds, setSelectedIds] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSupplierConfirmOpen, setIsSupplierConfirmOpen] = useState(false)
  const [shippingMethod, setShippingMethod] = useState('')
  const [modalError, setModalError] = useState('')
  const [isPrinting, setIsPrinting] = useState(false)

  const selectableRows = useMemo(
    () => rows.filter((row) => String(row.status || 'waiting').toLowerCase() !== 'completed'),
    [rows]
  )

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.id)),
    [rows, selectedIds]
  )

  const allSelectableChecked = selectableRows.length > 0 && selectableRows.every((row) => selectedIds.includes(row.id))
  const totalSelectedQty = selectedRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const selectedInboundIds = Array.from(new Set(selectedRows.map((row) => row.inbound_id).filter(Boolean)))
  const selectedSuppliers = Array.from(
    new Set(selectedRows.map((row) => row.inbound?.suppliers?.supplier_name).filter(Boolean))
  )
  const selectedInbound = selectedRows[0]?.inbound || null
  const paymentLabel = selectedInbound?.payment_on_site ? 'Bayar di penerima' : 'Bayar di kita'

  function toggleRow(id) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  function toggleAll() {
    if (allSelectableChecked) {
      setSelectedIds([])
      return
    }

    setSelectedIds(selectableRows.map((row) => row.id))
  }

  function openReturModal() {
    if (!selectedRows.length) {
      setModalError('Pilih minimal satu row retur dulu.')
      setIsModalOpen(true)
      return
    }

    if (selectedInboundIds.length > 1) {
      setModalError('Surat jalan retur hanya bisa dibuat untuk satu GRN dalam satu kali print.')
      setIsModalOpen(true)
      return
    }

    if (selectedSuppliers.length > 1) {
      setIsSupplierConfirmOpen(true)
      return
    }

    setModalError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    if (isPrinting) return
    setIsModalOpen(false)
    setModalError('')
  }

  function closeSupplierConfirm() {
    if (isPrinting) return
    setIsSupplierConfirmOpen(false)
  }

  function confirmMultiSupplier() {
    setIsSupplierConfirmOpen(false)
    setModalError('')
    setIsModalOpen(true)
  }

  async function handlePrintSj() {
    if (!selectedRows.length || selectedInboundIds.length !== 1) {
      setModalError('Pilih row retur dari satu GRN yang sama dulu.')
      return
    }

    if (!shippingMethod.trim()) {
      setModalError('Isi pengiriman menggunakan apa dulu.')
      return
    }

    setIsPrinting(true)
    setModalError('')

    const printWindow = window.open('', '_blank', 'width=960,height=720')

    if (!printWindow) {
      setModalError('Popup print diblokir browser. Izinkan pop-up lalu coba lagi.')
      setIsPrinting(false)
      return
    }

    const supplierName = selectedInbound?.suppliers?.supplier_name || '-'
    const grnNumber = selectedInbound?.grn_number || '-'
    const detailRows = selectedRows
      .map(
        (row) => `
          <tr>
            <td>${row.brands?.brand_name || '-'}</td>
            <td>${getModelLabel(row)}</td>
            <td>${row.grade || '-'}</td>
            <td>${row.qty || 0}</td>
            <td>${row.koli_sequence ? `Koli ${row.koli_sequence}` : '-'}</td>
          </tr>
        `
      )
      .join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>Surat Jalan Retur - ${grnNumber}</title>
          <style>
            @page { size: A4; margin: 14mm; }
            body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            .subtitle { margin: 0 0 16px; color: #4b5563; }
            .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 18px; }
            .meta-card { border: 1px solid #d1d5db; border-radius: 10px; padding: 12px 14px; }
            .meta-label { display: block; color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
            .meta-value { font-size: 18px; font-weight: 800; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; vertical-align: middle; font-size: 13px; }
            th { background: #f9fafb; text-transform: uppercase; font-size: 12px; }
            .signature-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 42px; }
            .signature-box { text-align: center; font-size: 13px; color: #111827; }
            .signature-space { height: 72px; }
            .signature-line { border-top: 1px solid #111827; padding-top: 8px; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>Surat Jalan Retur</h1>
          <p class="subtitle">${grnNumber}</p>

          <div class="meta">
            <div class="meta-card">
              <span class="meta-label">Supplier</span>
              <span class="meta-value">${supplierName}</span>
            </div>
            <div class="meta-card">
              <span class="meta-label">Total Qty</span>
              <span class="meta-value">${totalSelectedQty}</span>
            </div>
            <div class="meta-card">
              <span class="meta-label">Pengiriman</span>
              <span class="meta-value">${shippingMethod.trim()}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Product</th>
                <th>Grade</th>
                <th>Qty</th>
                <th>Koli</th>
              </tr>
            </thead>
            <tbody>
              ${detailRows}
            </tbody>
          </table>

          <div class="signature-row">
            <div class="signature-box">
              <div class="signature-space"></div>
              <div class="signature-line">Dibuat Oleh</div>
            </div>
            <div class="signature-box">
              <div class="signature-space"></div>
              <div class="signature-line">Dikirim Oleh</div>
            </div>
            <div class="signature-box">
              <div class="signature-space"></div>
              <div class="signature-line">Diterima Oleh</div>
            </div>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()

    printWindow.onafterprint = async () => {
      const timestamp = new Date().toISOString()
      const { error } = await supabase
        .from('warehouse_returns')
        .update({
          status: 'completed',
          returns_delivery: shippingMethod.trim(),
          updated_at: timestamp,
        })
        .in('id', selectedIds)

      setIsPrinting(false)

      if (error) {
        setModalError(error.message)
        return
      }

      setIsModalOpen(false)
      setSelectedIds([])
      router.refresh()
    }

    printWindow.focus()
    printWindow.print()
  }

  return (
    <>
      <div style={styles.toolbar}>
        <label style={styles.selectAllRow}>
          <input type="checkbox" checked={allSelectableChecked} onChange={toggleAll} />
          <span>Select All</span>
        </label>

        <div style={styles.toolbarRight}>
          <span style={styles.selectionText}>
            {selectedRows.length ? `${selectedRows.length} row selected • Qty ${totalSelectedQty}` : 'No row selected'}
          </span>
          <button type="button" style={styles.primaryButton} onClick={openReturModal}>
            Retur
          </button>
        </div>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.headRow}>
              <th style={styles.checkboxTh}></th>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>GRN</th>
              <th style={styles.th}>Phase</th>
              <th style={styles.th}>Supplier</th>
              <th style={styles.th}>Brand</th>
              <th style={styles.th}>Category</th>
              <th style={styles.th}>Product</th>
              <th style={styles.th}>Grade</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Qty</th>
              <th style={styles.th}>Koli</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isCompleted = String(row.status || 'waiting').toLowerCase() === 'completed'
              const isChecked = selectedIds.includes(row.id)

              return (
                <tr key={row.id} style={styles.bodyRow}>
                  <td style={styles.checkboxTd}>
                    <input type="checkbox" checked={isChecked} disabled={isCompleted} onChange={() => toggleRow(row.id)} />
                  </td>
                  <td style={styles.td}>{formatDateDisplay(row.created_at || row.inbound?.inbound_date)}</td>
                  <td style={styles.td}>{row.inbound?.grn_number || '-'}</td>
                  <td style={styles.td}>{String(row.source_phase || '-').toUpperCase()}</td>
                  <td style={styles.td}>{row.inbound?.suppliers?.supplier_name || '-'}</td>
                  <td style={styles.td}>{row.brands?.brand_name || '-'}</td>
                  <td style={styles.td}>{row.categories?.full_name || row.categories?.category_name || '-'}</td>
                  <td style={styles.td}>{getModelLabel(row)}</td>
                  <td style={styles.td}>{row.grade || '-'}</td>
                  <td style={styles.td}>{getStatusLabel(row.status)}</td>
                  <td style={styles.td}>{row.qty || 0}</td>
                  <td style={styles.td}>{row.koli_sequence ? `Koli ${row.koli_sequence}` : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {isSupplierConfirmOpen ? (
        <div style={styles.overlay}>
          <div style={styles.confirmModal}>
            <h2 style={styles.modalTitle}>Supplier Berbeda</h2>
            <p style={styles.modalSubtitle}>
              Pilihan retur ini berisi lebih dari satu supplier. Lanjutkan membuat surat jalan retur gabungan?
            </p>
            <div style={styles.supplierList}>
              {selectedSuppliers.map((supplier) => (
                <span key={supplier} style={styles.supplierPill}>
                  {supplier}
                </span>
              ))}
            </div>
            <div style={styles.modalButtonRow}>
              <button type="button" style={styles.secondaryButton} onClick={closeSupplierConfirm}>
                Cancel
              </button>
              <button type="button" style={styles.primaryButton} onClick={confirmMultiSupplier}>
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isModalOpen ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Surat Jalan Retur</h2>
                <p style={styles.modalSubtitle}>Cek detail barang retur sebelum print surat jalan.</p>
              </div>

              <button type="button" style={styles.closeButton} onClick={closeModal}>
                ×
              </button>
            </div>

            {selectedRows.length && selectedInboundIds.length === 1 ? (
              <>
                <div style={styles.metaGrid}>
                  <div style={styles.metaCard}>
                    <span style={styles.metaLabel}>GRN</span>
                    <strong style={styles.metaValue}>{selectedInbound?.grn_number || '-'}</strong>
                  </div>
                  <div style={styles.metaCard}>
                    <span style={styles.metaLabel}>Supplier</span>
                    <strong style={styles.metaValue}>{selectedInbound?.suppliers?.supplier_name || '-'}</strong>
                  </div>
                  <div style={styles.metaCard}>
                    <span style={styles.metaLabel}>Total Qty</span>
                    <strong style={styles.metaValue}>{totalSelectedQty}</strong>
                  </div>
                  <div style={styles.metaCard}>
                    <span style={styles.metaLabel}>Pembayaran</span>
                    <strong style={styles.metaValue}>{paymentLabel}</strong>
                  </div>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Pengiriman Menggunakan</label>
                  <input
                    type="text"
                    value={shippingMethod}
                    onChange={(event) => setShippingMethod(event.target.value)}
                    style={styles.input}
                    placeholder="Contoh: JNE Trucking / Pickup Supplier / Kurir Internal"
                  />
                </div>

                <div style={styles.modalTableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.headRow}>
                        <th style={styles.th}>Brand</th>
                        <th style={styles.th}>Product</th>
                        <th style={styles.th}>Grade</th>
                        <th style={styles.th}>Qty</th>
                        <th style={styles.th}>Koli</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRows.map((row) => (
                        <tr key={row.id} style={styles.bodyRow}>
                          <td style={styles.td}>{row.brands?.brand_name || '-'}</td>
                          <td style={styles.td}>{getModelLabel(row)}</td>
                          <td style={styles.td}>{row.grade || '-'}</td>
                          <td style={styles.td}>{row.qty || 0}</td>
                          <td style={styles.td}>{row.koli_sequence ? `Koli ${row.koli_sequence}` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={styles.modalButtonRow}>
                  {modalError ? <span style={styles.inlineErrorText}>{modalError}</span> : null}
                  <div style={styles.modalActions}>
                    <button type="button" style={styles.secondaryButton} onClick={closeModal} disabled={isPrinting}>
                      Cancel
                    </button>
                    <button type="button" style={styles.primaryButton} onClick={handlePrintSj} disabled={isPrinting}>
                      {isPrinting ? 'Printing...' : 'Print SJ'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {modalError ? <p style={styles.errorText}>{modalError}</p> : null}
              <div style={styles.modalButtonRow}>
                <button type="button" style={styles.primaryButton} onClick={closeModal}>
                  OK
                </button>
              </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}

const styles = {
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  selectAllRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  selectionText: {
    fontSize: '14px',
    color: '#6b7280',
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
  secondaryButton: {
    padding: '10px 16px',
    background: '#fff',
    color: '#111827',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontWeight: '600',
    cursor: 'pointer',
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
  checkboxTh: {
    width: '44px',
    padding: '12px 8px 12px 16px',
  },
  checkboxTd: {
    padding: '12px 8px 12px 16px',
    verticalAlign: 'top',
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
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.55)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '24px',
    zIndex: 50,
  },
  modal: {
    width: 'min(960px, 100%)',
    maxHeight: '90vh',
    overflow: 'auto',
    background: '#fff',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  confirmModal: {
    width: 'min(520px, 100%)',
    background: '#fff',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
  },
  modalTitle: {
    margin: 0,
    fontSize: '24px',
  },
  modalSubtitle: {
    margin: '4px 0 0',
    color: '#6b7280',
  },
  closeButton: {
    border: 'none',
    background: '#f3f4f6',
    width: '36px',
    height: '36px',
    borderRadius: '999px',
    fontSize: '24px',
    lineHeight: 1,
    cursor: 'pointer',
    color: '#111827',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '16px',
  },
  supplierList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  supplierPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: '999px',
    background: '#f3f4f6',
    color: '#111827',
    fontSize: '13px',
    fontWeight: '600',
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
    fontSize: '18px',
    fontWeight: '800',
    color: '#111827',
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
    background: '#fff',
  },
  modalTableWrap: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  modalButtonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  inlineErrorText: {
    marginRight: 'auto',
    color: '#b91c1c',
    fontSize: '14px',
    fontWeight: '700',
  },
  errorText: {
    margin: 0,
    padding: '14px 16px',
    borderRadius: '12px',
    background: '#fef2f2',
    color: '#b91c1c',
    fontSize: '14px',
    fontWeight: '600',
  },
}
