'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()
const RACK_LOCATION_BATCH_SIZE = 1000
const PREFS_STORAGE_KEY = 'take-shortcut-prefs'
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

function buildRequestRows(matches, rackLocations, form) {
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
      requester_name: form.requesterName.trim(),
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
      requester_name: form.requesterName.trim(),
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
      requester_name: form.requesterName.trim(),
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

export default function TakeShortcutPage() {
  const [rackLocations, setRackLocations] = useState([])
  const [requests, setRequests] = useState([])
  const [hasHydrated, setHasHydrated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    requesterName: '',
    size: '',
    qty: '1',
    searchTerm: '',
  })

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
        const [rackData, requestRows] = await Promise.all([
          fetchAllRackLocations(),
          fetchOpenRequests(),
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

        const storedPrefs = window.localStorage.getItem(PREFS_STORAGE_KEY)

        if (storedPrefs) {
          const parsedPrefs = JSON.parse(storedPrefs)
          setForm((prev) => ({
            ...prev,
            requesterName: parsedPrefs.requesterName || '',
          }))
        }

        setHasHydrated(true)
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
    if (!hasHydrated) {
      return
    }

    window.localStorage.setItem(
      PREFS_STORAGE_KEY,
      JSON.stringify({
        requesterName: form.requesterName,
      })
    )
  }, [form.requesterName, hasHydrated])

  useEffect(() => {
    if (!hasHydrated) {
      return
    }

    const intervalId = window.setInterval(() => {
      refreshRequests(false)
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [hasHydrated])

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
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    if (!form.requesterName.trim()) {
      setError('Nama requester wajib diisi.')
      setSubmitting(false)
      return
    }

    if (!form.searchTerm.trim()) {
      setError('Nama barang atau SKU wajib diisi.')
      setSubmitting(false)
      return
    }

    const requestedQty = Number(form.qty || 0)

    if (requestedQty <= 0) {
      setError('Qty harus lebih dari 0.')
      setSubmitting(false)
      return
    }

    const { data, error: searchError } = await supabase
      .from('warehouse_storage')
      .select('id, rack_location_id, item_name, size, qty')
      .ilike('item_name', `%${form.searchTerm.trim()}%`)
      .order('qty', { ascending: false })
      .limit(50)

    if (searchError) {
      setError(searchError.message)
      setSubmitting(false)
      return
    }

    const payload = buildRequestRows(data || [], rackLocations, form)
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
    setSuccess('Request pengambilan sudah dibagikan ke semua device.')
    setSubmitting(false)
  }

  if (loading) {
    return <div style={styles.loadingScreen}>Loading shortcut...</div>
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.hero}>
          <div>
            <p style={styles.eyebrow}>Mobile Shortcut</p>
            <h1 style={styles.title}>Pengambilan Barang Kosong</h1>
            <p style={styles.subtitle}>
              Nama tersimpan di HP ini, tapi daftar request dibagikan ke semua device lewat Supabase.
            </p>
          </div>

          <div style={styles.heroActions}>
            <button
              type="button"
              onClick={() => refreshRequests(true)}
              style={styles.ghostButton}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>

            <Link href="/login?next=/take-requests" style={styles.loginLink}>
              Picker Login
            </Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Buat Request</h2>
            <p style={styles.cardText}>
              Yang disimpan di local hanya nama. Saat submit, nama ikut terkirim ke request bersama item-nya.
            </p>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Nama</label>
            <input
              name="requesterName"
              value={form.requesterName}
              onChange={handleInputChange}
              style={styles.input}
              placeholder="Nama picker / requester"
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
                placeholder="Contoh: M"
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
            <label style={styles.label}>Nama Barang / SKU</label>
            <input
              name="searchTerm"
              value={form.searchTerm}
              onChange={handleInputChange}
              style={styles.input}
              placeholder="Cari item yang mau diambil"
              required
            />
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
              <p style={styles.cardText}>
                Requester bisa lihat daftar aktif. Proses complete hanya dilakukan oleh picker yang login.
              </p>
            </div>

            <span style={styles.counterBadge}>{requests.length} open</span>
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

                  <div style={styles.infoBanner}>
                    Menunggu picker login untuk proses take dan complete.
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
    padding: '20px 14px 32px',
  },
  shell: {
    width: '100%',
    maxWidth: '560px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  heroActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  eyebrow: {
    margin: 0,
    color: '#c2410c',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '6px 0 0',
    fontSize: '30px',
    lineHeight: 1.1,
    color: '#111827',
  },
  subtitle: {
    margin: '10px 0 0',
    color: '#6b7280',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  loginLink: {
    width: 'fit-content',
    textDecoration: 'none',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '600',
    padding: '10px 14px',
    borderRadius: '999px',
    border: '1px solid #d1d5db',
    background: 'rgba(255, 255, 255, 0.85)',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.94)',
    border: '1px solid #fed7aa',
    borderRadius: '24px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
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
    fontSize: '20px',
    color: '#111827',
  },
  cardText: {
    margin: 0,
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: 1.5,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#374151',
  },
  input: {
    height: '48px',
    borderRadius: '14px',
    border: '1px solid #fdba74',
    background: '#fff',
    padding: '0 14px',
    fontSize: '14px',
    color: '#111827',
    outline: 'none',
  },
  primaryButton: {
    height: '50px',
    border: 'none',
    borderRadius: '16px',
    background: '#111827',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  ghostButton: {
    border: '1px solid #e5e7eb',
    borderRadius: '999px',
    background: '#fff',
    color: '#111827',
    fontSize: '13px',
    fontWeight: '700',
    padding: '10px 14px',
    cursor: 'pointer',
  },
  listHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
  },
  counterBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '72px',
    height: '34px',
    padding: '0 12px',
    borderRadius: '999px',
    background: '#fff7ed',
    color: '#c2410c',
    fontSize: '12px',
    fontWeight: '700',
    border: '1px solid #fdba74',
  },
  requestList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  requestCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '18px',
    padding: '14px',
    background: '#fffdf8',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  requestOwner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '14px',
    background: '#fff7ed',
    border: '1px solid #fdba74',
  },
  requestOwnerLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#9a3412',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  requestOwnerValue: {
    color: '#7c2d12',
    fontSize: '14px',
  },
  requestGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
  },
  requestCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  requestLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#9a3412',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  requestValue: {
    color: '#111827',
    fontSize: '15px',
    lineHeight: 1.4,
  },
  completeButton: {
    height: '44px',
    border: 'none',
    borderRadius: '14px',
    background: '#ea580c',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  infoBanner: {
    padding: '12px 14px',
    borderRadius: '14px',
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
    color: '#475569',
    fontSize: '13px',
    lineHeight: 1.5,
    fontWeight: '600',
  },
  emptyState: {
    border: '1px dashed #fdba74',
    borderRadius: '18px',
    padding: '18px',
    color: '#6b7280',
    fontSize: '14px',
    lineHeight: 1.6,
    background: '#fffaf5',
  },
  error: {
    margin: 0,
    color: '#dc2626',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  success: {
    margin: 0,
    color: '#16a34a',
    fontSize: '14px',
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
