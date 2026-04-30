'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()
const RACK_LOCATION_BATCH_SIZE = 1000
const TAKE_REQUESTS_TABLE = 'restock_request'

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
    return 'Location not found'
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

function matchesRequestedSize(entrySize, requestedSize) {
  if (!requestedSize) {
    return true
  }

  return normalizeText(entrySize) === normalizeText(requestedSize)
}

function containsRequestedSize(entrySize, requestedSize) {
  if (!requestedSize) {
    return true
  }

  const normalizedEntrySize = normalizeText(entrySize)
  const normalizedRequestedSize = normalizeText(requestedSize)

  return normalizedEntrySize.includes(normalizedRequestedSize)
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
    containsRequestedSize(entry.size, requestedSize)
  )

  if (partialSizeRows.length > 0) {
    return partialSizeRows
  }

  return []
}

function rankMatches(rows, searchTerm, size) {
  const normalizedSearchTerm = normalizeText(searchTerm)
  const normalizedSize = normalizeText(size)

  return [...rows].sort((left, right) => {
    const leftName = normalizeText(left.item_name)
    const rightName = normalizeText(right.item_name)
    const leftSize = normalizeText(left.size)
    const rightSize = normalizeText(right.size)
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
  const normalizedSize = normalizeText(form.size)
  const requestedQty = Number(form.qty || 0)
  const locationById = new Map(rackLocations.map((item) => [item.id, item]))
  const rankedMatches = rankMatches(matches, form.searchTerm, normalizedSize)
  const rows = []
  let remainingQty = requestedQty

  rankedMatches.forEach((entry) => {
    if (remainingQty <= 0) {
      return
    }

    const availableQty = Number(entry.qty || 0)

    if (availableQty <= 0) {
      return
    }

    const takeQty = Math.min(availableQty, remainingQty)
    const location = locationById.get(entry.rack_location_id) || null

    rows.push({
      requester_name: requesterName.trim(),
      item_name: entry.item_name || form.searchTerm.trim(),
      size: entry.size || form.size.trim() || '-',
      qty: takeQty,
      take_from: getLocationLabel(location),
      storage_id: entry.id,
      search_term: form.searchTerm.trim(),
      request_status: 'open',
    })

    remainingQty -= takeQty
  })

  if (rows.length === 0) {
    rows.push({
      requester_name: requesterName.trim(),
      item_name: form.searchTerm.trim(),
      size: form.size.trim() || '-',
      qty: requestedQty,
      take_from: 'Stock not found',
      storage_id: null,
      search_term: form.searchTerm.trim(),
      request_status: 'open',
    })
  } else if (remainingQty > 0) {
    rows.push({
      requester_name: requesterName.trim(),
      item_name: form.searchTerm.trim(),
      size: form.size.trim() || '-',
      qty: remainingQty,
      take_from: 'Remaining stock not found',
      storage_id: null,
      search_term: form.searchTerm.trim(),
      request_status: 'open',
    })
  }

  return rows
}

async function fetchOpenRequests() {
  const { data, error } = await supabase
    .from(TAKE_REQUESTS_TABLE)
    .select('id, requester_name, item_name, size, qty, take_from, storage_id, search_term, created_at')
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
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    size: '',
    qty: '1',
    searchTerm: '',
  })

  async function fetchRequesterName() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      throw new Error('User session not found.')
    }

    const { data: profile, error: profileError } = await supabase
      .from('dir_user_profiles')
      .select('display_name')
      .eq('email', user.email.toLowerCase())
      .maybeSingle()

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
        const [rackData, requestRows, currentRequesterName] = await Promise.all([
          fetchAllRackLocations(),
          fetchOpenRequests(),
          fetchRequesterName(),
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
        name === 'size' || name === 'searchTerm'
          ? value.toUpperCase()
          : value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    if (!requesterName.trim()) {
      setError('Display name user belum tersedia. Isi dulu di User Access.')
      setSubmitting(false)
      return
    }

    if (!form.searchTerm.trim()) {
      setError('SKU wajib diisi.')
      setSubmitting(false)
      return
    }

    if (!form.size.trim()) {
      setError('Size wajib diisi.')
      setSubmitting(false)
      return
    }

    const requestedQty = Number(form.qty || 0)

    if (requestedQty <= 0) {
      setError('Qty harus lebih dari 0.')
      setSubmitting(false)
      return
    }

    const storageQuery = supabase
      .from('warehouse_storage')
      .select('id, rack_location_id, item_name, size, qty')
      .ilike('item_name', `%${form.searchTerm.trim()}%`)
      .order('qty', { ascending: false })
      .limit(50)

    const { data, error: searchError } = await storageQuery

    if (searchError) {
      setError(searchError.message)
      setSubmitting(false)
      return
    }

    const matchedRows = selectRowsForRequestedSize(data || [], form.size.trim())
    const payload = buildRequestRows(matchedRows, rackLocations, form, requesterName)
    const { error: insertError } = await supabase.from(TAKE_REQUESTS_TABLE).insert(payload)

    if (insertError) {
      setError(
        `${insertError.message} Pastikan tabel ${TAKE_REQUESTS_TABLE} dan policy insert/select-nya sudah ada.`
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
    }))
    setSuccess('Submit berhasil')
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
            <p style={styles.eyebrow}>Barang Kosong</p>
            <h1 style={styles.title}>{title}</h1>
            {subtitle ? <p style={styles.subtitle}>{subtitle}</p> : null}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Buat Request</h2>
          </div>

          <div style={styles.requesterBox}>
            <span style={styles.requesterLabel}>Requester</span>
            <strong style={styles.requesterValue}>{requesterName || '-'}</strong>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Nama Barang / SKU</label>
            <input
              name="searchTerm"
              value={form.searchTerm}
              onChange={handleInputChange}
              style={styles.input}
              placeholder="CARI ITEM YANG MAU DIAMBIL"
              required
            />
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Size</label>
              <input
                name="size"
                value={form.size}
                onChange={handleInputChange}
                style={styles.input}
                placeholder="CONTOH: M"
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

          {error ? <p style={styles.error}>{error}</p> : null}
          {success ? <p style={styles.success}>{success}</p> : null}

          <button type="submit" style={styles.primaryButton} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>

        <div style={styles.card}>
          <div style={styles.listHeader}>
            <div>
              <h2 style={styles.cardTitle}>Daftar Pengambilan</h2>
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
              Belum ada request. Submit barang di form atas untuk mulai daftar pengambilan.
            </div>
          ) : (
            <div style={styles.requestList}>
              {requests.map((row) => (
                <div key={row.id} style={styles.requestCard}>
                  <div style={styles.requestOwner}>
                    <span style={styles.requestOwnerLabel}>Untuk</span>
                    <strong style={styles.requestOwnerValue}>{row.requester_name}</strong>
                  </div>

                  <div style={styles.requestGrid}>
                    <div style={styles.requestCell}>
                      <span style={styles.requestLabel}>Nama Barang</span>
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
                      <strong style={styles.requestValue}>{row.take_from}</strong>
                    </div>
                  </div>

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
