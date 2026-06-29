'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import { ADMIN_EMAIL, resolveRole } from '@/utils/permissions'

const supabase = createClient()
const QUANTITY_FIELDS = new Set(['qty_surat_jalan', 'total_koli', 'supplier_qty', 'sample_qty', 'bongkar_qty'])

function normalizeDateInput(value) {
  if (!value) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().slice(0, 10)
}

function buildKoliRows(count, previousRows) {
  return Array.from({ length: count }, (_, index) => {
    const existing = previousRows[index]

    return {
      id: existing?.id || null,
      row_no: index + 1,
      supplier_colli_no: existing?.supplier_colli_no || '',
      supplier_qty: existing?.supplier_qty || '',
      sample_qty: existing?.sample_qty || '',
      bongkar_qty: existing?.bongkar_qty || '',
      unload_pic: existing?.unload_pic || '',
    }
  })
}

function getDifference(row) {
  const supplierQty = Number(row.supplier_qty || 0)
  const sampleQty = Number(row.sample_qty || 0)
  const bongkarQty = Number(row.bongkar_qty || 0)
  return (bongkarQty + sampleQty) - supplierQty
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === ''
}

function sanitizeQuantityInput(value) {
  return String(value || '').replace(/\D/g, '')
}

function preventNumberWheel(event) {
  event.currentTarget.blur()
}

function normalizeGroup(value) {
  return String(value || '').trim().toUpperCase()
}

function getVarianceStyle(value) {
  if (value < 0) {
    return { color: '#991b1b', backgroundColor: '#fef2f2', borderColor: '#fecaca' }
  }

  if (value > 0) {
    return { color: '#9a3412', backgroundColor: '#fff7ed', borderColor: '#fed7aa' }
  }

  return { color: '#166534', backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="m14 7 3 3" />
    </svg>
  )
}

function InputIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 4h8" />
      <path d="M9 2h6l1 3H8z" />
      <path d="M6 5h12a2 2 0 0 1 2 2v13H4V7a2 2 0 0 1 2-2z" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  )
}

function cloneForm(value) {
  return { ...(value || {}) }
}

function cloneRows(rows) {
  return (rows || []).map((row) => ({ ...row }))
}

function normalizeFormForCompare(value) {
  return {
    grn_number: String(value?.grn_number || ''),
    inbound_date: String(value?.inbound_date || ''),
    supplier_id: String(value?.supplier_id || ''),
    item_name: String(value?.item_name || ''),
    payment_on_site: String(value?.payment_on_site || ''),
    qty_surat_jalan: String(value?.qty_surat_jalan ?? ''),
    total_koli: String(value?.total_koli ?? ''),
    notes: String(value?.notes || ''),
  }
}

function normalizeRowsForCompare(rows) {
  return (rows || []).map((row) => ({
    id: row.id || null,
    row_no: Number(row.row_no || 0),
    supplier_colli_no: String(row.supplier_colli_no || ''),
    supplier_qty: String(row.supplier_qty ?? ''),
    sample_qty: String(row.sample_qty ?? ''),
    bongkar_qty: String(row.bongkar_qty ?? ''),
    unload_pic: String(row.unload_pic || ''),
  }))
}

function receivingSnapshotChanged(currentForm, currentRows, snapshot) {
  if (!snapshot) return false

  return JSON.stringify({
    form: normalizeFormForCompare(currentForm),
    koliRows: normalizeRowsForCompare(currentRows),
  }) !== JSON.stringify({
    form: normalizeFormForCompare(snapshot.form),
    koliRows: normalizeRowsForCompare(snapshot.koliRows),
  })
}

function getFirstName(value) {
  return String(value || '').trim().split(/\s+/)[0] || '-'
}

function formatSignedNumber(value) {
  return value > 0 ? `+${value}` : String(value)
}

