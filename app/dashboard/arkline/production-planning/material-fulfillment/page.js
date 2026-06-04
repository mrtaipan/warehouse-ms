'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import shellStyles from '../../arkline.module.css'
import styles from '../production-planning.module.css'

const supabase = createClient()

const MRP_MODE_OPTIONS = [
  { id: 'existing-po', label: 'PO Material Purchase' },
  { id: 'free-material', label: 'Free Material Purchase' },
]

function createOrderHeaderDraft() {
  return {
    supplierId: '',
    supplierName: '',
    paymentTerms: '',
    requestDeliveryDate: '',
    notes: '',
  }
}

function createFreeMaterialDraft() {
  return {
    materialId: '',
    qty: '',
  }
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(String(value || '').replace(/[^\d.-]/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function formatQty(value) {
  const number = toNumber(value)
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '')
}

function formatCurrency(value) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function normalizeMaterialRequirement(row) {
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

function normalizePo(row) {
  return {
    poId: String(row?.po_id || '').trim().toUpperCase(),
    supplierName: String(row?.supplier_name || '').trim().toUpperCase(),
    requestDeliveryDate: String(row?.request_delivery_date || '').slice(0, 10),
    method: String(row?.method || '').trim().toUpperCase(),
    status: String(row?.status || '').trim().toUpperCase(),
  }
}

function normalizeSupplier(row) {
  return {
    id: String(row?.id || '').trim(),
    supplierName: String(row?.supplier_name || row?.nama_supplier || '').trim().toUpperCase(),
    supplierLevel: String(row?.supplier_level || '').trim().toUpperCase(),
    isActive: row?.is_active !== false,
  }
}

function normalizeMaterialMaster(row) {
  return {
    id: String(row?.id || '').trim(),
    materialName: String(row?.material_name || '').trim().toUpperCase(),
    unit: String(row?.unit || 'PCS').trim().toUpperCase(),
    isActive: row?.is_active !== false,
  }
}

function buildOrderLineKey({ materialId, sizeVariant, colorVariant, unit }) {
  return [
    String(materialId || '').trim(),
    String(sizeVariant || '').trim().toUpperCase(),
    String(colorVariant || '').trim().toUpperCase(),
    String(unit || '').trim().toUpperCase(),
  ].join('::')
}

function buildOrderSourceFromRequirement(requirement) {
  return {
    id: `po:${requirement.id}`,
    sourceType: 'PO',
    sourceRowId: requirement.id,
    poId: requirement.poId,
    productName: requirement.productName || requirement.skuInduk || '-',
    skuInduk: requirement.skuInduk,
    qty: requirement.finalQty,
    label: `${requirement.poId} - ${requirement.productName || requirement.skuInduk || '-'}`,
    secondaryLabel: [requirement.sizeVariant, requirement.colorVariant].filter(Boolean).join(' / ') || '-',
  }
}

function buildOrderSourceFromFreeMaterial(material, qty) {
  return {
    id: `free:${material.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    sourceType: 'FREE',
    sourceRowId: '',
    poId: '',
    productName: 'FREE MATERIAL',
    skuInduk: '',
    qty,
    label: 'Free Material',
    secondaryLabel: material.materialName,
  }
}

function mergeSourceIntoLines(lines, nextLine) {
  const existingIndex = lines.findIndex((item) => item.key === nextLine.key)

  if (existingIndex === -1) {
    return [...lines, nextLine]
  }

  const existing = lines[existingIndex]
  const existingSourceIds = new Set(existing.sources.map((source) => source.id))
  const mergedSources = [...existing.sources]

  nextLine.sources.forEach((source) => {
    if (!existingSourceIds.has(source.id)) {
      mergedSources.push(source)
    }
  })

  const mergedLine = {
    ...existing,
    totalQty: existing.totalQty + nextLine.totalQty,
    sources: mergedSources,
  }

  return lines.map((item, index) => (index === existingIndex ? mergedLine : item))
}

export default function ArklineMaterialFulfillmentPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mode, setMode] = useState('existing-po')
  const [poFilter, setPoFilter] = useState('')
  const [requirements, setRequirements] = useState([])
  const [poOptions, setPoOptions] = useState([])
  const [poMeta, setPoMeta] = useState({})
  const [suppliers, setSuppliers] = useState([])
  const [materialOptions, setMaterialOptions] = useState([])
  const [selectedRequirementIds, setSelectedRequirementIds] = useState([])
  const [orderHeader, setOrderHeader] = useState(createOrderHeaderDraft())
  const [freeMaterialDraft, setFreeMaterialDraft] = useState(createFreeMaterialDraft())
  const [orderLines, setOrderLines] = useState([])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      try {
        const { data: materialRows, error: materialError } = await supabase
          .from('arkline_po_materials')
          .select('*')
          .order('po_id', { ascending: true })

        if (materialError) throw new Error(materialError.message)

        const normalizedRequirements = (materialRows || []).map(normalizeMaterialRequirement)
        const itemIds = Array.from(new Set(normalizedRequirements.map((item) => item.arklinePoItemId).filter(Boolean)))

        const [poResponse, itemResponse, supplierResponse, materialMasterResponse] = await Promise.all([
          supabase
            .from('arkline_pos')
            .select('po_id, supplier_name, request_delivery_date, method, status')
            .eq('method', 'CMT')
            .eq('status', 'Initiated')
            .order('po_id', { ascending: true }),
          itemIds.length
            ? supabase.from('arkline_po_items').select('id, nama_produk, kategori_produk').in('id', itemIds)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from('dir_suppliers')
            .select('id, supplier_name, supplier_level, "group", is_active')
            .eq('group', 'ARKLINE')
            .eq('supplier_level', 'MATERIAL')
            .eq('is_active', true)
            .order('supplier_name', { ascending: true }),
          supabase.from('arkline_dir_materials').select('id, material_name, unit, is_active').eq('is_active', true).order('material_name', { ascending: true }),
        ])

        if (poResponse.error) throw new Error(poResponse.error.message)
        if (itemResponse.error) throw new Error(itemResponse.error.message)
        if (supplierResponse.error) throw new Error(supplierResponse.error.message)
        if (materialMasterResponse.error) throw new Error(materialMasterResponse.error.message)

        const normalizedPoOptions = (poResponse.data || []).map(normalizePo).filter((item) => item.poId)
        const nextPoMeta = normalizedPoOptions.reduce((accumulator, item) => {
          accumulator[item.poId] = item
          return accumulator
        }, {})

        const itemMetaById = (itemResponse.data || []).reduce((accumulator, item) => {
          accumulator[String(item.id || '').trim()] = {
            productName: String(item.nama_produk || '').trim().toUpperCase(),
            categoryName: String(item.kategori_produk || '').trim().toUpperCase(),
          }
          return accumulator
        }, {})

        const enrichedRequirements = normalizedRequirements
          .filter((item) => nextPoMeta[item.poId])
          .map((item) => ({
            ...item,
            productName: itemMetaById[item.arklinePoItemId]?.productName || '',
            categoryName: itemMetaById[item.arklinePoItemId]?.categoryName || '',
          }))

        const normalizedSuppliers = (supplierResponse.data || [])
          .map(normalizeSupplier)
          .filter((item) => item.isActive && item.supplierName)
        const normalizedMaterials = (materialMasterResponse.data || [])
          .map(normalizeMaterialMaster)
          .filter((item) => item.isActive && item.materialName)

        setRequirements(enrichedRequirements)
        setPoOptions(normalizedPoOptions)
        setPoMeta(nextPoMeta)
        setSuppliers(normalizedSuppliers)
        setMaterialOptions(normalizedMaterials)
        setPoFilter((current) => (current && nextPoMeta[current] ? current : normalizedPoOptions[0]?.poId || ''))
      } catch (loadError) {
        setRequirements([])
        setPoOptions([])
        setPoMeta({})
        setSuppliers([])
        setMaterialOptions([])
        setError(loadError.message || 'Failed to load material requirement planning.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const assignedRequirementIds = useMemo(() => {
    const ids = new Set()
    orderLines.forEach((line) => {
      line.sources.forEach((source) => {
        if (source.sourceType === 'PO' && source.sourceRowId) {
          ids.add(source.sourceRowId)
        }
      })
    })
    return ids
  }, [orderLines])

  const filteredRequirements = useMemo(() => {
    if (!poFilter) return []
    return requirements.filter((item) => item.poId === poFilter)
  }, [poFilter, requirements])

  const orderDraftSummary = useMemo(
    () =>
      orderLines.reduce(
        (accumulator, line) => {
          accumulator.lines += 1
          accumulator.totalQty += line.totalQty
          return accumulator
        },
        { lines: 0, totalQty: 0 }
      ),
    [orderLines]
  )

  function updateOrderHeader(name, value) {
    if (name === 'supplierId') {
      const selectedSupplier = suppliers.find((item) => item.id === value)
      setOrderHeader((current) => ({
        ...current,
        supplierId: value,
        supplierName: selectedSupplier?.supplierName || '',
      }))
      return
    }

    setOrderHeader((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function toggleRequirementSelection(rowId) {
    setSelectedRequirementIds((current) =>
      current.includes(rowId) ? current.filter((item) => item !== rowId) : [...current, rowId]
    )
  }

  function handleMoveSelectedRequirements() {
    setError('')
    setSuccess('')

    const selectedRows = filteredRequirements.filter((item) => selectedRequirementIds.includes(item.id))

    if (!selectedRows.length) {
      setError('Choose at least one material line first.')
      return
    }

    let nextLines = [...orderLines]

    selectedRows.forEach((row) => {
      if (assignedRequirementIds.has(row.id)) return

      const nextLine = {
        key: buildOrderLineKey(row),
        materialId: row.materialId,
        materialName: row.materialNameSnapshot,
        unit: row.unit,
        sizeVariant: row.sizeVariant,
        colorVariant: row.colorVariant,
        totalQty: row.finalQty,
        price: '',
        notes: '',
        sources: [buildOrderSourceFromRequirement(row)],
      }

      nextLines = mergeSourceIntoLines(nextLines, nextLine)
    })

    setOrderLines(nextLines)
    setSelectedRequirementIds([])
    setSuccess('Selected materials moved to the order panel.')
  }

  function handleAddFreeMaterial() {
    setError('')
    setSuccess('')

    const selectedMaterial = materialOptions.find((item) => item.id === freeMaterialDraft.materialId)
    const qty = toNumber(freeMaterialDraft.qty)

    if (!selectedMaterial) {
      setError('Choose one material first.')
      return
    }

    if (qty <= 0) {
      setError('Enter a valid quantity first.')
      return
    }

    const nextLine = {
      key: buildOrderLineKey({
        materialId: selectedMaterial.id,
        sizeVariant: '',
        colorVariant: '',
        unit: selectedMaterial.unit,
      }),
      materialId: selectedMaterial.id,
      materialName: selectedMaterial.materialName,
      unit: selectedMaterial.unit,
      sizeVariant: '',
      colorVariant: '',
      totalQty: qty,
      price: '',
      notes: '',
      sources: [buildOrderSourceFromFreeMaterial(selectedMaterial, qty)],
    }

    setOrderLines((current) => mergeSourceIntoLines(current, nextLine))
    setFreeMaterialDraft(createFreeMaterialDraft())
    setSuccess('Material added to the order panel.')
  }

  function handleRemoveOrderLine(lineKey) {
    setOrderLines((current) => current.filter((item) => item.key !== lineKey))
  }

  function handleUpdateOrderLineNotes(lineKey, value) {
    setOrderLines((current) => current.map((item) => (item.key === lineKey ? { ...item, notes: value } : item)))
  }

  function handleUpdateOrderLinePrice(lineKey, value) {
    setOrderLines((current) => current.map((item) => (item.key === lineKey ? { ...item, price: value } : item)))
  }

  function moveOrderLine(lineKey, direction) {
    setOrderLines((current) => {
      const index = current.findIndex((item) => item.key === lineKey)
      if (index === -1) return current

      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= current.length) return current

      const next = [...current]
      const [line] = next.splice(index, 1)
      next.splice(targetIndex, 0, line)
      return next
    })
  }

  function handleResetDraft() {
    setOrderHeader(createOrderHeaderDraft())
    setFreeMaterialDraft(createFreeMaterialDraft())
    setSelectedRequirementIds([])
    setOrderLines([])
    setError('')
    setSuccess('')
  }

  return (
    <div className={shellStyles.page}>
      <section className={styles.board}>
        <div className={styles.header}>
          <div className={styles.headerTitleWrap}>
            <p className={styles.eyebrow}>Arkline</p>
            <h1 className={styles.title}>Material Requirement Planning</h1>
            <p className={styles.subtitle}>Material PO setup, purchasing information, material allocation, save, and print.</p>
          </div>
        </div>

        {error ? (
          <div className={styles.feedbackStrip}>
            <p className={styles.errorText}>{error}</p>
          </div>
        ) : null}

        {success ? (
          <div className={styles.feedbackStrip} style={{ borderColor: '#d1fae5', background: '#ecfdf5' }}>
            <p className={styles.successText}>{success}</p>
          </div>
        ) : null}

        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Material Order</h2>
            </div>

            <div className={styles.materialModeRow}>
              {MRP_MODE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`${styles.modeButton} ${mode === option.id ? styles.modeButtonActive : ''}`.trim()}
                  onClick={() => {
                    setMode(option.id)
                    setError('')
                    setSuccess('')
                    setSelectedRequirementIds([])
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={`${styles.formGrid} ${styles.materialHeaderGrid}`}>
            <div className={styles.field}>
              <label className={styles.label}>Supplier</label>
              <select className={styles.select} value={orderHeader.supplierId} onChange={(event) => updateOrderHeader('supplierId', event.target.value)}>
                <option value="">Select material supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplierName}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Request Delivery Date</label>
              <input
                className={styles.input}
                type="date"
                value={orderHeader.requestDeliveryDate}
                onChange={(event) => updateOrderHeader('requestDeliveryDate', event.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Payment Terms</label>
              <input
                className={styles.input}
                value={orderHeader.paymentTerms}
                onChange={(event) => updateOrderHeader('paymentTerms', event.target.value)}
                placeholder="NET 30 / CASH / CUSTOM TERMS"
              />
            </div>

            <div className={`${styles.field} ${styles.fullSpan}`}>
              <label className={styles.label}>PO Notes</label>
              <textarea
                className={styles.textarea}
                value={orderHeader.notes}
                onChange={(event) => updateOrderHeader('notes', event.target.value)}
                placeholder="General notes for this material PO."
              />
            </div>
          </div>
        </section>

        {mode === 'existing-po' ? (
          <section className={styles.sectionCard}>
            <div className={styles.field}>
              <label className={styles.label}>PO Number</label>
              <select className={styles.select} value={poFilter} onChange={(event) => setPoFilter(event.target.value)}>
                <option value="">Select initiated CMT PO</option>
                {poOptions.map((po) => (
                  <option key={po.poId} value={po.poId}>
                    {po.poId}
                  </option>
                ))}
              </select>
            </div>
          </section>
        ) : null}

        <section className={styles.materialWorkflow}>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>{mode === 'existing-po' ? 'Generated Materials' : 'Free Material Input'}</h2>
              </div>
              {mode === 'existing-po' ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleMoveSelectedRequirements}
                  disabled={!selectedRequirementIds.length}
                  title="Move selected materials"
                  aria-label="Move selected materials"
                >
                  →
                </button>
              ) : null}
            </div>

            {loading ? (
              <div className={styles.emptyState}>Loading MRP workspace...</div>
            ) : mode === 'existing-po' ? (
              !poFilter ? (
                <div className={styles.emptyState}>Choose one initiated CMT PO first.</div>
              ) : filteredRequirements.length ? (
                <div className={styles.linesTableWrap}>
                  <table className={styles.linesTable}>
                    <thead>
                      <tr>
                        <th style={{ width: '48px' }}>Pick</th>
                        <th>Product</th>
                        <th>Material</th>
                        <th>Variant</th>
                        <th>Qty Needed</th>
                        <th>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequirements.map((row) => {
                        const isAssigned = assignedRequirementIds.has(row.id)
                        const isChecked = selectedRequirementIds.includes(row.id)

                        return (
                          <tr key={row.id} className={isAssigned ? styles.materialRowAssigned : ''}>
                            <td>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isAssigned}
                                onChange={() => toggleRequirementSelection(row.id)}
                              />
                            </td>
                            <td>
                              <div className={styles.materialCellTitle}>{row.productName || row.skuInduk || '-'}</div>
                              <div className={styles.materialCellMeta}>{row.poId}</div>
                            </td>
                            <td>{row.materialNameSnapshot || '-'}</td>
                            <td>{[row.sizeVariant, row.colorVariant].filter(Boolean).join(' / ') || '-'}</td>
                            <td>{formatQty(row.finalQty)}</td>
                            <td>{row.unit || '-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.emptyState}>No generated material lines found for this PO.</div>
              )
            ) : (
              <div className={styles.freeMaterialGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Material</label>
                  <select
                    className={styles.select}
                    value={freeMaterialDraft.materialId}
                    onChange={(event) => setFreeMaterialDraft((current) => ({ ...current, materialId: event.target.value }))}
                  >
                    <option value="">Select material</option>
                    {materialOptions.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.materialName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Qty</label>
                  <input
                    className={styles.input}
                    value={freeMaterialDraft.qty}
                    onChange={(event) => setFreeMaterialDraft((current) => ({ ...current, qty: event.target.value }))}
                    placeholder="0"
                    inputMode="decimal"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Unit</label>
                  <input
                    className={styles.inputReadonly}
                    value={materialOptions.find((item) => item.id === freeMaterialDraft.materialId)?.unit || '-'}
                    readOnly
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>&nbsp;</label>
                  <button type="button" className={styles.primaryButton} onClick={handleAddFreeMaterial}>
                    Add to Order
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Material PO Draft</h2>
                <p className={styles.sectionCopy}>Keep adding materials from multiple CMT PO sources or from free material input into one purchasing draft.</p>
              </div>

              <div className={styles.compactStats}>
                <span className={styles.miniStatCard}>
                  Items <strong>{formatQty(orderDraftSummary.lines)}</strong>
                </span>
                <span className={styles.miniStatCard}>
                  Total Qty <strong>{formatQty(orderDraftSummary.totalQty)}</strong>
                </span>
                <button type="button" className={styles.secondaryButton} onClick={handleResetDraft}>
                  Reset Draft
                </button>
              </div>
            </div>

            {orderLines.length ? (
              <div className={styles.orderDraftList}>
                {orderLines.map((line) => (
                  <article key={line.key} className={styles.orderDraftCard}>
                    <div className={styles.orderDraftHeader}>
                      <div className={styles.orderDraftCopy}>
                        <strong className={styles.orderDraftTitle}>{line.materialName || '-'}</strong>
                        <span className={styles.orderDraftMeta}>
                          {[line.sizeVariant, line.colorVariant].filter(Boolean).join(' / ') || 'No Variant'} - {line.unit || '-'}
                        </span>
                      </div>

                      <div className={styles.orderDraftActions}>
                        <span className={styles.orderDraftQty}>{formatQty(line.totalQty)}</span>
                        <button type="button" className={styles.ghostButton} onClick={() => moveOrderLine(line.key, 'up')} title="Move up" aria-label="Move line up">
                          ↑
                        </button>
                        <button type="button" className={styles.ghostButton} onClick={() => moveOrderLine(line.key, 'down')} title="Move down" aria-label="Move line down">
                          ↓
                        </button>
                        <button type="button" className={styles.ghostButton} onClick={() => handleRemoveOrderLine(line.key)}>
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className={styles.orderDraftHoverWrap}>
                      <span className={styles.orderDraftSourceBadge}>{line.sources.length} source(s)</span>
                      <div className={styles.orderDraftTooltip}>
                        <strong>Source Breakdown</strong>
                        <div className={styles.orderDraftTooltipList}>
                          {line.sources.map((source) => (
                            <div key={source.id} className={styles.orderDraftTooltipRow}>
                              <span>{source.label}</span>
                              <span>{formatQty(source.qty)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className={styles.orderDraftPriceRow}>
                      <div className={styles.field}>
                        <label className={styles.label}>Price</label>
                        <input
                          className={styles.input}
                          value={line.price}
                          onChange={(event) => handleUpdateOrderLinePrice(line.key, event.target.value)}
                          placeholder="0"
                          inputMode="decimal"
                        />
                      </div>
                      <div className={styles.orderDraftAmountCard}>
                        <span className={styles.orderDraftAmountLabel}>Amount</span>
                        <strong className={styles.orderDraftAmountValue}>{formatCurrency(toNumber(line.price) * line.totalQty)}</strong>
                      </div>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Purchase Notes</label>
                      <textarea
                        className={styles.textarea}
                        value={line.notes}
                        onChange={(event) => handleUpdateOrderLineNotes(line.key, event.target.value)}
                        placeholder="Notes for this material purchase line."
                      />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>No material has been moved into the order draft yet.</div>
            )}
          </section>
        </section>
      </section>
    </div>
  )
}
