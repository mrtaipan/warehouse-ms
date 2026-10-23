'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { deliverySupabase } from '@/lib/delivery-supabase'
import { ADMIN_EMAIL } from '@/utils/permissions'
import { createClient } from '@/utils/supabase/browser'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import { EmptyState, Modal, ModuleHeader, StatusMessage } from './delivery-report-client'
import { GROUPS, formatDate, romanMonth, safeNumber, todayIso } from './delivery-report-helpers'
import { stockSizesMatch } from '../storage/stock-sizes'
import { getExternalReplacementLines } from './replacement-stock'
import styles from './delivery-report.module.css'

const TABS = [
  ['registration', 'Return Registration'],
  ['receiving', 'Receiving Confirmation'],
  ['issues', 'Order Issues'],
  ['search', 'Product Search'],
]

const RETURN_FINANCIAL_FIELDS = [
  ['nilai_refund_kompensasi', 'Loss Value'],
  ['total_retur', 'Returned Item Value'],
  ['ongkir_masuk', 'Inbound Shipping Cost'],
  ['ongkir_keluar', 'Outbound Shipping Cost'],
]

const RETURN_FINANCIAL_HELP = {
  nilai_refund_kompensasi: 'Nilai refund atau kompensasi yang kita berikan kepada customer.',
  ongkir_keluar: 'Biaya ekspedisi tambahan untuk pengiriman dari gudang ke customer.',
  ongkir_masuk: 'Biaya ekspedisi tambahan untuk pengiriman dari customer ke gudang.',
  total_retur: 'Nilai yang akan menjadi acuan asuransi pengiriman.',
}

const ORDER_ISSUE_COST_HELP = 'Biaya timbul mencakup biaya harga barang yang direfund/biaya ekspedisi tambahan/biaya kompensasi.'

const RETURN_STATUS_OPTIONS = {
  Pending: {
    className: styles.resolutionStatusPending,
    description: 'The customer has submitted a return, but the item has not been shipped yet.',
    label: 'Pending',
  },
  Sending: {
    className: styles.resolutionStatusSending,
    description: 'The customer has shipped the item to the warehouse.',
    label: 'Sending',
  },
  Cancel: {
    className: styles.resolutionStatusCancel,
    description: 'The return case will not proceed.',
    label: 'Cancel',
  },
}

const ACTIVE_RETURN_STATUSES = new Set(['Pending', 'Sending'])
const PRODUCT_FIELD_SEPARATOR = ' || '

function emptyProductEntry() {
  return { productName: '', size: '', qty: '', sku: '' }
}

function parseProductEntries(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const entry = { ...emptyProductEntry(), raw: line }
      line.replace(/^>\s*/, '').split(PRODUCT_FIELD_SEPARATOR).forEach((field) => {
        const separatorIndex = field.indexOf(':')
        if (separatorIndex < 0) return
        const key = field.slice(0, separatorIndex).trim().toUpperCase()
        const fieldValue = field.slice(separatorIndex + 1).trim()
        if (key === 'SKU') entry.sku = fieldValue
        if (key === 'PRODUCT') entry.productName = fieldValue
        if (key === 'SIZE') entry.size = fieldValue
        if (key === 'QTY') entry.qty = fieldValue
      })

      if (!entry.productName && !entry.sku && !entry.size && !entry.qty) {
        entry.productName = line.replace(/^>\s*/, '')
      }
      return entry
    })
}

function buildReceivingInspectionCases(rows) {
  return rows.map((row) => ({
    caseId: row.id,
    code: row.kode_kejadian || '-',
    group: cleanUpper(row.group_order),
    row,
    lines: parseProductEntries(row.produk_diretur).map((entry, index) => ({
      key: `${row.id}-${index}`,
      sku: cleanUpper(entry.sku),
      skuLocked: Boolean(cleanText(entry.sku)),
      productName: cleanText(entry.productName || entry.raw),
      size: cleanUpper(entry.size),
      sizeLocked: Boolean(cleanText(entry.size)),
      expectedQty: entry.qty ? Number(entry.qty) : 1,
      storedQty: '',
      rejectQty: '',
      lostQty: '',
      rejectReason: '',
      lostReason: '',
      shelvingLocation: '',
      shelvingLocationStatus: '',
    })),
  }))
}

function inspectReceivingDecisions(cases, { requireShelvingLookup = false } = {}) {
  if (!cases.length) return 'Select at least one Sending case.'
  for (const inspectedCase of cases) {
    for (const line of inspectedCase.lines) {
      const quantities = [line.storedQty, line.rejectQty, line.lostQty].map((value) => value === '' ? 0 : Number(value))
      if (!Number.isInteger(line.expectedQty) || line.expectedQty <= 0) {
        return `${inspectedCase.code}: check the return quantity for ${line.productName}.`
      }
      if (quantities.some((value) => !Number.isInteger(value) || value < 0)) {
        return `${inspectedCase.code}: quantities must be whole numbers of zero or more.`
      }
      const totalQty = quantities.reduce((sum, value) => sum + value, 0)
      if (totalQty !== line.expectedQty) {
        return `${inspectedCase.code}: allocate all ${line.expectedQty} unit(s) of ${line.productName}.`
      }
      if (quantities[0] > 0 && !cleanText(line.sku)) {
        return `${inspectedCase.code}: SKU is required to store ${line.productName}.`
      }
      if (quantities[0] > 0 && inspectedCase.group === 'ARKLINE' && !cleanText(line.size)) {
        return `${inspectedCase.code}: size is required to find Arkline shelving for ${line.productName}.`
      }
      if (quantities[0] > 0 && inspectedCase.group === 'ARKLINE' && !arklineSkuKey(line.sku)) {
        return `${inspectedCase.code}: enter a valid Arkline SKU for ${line.productName}.`
      }
      if (quantities[1] > 0 && !cleanText(line.rejectReason)) {
        return `${inspectedCase.code}: enter the reject reason for ${line.productName}.`
      }
      if (quantities[2] > 0 && !cleanText(line.lostReason)) {
        return `${inspectedCase.code}: enter the lost reason for ${line.productName}.`
      }
      if (requireShelvingLookup && quantities[0] > 0 && inspectedCase.group === 'ARKLINE' && !line.shelvingLocationStatus) {
        return `${inspectedCase.code}: review the storage destination for ${line.sku} / ${line.size}.`
      }
    }
  }
  return ''
}

function serializeProductEntries(entries) {
  return (entries || [])
    .map((entry) => {
      if (entry.raw && !entry.productName && !entry.size && !entry.qty && !entry.sku) return entry.raw
      if (entry.raw && !entry.size && !entry.qty && !entry.sku) return entry.raw

      return [
        entry.sku ? `SKU: ${cleanUpper(entry.sku)}` : null,
        entry.productName ? `PRODUCT: ${cleanUpper(entry.productName)}` : null,
        entry.size ? `SIZE: ${cleanUpper(entry.size)}` : null,
        entry.qty ? `QTY: ${String(entry.qty).trim()}` : null,
      ]
        .filter(Boolean)
        .join(PRODUCT_FIELD_SEPARATOR)
    })
    .filter(Boolean)
    .join('\n')
}

function formatProductEntries(value) {
  return parseProductEntries(value)
    .map((entry) => {
      if (entry.raw && !entry.size && !entry.qty && !entry.sku) return entry.raw
      return [
        entry.sku,
        entry.productName,
        entry.size ? `Size ${entry.size}` : null,
        entry.qty ? `Qty ${entry.qty}` : null,
      ]
        .filter(Boolean)
        .join(' | ')
    })
    .join('\n') || '-'
}

function arklineSkuKey(value) {
  return cleanUpper(value).replace(/[^A-Z0-9]/g, '').match(/^ARK\d{2}[A-Z]{3}\d{3}/)?.[0] || ''
}

function formatShelvingLocation(location) {
  if (!location) return ''
  return [location.location_id, location.location_code, location.sub_location].filter(Boolean).join(' / ')
}

function normalizeArklineProductOption(row) {
  const sku = cleanUpper(row?.sku_induk)
  const productName = cleanUpper(row?.nama_produk)
  return {
    isActive: row?.is_active !== false,
    label: sku && productName ? `${sku} | ${productName}` : sku || productName,
    productName,
    sku,
  }
}

function ProductBreakdownEditor({ arklineProducts = [], arklineEnabled = false, label, onChange, required = false, value = '' }) {
  const productInputRef = useRef(null)
  const entries = useMemo(() => parseProductEntries(value), [value])
  const [draft, setDraft] = useState(emptyProductEntry)
  const [error, setError] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [suggestionBounds, setSuggestionBounds] = useState(null)

  const filteredProducts = useMemo(() => {
    if (!arklineEnabled) return []
    const query = cleanUpper(draft.productName)
    if (!query) return []
    return arklineProducts
      .filter((item) => `${item.sku} ${item.productName}`.includes(query))
  }, [arklineEnabled, arklineProducts, draft.productName])

  useEffect(() => {
    if (!suggestionsOpen || !filteredProducts.length) return undefined

    const updateBounds = () => {
      const rect = productInputRef.current?.getBoundingClientRect()
      if (!rect) return
      const spaceBelow = window.innerHeight - rect.bottom - 12
      const placeAbove = spaceBelow < 180 && rect.top > spaceBelow
      const maxHeight = Math.max(120, Math.min(360, placeAbove ? rect.top - 16 : spaceBelow))
      const width = Math.min(Math.max(rect.width, 560), window.innerWidth - 32)
      const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16))
      setSuggestionBounds({ left, top: placeAbove ? rect.top - maxHeight - 6 : rect.bottom + 6, width, maxHeight })
    }

    let animationFrame = window.requestAnimationFrame(updateBounds)
    const scheduleBoundsUpdate = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(updateBounds)
    }
    window.addEventListener('resize', scheduleBoundsUpdate)
    window.addEventListener('scroll', scheduleBoundsUpdate, true)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', scheduleBoundsUpdate)
      window.removeEventListener('scroll', scheduleBoundsUpdate, true)
    }
  }, [filteredProducts.length, suggestionsOpen])

  function addEntry() {
    const productName = cleanUpper(draft.productName)
    const size = cleanUpper(draft.size)
    const qty = Number(draft.qty)
    if (!productName) {
      setError('Product name is required.')
      return
    }
    if (arklineEnabled && !draft.sku) {
      setError('Select the Arkline product from the dropdown.')
      return
    }
    if (!size) {
      setError('Size is required. Use - when the product has no size.')
      return
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      setError('Qty must be a whole number greater than 0.')
      return
    }

    onChange(serializeProductEntries([...entries, { ...draft, productName, size, qty: String(qty) }]))
    setDraft(emptyProductEntry())
    setError('')
    setSuggestionsOpen(false)
  }

  function removeEntry(index) {
    onChange(serializeProductEntries(entries.filter((_, entryIndex) => entryIndex !== index)))
  }

  return (
    <div className={styles.productBreakdownField}>
      <div className={styles.productBreakdownEditor}>
        <div className={styles.productBreakdownInputs}>
          <label>
            <span>{label}{required ? <span className={styles.requiredStar}>*</span> : null}</span>
            <div className={styles.productAutocomplete}>
              <input
                ref={productInputRef}
                value={draft.productName}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, productName: event.target.value.toUpperCase(), sku: '' }))
                  setSuggestionsOpen(true)
                }}
                onFocus={() => setSuggestionsOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSuggestionsOpen(false)
                }}
                placeholder={arklineEnabled ? 'TYPE SKU OR PRODUCT NAME' : 'TYPE PRODUCT NAME'}
                autoComplete="off"
              />
              {suggestionsOpen && filteredProducts.length && suggestionBounds && typeof document !== 'undefined' ? createPortal(
                <div className={styles.productAutocompleteMenu} style={{ position: 'fixed', left: suggestionBounds.left, right: 'auto', top: suggestionBounds.top, bottom: 'auto', width: suggestionBounds.width, maxHeight: suggestionBounds.maxHeight, zIndex: 10000 }}>
                  {filteredProducts.map((product) => (
                    <button
                      key={product.sku || product.productName}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setDraft((current) => ({ ...current, productName: product.productName, sku: product.sku }))
                        setSuggestionsOpen(false)
                      }}
                    >
                      <strong>{product.sku}</strong>
                      <span>{product.productName}</span>
                    </button>
                  ))}
                </div>,
                document.body
              ) : null}
            </div>
          </label>
          <label>
            <span>SIZE</span>
            {arklineEnabled ? (
              <select value={draft.size} onChange={(event) => setDraft((current) => ({ ...current, size: event.target.value }))}>
                <option value="">SELECT SIZE</option>
                {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((size) => <option key={size}>{size}</option>)}
              </select>
            ) : (
              <input value={draft.size} onChange={(event) => setDraft((current) => ({ ...current, size: event.target.value.toUpperCase() }))} placeholder="SIZE / -" />
            )}
          </label>
          <label><span>QTY</span><input type="number" min="1" step="1" inputMode="numeric" value={draft.qty} onChange={(event) => setDraft((current) => ({ ...current, qty: event.target.value }))} placeholder="QTY" /></label>
          <button type="button" className={styles.productBreakdownAddButton} onClick={addEntry}>Add</button>
        </div>
        {error ? <p className={styles.productBreakdownError}>{error}</p> : null}
        {entries.length ? (
          <div className={styles.productBreakdownList}>
            {entries.map((entry, index) => (
              <div className={styles.productBreakdownRow} key={`${entry.raw || entry.productName}-${index}`}>
                <div>
                  <strong>{entry.sku ? `${entry.sku} | ` : ''}{entry.productName || entry.raw}</strong>
                  <span>{entry.size ? `Size ${entry.size}` : 'Size not specified'}{entry.qty ? ` • Qty ${entry.qty}` : ''}</span>
                </div>
                <button type="button" className={styles.productBreakdownRemoveButton} onClick={() => removeEntry(index)} aria-label={`Remove ${entry.productName || 'product'}`}>×</button>
              </div>
            ))}
          </div>
        ) : <p className={styles.productBreakdownHint}>Add one or more products. Each line is stored separately for reliable reading.</p>}
      </div>
    </div>
  )
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00+07:00`)
  value.setDate(value.getDate() + days)
  return value.toISOString().slice(0, 10)
}

function countByValue(rows, key, expected) {
  return rows.filter((row) => String(row?.[key] || '').trim().toLowerCase() === String(expected).trim().toLowerCase()).length
}

const RETURN_CHART_GROUPS = ['ARKLINE', 'MOB', 'OI']
const RETURN_CHART_TYPES = ['INTERNAL', 'EXTERNAL']
const RETURN_CHART_SERIES = [...RETURN_CHART_GROUPS, ...RETURN_CHART_TYPES]
const RETURN_CHART_COLORS = { ARKLINE: '#2563eb', MOB: '#16834a', OI: '#c47a12', INTERNAL: '#c02673', EXTERNAL: '#7551c8' }
const RETURN_CHART_LABELS = { ARKLINE: 'ARKLINE', MOB: 'MOB', OI: 'OI', INTERNAL: 'Internal', EXTERNAL: 'External' }

function buildReturnTimeline(rows, period) {
  const buckets = new Map()
  rows.forEach((row) => {
    const dateValue = String(row.tanggal_pengajuan || row.created_at || '').slice(0, 10)
    const date = new Date(`${dateValue}T00:00:00`)
    if (!dateValue || Number.isNaN(date.getTime())) return
    const key = period === 'year' ? dateValue.slice(0, 4) : period === 'month' ? dateValue.slice(0, 7) : dateValue
    const label = period === 'year'
      ? key
      : date.toLocaleDateString('id-ID', period === 'month' ? { month: 'short', year: 'numeric' } : { day: '2-digit', month: 'short' })
    if (!buckets.has(key)) buckets.set(key, { label, values: Object.fromEntries(RETURN_CHART_SERIES.map((series) => [series, 0])) })
    const group = cleanUpper(row.group_order)
    if (RETURN_CHART_GROUPS.includes(group)) buckets.get(key).values[group] += 1
    const type = cleanUpper(row.internal_external)
    if (RETURN_CHART_TYPES.includes(type)) buckets.get(key).values[type] += 1
  })

  return Array.from(buckets.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, bucket]) => ({ key, ...bucket }))
}

function buildReturnBars(rows, key) {
  const counts = new Map()
  rows.forEach((row) => {
    const label = String(row[key] || '').trim() || 'Not specified'
    counts.set(label, (counts.get(label) || 0) + 1)
  })
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label))
    .slice(0, 8)
}

function normalizeReturnProductName(value) {
  return cleanUpper(value).replace(/\s+/g, ' ')
}

function buildTopReturnProducts(rows, catalog = [], identityRows = rows) {
  const skusByName = new Map()
  const catalogNamesBySku = new Map()
  const addAlias = (group, name, sku) => {
    if (!name || !sku) return
    const key = `${group}:${name}`
    if (!skusByName.has(key)) skusByName.set(key, new Set())
    skusByName.get(key).add(sku)
  }

  catalog.forEach((item) => {
    const sku = cleanUpper(item.sku)
    const name = normalizeReturnProductName(item.productName)
    if (!sku || !name) return
    addAlias('ARKLINE', name, sku)
    addAlias('ARKLINE', `ARKLINE ${name}`, sku)
    catalogNamesBySku.set(sku, name)
  })
  identityRows.forEach((row) => {
    const group = cleanUpper(row.group_order)
    parseProductEntries(row.produk_diretur).forEach((entry) => {
      addAlias(group, normalizeReturnProductName(entry.productName), cleanUpper(entry.sku))
    })
  })

  const products = new Map()
  rows.forEach((row) => {
    const productsInCase = new Set()
    parseProductEntries(row.produk_diretur).forEach((entry) => {
      const qty = Number(entry.qty)
      const group = cleanUpper(row.group_order)
      const name = normalizeReturnProductName(entry.productName)
      const aliasSkus = skusByName.get(`${group}:${name}`)
      const sku = cleanUpper(entry.sku) || (aliasSkus?.size === 1 ? aliasSkus.values().next().value : '')
      if ((!sku && !name) || !Number.isInteger(qty) || qty <= 0) return
      const key = sku ? `sku:${sku}` : `name:${group}:${name}`
      const labelName = catalogNamesBySku.get(sku) || name
      if (!products.has(key)) products.set(key, { label: sku && labelName ? `${sku} | ${labelName}` : sku || name, value: 0, caseCount: 0 })
      products.get(key).value += qty
      productsInCase.add(key)
    })
    productsInCase.forEach((key) => { products.get(key).caseCount += 1 })
  })
  return Array.from(products.values())
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label))
    .slice(0, 8)
}

function buildSmoothChartPath(points) {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`
    const previous = points[index - 1]
    const beforePrevious = points[index - 2] || previous
    const next = points[index + 1] || point
    const controlOneX = previous.x + (point.x - beforePrevious.x) / 6
    const controlOneY = previous.y + (point.y - beforePrevious.y) / 6
    const controlTwoX = point.x - (next.x - previous.x) / 6
    const controlTwoY = point.y - (next.y - previous.y) / 6
    return `${path} C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${point.x} ${point.y}`
  }, '')
}

