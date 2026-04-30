'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()
const TAKE_REQUESTS_TABLE = 'restock_request'

async function fetchOpenRequests() {
  const { data, error } = await supabase
    .from(TAKE_REQUESTS_TABLE)
    .select('id, requester_name, item_name, size, qty, take_from, storage_id, created_at')
    .eq('request_status', 'open')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data || []
}

async function getCurrentUserEmail() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.email || null
}

export default function TakeRequestsMobile() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [completingId, setCompletingId] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [actualQty, setActualQty] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
        const rows = await fetchOpenRequests()
        setRequests(rows)
        setLoading(false)
      } catch (loadError) {
        setError(
          loadError.message ||
            'Failed to load take requests. Make sure restock_request exists and can be selected.'
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

  function openCompleteModal(row) {
    setSelectedRequest(row)
    setActualQty(String(row.qty || ''))
    setError('')
    setSuccess('')
  }

  function closeCompleteModal() {
    setSelectedRequest(null)
    setActualQty('')
  }

  async function handleComplete(event) {
    event.preventDefault()

    if (!selectedRequest) {
      return
    }

    setCompletingId(selectedRequest.id)
    setError('')
    setSuccess('')

    const fulfilledQty = Number(actualQty || 0)

    if (fulfilledQty <= 0) {
      setError('Qty yang diambil harus lebih dari 0.')
      setCompletingId('')
      return
    }

    if (selectedRequest.storage_id) {
      const { data: currentEntry, error: fetchError } = await supabase
        .from('warehouse_storage')
        .select('id, qty')
        .eq('id', selectedRequest.storage_id)
        .maybeSingle()

      if (fetchError) {
        setError(fetchError.message)
        setCompletingId('')
        return
      }

      if (!currentEntry) {
        setError('Storage item sudah tidak ditemukan. Cek request ini sebelum complete.')
        setCompletingId('')
        return
      }

      const currentQty = Number(currentEntry.qty || 0)

      if (currentQty < fulfilledQty) {
        setError('Qty di storage sudah berubah dan tidak cukup untuk jumlah ambil ini.')
        setCompletingId('')
        return
      }

      if (currentQty === fulfilledQty) {
        const { error: deleteError } = await supabase
          .from('warehouse_storage')
          .delete()
          .eq('id', selectedRequest.storage_id)

        if (deleteError) {
          setError(deleteError.message)
          setCompletingId('')
          return
        }
      } else {
        const pickerEmail = await getCurrentUserEmail()
        const { error: updateError } = await supabase
          .from('warehouse_storage')
          .update({
            qty: currentQty - fulfilledQty,
            updated_by: pickerEmail,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedRequest.storage_id)

        if (updateError) {
          setError(updateError.message)
          setCompletingId('')
          return
        }
      }
    }

    const pickerEmail = await getCurrentUserEmail()
    const { error: requestUpdateError } = await supabase
      .from(TAKE_REQUESTS_TABLE)
      .update({
        qty: fulfilledQty,
        request_status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: pickerEmail,
      })
      .eq('id', selectedRequest.id)

    if (requestUpdateError) {
      setError(requestUpdateError.message)
      setCompletingId('')
      return
    }

    await refreshRequests(false)
    setSuccess(`Request untuk ${selectedRequest.requester_name} sudah selesai.`)
    setCompletingId('')
    closeCompleteModal()
  }

  if (loading) {
    return <div style={styles.loadingScreen}>Loading take requests...</div>
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.topBar}>
          <Link href="/dashboard/storage" style={styles.backIconLink} aria-label="Back to Storage">
            ←
          </Link>
        </div>

        <div style={styles.hero}>
          <div>
            <p style={styles.eyebrow}>Barang Kosong</p>
            <h1 style={styles.title}>Stock Replenishment</h1>
          </div>
        </div>

        <div style={styles.summaryCard}>
          <div style={styles.summaryHeader}>
            <div>
              <span style={styles.summaryLabel}>Open Requests</span>
              <strong style={styles.summaryValue}>{requests.length}</strong>
            </div>

            <button
              type="button"
              onClick={() => refreshRequests(true)}
              style={styles.secondaryButton}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}
        {success ? <p style={styles.success}>{success}</p> : null}

        {requests.length === 0 ? (
          <div style={styles.emptyState}>
            Belum ada request aktif. Halaman ini akan update otomatis setiap beberapa detik.
          </div>
        ) : (
          <div style={styles.requestList}>
            {requests.map((row) => (
              <div key={row.id} style={styles.requestCard}>
                <div style={styles.ownerCard}>
                  <span style={styles.ownerLabel}>Untuk</span>
                  <strong style={styles.ownerValue}>{row.requester_name}</strong>
                  <span style={styles.timeText}>{new Date(row.created_at).toLocaleString('id-ID')}</span>
                </div>

                <div style={styles.requestCell}>
                  <span style={styles.requestLabel}>Nama Barang</span>
                  <strong style={styles.requestValue}>{row.item_name}</strong>
                </div>

                <div style={styles.requestRow}>
                  <div style={styles.requestCell}>
                    <span style={styles.requestLabel}>Size</span>
                    <strong style={styles.requestValue}>{row.size || '-'}</strong>
                  </div>

                  <div style={styles.requestCell}>
                    <span style={styles.requestLabel}>Qty</span>
                    <strong style={styles.requestValue}>{row.qty}</strong>
                  </div>
                </div>

                <div style={styles.requestCell}>
                  <span style={styles.requestLabel}>Take from</span>
                  <strong style={styles.requestValue}>{row.take_from}</strong>
                </div>

                <button
                  type="button"
                  onClick={() => openCompleteModal(row)}
                  style={styles.completeButton}
                  disabled={completingId === row.id}
                >
                  {completingId === row.id ? 'Completing...' : 'Complete'}
                </button>
              </div>
            ))}
          </div>
        )}

        {selectedRequest ? (
          <div style={styles.modalOverlay}>
            <div style={styles.modalCard}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>Complete Request</h2>
                <button type="button" onClick={closeCompleteModal} style={styles.modalCloseButton}>
                  Close
                </button>
              </div>

              <p style={styles.modalText}>
                <strong>Untuk:</strong> {selectedRequest.requester_name}
              </p>
              <p style={styles.modalText}>
                <strong>Barang:</strong> {selectedRequest.item_name}
              </p>
              <p style={styles.modalText}>
                <strong>Size:</strong> {selectedRequest.size || '-'}
              </p>
              <p style={styles.modalText}>
                <strong>Request Qty:</strong> {selectedRequest.qty}
              </p>
              <p style={styles.modalText}>
                <strong>Take from:</strong> {selectedRequest.take_from}
              </p>

              <form onSubmit={handleComplete} style={styles.modalForm}>
                <div style={styles.requestCell}>
                  <label style={styles.requestLabel}>Actual Take Qty</label>
                  <input
                    value={actualQty}
                    onChange={(event) => setActualQty(event.target.value.replace(/\D/g, ''))}
                    style={styles.modalInput}
                    inputMode="numeric"
                    required
                  />
                </div>

                <div style={styles.modalActions}>
                  <button type="button" onClick={closeCompleteModal} style={styles.modalSecondaryButton}>
                    Cancel
                  </button>
                  <button type="submit" style={styles.completeButton} disabled={completingId === selectedRequest.id}>
                    {completingId === selectedRequest.id ? 'Completing...' : 'Complete'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #fef7ed 0%, #ffffff 28%, #f8fafc 100%)',
    padding: '18px 14px 32px',
  },
  shell: {
    width: '100%',
    maxWidth: '560px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
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
  secondaryButton: {
    height: '38px',
    padding: '0 14px',
    borderRadius: '999px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  summaryCard: {
    padding: '14px 16px',
    borderRadius: '18px',
    background: '#fff',
    border: '1px solid #fdba74',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
  },
  summaryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  summaryLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#c2410c',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: '6px',
  },
  summaryValue: {
    fontSize: '22px',
    lineHeight: 1,
    color: '#111827',
    display: 'block',
  },
  requestList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  requestCard: {
    background: 'rgba(255, 255, 255, 0.96)',
    border: '1px solid #fed7aa',
    borderRadius: '24px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
  },
  ownerCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '12px 14px',
    borderRadius: '18px',
    background: '#fff7ed',
    border: '1px solid #fdba74',
  },
  ownerLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#9a3412',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  ownerValue: {
    color: '#7c2d12',
    fontSize: '18px',
  },
  timeText: {
    color: '#6b7280',
    fontSize: '12px',
    lineHeight: 1.4,
  },
  requestRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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
    lineHeight: 1.45,
  },
  completeButton: {
    height: '46px',
    border: 'none',
    borderRadius: '16px',
    background: '#111827',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  emptyState: {
    border: '1px dashed #fdba74',
    borderRadius: '20px',
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
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 50,
  },
  modalCard: {
    width: '100%',
    maxWidth: '520px',
    background: '#fff',
    borderRadius: '20px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  modalTitle: {
    margin: 0,
    fontSize: '22px',
    color: '#111827',
  },
  modalCloseButton: {
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    borderRadius: '10px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  modalText: {
    margin: 0,
    color: '#374151',
    lineHeight: 1.5,
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  modalInput: {
    height: '46px',
    borderRadius: '14px',
    border: '1px solid #fdba74',
    background: '#fff',
    padding: '0 14px',
    fontSize: '14px',
    color: '#111827',
    outline: 'none',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  modalSecondaryButton: {
    height: '46px',
    padding: '0 16px',
    borderRadius: '16px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
}