const styles = {
  eyebrow: {
    margin: 0,
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    color: '#0f172a',
    fontSize: '28px',
    fontWeight: '900',
    lineHeight: 1.05,
    letterSpacing: 0,
  },
  subtitle: { marginTop: 0, marginBottom: '24px', color: '#6b7280' },
  panel: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formTopBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 344px) minmax(0, 1fr)',
    gap: '20px',
    alignItems: 'start',
  },
  headerColumn: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  breakdownColumn: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '28px',
    fontWeight: '900',
    lineHeight: 1.05,
    letterSpacing: 0,
  },
  headerGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
  },
  threeFieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '10px',
    alignItems: 'end',
  },
  grnCard: {
    border: '1px solid #cbd5e1',
    borderRadius: '14px',
    padding: '14px 16px',
    background: '#f8fafc',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.9)',
  },
  grnLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: '6px',
  },
  grnValue: {
    display: 'block',
    color: '#0f172a',
    fontSize: '28px',
    fontWeight: '900',
    lineHeight: 1.05,
    fontVariantNumeric: 'tabular-nums',
    wordBreak: 'break-word',
  },
  fieldFull: { gridColumn: '1 / -1' },
  fieldWide: { gridColumn: '1 / -1' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '12px', fontWeight: '750', color: '#334155' },
  helperText: { fontSize: '12px', color: '#6b7280' },
  input: {
    height: '40px',
    padding: '0 11px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    width: '100%',
    backgroundColor: '#fff',
    color: '#111827',
  },
  inputReadonly: {
    height: '40px',
    padding: '0 11px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    width: '100%',
    backgroundColor: '#f8fafc',
    color: '#475569',
  },
  disabledControl: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    color: '#64748b',
    cursor: 'not-allowed',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.72)',
  },
  disabledTextarea: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    color: '#64748b',
    cursor: 'not-allowed',
  },
  select: {
    height: '40px',
    padding: '0 11px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    width: '100%',
    backgroundColor: '#fff',
    color: '#111827',
  },
  textarea: {
    minHeight: '80px',
    padding: '11px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    width: '100%',
    backgroundColor: '#fff',
    color: '#111827',
    resize: 'vertical',
  },
  itemTextarea: {
    minHeight: '96px',
    resize: 'vertical',
  },
  helperBox: {
    padding: '14px 16px',
    borderRadius: '12px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    color: '#6b7280',
    fontSize: '14px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(112px, 1fr))',
    gap: '10px',
  },
  summaryGridCompact: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
    gap: '10px',
  },
  summaryCard: {
    minWidth: 0,
    backgroundColor: '#fff',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '12px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  summaryLabel: {
    fontSize: '10px',
    color: '#64748b',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  summaryValue: {
    fontSize: '20px',
    color: '#111827',
    fontWeight: '800',
    fontVariantNumeric: 'tabular-nums',
  },
  summaryPairValue: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
    fontSize: '18px',
    lineHeight: 1.25,
    fontWeight: '850',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  summaryPairDivider: {
    color: '#94a3b8',
    fontSize: '16px',
    fontWeight: '800',
  },
  summaryCardDimmed: {
    opacity: 0.72,
    filter: 'saturate(0.72)',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    width: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
  },
  th: {
    padding: '10px 12px',
    textAlign: 'center',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '12px',
    fontWeight: '700',
    color: '#374151',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 12px',
    borderTop: '1px solid #f1f5f9',
    fontSize: '13px',
    textAlign: 'center',
    verticalAlign: 'top',
  },
  displayCell: {
    minHeight: '32px',
    minWidth: '64px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#475569',
    fontWeight: '650',
  },
  tableInput: {
    width: '100%',
    minWidth: '100px',
    height: '36px',
    padding: '0 10px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
  },
  tableInputShort: {
    width: '76px',
    height: '36px',
    padding: '0 10px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
  },
  diffBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '58px',
    height: '30px',
    padding: '0 10px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: '700',
  },
  switchButton: {
    width: '52px',
    height: '30px',
    border: 'none',
    borderRadius: '999px',
    padding: '3px',
    cursor: 'pointer',
    transition: 'background 160ms ease',
  },
  switchButtonOn: { background: '#16a34a' },
  switchButtonOff: { background: '#cbd5e1' },
  switchButtonDisabled: {
    opacity: 0.58,
    cursor: 'not-allowed',
  },
  switchKnob: {
    display: 'block',
    width: '24px',
    height: '24px',
    borderRadius: '999px',
    background: '#fff',
    boxShadow: '0 2px 7px rgba(15, 23, 42, 0.22)',
    transition: 'transform 160ms ease',
  },
  switchKnobOn: { transform: 'translateX(22px)' },
  switchValue: { fontSize: '13px', fontWeight: '700', color: '#475569' },
  switchRow: { display: 'flex', alignItems: 'center', gap: '10px', minHeight: '40px' },
  actions: { display: 'flex', gap: '10px', alignItems: 'center' },
  iconActionButton: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '900',
  },
  editIconButton: {
    border: '1px solid #cbd5e1',
    background: '#111827',
    color: '#fff',
    boxShadow: '0 8px 18px rgba(17, 24, 39, 0.16)',
  },
  inputIconButton: {
    border: '1px solid #99f6e4',
    background: '#0f766e',
    color: '#fff',
    boxShadow: '0 8px 18px rgba(15, 118, 110, 0.16)',
  },
  closeIconButton: {
    border: '1px solid #fecaca',
    background: '#fff',
    color: '#dc2626',
  },
  closeIconGlyph: {
    color: '#dc2626',
    fontWeight: '950',
    lineHeight: 1,
  },
  formLock: {
    border: 0,
    margin: 0,
    padding: 0,
    minInlineSize: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  panelSaving: {
    cursor: 'wait',
  },
  savingText: {
    margin: 0,
    color: '#475569',
    fontSize: '13px',
    fontWeight: '700',
  },
  primaryButton: {
    height: '40px',
    padding: '0 18px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#14532d',
    color: '#fff',
    fontWeight: '800',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(20, 83, 45, 0.18)',
  },
  primaryButtonDisabled: {
    backgroundColor: '#94a3b8',
    cursor: 'not-allowed',
    boxShadow: 'none',
    opacity: 0.72,
  },
  secondaryButton: {
    height: '40px',
    padding: '0 18px',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    backgroundColor: '#7f1d1d',
    color: '#fff',
    fontWeight: '800',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(127, 29, 29, 0.16)',
  },
  error: { color: '#dc2626', margin: 0 },
  success: { color: '#16a34a', margin: 0 },
}

