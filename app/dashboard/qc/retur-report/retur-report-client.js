'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'
import reportStyles from './retur-report.module.css'

function formatDateDisplay(value) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function getModelLabel(item) {
  const variantLabel = item.variant_name || item.variant_label || item.variant_code || item.model_color || ''
  return variantLabel ? `${item.model_name} - ${variantLabel}` : item.model_name
}

function getBrandLabel(item) {
  return item.brands?.brand_name || '-'
}

function getCategoryLabel(item) {
  return item.categories?.full_name || item.categories?.category_name || '-'
}

function getStatusLabel(value) {
  return String(value || 'waiting').replaceAll('_', ' ').toUpperCase()
}

function hasKoliSequence(row) {
  return row.koli_sequence !== null && row.koli_sequence !== undefined && row.koli_sequence !== ''
}

function isPreparationSource(row) {
  return ['inbound', 'Packing List', 'packing_list'].includes(String(row.source_phase || ''))
}

function cloneReturnPayload(row, qty, koliSequence = null) {
  return {
    inbound_id: row.inbound_id,
    source_phase: row.source_phase,
    koli_sequence: koliSequence,
    brand_id: row.brand_id || null,
    category_id: row.category_id || null,
    model_name: row.model_name || null,
    variant_name: row.variant_name || row.model_color || null,
    ...(Object.prototype.hasOwnProperty.call(row, 'variant_label') ? { variant_label: row.variant_label || null } : {}),
    ...(Object.prototype.hasOwnProperty.call(row, 'variant_code') ? { variant_code: row.variant_code || null } : {}),
    qty,
    grade: row.grade || null,
    pic_name: row.pic_name || null,
    return_reason: row.return_reason || null,
    status: row.status || 'waiting',
    is_adjustment: Boolean(row.is_adjustment),
    adjustment_type: row.adjustment_type || null,
    updated_at: new Date().toISOString(),
  }
}

