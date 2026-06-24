'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'
import styles from './retur-report.module.css'

function todayValue() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${String(value).slice(0, 10)}T00:00:00`))
}

function formatStatus(value) {
  return String(value || 'SENT').replaceAll('_', ' ')
}

export default function ArklineReturReportClient({ eligibleRows, batches, userEmail, canAdd = false, canEdit = false }) {
  const router = useRouter()
  const supabase = createClient()
  const [selectedIds, setSelectedIds] = useState([])
  const [activeReturnTab, setActiveReturnTab] = useState('arrangement')
  const [repairabilityFilter, setRepairabilityFilter] = useState('all')
  const [poFilter, setPoFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [receiptBatch, setReceiptBatch] = useState(null)
  const [returnDate, setReturnDate] = useState(todayValue())
  const [shippingMethod, setShippingMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [returnQtyById, setReturnQtyById] = useState({})
  const [receiptDate, setReceiptDate] = useState(todayValue())
  const [receiptNotes, setReceiptNotes] = useState('')
  const [receiptQtyById, setReceiptQtyById] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedRows = useMemo(
    () => eligibleRows.filter((row) => selectedIds.includes(row.id)),
    [eligibleRows, selectedIds]
  )
  const poOptions = useMemo(
    () => Array.from(new Set(eligibleRows.map((row) => row.poId).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [eligibleRows]
  )
  const productOptions = useMemo(() => {
    const source = poFilter ? eligibleRows.filter((row) => row.poId === poFilter) : eligibleRows
    return Array.from(new Set(source.map((row) => row.modelName).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [eligibleRows, poFilter])
  const filteredEligibleRows = useMemo(
    () =>
      eligibleRows
        .filter((row) => {
          const matchesRepairability =
            repairabilityFilter === 'all' ||
            (repairabilityFilter === 'repairable' ? row.isRepairable : !row.isRepairable)
          const matchesPo = !poFilter || row.poId === poFilter
          const matchesProduct = !productFilter || row.modelName === productFilter
          return matchesRepairability && matchesPo && matchesProduct
        })
        .sort((a, b) => {
          const reasonCompare = String(a.reasonName || '').localeCompare(String(b.reasonName || ''), undefined, { numeric: true })
          if (reasonCompare) return reasonCompare
          const poCompare = String(a.poId || '').localeCompare(String(b.poId || ''), undefined, { numeric: true })
          if (poCompare) return poCompare
          const productCompare = String(a.modelName || '').localeCompare(String(b.modelName || ''), undefined, { numeric: true })
          if (productCompare) return productCompare
          return String(a.size || '').localeCompare(String(b.size || ''), undefined, { numeric: true })
        }),
    [eligibleRows, poFilter, productFilter, repairabilityFilter]
  )
  const selectedSummary = useMemo(() => {
    const sizeMap = new Map()
    const total = selectedRows.reduce((sum, row) => {
      const qty = Number(returnQtyById[row.id] ?? row.availableQty ?? 0)
      const size = row.size || 'No size'
      sizeMap.set(size, Number(sizeMap.get(size) || 0) + qty)
      return sum + qty
    }, 0)
    const sizes = Array.from(sizeMap.entries())
      .map(([size, qty]) => ({ size, qty }))
      .sort((a, b) => String(a.size).localeCompare(String(b.size), undefined, { numeric: true }))

    return { total, sizes }
  }, [returnQtyById, selectedRows])
  const allFilteredSelected =
    filteredEligibleRows.length > 0 && filteredEligibleRows.every((row) => selectedIds.includes(row.id))
  const selectedQty = selectedRows.reduce(
    (sum, row) => sum + Number(returnQtyById[row.id] ?? row.availableQty ?? 0),
    0
  )

  function toggleRow(row) {
    setError('')
    setSelectedIds((current) => {
      if (current.includes(row.id)) {
        setReturnQtyById((qtyState) => {
          const next = { ...qtyState }
          delete next[row.id]
          return next
        })
        return current.filter((id) => id !== row.id)
      }

      setReturnQtyById((qtyState) => ({ ...qtyState, [row.id]: row.availableQty }))
      return [...current, row.id]
    })
  }

  function toggleFilteredRows() {
    setError('')
    if (!filteredEligibleRows.length) return

    setSelectedIds((current) => {
      const filteredIds = filteredEligibleRows.map((row) => row.id)
      const isAllSelected = filteredEligibleRows.every((row) => current.includes(row.id))

      if (isAllSelected) {
        setReturnQtyById((qtyState) => {
          const next = { ...qtyState }
          filteredIds.forEach((id) => {
            delete next[id]
          })
          return next
        })
        return current.filter((id) => !filteredIds.includes(id))
      }

      setReturnQtyById((qtyState) => {
        const next = { ...qtyState }
        filteredEligibleRows.forEach((row) => {
          next[row.id] = next[row.id] ?? row.availableQty
        })
        return next
      })

      return Array.from(new Set([...current, ...filteredIds]))
    })
  }

  function openReturnModal() {
    if (!selectedRows.length) {
      setError('Choose at least one Arkline reject row first.')
      return
    }
    setError('')
    setReturnModalOpen(true)
  }

  function closeReturnModal() {
    setReturnModalOpen(false)
    setReturnDate(todayValue())
    setShippingMethod('')
    setNotes('')
    setError('')
  }

  function openReceiptModal(batch) {
    const initialQty = {}
    batch.lines.forEach((line) => {
      initialQty[line.id] = ''
    })
    setReceiptQtyById(initialQty)
    setReceiptDate(todayValue())
    setReceiptNotes('')
    setError('')
    setReceiptBatch(batch)
  }

  async function saveReturnBatch() {
    const invalidRow = selectedRows.find((row) => {
      const qty = Number(returnQtyById[row.id] ?? row.availableQty)
      return qty <= 0 || qty > Number(row.availableQty || 0)
    })

    if (invalidRow) {
      setError('Return qty must be greater than zero and cannot exceed the available reject qty.')
      return
    }

    const groupedRows = selectedRows.reduce((groups, row) => {
      const key = `${row.poItemId || row.poId}-${row.qcCycleId || row.id}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(row)
      return groups
    }, new Map())

    setSaving(true)
    setError('')

    for (const groupRows of groupedRows.values()) {
      const first = groupRows[0]
      const linePayload = groupRows.map((row) => ({
        reject_detail_id: row.id,
        reject_reason_id: row.reasonId,
        grade: row.grade,
        size: row.size,
        qty: Number(returnQtyById[row.id] ?? row.availableQty),
      }))
      const { error: saveError } = await supabase.rpc('create_arkline_qc_return_batch', {
        p_po_id: first.poId,
        p_arkline_po_item_id: first.poItemId,
        p_sku_induk: first.skuInduk,
        p_model_name: first.modelName,
        p_supplier_name: first.supplierName || '',
        p_source_qc_cycle_id: first.qcCycleId,
        p_round_number: Number(first.qcRoundNumber || 1),
        p_return_date: returnDate,
        p_shipping_method: shippingMethod.trim(),
        p_notes: notes.trim(),
        p_created_by: userEmail || '',
        p_lines: linePayload,
      })

      if (saveError) {
        setError(saveError.message)
        setSaving(false)
        return
      }
    }

    setSelectedIds([])
    setReturnQtyById({})
    closeReturnModal()
    setActiveReturnTab('progress')
    setSaving(false)
    router.refresh()
  }

  async function saveReworkReceipt() {
    if (!receiptBatch) return

    const receiptLines = receiptBatch.lines
      .map((line) => ({
        ...line,
        inputQty: Number(receiptQtyById[line.id] || 0),
        remainingQty: Math.max(0, Number(line.qty || 0) - Number(line.receivedQty || 0)),
      }))
      .filter((line) => line.inputQty > 0)
    const invalidLine = receiptLines.find((line) => line.inputQty > line.remainingQty)

    if (invalidLine) {
      setError('Received qty cannot exceed the remaining qty for its return line.')
      return
    }
    if (!receiptLines.length) {
      setError('Enter at least one received qty.')
      return
    }

    setSaving(true)
    setError('')
    const { error: receiptError } = await supabase.rpc('record_arkline_rework_receipt', {
      p_return_batch_id: receiptBatch.id,
      p_receive_date: receiptDate,
      p_notes: receiptNotes.trim(),
      p_created_by: userEmail || '',
      p_lines: receiptLines.map((line) => ({
        return_batch_line_id: line.id,
        qty: line.inputQty,
      })),
    })

    if (receiptError) {
      setError(receiptError.message)
      setSaving(false)
      return
    }

    setReceiptBatch(null)
    setSaving(false)
    router.refresh()
  }

  return (
    <>
      <div className={styles.subPageTabsPage}>
        <div className={styles.subPageTabsShell}>
          <div className={styles.subPageTabsBar} role="tablist" aria-label="Arkline return workflow">
            <button
              type="button"
              role="tab"
              aria-selected={activeReturnTab === 'arrangement'}
              className={`${styles.subPageTabLink} ${activeReturnTab === 'arrangement' ? styles.subPageTabLinkActive : ''}`.trim()}
              onClick={() => setActiveReturnTab('arrangement')}
            >
              <span className={styles.subPageTabLabel}>Return Arrangement</span>
              <span className={styles.subPageTabUnderline} />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeReturnTab === 'progress'}
              className={`${styles.subPageTabLink} ${activeReturnTab === 'progress' ? styles.subPageTabLinkActive : ''}`.trim()}
              onClick={() => setActiveReturnTab('progress')}
            >
              <span className={styles.subPageTabLabel}>Return Progress</span>
              <span className={styles.subPageTabUnderline} />
            </button>
          </div>
        </div>

        <div className={styles.subPageTabsPanel}>
          {activeReturnTab === 'arrangement' ? (
      <section className={`${styles.card} ${styles.subPageCard}`.trim()}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Arkline</p>
            <h2 className={styles.sectionTitle}>Return Arrangement</h2>
          </div>
          <button type="button" className={styles.primaryButton} onClick={openReturnModal} disabled={!canAdd || !selectedRows.length}>
            Create Return Batch
          </button>
        </div>

        <div className={styles.filterGrid}>
          <div className={styles.field}>
            <label htmlFor="return-repairability-filter">Repairability</label>
            <select
              id="return-repairability-filter"
              className={styles.input}
              value={repairabilityFilter}
              onChange={(event) => {
                setRepairabilityFilter(event.target.value)
                setSelectedIds([])
              }}
            >
              <option value="all">All reject types</option>
              <option value="repairable">Repairable</option>
              <option value="non_repairable">Non-repairable</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="return-po-filter">PO</label>
            <select
              id="return-po-filter"
              className={styles.input}
              value={poFilter}
              onChange={(event) => {
                setPoFilter(event.target.value)
                setProductFilter('')
                setSelectedIds([])
              }}
            >
              <option value="">All PO</option>
              {poOptions.map((po) => <option key={po} value={po}>{po}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="return-product-filter">Product</label>
            <select
              id="return-product-filter"
              className={styles.input}
              value={productFilter}
              onChange={(event) => {
                setProductFilter(event.target.value)
                setSelectedIds([])
              }}
            >
              <option value="">All products</option>
              {productOptions.map((product) => <option key={product} value={product}>{product}</option>)}
            </select>
          </div>
        </div>

        <div className={styles.filteredSummary}>
          <div className={styles.summaryMetric}>
            <span>Selected Total</span>
            <strong>{selectedSummary.total}</strong>
          </div>
          <div className={styles.sizeSummary}>
            <span>Selected Qty per Size</span>
            <div className={styles.sizeChipRow}>
              {selectedSummary.sizes.length ? (
                selectedSummary.sizes.map((item) => (
                  <span key={item.size} className={styles.sizeChip}>
                    {item.size}: <strong>{item.qty}</strong>
                  </span>
                ))
              ) : (
                <span className={styles.sizeChip}>No selected qty</span>
              )}
            </div>
          </div>
        </div>

        {error && !returnModalOpen && !receiptBatch ? <p className={styles.error}>{error}</p> : null}

        {!filteredEligibleRows.length ? (
          <div className={styles.empty}>No Arkline reject qty matches the selected filters.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th aria-label="Select">
                    <input
                      className={styles.checkbox}
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleFilteredRows}
                      disabled={!filteredEligibleRows.length}
                      aria-label="Select all filtered reject rows"
                    />
                  </th>
                  <th>PO</th>
                  <th>Product</th>
                  <th>QC Cycle</th>
                  <th>Grade</th>
                  <th>Size</th>
                  <th>Reject Reason</th>
                  <th>Repairability</th>
                  <th className={styles.centerNumberCell}>Available Qty</th>
                </tr>
              </thead>
              <tbody>
                {filteredEligibleRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleRow(row)}
                      />
                    </td>
                    <td>{row.poId}</td>
                    <td>{row.modelName}</td>
                    <td>Round {row.qcRoundNumber}</td>
                    <td>{row.grade}</td>
                    <td>{row.size}</td>
                    <td>{row.reasonName}</td>
                    <td>
                      <span className={`${styles.badge} ${row.isRepairable ? styles.badgeRepairable : ''}`}>
                        {row.isRepairable ? 'Repairable' : 'Non-repairable'}
                      </span>
                    </td>
                    <td className={styles.centerNumberCell}>{row.availableQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}

      {activeReturnTab === 'progress' ? (
      <section className={`${styles.card} ${styles.subPageCard}`.trim()}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Arkline</p>
            <h2 className={styles.sectionTitle}>Return Progress</h2>
          </div>
        </div>

        {!batches.length ? (
          <div className={styles.empty}>No Arkline return batch has been created.</div>
        ) : (
          <div className={styles.batchList}>
            {batches.map((batch) => {
              const canReceive = !['FULLY_RETURNED', 'CLOSED_SHORT'].includes(batch.status)
              return (
                <article key={batch.id} className={styles.batchCard}>
                  <div className={styles.batchHeader}>
                    <div className={styles.batchTitle}>
                      <strong>{batch.returnNumber}</strong>
                      <span className={styles.badge}>{formatStatus(batch.status)}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => openReceiptModal(batch)}
                      disabled={!canEdit || !canReceive}
                    >
                      Record Returned Goods
                    </button>
                  </div>
                  <div className={styles.batchMeta}>
                    <div className={styles.metric}><span>PO</span><strong>{batch.poId}</strong></div>
                    <div className={styles.metric}><span>Product</span><strong>{batch.modelName}</strong></div>
                    <div className={styles.metric}><span>Sent</span><strong>{batch.sentQty}</strong></div>
                    <div className={styles.metric}><span>Returned</span><strong>{batch.returnedQty}</strong></div>
                    <div className={styles.metric}><span>Short</span><strong>{batch.shortQty}</strong></div>
                  </div>
                  <p className={styles.notice}>
                    Round {batch.roundNumber} sent on {formatDate(batch.returnDate)} to {batch.supplierName || 'supplier not recorded'}.
                  </p>
                </article>
              )
            })}
          </div>
        )}
      </section>
      ) : null}
        </div>
      </div>

      {returnModalOpen ? (
        <div className={styles.overlay} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="create-return-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="create-return-title">Create Arkline Return</h2>
                <p>{selectedRows.length} reject line(s) selected. Multiple PO products will be split into separate return batches.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeReturnModal} aria-label="Close">X</button>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="return-date">Return Date</label>
                <input id="return-date" className={styles.input} type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="shipping-method">Shipping Method</label>
                <input id="shipping-method" className={styles.input} value={shippingMethod} onChange={(event) => setShippingMethod(event.target.value)} placeholder="Courier or vehicle" />
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label htmlFor="return-notes">Notes</label>
                <textarea id="return-notes" className={styles.textarea} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </div>
            </div>
            <div className={styles.lineList}>
              {selectedRows.map((row) => (
                <div key={row.id} className={styles.lineRow}>
                  <div className={styles.lineName}>
                    <strong>{row.reasonName}</strong>
                    Grade {row.grade} / Size {row.size} / Available {row.availableQty}
                  </div>
                  <span className={`${styles.badge} ${styles.lineBadge} ${row.isRepairable ? styles.badgeRepairable : ''}`}>
                    {row.isRepairable ? 'Repairable' : 'Non-repairable'}
                  </span>
                  <input
                    className={styles.input}
                    type="number"
                    min="1"
                    max={row.availableQty}
                    value={returnQtyById[row.id] ?? row.availableQty}
                    onChange={(event) => setReturnQtyById((current) => ({ ...current, [row.id]: event.target.value }))}
                    aria-label={`Return qty for ${row.reasonName}`}
                  />
                </div>
              ))}
            </div>
            <p className={styles.notice}>Total qty to return: {selectedQty}</p>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeReturnModal} disabled={saving}>Cancel</button>
              <button type="button" className={styles.primaryButton} onClick={saveReturnBatch} disabled={saving}>{saving ? 'Saving...' : 'Save Return Batch'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {receiptBatch ? (
        <div className={styles.overlay} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="receipt-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="receipt-title">Record Returned Goods</h2>
                <p>{receiptBatch.returnNumber} becomes Re-QC Round {Number(receiptBatch.roundNumber || 1) + 1}.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => setReceiptBatch(null)} aria-label="Close">X</button>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="receipt-date">Receive Date</label>
                <input id="receipt-date" className={styles.input} type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} />
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label htmlFor="receipt-notes">Receiving Notes</label>
                <textarea id="receipt-notes" className={styles.textarea} value={receiptNotes} onChange={(event) => setReceiptNotes(event.target.value)} />
              </div>
            </div>
            <div className={styles.lineList}>
              {receiptBatch.lines.map((line) => {
                const remaining = Math.max(0, Number(line.qty || 0) - Number(line.receivedQty || 0))
                return (
                  <div key={line.id} className={styles.lineRow}>
                    <div className={styles.lineName}>
                      <strong>{line.reasonName}</strong>
                      Grade {line.grade} / Size {line.size} / Remaining {remaining}
                    </div>
                    <span className={`${styles.badge} ${styles.lineBadge}`}>Sent {line.qty}</span>
                    <input
                      className={styles.input}
                      type="number"
                      min="0"
                      max={remaining}
                      value={receiptQtyById[line.id] || ''}
                      onChange={(event) => setReceiptQtyById((current) => ({ ...current, [line.id]: event.target.value }))}
                      disabled={remaining === 0}
                      aria-label={`Received qty for ${line.reasonName}`}
                    />
                  </div>
                )
              })}
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setReceiptBatch(null)} disabled={saving}>Cancel</button>
              <button type="button" className={styles.primaryButton} onClick={saveReworkReceipt} disabled={saving}>{saving ? 'Saving...' : 'Save Returned Goods'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