export default function EditReceivingPage() {
  const router = useRouter()
  const params = useParams()
  const inboundId = params.id
  const [suppliers, setSuppliers] = useState([])
  const [loadedDetailIds, setLoadedDetailIds] = useState([])
  const [loadingPage, setLoadingPage] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isCompactLayout, setIsCompactLayout] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState(null)
  const [form, setForm] = useState({
    grn_number: '',
    inbound_date: '',
    supplier_id: '',
    item_name: '',
    payment_on_site: 'yes',
    qty_surat_jalan: '',
    total_koli: '',
    notes: '',
  })
  const [koliRows, setKoliRows] = useState([])

  useEffect(() => {
    function updateLayout() {
      setIsCompactLayout(window.innerWidth < 960)
    }

    updateLayout()
    window.addEventListener('resize', updateLayout)
    return () => window.removeEventListener('resize', updateLayout)
  }, [])

  const loadData = useEffectEvent(async () => {
    setLoadingPage(true)
    setError('')

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      router.push('/login')
      return
    }

    const emailAdmin = authUser.email?.toLowerCase() === ADMIN_EMAIL
    const [
      profileResult,
      { data: supplierRows, error: supplierError },
      { data: inboundRow, error: inboundError },
      { data: detailRows, error: detailError },
    ] = await Promise.all([
      getProfileByAuthenticatedUser(supabase, authUser, 'role'),
      supabase.from('dir_suppliers').select('id, supplier_name, group').eq('is_active', true).ilike('group', 'MOB').order('supplier_name', { ascending: true }),
      supabase.from('inbound').select('*').eq('id', inboundId).single(),
      supabase.from('inbound_receiving').select('*').eq('inbound_id', inboundId).order('koli_sequence', { ascending: true }),
    ])

    if (supplierError || inboundError || detailError) {
      setError(supplierError?.message || inboundError?.message || detailError?.message || 'Failed to load receiving data.')
      setLoadingPage(false)
      return
    }

    const mappedRows = (detailRows || []).map((row, index) => ({
      id: row.id,
      row_no: row.koli_sequence || index + 1,
      supplier_colli_no: row.supplier_colli_no || '',
      supplier_qty: row.claimed_qty ?? '',
      sample_qty: row.sample_qty ?? '',
      bongkar_qty: row.actual_qty ?? '',
      unload_pic: row.unload_pic || '',
    }))
    const role = resolveRole(profileResult.data?.role, emailAdmin)
    const nextForm = {
      grn_number: inboundRow.grn_number || '',
      inbound_date: normalizeDateInput(inboundRow.inbound_date),
      supplier_id: inboundRow.supplier_id ? String(inboundRow.supplier_id) : '',
      item_name: inboundRow.item_name || '',
      payment_on_site: inboundRow.payment_on_site ? 'yes' : 'no',
      qty_surat_jalan: inboundRow.total_claimed_qty ?? '',
      total_koli: inboundRow.total_koli ? String(inboundRow.total_koli) : mappedRows.length ? String(mappedRows.length) : '',
      notes: inboundRow.notes || '',
    }
    const nextRows = buildKoliRows(Number(inboundRow.total_koli || mappedRows.length || 0), mappedRows)

    setUserRole(role)
    setIsAdminUser(emailAdmin || role === 'admin')
    setSuppliers((supplierRows || []).filter((supplier) => normalizeGroup(supplier.group) === 'MOB'))
    setLoadedDetailIds((detailRows || []).map((row) => row.id))
    setForm(nextForm)
    setKoliRows(nextRows)
    setSavedSnapshot({
      form: cloneForm(nextForm),
      koliRows: cloneRows(nextRows),
    })
    setLoadingPage(false)
  })

  useEffect(() => {
    loadData()
  }, [inboundId])

  function handleStartEdit() {
    setError('')
    setSuccess('')
    setIsEditing(true)
  }

  function handleCancelEdit() {
    if (savedSnapshot) {
      setForm(cloneForm(savedSnapshot.form))
      setKoliRows(cloneRows(savedSnapshot.koliRows))
    }

    setIsEditing(false)
    setError('')
    setSuccess('')
  }

  function handleCloseView() {
    router.push('/dashboard/inbound/receiving')
  }

  function handleOpenInput() {
    router.push(`/mobile/inbound/receiving/${inboundId}`)
  }

  function handleChange(event) {
    const { name, value } = event.target
    const nextValue = QUANTITY_FIELDS.has(name)
      ? sanitizeQuantityInput(value)
      : name === 'item_name'
        ? value.toUpperCase()
        : value

    setForm((prev) => ({
      ...prev,
      [name]: nextValue,
    }))

    if (name === 'total_koli') {
      const nextCount = Math.max(0, Number.parseInt(nextValue || '0', 10) || 0)
      setKoliRows((prev) => buildKoliRows(nextCount, prev))
    }
  }

  function handlePaidOnSiteChange() {
    setForm((prev) => ({
      ...prev,
      payment_on_site: prev.payment_on_site === 'yes' ? 'no' : 'yes',
    }))
  }

  const totalSampleQty = koliRows.reduce((sum, row) => sum + Number(row.sample_qty || 0), 0)
  const totalUnloadedQty = koliRows.reduce((sum, row) => sum + Number(row.bongkar_qty || 0), 0)
  const totalSupplierQty = koliRows.reduce((sum, row) => sum + Number(row.supplier_qty || 0), 0)
  const sjQty = Number(form.qty_surat_jalan || 0)
  const totalItemsReceived = totalUnloadedQty + totalSampleQty
  const totalVariance = totalItemsReceived - sjQty
  const supplierVariance = totalItemsReceived - totalSupplierQty
  const showSupplierVariance = koliRows.length > 0 && koliRows.every((row) => String(row.unload_pic || '').trim())
  const supplierQtyDiffersFromSj = showSupplierVariance && totalSupplierQty !== sjQty
  const totalVarianceStyle = getVarianceStyle(totalVariance)
  const supplierVarianceStyle = getVarianceStyle(supplierVariance)
  const contentGridStyle = isCompactLayout
    ? { ...styles.contentGrid, gridTemplateColumns: '1fr' }
    : styles.contentGrid
  const summaryGridStyle = isCompactLayout ? styles.summaryGridCompact : styles.summaryGrid
  const summaryItems = [
    {
      label: 'Total Sample Qty',
      value: totalSampleQty,
      title: 'Jumlah sample yang dicatat dari proses inbound.',
      valueStyle: { color: '#1d4ed8' },
      cardStyle: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
    },
    {
      label: 'Total Unloaded Qty',
      value: totalUnloadedQty,
      title: 'Qty yang telah dibongkar, tidak termasuk sample.',
      valueStyle: { color: '#4338ca' },
      cardStyle: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
    },
    {
      label: 'Total Items Received',
      value: totalItemsReceived,
      title: 'Total barang diterima, termasuk qty bongkar dan sample.',
      valueStyle: { color: '#166534' },
      cardStyle: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
    },
    {
      label: `Total Variance${supplierQtyDiffersFromSj ? ' *' : ''}`,
      value: formatSignedNumber(totalVariance),
      secondaryValue: showSupplierVariance ? formatSignedNumber(supplierVariance) : undefined,
      title: showSupplierVariance
        ? 'Nilai pertama: total barang diterima dibanding SJ Qty. Nilai kedua: total barang diterima dibanding total Supplier Qty. Tanda * berarti total Supplier Qty berbeda dari SJ Qty.'
        : 'Selisih antara total barang diterima dan SJ Qty. Nilai pembanding Supplier Qty ditampilkan setelah semua koli memiliki Unload PIC.',
      valueStyle: { color: totalVarianceStyle.color },
      secondaryValueStyle: { color: supplierVarianceStyle.color },
      cardStyle: {
        ...totalVarianceStyle,
        ...(supplierQtyDiffersFromSj ? styles.summaryCardDimmed : {}),
      },
    },
  ]
  const canEditReceiving = isAdminUser || userRole === 'admin' || userRole === 'inbound_coordinator'
  const inputStyle = isEditing ? styles.input : { ...styles.input, ...styles.disabledControl }
  const selectStyle = isEditing ? styles.select : { ...styles.select, ...styles.disabledControl }
  const textareaStyle = isEditing ? styles.textarea : { ...styles.textarea, ...styles.disabledTextarea }
  const itemTextareaStyle = isEditing
    ? { ...styles.textarea, ...styles.itemTextarea }
    : { ...styles.textarea, ...styles.itemTextarea, ...styles.disabledTextarea }
  const hasUnsavedChanges = receivingSnapshotChanged(form, koliRows, savedSnapshot)

  async function handleSubmit(event) {
    event.preventDefault()

    if (loading) {
      return
    }

    if (!isEditing) {
      return
    }

    if (!hasUnsavedChanges) {
      setSuccess('No changes to save.')
      return
    }

    if (!form.grn_number) {
      setError('GRN number is not ready yet.')
      return
    }

    if (
      isBlank(form.inbound_date) ||
      isBlank(form.item_name) ||
      isBlank(form.qty_surat_jalan) ||
      isBlank(form.payment_on_site) ||
      isBlank(form.total_koli)
    ) {
      setError('Inbound Date, Item Name, SJ Qty, Paid on Site, and Koli Qty are required.')
      return
    }

    const totalKoli = Number(form.total_koli || 0)

    if (!Number.isFinite(totalKoli) || totalKoli < 1) {
      setError('Koli Qty must be at least 1.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    const activeRows = buildKoliRows(totalKoli, koliRows)
    const totalReceivedQty = activeRows.reduce(
      (sum, row) => sum + Number(row.bongkar_qty || 0) + Number(row.sample_qty || 0),
      0
    )
    const nextStatus = 'inbound'

    const { error: updateError } = await supabase
      .from('inbound')
      .update({
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        inbound_date: form.inbound_date,
        item_name: form.item_name.trim().toUpperCase(),
        payment_on_site: form.payment_on_site === 'yes',
        total_claimed_qty: Number(form.qty_surat_jalan || 0),
        total_received_qty: totalReceivedQty,
        total_koli: totalKoli,
        status: nextStatus,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inboundId)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    const keptIds = activeRows.map((row) => row.id).filter(Boolean)
    const removedIds = loadedDetailIds.filter((id) => !keptIds.includes(id))

    if (removedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('inbound_receiving')
        .delete()
        .in('id', removedIds)

      if (deleteError) {
        setError(`Failed to remove deleted koli rows. Please check DELETE policy for inbound_receiving. ${deleteError.message}`)
        setLoading(false)
        return
      }
    }

    const rowsToUpdate = activeRows.filter((row) => row.id)
    for (const row of rowsToUpdate) {
      const { error: rowUpdateError } = await supabase
        .from('inbound_receiving')
        .update({
          claimed_qty: Number(row.supplier_qty || 0),
          actual_qty: Number(row.bongkar_qty || 0),
          supplier_colli_no: row.supplier_colli_no.trim() || null,
          sample_qty: Number(row.sample_qty || 0),
          unload_pic: row.unload_pic.trim() || null,
          koli_sequence: row.row_no,
        })
        .eq('id', row.id)

      if (rowUpdateError) {
        setError(rowUpdateError.message)
        setLoading(false)
        return
      }
    }

    const rowsToInsert = activeRows.filter((row) => !row.id)
    if (rowsToInsert.length > 0) {
      const payload = rowsToInsert.map((row) => ({
        inbound_id: Number(inboundId),
        claimed_qty: Number(row.supplier_qty || 0),
        actual_qty: Number(row.bongkar_qty || 0),
        supplier_colli_no: row.supplier_colli_no.trim() || null,
        sample_qty: Number(row.sample_qty || 0),
        unload_pic: row.unload_pic.trim() || null,
        koli_sequence: row.row_no,
      }))

      const { error: insertError } = await supabase.from('inbound_receiving').insert(payload)

      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }
    }

    const { data: savedDetailRows, error: savedDetailError } = await supabase
      .from('inbound_receiving')
      .select('*')
      .eq('inbound_id', inboundId)
      .order('koli_sequence', { ascending: true })

    if (savedDetailError) {
      setError(savedDetailError.message)
      setLoading(false)
      return
    }

    const savedMappedRows = (savedDetailRows || []).map((row, index) => ({
      id: row.id,
      row_no: row.koli_sequence || index + 1,
      supplier_colli_no: row.supplier_colli_no || '',
      supplier_qty: row.claimed_qty ?? '',
      sample_qty: row.sample_qty ?? '',
      bongkar_qty: row.actual_qty ?? '',
      unload_pic: row.unload_pic || '',
    }))
    const savedRows = buildKoliRows(totalKoli, savedMappedRows)
    const savedForm = {
      grn_number: form.grn_number,
      inbound_date: form.inbound_date,
      supplier_id: form.supplier_id,
      item_name: form.item_name.trim().toUpperCase(),
      payment_on_site: form.payment_on_site,
      qty_surat_jalan: form.qty_surat_jalan,
      total_koli: String(totalKoli),
      notes: form.notes.trim() || '',
    }

    setForm(savedForm)
    setKoliRows(savedRows)
    setLoadedDetailIds((savedDetailRows || []).map((row) => row.id))
    setSavedSnapshot({
      form: cloneForm(savedForm),
      koliRows: cloneRows(savedRows),
    })
    setIsEditing(false)
    setSuccess('Receiving updated successfully.')
    setLoading(false)
    router.refresh()
  }

  if (loadingPage) {
    return <p style={styles.subtitle}>Loading receiving data...</p>
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ ...styles.panel, ...(loading ? styles.panelSaving : {}) }} aria-busy={loading}>
        <div style={styles.formTopBar}>
          <div>
            <p style={styles.eyebrow}>Inbound</p>
            <h1 style={styles.title}>Receiving</h1>
          </div>

          <div style={styles.actions}>
            {isEditing ? (
              <>
                <button type="button" onClick={handleCancelEdit} disabled={loading} style={styles.secondaryButton}>Cancel</button>
                <button
                  type="submit"
                  disabled={loading || loadingPage || !hasUnsavedChanges}
                  style={{
                    ...styles.primaryButton,
                    ...((loading || loadingPage || !hasUnsavedChanges) ? styles.primaryButtonDisabled : {}),
                  }}
                  title={hasUnsavedChanges ? 'Save receiving' : 'No changes to save'}
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleOpenInput}
                  style={{ ...styles.iconActionButton, ...styles.inputIconButton }}
                  aria-label="Open input form"
                  title="Input form"
                >
                  <InputIcon />
                </button>
                {canEditReceiving ? (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  style={{ ...styles.iconActionButton, ...styles.editIconButton }}
                  aria-label="Edit receiving"
                  title="Edit receiving"
                >
                  <PencilIcon />
                </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleCloseView}
                  style={{ ...styles.iconActionButton, ...styles.closeIconButton }}
                  aria-label="Close receiving"
                  title="Close"
                >
                  <span style={styles.closeIconGlyph}>X</span>
                </button>
              </>
            )}
          </div>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}
        {success ? <p style={styles.success}>{success}</p> : null}
        {loading ? <p style={styles.savingText}>Saving receiving data. Please wait until the process is complete.</p> : null}

        <fieldset disabled={loading || !isEditing} style={styles.formLock}>
        <div style={contentGridStyle}>
          <section style={styles.headerColumn}>
            <div style={styles.grnCard}>
              <span style={styles.grnLabel}>GRN Number</span>
              <strong style={styles.grnValue}>{form.grn_number}</strong>
            </div>

            <div style={styles.headerGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Inbound Date</label>
                <input type="date" name="inbound_date" value={form.inbound_date} onChange={handleChange} style={inputStyle} required />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Supplier</label>
                <select name="supplier_id" value={form.supplier_id} onChange={handleChange} style={selectStyle}>
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>
                  ))}
                </select>
              </div>

              <div style={{ ...styles.field, ...styles.fieldFull }}>
                <label style={styles.label}>Item Name</label>
                <textarea name="item_name" value={form.item_name} onChange={handleChange} style={itemTextareaStyle} placeholder="ITEM NAME" required />
              </div>

              <div style={styles.threeFieldGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>SJ Qty</label>
                  <input
                    type="text"
                    name="qty_surat_jalan"
                    value={form.qty_surat_jalan}
                    onChange={handleChange}
                    onWheel={preventNumberWheel}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    style={inputStyle}
                    required
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Koli Qty</label>
                  <input
                    type="text"
                    name="total_koli"
                    value={form.total_koli}
                    onChange={handleChange}
                    onWheel={preventNumberWheel}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    style={inputStyle}
                    required
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Paid on Site</label>
                  <div style={styles.switchRow}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.payment_on_site === 'yes'}
                      onClick={handlePaidOnSiteChange}
                      style={{
                        ...styles.switchButton,
                        ...(form.payment_on_site === 'yes' ? styles.switchButtonOn : styles.switchButtonOff),
                        ...(!isEditing ? styles.switchButtonDisabled : {}),
                      }}
                    >
                      <span
                        style={{
                          ...styles.switchKnob,
                          ...(form.payment_on_site === 'yes' ? styles.switchKnobOn : {}),
                        }}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ ...styles.field, ...styles.fieldWide }}>
                <label style={styles.label}>Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} style={textareaStyle} placeholder="Optional notes" />
              </div>
            </div>
          </section>

          <section style={styles.breakdownColumn}>
            <div style={summaryGridStyle}>
              {summaryItems.map((item) => (
                <div key={item.label} style={{ ...styles.summaryCard, ...(item.cardStyle || {}) }} title={item.title}>
                  <span style={styles.summaryLabel}>{item.label}</span>
                  {item.secondaryValue !== undefined ? (
                    <strong style={styles.summaryPairValue}>
                      <span style={item.valueStyle}>{item.value}</span>
                      <span style={styles.summaryPairDivider}>|</span>
                      <span style={item.secondaryValueStyle}>{item.secondaryValue}</span>
                    </strong>
                  ) : (
                    <strong style={{ ...styles.summaryValue, ...(item.valueStyle || {}) }}>{item.value}</strong>
                  )}
                </div>
              ))}
            </div>

            {koliRows.length === 0 ? (
              <div style={styles.helperBox}>No inbound breakdown rows yet.</div>
            ) : (
              <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>No</th>
                  <th style={styles.th}>Supplier Koli No</th>
                  <th style={styles.th}>Supplier Qty</th>
                  <th style={styles.th}>Sample Qty</th>
                  <th style={styles.th}>Unloaded Qty</th>
                  <th style={styles.th}>Variance</th>
                  <th style={styles.th}>Unload PIC</th>
                </tr>
              </thead>
              <tbody>
                {koliRows.map((row) => {
                  const difference = getDifference(row)
                  const diffStyle = getVarianceStyle(difference)

                  return (
                    <tr key={row.id || row.row_no}>
                      <td style={styles.td}>{row.row_no}</td>
                      <td style={styles.td}>
                        <span style={styles.displayCell}>{row.supplier_colli_no || '-'}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.displayCell}>{row.supplier_qty || 0}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.displayCell}>{row.sample_qty || 0}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.displayCell}>{row.bongkar_qty || 0}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.diffBadge, ...diffStyle }}>
                          {difference > 0 ? `+${difference}` : difference}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.displayCell}>{getFirstName(row.unload_pic)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
              </div>
            )}
          </section>
        </div>
        </fieldset>
      </form>
    </div>
  )
}