export default function ReturReportClient({ rows, canAdd = false }) {
  const router = useRouter()
  const supabase = createClient()
  const [selectedIds, setSelectedIds] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSupplierConfirmOpen, setIsSupplierConfirmOpen] = useState(false)
  const [shippingMethod, setShippingMethod] = useState('')
  const [modalError, setModalError] = useState('')
  const [isPrinting, setIsPrinting] = useState(false)
  const [paymentInfoOpen, setPaymentInfoOpen] = useState(false)
  const [printError, setPrintError] = useState('')
  const [activeReturnTab, setActiveReturnTab] = useState('preparation')
  const [grnFilter, setGrnFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [phaseFilter, setPhaseFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [prepQtyById, setPrepQtyById] = useState({})
  const [currentReturnKoliItems, setCurrentReturnKoliItems] = useState([])
  const [preparationError, setPreparationError] = useState('')
  const [preparationSuccess, setPreparationSuccess] = useState('')
  const [isPostingPreparation, setIsPostingPreparation] = useState(false)

  const arrangementRows = useMemo(
    () => rows.filter((row) => hasKoliSequence(row)),
    [rows]
  )
  const preparationRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          isPreparationSource(row) &&
          !hasKoliSequence(row) &&
          String(row.status || 'waiting').toLowerCase() !== 'completed' &&
          Number(row.qty || 0) > 0
      ),
    [rows]
  )
  const filterSourceRows = activeReturnTab === 'preparation' ? preparationRows : arrangementRows

  const grnOptions = useMemo(
    () => Array.from(new Set(filterSourceRows.map((row) => row.inbound?.grn_number).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [filterSourceRows]
  )
  const supplierOptions = useMemo(
    () => Array.from(new Set(filterSourceRows.map((row) => row.inbound?.suppliers?.supplier_name).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [filterSourceRows]
  )
  const statusOptions = useMemo(
    () => Array.from(new Set(filterSourceRows.map((row) => row.status || 'waiting').filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [filterSourceRows]
  )
  const phaseOptions = useMemo(
    () => Array.from(new Set(filterSourceRows.map((row) => row.source_phase).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [filterSourceRows]
  )
  const brandOptions = useMemo(
    () =>
      Array.from(
        filterSourceRows.reduce((options, row) => {
          if (row.brand_id && getBrandLabel(row) !== '-') {
            options.set(String(row.brand_id), getBrandLabel(row))
          }
          return options
        }, new Map())
      )
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [filterSourceRows]
  )
  const categoryOptions = useMemo(
    () =>
      Array.from(
        filterSourceRows.reduce((options, row) => {
          if (row.category_id && getCategoryLabel(row) !== '-') {
            options.set(String(row.category_id), getCategoryLabel(row))
          }
          return options
        }, new Map())
      )
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [filterSourceRows]
  )
  const modelOptions = useMemo(
    () => Array.from(new Set(filterSourceRows.map((row) => getModelLabel(row)).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [filterSourceRows]
  )
  const gradeOptions = useMemo(
    () => Array.from(new Set(filterSourceRows.map((row) => row.grade).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b))),
    [filterSourceRows]
  )
  const filteredRows = useMemo(
    () =>
      arrangementRows.filter((row) => {
        const matchesGrn = !grnFilter || row.inbound?.grn_number === grnFilter
        const matchesSupplier = !supplierFilter || row.inbound?.suppliers?.supplier_name === supplierFilter
        const matchesStatus = !statusFilter || String(row.status || 'waiting') === statusFilter
        const matchesPhase = !phaseFilter || String(row.source_phase || '') === phaseFilter
        const matchesBrand = !brandFilter || String(row.brand_id || '') === brandFilter
        const matchesCategory = !categoryFilter || String(row.category_id || '') === categoryFilter
        const matchesModel = !modelFilter || getModelLabel(row) === modelFilter
        const matchesGrade = !gradeFilter || String(row.grade || '') === gradeFilter
        return matchesGrn && matchesSupplier && matchesStatus && matchesPhase && matchesBrand && matchesCategory && matchesModel && matchesGrade
      }),
    [arrangementRows, brandFilter, categoryFilter, gradeFilter, grnFilter, modelFilter, phaseFilter, statusFilter, supplierFilter]
  )
  const filteredPreparationRows = useMemo(
    () =>
      preparationRows.filter((row) => {
        const matchesGrn = !grnFilter || row.inbound?.grn_number === grnFilter
        const matchesSupplier = !supplierFilter || row.inbound?.suppliers?.supplier_name === supplierFilter
        const matchesStatus = !statusFilter || String(row.status || 'waiting') === statusFilter
        const matchesPhase = !phaseFilter || String(row.source_phase || '') === phaseFilter
        const matchesBrand = !brandFilter || String(row.brand_id || '') === brandFilter
        const matchesCategory = !categoryFilter || String(row.category_id || '') === categoryFilter
        const matchesModel = !modelFilter || getModelLabel(row) === modelFilter
        const matchesGrade = !gradeFilter || String(row.grade || '') === gradeFilter
        return matchesGrn && matchesSupplier && matchesStatus && matchesPhase && matchesBrand && matchesCategory && matchesModel && matchesGrade
      }),
    [brandFilter, categoryFilter, gradeFilter, grnFilter, modelFilter, phaseFilter, preparationRows, statusFilter, supplierFilter]
  )
  const selectableRows = useMemo(
    () => filteredRows.filter((row) => String(row.status || 'waiting').toLowerCase() !== 'completed'),
    [filteredRows]
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
  const paymentLabel = selectedInbound?.payment_on_site ? 'Paid by Receiver' : 'Paid by Us'

  const selectedReturnCardGroups = useMemo(() => {
    const grouped = new Map()

    selectedRows.forEach((row) => {
      const hasKoli = row.koli_sequence !== null && row.koli_sequence !== undefined && row.koli_sequence !== ''
      const key = hasKoli
        ? `${row.inbound_id || 'no-inbound'}::${row.source_phase || 'no-phase'}::${row.koli_sequence}`
        : `row::${row.id}`
      const current = grouped.get(key) || {
        key,
        inbound: row.inbound,
        inbound_id: row.inbound_id,
        source_phase: row.source_phase,
        koli_sequence: hasKoli ? row.koli_sequence : null,
        created_at: row.created_at,
        items: [],
        total_qty: 0,
      }

      current.items.push(row)
      current.total_qty += Number(row.qty || 0)
      if (!current.created_at || (row.created_at && new Date(row.created_at) < new Date(current.created_at))) {
        current.created_at = row.created_at
      }
      grouped.set(key, current)
    })

    return Array.from(grouped.values()).sort((a, b) => {
      const grnSort = String(a.inbound?.grn_number || '').localeCompare(String(b.inbound?.grn_number || ''))
      if (grnSort) return grnSort
      return Number(a.koli_sequence || 0) - Number(b.koli_sequence || 0)
    })
  }, [selectedRows])

  function updateFilter(setFilter, value) {
    setFilter(value)
    setSelectedIds([])
  }

  function resetFilters() {
    setGrnFilter('')
    setSupplierFilter('')
    setStatusFilter('')
    setPhaseFilter('')
    setBrandFilter('')
    setCategoryFilter('')
    setModelFilter('')
    setGradeFilter('')
    setSelectedIds([])
  }

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

  function getCurrentAddedQty(rowId) {
    return currentReturnKoliItems
      .filter((item) => Number(item.sourceRow.id) === Number(rowId))
      .reduce((sum, item) => sum + Number(item.qty || 0), 0)
  }

  function addPreparationRowToKoli(row) {
    setPreparationError('')
    setPreparationSuccess('')

    const qty = Number(prepQtyById[row.id] || 0)
    const availableQty = Number(row.qty || 0)
    const alreadyAddedQty = getCurrentAddedQty(row.id)

    if (!qty || qty <= 0) {
      setPreparationError('Return qty must be filled before adding to Koli.')
      return
    }

    if (qty + alreadyAddedQty > availableQty) {
      setPreparationError('Return qty cannot exceed the available return qty.')
      return
    }

    if (
      currentReturnKoliItems.length &&
      currentReturnKoliItems.some((item) => Number(item.sourceRow.inbound_id || 0) !== Number(row.inbound_id || 0))
    ) {
      setPreparationError('One return Koli can only contain rows from the same GRN.')
      return
    }

    setCurrentReturnKoliItems((current) => {
      const existing = current.find((item) => Number(item.sourceRow.id) === Number(row.id))
      if (existing) {
        return current.map((item) =>
          Number(item.sourceRow.id) === Number(row.id)
            ? { ...item, qty: Number(item.qty || 0) + qty }
            : item
        )
      }

      return [
        ...current,
        {
          tempId: `${row.id}-${Date.now()}`,
          sourceRow: row,
          qty,
        },
      ]
    })
    setPrepQtyById((current) => ({ ...current, [row.id]: '' }))
    setPreparationSuccess('Return row added to current Koli.')
  }

  function removePreparationItem(tempId) {
    setCurrentReturnKoliItems((current) => current.filter((item) => item.tempId !== tempId))
  }

  function clearPreparationKoli() {
    if (!currentReturnKoliItems.length) return
    const shouldClear = window.confirm('Clear all rows from the current return Koli?')
    if (!shouldClear) return
    setCurrentReturnKoliItems([])
    setPreparationError('')
    setPreparationSuccess('')
  }

  async function postPreparationKoli() {
    if (!currentReturnKoliItems.length) {
      setPreparationError('Add at least one return row to Koli first.')
      return
    }

    const inboundId = currentReturnKoliItems[0]?.sourceRow?.inbound_id
    if (!inboundId) {
      setPreparationError('Return Koli must have a valid GRN before posting.')
      return
    }

    const invalidItem = currentReturnKoliItems.find((item) => {
      const sourceQty = Number(item.sourceRow.qty || 0)
      const postQty = Number(item.qty || 0)
      return !postQty || postQty <= 0 || postQty > sourceQty
    })
    if (invalidItem) {
      setPreparationError('Every return qty must be greater than zero and cannot exceed available qty.')
      return
    }

    const shouldPost = window.confirm(
      `Post this return Koli with ${currentReturnKoliItems.length} row${currentReturnKoliItems.length > 1 ? 's' : ''}?`
    )
    if (!shouldPost) return

    setIsPostingPreparation(true)
    setPreparationError('')
    setPreparationSuccess('')

    const { data: latestRows, error: sequenceError } = await supabase
      .from('warehouse_returns')
      .select('koli_sequence')
      .eq('inbound_id', inboundId)

    if (sequenceError) {
      setPreparationError(sequenceError.message)
      setIsPostingPreparation(false)
      return
    }

    const assignedKoliSequence =
      (latestRows || []).reduce((max, row) => Math.max(max, Number(row.koli_sequence || 0)), 0) + 1

    for (const item of currentReturnKoliItems) {
      const sourceRow = item.sourceRow
      const sourceQty = Number(sourceRow.qty || 0)
      const postQty = Number(item.qty || 0)
      const remainingQty = sourceQty - postQty
      const postedPayload = cloneReturnPayload(sourceRow, postQty, assignedKoliSequence)

      const { error: updateError } = await supabase
        .from('warehouse_returns')
        .update(postedPayload)
        .eq('id', sourceRow.id)

      if (updateError) {
        setPreparationError(updateError.message)
        setIsPostingPreparation(false)
        return
      }

      if (remainingQty > 0) {
        const remainingPayload = cloneReturnPayload(sourceRow, remainingQty, null)
        const { error: insertError } = await supabase.from('warehouse_returns').insert([remainingPayload])
        if (insertError) {
          setPreparationError(insertError.message)
          setIsPostingPreparation(false)
          return
        }
      }
    }

    setCurrentReturnKoliItems([])
    setPreparationSuccess(`Return Koli ${assignedKoliSequence} posted to Return Arrangement.`)
    setIsPostingPreparation(false)
    setActiveReturnTab('arrangement')
    router.refresh()
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

  function buildReturnCardHtml(group) {
    const grnNumber = group.inbound?.grn_number || '-'
    const supplierName = group.inbound?.suppliers?.supplier_name || '-'
    const rowLabel = group.koli_sequence ? `Koli ${group.koli_sequence}` : `Row ${group.items[0]?.id || '-'}`
    const returnDate = formatDateDisplay(group.created_at || group.inbound?.inbound_date)
    const phaseLabel = String(group.source_phase || group.items[0]?.source_phase || '-').toUpperCase()
    const rowsHtml = group.items
      .map((item) => {
        const brandName = item.brands?.brand_name || '-'
        const categoryName = item.categories?.full_name || item.categories?.category_name || '-'
        const modelLabel = getModelLabel(item) || '-'

        return `
          <tr>
            <td>${escapeHtml(brandName)}</td>
            <td>${escapeHtml(categoryName)}</td>
            <td>${escapeHtml(modelLabel)}</td>
            <td class="center">${escapeHtml(item.grade || '-')}</td>
            <td class="qty">${escapeHtml(item.qty || 0)}</td>
          </tr>`
      })
      .join('')

    return `
    <div class="card">
      <h1>Return Card</h1>
      <div class="row"><div class="label">Date</div><div class="value">${escapeHtml(returnDate)}</div></div>
      <div class="row"><div class="label">No GRN</div><div class="value">${escapeHtml(grnNumber)}</div></div>
      <div class="row"><div class="label">No Koli</div><div class="value">${escapeHtml(rowLabel)}</div></div>
      <div class="row"><div class="label">Supplier</div><div class="value">${escapeHtml(supplierName)}</div></div>
      <table>
        <thead>
          <tr>
            <th>Brand</th>
            <th>Category</th>
            <th>Model - Variant</th>
            <th>Grade</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div class="qtyBox">
        <div class="qtyLabel">Return Qty</div>
        <div class="qtyValue">${escapeHtml(group.total_qty || 0)}</div>
      </div>
      <div class="row footerRow"><div class="label">Phase</div><div class="value">${escapeHtml(phaseLabel)}</div></div>
    </div>`
  }

  function handlePrintReturnCards() {
    if (!selectedRows.length) {
      setPrintError('Checklist at least one return row first.')
      return
    }

    setPrintError('')

    const printWindow = window.open('', '_blank', 'width=720,height=820')

    if (!printWindow) {
      setPrintError('Popup print diblokir browser. Izinkan pop-up lalu coba lagi.')
      return
    }

    const printHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Return Card</title>
    <style>
      @page { size: A6 portrait; margin: 8mm; }
      body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
      .card { border: 2px solid #111827; border-radius: 16px; padding: 18px; width: 100%; box-sizing: border-box; break-after: page; page-break-after: always; }
      .card:last-child { break-after: auto; page-break-after: auto; }
      h1 { margin: 0 0 16px; font-size: 26px; text-align: center; }
      .row { display: grid; grid-template-columns: 92px 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid #e5e7eb; align-items: start; }
      .row:last-child { border-bottom: none; }
      .label { font-weight: 700; font-size: 12px; }
      .value { font-weight: 500; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin: 18px 0; }
      th, td { border: 1px solid #d1d5db; padding: 7px; font-size: 10px; vertical-align: middle; }
      th { background: #f9fafb; text-align: left; }
      .center { text-align: center; }
      .qty { text-align: center; font-weight: 800; }
      .qtyBox { margin: 18px 0; padding: 16px; border-radius: 16px; border: 2px solid #111827; text-align: center; }
      .qtyLabel { font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
      .qtyValue { margin-top: 6px; font-size: 54px; line-height: 1; font-weight: 800; }
      .footerRow .label, .footerRow .value { font-size: 11px; }
    </style>
  </head>
  <body>
    ${selectedReturnCardGroups.map((group) => buildReturnCardHtml(group)).join('')}
    <script>window.onload = function () { window.print(); };</script>
  </body>
</html>`

    printWindow.document.open()
    printWindow.document.write(printHtml)
    printWindow.document.close()
  }

  async function handlePrintSj() {
    if (!selectedRows.length || selectedInboundIds.length !== 1) {
      setModalError('Pilih row retur dari satu GRN yang sama dulu.')
      return
    }

    if (!shippingMethod.trim()) {
      setModalError('Fill in the shipping method first.')
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
          <title>Return SJ - ${grnNumber}</title>
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
          <h1>Return SJ</h1>
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
              <span class="meta-label">Shipping Method</span>
              <span class="meta-value">${shippingMethod.trim()}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Mode-Variant</th>
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

  const currentPreparationQty = currentReturnKoliItems.reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const currentPreparationGrn = currentReturnKoliItems[0]?.sourceRow?.inbound?.grn_number || '-'

  return (
    <>
      <div className={reportStyles.subPageTabsPage}>
        <div className={reportStyles.subPageTabsShell}>
          <div className={reportStyles.subPageTabsBar} role="tablist" aria-label="Regular return workflow">
            <button
              type="button"
              role="tab"
              aria-selected={activeReturnTab === 'preparation'}
              className={`${reportStyles.subPageTabLink} ${activeReturnTab === 'preparation' ? reportStyles.subPageTabLinkActive : ''}`.trim()}
              onClick={() => {
                setActiveReturnTab('preparation')
                resetFilters()
              }}
            >
              <span className={reportStyles.subPageTabLabel}>Return Preparation</span>
              <span className={reportStyles.subPageTabUnderline} />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeReturnTab === 'arrangement'}
              className={`${reportStyles.subPageTabLink} ${activeReturnTab === 'arrangement' ? reportStyles.subPageTabLinkActive : ''}`.trim()}
              onClick={() => {
                setActiveReturnTab('arrangement')
                resetFilters()
              }}
            >
              <span className={reportStyles.subPageTabLabel}>Return Arrangement</span>
              <span className={reportStyles.subPageTabUnderline} />
            </button>
          </div>
        </div>

        <div className={reportStyles.subPageTabsPanel}>
          {activeReturnTab === 'preparation' ? (
            <section className={`${reportStyles.card} ${reportStyles.subPageCard}`.trim()}>
              <div className={reportStyles.sectionHeader}>
                <div>
                  <p className={reportStyles.eyebrow}>Reguler</p>
                  <h2 className={reportStyles.sectionTitle}>Return Preparation</h2>
                  <p>Prepare Inbound and Packing List returns into QC return Koli before arrangement.</p>
                </div>

                <div className={reportStyles.regularHeaderActions}>
                  <div className={reportStyles.regularSelectedTotal}>
                    <span>Current Koli</span>
                    <strong>{currentPreparationQty}</strong>
                  </div>
                  <button type="button" className={reportStyles.secondaryButton} onClick={clearPreparationKoli} disabled={!currentReturnKoliItems.length || isPostingPreparation}>
                    Clear
                  </button>
                  <button type="button" className={reportStyles.primaryButton} onClick={postPreparationKoli} disabled={!canAdd || !currentReturnKoliItems.length || isPostingPreparation}>
                    {isPostingPreparation ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>

              {grnOptions.length || phaseOptions.length || brandOptions.length || modelOptions.length ? (
                <div className={reportStyles.filterGrid}>
                  {grnOptions.length ? (
                    <div className={reportStyles.field}>
                      <label htmlFor="qc-retur-prep-grn-filter">GRN Number</label>
                      <select id="qc-retur-prep-grn-filter" className={reportStyles.input} value={grnFilter} onChange={(event) => updateFilter(setGrnFilter, event.target.value)}>
                        <option value="">All GRN</option>
                        {grnOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </div>
                  ) : null}
                  {phaseOptions.length ? (
                    <div className={reportStyles.field}>
                      <label htmlFor="qc-retur-prep-phase-filter">Phase</label>
                      <select id="qc-retur-prep-phase-filter" className={reportStyles.input} value={phaseFilter} onChange={(event) => updateFilter(setPhaseFilter, event.target.value)}>
                        <option value="">All Phase</option>
                        {phaseOptions.map((item) => <option key={item} value={item}>{String(item).toUpperCase()}</option>)}
                      </select>
                    </div>
                  ) : null}
                  {brandOptions.length ? (
                    <div className={reportStyles.field}>
                      <label htmlFor="qc-retur-prep-brand-filter">Brand</label>
                      <select id="qc-retur-prep-brand-filter" className={reportStyles.input} value={brandFilter} onChange={(event) => updateFilter(setBrandFilter, event.target.value)}>
                        <option value="">All Brand</option>
                        {brandOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </div>
                  ) : null}
                  {modelOptions.length ? (
                    <div className={reportStyles.field}>
                      <label htmlFor="qc-retur-prep-model-filter">Model-Variant</label>
                      <select id="qc-retur-prep-model-filter" className={reportStyles.input} value={modelFilter} onChange={(event) => updateFilter(setModelFilter, event.target.value)}>
                        <option value="">All Model-Variant</option>
                        {modelOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {preparationError ? <p className={reportStyles.error}>{preparationError}</p> : null}
              {preparationSuccess ? <p className={reportStyles.notice}>{preparationSuccess}</p> : null}

              {currentReturnKoliItems.length ? (
                <div className={reportStyles.preparationBasket}>
                  <div className={reportStyles.batchHeader}>
                    <div>
                      <strong>Current Return Koli</strong>
                      <p>GRN {currentPreparationGrn} / Total Qty {currentPreparationQty}</p>
                    </div>
                  </div>
                  <div className={reportStyles.tableWrap}>
                    <table className={reportStyles.table}>
                      <thead>
                        <tr>
                          <th>Phase</th>
                          <th>Brand</th>
                          <th>Model-Variant</th>
                          <th>Grade</th>
                          <th className={reportStyles.centerNumberCell}>Qty</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentReturnKoliItems.map((item) => (
                          <tr key={item.tempId}>
                            <td>{String(item.sourceRow.source_phase || '-').toUpperCase()}</td>
                            <td>{getBrandLabel(item.sourceRow)}</td>
                            <td>{getModelLabel(item.sourceRow)}</td>
                            <td>{item.sourceRow.grade || '-'}</td>
                            <td className={reportStyles.centerNumberCell}>{item.qty}</td>
                            <td>
                              <button type="button" className={reportStyles.secondaryButton} onClick={() => removePreparationItem(item.tempId)} disabled={isPostingPreparation}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {!filteredPreparationRows.length ? (
                <p className={reportStyles.empty}>
                  {preparationRows.length ? 'No preparation rows found for this filter.' : 'No inbound or Packing List returns are waiting for preparation.'}
                </p>
              ) : (
                <div className={reportStyles.tableWrap}>
                  <table className={reportStyles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>GRN</th>
                        <th>Phase</th>
                        <th>Brand</th>
                        <th>Category</th>
                        <th>Model-Variant</th>
                        <th>Grade</th>
                        <th className={reportStyles.centerNumberCell}>Available Qty</th>
                        <th className={reportStyles.centerNumberCell}>Return Qty</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPreparationRows.map((row) => {
                        const alreadyAddedQty = getCurrentAddedQty(row.id)
                        const remainingQty = Math.max(0, Number(row.qty || 0) - alreadyAddedQty)
                        return (
                          <tr key={row.id}>
                            <td>{formatDateDisplay(row.created_at || row.inbound?.inbound_date)}</td>
                            <td>{row.inbound?.grn_number || '-'}</td>
                            <td>{String(row.source_phase || '-').toUpperCase()}</td>
                            <td>{getBrandLabel(row)}</td>
                            <td>{getCategoryLabel(row)}</td>
                            <td>{getModelLabel(row)}</td>
                            <td>{row.grade || '-'}</td>
                            <td className={reportStyles.centerNumberCell}>{remainingQty}</td>
                            <td className={reportStyles.centerNumberCell}>
                              <input
                                className={reportStyles.qtyInput}
                                type="number"
                                min="1"
                                max={remainingQty}
                                value={prepQtyById[row.id] || ''}
                                onChange={(event) => setPrepQtyById((current) => ({ ...current, [row.id]: event.target.value }))}
                                disabled={remainingQty <= 0 || isPostingPreparation}
                                aria-label={`Return qty for ${getModelLabel(row)}`}
                              />
                            </td>
                            <td>
                              <button type="button" className={reportStyles.secondaryButton} onClick={() => addPreparationRowToKoli(row)} disabled={remainingQty <= 0 || isPostingPreparation}>
                                Add to Koli
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {activeReturnTab === 'arrangement' ? (
    <section className={reportStyles.regularArrangementPanel}>
      <div className={reportStyles.sectionHeader}>
        <div>
          <p className={reportStyles.eyebrow}>Reguler</p>
          <h2 className={reportStyles.sectionTitle}>Return Arrangement</h2>
        </div>

        <div className={reportStyles.regularHeaderActions}>
          <div className={reportStyles.regularSelectedTotal}>
            <span>Selected Total Qty</span>
            <strong>{totalSelectedQty}</strong>
          </div>
          <div className={reportStyles.regularSelectedTotal}>
            <span>Selected Koli</span>
            <strong>{selectedReturnCardGroups.length}</strong>
          </div>
          <button type="button" className={reportStyles.secondaryButton} onClick={handlePrintReturnCards} disabled={!selectedRows.length}>
            Print Return Card
          </button>
          <button type="button" className={reportStyles.primaryButton} onClick={openReturModal} disabled={!canAdd || !selectedRows.length}>
            Return
          </button>
        </div>
      </div>

      {grnOptions.length || supplierOptions.length || statusOptions.length || phaseOptions.length || brandOptions.length || categoryOptions.length || modelOptions.length || gradeOptions.length ? (
      <div className={reportStyles.filterGrid}>
        <div className={reportStyles.field}>
          <label htmlFor="qc-retur-report-grn-filter">GRN Number</label>
          <select
            id="qc-retur-report-grn-filter"
            className={reportStyles.input}
            value={grnFilter}
            onChange={(event) => updateFilter(setGrnFilter, event.target.value)}
          >
            <option value="">All GRN</option>
            {grnOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className={reportStyles.field}>
          <label htmlFor="qc-retur-report-supplier-filter">Supplier</label>
          <select
            id="qc-retur-report-supplier-filter"
            className={reportStyles.input}
            value={supplierFilter}
            onChange={(event) => updateFilter(setSupplierFilter, event.target.value)}
          >
            <option value="">All Supplier</option>
            {supplierOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className={reportStyles.field}>
          <label htmlFor="qc-retur-report-status-filter">Status</label>
          <select
            id="qc-retur-report-status-filter"
            className={reportStyles.input}
            value={statusFilter}
            onChange={(event) => updateFilter(setStatusFilter, event.target.value)}
          >
            <option value="">All Status</option>
            {statusOptions.map((item) => (
              <option key={item} value={item}>{getStatusLabel(item)}</option>
            ))}
          </select>
        </div>

        <div className={reportStyles.field}>
          <label htmlFor="qc-retur-report-phase-filter">Phase</label>
          <select
            id="qc-retur-report-phase-filter"
            className={reportStyles.input}
            value={phaseFilter}
            onChange={(event) => updateFilter(setPhaseFilter, event.target.value)}
          >
            <option value="">All Phase</option>
            {phaseOptions.map((item) => (
              <option key={item} value={item}>{String(item).toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div className={reportStyles.field}>
          <label htmlFor="qc-retur-report-brand-filter">Brand</label>
          <select
            id="qc-retur-report-brand-filter"
            className={reportStyles.input}
            value={brandFilter}
            onChange={(event) => updateFilter(setBrandFilter, event.target.value)}
          >
            <option value="">All Brand</option>
            {brandOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>

        <div className={reportStyles.field}>
          <label htmlFor="qc-retur-report-category-filter">Category</label>
          <select
            id="qc-retur-report-category-filter"
            className={reportStyles.input}
            value={categoryFilter}
            onChange={(event) => updateFilter(setCategoryFilter, event.target.value)}
          >
            <option value="">All Category</option>
            {categoryOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>

        <div className={reportStyles.field}>
          <label htmlFor="qc-retur-report-model-filter">Model-Variant</label>
          <select
            id="qc-retur-report-model-filter"
            className={reportStyles.input}
            value={modelFilter}
            onChange={(event) => updateFilter(setModelFilter, event.target.value)}
          >
            <option value="">All Model-Variant</option>
            {modelOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className={reportStyles.field}>
          <label htmlFor="qc-retur-report-grade-filter">Grade</label>
          <select
            id="qc-retur-report-grade-filter"
            className={reportStyles.input}
            value={gradeFilter}
            onChange={(event) => updateFilter(setGradeFilter, event.target.value)}
          >
            <option value="">All Grade</option>
            {gradeOptions.map((item) => (
              <option key={item} value={item}>Grade {item}</option>
            ))}
          </select>
        </div>
      </div>
      ) : null}

      {printError ? <p className={reportStyles.error}>{printError}</p> : null}

      {!filteredRows.length ? (
        <p className={reportStyles.empty}>
          {arrangementRows.length ? 'No return rows found for this filter.' : 'No arranged return Koli yet.'}
        </p>
      ) : (
      <div className={reportStyles.tableWrap}>
        <table className={reportStyles.table}>
          <thead>
            <tr>
              <th aria-label="Select">
                <input
                  className={reportStyles.checkbox}
                  type="checkbox"
                  checked={allSelectableChecked}
                  onChange={toggleAll}
                  disabled={!selectableRows.length}
                  aria-label="Select all regular return rows"
                />
              </th>
              <th>Date</th>
              <th>GRN</th>
              <th>Phase</th>
              <th>Supplier</th>
              <th>Brand</th>
              <th>Category</th>
              <th>Mode-Variant</th>
              <th>Grade</th>
              <th>Status</th>
              <th className={reportStyles.centerNumberCell}>Qty</th>
              <th>Koli</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const isCompleted = String(row.status || 'waiting').toLowerCase() === 'completed'
              const isChecked = selectedIds.includes(row.id)

              return (
                <tr key={row.id}>
                  <td>
                    <input className={reportStyles.checkbox} type="checkbox" checked={isChecked} disabled={isCompleted} onChange={() => toggleRow(row.id)} />
                  </td>
                  <td>{formatDateDisplay(row.created_at || row.inbound?.inbound_date)}</td>
                  <td>{row.inbound?.grn_number || '-'}</td>
                  <td>{String(row.source_phase || '-').toUpperCase()}</td>
                  <td>{row.inbound?.suppliers?.supplier_name || '-'}</td>
                  <td>{getBrandLabel(row)}</td>
                  <td>{getCategoryLabel(row)}</td>
                  <td>{getModelLabel(row)}</td>
                  <td>{row.grade || '-'}</td>
                  <td>
                    <span className={reportStyles.badge}>{getStatusLabel(row.status)}</span>
                  </td>
                  <td className={reportStyles.centerNumberCell}>{row.qty || 0}</td>
                  <td>{row.koli_sequence ? `Koli ${row.koli_sequence}` : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

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
                <h2 style={styles.modalTitle}>Return SJ</h2>
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
                    <span style={styles.metaLabelRow}>
                      <span style={styles.metaLabel}>Shipping Payment</span>
                      <button
                        type="button"
                        style={styles.infoButton}
                        onClick={() => setPaymentInfoOpen((current) => !current)}
                        aria-label="Shipping payment info"
                        aria-expanded={paymentInfoOpen}
                      >
                        i
                      </button>
                    </span>
                    <strong style={styles.metaValue}>{paymentLabel}</strong>
                    {paymentInfoOpen ? (
                      <span style={styles.metaInfoText}>
                        Based on inbound payment_on_site: true = Paid by Receiver, false = Paid by Us.
                      </span>
                    ) : null}
                  </div>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Shipping Method</label>
                  <input
                    type="text"
                    value={shippingMethod}
                    onChange={(event) => setShippingMethod(event.target.value.toUpperCase())}
                    style={styles.input}
                    placeholder="E.G. JNE TRUCKING / SUPPLIER PICKUP / INTERNAL COURIER"
                  />
                </div>

                <div style={styles.modalTableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.headRow}>
                        <th style={styles.th}>Brand</th>
                        <th style={styles.th}>Mode-Variant</th>
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
    </section>
          ) : null}
        </div>
      </div>
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
  disabledButton: {
    cursor: 'not-allowed',
    opacity: 0.45,
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
  metaLabelRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  infoButton: {
    width: '18px',
    height: '18px',
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    background: '#fff',
    color: '#475569',
    fontSize: '11px',
    fontWeight: '800',
    lineHeight: 1,
    cursor: 'pointer',
  },
  metaValue: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#111827',
  },
  metaInfoText: {
    marginTop: '2px',
    color: '#64748b',
    fontSize: '12px',
    lineHeight: 1.45,
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
