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
  const [search, setSearch] = useState('')
  const [poFilter, setPoFilter] = useState('')
  const [rows, setRows] = useState([])
  const [poMeta, setPoMeta] = useState({})

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      try {
        const { data: materialRows, error: materialError } = await supabase
          .from('arkline_po_materials')
          .select('*')
          .order('po_id', { ascending: true })

        if (materialError) {
          throw new Error(materialError.message)
        }

        const materials = (materialRows || []).map(normalizeMaterial)
        const itemIds = Array.from(new Set(materials.map((item) => item.arklinePoItemId).filter(Boolean)))

        const [poResponse, itemResponse] = await Promise.all([
          supabase
            .from('arkline_pos')
            .select('po_id, supplier_name, request_delivery_date, method')
            .eq('method', 'CMT')
            .order('po_id', { ascending: true }),
          itemIds.length
            ? supabase.from('arkline_po_items').select('id, nama_produk, kategori_produk').in('id', itemIds)
            : Promise.resolve({ data: [], error: null }),
        ])

        if (poResponse.error) throw new Error(poResponse.error.message)
        if (itemResponse.error) throw new Error(itemResponse.error.message)

        const poById = (poResponse.data || []).reduce((acc, row) => {
          acc[String(row.po_id || '').trim().toUpperCase()] = row
          return acc
        }, {})

        const itemById = (itemResponse.data || []).reduce((acc, row) => {
          acc[String(row.id || '').trim()] = row
          return acc
        }, {})

        const normalizedRows = materials
          .filter((item) => poById[item.poId])
          .map((item) => {
          const po = poById[item.poId] || {}
          const product = itemById[item.arklinePoItemId] || {}

          return {
            ...item,
            supplierName: String(po.supplier_name || '').trim().toUpperCase(),
            requestDeliveryDate: String(po.request_delivery_date || '').slice(0, 10),
            method: String(po.method || '').trim().toUpperCase(),
            productName: String(product.nama_produk || '').trim().toUpperCase(),
            categoryName: String(product.kategori_produk || '').trim().toUpperCase(),
          }
        })

        const normalizedPoMeta = (poResponse.data || []).reduce((acc, row) => {
          const poId = String(row.po_id || '').trim().toUpperCase()
          if (!poId) return acc
          acc[poId] = {
            poId,
            supplierName: String(row.supplier_name || '').trim().toUpperCase(),
            requestDeliveryDate: String(row.request_delivery_date || '').slice(0, 10),
            method: String(row.method || '').trim().toUpperCase(),
          }
          return acc
        }, {})

        const nextPoOptions = Object.keys(normalizedPoMeta).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

        setRows(normalizedRows)
        setPoMeta(normalizedPoMeta)
        setPoFilter((current) => (current && normalizedPoMeta[current] ? current : nextPoOptions[0] || ''))
      } catch (loadError) {
        setRows([])
        setPoMeta({})
        setError(loadError.message || 'Failed to load Arkline material fulfillment.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const poOptions = useMemo(
    () => Object.keys(poMeta).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [poMeta]
  )

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toUpperCase()

    return rows.filter((item) => {
      const matchesPo = !!poFilter && item.poId === poFilter
      const matchesKeyword =
        !keyword ||
        [item.poId, item.productName, item.skuInduk, item.materialNameSnapshot, item.supplierName, item.sizeVariant, item.colorVariant]
          .filter(Boolean)
          .join(' ')
          .includes(keyword)

      return matchesKeyword && matchesPo
    })
  }, [poFilter, rows, search])

  const selectedPoMeta = poFilter ? poMeta[poFilter] || null : null
  const materialSummary = useMemo(
    () =>
      filteredRows.reduce(
        (acc, item) => {
          acc.lines += 1
          acc.totalQty += item.finalQty
          return acc
        },
        { lines: 0, totalQty: 0 }
      ),
    [filteredRows]
  )

  return (
    <div className={shellStyles.page}>
      <section className={styles.board}>
        <div className={styles.header}>
          <div className={styles.headerTitleWrap}>
            <p className={styles.eyebrow}>Arkline</p>
            <h1 className={styles.title}>Material Requirement Planning</h1>
            <p className={styles.subtitle}>Choose a CMT PO first, then review the material requirements generated for that order.</p>
          </div>
        </div>

        {error ? (
          <div className={styles.feedbackStrip}>
            <p className={styles.errorText}>{error}</p>
          </div>
        ) : null}

        <section className={styles.sectionCard}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>PO Number</label>
              <select className={styles.select} value={poFilter} onChange={(event) => setPoFilter(event.target.value)}>
                <option value="">Select CMT PO</option>
                {poOptions.map((poId) => (
                  <option key={poId} value={poId}>
                    {poId}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Search Material</label>
              <input
                className={styles.input}
                value={search}
                onChange={(event) => setSearch(event.target.value.toUpperCase())}
                placeholder="PRODUCT / MATERIAL / VARIANT"
              />
            </div>
          </div>

          {selectedPoMeta ? (
            <div className={styles.miniStatsGrid}>
              <div className={styles.miniStatCard}>
                <span className={styles.miniStatLabel}>Supplier</span>
                <strong className={styles.miniStatValue}>{selectedPoMeta.supplierName || '-'}</strong>
              </div>
              <div className={styles.miniStatCard}>
                <span className={styles.miniStatLabel}>Request Delivery</span>
                <strong className={styles.miniStatValue}>{selectedPoMeta.requestDeliveryDate || '-'}</strong>
              </div>
              <div className={styles.miniStatCard}>
                <span className={styles.miniStatLabel}>Material Lines</span>
                <strong className={styles.miniStatValue}>{formatQty(materialSummary.lines)}</strong>
              </div>
              <div className={styles.miniStatCard}>
                <span className={styles.miniStatLabel}>Total Material Qty</span>
                <strong className={styles.miniStatValue}>{formatQty(materialSummary.totalQty)}</strong>
              </div>
            </div>
          ) : null}
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Required Materials</h2>
              <p className={styles.sectionCopy}>Material requirement generated from the selected CMT PO.</p>
            </div>
          </div>

          {loading ? (
            <div className={styles.emptyState}>Loading material fulfillment...</div>
          ) : !poFilter ? (
            <div className={styles.emptyState}>Select one CMT PO first to see the required materials.</div>
          ) : filteredRows.length ? (
            <div className={styles.linesTableWrap}>
              <table className={styles.linesTable}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Material</th>
                    <th>Variant</th>
                    <th>Qty Needed</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.productName || row.skuInduk || '-'}</td>
                      <td>{row.skuInduk || '-'}</td>
                      <td>{row.materialNameSnapshot || '-'}</td>
                      <td>{[row.sizeVariant, row.colorVariant].filter(Boolean).join(' / ') || '-'}</td>
                      <td>{formatQty(row.finalQty)}</td>
                      <td>{row.unit || '-'}</td>
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
