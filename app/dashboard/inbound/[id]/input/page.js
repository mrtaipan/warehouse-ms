'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

const supabase = createClient()

function sanitizeQuantityInput(value) {
  return String(value || '').replace(/\D/g, '')
}

function preventNumberWheel(event) {
  event.currentTarget.blur()
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

function getDisplayName(user, profile) {
  return (
    String(profile?.display_name || '').trim() ||
    String(user?.user_metadata?.display_name || '').trim() ||
    String(user?.user_metadata?.full_name || '').trim() ||
    String(user?.user_metadata?.name || '').trim() ||
    String(user?.email || '').split('@')[0] ||
    'Inbound Staff'
  )
}

function getFirstName(value) {
  return String(value || '').trim().split(/\s+/)[0] || '-'
}

function buildRows(totalKoli, detailRows) {
  const rowCount = Math.max(Number(totalKoli || 0), 1)
  const rowsBySequence = new Map(
    (detailRows || [])
      .map((row, index) => [Number(row.koli_sequence || index + 1), row])
      .filter(([sequence]) => sequence >= 1 && sequence <= rowCount)
  )

  return Array.from({ length: rowCount }, (_, index) => {
    const sequence = index + 1
    const existing = rowsBySequence.get(sequence)

    return {
      id: existing?.id || null,
      row_no: sequence,
      supplier_colli_no: existing?.supplier_colli_no || '',
      supplier_qty: existing?.claimed_qty ?? '',
      sample_qty: existing?.sample_qty ?? '',
      bongkar_qty: existing?.actual_qty ?? '',
      unload_pic: existing?.unload_pic || '',
    }
  })
}

function getVariance(row) {
  const supplierQty = Number(row.supplier_qty || 0)
  const sampleQty = Number(row.sample_qty || 0)
  const unloadedQty = Number(row.bongkar_qty || 0)
  return unloadedQty + sampleQty - supplierQty
}

function createBlankDraft() {
  return {
    supplier_colli_no: '',
    supplier_qty: '',
    sample_qty: '',
    bongkar_qty: '',
  }
}

function getVarianceTone(value) {
  if (value < 0) return styles.varianceDanger
  if (value > 0) return styles.varianceWarning
  return styles.varianceSuccess
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  )
}

