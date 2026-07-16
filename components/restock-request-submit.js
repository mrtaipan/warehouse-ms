'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/browser'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

const supabase = createClient()
const RACK_LOCATION_BATCH_SIZE = 1000
const TAKE_REQUESTS_TABLE = 'restock_request'
const SOURCE_OPTIONS = [
  { value: 'MOB', label: 'MOB' },
  { value: 'ARKLINE', label: 'ARKLINE' },
]

async function fetchAllRackLocations() {
  const allRows = []
  let from = 0

  while (true) {
    const to = from + RACK_LOCATION_BATCH_SIZE - 1
    const { data, error } = await supabase
      .from('dir_rack_locations')
      .select('id, location_type, location_id, location_code, sub_location')
      .order('location_type', { ascending: true })
      .order('location_id', { ascending: true })
      .order('location_code', { ascending: true })
      .order('sub_location', { ascending: true })
      .range(from, to)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      break
    }

    allRows.push(...data)

    if (data.length < RACK_LOCATION_BATCH_SIZE) {
      break
    }

    from += RACK_LOCATION_BATCH_SIZE
  }

  return allRows
}

function getLocationLabel(location) {
  if (!location) {
    return 'Location is not found'
  }

  return [
    location.location_type,
    location.location_id,
    location.location_code,
    location.sub_location,
  ]
    .filter(Boolean)
    .join(' / ')
}

function normalizeText(value) {
  return String(value || '').trim().toUpperCase()
}

function normalizeSearchTermInput(value) {
  return String(value || '').toUpperCase()
}

function normalizeArklineProduct(row) {
  return {
    sku: normalizeText(row?.sku_induk),
    name: normalizeText(row?.nama_produk),
    category: normalizeText(row?.kategori_produk),
    isActive: row?.is_active !== false,
  }
}

function getArklineProductLabel(product) {
  if (!product) {
    return ''
  }

  return [product.sku, product.name].filter(Boolean).join(' ')
}

function findArklineProductByInput(products, value) {
  const normalizedValue = normalizeText(value)

  if (!normalizedValue) {
    return null
  }

  return (
    products.find((item) => item.sku === normalizedValue) ||
    products.find((item) => item.name === normalizedValue) ||
    products.find((item) => getArklineProductLabel(item) === normalizedValue) ||
    null
  )
}

async function fetchArklineProducts() {
  const { data, error } = await supabase
    .from('arkline_dir_products')
    .select('sku_induk, nama_produk, kategori_produk, is_active')
    .order('nama_produk', { ascending: true })

  if (error) {
    throw error
  }

  return (data || []).map(normalizeArklineProduct).filter((item) => item.isActive && (item.sku || item.name))
}

