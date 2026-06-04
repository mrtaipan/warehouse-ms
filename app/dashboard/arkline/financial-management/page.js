'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

import useArklineAccess from '../use-arkline-access'
import shellStyles from '../arkline.module.css'
import styles from './financial-management.module.css'

const supabase = createClient()
const PAYMENT_REQUEST_BUCKET = 'arkline-payments'
function createDraft() {
  return {
    payment_basis: 'NON_PO_BASED',
    po_source_type: 'GARMENT',
    linked_po_id: '',
    invoice_number: '',
    category_id: '',
    amount: '',
    notes: '',
    account_name: '',
    bank_name: '',
    account_number: '',
    attachments: [],
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function sanitizeFileName(value) {
  return String(value || 'file')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
}

function normalizeUppercase(value) {
  return String(value || '').toUpperCase()
}

function normalizeLettersUppercase(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trimStart()
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function formatNumberInput(value) {
  const digits = normalizeDigits(value)
  if (!digits) return ''
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(digits))
}

function normalizeRequest(row) {
  return {
    id: row?.id || '',
    payment_basis: row?.payment_basis || 'NON_PO_BASED',
    po_source_type: row?.po_source_type || 'GARMENT',
    po_db_id: row?.po_db_id || null,
    po_number: row?.po_number || '',
    supplier_name_snapshot: row?.supplier_name_snapshot || '',
    invoice_number: row?.invoice_number || '',
    category_id: row?.category_id ? String(row.category_id) : '',
    category_name: row?.category?.name || '',
    amount: Number(row?.amount || 0),
    notes: row?.notes || '',
    account_name: row?.account_name || '',
    bank_name: row?.bank_name || '',
    account_number: row?.account_number || '',
    status: row?.status || 'SUBMITTED',
    created_by: row?.created_by || '',
    created_by_display_name: row?.created_by_display_name || '',
    paid_by: row?.paid_by || '',
    paid_by_display_name: row?.paid_by_display_name || '',
    paid_at: row?.paid_at || '',
    created_at: row?.created_at || '',
    updated_at: row?.updated_at || '',
    attachments: Array.isArray(row?.attachments) ? row.attachments : [],
  }
}

function getAttachmentKind(attachment) {
  return String(attachment?.storage_path || '').includes('/payment-proof/') ? 'PAYMENT_PROOF' : 'SUBMISSION_ATTACHMENT'
}

function getAttachmentsByKind(request, kind) {
  return (request?.attachments || []).filter((attachment) => getAttachmentKind(attachment) === kind)
}

function fallbackDisplayName(value) {
  const text = String(value || '').trim()
  if (!text) return '-'
  if (!text.includes('@')) return text
  return text.split('@')[0]
}

function buildRequestFolder(request) {
  const invoiceFolder = sanitizeFileName(request?.invoice_number || '').replace(/\.+/g, '-')
  return invoiceFolder ? `${request.id}-${invoiceFolder}` : String(request?.id || 'request')
}

function isImageAttachment(attachment) {
  return String(attachment?.mime_type || '').toLowerCase().startsWith('image/')
}

async function uploadRequestFiles({ request, files, uploadedBy, folder = 'submission' }) {
  const uploadedPaths = []
  const attachmentRows = []
  const year = new Date().getFullYear()
  const requestFolder = buildRequestFolder(request)

  for (const file of files) {
    const extension = String(file?.name || '').split('.').pop()?.toLowerCase() || 'bin'
    const safeName = sanitizeFileName(file?.name || `attachment.${extension}`)
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`
    const storagePath = `${year}/${requestFolder}/${folder}/${fileName}`

    const { error: uploadError } = await supabase.storage.from(PAYMENT_REQUEST_BUCKET).upload(storagePath, file, { upsert: false })
    if (uploadError) throw new Error(uploadError.message)

    uploadedPaths.push(storagePath)
    attachmentRows.push({
      payment_id: request.id,
      storage_bucket: PAYMENT_REQUEST_BUCKET,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size || null,
      uploaded_by: uploadedBy || null,
    })
  }

  return { uploadedPaths, attachmentRows }
}

export default function ArklineFinancialManagementPage() {
  const { loading: accessLoading, access } = useArklineAccess()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [requests, setRequests] = useState([])
  const [poOptions, setPoOptions] = useState([])
  const [materialPoOptions, setMaterialPoOptions] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [draft, setDraft] = useState(createDraft())
  const [editingRequest, setEditingRequest] = useState(null)
  const [existingDraftAttachments, setExistingDraftAttachments] = useState([])
  const [removedDraftAttachmentIds, setRemovedDraftAttachmentIds] = useState([])
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [detailError, setDetailError] = useState('')
  const [paymentProofFiles, setPaymentProofFiles] = useState([])
  const attachmentInputRef = useRef(null)
  const paymentProofInputRef = useRef(null)

  const canView = access.financialManagement
  const canSubmit = access.financialManagement
  const canPay = access.financialManagement

  async function loadWorkspace() {
    setLoading(true)
    setError('')

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!user) {
      setError('You need to sign in again to open financial management.')
      setLoading(false)
      return
    }

    const { data: profileRow, error: profileError } = await getProfileByAuthenticatedUser(
      supabase,
      user,
      'id, email, display_name, role'
    )

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    const [
      { data: paymentRows, error: paymentError },
      { data: poRows, error: poError },
      { data: materialPoRows, error: materialPoError },
      { data: categoryRows, error: categoryError },
    ] = await Promise.all([
      supabase
        .from('arkline_payment')
        .select(
          `
            id,
            payment_basis,
            po_source_type,
            po_db_id,
            po_number,
            supplier_name_snapshot,
            invoice_number,
            category_id,
            amount,
            notes,
            account_name,
            bank_name,
            account_number,
            status,
            created_by,
            paid_by,
            paid_at,
            created_at,
            updated_at,
            category:dir_reimbursement_categories(id, name),
            attachments:arkline_payment_attachments(
              id,
              storage_bucket,
              storage_path,
              file_name,
              mime_type,
              file_size,
              uploaded_by,
              created_at
            )
          `
        )
        .order('created_at', { ascending: true }),
      supabase.from('arkline_pos').select('id, po_id, supplier_name, created_at').order('created_at', { ascending: false }),
      supabase
        .from('arkline_po_material_ordered')
        .select('id, material_po_number, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('dir_reimbursement_categories').select('id, name, is_active').eq('is_active', true).order('name', { ascending: true }),
    ])

    if (paymentError || poError || materialPoError || categoryError) {
      setError(paymentError?.message || poError?.message || materialPoError?.message || categoryError?.message || 'Failed to load payment request workspace.')
      setLoading(false)
      return
    }

    let displayNameMap = new Map()
    const { data: profileRows } = await supabase.from('dir_user_profiles').select('email, display_name')

    displayNameMap = new Map(
      (profileRows || [])
        .filter((item) => String(item.email || '').trim())
        .map((item) => [String(item.email || '').trim().toLowerCase(), String(item.display_name || '').trim()])
    )

    setProfile({
      id: profileRow?.id || '',
      email: user.email?.toLowerCase() || '',
      display_name:
        profileRow?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '',
    })
    setRequests(
      (paymentRows || []).map((item) => {
        const normalized = normalizeRequest(item)
        return {
          ...normalized,
          created_by_display_name:
            displayNameMap.get(String(normalized.created_by || '').trim().toLowerCase()) ||
            (String(normalized.created_by || '').trim().toLowerCase() === String(user.email || '').trim().toLowerCase()
              ? String(profileRow?.display_name || '').trim()
              : '') ||
            fallbackDisplayName(normalized.created_by),
          paid_by_display_name:
            displayNameMap.get(String(normalized.paid_by || '').trim().toLowerCase()) ||
            (String(normalized.paid_by || '').trim().toLowerCase() === String(user.email || '').trim().toLowerCase()
              ? String(profileRow?.display_name || '').trim()
              : '') ||
            fallbackDisplayName(normalized.paid_by),
        }
      })
    )
    setPoOptions(
      (poRows || []).map((item) => ({
        id: String(item.id),
        poNumber: String(item.po_id || '').trim().toUpperCase(),
        supplierName: String(item.supplier_name || '').trim().toUpperCase(),
      }))
    )
    setMaterialPoOptions(
      (materialPoRows || []).map((item) => ({
        id: String(item.id),
        poNumber: String(item.material_po_number || '').trim().toUpperCase(),
      }))
    )
    setCategories((categoryRows || []).map((item) => ({ id: String(item.id), name: item.name })))
    setLoading(false)
  }

  useEffect(() => {
    void loadWorkspace()
  }, [])

  const filteredRequests = useMemo(() => {
    const keyword = search.trim().toUpperCase()
    return requests.filter((item) => {
      const matchesKeyword =
        !keyword ||
        [
          item.invoice_number,
          item.po_number,
          item.supplier_name_snapshot,
          item.category_name,
          item.account_name,
          item.bank_name,
          item.account_number,
          item.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toUpperCase()
          .includes(keyword)

      const matchesStatus = statusFilter === 'ALL' ? true : item.status === statusFilter
      return matchesKeyword && matchesStatus
    })
  }, [requests, search, statusFilter])

  const summary = useMemo(
    () => ({
      outstanding: requests
        .filter((item) => item.status === 'SUBMITTED')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    }),
    [requests]
  )

  function closeCreateModal() {
    if (saving) return
    setShowCreateModal(false)
    setDraft(createDraft())
    setEditingRequest(null)
    setExistingDraftAttachments([])
    setRemovedDraftAttachmentIds([])
  }

  function openRequestDetail(item) {
    setSelectedRequest(item)
    setDetailError('')
    setPaymentProofFiles([])
  }

  function closeRequestDetail() {
    if (actionLoading) return
    setSelectedRequest(null)
    setDetailError('')
    setPaymentProofFiles([])
  }

  function openEditRequest(item) {
    setEditingRequest(item)
    setDraft({
      payment_basis: item.payment_basis || 'NON_PO_BASED',
      po_source_type: item.po_source_type || 'GARMENT',
      linked_po_id: item.po_db_id ? String(item.po_db_id) : '',
      invoice_number: item.invoice_number || '',
      category_id: item.category_id || '',
      amount: formatNumberInput(item.amount || ''),
      notes: item.notes || '',
      account_name: item.account_name || '',
      bank_name: item.bank_name || '',
      account_number: item.account_number || '',
      attachments: [],
    })
    setExistingDraftAttachments(getAttachmentsByKind(item, 'SUBMISSION_ATTACHMENT'))
    setRemovedDraftAttachmentIds([])
    setShowCreateModal(true)
    setSelectedRequest(null)
    setDetailError('')
  }

  function appendDraftFiles(files) {
    setDraft((prev) => ({ ...prev, attachments: [...prev.attachments, ...files] }))
  }

  function removeDraftFile(targetIndex) {
    setDraft((prev) => ({ ...prev, attachments: prev.attachments.filter((_, index) => index !== targetIndex) }))
  }

  function removeExistingDraftAttachment(attachmentId) {
    setExistingDraftAttachments((prev) => prev.filter((item) => item.id !== attachmentId))
    setRemovedDraftAttachmentIds((prev) => [...prev, attachmentId])
  }

  function appendPaymentProofFiles(files) {
    setPaymentProofFiles((prev) => [...prev, ...files])
  }

  function removePaymentProofFile(targetIndex) {
    setPaymentProofFiles((prev) => prev.filter((_, index) => index !== targetIndex))
  }

  async function handleCreateRequest() {
    setError('')
    setSuccess('')

    if (!profile?.email) {
      setError('Your profile is not ready yet. Please refresh and try again.')
      return
    }

    if (draft.payment_basis === 'PO_BASED' && !draft.linked_po_id) {
      setError(`Choose a ${draft.po_source_type === 'MATERIAL' ? 'material' : 'garment'} PO first for PO based payment.`)
      return
    }

    if (!String(draft.invoice_number || '').trim() || !String(draft.amount || '').trim() || !String(draft.category_id || '').trim()) {
      setError('Invoice number, category, and payment amount are required.')
      return
    }

    if (Number(normalizeDigits(draft.amount)) <= 0) {
      setError('Payment amount must be above zero.')
      return
    }

    if (!String(draft.account_name || '').trim() || !String(draft.bank_name || '').trim() || !String(draft.account_number || '').trim()) {
      setError('Account name, bank name, and account number are required.')
      return
    }

    const selectedPo =
      draft.payment_basis === 'PO_BASED'
        ? draft.po_source_type === 'MATERIAL'
          ? materialPoOptions.find((item) => item.id === draft.linked_po_id)
          : poOptions.find((item) => item.id === draft.linked_po_id)
        : null

    setSaving(true)
    const uploadedPaths = []

    try {
        const payload = {
        payment_basis: draft.payment_basis,
        po_source_type: draft.payment_basis === 'PO_BASED' ? draft.po_source_type : null,
        po_db_id: draft.payment_basis === 'PO_BASED' && draft.linked_po_id ? Number(draft.linked_po_id) : null,
        po_number: draft.payment_basis === 'PO_BASED' ? selectedPo?.poNumber || null : null,
        supplier_name_snapshot:
          draft.payment_basis === 'PO_BASED'
            ? draft.po_source_type === 'MATERIAL'
              ? selectedPo?.poNumber || null
              : selectedPo?.supplierName || null
            : null,
        invoice_number: normalizeUppercase(draft.invoice_number).trim(),
        category_id: Number(draft.category_id),
        amount: Number(normalizeDigits(draft.amount)),
        notes: String(draft.notes || '').trim() || null,
        account_name: normalizeUppercase(draft.account_name).trim(),
        bank_name: normalizeUppercase(draft.bank_name).trim(),
        account_number: normalizeDigits(draft.account_number).trim(),
        status: 'SUBMITTED',
        created_by: profile.email,
      }

      let targetRequest = editingRequest

      if (editingRequest) {
        const { error: updateError } = await supabase.from('arkline_payment').update(payload).eq('id', editingRequest.id)
        if (updateError) throw new Error(updateError.message)

        if (removedDraftAttachmentIds.length) {
          const attachmentsToDelete = (editingRequest.attachments || []).filter((item) => removedDraftAttachmentIds.includes(item.id))
          const storagePathsToDelete = attachmentsToDelete.map((item) => item.storage_path).filter(Boolean)

          if (storagePathsToDelete.length) {
            const { error: storageDeleteError } = await supabase.storage.from(PAYMENT_REQUEST_BUCKET).remove(storagePathsToDelete)
            if (storageDeleteError) throw new Error(storageDeleteError.message)
          }

          const { error: attachmentDeleteError } = await supabase.from('arkline_payment_attachments').delete().in('id', removedDraftAttachmentIds)
          if (attachmentDeleteError) throw new Error(attachmentDeleteError.message)
        }
      } else {
        const { data: insertedRequest, error: insertError } = await supabase
          .from('arkline_payment')
          .insert(payload)
          .select(
            `
              id,
              payment_basis,
              po_source_type,
              po_db_id,
              po_number,
              supplier_name_snapshot,
              invoice_number,
              category_id,
              amount,
              notes,
              account_name,
              bank_name,
              account_number,
              status,
              created_by,
              paid_by,
              paid_at,
              created_at,
              updated_at,
              category:dir_reimbursement_categories(id, name),
              attachments:arkline_payment_attachments(
                id,
                storage_bucket,
                storage_path,
                file_name,
                mime_type,
                file_size,
                uploaded_by,
                created_at
              )
            `
          )
          .single()

        if (insertError) throw new Error(insertError.message)
        targetRequest = insertedRequest
      }

      if (draft.attachments.length && targetRequest) {
        const uploadResult = await uploadRequestFiles({
          request: targetRequest,
          files: draft.attachments,
          uploadedBy: profile.email,
          folder: 'submission',
        })

        uploadedPaths.push(...uploadResult.uploadedPaths)

        const { error: attachmentInsertError } = await supabase.from('arkline_payment_attachments').insert(uploadResult.attachmentRows)
        if (attachmentInsertError) throw new Error(attachmentInsertError.message)
      }

      setSuccess(
        editingRequest
          ? `Payment request ${payload.invoice_number} updated.`
          : `Payment request ${payload.invoice_number} submitted.`
      )
      setShowCreateModal(false)
      setDraft(createDraft())
      setEditingRequest(null)
      setExistingDraftAttachments([])
      setRemovedDraftAttachmentIds([])
      await loadWorkspace()
    } catch (saveError) {
      if (uploadedPaths.length) {
        await supabase.storage.from(PAYMENT_REQUEST_BUCKET).remove(uploadedPaths)
      }
      setError(saveError.message || 'Failed to submit payment request.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRequest(request) {
    if (!request || request.status !== 'SUBMITTED') return

    setActionLoading(true)
    setDetailError('')
    setSuccess('')

    const storagePaths = (request.attachments || []).map((item) => item.storage_path).filter(Boolean)

    try {
      if (storagePaths.length) {
        const { error: storageError } = await supabase.storage.from(PAYMENT_REQUEST_BUCKET).remove(storagePaths)
        if (storageError) throw new Error(storageError.message)
      }

      const { error: deleteError } = await supabase.from('arkline_payment').delete().eq('id', request.id)
      if (deleteError) throw new Error(deleteError.message)

      setSuccess(`Payment request ${request.invoice_number} deleted.`)
      closeRequestDetail()
      await loadWorkspace()
    } catch (deleteError) {
      setDetailError(deleteError.message || 'Failed to delete payment request.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleMarkPaid(request) {
    setActionLoading(true)
    setDetailError('')
    setSuccess('')

    const uploadedPaths = []

    try {
      if (paymentProofFiles.length) {
        const uploadResult = await uploadRequestFiles({
          request,
          files: paymentProofFiles,
          uploadedBy: profile?.email || null,
          folder: 'payment-proof',
        })

        uploadedPaths.push(...uploadResult.uploadedPaths)

        const { error: attachmentInsertError } = await supabase.from('arkline_payment_attachments').insert(uploadResult.attachmentRows)
        if (attachmentInsertError) throw new Error(attachmentInsertError.message)
      }

      const { error: updateError } = await supabase
        .from('arkline_payment')
        .update({
          status: 'PAID',
          paid_at: new Date().toISOString(),
          paid_by: profile?.email || null,
        })
        .eq('id', request.id)

      if (updateError) throw new Error(updateError.message)

      setSuccess(`Payment request ${request.invoice_number} marked as paid.`)
      closeRequestDetail()
      await loadWorkspace()
    } catch (paymentError) {
      if (uploadedPaths.length) {
        await supabase.storage.from(PAYMENT_REQUEST_BUCKET).remove(uploadedPaths)
        await supabase.from('arkline_payment_attachments').delete().in('storage_path', uploadedPaths)
      }
      setDetailError(paymentError.message || 'Failed to mark payment request as paid.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleOpenAttachment(attachment) {
    setDetailError('')

    const { data, error: signedUrlError } = await supabase.storage
      .from(attachment.storage_bucket)
      .createSignedUrl(attachment.storage_path, 300)

    if (signedUrlError) {
      setDetailError(signedUrlError.message)
      return
    }

    if (data?.signedUrl) {
      if (isImageAttachment(attachment)) {
        setImagePreview({ src: data.signedUrl, name: attachment.file_name })
        return
      }

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>Arkline</p>
            <h1 className={styles.title}>Payment Submission</h1>
          </div>

          <div className={styles.headerActionsInline}>
            <div className={styles.searchField}>
              <input
                className={styles.input}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Invoice, PO, payee, bank, or note"
              />
            </div>
            <div className={styles.filterField}>
              <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="ALL">All Status</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
            {canSubmit ? (
              <button type="button" className={styles.compactPrimaryButton} onClick={() => setShowCreateModal(true)}>
                + New Request
              </button>
            ) : null}
          </div>
        </div>

        {error ? <p className={shellStyles.errorText}>{error}</p> : null}
        {success ? <p className={shellStyles.successText}>{success}</p> : null}

        {loading || accessLoading ? (
          <div className={styles.emptyState}>Loading financial management...</div>
        ) : !canView ? (
          <div className={styles.emptyState}>Your account does not have Arkline financial management access yet.</div>
        ) : (
          <section className={styles.listSection}>
            <div className={styles.columnHead}>
              <div className={styles.outstandingWrap}>
                <span className={styles.outstandingLabel}>Total Outstanding</span>
                <strong className={styles.outstandingValue}>{formatCurrency(summary.outstanding)}</strong>
              </div>
            </div>

            {!filteredRequests.length ? (
              <div className={styles.emptyColumn}>No payment requests match this filter yet.</div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>No Invoice</th>
                      <th>Submission Date</th>
                      <th>Submitted By</th>
                      <th>Category</th>
                      <th>Outstanding</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((item) => (
                      <tr key={item.id}>
                        <td>{item.invoice_number || '-'}</td>
                        <td>{formatDateTime(item.created_at)}</td>
                        <td>{item.created_by_display_name || '-'}</td>
                        <td>{item.category_name || '-'}</td>
                        <td className={styles.amountCell}>{formatCurrency(item.amount)}</td>
                        <td>
                          <span
                            className={`${styles.statusPill} ${item.status === 'PAID' ? styles.statusPillPaid : styles.statusPillSubmitted}`.trim()}
                          >
                            {item.status === 'PAID' ? 'Paid' : 'Submitted'}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actionCell}>
                            <button type="button" className={styles.iconButton} onClick={() => openRequestDetail(item)} title="View detail">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                            {item.status === 'SUBMITTED' ? (
                              <>
                                <button type="button" className={styles.iconButton} onClick={() => openEditRequest(item)} title="Edit">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                  </svg>
                                </button>
                                <button type="button" className={`${styles.iconButton} ${styles.iconButtonDanger}`.trim()} onClick={() => void handleDeleteRequest(item)} title="Delete">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4h8v2" />
                                    <path d="M19 6l-1 14H6L5 6" />
                                    <path d="M10 11v6M14 11v6" />
                                  </svg>
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </section>

      {showCreateModal ? (
        <div className={shellStyles.modalOverlay} onClick={closeCreateModal}>
          <div className={`${shellStyles.modalCard} ${styles.modalCard}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>New Request</p>
                <h2 className={styles.modalTitle}>Payment Request</h2>
              </div>
              <div className={shellStyles.buttonRow}>
                <button type="button" className={styles.primaryButton} onClick={() => void handleCreateRequest()} disabled={saving}>
                  {saving ? 'Submitting...' : 'Submit'}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={closeCreateModal} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>

            {error ? <p className={shellStyles.errorText}>{error}</p> : null}

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Payment Basis *</label>
                <select
                  className={styles.select}
                  value={draft.payment_basis}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, payment_basis: event.target.value, po_source_type: 'GARMENT', linked_po_id: '' }))
                  }
                >
                  <option value="NON_PO_BASED">Non-PO Based</option>
                  <option value="PO_BASED">PO Based</option>
                </select>
              </div>

              {draft.payment_basis === 'PO_BASED' ? (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>PO Type *</label>
                    <select
                      className={styles.select}
                      value={draft.po_source_type}
                      onChange={(event) => setDraft((prev) => ({ ...prev, po_source_type: event.target.value, linked_po_id: '' }))}
                    >
                      <option value="GARMENT">Garment</option>
                      <option value="MATERIAL">Material</option>
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>{draft.po_source_type === 'MATERIAL' ? 'Material PO *' : 'Garment PO *'}</label>
                    <select
                      className={styles.select}
                      value={draft.linked_po_id}
                      onChange={(event) => setDraft((prev) => ({ ...prev, linked_po_id: event.target.value }))}
                    >
                      <option value="">{draft.po_source_type === 'MATERIAL' ? 'Choose material PO' : 'Choose garment PO'}</option>
                      {(draft.po_source_type === 'MATERIAL' ? materialPoOptions : poOptions).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.poNumber}
                          {item.supplierName ? ` - ${item.supplierName}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : null}

              <div className={`${styles.formRowThree} ${styles.fullSpan}`.trim()}>
                <div className={styles.field}>
                  <label className={styles.label}>Invoice Number *</label>
                  <input
                    className={styles.input}
                    value={draft.invoice_number}
                    onChange={(event) => setDraft((prev) => ({ ...prev, invoice_number: normalizeUppercase(event.target.value) }))}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Category *</label>
                  <select
                    className={styles.select}
                    value={draft.category_id}
                    onChange={(event) => setDraft((prev) => ({ ...prev, category_id: event.target.value }))}
                  >
                    <option value="">Choose category</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Amount to Pay *</label>
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    value={draft.amount}
                    onChange={(event) => setDraft((prev) => ({ ...prev, amount: formatNumberInput(event.target.value) }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className={`${styles.formRowThree} ${styles.fullSpan}`.trim()}>
                <div className={styles.field}>
                  <label className={styles.label}>Bank Name *</label>
                  <input
                    className={styles.input}
                    value={draft.bank_name}
                    onChange={(event) => setDraft((prev) => ({ ...prev, bank_name: normalizeLettersUppercase(event.target.value) }))}
                    placeholder="Bank"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Account Name *</label>
                  <input
                    className={styles.input}
                    value={draft.account_name}
                    onChange={(event) => setDraft((prev) => ({ ...prev, account_name: normalizeLettersUppercase(event.target.value) }))}
                    placeholder="Account name"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Account Number *</label>
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    value={draft.account_number}
                    onChange={(event) => setDraft((prev) => ({ ...prev, account_number: normalizeDigits(event.target.value) }))}
                    placeholder="Account number"
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Attachment</label>
                <input
                  ref={attachmentInputRef}
                  className={styles.hiddenInput}
                  type="file"
                  multiple
                  onChange={(event) => {
                    appendDraftFiles(Array.from(event.target.files || []))
                    event.target.value = ''
                  }}
                />
                <button type="button" className={styles.attachmentButton} onClick={() => attachmentInputRef.current?.click()}>
                  <span className={styles.attachmentPlus}>+</span>
                  <span>Add Attachment</span>
                </button>
                {existingDraftAttachments.length ? (
                  <div className={styles.fileList}>
                    {existingDraftAttachments.map((attachment) => (
                      <span key={attachment.id} className={styles.fileChip}>
                        <button
                          type="button"
                          className={styles.fileChipLink}
                          onClick={() => void handleOpenAttachment(attachment)}
                          title={attachment.file_name}
                        >
                          {attachment.file_name}
                        </button>
                        <button type="button" className={styles.fileChipRemove} onClick={() => removeExistingDraftAttachment(attachment.id)}>
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {draft.attachments.length ? (
                  <div className={styles.fileList}>
                    {draft.attachments.map((file, index) => (
                      <span key={`${file.name}-${file.size}-${index}`} className={styles.fileChip}>
                        {file.name}
                        <button type="button" className={styles.fileChipRemove} onClick={() => removeDraftFile(index)}>
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className={`${styles.field} ${styles.fullSpan}`.trim()}>
                <label className={styles.label}>Notes</label>
                <textarea
                  className={styles.textarea}
                  value={draft.notes}
                  onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Add finance context, due date, or supporting notes"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedRequest ? (
        <div className={shellStyles.modalOverlay} onClick={closeRequestDetail}>
          <div className={`${shellStyles.modalCard} ${styles.detailModal}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Payment Request Detail</p>
                <h2 className={styles.modalTitle}>{selectedRequest.invoice_number}</h2>
                <p className={styles.subtitle}>
                  {selectedRequest.payment_basis === 'PO_BASED' ? selectedRequest.po_number || 'PO Based' : 'NON-PO BASED'} • {selectedRequest.supplier_name_snapshot || selectedRequest.account_name}
                </p>
              </div>
              <span className={`${styles.statusBadge} ${selectedRequest.status === 'PAID' ? styles.statusPaid : styles.statusSubmitted}`.trim()}>
                {selectedRequest.status}
              </span>
            </div>

            <div className={styles.detailGrid}>
              <div className={styles.metricCard}>
                <span>Amount</span>
                <strong>{formatCurrency(selectedRequest.amount)}</strong>
              </div>
              <div className={styles.metricCard}>
                <span>Category</span>
                <strong>{selectedRequest.category_name || '-'}</strong>
              </div>
              <div className={styles.metricCard}>
                <span>Account Name</span>
                <strong>{selectedRequest.account_name || '-'}</strong>
              </div>
              <div className={styles.metricCard}>
                <span>Bank</span>
                <strong>{selectedRequest.bank_name || '-'}</strong>
              </div>
              <div className={styles.metricCard}>
                <span>Account Number</span>
                <strong>{selectedRequest.account_number || '-'}</strong>
              </div>
              <div className={styles.metricCard}>
                <span>Submitted By</span>
                <strong>{selectedRequest.created_by_display_name || '-'}</strong>
              </div>
              <div className={styles.metricCard}>
                <span>Paid By</span>
                <strong>{selectedRequest.paid_by_display_name || '-'}</strong>
              </div>
            </div>

            <div className={styles.detailSection}>
              <h3 className={styles.sectionTitle}>Notes</h3>
              <p className={styles.detailText}>{selectedRequest.notes || 'No notes provided.'}</p>
            </div>

            <div className={styles.detailSection}>
              <h3 className={styles.sectionTitle}>Submission Attachment</h3>
              {getAttachmentsByKind(selectedRequest, 'SUBMISSION_ATTACHMENT').length ? (
                <div className={styles.attachmentList}>
                  {getAttachmentsByKind(selectedRequest, 'SUBMISSION_ATTACHMENT').map((attachment) => (
                    <div key={attachment.id} className={styles.attachmentRow}>
                      <div>
                        <p className={styles.attachmentName}>{attachment.file_name}</p>
                        <p className={styles.attachmentMeta}>{formatDateTime(attachment.created_at)}</p>
                      </div>
                      <button type="button" className={styles.secondaryButton} onClick={() => void handleOpenAttachment(attachment)}>
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyColumn}>No attachment uploaded.</div>
              )}
            </div>

            <div className={styles.detailSection}>
              <h3 className={styles.sectionTitle}>Payment Proof</h3>
              {getAttachmentsByKind(selectedRequest, 'PAYMENT_PROOF').length ? (
                <div className={styles.attachmentList}>
                  {getAttachmentsByKind(selectedRequest, 'PAYMENT_PROOF').map((attachment) => (
                    <div key={attachment.id} className={styles.attachmentRow}>
                      <div>
                        <p className={styles.attachmentName}>{attachment.file_name}</p>
                        <p className={styles.attachmentMeta}>{formatDateTime(attachment.created_at)}</p>
                      </div>
                      <button type="button" className={styles.secondaryButton} onClick={() => void handleOpenAttachment(attachment)}>
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyColumn}>No payment proof uploaded.</div>
              )}
            </div>

            {selectedRequest.status === 'SUBMITTED' && canPay ? (
              <div className={styles.detailSection}>
                <h3 className={styles.sectionTitle}>Add Payment Proof</h3>
                <input
                  ref={paymentProofInputRef}
                  className={styles.hiddenInput}
                  type="file"
                  multiple
                  onChange={(event) => {
                    appendPaymentProofFiles(Array.from(event.target.files || []))
                    event.target.value = ''
                  }}
                />
                <button type="button" className={styles.attachmentButton} onClick={() => paymentProofInputRef.current?.click()}>
                  <span className={styles.attachmentPlus}>+</span>
                  <span>Add Attachment</span>
                </button>
                {paymentProofFiles.length ? (
                  <div className={styles.fileList}>
                    {paymentProofFiles.map((file, index) => (
                      <span key={`${file.name}-${file.size}-${index}`} className={styles.fileChip}>
                        {file.name}
                        <button type="button" className={styles.fileChipRemove} onClick={() => removePaymentProofFile(index)}>
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {detailError ? <p className={shellStyles.errorText}>{detailError}</p> : null}

            <div className={shellStyles.buttonRow}>
              {selectedRequest.status === 'SUBMITTED' ? (
                <button type="button" className={styles.secondaryButton} onClick={() => openEditRequest(selectedRequest)} disabled={actionLoading}>
                  Edit
                </button>
              ) : null}
              {selectedRequest.status === 'SUBMITTED' ? (
                <button type="button" className={styles.secondaryButton} onClick={() => void handleDeleteRequest(selectedRequest)} disabled={actionLoading}>
                  Delete
                </button>
              ) : null}
              {selectedRequest.status === 'SUBMITTED' && canPay ? (
                <button type="button" className={styles.primaryButton} onClick={() => void handleMarkPaid(selectedRequest)} disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Mark as Paid'}
                </button>
              ) : null}
              <button type="button" className={styles.secondaryButton} onClick={closeRequestDetail} disabled={actionLoading}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {imagePreview ? (
        <div className={shellStyles.modalOverlay} onClick={() => setImagePreview(null)}>
          <div className={`${shellStyles.modalCard} ${styles.imageModal}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Attachment Preview</p>
                <h2 className={styles.modalTitle}>{imagePreview.name}</h2>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={() => setImagePreview(null)}>
                Close
              </button>
            </div>
            <div className={styles.imagePreviewWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview.src} alt={imagePreview.name} className={styles.imagePreview} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