function ResolutionReturnChart({ bars, groups = RETURN_CHART_SERIES, mode, timeline, types = RETURN_CHART_TYPES }) {
  const [hover, setHover] = useState(null)
  const isTimelineMode = mode === 'groups' || mode === 'types'
  const activeSeries = mode === 'types' ? types : groups
  const hasChartData = isTimelineMode ? timeline.length > 0 : bars.length > 0

  const setHoverFromPointer = (event, title, detail) => {
    const targetBounds = event.currentTarget.getBoundingClientRect()
    const anchorX = event.clientX > 0 ? event.clientX : targetBounds.left + targetBounds.width / 2
    const anchorY = event.clientY > 0 ? event.clientY : targetBounds.top + targetBounds.height / 2
    const tooltipWidth = mode === 'product' ? 360 : 230
    const tooltipHeight = 70
    const left = anchorX + tooltipWidth + 24 <= window.innerWidth
      ? anchorX + 12
      : Math.max(12, anchorX - tooltipWidth - 12)
    const top = Math.max(12, Math.min(anchorY - tooltipHeight / 2, window.innerHeight - tooltipHeight - 12))
    setHover({ left, top, title, detail })
  }

  const hoverTooltip = hover && typeof document !== 'undefined'
    ? createPortal(<div className={`${styles.returnChartTooltip} ${mode === 'product' ? styles.returnChartProductTooltip : ''}`} style={{ left: hover.left, top: hover.top }} role="tooltip"><strong>{hover.title}</strong><span>{hover.detail}</span></div>, document.body)
    : null

  if (isTimelineMode) {
    const width = 920
    const height = 290
    const left = 48
    const right = 20
    const top = 18
    const bottom = 50
    const plotWidth = width - left - right
    const plotHeight = height - top - bottom
    const maxValue = Math.max(1, ...timeline.flatMap((point) => activeSeries.map((series) => point.values[series])))
    const yMax = Math.max(4, Math.ceil(maxValue / 4) * 4)
    const x = (index) => timeline.length === 1 ? left + plotWidth / 2 : left + (index / (timeline.length - 1)) * plotWidth
    const y = (value) => top + plotHeight - (value / yMax) * plotHeight
    const labelStep = Math.max(1, Math.ceil(timeline.length / 10))

    return (
      <div className={styles.returnChartViewport}>
        {hasChartData ? <svg className={styles.returnChartSvg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={mode === 'groups' ? 'Return cases by group over time' : 'Return cases by internal or external over time'}>
          <defs>
            {activeSeries.map((series) => <linearGradient key={series} id={`returnLine-${series}`} x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor={RETURN_CHART_COLORS[series]} stopOpacity=".55" /><stop offset="55%" stopColor={RETURN_CHART_COLORS[series]} /><stop offset="100%" stopColor={RETURN_CHART_COLORS[series]} stopOpacity=".78" /></linearGradient>)}
            {activeSeries.map((series) => <linearGradient key={`area-${series}`} id={`returnArea-${series}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={RETURN_CHART_COLORS[series]} stopOpacity=".2" /><stop offset="100%" stopColor={RETURN_CHART_COLORS[series]} stopOpacity=".015" /></linearGradient>)}
            <filter id="returnLineGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
          </defs>
          {Array.from({ length: 5 }, (_, index) => {
            const value = (yMax / 4) * index
            const yPos = y(value)
            return <g key={index}><line x1={left} x2={width - right} y1={yPos} y2={yPos} className={styles.returnChartGridLine} /><text x={left - 10} y={yPos + 4} textAnchor="end" className={styles.returnChartAxisLabel}>{Math.round(value)}</text></g>
          })}
          {activeSeries.map((series) => {
            const coordinates = timeline.map((item, index) => ({ x: x(index), y: y(item.values[series]) }))
            const linePath = buildSmoothChartPath(coordinates)
            const baseline = height - bottom
            const areaPath = coordinates.length ? `${linePath} L ${coordinates[coordinates.length - 1].x} ${baseline} L ${coordinates[0].x} ${baseline} Z` : ''
            return <g key={series}>
              <path d={areaPath} fill={`url(#returnArea-${series})`} />
              <path d={linePath} fill="none" stroke={RETURN_CHART_COLORS[series]} strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" opacity=".13" filter="url(#returnLineGlow)" />
              <path d={linePath} fill="none" stroke={`url(#returnLine-${series})`} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />
              {timeline.map((item, index) => <g key={`${series}-${item.key}`} tabIndex="0" onMouseEnter={(event) => setHoverFromPointer(event, `${RETURN_CHART_LABELS[series]} · ${item.label}`, `${item.values[series]} return case(s)`)} onMouseMove={(event) => setHoverFromPointer(event, `${RETURN_CHART_LABELS[series]} · ${item.label}`, `${item.values[series]} return case(s)`)} onMouseLeave={() => setHover(null)} onFocus={(event) => setHoverFromPointer(event, `${RETURN_CHART_LABELS[series]} · ${item.label}`, `${item.values[series]} return case(s)`)} onBlur={() => setHover(null)}>
                <circle cx={x(index)} cy={y(item.values[series])} r="8" fill={RETURN_CHART_COLORS[series]} opacity=".15" />
                <circle cx={x(index)} cy={y(item.values[series])} r="4" fill="#fff" stroke={RETURN_CHART_COLORS[series]} strokeWidth="2.5"><title>{`${RETURN_CHART_LABELS[series]}: ${item.values[series]} · ${item.label}`}</title></circle>
              </g>)}
            </g>
          })}
          {timeline.map((item, index) => index % labelStep === 0 || index === timeline.length - 1
            ? <text key={item.key} x={x(index)} y={height - 16} textAnchor="middle" className={styles.returnChartAxisLabel}>{item.label}</text>
            : null)}
        </svg> : <div className={styles.returnChartEmpty}>No return cases in the selected date range.</div>}
        {hoverTooltip}
      </div>
    )
  }

  const width = 880
  const left = 220
  const right = 38
  const top = 16
  const rowHeight = 34
  const bottom = 36
  const height = top + bars.length * rowHeight + bottom
  const plotWidth = width - left - right
  const maxValue = Math.max(1, ...bars.map((item) => item.value))
  const xMax = Math.max(4, Math.ceil(maxValue / 4) * 4)
  const barWidth = (value) => (value / xMax) * plotWidth

  return (
    <div className={styles.returnChartViewport}>
      {hasChartData ? <svg className={styles.returnChartSvg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={mode === 'reason' ? 'Top return reasons' : mode === 'product' ? 'Top returned products by quantity' : 'Top follow-up actions'}>
        <defs><linearGradient id="returnBarGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#dbeafe" stopOpacity=".96" /><stop offset="22%" stopColor="#93b4fb" stopOpacity=".94" /><stop offset="100%" stopColor="#596ff0" /></linearGradient><filter id="returnBarGlow" x="-10%" y="-50%" width="130%" height="200%"><feGaussianBlur stdDeviation="2" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter></defs>
        {Array.from({ length: 5 }, (_, index) => {
          const value = (xMax / 4) * index
          const xPos = left + (index / 4) * plotWidth
          return <g key={index}><line x1={xPos} x2={xPos} y1={top - 4} y2={height - bottom} className={styles.returnChartGridLine} /><text x={xPos} y={height - 10} textAnchor="middle" className={styles.returnChartAxisLabel}>{Math.round(value)}</text></g>
        })}
        {bars.map((item, index) => {
          const yPos = top + index * rowHeight
          const label = item.label.length > 30 ? `${item.label.slice(0, 27)}...` : item.label
          const detail = mode === 'product' ? `${item.value} unit(s) · ${item.caseCount} case(s)` : `${item.value} return case(s)`
          return <g key={item.label} onMouseEnter={(event) => setHoverFromPointer(event, item.label, detail)} onMouseMove={(event) => setHoverFromPointer(event, item.label, detail)} onMouseLeave={() => setHover(null)}>
            <text x={left - 12} y={yPos + 16} textAnchor="end" className={styles.returnChartBarLabel}><title>{item.label}</title>{label}</text>
            <rect x={left} y={yPos + 2} width={Math.max(item.value ? 3 : 0, barWidth(item.value))} height="22" rx="7" className={styles.returnChartBar} filter="url(#returnBarGlow)" />
            <rect x={left + 1} y={yPos + 3} width={Math.max(item.value ? 1 : 0, barWidth(item.value) - 2)} height="7" rx="5" fill="#ffffff" opacity=".24" pointerEvents="none" />
            <text x={left + barWidth(item.value) + 8} y={yPos + 17} className={styles.returnChartValue}>{item.value}</text>
          </g>
        })}
      </svg> : <div className={styles.returnChartEmpty}>{mode === 'product' ? 'No returned products with recorded quantities in the selected date range.' : 'No return cases in the selected date range.'}</div>}
      {hoverTooltip}
    </div>
  )
}

const MemoizedResolutionReturnChart = memo(ResolutionReturnChart)

function formatMoney(value) {
  return new Intl.NumberFormat('id-ID', {
    currency: 'IDR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(safeNumber(value))
}

function normalizeNullableBoolean(value) {
  if (value === true) return true
  if (value === false) return false
  return null
}

function getReturnActionRules(actionMeta) {
  return {
    replacementRequired: actionMeta ? normalizeNullableBoolean(actionMeta.replacement_required) : null,
    requireRefundValue: actionMeta ? normalizeNullableBoolean(actionMeta.requires_refund_value) : null,
    requiresReturn: actionMeta ? normalizeNullableBoolean(actionMeta.requires_return) : null,
  }
}

function cleanText(value) {
  return String(value || '').trim()
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase()
}

function normalizeLockedGroup(value) {
  const normalized = cleanUpper(value)
  return GROUPS.includes(normalized) ? normalized : ''
}

function cleanNullableText(value) {
  const text = cleanText(value)
  return text || null
}

function cleanNullableUpper(value) {
  const text = cleanUpper(value)
  return text || null
}

function cleanDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function cleanNumeric(value) {
  const normalized = String(value || '').replace(/\./g, '').replace(/,/g, '.').trim()
  if (!normalized) return null
  const numberValue = Number(normalized)
  return Number.isFinite(numberValue) ? numberValue : null
}

function dateOnly(value) {
  return String(value || '').slice(0, 10)
}

function formatShortDate(value) {
  const dateValue = dateOnly(value)
  if (!dateValue) return '-'
  const date = new Date(`${dateValue}T00:00:00+07:00`)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
  }).format(date).replace(',', '')
}

function normalizeBarcodeRuleKey(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '')
}

function sanitizeBarcodePattern(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '')
}

function isRefundOnlyCase(row) {
  return String(row?.retur_action || '').toLowerCase().includes('refund')
}

function ensureBulletText(value) {
  const lines = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^>\s*/, '').trim())
    .filter(Boolean)
  return lines.length ? lines.map((line) => `> ${line}`).join('\n') : ''
}

function hasMeaningfulBulletText(value) {
  return String(value || '').replace(/>/g, '').trim() !== ''
}

function getMonthDateRange(monthValue, fallbackDate) {
  const monthText = String(monthValue || fallbackDate.slice(0, 7)).slice(0, 7)
  const start = new Date(`${monthText}-01T00:00:00+07:00`)
  if (Number.isNaN(start.getTime())) return { from: fallbackDate, to: fallbackDate }
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  end.setDate(0)
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}

function normalizeIssueHandlingKey(value) {
  return cleanUpper(value)
}

function isTruthyFlag(value) {
  return value === true || String(value || '').trim().toLowerCase() === 'true'
}

function formatIssueTeamLabel(value) {
  return cleanUpper(value) === 'INSTANT PACKING' ? 'INST. PACKER' : value || '-'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getGroupPrefix(group) {
  if (group === 'MOB') return 'M'
  if (group === 'OI') return 'O'
  return 'A'
}

function getCaseCodePrefix(groupOrder, submissionDate, fallbackDate) {
  const normalizedGroup = cleanUpper(groupOrder || 'ARKLINE')
  const date = new Date(`${submissionDate || fallbackDate || todayIso()}T00:00:00+07:00`)
  return `${getGroupPrefix(normalizedGroup)}${romanMonth(date)}${String(date.getFullYear()).slice(-2)}-`
}

function hasExpectedCaseCodePrefix(code, groupOrder, submissionDate, fallbackDate) {
  return cleanUpper(code).startsWith(getCaseCodePrefix(groupOrder, submissionDate, fallbackDate))
}

function isCaseCodeDuplicateError(error) {
  const message = String(error?.message || '').toLowerCase()
  const details = String(error?.details || '').toLowerCase()
  return error?.code === '23505' && (message.includes('kode_kejadian') || details.includes('kode_kejadian') || message.includes('duplicate key'))
}

function formatHandledCaseLabel(row) {
  const code = cleanText(row?.kode_kejadian || row?.order_id) || '-'
  const handler = cleanText(row?.created_by)
  return handler ? `${code} | Handled by ${handler}` : code
}

function timestampWithCurrentJakartaTime(dateValue) {
  const dateText = cleanText(dateValue) || todayIso()
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).formatToParts(new Date())
  const map = Object.fromEntries(timeParts.map((part) => [part.type, part.value]))
  return new Date(`${dateText}T${map.hour}:${map.minute}:${map.second}+07:00`).toISOString()
}

function labelText(label, isRequired = false) {
  return (
    <>
      {label}
      {isRequired ? <span className={styles.requiredStar}>*</span> : null}
    </>
  )
}

function labelWithInfo(label, helper, isRequired = false) {
  return (
    <>
      {labelText(label, isRequired)}
      <span className={styles.infoWrap}>
        <span className={styles.infoDot}>ℹ️</span>
        <span className={styles.infoTooltip}>{helper}</span>
      </span>
    </>
  )
}

function getCaseWarningMeta(row, today) {
  if (row?.need_prioritized) {
    return {
      label: 'Prioritized',
      rank: 3,
      tone: styles.resolutionWarningPriority,
    }
  }

  if (!ACTIVE_RETURN_STATUSES.has(row?.status_barang)) {
    return {
      label: 'Normal',
      rank: 0,
      tone: '',
    }
  }

  const deadlineValue = String(row?.batas_tanggal_retur || '').slice(0, 10)
  if (!deadlineValue) {
    return {
      label: 'Normal',
      rank: 0,
      tone: '',
    }
  }

  const deadline = new Date(`${deadlineValue}T00:00:00+07:00`).getTime()
  const current = new Date(`${today}T00:00:00+07:00`).getTime()
  const diffDays = Math.round((deadline - current) / 86400000)

  if (diffDays < 0) {
    return {
      label: 'Overdue',
      rank: 2,
      tone: styles.resolutionWarningOverdue,
    }
  }

  if (diffDays <= 1) {
    return {
      label: 'H-1',
      rank: 1,
      tone: styles.resolutionWarningDue,
    }
  }

  return {
    label: 'Normal',
    rank: 0,
    tone: '',
  }
}

function normalizeReturnPayload(form, code) {
  return {
    alamat: cleanText(form.alamat),
    batas_tanggal_retur: timestampWithCurrentJakartaTime(form.batas_tanggal_retur),
    courier_name: cleanNullableUpper(form.courier_name),
    courier_service: cleanNullableUpper(form.courier_service),
    group_order: cleanUpper(form.group_order),
    internal_external: cleanText(form.internal_external),
    keterangan_tambahan: cleanNullableText(form.keterangan_tambahan),
    kode_kejadian: cleanUpper(code),
    nama_customer: cleanUpper(form.nama_customer),
    need_prioritized: Boolean(form.need_prioritized),
    nilai_refund_kompensasi: cleanNumeric(form.nilai_refund_kompensasi),
    no_handphone: cleanDigits(form.no_handphone),
    no_resi_pengiriman: cleanUpper(form.no_resi_pengiriman),
    nomor_tim: cleanUpper(form.nomor_tim),
    note_konsumen: cleanNullableText(form.note_konsumen),
    ongkir_keluar: cleanNumeric(form.ongkir_keluar),
    ongkir_masuk: cleanNumeric(form.ongkir_masuk),
    order_id: cleanUpper(form.order_id),
    produk_diretur: cleanNullableText(form.produk_diretur),
    produk_pengganti: cleanNullableText(form.produk_pengganti),
    retur_action: cleanNullableText(form.retur_action),
    retur_reason: cleanNullableText(form.retur_reason),
    status_barang: cleanText(form.status_barang),
    tanggal_pengajuan: timestampWithCurrentJakartaTime(form.tanggal_pengajuan),
    total_retur: cleanNumeric(form.total_retur),
  }
}

function normalizeIssuePayload(form) {
  return {
    alasan_bermasalah: cleanNullableText(form.alasan_bermasalah),
    biaya_timbul: cleanNumeric(form.biaya_timbul),
    group_order: cleanUpper(form.group_order),
    keterangan: cleanNullableText(form.keterangan),
    nama: cleanUpper(form.nama),
    no_hp: cleanDigits(form.no_hp),
    order_id: cleanUpper(form.order_id),
    produk_bermasalah: ensureBulletText(form.produk_bermasalah),
    produk_pengganti: cleanNullableText(ensureBulletText(form.produk_pengganti)),
    tim: cleanNullableUpper(form.tim),
    tindak_lanjut: cleanNullableText(form.tindak_lanjut),
  }
}

const GROUP_CHOICE_CLASS = {
  ARKLINE: styles.groupChoiceArkline,
  MOB: styles.groupChoiceMob,
  OI: styles.groupChoiceOi,
}

const TYPE_CHOICE_CLASS = {
  External: styles.typeChoiceExternal,
  Internal: styles.typeChoiceInternal,
}

const ISSUE_TEAMS = ['TIM 1', 'TIM 2', 'TIM 3', 'INSTANT PACKING']

const blankReturn = (date) => ({
  alamat: '',
  batas_tanggal_retur: addDays(date, 14),
  courier_name: '',
  courier_service: '',
  group_order: 'MOB',
  internal_external: 'Internal',
  keterangan_tambahan: '',
  nama_customer: '',
  need_prioritized: false,
  nilai_refund_kompensasi: '',
  no_handphone: '',
  no_resi_pengiriman: '',
  nomor_tim: '',
  note_konsumen: '',
  ongkir_keluar: '',
  ongkir_masuk: '',
  order_id: '',
  produk_diretur: '',
  produk_pengganti: '',
  retur_action: '',
  retur_reason: '',
  status_barang: 'Pending',
  tanggal_pengajuan: date,
  total_retur: '',
})

const blankIssue = () => ({
  alasan_bermasalah: '',
  biaya_timbul: '',
  group_order: 'ARKLINE',
  keterangan: '',
  nama: '',
  no_hp: '',
  order_id: '',
  produk_bermasalah: '',
  produk_pengganti: '',
  tim: 'TIM 1',
  tindak_lanjut: '',
})