function getStorageSearchCandidates(value) {
  const rawValue = String(value || '').trim()
  const normalizedValue = normalizeText(rawValue)
  const tokens = normalizedValue
    .split(/[\s,/|;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  const skuToken = tokens.find((token) => /[A-Z]/.test(token) && /\d/.test(token) && token.length >= 4)
  const candidates = [
    rawValue,
    skuToken,
    tokens[0],
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean)

  return Array.from(new Set(candidates))
}

async function fetchStorageMatches(searchTerm, requestedSize = '') {
  const rowsById = new Map()
  const candidates = getStorageSearchCandidates(searchTerm)

  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from('warehouse_storage')
      .select('id, rack_location_id, item_name, size, qty')
      .ilike('item_name', `%${candidate}%`)
      .order('qty', { ascending: false })
      .limit(50)

    if (error) {
      throw error
    }

    ;(data || []).forEach((row) => {
      rowsById.set(row.id, row)
    })

    const currentRows = Array.from(rowsById.values())
    const matchingSizeRows = selectRowsForRequestedSize(currentRows, requestedSize)

    if (matchingSizeRows.length > 0 || (!requestedSize && currentRows.length > 0)) {
      break
    }
  }

  return Array.from(rowsById.values())
}

function normalizeSizeValue(value) {
  return normalizeText(value).replace(/\s+/g, '')
}

function matchesRequestedSize(entrySize, requestedSize) {
  if (!requestedSize) {
    return true
  }

  return normalizeSizeValue(entrySize) === normalizeSizeValue(requestedSize)
}

function getSizeTokens(value) {
  return normalizeSizeValue(value)
    .split(/[\s,/|;-]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function sharesRequestedSizeToken(entrySize, requestedSize) {
  if (!requestedSize) {
    return true
  }

  const requestedTokens = getSizeTokens(requestedSize)
  const entryTokens = getSizeTokens(entrySize)

  if (requestedTokens.length === 0 || entryTokens.length === 0) {
    return false
  }

  return requestedTokens.some((token) => entryTokens.includes(token))
}

function selectRowsForRequestedSize(rows, requestedSize) {
  if (!requestedSize) {
    return rows
  }

  const exactSizeRows = rows.filter((entry) =>
    matchesRequestedSize(entry.size, requestedSize)
  )

  if (exactSizeRows.length > 0) {
    return exactSizeRows
  }

  const partialSizeRows = rows.filter((entry) =>
    sharesRequestedSizeToken(entry.size, requestedSize)
  )

  if (partialSizeRows.length > 0) {
    return partialSizeRows
  }

  return []
}

function rankMatches(rows, searchTerm, size) {
  const normalizedSearchTerm = normalizeText(searchTerm)
  const normalizedSize = normalizeSizeValue(size)

  return [...rows].sort((left, right) => {
    const leftName = normalizeText(left.item_name)
    const rightName = normalizeText(right.item_name)
    const leftSize = normalizeSizeValue(left.size)
    const rightSize = normalizeSizeValue(right.size)
    const leftExactName = leftName === normalizedSearchTerm ? 1 : 0
    const rightExactName = rightName === normalizedSearchTerm ? 1 : 0

    if (leftExactName !== rightExactName) {
      return rightExactName - leftExactName
    }

    if (normalizedSize) {
      const leftExactSize = leftSize === normalizedSize ? 1 : 0
      const rightExactSize = rightSize === normalizedSize ? 1 : 0

      if (leftExactSize !== rightExactSize) {
        return rightExactSize - leftExactSize
      }
    }

    return Number(right.qty || 0) - Number(left.qty || 0)
  })
}

function buildRequestRows(matches, rackLocations, form, requesterName) {
  const requestedQty = Number(form.qty || 0)
  const submittedNote = String(form.note || '').trim()
  const locationById = new Map(rackLocations.map((item) => [item.id, item]))
  const rankedMatches = rankMatches(matches, form.searchTerm, form.size)
  const availableRows = rankedMatches.filter((entry) => Number(entry.qty || 0) > 0)
  const uniqueLocations = []
  const seenLocations = new Set()

  availableRows.forEach((entry) => {
    const location = locationById.get(entry.rack_location_id) || null
    const label = getLocationLabel(location)

    if (!seenLocations.has(label)) {
      seenLocations.add(label)
      uniqueLocations.push(label)
    }
  })

  const locationCount = uniqueLocations.length
  const takeFromSummary =
    locationCount > 0
      ? `${locationCount} Registered Location${locationCount === 1 ? '' : 's'}${
          uniqueLocations.length > 0 ? ` - ${uniqueLocations.slice(0, 2).join(', ')}` : ''
        }${uniqueLocations.length > 2 ? ' ...' : ''}`
      : 'Location is not found'
  return [
    {
      requester_name: requesterName.trim(),
      item_name: availableRows[0]?.item_name || form.searchTerm.trim(),
      size: normalizeSizeValue(availableRows[0]?.size || form.size) || '-',
      qty: requestedQty,
      take_from: takeFromSummary,
      storage_id: null,
      search_term: form.searchTerm.trim(),
      note: submittedNote || null,
      request_status: 'open',
    },
  ]
}

function buildArklineRequestRows(product, form, requesterName) {
  const requestedQty = Number(form.qty || 0)
  const submittedNote = String(form.note || '').trim()
  const itemLabel = getArklineProductLabel(product) || form.searchTerm.trim()

  return [
    {
      requester_name: requesterName.trim(),
      item_name: itemLabel,
      size: normalizeSizeValue(form.size) || '-',
      qty: requestedQty,
      take_from: 'Location is not found',
      storage_id: null,
      search_term: product?.sku || itemLabel,
      note: submittedNote || null,
      request_status: 'open',
    },
  ]
}

function formatTakeFromLabel(value) {
  const label = String(value || '').trim()

  if (!label) {
    return 'Location is not found'
  }

  const registeredLocationMatch = label.match(/^(\d+)\s+lokasi\s+(tercatat|terdata)(.*)$/i)

  if (registeredLocationMatch) {
    const count = Number(registeredLocationMatch[1] || 0)
    const suffix = registeredLocationMatch[3] || ''

    return `${count} Registered Location${count === 1 ? '' : 's'}${suffix}`
  }

  if (/^lokasi belum terdata$/i.test(label) || /^location (not recorded|not found)$/i.test(label)) {
    return 'Location is not found'
  }

  return label
}

async function fetchOpenRequests() {
  const { data, error } = await supabase
    .from(TAKE_REQUESTS_TABLE)
    .select('id, requester_name, item_name, size, qty, take_from, storage_id, search_term, note, created_at')
    .eq('request_status', 'open')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data || []
}

export default function RestockRequestSubmit({
  pickerHref = '/take-requests',
  pickerLabel = 'Open Picker',
  title = 'Restock Request',
  subtitle = '',
  showPickerLink = false,
  showBackToStorage = false,
}) {
  const [rackLocations, setRackLocations] = useState([])
  const [requests, setRequests] = useState([])
  const [requesterName, setRequesterName] = useState('')
  const [arklineProducts, setArklineProducts] = useState([])
  const [arklineProductError, setArklineProductError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    sourceType: '',
    size: '',
    qty: '1',
    searchTerm: '',
    note: '',
  })

  const arklineProductOptions = useMemo(
    () => arklineProducts.map((item) => getArklineProductLabel(item)).filter(Boolean),
    [arklineProducts]
  )

  async function fetchRequesterName() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      throw new Error('User session not found.')
    }

    const { data: profile, error: profileError } = await getProfileByAuthenticatedUser(supabase, user, 'display_name')

    if (profileError) {
      throw profileError
    }

    return normalizeText(profile?.display_name || user.email.split('@')[0])
  }

  async function refreshRequests(showSpinner = false) {
    if (showSpinner) {
      setRefreshing(true)
    }

    try {
      const rows = await fetchOpenRequests()
      setRequests(rows)
    } catch (loadError) {
      setError(loadError.message || 'Failed to load request list.')
    } finally {
      if (showSpinner) {
        setRefreshing(false)
      }
    }
  }

  useEffect(() => {
    async function initializePage() {
      setLoading(true)
      setError('')

      try {
        const [rackData, requestRows, currentRequesterName, productRows] = await Promise.all([
          fetchAllRackLocations(),
          fetchOpenRequests(),
          fetchRequesterName(),
          fetchArklineProducts().catch((productError) => {
            setArklineProductError(productError.message || 'Failed to load Arkline products.')
            return []
          }),
        ])

        const normalizedRackLocations = (rackData || []).map((item) => ({
          ...item,
          location_type:
            typeof item.location_type === 'string' ? item.location_type.trim() : item.location_type,
          location_id:
            typeof item.location_id === 'string' ? item.location_id.trim() : item.location_id,
          location_code:
            typeof item.location_code === 'string' ? item.location_code.trim() : item.location_code,
          sub_location:
            typeof item.sub_location === 'string' ? item.sub_location.trim() : item.sub_location,
        }))

        setRackLocations(normalizedRackLocations)
        setRequests(requestRows)
        setRequesterName(currentRequesterName)
        setArklineProducts(productRows)
        setLoading(false)
      } catch (loadError) {
        setError(
          loadError.message ||
            'Failed to load shortcut data. Make sure restock_request already exists in Supabase.'
        )
        setLoading(false)
      }
    }

    initializePage()
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshRequests(false)
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [])

  function handleInputChange(event) {
    const { name, value } = event.target

    if (name === 'qty') {
      const numericValue = value.replace(/\D/g, '')
      setForm((prev) => ({
        ...prev,
        qty: numericValue || '',
      }))
      return
    }

    setForm((prev) => ({
      ...prev,
      [name]:
        name === 'size'
          ? normalizeSizeValue(value)
          : name === 'searchTerm'
            ? normalizeSearchTermInput(value)
            : value,
    }))
  }

  function handleSourceTypeChange(nextSourceType) {
    setForm((prev) => ({
      ...prev,
      sourceType: nextSourceType,
      searchTerm: '',
      size: '',
      qty: prev.qty || '1',
      note: '',
    }))
    setError('')
    setSuccess('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    if (!requesterName.trim()) {
      setError('User display name is not available yet. Please complete it in User Access first.')
      setSubmitting(false)
      return
    }

    if (!form.sourceType) {
      setError('Choose a request source first: MOB or ARKLINE.')
      setSubmitting(false)
      return
    }

    if (!form.searchTerm.trim()) {
      setError('SKU is required.')
      setSubmitting(false)
      return
    }

    if (!form.size.trim()) {
      setError('Size is required.')
      setSubmitting(false)
      return
    }

    const requestedQty = Number(form.qty || 0)

    if (requestedQty <= 0) {
      setError('Qty must be greater than 0.')
      setSubmitting(false)
      return
    }

    let payload = []

    if (form.sourceType === 'ARKLINE') {
      const selectedProduct = findArklineProductByInput(arklineProducts, form.searchTerm)

      if (!selectedProduct) {
        setError('Choose an Arkline product from the available dropdown.')
        setSubmitting(false)
        return
      }

      payload = buildArklineRequestRows(selectedProduct, form, requesterName)
    } else {
      let data = []

      try {
        data = await fetchStorageMatches(form.searchTerm.trim(), form.size.trim())
      } catch (searchError) {
        setError(searchError.message)
        setSubmitting(false)
        return
      }

      const matchedRows = selectRowsForRequestedSize(data || [], form.size.trim())
      payload = buildRequestRows(matchedRows, rackLocations, form, requesterName)
    }

    const { error: insertError } = await supabase.from(TAKE_REQUESTS_TABLE).insert(payload)

    if (insertError) {
      setError(
        `${insertError.message} Make sure the ${TAKE_REQUESTS_TABLE} table and insert/select policies are available.`
      )
      setSubmitting(false)
      return
    }

    await refreshRequests(false)
    setForm((prev) => ({
      ...prev,
      size: '',
      qty: '1',
      searchTerm: '',
      note: '',
    }))
    setSuccess('Request submitted successfully.')
    setSubmitting(false)
  }

  if (loading) {
    return <div style={styles.loadingScreen}>Loading shortcut...</div>
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        {showBackToStorage ? (
          <div style={styles.topBar}>
            <Link href="/dashboard/storage" style={styles.backIconLink} aria-label="Back to Storage">
              ←
            </Link>
          </div>
        ) : null}

        <div style={styles.hero}>
          <div>
            <p style={styles.eyebrow}>Out of Stock</p>
            <h1 style={styles.title}>{title}</h1>
            {subtitle ? <p style={styles.subtitle}>{subtitle}</p> : null}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Create Request</h2>
          </div>

          <div style={styles.requesterBox}>
            <span style={styles.requesterLabel}>Requester</span>
            <strong style={styles.requesterValue}>{requesterName || '-'}</strong>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Request Source</label>
            <div style={styles.sourceSelector}>
              {SOURCE_OPTIONS.map((option) => {
                const isActive = form.sourceType === option.value

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSourceTypeChange(option.value)}
                    style={{
                      ...styles.sourceButton,
                      ...(isActive ? styles.sourceButtonActive : {}),
                    }}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          {form.sourceType ? (
            <>
              <div style={styles.field}>
                <label style={styles.label}>Item Name / SKU</label>
                <input
                  name="searchTerm"
                  value={form.searchTerm}
                  onChange={handleInputChange}
                  style={styles.input}
                  placeholder={
                    form.sourceType === 'ARKLINE'
                      ? 'TYPE OR CHOOSE AN ARKLINE PRODUCT'
                      : 'SEARCH THE ITEM TO PICK'
                  }
                  list={form.sourceType === 'ARKLINE' ? 'arkline-product-options' : undefined}
                  required
                />
                {form.sourceType === 'ARKLINE' ? (
                  <>
                    <datalist id="arkline-product-options">
                      {arklineProductOptions.map((label) => (
                        <option key={label} value={label} />
                      ))}
                    </datalist>
                    {arklineProductError ? <span style={styles.helperError}>{arklineProductError}</span> : null}
                    {!arklineProductError && !arklineProductOptions.length ? (
                      <span style={styles.helperText}>No active Arkline products are available yet.</span>
                    ) : null}
                  </>
                ) : null}
              </div>

              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Size</label>
                  <input
                    name="size"
                    value={form.size}
                    onChange={handleInputChange}
                    style={styles.input}
                    placeholder="EXAMPLE: M"
                    required
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Qty</label>
                  <input
                    name="qty"
                    value={form.qty}
                    onChange={handleInputChange}
                    style={styles.input}
                    inputMode="numeric"
                    placeholder="1"
                    required
                  />
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Notes</label>
                <textarea
                  name="note"
                  value={form.note}
                  onChange={handleInputChange}
                  style={styles.textarea}
                  placeholder="Notes for the picker, if there are extra instructions"
                  rows={3}
                />
              </div>
            </>
          ) : (
            <div style={styles.emptyState}>Choose MOB or ARKLINE first to open the request fields.</div>
          )}

          {error ? <p style={styles.error}>{error}</p> : null}
          {success ? <p style={styles.success}>{success}</p> : null}

          <button type="submit" style={styles.primaryButton} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>

        <div style={styles.card}>
          <div style={styles.listHeader}>
            <div>
              <h2 style={styles.cardTitle}>Pick List</h2>
            </div>

            <div style={styles.listHeaderActions}>
              <button
                type="button"
                onClick={() => refreshRequests(true)}
                style={styles.ghostButton}
                disabled={refreshing}
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <span style={styles.counterBadge}>{requests.length} open</span>
            </div>
          </div>

          {requests.length === 0 ? (
            <div style={styles.emptyState}>
              No requests yet. Submit an item from the form above to start the pick list.
            </div>
          ) : (
            <div style={styles.requestList}>
              {requests.map((row) => (
                <div key={row.id} style={styles.requestCard}>
                  <div style={styles.requestOwner}>
                    <span style={styles.requestOwnerLabel}>For</span>
                    <strong style={styles.requestOwnerValue}>{row.requester_name}</strong>
                  </div>

                  <div style={styles.requestGrid}>
                    <div style={styles.requestCell}>
                      <span style={styles.requestLabel}>Item Name</span>
                      <strong style={styles.requestValue}>{row.item_name}</strong>
                    </div>

                    <div style={styles.requestCell}>
                      <span style={styles.requestLabel}>Size</span>
                      <strong style={styles.requestValue}>{row.size || '-'}</strong>
                    </div>

                    <div style={styles.requestCell}>
                      <span style={styles.requestLabel}>Qty</span>
                      <strong style={styles.requestValue}>{row.qty}</strong>
                    </div>

                    <div style={styles.requestCell}>
                      <span style={styles.requestLabel}>Take from</span>
                      <strong style={styles.requestValue}>{formatTakeFromLabel(row.take_from)}</strong>
                    </div>
                  </div>

                  {row.note ? (
                    <div style={styles.noteBox}>
                      <span style={styles.noteLabel}>Notes</span>
                      <strong style={styles.noteValue}>{row.note}</strong>
                    </div>
                  ) : null}

                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #fff7ed 0%, #ffffff 22%, #f8fafc 100%)',
    padding: '14px 12px 28px',
  },
  shell: {
    width: '100%',
    maxWidth: '500px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
  },
  backIconLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38px',
    height: '38px',
    borderRadius: '999px',
    border: '1px solid #d1d5db',
    background: 'rgba(255, 255, 255, 0.92)',
    color: '#111827',
    textDecoration: 'none',
    fontSize: '20px',
    fontWeight: '700',
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  eyebrow: {
    margin: 0,
    color: '#c2410c',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '6px 0 0',
    fontSize: '26px',
    lineHeight: 1.1,
    color: '#111827',
  },
  subtitle: {
    margin: '8px 0 0',
    color: '#6b7280',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  card: {
    background: 'rgba(255, 255, 255, 0.94)',
    border: '1px solid #fed7aa',
    borderRadius: '20px',
    padding: '15px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
    backdropFilter: 'blur(6px)',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '18px',
    color: '#111827',
  },
  cardText: {
    margin: 0,
    fontSize: '12px',
    color: '#6b7280',
    lineHeight: 1.5,
  },
  requesterBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#fff7ed',
    border: '1px solid #fdba74',
  },
  requesterLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#9a3412',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  requesterValue: {
    color: '#7c2d12',
    fontSize: '15px',
  },
  sourceSelector: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '8px',
  },
  sourceButton: {
    height: '44px',
    borderRadius: '12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#fdba74',
    background: '#fff',
    color: '#7c2d12',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  sourceButtonActive: {
    background: '#111827',
    borderColor: '#111827',
    color: '#fff',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#374151',
  },
  input: {
    height: '44px',
    borderRadius: '12px',
    border: '1px solid #fdba74',
    background: '#fff',
    padding: '0 12px',
    fontSize: '13px',
    color: '#111827',
    outline: 'none',
  },
  helperText: {
    color: '#6b7280',
    fontSize: '12px',
    lineHeight: 1.4,
  },
  helperError: {
    color: '#dc2626',
    fontSize: '12px',
    lineHeight: 1.4,
  },
  textarea: {
    minHeight: '88px',
    borderRadius: '12px',
    border: '1px solid #fdba74',
    background: '#fff',
    padding: '10px 12px',
    fontSize: '13px',
    color: '#111827',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  primaryButton: {
    height: '46px',
    border: 'none',
    borderRadius: '14px',
    background: '#111827',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  ghostButton: {
    border: '1px solid #e5e7eb',
    borderRadius: '999px',
    background: '#fff',
    color: '#111827',
    fontSize: '12px',
    fontWeight: '700',
    padding: '8px 12px',
    cursor: 'pointer',
  },
  listHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  listHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  counterBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '66px',
    height: '30px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#fff7ed',
    color: '#c2410c',
    fontSize: '11px',
    fontWeight: '700',
    border: '1px solid #fdba74',
  },
  requestList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  requestCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '12px',
    background: '#fffdf8',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  noteBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '10px 12px',
    borderRadius: '12px',
    background: '#fff7ed',
    border: '1px solid #fdba74',
  },
  noteLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#9a3412',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  noteValue: {
    color: '#7c2d12',
    fontSize: '13px',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  requestOwner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '9px 11px',
    borderRadius: '12px',
    background: '#fff7ed',
    border: '1px solid #fdba74',
  },
  requestOwnerLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#9a3412',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  requestOwnerValue: {
    color: '#7c2d12',
    fontSize: '13px',
  },
  requestGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '10px',
  },
  requestCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  requestLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#9a3412',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  requestValue: {
    color: '#111827',
    fontSize: '14px',
    lineHeight: 1.4,
  },
  emptyState: {
    border: '1px dashed #fdba74',
    borderRadius: '16px',
    padding: '16px',
    color: '#6b7280',
    fontSize: '13px',
    lineHeight: 1.6,
    background: '#fffaf5',
  },
  error: {
    margin: 0,
    color: '#dc2626',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  success: {
    margin: 0,
    color: '#16a34a',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  loadingScreen: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff7ed',
    color: '#9a3412',
    fontSize: '15px',
    fontWeight: '700',
  },
}
