'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import shellStyles from '../../arkline.module.css'
import styles from '../production-planning.module.css'

const supabase = createClient()

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(String(value || '').replace(/[^\d.-]/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function formatQty(value) {
  const number = toNumber(value)
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '')
}

function computeStatus(line) {
  if (line.sentQty >= line.finalQty && line.finalQty > 0) return 'Sent'
  if (line.sentQty > 0) return 'Partial Sent'
  if (line.receivedQty >= line.finalQty && line.finalQty > 0) return 'Received'
  if (line.receivedQty > 0) return 'Partial Received'
  if (line.orderedQty >= line.finalQty && line.finalQty > 0) return 'Ordered'
  if (line.orderedQty > 0) return 'Partial Ordered'
  return 'Not Ordered'
}

function normalizeMaterial(row) {
  return {
    id: String(row?.id || '').trim(),
    poId: String(row?.po_id || '').trim().toUpperCase(),
    arklinePoItemId: String(row?.arkline_po_item_id || '').trim(),
    skuInduk: String(row?.sku_induk || '').trim().toUpperCase(),
    materialId: String(row?.material_id || '').trim(),
    materialNameSnapshot: String(row?.material_name_snapshot || '').trim().toUpperCase(),
    sizeVariant: String(row?.size_variant || '').trim().toUpperCase(),
    colorVariant: String(row?.color_variant || '').trim().toUpperCase(),
    unit: String(row?.unit || 'PCS').trim().toUpperCase(),
    generatedQty: toNumber(row?.generated_qty),
    finalQty: toNumber(row?.final_qty),
  }
}

export default function ArklineMaterialFulfillmentPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [poFilter, setPoFilter] = useState('')
  const [rows, setRows] = useState([])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')
      setWarning('')

      try {
        const { data: materialRows, error: materialError } = await supabase
          .from('arkline_po_materials')
          .select('*')
          .order('po_id', { ascending: true })

        if (materialError) {
          throw new Error(materialError.message)
        }

        const materials = (materialRows || []).map(normalizeMaterial)
        const poIds = Array.from(new Set(materials.map((item) => item.poId).filter(Boolean)))
        const itemIds = Array.from(new Set(materials.map((item) => item.arklinePoItemId).filter(Boolean)))
        const materialSnapshotIds = Array.from(new Set(materials.map((item) => item.id).filter(Boolean)))

        const [poResponse, itemResponse, logResponse] = await Promise.all([
          poIds.length
            ? supabase.from('arkline_pos').select('po_id, supplier_name, request_delivery_date, status').in('po_id', poIds)
            : Promise.resolve({ data: [], error: null }),
          itemIds.length
            ? supabase.from('arkline_po_items').select('id, nama_produk, kategori_produk').in('id', itemIds)
            : Promise.resolve({ data: [], error: null }),
          materialSnapshotIds.length
            ? supabase.from('arkline_po_material_logs').select('*').in('arkline_po_material_id', materialSnapshotIds)
            : Promise.resolve({ data: [], error: null }),
        ])

        if (poResponse.error) throw new Error(poResponse.error.message)
        if (itemResponse.error) throw new Error(itemResponse.error.message)

        if (logResponse.error) {
          setWarning('Material logs table is not ready yet. Snapshot data is shown without fulfillment progress.')
        }

        const poById = (poResponse.data || []).reduce((acc, row) => {
          acc[String(row.po_id || '').trim().toUpperCase()] = row
          return acc
        }, {})

        const itemById = (itemResponse.data || []).reduce((acc, row) => {
          acc[String(row.id || '').trim()] = row
          return acc
        }, {})

        const logTotalsByMaterial = (logResponse.data || []).reduce((acc, row) => {
          const key = String(row.arkline_po_material_id || '').trim()
          if (!key) return acc
          if (!acc[key]) {
            acc[key] = { orderedQty: 0, receivedQty: 0, sentQty: 0, latestEventDate: '' }
          }

          const qty = toNumber(row.qty)
          if (row.log_type === 'ordered') acc[key].orderedQty += qty
          if (row.log_type === 'received') acc[key].receivedQty += qty
          if (row.log_type === 'sent_to_garment') acc[key].sentQty += qty

          const eventDate = String(row.event_date || '')
          if (eventDate && (!acc[key].latestEventDate || eventDate > acc[key].latestEventDate)) {
            acc[key].latestEventDate = eventDate
          }

          return acc
        }, {})

        const normalizedRows = materials.map((item) => {
          const po = poById[item.poId] || {}
          const product = itemById[item.arklinePoItemId] || {}
          const logTotals = logTotalsByMaterial[item.id] || {
            orderedQty: 0,
            receivedQty: 0,
            sentQty: 0,
            latestEventDate: '',
          }

          const row = {
            ...item,
            supplierName: String(po.supplier_name || '').trim().toUpperCase(),
            poStatus: String(po.status || '').trim(),
            requestDeliveryDate: String(po.request_delivery_date || '').slice(0, 10),
            productName: String(product.nama_produk || '').trim().toUpperCase(),
            categoryName: String(product.kategori_produk || '').trim().toUpperCase(),
            orderedQty: logTotals.orderedQty,
            receivedQty: logTotals.receivedQty,
            sentQty: logTotals.sentQty,
            latestEventDate: logTotals.latestEventDate,
          }

          return {
            ...row,
            remainingQty: Math.max(row.finalQty - row.sentQty, 0),
            status: computeStatus(row),
          }
        })

        setRows(normalizedRows)
      } catch (loadError) {
        setRows([])
        setError(loadError.message || 'Failed to load Arkline material fulfillment.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const poOptions = useMemo(
    () => Array.from(new Set(rows.map((item) => item.poId).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [rows]
  )

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toUpperCase()

    return rows.filter((item) => {
      const matchesKeyword =
        !keyword ||
        [item.poId, item.productName, item.skuInduk, item.materialNameSnapshot, item.supplierName, item.sizeVariant, item.colorVariant]
          .filter(Boolean)
          .join(' ')
          .includes(keyword)

      const matchesStatus = !statusFilter || item.status === statusFilter
      const matchesPo = !poFilter || item.poId === poFilter
      return matchesKeyword && matchesStatus && matchesPo
    })
  }, [poFilter, rows, search, statusFilter])

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (acc, item) => {
        acc.lines += 1
        acc.finalQty += item.finalQty
        acc.orderedQty += item.orderedQty
        acc.receivedQty += item.receivedQty
        acc.sentQty += item.sentQty
        acc.remainingQty += item.remainingQty
        return acc
      },
      {
        lines: 0,
        finalQty: 0,
        orderedQty: 0,
        receivedQty: 0,
        sentQty: 0,
        remainingQty: 0,
      }
    )
  }, [filteredRows])

  return (
    <div className={shellStyles.page}>
      <section className={styles.board}>
        <div className={styles.header}>
          <div className={styles.headerTitleWrap}>
            <p className={styles.eyebrow}>Arkline</p>
            <h1 className={styles.title}>Material Requirement Planning</h1>
            <p className={styles.subtitle}>Track material requirement, ordering, receiving, and sending progress per PO item.</p>
          </div>
        </div>

        {(error || warning) && (
          <div className={styles.feedbackStrip}>
            {error ? <p className={styles.errorText}>{error}</p> : null}
            {warning ? <p className={styles.successText}>{warning}</p> : null}
          </div>
        )}

        <section className={styles.sectionCard}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Search</label>
              <input
                className={styles.input}
                value={search}
                onChange={(event) => setSearch(event.target.value.toUpperCase())}
                placeholder="PO / PRODUCT / MATERIAL"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>PO</label>
              <select className={styles.select} value={poFilter} onChange={(event) => setPoFilter(event.target.value)}>
                <option value="">All PO</option>
                {poOptions.map((poId) => (
                  <option key={poId} value={poId}>
                    {poId}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Status</label>
              <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All Status</option>
                <option value="Not Ordered">Not Ordered</option>
                <option value="Partial Ordered">Partial Ordered</option>
                <option value="Ordered">Ordered</option>
                <option value="Partial Received">Partial Received</option>
                <option value="Received">Received</option>
                <option value="Partial Sent">Partial Sent</option>
                <option value="Sent">Sent</option>
              </select>
            </div>
          </div>
        </section>

        <div className={styles.planningColumns}>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Snapshot</h2>
                <p className={styles.sectionCopy}>Current filtered totals across material lines.</p>
              </div>
            </div>

            <div className={styles.miniStatsGrid}>
              <div className={styles.miniStatCard}>
                <span className={styles.miniStatLabel}>Lines</span>
                <strong className={styles.miniStatValue}>{formatQty(summary.lines)}</strong>
              </div>
              <div className={styles.miniStatCard}>
                <span className={styles.miniStatLabel}>Final Qty</span>
                <strong className={styles.miniStatValue}>{formatQty(summary.finalQty)}</strong>
              </div>
              <div className={styles.miniStatCard}>
                <span className={styles.miniStatLabel}>Ordered</span>
                <strong className={styles.miniStatValue}>{formatQty(summary.orderedQty)}</strong>
              </div>
              <div className={styles.miniStatCard}>
                <span className={styles.miniStatLabel}>Received</span>
                <strong className={styles.miniStatValue}>{formatQty(summary.receivedQty)}</strong>
              </div>
              <div className={styles.miniStatCard}>
                <span className={styles.miniStatLabel}>Sent</span>
                <strong className={styles.miniStatValue}>{formatQty(summary.sentQty)}</strong>
              </div>
              <div className={styles.miniStatCard}>
                <span className={styles.miniStatLabel}>Remaining</span>
                <strong className={styles.miniStatValue}>{formatQty(summary.remainingQty)}</strong>
              </div>
            </div>
          </section>
        </div>

        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Material Lines</h2>
              <p className={styles.sectionCopy}>Material requirement tracking per PO, product, and size variant.</p>
            </div>
          </div>

          {loading ? (
            <div className={styles.emptyState}>Loading material fulfillment...</div>
          ) : filteredRows.length ? (
            <div className={styles.linesTableWrap}>
              <table className={styles.linesTable}>
                <thead>
                  <tr>
                    <th>PO</th>
                    <th>Product</th>
                    <th>Material</th>
                    <th>Variant</th>
                    <th>Final Qty</th>
                    <th>Ordered</th>
                    <th>Received</th>
                    <th>Sent</th>
                    <th>Remaining</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.poId || '-'}</td>
                      <td>{row.productName || row.skuInduk || '-'}</td>
                      <td>{row.materialNameSnapshot || '-'}</td>
                      <td>{[row.sizeVariant, row.colorVariant].filter(Boolean).join(' / ') || '-'}</td>
                      <td>{formatQty(row.finalQty)}</td>
                      <td>{formatQty(row.orderedQty)}</td>
                      <td>{formatQty(row.receivedQty)}</td>
                      <td>{formatQty(row.sentQty)}</td>
                      <td>{formatQty(row.remainingQty)}</td>
                      <td>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>No material lines found.</div>
          )}
        </section>
      </section>
    </div>
  )
}