export default function ResolutionCenter({ lockedGroup: lockedGroupProp = '' }) {
  const supabase = useMemo(() => createClient(), [])
  const today = useMemo(() => todayIso(), [])
  const lockedGroup = useMemo(() => normalizeLockedGroup(lockedGroupProp), [lockedGroupProp])
  const groupOptions = useMemo(() => (lockedGroup ? [lockedGroup] : GROUPS), [lockedGroup])
  const [activeTab, setActiveTab] = useState('registration')
  const [returnFormOpen, setReturnFormOpen] = useState(false)
  const [returnFormStep, setReturnFormStep] = useState(0)
  const [returnFormStatus, setReturnFormStatus] = useState(null)
  const [returnChartMode, setReturnChartMode] = useState('groups')
  const [returnChartPeriod, setReturnChartPeriod] = useState('day')
  const [pic, setPic] = useState('')
  const [caseListAccess, setCaseListAccess] = useState({ isAdmin: false, name: '', ready: false })
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [filters, setFilters] = useState({ courier: '', from: addDays(today, -6), group: lockedGroup, search: '', status: '', to: today, type: '', warningOnly: false })
  const [cases, setCases] = useState([])
  const [issues, setIssues] = useState([])
  const [masters, setMasters] = useState({ actions: [], barcodeRules: [], couriers: [], issueActions: [], issueReasons: [], reasons: [], services: [] })
  const [arklineProducts, setArklineProducts] = useState([])
  const [arklineCatalog, setArklineCatalog] = useState([])
  const [productEditorResetNonce, setProductEditorResetNonce] = useState(0)
  const [returnForm, setReturnForm] = useState({ ...blankReturn(today), group_order: lockedGroup || 'MOB' })
  const [issueForm, setIssueForm] = useState({ ...blankIssue(), group_order: lockedGroup || 'ARKLINE' })
  const [editingIssueId, setEditingIssueId] = useState(null)
  const [issueDetail, setIssueDetail] = useState(null)
  const [issueDetailReadonly, setIssueDetailReadonly] = useState(false)
  const [issueFilters, setIssueFilters] = useState({ from: addDays(today, -6), group: lockedGroup, search: '', to: today })
  const [issueSummaryMonth, setIssueSummaryMonth] = useState(today.slice(0, 7))
  const [caseCode, setCaseCode] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailDraft, setDetailDraft] = useState(null)
  const [detailMode, setDetailMode] = useState('view')
  const [detailReadonly, setDetailReadonly] = useState(false)
  const [detailSectionsOpen, setDetailSectionsOpen] = useState({ overview: false, subject: false, returns: false, status: false })
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelError, setCancelError] = useState('')
  const cancelInFlightRef = useRef(false)
  const [receivingAddOpen, setReceivingAddOpen] = useState(false)
  const [receivingAddSearch, setReceivingAddSearch] = useState('')
  const [receivingAddSelectedIds, setReceivingAddSelectedIds] = useState([])
  const [receivingReprintOpen, setReceivingReprintOpen] = useState(false)
  const [receivingReprintSearch, setReceivingReprintSearch] = useState('')
  const [receivingSelectedIds, setReceivingSelectedIds] = useState([])
  const [receivingReprintSelectedIds, setReceivingReprintSelectedIds] = useState([])
  const [receivingFilters, setReceivingFilters] = useState({ courier: '', group: lockedGroup, search: '', status: '' })
  const [receivingConfirmOpen, setReceivingConfirmOpen] = useState(false)
  const [receivingConfirmError, setReceivingConfirmError] = useState('')
  const [receivingConfirmStep, setReceivingConfirmStep] = useState('inspect')
  const [receivingLookupBusy, setReceivingLookupBusy] = useState(false)
  const [receivingInspectionCases, setReceivingInspectionCases] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [productSearchFilters, setProductSearchFilters] = useState({ group: lockedGroup, scope: '', type: '', size: '' })

  const loadMasters = useCallback(async () => {
    const results = await Promise.all([
      deliverySupabase.from('delivery_retur_reason').select('*').neq('is_active', false).order('id'),
      deliverySupabase.from('delivery_retur_action').select('*').neq('is_active', false).order('id'),
      deliverySupabase.from('delivery_courier').select('*').neq('is_active', false).order('nama'),
      deliverySupabase.from('delivery_courier_subclass').select('*').neq('is_active', false).order('courier_name'),
      deliverySupabase.from('delivery_order_issue').select('*').neq('is_active', false).order('id'),
      deliverySupabase.from('delivery_order_handling').select('*').neq('is_active', false).order('id'),
      deliverySupabase.from('delivery_barcode_rules').select('result_value, pattern, match_type, priority').order('priority', { ascending: true }),
    ])
    const error = results.find((result) => result.error)?.error
    if (error) setStatus({ type: 'error', message: `Failed to load Resolution Center master data: ${error.message}` })
    setMasters({
      actions: results[1].data || [],
      couriers: results[2].data || [],
      issueActions: results[5].data || [],
      issueReasons: results[4].data || [],
      reasons: results[0].data || [],
      services: results[3].data || [],
      barcodeRules: results[6].data || [],
    })
  }, [])

  const getActorContext = useCallback(async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) throw error
    if (!user) throw new Error('User session was not found.')

    const { data: profile, error: profileError } = await getProfileByAuthenticatedUser(supabase, user, 'display_name, role')
    if (profileError) throw profileError

    const metadataName =
      String(user.user_metadata?.display_name || '').trim() ||
      String(user.user_metadata?.full_name || '').trim() ||
      String(user.user_metadata?.name || '').trim()
    const displayName = String(profile?.display_name || metadataName || user.email || '').trim()
    const isAdminUser = String(user.email || '').trim().toLowerCase() === ADMIN_EMAIL || String(profile?.role || '').trim().toLowerCase() === 'admin'

    if (!displayName) throw new Error('User display name was not found. Please complete the profile first.')
    return { displayName, isAdmin: isAdminUser }
  }, [supabase])

  const getActorDisplayName = useCallback(async () => {
    const { displayName, isAdmin } = await getActorContext()
    setCaseListAccess({ isAdmin, name: cleanUpper(displayName), ready: true })
    return displayName
  }, [getActorContext])

  const loadCases = useCallback(async () => {
    if (!caseListAccess.ready) return
    const { data, error } = await deliverySupabase
      .from('delivery_error_retur_cases')
      .select('*')
      .order('tanggal_pengajuan', { ascending: false })
      .limit(5000)
    if (error) setStatus({ type: 'error', message: `Failed to load return cases: ${error.message}` })
    else setCases(data || [])
  }, [caseListAccess.ready])

  const loadIssues = useCallback(async () => {
    if (!caseListAccess.ready) return
    const { data, error } = await deliverySupabase.from('delivery_order_issue_cases').select('*').order('created_at', { ascending: false }).limit(5000)
    if (error) setStatus({ type: 'error', message: `Failed to load order issues: ${error.message}` })
    else setIssues(data || [])
  }, [caseListAccess.ready])

  useEffect(() => {
    let ignore = false

    async function loadArklineProducts() {
      const { data, error } = await deliverySupabase
        .from('arkline_dir_products')
        .select('sku_induk, nama_produk, is_active')
        .order('nama_produk', { ascending: true })
        .limit(5000)

      if (ignore || error) return
      const products = (data || []).map(normalizeArklineProductOption).filter((item) => item.sku || item.productName)
      setArklineCatalog(products)
      setArklineProducts(products.filter((item) => item.isActive))
    }

    loadArklineProducts()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMasters()
      loadCases()
      loadIssues()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCases, loadIssues, loadMasters])

  useEffect(() => {
    let ignore = false

    getActorContext()
      .then(({ displayName, isAdmin }) => {
        if (!ignore) {
          setPic(displayName)
          setCaseListAccess({ isAdmin, name: cleanUpper(displayName), ready: true })
        }
      })
      .catch((error) => {
        if (!ignore) {
          setCaseListAccess({ isAdmin: false, name: '', ready: true })
          setStatus({ type: 'error', message: error.message || 'Failed to load signed-in user.' })
        }
      })

    return () => {
      ignore = true
    }
  }, [getActorContext])

  const generateNextCaseCode = useCallback(async (groupOrder, submissionDate) => {
    const codePrefix = getCaseCodePrefix(groupOrder, submissionDate, today)
    const { data, error } = await deliverySupabase
      .from('delivery_error_retur_cases')
      .select('kode_kejadian')
      .like('kode_kejadian', `${codePrefix}%`)
      .order('created_at', { ascending: false })
      .limit(2000)

    if (error) throw error

    const maxNumber = (data || []).reduce((max, row) => {
      const value = String(row.kode_kejadian || '')
      if (!value.startsWith(codePrefix)) return max
      const numberPart = Number.parseInt(value.slice(codePrefix.length), 10)
      return Number.isFinite(numberPart) && numberPart > max ? numberPart : max
    }, 0)

    return `${codePrefix}${maxNumber + 1}`
  }, [today])

  useEffect(() => {
    if (!returnFormOpen) return undefined
    let ignore = false
    const timer = window.setTimeout(() => {
      generateNextCaseCode(returnForm.group_order, returnForm.tanggal_pengajuan)
        .then((nextCode) => {
          if (!ignore) setCaseCode(nextCode)
        })
        .catch((error) => {
          if (!ignore) setReturnFormStatus({ type: 'error', message: `Failed to generate case code: ${error.message}` })
        })
    }, 250)

    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [generateNextCaseCode, returnForm.group_order, returnForm.tanggal_pengajuan, returnFormOpen])

  const accessibleCases = useMemo(() => {
    if (!caseListAccess.ready) return []
    if (lockedGroup) return cases.filter((row) => cleanUpper(row.group_order) === lockedGroup)
    if (caseListAccess.isAdmin) return cases
    return cases.filter((row) => cleanUpper(row.created_by) === caseListAccess.name)
  }, [caseListAccess.isAdmin, caseListAccess.name, caseListAccess.ready, cases, lockedGroup])

  const summaryCases = useMemo(() => {
    return accessibleCases.filter((row) => {
      const submissionDate = dateOnly(row.tanggal_pengajuan)
      if (filters.from && submissionDate && submissionDate < filters.from) return false
      if (filters.to && submissionDate && submissionDate > filters.to) return false
      if (filters.group && row.group_order !== filters.group) return false
      if (filters.courier && row.courier_name !== filters.courier) return false
      if (filters.type && cleanUpper(row.internal_external) !== cleanUpper(filters.type)) return false
      return true
    })
  }, [accessibleCases, filters.courier, filters.from, filters.group, filters.to, filters.type])

  const returnChartTimeline = useMemo(() => buildReturnTimeline(summaryCases, returnChartPeriod), [returnChartPeriod, summaryCases])
  const returnChartBars = useMemo(() => {
    if (returnChartMode === 'reason') return buildReturnBars(summaryCases, 'retur_reason')
    if (returnChartMode === 'action') return buildReturnBars(summaryCases, 'retur_action')
    if (returnChartMode === 'product') return buildTopReturnProducts(summaryCases, arklineCatalog, accessibleCases)
    return []
  }, [accessibleCases, arklineCatalog, returnChartMode, summaryCases])
  const returnChartGroups = useMemo(
    () => filters.group ? [filters.group] : lockedGroup ? [lockedGroup] : RETURN_CHART_GROUPS,
    [filters.group, lockedGroup]
  )
  const returnChartTypes = useMemo(() => filters.type ? [cleanUpper(filters.type)] : RETURN_CHART_TYPES, [filters.type])

  const visibleCases = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase()
    return summaryCases.filter((row) => {
      if (filters.warningOnly && getCaseWarningMeta(row, today).rank <= 0) return false
      if (filters.status && cleanUpper(row.status_barang) !== cleanUpper(filters.status)) return false
      if (!keyword) return true
      return [row.kode_kejadian, row.order_id, row.no_resi_pengiriman, row.nama_customer].some((value) => String(value || '').toLowerCase().includes(keyword))
    })
  }, [filters.search, filters.status, filters.warningOnly, summaryCases, today])

  const caseListStats = useMemo(() => {
    const visibleWithWarningMeta = visibleCases.map((row) => ({ meta: getCaseWarningMeta(row, today), row }))
    const warning = visibleWithWarningMeta.filter(({ meta }) => meta.rank === 1 || meta.rank === 3).length
    const overdue = visibleWithWarningMeta.filter(({ meta }) => meta.rank === 2).length
    return { overdue, warning }
  }, [today, visibleCases])

  const courierOptions = useMemo(() => {
    return Array.from(new Set(accessibleCases.map((row) => cleanUpper(row.courier_name)).filter(Boolean))).sort()
  }, [accessibleCases])
  const caseStatusOptions = useMemo(() => Array.from(new Set(accessibleCases.map((row) => row.status_barang).filter(Boolean))).sort(), [accessibleCases])

  const stats = useMemo(() => {
    const internal = countByValue(summaryCases, 'internal_external', 'Internal')
    const external = countByValue(summaryCases, 'internal_external', 'External')
    return { external, internal }
  }, [summaryCases])

  const accessibleIssues = useMemo(() => {
    if (!caseListAccess.ready) return []
    if (lockedGroup) return issues.filter((row) => cleanUpper(row.group_order) === lockedGroup)
    if (caseListAccess.isAdmin) return issues
    return issues.filter((row) => cleanUpper(row.created_by) === caseListAccess.name)
  }, [caseListAccess.isAdmin, caseListAccess.name, caseListAccess.ready, issues, lockedGroup])

  const selectedIssueHandlingMeta = useMemo(() => {
    const selected = normalizeIssueHandlingKey(issueForm.tindak_lanjut)
    return masters.issueActions.find((item) => normalizeIssueHandlingKey(item.name) === selected) || null
  }, [issueForm.tindak_lanjut, masters.issueActions])

  const issueNeedsCost = isTruthyFlag(selectedIssueHandlingMeta?.add_cost)

  const isIssuePending = useCallback((row) => {
    const selected = normalizeIssueHandlingKey(row?.tindak_lanjut)
    if (!selected) return false
    const meta = masters.issueActions.find((item) => normalizeIssueHandlingKey(item.name) === selected)
    return isTruthyFlag(meta?.is_pending)
  }, [masters.issueActions])

  const issueSummaryRange = useMemo(() => getMonthDateRange(issueSummaryMonth, today), [issueSummaryMonth, today])

  const issueSummaryRows = useMemo(() => {
    return accessibleIssues.filter((row) => {
      const createdDate = dateOnly(row.created_at)
      if (createdDate && createdDate < issueSummaryRange.from) return false
      if (createdDate && createdDate > issueSummaryRange.to) return false
      return true
    })
  }, [accessibleIssues, issueSummaryRange.from, issueSummaryRange.to])

  const visibleIssues = useMemo(() => {
    const keyword = issueFilters.search.trim().toLowerCase()
    return accessibleIssues.filter((row) => {
      const createdDate = dateOnly(row.created_at)
      const groupValue = cleanUpper(row.group_order)
      const haystack = [row.order_id, row.nama, row.tim, row.produk_bermasalah, row.alasan_bermasalah, row.tindak_lanjut, row.keterangan].join(' ').toLowerCase()

      if (issueFilters.from && createdDate && createdDate < issueFilters.from) return false
      if (issueFilters.to && createdDate && createdDate > issueFilters.to) return false
      if (issueFilters.group && groupValue !== issueFilters.group) return false
      if (keyword && !haystack.includes(keyword)) return false
      return true
    })
  }, [accessibleIssues, issueFilters.from, issueFilters.group, issueFilters.search, issueFilters.to])

  const issueSummaryStats = useMemo(() => {
    const pendingRows = issueSummaryRows.filter(isIssuePending)
    const costTotal = issueSummaryRows.reduce((sum, row) => sum + safeNumber(row.biaya_timbul), 0)
    const groups = groupOptions.map((group) => {
      const rows = issueSummaryRows.filter((row) => cleanUpper(row.group_order) === group)
      const pending = rows.filter(isIssuePending)
      return {
        cost: rows.reduce((sum, row) => sum + safeNumber(row.biaya_timbul), 0),
        count: rows.length,
        group,
        pending: pending.length,
      }
    })
    const handlingCounts = new Map()
    issueSummaryRows.forEach((row) => {
      const value = cleanText(row.tindak_lanjut)
      if (!value) return
      handlingCounts.set(value, (handlingCounts.get(value) || 0) + 1)
    })
    const topHandling = [...handlingCounts.entries()]
      .map(([label, value]) => ({ key: label, label, value }))
      .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label))
      .slice(0, 5)

    return {
      costTotal,
      groups,
      pendingRows,
      topHandling,
      total: issueSummaryRows.length,
    }
  }, [groupOptions, isIssuePending, issueSummaryRows])

  const issueQuickInsights = useMemo(() => {
    const pendingRows = issueSummaryStats.pendingRows
    return pendingRows.slice(0, 8).map((row) => ({
      detail: `${row.nama || '-'} • ${row.group_order || '-'} • ${formatIssueTeamLabel(row.tim)} | ${row.alasan_bermasalah || '-'} → ${row.tindak_lanjut || '-'}`,
      id: row.id,
      row,
      title: row.order_id || '-',
    }))
  }, [issueSummaryStats.pendingRows])

  const renderIssueMetricRows = (items, formatter = (value) => `${value} cases`) => {
    const safeItems = (items || []).filter((item) => safeNumber(item.value) > 0)
    const totalValue = safeItems.reduce((sum, item) => sum + safeNumber(item.value), 0)
    if (!safeItems.length || !totalValue) return null

    return (
      <div className={styles.orderIssueChart}>
        {safeItems.map((item) => {
          const percent = Math.round((safeNumber(item.value) / totalValue) * 100)
          return (
            <button key={item.key || item.label} type="button" className={styles.orderIssueChartRow} onClick={item.onClick}>
              <div className={styles.orderIssueChartMeta}><span>{item.label}</span><strong>{formatter(item.value)}</strong></div>
              <div className={styles.orderIssueChartTrack}><div className={`${styles.orderIssueChartFill} ${item.className || ''}`} style={{ width: `${Math.max(percent, item.value ? 6 : 0)}%` }} /></div>
            </button>
          )
        })}
      </div>
    )
  }

  const returnActionRules = useMemo(() => {
    const actionMeta = masters.actions.find((item) => String(item.name || '').trim() === String(returnForm.retur_action || '').trim()) || null
    return getReturnActionRules(actionMeta)
  }, [masters.actions, returnForm.retur_action])

  async function resolveActorName() {
    const actorName = pic || await getActorDisplayName()
    setPic(actorName)
    return actorName
  }

  function createDetailDraft(row) {
    if (!row) return null
    return {
      ...blankReturn(today),
      alamat: row.alamat || '',
      batas_tanggal_retur: dateOnly(row.batas_tanggal_retur) || today,
      created_by: row.created_by || '',
      courier_name: row.courier_name || '',
      courier_service: row.courier_service || '',
      group_order: row.group_order || 'MOB',
      internal_external: row.internal_external || 'Internal',
      keterangan_tambahan: row.keterangan_tambahan || '',
      kode_kejadian: row.kode_kejadian || '',
      nama_customer: row.nama_customer || '',
      need_prioritized: Boolean(row.need_prioritized),
      nilai_refund_kompensasi: row.nilai_refund_kompensasi ?? '',
      no_handphone: row.no_handphone || '',
      no_resi_pengiriman: row.no_resi_pengiriman || '',
      nomor_tim: row.nomor_tim || '',
      note_konsumen: row.note_konsumen || '',
      ongkir_keluar: row.ongkir_keluar ?? '',
      ongkir_masuk: row.ongkir_masuk ?? '',
      order_id: row.order_id || '',
      produk_diretur: row.produk_diretur || '',
      produk_pengganti: row.produk_pengganti || '',
      retur_action: row.retur_action || '',
      retur_reason: row.retur_reason || '',
      status_barang: row.status_barang || 'Pending',
      tanggal_pengajuan: dateOnly(row.tanggal_pengajuan) || today,
      total_retur: row.total_retur ?? '',
      updated_by: row.updated_by || '',
    }
  }

  function openCaseDetail(row, options = {}) {
    setReceivingAddOpen(false)
    setReceivingReprintOpen(false)
    setDetailReadonly(Boolean(options.readonly))
    setDetail(row)
    setDetailDraft(row?.kode_kejadian ? createDetailDraft(row) : null)
    setDetailMode('view')
    setDetailSectionsOpen({ overview: false, subject: false, returns: false, status: false })
  }

  function closeCaseDetail() {
    setDetail(null)
    setDetailDraft(null)
    setDetailMode('view')
    setDetailReadonly(false)
  }

  const detailField = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setDetailDraft((current) => ({ ...current, [key]: value }))
  }

  async function saveDetailEdit() {
    if (!detail || !detailDraft || !ACTIVE_RETURN_STATUSES.has(detail.status_barang)) return
    setBusy(true)
    let actorName = pic
    try {
      actorName = await resolveActorName()
    } catch (error) {
      setBusy(false)
      setStatus({ type: 'error', message: error.message || 'Failed to load signed-in user.' })
      return
    }

    let nextCaseCode = detail.kode_kejadian || detailDraft.kode_kejadian
    try {
      if (!hasExpectedCaseCodePrefix(nextCaseCode, detailDraft.group_order, detailDraft.tanggal_pengajuan, today)) {
        nextCaseCode = await generateNextCaseCode(detailDraft.group_order, detailDraft.tanggal_pengajuan)
      }
    } catch (error) {
      setBusy(false)
      setStatus({ type: 'error', message: `Failed to generate case code: ${error.message}` })
      return
    }

    const updatePayload = {
      ...normalizeReturnPayload(detailDraft, nextCaseCode),
      updated_at: new Date().toISOString(),
      updated_by: actorName,
    }
    const { data, error } = await deliverySupabase.from('delivery_error_retur_cases').update(updatePayload).eq('id', detail.id).eq('status_barang', detail.status_barang).select('*').maybeSingle()
    setBusy(false)
    if (error || !data) {
      setStatus({ type: 'error', message: error ? `Failed to update case: ${error.message}` : 'This case is no longer editable. Refresh the list and try again.' })
      return
    }
    setStatus({ type: 'success', message: `${nextCaseCode || detail.kode_kejadian || 'Case'} was updated successfully.` })
    setDetail(data)
    setDetailDraft(createDetailDraft(data))
    setDetailMode('view')
    await loadCases()
  }

  async function saveReturn() {
    const checks = [
      [returnForm.order_id, 'Order ID is required.'],
      [returnForm.nama_customer, 'Customer name is required.'],
      [returnForm.no_handphone, 'Phone number is required.'],
      [returnForm.alamat, 'Address is required.'],
      [returnForm.no_resi_pengiriman, 'Shipment AWB is required.'],
      [returnForm.retur_reason, 'Return reason is required.'],
      [returnForm.retur_action, 'Follow-up action is required.'],
    ]

    if (returnActionRules.replacementRequired === true) {
      checks.push([returnForm.courier_name, 'Shipping courier is required for this follow-up action.'])
      checks.push([returnForm.produk_pengganti, 'Replacement product is required for this follow-up action.'])
      checks.push([returnForm.total_retur, 'Returned item value is required for this follow-up action.'])
    }
    if (returnActionRules.requireRefundValue === true) checks.push([returnForm.nilai_refund_kompensasi, 'Loss value is required for this follow-up action.'])
    if (returnActionRules.requiresReturn === true) checks.push([returnForm.produk_diretur, 'Returned / problem product is required for this follow-up action.'])

    const missingField = checks.find(([value]) => !String(value || '').trim())
    if (missingField) {
      setReturnFormStatus({ type: 'error', message: missingField[1] })
      return
    }
    setBusy(true)
    let actorName = pic
    try {
      actorName = await resolveActorName()
    } catch (error) {
      setBusy(false)
      setReturnFormStatus({ type: 'error', message: error.message || 'Failed to load signed-in user.' })
      return
    }

    let savedCaseCode = ''
    let saveError = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let nextCaseCode = ''
      try {
        nextCaseCode = await generateNextCaseCode(returnForm.group_order, returnForm.tanggal_pengajuan)
        setCaseCode(nextCaseCode)
      } catch (error) {
        saveError = error
        break
      }

      const timestamp = new Date().toISOString()
      const { error } = await deliverySupabase.from('delivery_error_retur_cases').insert({
        ...normalizeReturnPayload(returnForm, nextCaseCode),
        created_at: timestamp,
        created_by: actorName,
        updated_at: timestamp,
        updated_by: actorName,
      })

      if (!error) {
        savedCaseCode = nextCaseCode
        saveError = null
        break
      }

      saveError = error
      if (!isCaseCodeDuplicateError(error)) break
    }

    setBusy(false)
    if (saveError) setReturnFormStatus({ type: 'error', message: `Failed to save case: ${saveError.message}` })
    else {
      setStatus({ type: 'success', message: `Case ${savedCaseCode} was saved successfully.` })
      setReturnFormStatus(null)
      setReturnForm({ ...blankReturn(today), group_order: lockedGroup || 'MOB' })
      setProductEditorResetNonce((current) => current + 1)
      setReturnFormStep(0)
      setReturnFormOpen(false)
      await loadCases()
    }
  }

  function advanceReturnForm() {
    const checks = returnFormStep === 0
      ? [
          [returnForm.order_id, 'Order ID is required.'],
          [returnForm.nama_customer, 'Customer name is required.'],
          [returnForm.no_handphone, 'Phone number is required.'],
          [returnForm.alamat, 'Address is required.'],
          [returnForm.no_resi_pengiriman, 'Shipment AWB is required.'],
        ]
      : [
          [returnForm.retur_reason, 'Return reason is required.'],
          [returnForm.retur_action, 'Follow-up action is required.'],
        ]

    if (returnFormStep === 1) {
      if (returnActionRules.replacementRequired === true) checks.push([returnForm.produk_pengganti, 'Replacement product is required for this follow-up action.'])
      if (returnActionRules.requiresReturn === true) checks.push([returnForm.produk_diretur, 'Returned / problem product is required for this follow-up action.'])
    }

    const missingField = checks.find(([value]) => !String(value || '').trim())
    if (missingField) {
      setReturnFormStatus({ type: 'error', message: missingField[1] })
      return
    }

    setReturnFormStatus(null)
    setReturnFormStep((current) => Math.min(current + 1, 2))
  }

  async function saveIssue() {
    const checks = [
      [issueForm.order_id, 'Order ID is required.'],
      [issueForm.nama, 'Customer name is required.'],
      [issueForm.no_hp, 'Phone number is required.'],
      [issueForm.alasan_bermasalah, 'Issue reason is required.'],
      [issueForm.tindak_lanjut, 'Handling action is required.'],
      [hasMeaningfulBulletText(issueForm.produk_bermasalah), 'Faulty product is required.'],
    ]
    if (issueNeedsCost) checks.push([issueForm.biaya_timbul, 'Additional cost is required for this handling action.'])

    const missingField = checks.find(([value]) => !value)
    if (missingField) {
      setStatus({ type: 'error', message: missingField[1] })
      return
    }
    setBusy(true)
    let actorName = pic
    try {
      actorName = await resolveActorName()
    } catch (error) {
      setBusy(false)
      setStatus({ type: 'error', message: error.message || 'Failed to load signed-in user.' })
      return
    }
    const payload = normalizeIssuePayload(issueForm)
    const timestamp = new Date().toISOString()
    const request = editingIssueId
      ? deliverySupabase.from('delivery_order_issue_cases').update({ ...payload, updated_at: timestamp, updated_by: actorName }).eq('id', editingIssueId)
      : deliverySupabase.from('delivery_order_issue_cases').insert({ ...payload, created_at: timestamp, created_by: actorName, updated_at: timestamp, updated_by: actorName })
    const { error } = await request
    setBusy(false)
    if (error) setStatus({ type: 'error', message: `Failed to save issue: ${error.message}` })
    else {
      setStatus({ type: 'success', message: editingIssueId ? 'Order issue was updated successfully.' : 'Order issue was saved successfully.' })
      setIssueForm({ ...blankIssue(), group_order: lockedGroup || 'ARKLINE' })
      setEditingIssueId(null)
      await loadIssues()
    }
  }

  async function cancelCase() {
    if (!cancelTarget || !ACTIVE_RETURN_STATUSES.has(cancelTarget.status_barang) || cancelInFlightRef.current) return
    cancelInFlightRef.current = true
    setBusy(true)
    try {
      const actorName = await resolveActorName()
      const { data, error } = await deliverySupabase.from('delivery_error_retur_cases')
        .update({ status_barang: 'Cancel', updated_at: new Date().toISOString(), updated_by: actorName })
        .eq('id', cancelTarget.id)
        .eq('status_barang', cancelTarget.status_barang)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('This case has changed. Refresh the list and try again.')
      setStatus({ type: 'success', message: `${cancelTarget.kode_kejadian} was cancelled.` })
      setCancelTarget(null)
      setCancelError('')
      await loadCases()
    } catch (error) {
      setCancelError(`Failed to cancel case: ${error.message || 'Unknown error.'}`)
    } finally {
      cancelInFlightRef.current = false
      setBusy(false)
    }
  }

  const returnField = (key) => (event) => {
    if (key === 'group_order' && lockedGroup) return
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setReturnForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'no_resi_pengiriman' ? { nomor_tim: '' } : {}),
    }))
  }
  const issueField = (key) => (event) => {
    if (key === 'group_order' && lockedGroup) return
    const rawValue = event.target.value
    let value = rawValue
    if (['group_order', 'order_id', 'nama', 'tim'].includes(key)) value = cleanUpper(rawValue)
    if (key === 'no_hp') value = cleanDigits(rawValue)
    setIssueForm((current) => ({ ...current, [key]: value }))
  }

  function resetIssueForm() {
    setIssueForm({ ...blankIssue(), group_order: lockedGroup || 'ARKLINE' })
    setEditingIssueId(null)
  }

  function resetReturnForm() {
    setReturnForm({ ...blankReturn(today), group_order: lockedGroup || 'MOB' })
    setProductEditorResetNonce((current) => current + 1)
    setReturnFormStep(0)
  }

  function openReturnForm() {
    resetReturnForm()
    setCaseCode('')
    setReturnFormStatus(null)
    setReturnFormOpen(true)
  }

  function closeReturnForm() {
    resetReturnForm()
    setCaseCode('')
    setReturnFormStatus(null)
    setReturnFormOpen(false)
  }

  function openIssueDetail(rowOrId, options = {}) {
    const row = typeof rowOrId === 'object' ? rowOrId : accessibleIssues.find((item) => String(item.id) === String(rowOrId))
    if (!row) return
    setIssueDetailReadonly(Boolean(options.readonly))
    setIssueDetail(row)
  }

  function loadIssueEditState(rowOrId) {
    const row = typeof rowOrId === 'object' ? rowOrId : accessibleIssues.find((item) => String(item.id) === String(rowOrId))
    if (!row) return
    setEditingIssueId(row.id)
    setIssueDetail(null)
    setIssueDetailReadonly(false)
    setIssueForm({
      alasan_bermasalah: row.alasan_bermasalah || '',
      biaya_timbul: row.biaya_timbul ?? '',
      group_order: lockedGroup || cleanUpper(row.group_order || 'ARKLINE'),
      keterangan: row.keterangan || '',
      nama: cleanUpper(row.nama),
      no_hp: cleanDigits(row.no_hp),
      order_id: cleanUpper(row.order_id),
      produk_bermasalah: ensureBulletText(row.produk_bermasalah),
      produk_pengganti: ensureBulletText(row.produk_pengganti),
      tim: cleanUpper(row.tim || 'TIM 1'),
      tindak_lanjut: row.tindak_lanjut || '',
    })
    setActiveTab('issues')
    setStatus({ type: 'info', message: `Editing order issue ${row.order_id || '-'}.` })
  }
  const serviceOptions = masters.services.filter((item) => item.courier_name === returnForm.courier_name)
  const detailServiceOptions = masters.services.filter((item) => item.courier_name === detailDraft?.courier_name)
  useEffect(() => {
    const barcode = cleanUpper(returnForm.no_resi_pengiriman)
    if (!barcode) return undefined

    let ignore = false
    const timer = window.setTimeout(async () => {
      const { data, error } = await deliverySupabase
        .from('delivery_barcode')
        .select('barcode,packing_team')
        .eq('barcode', barcode)
        .limit(1)

      if (ignore || error) return
      const packingTeam = cleanUpper(data?.[0]?.packing_team)
      setReturnForm((current) => {
        if (cleanUpper(current.no_resi_pengiriman) !== barcode || current.nomor_tim === packingTeam) return current
        return { ...current, nomor_tim: packingTeam }
      })
    }, 350)

    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [returnForm.no_resi_pengiriman])

  const productSearchRows = useMemo(() => {
    const returnRows = cases.map((row) => ({
        action: row.retur_action || '-',
        code: row.kode_kejadian || '-',
        customer: row.nama_customer || '-',
        dateValue: row.tanggal_pengajuan || row.created_at,
        groupOrder: row.group_order || '-',
        reason: row.retur_reason || '-',
        replacementProduct: row.produk_pengganti || '',
        returnedLabel: 'Return / Faulty Product',
        returnedProduct: row.produk_diretur || '',
        row,
        sourceLabel: 'Return',
        sourceType: 'return',
        returnedEntries: parseProductEntries(row.produk_diretur),
        replacementEntries: parseProductEntries(row.produk_pengganti),
      }))
    const issueRows = issues.map((row) => ({
        action: row.tindak_lanjut || '-',
        code: row.order_id || '-',
        customer: row.nama || '-',
        dateValue: row.created_at,
        groupOrder: row.group_order || '-',
        reason: row.alasan_bermasalah || '-',
        replacementProduct: row.produk_pengganti || '',
        returnedLabel: 'Faulty Product',
        returnedProduct: row.produk_bermasalah || '',
        row,
        sourceLabel: 'Order Issue',
        sourceType: 'issue',
        returnedEntries: parseProductEntries(row.produk_bermasalah),
        replacementEntries: parseProductEntries(row.produk_pengganti),
      }))
    return [...returnRows, ...issueRows]
  }, [cases, issues])

  const productSizeOptions = useMemo(() => {
    const sizes = new Set()
    const keyword = productSearch.trim().toLowerCase()
    for (const row of productSearchRows) {
      if (productSearchFilters.type && row.sourceType !== productSearchFilters.type) continue
      if (productSearchFilters.group && cleanUpper(row.groupOrder) !== productSearchFilters.group) continue
      const entries = productSearchFilters.scope === 'returned' ? row.returnedEntries
        : productSearchFilters.scope === 'replacement' ? row.replacementEntries
          : [...row.returnedEntries, ...row.replacementEntries]
      for (const entry of entries) {
        if (entry.size && (!keyword || entry.raw.toLowerCase().includes(keyword))) sizes.add(cleanUpper(entry.size))
      }
    }
    return [...sizes].sort(new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare)
  }, [productSearchRows, productSearch, productSearchFilters.group, productSearchFilters.scope, productSearchFilters.type])

  useEffect(() => {
    if (productSearchFilters.size && !productSizeOptions.includes(productSearchFilters.size)) {
      setProductSearchFilters((current) => ({ ...current, size: '' }))
    }
  }, [productSearchFilters.size, productSizeOptions])

  const searchResults = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase()
    const selectedSize = productSearchFilters.size
    if (!keyword && !selectedSize) return []
    const matchesProduct = (entries) => entries.some((entry) =>
      (!selectedSize || cleanUpper(entry.size) === selectedSize)
      && (!keyword || entry.raw.toLowerCase().includes(keyword))
    )

    return productSearchRows
      .map((row) => ({
        ...row,
        inReturned: matchesProduct(row.returnedEntries),
        inReplacement: matchesProduct(row.replacementEntries),
      }))
      .filter((row) => {
        const matchType = !productSearchFilters.type || row.sourceType === productSearchFilters.type
        const matchGroup = !productSearchFilters.group || cleanUpper(row.groupOrder) === productSearchFilters.group

        if (!matchType || !matchGroup) return false
        if (productSearchFilters.scope === 'returned') return row.inReturned
        if (productSearchFilters.scope === 'replacement') return row.inReplacement
        return row.inReturned || row.inReplacement
      })
      .map((row) => {
        const foundIn = []
        if (row.inReturned && productSearchFilters.scope !== 'replacement') foundIn.push(row.returnedLabel)
        if (row.inReplacement && productSearchFilters.scope !== 'returned') foundIn.push('Replacement Product')
        return { ...row, foundIn }
      })
      .sort((first, second) => String(second.dateValue || '').localeCompare(String(first.dateValue || '')))
  }, [productSearchRows, productSearch, productSearchFilters.group, productSearchFilters.scope, productSearchFilters.type, productSearchFilters.size])

  const detailStatusOption = detailDraft?.status_barang === 'Completed'
    ? { className: styles.resolutionStatusCompleted, description: 'This return case has been completed.', label: 'Completed' }
    : RETURN_STATUS_OPTIONS[detailDraft?.status_barang] || RETURN_STATUS_OPTIONS.Pending
  const canEditDetail = Boolean(detailDraft) && !detailReadonly && activeTab !== 'receiving' && ACTIVE_RETURN_STATUSES.has(detail?.status_barang)

  const renderDetailSectionHeading = (key, label) => (
    <h3 className={detailSectionsOpen[key] ? '' : styles.resolutionDetailSectionHeadingClosed}>
      <button type="button" className={styles.resolutionDetailSectionToggle} aria-expanded={detailSectionsOpen[key]} aria-controls={`return-case-${key}`} onClick={() => setDetailSectionsOpen((current) => ({ ...current, [key]: !current[key] }))}>
        <span>{label}</span><span className={styles.resolutionDetailChevron} aria-hidden="true">▾</span>
      </button>
    </h3>
  )

  const renderGroupBadge = (group) => <span className={`${styles.casePill} ${styles[`casePill${cleanUpper(group).charAt(0)}${cleanUpper(group).slice(1).toLowerCase()}`] || ''}`}>{group || '-'}</span>
  const renderTypeBadge = (type) => <span className={`${styles.casePill} ${type === 'Internal' ? styles.casePillInternal : type === 'External' ? styles.casePillExternal : ''}`}>{type || '-'}</span>
  const renderReturnStatusBadge = (statusValue) => {
    const value = cleanText(statusValue) || '-'
    const optionClass = RETURN_STATUS_OPTIONS[value]?.className || (value === 'Completed' ? styles.statusCompletedBadge : '')
    return <span className={`${styles.statusBadge} ${optionClass}`}>{value}</span>
  }
  const renderIssueStatusBadge = (row) => {
    const action = normalizeIssueHandlingKey(row?.tindak_lanjut)
    const meta = masters.issueActions.find((item) => normalizeIssueHandlingKey(item.name) === action)
    if (!meta) return <span className={`${styles.statusBadge} ${styles.productIssueUnknown}`}>Status Unavailable</span>
    const pending = isTruthyFlag(meta.is_pending)
    return <span className={`${styles.statusBadge} ${pending ? styles.productIssuePending : styles.productIssueRecorded}`}>{pending ? 'Needs Handling' : 'No Pending Handling'}</span>
  }
  const getGroupFillClass = (group) => styles[`orderIssueFill${cleanUpper(group).charAt(0)}${cleanUpper(group).slice(1).toLowerCase()}`] || ''

  const receivingRows = useMemo(() => {
    const keyword = cleanUpper(receivingFilters.search)
    return cases
      .filter((row) => ['Sending', 'Completed'].includes(row.status_barang))
      .filter((row) => row.status_barang !== 'Completed' || receivingFilters.status === 'Completed' || dateOnly(row.updated_at) >= addDays(today, -2))
      .filter((row) => !receivingFilters.status || row.status_barang === receivingFilters.status)
      .filter((row) => !receivingFilters.group || row.group_order === receivingFilters.group)
      .filter((row) => !receivingFilters.courier || row.courier_name === receivingFilters.courier)
      .filter((row) => !keyword || [row.kode_kejadian, row.nama_customer, row.order_id, row.no_resi_pengiriman].some((value) => cleanUpper(value).includes(keyword)))
  }, [cases, receivingFilters.courier, receivingFilters.group, receivingFilters.search, receivingFilters.status, today])

  const receivingCourierOptions = useMemo(() => {
    return Array.from(new Set(cases.filter((row) => ['Sending', 'Completed'].includes(row.status_barang)).map((row) => cleanUpper(row.courier_name)).filter(Boolean))).sort()
  }, [cases])

  const receivingAddRows = useMemo(() => {
    const keyword = cleanUpper(receivingAddSearch)
    return cases
      .filter((row) => row.status_barang === 'Pending')
      .filter((row) => !keyword || cleanUpper(row.kode_kejadian).includes(keyword))
      .slice(0, 20)
  }, [cases, receivingAddSearch])

  const selectedReceivingAddRows = useMemo(() => {
    const selected = new Set(receivingAddSelectedIds.map(String))
    return receivingAddRows.filter((row) => selected.has(String(row.id)))
  }, [receivingAddRows, receivingAddSelectedIds])

  const receivingReprintRows = useMemo(() => {
    const keyword = cleanUpper(receivingReprintSearch)
    return cases
      .filter((row) => row.status_barang === 'Completed')
      .filter((row) => !isRefundOnlyCase(row))
      .filter((row) => !keyword || [row.kode_kejadian, row.nama_customer, row.no_resi_pengiriman].some((value) => cleanUpper(value).includes(keyword)))
      .slice(0, 30)
  }, [cases, receivingReprintSearch])

  const selectedReceivingRows = useMemo(() => {
    const selected = new Set(receivingSelectedIds.map(String))
    return receivingRows.filter((row) => row.status_barang === 'Sending' && selected.has(String(row.id)))
  }, [receivingRows, receivingSelectedIds])

  const selectedReprintRows = useMemo(() => {
    const selected = new Set(receivingReprintSelectedIds.map(String))
    return receivingReprintRows.filter((row) => selected.has(String(row.id)))
  }, [receivingReprintRows, receivingReprintSelectedIds])

  const allReceivingSelected = receivingRows.some((row) => row.status_barang === 'Sending') && receivingRows.filter((row) => row.status_barang === 'Sending').every((row) => receivingSelectedIds.includes(String(row.id)))

  function resolveReturnBarcodePattern(courierName) {
    const normalizedName = normalizeBarcodeRuleKey(courierName)
    if (!normalizedName) return ''
    const rows = (masters.barcodeRules || [])
      .map((row) => ({
        matchType: String(row.match_type || '').trim().toLowerCase(),
        pattern: sanitizeBarcodePattern(row.pattern),
        resultValue: row.result_value,
      }))
      .filter((row) => row.matchType === 'suffix' && row.pattern && row.resultValue)
    const exactMatches = rows.filter((row) => normalizeBarcodeRuleKey(row.resultValue) === normalizedName)
    const looseMatches = rows.filter((row) => {
      const key = normalizeBarcodeRuleKey(row.resultValue)
      return key && (key.includes(normalizedName) || normalizedName.includes(key))
    })
    return (exactMatches[0] || looseMatches[0])?.pattern || ''
  }

  function prepareReceivingPrintRows(rows) {
    return rows.map((row) => {
      const pattern = resolveReturnBarcodePattern(row.courier_name)
      return {
        ...row,
        barcode_pattern: pattern,
        barcode_source: `R${cleanUpper(row.kode_kejadian)}${pattern}`,
      }
    })
  }

  function buildReceivingLabelHtml(rows) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Print Return Label</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39+Extended+Text&display=swap" rel="stylesheet"><style>@page{size:A6;margin:6mm}body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;color:#111827;background:#fff}.sheet{display:grid;gap:6mm}.label{page-break-after:always;border:1.5px solid #0f172a;border-radius:10px;padding:10px}.label:last-child{page-break-after:auto}.top{border-bottom:1.5px solid #0f172a;padding-bottom:8px;margin-bottom:10px}.title{font-size:17px;font-weight:900;letter-spacing:.08em;text-align:center}.meta{margin-top:6px;display:flex;justify-content:space-between;gap:10px;font-size:11px;font-weight:800;text-transform:uppercase}.block{border:1px solid #cbd5e1;border-radius:8px;padding:7px 8px;margin-top:7px}.k{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#475569}.v{margin-top:4px;font-size:12px;line-height:1.35;font-weight:600;white-space:pre-wrap;word-break:break-word}.v.big{font-size:14px;font-weight:800}.double{display:grid;grid-template-columns:1fr 1fr;gap:7px;align-items:start}.barcode-wrap{margin-top:10px;border:1.5px dashed #94a3b8;border-radius:10px;padding:10px 6px;overflow:hidden}.barcode{font-family:"Libre Barcode 39 Extended Text",cursive;font-size:46px;line-height:1;text-align:center;white-space:nowrap}</style></head><body><div class="sheet">${rows.map((row) => {
      const barcodeValue = `*${row.barcode_source || `R${cleanUpper(row.kode_kejadian)}${row.barcode_pattern || ''}`}*`
      return `<div class="label"><div class="top"><div class="title">FORM RETUR</div><div class="meta"><span>${escapeHtml(row.group_order || '-')}</span><span>${escapeHtml(`${row.courier_name || '-'}${row.courier_service ? ` - ${row.courier_service}` : ''}`)}</span></div></div><div class="double"><div class="block"><div class="k">Customer Name</div><div class="v big">${escapeHtml(row.nama_customer || '-')}</div></div><div class="block"><div class="k">Phone Number</div><div class="v">${escapeHtml(row.no_handphone || '-')}</div></div></div><div class="block"><div class="k">Address</div><div class="v">${escapeHtml(row.alamat || '-')}</div></div><div class="block"><div class="k">Replacement Product</div><div class="v">${escapeHtml(formatProductEntries(row.produk_pengganti))}</div></div><div class="block"><div class="k">Item Value</div><div class="v">${escapeHtml(formatMoney(row.total_retur))}</div></div><div class="barcode-wrap"><div class="barcode">${escapeHtml(barcodeValue)}</div></div></div>`
    }).join('')}</div></body></html>`
  }

  function printReceivingRows(rows, preparedWindow) {
    const printableRows = rows.filter((row) => !isRefundOnlyCase(row))
    if (!printableRows.length) {
      setStatus({ type: 'error', message: rows.length ? 'Refund follow-up cases cannot be printed.' : 'Select at least one case to print.' })
      return false
    }
    const preparedRows = prepareReceivingPrintRows(printableRows)
    const printWindow = preparedWindow === undefined ? window.open('', '_blank', 'width=900,height=700') : preparedWindow
    if (!printWindow) {
      setStatus({ type: 'error', message: 'Print popup was blocked. Please allow popups and try again.' })
      return false
    }
    printWindow.document.open()
    printWindow.document.write(buildReceivingLabelHtml(preparedRows))
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => printWindow.print(), 500)
    return true
  }

  function openReceivingInspection() {
    setReceivingInspectionCases(buildReceivingInspectionCases(selectedReceivingRows))
    setReceivingConfirmStep('inspect')
    setReceivingConfirmError('')
    setReceivingConfirmOpen(true)
  }

  function closeReceivingInspection() {
    if (busy || receivingLookupBusy) return
    setReceivingConfirmOpen(false)
    setReceivingInspectionCases([])
    setReceivingConfirmStep('inspect')
    setReceivingConfirmError('')
  }

  function updateReceivingInspectionLine(caseId, lineKey, patch) {
    setReceivingInspectionCases((current) => current.map((inspectedCase) => (
      String(inspectedCase.caseId) !== String(caseId)
        ? inspectedCase
        : { ...inspectedCase, lines: inspectedCase.lines.map((line) => line.key === lineKey ? { ...line, ...patch } : line) }
    )))
    setReceivingConfirmError('')
  }

  function updateReceivingInspectionQty(inspectedCase, line, field, rawValue) {
    const otherFields = ['storedQty', 'rejectQty', 'lostQty'].filter((key) => key !== field)
    const remaining = Math.max(0, line.expectedQty - otherFields.reduce((sum, key) => sum + Number(line[key] || 0), 0))
    const value = rawValue === '' ? '' : String(Math.min(remaining, Math.max(0, Math.trunc(Number(rawValue) || 0))))
    updateReceivingInspectionLine(inspectedCase.caseId, line.key, { [field]: value })
  }

  function receivingQtyRemaining(line, field) {
    return Math.max(0, line.expectedQty - ['storedQty', 'rejectQty', 'lostQty']
      .filter((key) => key !== field)
      .reduce((sum, key) => sum + Number(line[key] || 0), 0))
  }

  async function findArklineShelvingLocations(casesToResolve) {
    const requiredLines = casesToResolve.flatMap((inspectedCase) => (
      inspectedCase.group === 'ARKLINE'
        ? inspectedCase.lines.filter((line) => Number(line.storedQty || 0) > 0).map((line) => ({ ...line, caseId: inspectedCase.caseId }))
        : []
    ))
    if (!requiredLines.length) return casesToResolve

    const prefixes = [...new Set(requiredLines.map((line) => arklineSkuKey(line.sku)).filter(Boolean))]
    if (!prefixes.length) {
      throw new Error('Could not identify an Arkline SKU for shelving lookup.')
    }

    const storageRows = []
    const lookupFilter = prefixes.flatMap((prefix) => [`sku_id.ilike.${prefix}%`, `source_variant_code.ilike.${prefix}%`]).join(',')
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await deliverySupabase
        .from('warehouse_storage')
        .select('id, rack_location_id, sku_id, source_variant_code, size')
        .or(lookupFilter)
        .order('id', { ascending: true })
        .range(offset, offset + 999)
      if (error) throw error
      storageRows.push(...(data || []))
      if (!data || data.length < 1000) break
    }

    const matchesByLine = requiredLines.map((line) => {
      const skuKey = arklineSkuKey(line.sku)
      const rows = storageRows.filter((stock) => (
        String(stock.sku_id ?? stock.source_variant_code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').startsWith(skuKey) &&
        stockSizesMatch(stock.size, line.size) && stock.rack_location_id != null
      ))
      return { line, locationIds: [...new Set(rows.map((stock) => String(stock.rack_location_id)))] }
    })
    const locationIds = [...new Set(matchesByLine.flatMap((match) => match.locationIds))]
    const { data: locations, error: locationError } = locationIds.length
      ? await deliverySupabase.from('dir_rack_locations').select('id, location_type, location_id, location_code, sub_location, group_code').in('id', locationIds)
      : { data: [], error: null }
    if (locationError) throw locationError
    const locationById = new Map((locations || []).map((location) => [String(location.id), location]))

    return casesToResolve.map((inspectedCase) => ({
      ...inspectedCase,
      lines: inspectedCase.lines.map((line) => {
        const match = matchesByLine.find((item) => item.line.key === line.key && String(item.line.caseId) === String(inspectedCase.caseId))
        if (!match) return line
        const shelvingLocations = match.locationIds
          .map((id) => locationById.get(id))
          .filter((location) => location && cleanUpper(location.group_code) === 'ARKLINE' && cleanUpper(location.location_type) === 'SHELVING')
        const distinct = [...new Map(shelvingLocations.map((location) => [String(location.id), location])).values()]
        return {
          ...line,
          shelvingLocation: distinct.length === 1 ? formatShelvingLocation(distinct[0]) : '',
          shelvingLocationStatus: distinct.length === 1 ? 'FOUND' : distinct.length ? 'MULTIPLE' : 'MISSING',
        }
      }),
    }))
  }

  async function continueReceivingInspection() {
    const error = inspectReceivingDecisions(receivingInspectionCases)
    if (error) {
      setReceivingConfirmError(error)
      return
    }
    setReceivingLookupBusy(true)
    setReceivingConfirmError('')
    try {
      const casesWithLocations = await findArklineShelvingLocations(receivingInspectionCases)
      setReceivingInspectionCases(casesWithLocations)
      setReceivingConfirmStep('review')
    } catch (lookupError) {
      setReceivingConfirmError(lookupError.message || 'Failed to find Arkline shelving locations.')
    } finally {
      setReceivingLookupBusy(false)
    }
  }

  async function completeReceivingRows() {
    const validationError = inspectReceivingDecisions(receivingInspectionCases, { requireShelvingLookup: true })
    if (validationError) {
      setReceivingConfirmError(validationError)
      return
    }
    const printableRows = receivingInspectionCases.map((item) => item.row).filter((row) => !isRefundOnlyCase(row))
    const printWindow = printableRows.length ? window.open('', '_blank', 'width=900,height=700') : null
    setBusy(true)
    try {
      const payload = receivingInspectionCases.map((inspectedCase) => ({
        case_id: inspectedCase.caseId,
        lines: inspectedCase.lines.map((line) => ({
          sku: cleanUpper(line.sku),
          product_name: cleanText(line.productName),
          size: cleanUpper(line.size),
          expected_qty: line.expectedQty,
          stored_qty: Number(line.storedQty || 0),
          reject_qty: Number(line.rejectQty || 0),
          lost_qty: Number(line.lostQty || 0),
          reject_reason: cleanText(line.rejectReason),
          lost_reason: cleanText(line.lostReason),
        })),
      }))
      const { error } = await deliverySupabase.rpc('complete_delivery_return_cases', { p_cases: payload })
      if (error) throw error

      const printed = printableRows.length ? printReceivingRows(printableRows, printWindow) : false
      const completedCount = receivingInspectionCases.length
      setReceivingConfirmOpen(false)
      setReceivingInspectionCases([])
      setReceivingConfirmError('')
      setReceivingSelectedIds([])
      setStatus({
        type: 'success',
        message: `${completedCount} receiving case${completedCount > 1 ? 's' : ''} completed.${printed ? ' Return labels opened for printing.' : printableRows.length ? ' Use Reprint if the browser blocked the print window.' : ''}`,
      })
      await loadCases()
    } catch (error) {
      if (printWindow && !printWindow.closed) printWindow.close()
      setReceivingConfirmError(error.message || 'Failed to complete receiving.')
    } finally {
      setBusy(false)
    }
  }

  async function addRowsToReceiving(rows) {
    const scopedRows = lockedGroup ? rows.filter((row) => cleanUpper(row?.group_order) === lockedGroup) : rows
    if (lockedGroup && scopedRows.length !== rows.length) {
      setStatus({ type: 'error', message: `Only ${lockedGroup} cases can be processed by this role.` })
      return
    }
    const pendingRows = scopedRows.filter((row) => row?.status_barang === 'Pending')
    if (!pendingRows.length) {
      setStatus({ type: 'error', message: 'Only Pending cases can be added to Receiving Confirmation.' })
      return
    }

    setBusy(true)
    let actorName = pic
    try {
      actorName = await resolveActorName()
    } catch (error) {
      setBusy(false)
      setStatus({ type: 'error', message: error.message || 'Failed to load signed-in user.' })
      return
    }

    const ids = pendingRows.map((row) => row.id).filter(Boolean)
    const { error } = await deliverySupabase
      .from('delivery_error_retur_cases')
      .update({ status_barang: 'Sending', updated_at: new Date().toISOString(), updated_by: actorName })
      .in('id', ids)

    setBusy(false)
    if (error) {
      setStatus({ type: 'error', message: `Failed to add case to Receiving Confirmation: ${error.message}` })
      return
    }

    setReceivingAddOpen(false)
    setReceivingAddSearch('')
    setReceivingAddSelectedIds([])
    setStatus({ type: 'success', message: `${pendingRows.length} case${pendingRows.length > 1 ? 's' : ''} added to Sending.` })
    await loadCases()
  }

  async function addCaseToReceiving(row) {
    if (!row) return
    await addRowsToReceiving([row])
  }

  async function addCaseByCode() {
    if (selectedReceivingAddRows.length) {
      await addRowsToReceiving(selectedReceivingAddRows)
      return
    }

    const code = cleanUpper(receivingAddSearch)
    if (!code) {
      setStatus({ type: 'error', message: 'Select at least one Pending case or enter a case code first.' })
      return
    }
    const { data, error } = await deliverySupabase
      .from('delivery_error_retur_cases')
      .select('*')
      .eq('kode_kejadian', code)
      .limit(1)
      .maybeSingle()
    if (error) {
      setStatus({ type: 'error', message: `Failed to find case: ${error.message}` })
      return
    }
    if (!data) {
      setStatus({ type: 'error', message: 'Case code was not found.' })
      return
    }
    await addCaseToReceiving(data)
  }

  const displayDetailValue = (key, value) => {
    if (key === 'group_order') return renderGroupBadge(value)
    if (key === 'internal_external') return renderTypeBadge(value)
    if (key === 'need_prioritized') return value ? 'Yes' : 'No'
    if (RETURN_FINANCIAL_FIELDS.some(([field]) => field === key)) return formatMoney(value)
    if (['tanggal_pengajuan', 'batas_tanggal_retur'].includes(key)) return formatDate(value)
    return value || '-'
  }

  const renderDetailField = ({ key, label, options = [], textarea = false, type = 'text', readonly = false }) => {
    const value = detailDraft?.[key] ?? ''
    const labelNode = RETURN_FINANCIAL_HELP[key] ? labelWithInfo(label, RETURN_FINANCIAL_HELP[key]) : label
    if (canEditDetail && detailMode === 'edit' && !readonly) {
      if (options.length) {
        return (
          <label key={key} className={styles.resolutionDetailField}>
            <span>{labelNode}</span>
            <select value={value} onChange={detailField(key)} disabled={key === 'group_order' && Boolean(lockedGroup)}>
              <option value="">Select</option>
              {options.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        )
      }
      if (textarea) {
        return <label key={key} className={`${styles.resolutionDetailField} ${styles.fullField}`}><span>{labelNode}</span><textarea value={value} onChange={detailField(key)} /></label>
      }
      return <label key={key} className={styles.resolutionDetailField}><span>{labelNode}</span><input type={type} value={value} onChange={detailField(key)} /></label>
    }
    return <div key={key} className={styles.resolutionDetailValue}><span>{labelNode}</span><strong>{displayDetailValue(key, value)}</strong></div>
  }

  const renderDetailProductField = ({ key, label }) => {
    const value = detailDraft?.[key] ?? ''
    const actionMeta = masters.actions.find((item) => String(item.name || '').trim() === String(detailDraft?.retur_action || '').trim()) || null
    const actionRules = getReturnActionRules(actionMeta)
    const required = key === 'produk_diretur' ? actionRules.requiresReturn === true : actionRules.replacementRequired === true

    if (canEditDetail && detailMode === 'edit') {
      return (
        <div key={key} className={styles.fullField}>
          <ProductBreakdownEditor
            key={`detail-product-${key}-${value || 'empty'}`}
            arklineEnabled={cleanUpper(detailDraft?.group_order) === 'ARKLINE'}
            arklineProducts={arklineProducts}
            label={label}
            onChange={(nextValue) => setDetailDraft((current) => ({ ...current, [key]: nextValue }))}
            required={required}
            value={value}
          />
        </div>
      )
    }

    return <div key={key} className={`${styles.resolutionDetailValue} ${styles.fullField}`}><span>{label}</span><strong className={styles.preformattedDetailValue}>{formatProductEntries(value)}</strong></div>
  }

  return (
    <div className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Delivery Report • Returns"
        subtitle="Manage and monitor delivery return cases and order issues in a structured workflow."
        title="Resolution Monitoring Center"
      />
      <div className={styles.resolutionTabs}>{TABS.map(([id, label]) => <button key={id} className={activeTab === id ? styles.active : ''} onClick={() => setActiveTab(id)}>{label}</button>)}</div>
      <div className={styles.resolutionTabPanel}>
      {!returnFormOpen ? <StatusMessage status={status} /> : null}

      {activeTab === 'registration' ? (
        <>
          <section className={styles.resolutionRegistrationSurface}>
            <Modal
              open={returnFormOpen}
              title="Input New Case"
              description="Register a return case with customer, shipment, product, and follow-up details."
              hideHeader
              portal
              className={styles.returnWizardModal}
              onClose={closeReturnForm}
            >
            <article className={styles.formPanel}>
              <div className={styles.returnWizardTopbar}>
                <div className={styles.returnWizardCaseCode}>
                  <span>CASE CODE</span>
                  <div className={styles.returnWizardCodeLine}>
                    <strong>{caseCode || '...'}</strong>
                    <label className={styles.returnWizardPriorityField}><input type="checkbox" checked={returnForm.need_prioritized} onChange={returnField('need_prioritized')} /><span>Priority case</span></label>
                  </div>
                </div>
                <div className={styles.returnWizardProgress}>
                  <div className={styles.returnWizardProgressMeta}><strong>Step {returnFormStep + 1} of 3</strong></div>
                  <div className={styles.returnWizardProgressTrack}><span style={{ width: `${((returnFormStep + 1) / 3) * 100}%` }} /></div>
                  <div className={styles.returnWizardStepLabels} role="group" aria-label="Return case form steps">
                    {['Subject Identity', 'Return Details', 'Shipping'].map((label, index) => (
                      <button key={label} type="button" className={index === returnFormStep ? styles.active : ''} aria-current={index === returnFormStep ? 'step' : undefined} onClick={() => { setReturnFormStatus(null); setReturnFormStep(index) }}>
                        {String(index + 1).padStart(2, '0')} {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.panelBody}>
                <StatusMessage status={returnFormStatus} />
                {returnFormStep === 0 ? (
                  <>
                <section className={styles.resolutionCaseHeaderCompact}>
                  <div className={styles.resolutionDateRow}>
                    <label><span>SUBMISSION DATE</span><input type="date" value={returnForm.tanggal_pengajuan} onChange={(event) => setReturnForm({ ...returnForm, batas_tanggal_retur: addDays(event.target.value, 14), tanggal_pengajuan: event.target.value })} /></label>
                    <label><span>RETURN DEADLINE</span><input type="date" value={returnForm.batas_tanggal_retur} onChange={returnField('batas_tanggal_retur')} /></label>
                  </div>
                  <div className={styles.resolutionChoiceRow}>
                    <div><span className={styles.fieldTitle}>GROUP ORDER</span><div className={styles.choicePills}>{groupOptions.map((group) => <button key={group} disabled={Boolean(lockedGroup)} className={`${returnForm.group_order === group ? styles.active : ''} ${GROUP_CHOICE_CLASS[group] || ''}`} onClick={() => setReturnForm({ ...returnForm, group_order: lockedGroup || group })}>{group}</button>)}</div></div>
                    <div><span className={styles.fieldTitle}>INTERNAL / EXTERNAL</span><div className={styles.choicePills}>{['Internal', 'External'].map((type) => <button key={type} className={`${returnForm.internal_external === type ? styles.active : ''} ${TYPE_CHOICE_CLASS[type] || ''}`} onClick={() => setReturnForm({ ...returnForm, internal_external: type })}>{type}</button>)}</div></div>
                  </div>
                </section>

                <section className={styles.returnWizardStepBody}>
                  <div className={`${styles.formGrid} ${styles.resolutionIdentityGrid}`}>
                    <label><span>{labelText('ORDER ID', true)}</span><input value={returnForm.order_id} onChange={returnField('order_id')} /></label>
                    <label><span>{labelText('CUSTOMER NAME', true)}</span><input value={returnForm.nama_customer} onChange={returnField('nama_customer')} /></label>
                    <label><span>{labelText('PHONE NUMBER', true)}</span><input type="tel" inputMode="numeric" value={returnForm.no_handphone} onChange={(event) => setReturnForm((current) => ({ ...current, no_handphone: cleanDigits(event.target.value) }))} /></label>
                    <label className={styles.fullField}><span>{labelText('ADDRESS', true)}</span><textarea value={returnForm.alamat} onChange={returnField('alamat')} /></label>
                    <label><span>{labelText('SHIPMENT AWB', true)}</span><input value={returnForm.no_resi_pengiriman} onChange={returnField('no_resi_pengiriman')} /></label>
                    <label><span>PACKING TEAM</span><input readOnly placeholder="Auto-filled from shipment AWB" value={returnForm.nomor_tim} /></label>
                  </div>
                </section>
                  </>
                ) : null}

                {returnFormStep === 1 ? <section className={`${styles.resolutionFormSection} ${styles.returnWizardDetailsStep}`}>
                  <div className={styles.formGrid}>
                    <label><span>{labelText('RETURN REASON', true)}</span><select value={returnForm.retur_reason} onChange={returnField('retur_reason')}><option value="">SELECT REASON</option>{masters.reasons.filter((item) => !item.reasoning_type || item.reasoning_type.toLowerCase() === returnForm.internal_external.toLowerCase()).map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
                    <div className={styles.returnWizardFollowUpGroup}>
                      <div className={styles.returnWizardFollowUpHead}>
                        <label htmlFor="return-wizard-follow-up">{labelText('FOLLOW-UP ACTION', true)}</label>
                      </div>
                      <select id="return-wizard-follow-up" value={returnForm.retur_action} onChange={returnField('retur_action')}><option value="">SELECT FOLLOW-UP</option>{masters.actions.map((item) => <option key={item.id}>{item.name}</option>)}</select>
                    </div>
                    <div className={styles.returnWizardProductGrid}>
                      <ProductBreakdownEditor
                        key={`return-product-${productEditorResetNonce}-${returnForm.produk_diretur || 'empty'}`}
                        arklineEnabled={cleanUpper(returnForm.group_order) === 'ARKLINE'}
                        arklineProducts={arklineProducts}
                        label="RETURN / FAULTY PRODUCT"
                        onChange={(value) => setReturnForm((current) => ({ ...current, produk_diretur: value }))}
                        required={returnActionRules.requiresReturn === true}
                        value={returnForm.produk_diretur}
                      />
                      <div className={styles.returnWizardProductDivider} aria-hidden="true"><span /></div>
                      <ProductBreakdownEditor
                        key={`replacement-product-${productEditorResetNonce}-${returnForm.produk_pengganti || 'empty'}`}
                        arklineEnabled={cleanUpper(returnForm.group_order) === 'ARKLINE'}
                        arklineProducts={arklineProducts}
                        label="REPLACEMENT PRODUCT"
                        onChange={(value) => setReturnForm((current) => ({ ...current, produk_pengganti: value }))}
                        required={returnActionRules.replacementRequired === true}
                        value={returnForm.produk_pengganti}
                      />
                    </div>
                  </div>
                </section>
                : null}

                {returnFormStep === 2 ? (
                  <div className={styles.returnWizardFinalLayout}>
                  <section className={`${styles.resolutionFormSection} ${styles.returnWizardShippingStep}`}>
                    <div className={styles.returnWizardShippingLayout}>
                      <div className={`${styles.formGrid} ${styles.returnWizardShippingFields}`}>
                        <label><span>{labelText('SHIPPING COURIER', returnActionRules.replacementRequired === true)}</span><select value={returnForm.courier_name} onChange={(event) => setReturnForm({ ...returnForm, courier_name: event.target.value, courier_service: '' })}><option value="">SELECT COURIER</option>{masters.couriers.map((item) => <option key={item.id}>{item.nama}</option>)}</select></label>
                        <label><span>SHIPPING SERVICE</span><select value={returnForm.courier_service} onChange={returnField('courier_service')}><option value="">SELECT SERVICE</option>{serviceOptions.map((item) => <option key={item.id}>{item.courier_service}</option>)}</select></label>
                        {RETURN_FINANCIAL_FIELDS.map(([key, label]) => {
                          const required = (key === 'nilai_refund_kompensasi' && returnActionRules.requireRefundValue === true) || (key === 'total_retur' && returnActionRules.replacementRequired === true)
                          return <label key={key}><span>{labelWithInfo(label.toUpperCase(), RETURN_FINANCIAL_HELP[key], required)}</span><input inputMode="numeric" value={returnForm[key]} onChange={returnField(key)} /></label>
                        })}
                      </div>
                      <div className={styles.returnWizardShippingNotes}>
                        <label className={styles.returnWizardNoteField}><span>INTERNAL ADDITIONAL NOTES</span><textarea value={returnForm.keterangan_tambahan} onChange={returnField('keterangan_tambahan')} /></label>
                        <label className={styles.returnWizardNoteField}><span>CUSTOMER NOTES</span><textarea value={returnForm.note_konsumen} onChange={returnField('note_konsumen')} /></label>
                      </div>
                    </div>
                  </section>
                  <section className={`${styles.resolutionFormSection} ${styles.resolutionStatusSection} ${styles.returnWizardStatusStep}`}>
                  <div className={styles.resolutionStaticSectionTitle}>Status</div>
                  <div className={styles.resolutionStatusPanel}>
                    <div className={`${styles.resolutionStatusPreview} ${RETURN_STATUS_OPTIONS[returnForm.status_barang]?.className || ''}`}>
                      <span>ACTIVE STATUS</span>
                      <strong>{RETURN_STATUS_OPTIONS[returnForm.status_barang]?.label || returnForm.status_barang}</strong>
                      <p>{RETURN_STATUS_OPTIONS[returnForm.status_barang]?.description || 'Select the current case status.'}</p>
                    </div>
                    <div className={styles.resolutionStatusControls}>
                      <div className={styles.resolutionStatusButtons}>
                        {Object.entries(RETURN_STATUS_OPTIONS).filter(([value]) => value === 'Sending' || value === 'Pending').map(([value, option]) => (
                          <button
                            key={value}
                            className={`${returnForm.status_barang === value ? styles.active : ''} ${option.className}`}
                            onClick={() => setReturnForm({ ...returnForm, status_barang: value })}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  </section>
                  </div>
                ) : null}

                <div className={styles.returnWizardFooter}>
                  <span className={styles.returnWizardMeta}>Step {returnFormStep + 1} of 3</span>
                  <div className={styles.returnWizardActions}>
                    {returnFormStep > 0 ? <button type="button" className={styles.softButton} onClick={() => { setReturnFormStatus(null); setReturnFormStep((current) => current - 1) }}>Back</button> : <button type="button" className={styles.softButton} onClick={resetReturnForm}>Reset Form</button>}
                    {returnFormStep < 2 ? <button type="button" className={styles.primaryButton} onClick={advanceReturnForm}>Next</button> : <button type="button" className={styles.primaryButton} disabled={busy} onClick={saveReturn}>{busy ? 'Saving...' : 'Save Case'}</button>}
                  </div>
                </div>
              </div>
            </article>
            </Modal>

              <article className={styles.resolutionInsightCard}>
                <div className={`${styles.cardTitleRow} ${styles.returnChartHeader}`}>
                  <div className={styles.returnChartTitleGroup}>
                    <h2>RETURN ANALYTICS</h2>
                    <button type="button" className={styles.inputNewCaseButton} onClick={openReturnForm} aria-label="Input New Case" title="Input New Case">+</button>
                  </div>
                  <div className={styles.returnChartControls}>
                    <label className={styles.returnChartDateField}><span>DATE FROM</span><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
                    <label className={styles.returnChartDateField}><span>DATE TO</span><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
                    <label className={styles.returnChartModeSelectWrap}>
                      <select className={styles.returnChartModeSelect} aria-label="Return chart view" value={returnChartMode} onChange={(event) => setReturnChartMode(event.target.value)}>
                        <option value="groups">Group</option>
                        <option value="types">Internal / External</option>
                        <option value="reason">Top Return Reason</option>
                        <option value="action">Top Follow Up</option>
                        <option value="product">Top Return Product</option>
                      </select>
                    </label>
                    <label className={styles.returnChartGroupSelectWrap}>
                      <select className={styles.returnChartGroupSelect} aria-label="Group" value={filters.group} onChange={(event) => setFilters({ ...filters, group: lockedGroup || event.target.value })} disabled={Boolean(lockedGroup)}>{lockedGroup ? null : <option value="">All Groups</option>}{groupOptions.map((group) => <option key={group}>{group}</option>)}</select>
                    </label>
                    {returnChartMode === 'groups' || returnChartMode === 'types' ? (
                      <div className={styles.returnChartPeriodToggle} role="group" aria-label="Chart interval">
                        {[
                          ['day', 'Day'],
                          ['month', 'Month'],
                          ['year', 'Year'],
                        ].map(([value, label]) => <button key={value} type="button" className={returnChartPeriod === value ? styles.active : ''} aria-pressed={returnChartPeriod === value} onClick={() => setReturnChartPeriod(value)}>{label}</button>)}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className={styles.returnChartMetaRow}>
                  <div className={styles.returnChartMetrics}>
                    <div className={styles.returnChartTotal}><span>Total Cases</span><strong>{summaryCases.length}</strong></div>
                    <div className={styles.returnChartTotal}><span>Internal / External</span><strong>{stats.internal} / {stats.external}</strong></div>
                  </div>
                  {returnChartMode === 'groups' || returnChartMode === 'types' ? (
                    <div className={styles.returnChartLegend}>
                      {(returnChartMode === 'types' ? returnChartTypes : returnChartGroups).map((series) => <span key={series}><i style={{ background: RETURN_CHART_COLORS[series] }} />{RETURN_CHART_LABELS[series]}</span>)}
                    </div>
                  ) : <div />}
                </div>
                <MemoizedResolutionReturnChart bars={returnChartBars} groups={returnChartGroups} mode={returnChartMode} timeline={returnChartTimeline} types={returnChartTypes} />
              </article>
          </section>

          <section className={`${styles.tablePanel} ${styles.resolutionCaseListPanel}`}>
            <div className={styles.resolutionCaseListHeader}>
              <div>
                <div className={styles.resolutionCaseListTitleRow}>
                  <h2>Case Lists</h2>
                  <span className={styles.caseCountPill}>{visibleCases.length} Rows</span>
                  <span className={styles.warningCountPill}>{caseListStats.warning} Warning</span>
                  <span className={styles.overdueCountPill}>{caseListStats.overdue} Overdue</span>
                </div>
                <p>Monitor cases quickly with filters, detail views, edits, and direct status updates.</p>
              </div>
              <div className={styles.resolutionCaseFilters}>
                <label><span>COURIER</span><select value={filters.courier} onChange={(event) => setFilters({ ...filters, courier: event.target.value })}><option value="">ALL COURIERS</option>{courierOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>INTERNAL / EXTERNAL</span><select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">ALL TYPES</option><option value="Internal">Internal</option><option value="External">External</option></select></label>
                <label><span>STATUS</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">ALL STATUSES</option>{caseStatusOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className={styles.searchField}><span>SEARCH</span><input placeholder="Search case code, order ID, AWB, or customer name" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
                <button className={`${styles.warningOnlyButton} ${filters.warningOnly ? styles.active : ''}`} onClick={() => setFilters({ ...filters, warningOnly: !filters.warningOnly })} aria-pressed={filters.warningOnly}>Warning Only</button>
              </div>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.tableWrap}><table><thead><tr><th>Date</th><th>Code</th><th>Group</th><th>Type</th><th>Customer</th><th>Order ID</th><th>AWB</th><th>Return Reason</th><th>Follow Up</th><th>Status</th><th>Action</th></tr></thead><tbody>
                {!visibleCases.length ? <tr><td colSpan="11"><EmptyState label="No data yet" /></td></tr> : visibleCases.map((row) => {
                  const meta = getCaseWarningMeta(row, today)
                  const rowTone = meta.rank === 2 ? styles.caseRowOverdue : meta.rank > 0 ? styles.caseRowWarning : ''
                  return <tr key={row.id} className={rowTone}><td>{formatShortDate(row.tanggal_pengajuan)}</td><td><strong>{row.kode_kejadian}</strong></td><td>{renderGroupBadge(row.group_order)}</td><td>{renderTypeBadge(row.internal_external)}</td><td><strong>{row.nama_customer || '-'}</strong><small>{row.nomor_tim || row.created_by || '-'}</small></td><td>{row.order_id}</td><td>{row.no_resi_pengiriman}</td><td>{row.retur_reason || '-'}</td><td>{row.retur_action || '-'}</td><td>{renderReturnStatusBadge(row.status_barang)}</td><td><div className={styles.rowActions}><button type="button" className={styles.iconActionButton} aria-label={`Open detail for ${row.kode_kejadian || row.order_id}`} onClick={() => openCaseDetail(row)}>🔍</button><button type="button" className={styles.cancelCaseActionButton} disabled={!ACTIVE_RETURN_STATUSES.has(row.status_barang)} aria-label={`Cancel case ${row.kode_kejadian || row.order_id}`} title={ACTIVE_RETURN_STATUSES.has(row.status_barang) ? 'Cancel case' : `Cannot cancel a ${row.status_barang || 'closed'} case`} onClick={() => { setCancelError(''); setCancelTarget(row) }}>×</button></div></td></tr>
                })}
              </tbody></table></div>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'receiving' ? (
        <section className={`${styles.dataCard} ${styles.receivingConfirmationPanel}`}>
          <div className={styles.cardTitleRow}>
            <h2>RECEIVING CONFIRMATION</h2>
          </div>
          <div className={styles.receivingToolbar}>
            <span className={styles.caseCountPill}>{receivingRows.length} Cases</span>
            <span className={styles.selectedCountPill}>{selectedReceivingRows.length} Selected</span>
            <label className={styles.inlineCheck}><input className={styles.compactCheckbox} type="checkbox" checked={allReceivingSelected} onChange={(event) => setReceivingSelectedIds(event.target.checked ? receivingRows.filter((row) => row.status_barang === 'Sending').map((row) => String(row.id)) : [])} /> Select All</label>
            <select className={styles.receivingSelect} aria-label="Status" value={receivingFilters.status} onChange={(event) => { setReceivingSelectedIds([]); setReceivingFilters({ ...receivingFilters, status: event.target.value }) }}><option value="">ALL STATUS</option><option value="Sending">SENDING</option><option value="Completed">COMPLETED</option></select>
            <select className={styles.receivingSelect} aria-label="Group Order" value={receivingFilters.group} onChange={(event) => setReceivingFilters({ ...receivingFilters, group: lockedGroup || event.target.value })} disabled={Boolean(lockedGroup)}>{lockedGroup ? null : <option value="">ALL GROUPS</option>}{groupOptions.map((group) => <option key={group}>{group}</option>)}</select>
            <select className={styles.receivingSelect} aria-label="Courier" value={receivingFilters.courier} onChange={(event) => setReceivingFilters({ ...receivingFilters, courier: event.target.value })}><option value="">ALL COURIERS</option>{receivingCourierOptions.map((courier) => <option key={courier}>{courier}</option>)}</select>
            <input className={styles.receivingToolbarSearch} aria-label="Search receiving cases" placeholder="SEARCH CODE / CUSTOMER / ORDER ID / AWB" value={receivingFilters.search} onChange={(event) => setReceivingFilters({ ...receivingFilters, search: event.target.value })} />
            <button className={styles.softButton} onClick={() => setReceivingAddOpen(true)}>Add by Case Code</button>
            <button className={styles.darkButton} disabled={!selectedReceivingRows.length || busy} onClick={openReceivingInspection}>Resolve</button>
          </div>
          <div className={styles.tableWrap}><table><thead><tr><th>Select</th><th>Code</th><th>Customer</th><th>Order ID</th><th>AWB</th><th>Group</th><th>Courier</th><th>Deadline</th><th>Status</th><th>Action</th></tr></thead><tbody>
            {!receivingRows.length ? <tr><td colSpan="10"><EmptyState label="No receiving cases yet" /></td></tr> : receivingRows.map((row) => {
              const selected = receivingSelectedIds.includes(String(row.id))
              return <tr key={row.id}><td><input className={styles.compactCheckbox} type="checkbox" disabled={row.status_barang !== 'Sending'} checked={selected} onChange={(event) => setReceivingSelectedIds((current) => event.target.checked ? [...new Set([...current, String(row.id)])] : current.filter((id) => id !== String(row.id)))} /></td><td><strong>{row.kode_kejadian}</strong></td><td><strong>{row.nama_customer || '-'}</strong><small>{row.nomor_tim || row.created_by || '-'}</small></td><td>{row.order_id || '-'}</td><td>{row.no_resi_pengiriman || '-'}</td><td>{renderGroupBadge(row.group_order)}</td><td>{row.courier_name || '-'}</td><td>{formatShortDate(row.batas_tanggal_retur)}</td><td>{renderReturnStatusBadge(row.status_barang)}</td><td><div className={styles.rowActions}><button className={styles.iconActionButton} onClick={() => openCaseDetail(row, { readonly: true })} aria-label={`Open detail for ${row.kode_kejadian || row.order_id}`}>🔍</button>{row.status_barang === 'Completed' && !isRefundOnlyCase(row) ? <button className={styles.iconPrintButton} onClick={() => printReceivingRows([row])} aria-label={`Reprint ${row.kode_kejadian || row.order_id}`}>🖨️</button> : null}</div></td></tr>
            })}
          </tbody></table></div>
        </section>
      ) : null}

      {activeTab === 'issues' ? (
        <>
          <section className={`${styles.dataCard} ${styles.orderIssueSummaryPanel}`}>
            <div className={styles.cardTitleRow}>
              <div><h2>ORDER ISSUE SUMMARY</h2><p className={styles.cardHint}>Monthly overview from issue cases, pending handling, additional cost, and handling frequency.</p></div>
              <div className={styles.orderIssueMonthControl}>
                <label><span>MONTH</span><input type="month" value={issueSummaryMonth} onChange={(event) => setIssueSummaryMonth(event.target.value)} /></label>
                <button className={styles.softButton} onClick={loadIssues}>Refresh</button>
              </div>
            </div>
            <div className={styles.orderIssueSummaryGrid}>
              <article className={styles.resolutionMetricCard}>
                <span>Total Cases</span>
                <strong>{issueSummaryStats.total}</strong>
                {renderIssueMetricRows(issueSummaryStats.groups.map((item) => ({
                  className: getGroupFillClass(item.group),
                  key: item.group,
                  label: item.group,
                  onClick: () => setIssueFilters({ ...issueFilters, from: issueSummaryRange.from, group: item.group, to: issueSummaryRange.to }),
                  value: item.count,
                })))}
              </article>
              <article className={styles.resolutionMetricCard}>
                <span>Need Handling</span>
                <strong>{issueSummaryStats.pendingRows.length}</strong>
                {renderIssueMetricRows(issueSummaryStats.groups.map((item) => ({
                  className: getGroupFillClass(item.group),
                  key: item.group,
                  label: item.group,
                  onClick: () => setIssueFilters({ ...issueFilters, from: issueSummaryRange.from, group: item.group, to: issueSummaryRange.to }),
                  value: item.pending,
                })))}
              </article>
              <article className={styles.resolutionMetricCard}>
                <span>Additional Cost</span>
                <strong>{formatMoney(issueSummaryStats.costTotal)}</strong>
                {renderIssueMetricRows(issueSummaryStats.groups.map((item) => ({
                  className: getGroupFillClass(item.group),
                  key: item.group,
                  label: item.group,
                  onClick: () => setIssueFilters({ ...issueFilters, from: issueSummaryRange.from, group: item.group, to: issueSummaryRange.to }),
                  value: item.cost,
                })), formatMoney)}
              </article>
              <article className={styles.resolutionMetricCard}>
                <span>Handling Frequency</span>
                <strong>{issueSummaryStats.topHandling[0]?.label || '-'}</strong>
                {renderIssueMetricRows(issueSummaryStats.topHandling.map((item) => ({
                  className: styles.orderIssueFillArkline,
                  key: item.key,
                  label: item.label,
                  onClick: () => setIssueFilters({ ...issueFilters, from: issueSummaryRange.from, search: item.label, to: issueSummaryRange.to }),
                  value: item.value,
                })))}
              </article>
            </div>
          </section>

          <section className={styles.orderIssueMainGrid}>
            <article className={styles.formPanel}>
              <div className={styles.panelHeader}><h2>{editingIssueId ? 'EDIT ISSUE' : 'INPUT NEW ISSUE'}</h2><span>Order Issue</span></div>
              <div className={styles.panelBody}>
                <section className={styles.resolutionCaseHeaderCompact}>
                  <div className={styles.resolutionChoiceRow}>
                    <div>
                      <span className={styles.fieldTitle}>GROUP ORDER</span>
                      <div className={styles.choicePills}>
                        {groupOptions.map((group) => (
                          <button key={group} type="button" disabled={Boolean(lockedGroup)} className={`${issueForm.group_order === group ? styles.active : ''} ${styles[`groupChoice${group.charAt(0)}${group.slice(1).toLowerCase()}`] || ''}`} onClick={() => setIssueForm((current) => ({ ...current, group_order: lockedGroup || group }))}>{group}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className={styles.fieldTitle}>TEAM</span>
                      <div className={styles.choicePills}>
                        {ISSUE_TEAMS.map((team) => (
                          <button key={team} type="button" className={issueForm.tim === team ? styles.active : ''} onClick={() => setIssueForm((current) => ({ ...current, tim: team }))}>{formatIssueTeamLabel(team)}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <div className={`${styles.formGrid} ${styles.orderIssueFormGrid}`}>
                  <label><span>{labelText('ORDER ID', true)}</span><input value={issueForm.order_id} onChange={issueField('order_id')} /></label>
                  <label><span>{labelText('CUSTOMER NAME', true)}</span><input value={issueForm.nama} onChange={issueField('nama')} /></label>
                  <label><span>{labelText('PHONE NUMBER', true)}</span><input inputMode="numeric" value={issueForm.no_hp} onChange={issueField('no_hp')} /></label>
                  <label><span>{labelText('ISSUE REASON', true)}</span><select value={issueForm.alasan_bermasalah} onChange={issueField('alasan_bermasalah')}><option value="">SELECT ISSUE REASON</option>{masters.issueReasons.map((item) => <option key={item.id || item.name}>{item.name}</option>)}</select></label>
                  <label><span>{labelText('HANDLING ACTION', true)}</span><select value={issueForm.tindak_lanjut} onChange={issueField('tindak_lanjut')}><option value="">SELECT HANDLING</option>{masters.issueActions.map((item) => <option key={item.id || item.name}>{item.name}</option>)}</select></label>
                  <label><span>{labelWithInfo('ADDITIONAL COST', ORDER_ISSUE_COST_HELP, issueNeedsCost)}</span><input inputMode="numeric" value={issueForm.biaya_timbul} onChange={issueField('biaya_timbul')} /></label>
                  <label className={styles.fullField}><span>{labelText('FAULTY PRODUCT', true)}</span><textarea placeholder="> " value={issueForm.produk_bermasalah} onBlur={(event) => setIssueForm((current) => ({ ...current, produk_bermasalah: ensureBulletText(event.target.value) }))} onChange={issueField('produk_bermasalah')} /></label>
                  <label className={styles.fullField}><span>REPLACEMENT PRODUCT</span><textarea placeholder="> " value={issueForm.produk_pengganti} onBlur={(event) => setIssueForm((current) => ({ ...current, produk_pengganti: ensureBulletText(event.target.value) }))} onChange={issueField('produk_pengganti')} /></label>
                  <label className={styles.fullField}><span>NOTES</span><textarea value={issueForm.keterangan} onChange={issueField('keterangan')} /></label>
                </div>
                <div className={styles.formActions}>
                  <button className={styles.primaryButton} disabled={busy} onClick={saveIssue}>{busy ? 'Saving...' : editingIssueId ? 'Update Issue' : 'Save Issue'}</button>
                  <button className={styles.softButton} onClick={resetIssueForm}>{editingIssueId ? 'Cancel Edit' : 'Reset Form'}</button>
                </div>
              </div>
            </article>

            <aside className={styles.resolutionSideStack}>
              <article className={styles.resolutionInsightCard}>
                <div className={styles.cardTitleRow}><div><h2>QUICK INSIGHT</h2></div></div>
                <div className={styles.resolutionQuickList}>
                  {!issueQuickInsights.length ? (
                    <div className={styles.resolutionQuickItem}>
                      <strong>Tidak ada kasus yang membutuhkan perhatian khusus.</strong>
                    </div>
                  ) : issueQuickInsights.map((item) => (
                    <div key={item.id || item.title} className={styles.resolutionQuickItem}>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                      {item.row ? <div className={styles.orderIssueQuickActions}><button className={styles.iconActionButton} onClick={() => openIssueDetail(item.row)} aria-label={`Open issue ${item.title}`}>🔍</button><button className={styles.iconActionButton} onClick={() => loadIssueEditState(item.row)} aria-label={`Edit issue ${item.title}`}>✎</button></div> : null}
                    </div>
                  ))}
                </div>
              </article>
            </aside>
          </section>

          <section className={`${styles.tablePanel} ${styles.orderIssueListPanel}`}>
            <div className={styles.resolutionCaseListHeader}>
              <div className={styles.resolutionCaseListTitleRow}>
                <h2>Issue Lists</h2>
                <span className={styles.caseCountPill}>{visibleIssues.length} Rows</span>
                <span className={styles.warningCountPill}>{issueSummaryStats.pendingRows.length} Need Handling</span>
                <span className={styles.overdueCountPill}>{formatMoney(issueSummaryStats.costTotal)}</span>
              </div>
              <p>Monitor, filter, review details, and edit order issue cases directly from one list.</p>
              <div className={styles.resolutionCaseFilters}>
                <label><span>DATE FROM</span><input type="date" value={issueFilters.from} onChange={(event) => setIssueFilters({ ...issueFilters, from: event.target.value })} /></label>
                <label><span>DATE TO</span><input type="date" value={issueFilters.to} onChange={(event) => setIssueFilters({ ...issueFilters, to: event.target.value })} /></label>
                <label><span>GROUP</span><select value={issueFilters.group} onChange={(event) => setIssueFilters({ ...issueFilters, group: lockedGroup || event.target.value })} disabled={Boolean(lockedGroup)}>{lockedGroup ? null : <option value="">ALL GROUPS</option>}{groupOptions.map((group) => <option key={group}>{group}</option>)}</select></label>
                <label className={styles.searchField}><span>SEARCH</span><input placeholder="Search order ID, customer, reason, handling, product, or team" value={issueFilters.search} onChange={(event) => setIssueFilters({ ...issueFilters, search: event.target.value })} /></label>
                <button className={styles.softButton} onClick={loadIssues}>Refresh</button>
              </div>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.tableWrap}><table><thead><tr><th>Date</th><th>Group</th><th>Order ID</th><th>Customer</th><th>Faulty Product</th><th>Issue Reason</th><th>Handling</th><th>Team</th><th>Cost</th><th>Created By</th><th>Action</th></tr></thead><tbody>
                {!visibleIssues.length ? <tr><td colSpan="11"><EmptyState label="No order issue data yet" /></td></tr> : visibleIssues.map((row) => (
                  <tr key={row.id} className={isIssuePending(row) ? styles.caseRowWarning : ''}>
                    <td>{formatShortDate(row.created_at)}</td>
                    <td>{renderGroupBadge(row.group_order)}</td>
                    <td><strong>{row.order_id || '-'}</strong></td>
                    <td>{row.nama || '-'}</td>
                    <td>{row.produk_bermasalah || '-'}</td>
                    <td>{row.alasan_bermasalah || '-'}</td>
                    <td>{row.tindak_lanjut || '-'}</td>
                    <td>{formatIssueTeamLabel(row.tim)}</td>
                    <td>{formatMoney(row.biaya_timbul)}</td>
                    <td>{row.created_by || '-'}</td>
                    <td><div className={styles.rowActions}><button className={styles.iconActionButton} onClick={() => openIssueDetail(row)} aria-label={`Open issue ${row.order_id || row.id}`}>🔍</button></div></td>
                  </tr>
                ))}
              </tbody></table></div>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'search' ? (
        <section className={`${styles.dataCard} ${styles.productSearchPanel}`}>
          <h2>Product Search</h2>
          <div className={styles.productSearchToolbar}>
            <label className={styles.searchField}><span>PRODUCT SEARCH</span><input autoFocus placeholder="EXAMPLE: BLACK OVERSIZE T-SHIRT" value={productSearch} onChange={(event) => setProductSearch(cleanUpper(event.target.value))} /></label>
            <label><span>TYPE</span><select value={productSearchFilters.type} onChange={(event) => setProductSearchFilters({ ...productSearchFilters, type: event.target.value, size: '' })}><option value="">ALL TYPES</option><option value="return">RETURN</option><option value="issue">ORDER ISSUE</option></select></label>
            <label><span>ITEM TYPE</span><select value={productSearchFilters.scope} onChange={(event) => setProductSearchFilters({ ...productSearchFilters, scope: event.target.value, size: '' })}><option value="">ALL ITEM TYPES</option><option value="returned">RETURN / FAULTY PRODUCT</option><option value="replacement">REPLACEMENT PRODUCT</option></select></label>
            <label><span>GROUP ORDER</span><select value={productSearchFilters.group} onChange={(event) => setProductSearchFilters({ ...productSearchFilters, group: lockedGroup || event.target.value, size: '' })} disabled={Boolean(lockedGroup)}>{lockedGroup ? null : <option value="">ALL GROUPS</option>}{groupOptions.map((group) => <option key={group}>{group}</option>)}</select></label>
            <label><span>SIZE</span><select value={productSearchFilters.size} onChange={(event) => setProductSearchFilters({ ...productSearchFilters, size: event.target.value })}><option value="">ALL SIZES</option>{productSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
            <button className={styles.softButton} onClick={() => { setProductSearch(''); setProductSearchFilters({ group: lockedGroup, scope: '', type: '', size: '' }) }}>Reset</button>
          </div>
          <div className={styles.productSearchResults}>
            {!productSearch.trim() && !productSearchFilters.size ? (
              <div className={styles.productSearchEmpty}><strong>No data yet</strong><span>Enter a product name or select a size to view related case history.</span></div>
            ) : !searchResults.length ? (
              <div className={styles.productSearchEmpty}><strong>No data found</strong><span>This product was not found in faulty/returned products or replacement products.</span></div>
            ) : searchResults.map((result) => (
              <article key={`${result.sourceType}-${result.row.id}`} className={styles.productResultCard}>
                <div className={styles.productResultHeader}>
                  <div>
                    <div className={styles.productResultIdentity}>
                      <strong>{result.code}</strong>
                      {result.sourceType === 'return' ? renderReturnStatusBadge(result.row.status_barang) : renderIssueStatusBadge(result.row)}
                    </div>
                    <span>{result.sourceLabel} • Found in: {result.foundIn.join(' & ') || '-'}</span>
                  </div>
                  <button className={styles.iconActionButton} onClick={() => result.sourceType === 'issue' ? openIssueDetail(result.row, { readonly: true }) : openCaseDetail(result.row, { readonly: true })} aria-label={`Open detail for ${result.code}`}>🔍</button>
                </div>
                <div className={styles.productResultGrid}>
                  <div><span>Type</span><strong>{result.sourceLabel}</strong></div>
                  <div><span>Date</span><strong>{formatShortDate(result.dateValue)}</strong></div>
                  <div className={styles.productResultGroupCell}><span>Group Order</span><strong>{renderGroupBadge(result.groupOrder)}</strong></div>
                  <div><span>Reason</span><strong>{result.reason}</strong></div>
                  <div><span>Follow-up</span><strong>{result.action}</strong></div>
                  <div><span>Customer</span><strong>{result.customer}</strong></div>
                  <div className={styles.productResultWide}><span>{result.returnedLabel}</span><strong>{result.returnedProduct || '-'}</strong></div>
                  <div className={styles.productResultWide}><span>Replacement Product</span><strong>{result.replacementProduct || '-'}</strong></div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      </div>
      <Modal
        open={receivingConfirmOpen}
        title="Resolve Returns"
        className={styles.receivingConfirmModal}
        portal
        onClose={closeReceivingInspection}
        actions={receivingConfirmStep === 'review' ? <>
          <button type="button" className={styles.softButton} disabled={busy} onClick={() => { setReceivingConfirmStep('inspect'); setReceivingConfirmError('') }}>Back to Decisions</button>
          <button type="button" className={styles.darkButton} disabled={busy || receivingLookupBusy || !receivingInspectionCases.length} onClick={completeReceivingRows}>{busy ? 'Resolving...' : 'Confirm Resolution'}</button>
        </> : null}
      >
        <div className={styles.receivingInspectionProgressRow}>
          <div className={styles.receivingInspectionSteps} aria-label="Completion progress">
            <span className={receivingConfirmStep === 'inspect' ? styles.receivingInspectionStepActive : ''}>1. Inspect Returns</span>
            <span className={receivingConfirmStep === 'review' ? styles.receivingInspectionStepActive : ''}>2. Review & Resolve</span>
          </div>
          {receivingConfirmStep === 'inspect' ? <div className={styles.receivingInspectionTopActions}>
            <button type="button" className={styles.darkButton} disabled={busy || receivingLookupBusy || !receivingInspectionCases.length} onClick={continueReceivingInspection}>{receivingLookupBusy ? 'Finding Shelving...' : 'Review Decisions'}</button>
          </div> : null}
        </div>
        {receivingConfirmStep === 'inspect' ? (
          <div className={styles.receivingInspectionBody}>
            {receivingInspectionCases.map((inspectedCase) => (
              <section className={styles.receivingInspectionCase} key={inspectedCase.caseId}>
                <div className={styles.receivingInspectionCaseHeader}><strong>{inspectedCase.code}</strong><span>{inspectedCase.group} · {inspectedCase.lines.length} product{inspectedCase.lines.length === 1 ? '' : 's'}</span></div>
                {cleanText(inspectedCase.row.produk_pengganti) ? <div className={styles.receivingInspectionReplacement}><span>Replacement Product</span><strong>{formatProductEntries(inspectedCase.row.produk_pengganti)}</strong></div> : null}
                {!inspectedCase.lines.length ? <p className={styles.receivingInspectionEmpty}>No returned products are recorded for this case.</p> : inspectedCase.lines.map((line) => {
                  const assignedQty = Number(line.storedQty || 0) + Number(line.rejectQty || 0) + Number(line.lostQty || 0)
                  return (
                    <div className={styles.receivingInspectionLine} key={line.key}>
                      <div className={styles.receivingInspectionProduct}>
                        <strong>{line.productName}</strong>
                        <span>Expected: {line.expectedQty} unit{line.expectedQty === 1 ? '' : 's'}</span>
                        <span className={assignedQty === line.expectedQty ? styles.receivingInspectionAssigned : styles.receivingInspectionUnassigned}>{assignedQty} / {line.expectedQty} assigned</span>
                      </div>
                      <div className={styles.receivingInspectionIdentity}>
                        {line.skuLocked ? <div className={styles.receivingInspectionReadonly}><span>SKU</span><strong>{line.sku}</strong></div> : <label><span>SKU</span><input value={line.sku} onChange={(event) => updateReceivingInspectionLine(inspectedCase.caseId, line.key, { sku: cleanUpper(event.target.value) })} placeholder="Enter SKU" /></label>}
                        {line.sizeLocked ? <div className={styles.receivingInspectionReadonly}><span>Size</span><strong>{line.size}</strong></div> : <label><span>Size</span><input value={line.size} onChange={(event) => updateReceivingInspectionLine(inspectedCase.caseId, line.key, { size: cleanUpper(event.target.value) })} placeholder="Enter size" /></label>}
                      </div>
                      <div className={styles.receivingInspectionQuantities}>
                        {[['storedQty', 'Store'], ['rejectQty', 'Reject'], ['lostQty', 'Lost']].map(([field, label]) => (
                          <label key={field}><span className={styles.receivingQtyLabel}>{label}{field === 'storedQty' ? <button type="button" onClick={() => updateReceivingInspectionQty(inspectedCase, line, field, String(receivingQtyRemaining(line, field)))} aria-label={`Store all remaining ${line.expectedQty} units for ${line.productName}`}>ALL</button> : null}</span><input type="number" min="0" max={receivingQtyRemaining(line, field)} step="1" inputMode="numeric" value={line[field]} onChange={(event) => updateReceivingInspectionQty(inspectedCase, line, field, event.target.value)} placeholder="0" /></label>
                        ))}
                      </div>
                      {Number(line.rejectQty || 0) > 0 ? <label className={styles.receivingInspectionReason}><span>Reject Reason *</span><input value={line.rejectReason} onChange={(event) => updateReceivingInspectionLine(inspectedCase.caseId, line.key, { rejectReason: event.target.value })} placeholder="Reason for rejection" /></label> : null}
                      {Number(line.lostQty || 0) > 0 ? <label className={styles.receivingInspectionReason}><span>Lost Reason / Item Actually Received *</span><input value={line.lostReason} onChange={(event) => updateReceivingInspectionLine(inspectedCase.caseId, line.key, { lostReason: event.target.value })} placeholder="Enter the reason and what was actually received" /></label> : null}
                    </div>
                  )
                })}
              </section>
            ))}
          </div>
        ) : (
          <div className={styles.receivingInspectionBody}>
            {receivingInspectionCases.map((inspectedCase) => (
              <section className={styles.receivingInspectionCase} key={inspectedCase.caseId}>
                <div className={styles.receivingInspectionCaseHeader}><strong>{inspectedCase.code}</strong><span>{inspectedCase.group}</span></div>
                {!inspectedCase.lines.length ? <p className={styles.receivingInspectionEmpty}>No returned products to route.</p> : inspectedCase.lines.map((line) => (
                  <div className={styles.receivingInspectionReviewLine} key={line.key}>
                    <div><strong>{line.productName}</strong><span>{line.sku || 'No SKU'} · Size {line.size || '-'} · {line.expectedQty} unit{line.expectedQty === 1 ? '' : 's'}</span></div>
                    <div className={styles.receivingInspectionReviewQuantities}>{Number(line.storedQty || 0) > 0 ? <span>Store {line.storedQty} to {inspectedCase.group === 'ARKLINE' && line.shelvingLocationStatus === 'FOUND' ? `Shelving ${line.shelvingLocation}` : 'Shelving Queue'}</span> : null}{Number(line.rejectQty || 0) > 0 ? <span>Reject {line.rejectQty} pending arrangement</span> : null}{Number(line.lostQty || 0) > 0 ? <span>Lost {line.lostQty} recorded</span> : null}</div>
                  </div>
                ))}
                {cleanText(inspectedCase.row.produk_pengganti) ? (
                  <>
                    <div className={styles.receivingInspectionReplacement}><span>Replacement Product</span><strong>{formatProductEntries(inspectedCase.row.produk_pengganti)}</strong></div>
                    <div className={`${styles.receivingInspectionNotice} ${styles.externalReplacementNotice}`} role="note">
                      <strong>Replacement stock does not need to be in Shelving or Temp. Sales Area.</strong>
                      <span>Available quantity is deducted. Any remaining quantity is recorded as coming from outside stock in the case notes.</span>
                    </div>
                  </>
                ) : null}
              </section>
            ))}
          </div>
        )}
        {receivingConfirmError ? <p className={styles.cancelCaseError} role="alert">{receivingConfirmError}</p> : null}
      </Modal>
      <Modal open={receivingAddOpen} title="Add by Case Code" description="Search Pending cases, tick the checkbox, then use the Add button." className={styles.receivingAddModal} portal onClose={() => { setReceivingAddOpen(false); setReceivingAddSelectedIds([]) }}>
        <div className={`${styles.receivingModalBody} ${styles.receivingAddModalBody}`}>
          <div className={styles.inputWithAction}>
            <input value={receivingAddSearch} onChange={(event) => setReceivingAddSearch(cleanUpper(event.target.value))} placeholder="TYPE CASE CODE" />
            <button disabled={busy} onClick={addCaseByCode}>{busy ? 'Adding...' : 'Add'}</button>
          </div>
          <div className={styles.receivingAddMeta}><span className={styles.caseCountPill}>{receivingAddRows.length} Pending</span><span className={styles.selectedCountPill}>{selectedReceivingAddRows.length} Selected</span></div>
          <div className={styles.receivingResultList}>
            {!receivingAddRows.length ? <EmptyState label="No Pending case found in the current period." /> : receivingAddRows.map((row) => {
              const selected = receivingAddSelectedIds.includes(String(row.id))
              return (
                <div key={row.id} className={styles.receivingResultItem}>
                  <input className={styles.compactCheckbox} type="checkbox" checked={selected} onChange={(event) => setReceivingAddSelectedIds((current) => event.target.checked ? [...new Set([...current, String(row.id)])] : current.filter((id) => id !== String(row.id)))} aria-label={`Select ${row.kode_kejadian || row.order_id}`} />
                  <div><strong>{row.kode_kejadian || '-'}</strong><span>{row.nama_customer || '-'} • {row.status_barang || '-'}</span></div>
                  <div className={styles.rowActions}><button className={styles.iconActionButton} onClick={() => openCaseDetail(row, { readonly: true })} aria-label={`Open detail for ${row.kode_kejadian || row.order_id}`}>🔍</button></div>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>

      <Modal open={receivingReprintOpen} title="Reprint Completed" description="Select completed return cases to print their labels again." onClose={() => setReceivingReprintOpen(false)}>
        <div className={styles.receivingModalBody}>
          <input className={styles.receivingSearchInput} value={receivingReprintSearch} onChange={(event) => setReceivingReprintSearch(cleanUpper(event.target.value))} placeholder="SEARCH CASE CODE, CUSTOMER, OR AWB" />
          <div className={styles.receivingMeta}><span className={styles.caseCountPill}>{receivingReprintRows.length} Completed</span><span className={styles.selectedCountPill}>{selectedReprintRows.length} Selected</span><button className={styles.primaryButton} onClick={() => printReceivingRows(selectedReprintRows)}>Print Selected</button></div>
          <div className={styles.receivingResultList}>
            {!receivingReprintRows.length ? <EmptyState label="No completed case found." /> : receivingReprintRows.map((row) => {
              const selected = receivingReprintSelectedIds.includes(String(row.id))
              return (
                <div key={row.id} className={styles.receivingResultItem}>
                  <label className={styles.inlineCheck}><input type="checkbox" checked={selected} onChange={(event) => setReceivingReprintSelectedIds((current) => event.target.checked ? [...new Set([...current, String(row.id)])] : current.filter((id) => id !== String(row.id)))} /> <span>{row.kode_kejadian || '-'}</span></label>
                  <div><strong>{row.nama_customer || '-'}</strong><span>{row.no_resi_pengiriman || '-'} • Completed</span></div>
                  <div className={styles.rowActions}><button className={styles.iconActionButton} onClick={() => openCaseDetail(row, { readonly: true })} aria-label={`Open detail for ${row.kode_kejadian || row.order_id}`}>🔍</button><button className={styles.primaryButton} onClick={() => printReceivingRows([row])}>Print</button></div>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(issueDetail)} title="Order Issue Details" description="Review order issue data without leaving the monitoring page." onClose={() => { setIssueDetail(null); setIssueDetailReadonly(false) }}>
        {issueDetail ? (
          <div className={styles.resolutionDetailModalBody}>
            <div className={styles.resolutionModalToolbar}>
              <div><strong>{issueDetail.order_id || '-'}</strong><span>{issueDetail.nama || '-'}</span></div>
              {!issueDetailReadonly ? <button className={styles.primaryButton} onClick={() => loadIssueEditState(issueDetail)}>Edit</button> : null}
            </div>

            {getExternalReplacementLines(detail?.keterangan_tambahan).length > 0 ? (
              <div className={`${styles.receivingInspectionNotice} ${styles.externalReplacementNotice}`} role="status">
                <strong>Replacement from outside Temp. Sales / Shelving</strong>
                <span>{formatProductEntries(getExternalReplacementLines(detail.keterangan_tambahan).join('\n'))}</span>
                <small>No additional stock deduction. External source not verified.</small>
              </div>
            ) : null}

            <section className={`${styles.resolutionDetailSection} ${styles.resolutionDetailCaseOverview}`}>
              <h3>Issue Overview</h3>
              <div className={styles.resolutionDetailGrid}>
                <div className={styles.resolutionDetailValue}><span>Created Date</span><strong>{formatShortDate(issueDetail.created_at)}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Group Order</span><strong>{renderGroupBadge(issueDetail.group_order)}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Team</span><strong>{formatIssueTeamLabel(issueDetail.tim)}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Created By</span><strong>{issueDetail.created_by || '-'}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Need Handling</span><strong>{isIssuePending(issueDetail) ? 'Yes' : 'No'}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Additional Cost</span><strong>{formatMoney(issueDetail.biaya_timbul)}</strong></div>
              </div>
            </section>

            <section className={`${styles.resolutionDetailSection} ${styles.resolutionDetailSubject}`}>
              <h3>Subject Identity</h3>
              <div className={styles.resolutionDetailGrid}>
                <div className={styles.resolutionDetailValue}><span>Order ID</span><strong>{issueDetail.order_id || '-'}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Customer Name</span><strong>{issueDetail.nama || '-'}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Phone Number</span><strong>{issueDetail.no_hp || '-'}</strong></div>
              </div>
            </section>

            <section className={`${styles.resolutionDetailSection} ${styles.resolutionDetailReturns}`}>
              <h3>Issue Detail</h3>
              <div className={styles.resolutionDetailGrid}>
                <div className={styles.resolutionDetailValue}><span>Issue Reason</span><strong>{issueDetail.alasan_bermasalah || '-'}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Handling Action</span><strong>{issueDetail.tindak_lanjut || '-'}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Additional Cost</span><strong>{formatMoney(issueDetail.biaya_timbul)}</strong></div>
                <div className={`${styles.resolutionDetailValue} ${styles.orderIssueWideDetail}`}><span>Faulty Product</span><strong>{issueDetail.produk_bermasalah || '-'}</strong></div>
                <div className={`${styles.resolutionDetailValue} ${styles.orderIssueWideDetail}`}><span>Replacement Product</span><strong>{issueDetail.produk_pengganti || '-'}</strong></div>
                <div className={`${styles.resolutionDetailValue} ${styles.orderIssueWideDetail}`}><span>Notes</span><strong>{issueDetail.keterangan || '-'}</strong></div>
              </div>
            </section>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(cancelTarget)} title="Cancel Return Case" description={`Cancel ${cancelTarget?.kode_kejadian || 'this case'} for ${cancelTarget?.nama_customer || 'this customer'}? Its status will change to Cancel.`} className={styles.cancelCaseConfirmModal} portal onClose={() => { if (!busy) { setCancelTarget(null); setCancelError('') } }} actions={<><button type="button" className={styles.softButton} disabled={busy} onClick={() => { setCancelTarget(null); setCancelError('') }}>Keep Case</button><button type="button" className={styles.cancelCaseConfirmButton} disabled={busy} onClick={cancelCase}>{busy ? 'Cancelling...' : 'Confirm Cancel'}</button></>}>
        {cancelError ? <p className={styles.cancelCaseError} role="alert">{cancelError}</p> : null}
      </Modal>

      <Modal open={Boolean(detail)} title={detail?.kode_kejadian ? 'Case Details' : `Order ${detail?.order_id || ''}`} description={detail?.kode_kejadian ? 'Review return case data without leaving the monitoring page.' : (detail?.nama || detail?.nama_customer || '')} className={styles.returnCaseDetailModal} onClose={closeCaseDetail}>
        {detailDraft ? (
          <div className={styles.resolutionDetailModalBody}>
            <div className={styles.resolutionModalToolbar}>
              <div><strong>{detailDraft.kode_kejadian || detailDraft.order_id}</strong><span>{detailDraft.nama_customer || detailDraft.nama || '-'}</span></div>
              {canEditDetail && detailMode === 'edit' ? (
                <div className={styles.resolutionModalActions}>
                  <button className={styles.softButton} onClick={() => { setDetailDraft(createDetailDraft(detail)); setDetailMode('view') }}>Cancel</button>
                  <button className={styles.primaryButton} disabled={busy} onClick={saveDetailEdit}>{busy ? 'Saving...' : 'Save Changes'}</button>
                </div>
              ) : canEditDetail ? (
                <button className={`${styles.primaryButton} ${styles.caseDetailEditButton}`} onClick={() => setDetailMode('edit')}>Edit</button>
              ) : null}
            </div>

            {detailMode === 'view' && getExternalReplacementLines(detailDraft.keterangan_tambahan).length > 0 ? (
              <div className={`${styles.receivingInspectionNotice} ${styles.externalReplacementNotice}`} role="status">
                <strong>Replacement from outside Temp. Sales / Shelving</strong>
                <span>{formatProductEntries(getExternalReplacementLines(detailDraft.keterangan_tambahan).join('\n'))}</span>
                <small>Only available stock was deducted; the remaining quantity is recorded as external.</small>
              </div>
            ) : null}

            <section className={`${styles.resolutionDetailSection} ${styles.resolutionDetailCaseOverview}`}>
              {renderDetailSectionHeading('overview', 'Case Overview')}
              <div id="return-case-overview" hidden={!detailSectionsOpen.overview}>
              <div className={styles.resolutionDetailGrid}>
                <div className={styles.resolutionDetailValue}><span>Case Code</span><strong>{formatHandledCaseLabel(detailDraft)}</strong></div>
                {renderDetailField({ key: 'tanggal_pengajuan', label: 'Submission Date', type: 'date' })}
                {renderDetailField({ key: 'batas_tanggal_retur', label: 'Return Deadline', type: 'date' })}
                {renderDetailField({ key: 'group_order', label: 'Group Order', options: groupOptions, readonly: Boolean(lockedGroup) })}
                {renderDetailField({ key: 'internal_external', label: 'Internal / External', options: ['Internal', 'External'] })}
                <div className={styles.resolutionDetailValue}><span>Warning</span><strong><span className={`${styles.statusBadge} ${getCaseWarningMeta(detailDraft, today).tone}`}>{getCaseWarningMeta(detailDraft, today).label}</span></strong></div>
              </div>
              </div>
            </section>

            <section className={`${styles.resolutionDetailSection} ${styles.resolutionDetailSubject}`}>
              {renderDetailSectionHeading('subject', 'Subject Identity')}
              <div id="return-case-subject" hidden={!detailSectionsOpen.subject}>
              <div className={styles.resolutionDetailGrid}>
                {renderDetailField({ key: 'order_id', label: 'Order ID' })}
                {renderDetailField({ key: 'nama_customer', label: 'Customer Name' })}
                {renderDetailField({ key: 'no_handphone', label: 'Phone Number' })}
                {renderDetailField({ key: 'alamat', label: 'Address', textarea: true })}
                {renderDetailField({ key: 'no_resi_pengiriman', label: 'Shipment AWB' })}
                {renderDetailField({ key: 'nomor_tim', label: 'Packing Team', readonly: true })}
              </div>
              </div>
            </section>

            <section className={`${styles.resolutionDetailSection} ${styles.resolutionDetailReturns}`}>
              {renderDetailSectionHeading('returns', 'Returns Detail')}
              <div id="return-case-returns" hidden={!detailSectionsOpen.returns}>
              <div className={styles.resolutionDetailGrid}>
                {renderDetailField({ key: 'retur_reason', label: 'Return Reason', options: masters.reasons.filter((item) => !item.reasoning_type || item.reasoning_type.toLowerCase() === detailDraft.internal_external.toLowerCase()).map((item) => item.name) })}
                {renderDetailField({ key: 'retur_action', label: 'Follow-up Action', options: masters.actions.map((item) => item.name) })}
                {renderDetailField({ key: 'courier_name', label: 'Shipping Courier', options: masters.couriers.map((item) => item.nama) })}
                {renderDetailField({ key: 'ongkir_masuk', label: 'Inbound Shipping Cost', type: 'number' })}
                {renderDetailField({ key: 'ongkir_keluar', label: 'Outbound Shipping Cost', type: 'number' })}
                {renderDetailField({ key: 'nilai_refund_kompensasi', label: 'Loss Value', type: 'number' })}
                {renderDetailField({ key: 'total_retur', label: 'Returned Item Value', type: 'number' })}
                {renderDetailField({ key: 'courier_service', label: 'Shipping Service', options: detailServiceOptions.map((item) => item.courier_service) })}
                {renderDetailProductField({ key: 'produk_diretur', label: 'Return / Faulty Product' })}
                {renderDetailProductField({ key: 'produk_pengganti', label: 'Replacement Product' })}
                {renderDetailField({ key: 'keterangan_tambahan', label: 'Internal Additional Notes', textarea: true })}
                {renderDetailField({ key: 'note_konsumen', label: 'Customer Notes', textarea: true })}
              </div>
              </div>
            </section>

            <section className={`${styles.resolutionDetailSection} ${styles.resolutionDetailStatus}`}>
              {renderDetailSectionHeading('status', 'Status')}
              <div id="return-case-status" hidden={!detailSectionsOpen.status}>
              <div className={styles.resolutionStatusPanel}>
                <div className={`${styles.resolutionStatusPreview} ${detailStatusOption.className}`}>
                  <span>ACTIVE STATUS</span>
                  <strong>{detailStatusOption.label}</strong>
                  <p>{detailStatusOption.description}</p>
                </div>
                <div className={styles.resolutionStatusControls}>
                  {canEditDetail && detailMode === 'edit' ? (
                    <div className={styles.resolutionStatusButtons}>
                      {Object.entries(RETURN_STATUS_OPTIONS).map(([value, option]) => (
                        <button key={value} className={`${detailDraft.status_barang === value ? styles.active : ''} ${option.className}`} onClick={() => setDetailDraft((current) => ({ ...current, status_barang: value }))}>{option.label}</button>
                      ))}
                    </div>
                  ) : null}
                  <label className={styles.resolutionPriorityToggle}><input type="checkbox" checked={Boolean(detailDraft.need_prioritized)} disabled={detailMode !== 'edit'} onChange={detailField('need_prioritized')} /> Priority case / needs special attention</label>
                </div>
              </div>
              </div>
            </section>
          </div>
        ) : detail ? <div className={styles.resolutionDetailModalBody}><div className={styles.detailGrid}>{Object.entries(detail).filter(([, value]) => value !== null && value !== '').map(([key, value]) => <div key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</strong></div>)}</div></div> : null}
      </Modal>
    </div>
  )
}