export default function ReceivingInputPage() {
  const router = useRouter()
  const params = useParams()
  const inboundId = params.id
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [inbound, setInbound] = useState(null)
  const [rows, setRows] = useState([])
  const [draft, setDraft] = useState(createBlankDraft)
  const [loadingPage, setLoadingPage] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const displayName = getDisplayName(user, profile)
  const displayFirstName = getFirstName(displayName)
  const submittedCount = rows.filter((row) => String(row.unload_pic || '').trim()).length
  const totalKoli = Math.max(Number(inbound?.total_koli || 0), 1)
  const isCompleted = submittedCount >= totalKoli
  const nextInputNumber = Math.min(submittedCount + 1, totalKoli)
  const progressValue = totalKoli ? Math.min(100, Math.round((submittedCount / totalKoli) * 100)) : 0
  const draftVariance = useMemo(() => getVariance(draft), [draft])
  const varianceLabel = draftVariance > 0 ? `+${draftVariance}` : String(draftVariance)
  const hasUnsavedDraft = useMemo(
    () => Object.values(draft).some((value) => String(value || '').trim()),
    [draft]
  )

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setLoadingPage(true)
      setError('')

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        router.push('/login')
        return
      }

      const [
        profileResult,
        { data: inboundRow, error: inboundError },
        { data: detailRows, error: detailError },
      ] = await Promise.all([
        getProfileByAuthenticatedUser(supabase, authUser, 'id, email, display_name, role'),
        supabase
          .from('inbound')
          .select('id, grn_number, inbound_date, supplier_id, item_name, total_claimed_qty, total_received_qty, total_koli, suppliers:dir_suppliers!supplier_id (supplier_name)')
          .eq('id', inboundId)
          .single(),
        supabase
          .from('inbound_receiving')
          .select('id, inbound_id, claimed_qty, actual_qty, supplier_colli_no, sample_qty, unload_pic, koli_sequence')
          .eq('inbound_id', inboundId)
          .order('koli_sequence', { ascending: true }),
      ])

      if (!isMounted) return

      if (inboundError || detailError || !inboundRow) {
        setError(inboundError?.message || detailError?.message || 'Failed to load receiving input.')
        setLoadingPage(false)
        return
      }

      const nextRows = buildRows(inboundRow.total_koli, detailRows || [])

      setUser(authUser)
      setProfile(profileResult.data || null)
      setInbound(inboundRow)
      setRows(nextRows)
      setDraft(createBlankDraft())
      setLoadingPage(false)
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [inboundId, router])

  useEffect(() => {
    if (!hasUnsavedDraft || saving) return undefined

    function handleBeforeUnload(event) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedDraft, saving])

  function updateDraft(name, value) {
    const nextValue = name === 'supplier_colli_no' ? value.toUpperCase() : sanitizeQuantityInput(value)
    setDraft((prev) => ({ ...prev, [name]: nextValue }))
  }

  async function reloadInputState(successMessage = '') {
    const [
      { data: inboundRow, error: inboundError },
      { data: detailRows, error: detailError },
    ] = await Promise.all([
      supabase
        .from('inbound')
        .select('id, grn_number, inbound_date, supplier_id, item_name, total_claimed_qty, total_received_qty, total_koli, suppliers:dir_suppliers!supplier_id (supplier_name)')
        .eq('id', inboundId)
        .single(),
      supabase
        .from('inbound_receiving')
        .select('id, inbound_id, claimed_qty, actual_qty, supplier_colli_no, sample_qty, unload_pic, koli_sequence')
        .eq('inbound_id', inboundId)
        .order('koli_sequence', { ascending: true }),
    ])

    if (inboundError || detailError || !inboundRow) {
      throw new Error(inboundError?.message || detailError?.message || 'Failed to refresh receiving input.')
    }

    setInbound(inboundRow)
    setRows(buildRows(inboundRow.total_koli, detailRows || []))
    setDraft(createBlankDraft())
    setSuccess(successMessage)
  }

  async function refreshInboundTotal(detailRows) {
    const totalReceivedQty = (detailRows || []).reduce(
      (sum, row) => sum + Number(row.actual_qty || 0) + Number(row.sample_qty || 0),
      0
    )

    const { error: updateError } = await supabase
      .from('inbound')
      .update({
        total_received_qty: totalReceivedQty,
        status: 'inbound',
        updated_at: new Date().toISOString(),
      })
      .eq('id', inboundId)

    if (updateError) {
      throw updateError
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (saving) return

    if (isCompleted) {
      setError('')
      setSuccess('All koli rows have already been submitted.')
      return
    }

    if (!draft.bongkar_qty) {
      setError('Unloaded Qty is required.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    const { data: latestRows, error: latestRowsError } = await supabase
      .from('inbound_receiving')
      .select('id, inbound_id, claimed_qty, actual_qty, supplier_colli_no, sample_qty, unload_pic, koli_sequence')
      .eq('inbound_id', inboundId)
      .order('koli_sequence', { ascending: true })

    if (latestRowsError) {
      setError(latestRowsError.message)
      setSaving(false)
      return
    }

    const availableRows = buildRows(totalKoli, latestRows || [])
    const targetRow = availableRows.find((row) => !String(row.unload_pic || '').trim())

    if (!targetRow) {
      try {
        await reloadInputState('All koli rows have already been submitted.')
      } catch (refreshError) {
        setError(refreshError.message)
      }

      setSaving(false)
      return
    }

    const payload = {
      inbound_id: Number(inboundId),
      claimed_qty: Number(draft.supplier_qty || 0),
      actual_qty: Number(draft.bongkar_qty || 0),
      supplier_colli_no: draft.supplier_colli_no.trim() || null,
      sample_qty: Number(draft.sample_qty || 0),
      unload_pic: displayName,
      koli_sequence: targetRow.row_no,
    }

    const result = targetRow.id
      ? await supabase
          .from('inbound_receiving')
          .update(payload)
          .eq('id', targetRow.id)
          .is('unload_pic', null)
          .select('id')
          .maybeSingle()
      : await supabase.from('inbound_receiving').insert(payload).select('id').single()

    if (result.error) {
      setError(result.error.message)
      setSaving(false)
      return
    }

    if (!result.data?.id) {
      try {
        await reloadInputState('Another user submitted first. Ready for the next available koli.')
      } catch (refreshError) {
        setError(refreshError.message)
      }

      setSaving(false)
      return
    }

    const { data: refreshedRows, error: refreshedRowsError } = await supabase
      .from('inbound_receiving')
      .select('id, inbound_id, claimed_qty, actual_qty, supplier_colli_no, sample_qty, unload_pic, koli_sequence')
      .eq('inbound_id', inboundId)
      .order('koli_sequence', { ascending: true })

    if (refreshedRowsError) {
      setError(refreshedRowsError.message)
      setSaving(false)
      return
    }

    try {
      await refreshInboundTotal(refreshedRows || [])
      await reloadInputState(`Submitted as ${targetRow.row_no} of ${totalKoli}. Ready for next input.`)
    } catch (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setSaving(false)
  }

  function handleBackToReceiving() {
    if (hasUnsavedDraft && !window.confirm('Are you sure you want to discard this receiving input?')) {
      return
    }

    router.push(`/dashboard/inbound/${inboundId}/edit`)
  }

  if (loadingPage) {
    return <div style={styles.loadingPage}>Loading receiving input...</div>
  }

  if (!inbound) {
    return (
      <div style={styles.pageShell}>
        <div style={styles.mobileFrame}>
          <p style={styles.errorText}>{error || 'Receiving input is not available.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.pageShell}>
      <main style={styles.mobileFrame}>
        <header style={styles.topBar}>
          <button type="button" onClick={handleBackToReceiving} style={styles.backButton} aria-label="Back to current receiving">
            <ArrowLeftIcon />
          </button>
          <div>
            <p style={styles.eyebrow}>Inbound</p>
            <h1 style={styles.title}>Receiving Input</h1>
          </div>
          <span style={styles.grnChip}>{inbound.grn_number || '-'}</span>
        </header>

        <section style={styles.infoBand}>
          <div>
            <span style={styles.infoLabel}>Supplier</span>
            <strong style={styles.infoValue}>{inbound.suppliers?.supplier_name || '-'}</strong>
          </div>
          <div style={styles.infoMiddle}>
            <span style={styles.infoLabel}>Input As</span>
            <strong style={styles.infoValue}>{displayFirstName}</strong>
          </div>
          <div style={styles.infoRight}>
            <span style={styles.infoLabel}>SJ Qty</span>
            <strong style={styles.infoValue}>{inbound.total_claimed_qty == null ? 'No data' : formatNumber(inbound.total_claimed_qty)}</strong>
          </div>
        </section>

        <section style={styles.progressCard}>
          <div style={styles.koliHeader}>
            <div>
              <p style={styles.koliEyebrow}>Progress</p>
              <h2 style={styles.koliTitle}>{nextInputNumber} of {totalKoli}</h2>
            </div>
            <span style={styles.koliCounter}>{submittedCount} submitted</span>
          </div>
          <div style={styles.progressTrack}>
            <span style={{ ...styles.progressFill, width: `${progressValue}%` }} />
          </div>
        </section>

        <form onSubmit={handleSubmit} style={styles.formCard}>
          <label style={styles.field}>
            <span style={styles.label}>Supplier Koli No. <em style={styles.optional}>(optional)</em></span>
            <input
              value={draft.supplier_colli_no}
              onChange={(event) => updateDraft('supplier_colli_no', event.target.value)}
              style={isCompleted ? { ...styles.input, ...styles.inputDisabled } : styles.input}
              placeholder="e.g. K-042"
              autoComplete="off"
              disabled={isCompleted}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Supplier Qty <em style={styles.optional}>(optional)</em></span>
            <input
              value={draft.supplier_qty}
              onChange={(event) => updateDraft('supplier_qty', event.target.value)}
              onWheel={preventNumberWheel}
              inputMode="numeric"
              pattern="[0-9]*"
              style={isCompleted ? { ...styles.input, ...styles.inputDisabled } : styles.input}
              placeholder="0"
              disabled={isCompleted}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Sample Qty <em style={styles.optional}>(optional)</em></span>
            <input
              value={draft.sample_qty}
              onChange={(event) => updateDraft('sample_qty', event.target.value)}
              onWheel={preventNumberWheel}
              inputMode="numeric"
              pattern="[0-9]*"
              style={isCompleted ? { ...styles.input, ...styles.inputDisabled } : styles.input}
              placeholder="0"
              disabled={isCompleted}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Unloaded Qty <strong style={styles.required}>*</strong></span>
            <input
              value={draft.bongkar_qty}
              onChange={(event) => updateDraft('bongkar_qty', event.target.value)}
              onWheel={preventNumberWheel}
              inputMode="numeric"
              pattern="[0-9]*"
              style={isCompleted ? { ...styles.input, ...styles.inputDisabled } : styles.input}
              placeholder="0"
              required
              disabled={isCompleted}
            />
          </label>

          <div style={styles.autoGrid}>
            <div style={{ ...styles.autoBox, ...getVarianceTone(draftVariance) }}>
              <span style={styles.autoLabel}>Variance</span>
              <strong style={styles.autoValue}>{varianceLabel}</strong>
              <span style={styles.autoFormula}>(Unloaded + Sample) - Supplier Qty</span>
            </div>
          </div>

          {error ? <p style={styles.errorText}>{error}</p> : null}
          {success ? <p style={styles.successText}>{success}</p> : null}

          <button type="submit" disabled={saving || isCompleted} style={{ ...styles.saveButton, ...((saving || isCompleted) ? styles.buttonDisabled : {}) }}>
            {isCompleted ? 'Completed' : saving ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </main>
    </div>
  )
}

const styles = {
  pageShell: {
    minHeight: '100dvh',
    background: '#f6f7f9',
    display: 'flex',
    justifyContent: 'center',
    padding: '0',
  },
  loadingPage: {
    minHeight: '70vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#475569',
    fontWeight: '700',
  },
  mobileFrame: {
    width: '100%',
    maxWidth: '520px',
    minHeight: '100dvh',
    background: '#ffffff',
    borderLeft: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    minHeight: '80px',
    display: 'grid',
    gridTemplateColumns: '48px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 24px',
    borderBottom: '1px solid #e5e7eb',
    background: '#fff',
  },
  backButton: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#111827',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  eyebrow: {
    margin: 0,
    color: '#64748b',
    fontSize: '11px',
    fontWeight: '850',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '3px 0 0',
    color: '#111827',
    fontSize: '22px',
    fontWeight: '900',
    lineHeight: 1.1,
    letterSpacing: 0,
  },
  grnChip: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '34px',
    padding: '0 12px',
    borderRadius: '999px',
    background: '#eef6ff',
    color: '#1e3a8a',
    fontSize: '14px',
    fontWeight: '900',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  infoBand: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr) auto',
    gap: '12px',
    padding: '18px 24px',
    background: '#fafafa',
    borderBottom: '1px solid #e5e7eb',
  },
  infoMiddle: {
    minWidth: 0,
  },
  infoRight: {
    textAlign: 'right',
  },
  infoLabel: {
    display: 'block',
    color: '#71717a',
    fontSize: '13px',
    fontWeight: '800',
  },
  infoValue: {
    display: 'block',
    marginTop: '4px',
    color: '#18181b',
    fontSize: '16px',
    fontWeight: '900',
    lineHeight: 1.25,
  },
  progressCard: {
    padding: '22px 24px 12px',
  },
  koliHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '12px',
  },
  koliEyebrow: {
    margin: 0,
    color: '#64748b',
    fontSize: '11px',
    fontWeight: '850',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  koliTitle: {
    margin: '5px 0 0',
    color: '#111827',
    fontSize: '26px',
    lineHeight: 1.1,
    fontWeight: '900',
  },
  koliCounter: {
    color: '#3f3f46',
    fontSize: '14px',
    fontWeight: '850',
  },
  progressTrack: {
    marginTop: '14px',
    height: '8px',
    borderRadius: '999px',
    background: '#e5e7eb',
    overflow: 'hidden',
  },
  progressFill: {
    display: 'block',
    height: '100%',
    borderRadius: '999px',
    background: '#0f766e',
    transition: 'width 180ms ease',
  },
  formCard: {
    padding: '10px 24px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    color: '#3f3f46',
    fontSize: '13px',
    fontWeight: '900',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  optional: {
    color: '#71717a',
    fontStyle: 'normal',
    fontWeight: '750',
    textTransform: 'none',
    letterSpacing: 0,
  },
  required: {
    color: '#dc2626',
  },
  input: {
    width: '100%',
    height: '56px',
    border: '1px solid #d4d4d8',
    borderRadius: '10px',
    padding: '0 16px',
    fontSize: '22px',
    fontWeight: '650',
    color: '#18181b',
    WebkitTextFillColor: '#18181b',
    caretColor: '#18181b',
    colorScheme: 'light',
    background: '#fff',
  },
  inputDisabled: {
    background: '#f8fafc',
    borderColor: '#e2e8f0',
    color: '#94a3b8',
    WebkitTextFillColor: '#94a3b8',
    cursor: 'not-allowed',
  },
  autoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '10px',
  },
  autoBox: {
    minHeight: '68px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '12px',
    padding: '10px 12px',
    backgroundColor: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '4px',
  },
  autoLabel: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: '850',
    textTransform: 'uppercase',
  },
  autoValue: {
    color: '#0f172a',
    fontSize: '16px',
    fontWeight: '900',
    fontVariantNumeric: 'tabular-nums',
  },
  autoFormula: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: '750',
  },
  varianceDanger: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    color: '#991b1b',
  },
  varianceWarning: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    color: '#9a3412',
  },
  varianceSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    color: '#166534',
  },
  saveButton: {
    width: '100%',
    height: '52px',
    border: 'none',
    borderRadius: '12px',
    background: '#0f766e',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '900',
    cursor: 'pointer',
    boxShadow: '0 14px 24px rgba(15, 118, 110, 0.18)',
  },
  buttonDisabled: {
    opacity: 0.62,
    cursor: 'not-allowed',
  },
  errorText: {
    margin: 0,
    color: '#b91c1c',
    fontSize: '13px',
    fontWeight: '800',
  },
  successText: {
    margin: 0,
    color: '#047857',
    fontSize: '13px',
    fontWeight: '800',
  },
  stepNav: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    padding: '0 24px 24px',
    marginTop: 'auto',
  },
  navButton: {
    height: '44px',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  navButtonDisabled: {
    color: '#94a3b8',
    background: '#f8fafc',
    cursor: 'not-allowed',
  },
}
