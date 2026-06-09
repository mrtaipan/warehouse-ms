'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import { ADMIN_EMAIL } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import styles from './myarklife.module.css'

const supabase = createClient()
const REIMBURSEMENT_BUCKET = 'reimbursement-claims'
const LEGACY_TABLES = {
  claims: 'arkline_reimbursement_claims',
  attachments: 'arkline_reimbursement_attachments',
}
const HRGA_TABLES = {
  claims: 'hrga_reimbursement_claims',
  attachments: 'hrga_reimbursement_attachments',
}
const DEFAULT_GROUP_OPTIONS = ['ARKLINE', 'MOB', 'OI', 'WAREHOUSE', 'HQ']

function createDraftRow(defaultGroup = '') {
  return {
    localId:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    expense_category_id: '',
    expense_date: '',
    description: '',
    total_amount: '',
    charge_group: defaultGroup,
    submission_files: [],
  }
}

function sanitizeFileName(value) {
  return String(value || 'file')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
}

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function formatAmountInput(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  return new Intl.NumberFormat('id-ID').format(Number(digits))
}

function parseAmountInput(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function formatAttachmentCount(count) {
  return `${count} attachment${count === 1 ? '' : 's'} added`
}

function truncateFileLabel(value, maxLength = 28) {
  const text = String(value || '')
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}…`
}

function normalizeClaim(row) {
  return {
    id: row?.id || '',
    claim_number: row?.claim_number || '',
    expense_date: row?.expense_date || '',
    expense_category_id: row?.expense_category_id ? String(row.expense_category_id) : '',
    expense_category_name: row?.category?.name || '',
    status: row?.status || 'SUBMITTED',
    description: row?.description || '',
    comments: row?.comments || '',
    total_amount: Number(row?.total_amount || 0),
    charge_group: row?.charge_group || '',
    submitted_at: row?.submitted_at || row?.created_at || '',
    attachments: Array.isArray(row?.attachments) ? row.attachments : [],
  }
}

function getStatusTone(value) {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'APPROVED') return styles.statusApproved
  if (normalized === 'PAID') return styles.statusPaid
  if (normalized === 'NEED_REVISION') return styles.statusRejected
  if (normalized === 'REJECTED') return styles.statusRejected
  return styles.statusPending
}

function getProfileGroup(profile = {}) {
  return String(profile?.group || '').trim().toUpperCase()
}

function isHeadquarterGroup(value = '') {
  const normalized = String(value || '').trim().toUpperCase()
  return normalized === 'HQ' || normalized.includes('HEAD')
}

function extractGroupValue(row = {}) {
  return String(row?.group || '').trim().toUpperCase()
}

function buildGroupOptions(rows = [], fallbackGroup = '') {
  const values = new Set(DEFAULT_GROUP_OPTIONS)
  if (fallbackGroup) {
    values.add(fallbackGroup)
  }

  for (const row of rows || []) {
    const value = extractGroupValue(row)
    if (value) {
      values.add(value)
    }
  }

  return Array.from(values).sort((left, right) => left.localeCompare(right))
}

async function uploadReceiptFile({ file, claimId, claimNumber, uploadedBy }) {
  const extension = String(file?.name || '').split('.').pop()?.toLowerCase() || 'bin'
  const safeName = sanitizeFileName(file?.name || `receipt.${extension}`)
  const year = new Date().getFullYear()
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`
  const claimFolder = sanitizeFileName(String(claimNumber || claimId))
  const storagePath = `${year}/Submission/${claimFolder}/${fileName}`

  const { error: uploadError } = await supabase.storage.from(REIMBURSEMENT_BUCKET).upload(storagePath, file, { upsert: false })
  if (uploadError) {
    throw new Error(uploadError.message)
  }

  return {
    storagePath,
    attachmentRow: {
      claim_id: claimId,
      attachment_type: 'SUBMISSION_PROOF',
      storage_bucket: REIMBURSEMENT_BUCKET,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size || null,
      uploaded_by: uploadedBy || null,
    },
  }
}

export default function MyArklifeReimbursementClient({ profile, headerActions = null }) {
  const batchFileInputRef = useRef(null)
  const editFileInputRef = useRef(null)
  const batchFileInputId = 'myarklife-batch-receipt-input'
  const editFileInputId = 'myarklife-edit-receipt-input'
  const [categories, setCategories] = useState([])
  const [claims, setClaims] = useState([])
  const [groupOptions, setGroupOptions] = useState(DEFAULT_GROUP_OPTIONS)
  const [tableNames, setTableNames] = useState(HRGA_TABLES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [openBatchModal, setOpenBatchModal] = useState(false)
  const [editingClaim, setEditingClaim] = useState(null)
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [editDraft, setEditDraft] = useState(null)
  const [editFiles, setEditFiles] = useState([])
  const [batchRows, setBatchRows] = useState([createDraftRow(getProfileGroup(profile))])
  const [activeBatchRowId, setActiveBatchRowId] = useState('')

  const profileGroup = getProfileGroup(profile)
  const hqUser = isHeadquarterGroup(profileGroup)
  const totalHistoryAmount = useMemo(() => claims.reduce((sum, item) => sum + Number(item.total_amount || 0), 0), [claims])
  const activeBatchRow = batchRows.find((item) => item.localId === activeBatchRowId) || batchRows[0] || null
  const availableGroupOptions = useMemo(
    () => (hqUser ? groupOptions.filter((item) => String(item || '').toUpperCase() !== 'HQ') : groupOptions),
    [groupOptions, hqUser]
  )

  const loadWorkspace = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
    }
    setError('')

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      setError(authError?.message || 'You need to sign in again to open reimbursement claims.')
      if (!silent) setLoading(false)
      return
    }

    const { error: probeError } = await supabase.from(HRGA_TABLES.claims).select('id').limit(1)
    const resolvedTables = probeError?.code === '42P01' ? LEGACY_TABLES : HRGA_TABLES
    setTableNames(resolvedTables)

    const { data: profileRow } = await getProfileByAuthenticatedUser(
      supabase,
      user,
      'id, authenticated_id, display_name, reimbursement_bank_name, reimbursement_account_name, reimbursement_account_number, "group"'
    )
    const currentEmail = String(profileRow?.email || profile?.email || user.email || '').toLowerCase()

    const [{ data: categoryRows, error: categoryError }, { data: claimRows, error: claimError }, { data: groupRows, error: groupError }] = await Promise.all([
      supabase.from('dir_reimbursement_categories').select('id, name, is_active').order('id', { ascending: true }),
      supabase
        .from(resolvedTables.claims)
        .select(
          `
            id,
            claim_number,
            employee_email_snapshot,
            expense_date,
            expense_category_id,
            status,
            description,
            comments,
            total_amount,
            submitted_at,
            created_at,
            charge_group:group,
            category:dir_reimbursement_categories(id, name),
            attachments:${resolvedTables.attachments}(
              id,
              attachment_type,
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
        .order('submitted_at', { ascending: false }),
      supabase.from('dir_user_profiles').select('"group"'),
    ])

    if (categoryError || claimError || groupError) {
      setError(categoryError?.message || claimError?.message || groupError?.message || 'Failed to load reimbursement data.')
      if (!silent) setLoading(false)
      return
    }

    const ownClaims = (claimRows || [])
      .filter((item) => String(item.employee_email_snapshot || '').toLowerCase() === currentEmail)
      .map(normalizeClaim)

    setCategories((categoryRows || []).filter((item) => item.is_active !== false))
    setClaims(ownClaims)
    setGroupOptions(buildGroupOptions(groupRows, profileGroup))
    if (!silent) setLoading(false)
  }, [profile, profileGroup])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (saving) return
      void loadWorkspace(true)
    }, 10000)
    return () => window.clearInterval(intervalId)
  }, [loadWorkspace, saving])

  function resetBatchModal() {
    const firstRow = createDraftRow(profileGroup)
    setBatchRows([firstRow])
    setActiveBatchRowId(firstRow.localId)
    setOpenBatchModal(false)
  }

  function openCreateModal() {
    const firstRow = createDraftRow(profileGroup)
    setBatchRows([firstRow])
    setActiveBatchRowId(firstRow.localId)
    setOpenBatchModal(true)
    setError('')
    setSuccess('')
  }

  function addBatchRow() {
    const nextRow = createDraftRow(profileGroup)
    setBatchRows((prev) => [...prev, nextRow])
    setActiveBatchRowId(nextRow.localId)
  }

  function updateBatchRow(localId, patch) {
    setBatchRows((prev) => prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item)))
  }

  function handleBatchAmountChange(localId, value) {
    updateBatchRow(localId, { total_amount: formatAmountInput(value) })
  }

  function appendSubmissionFiles(localId, files) {
    setBatchRows((prev) =>
      prev.map((item) =>
        item.localId === localId
          ? {
              ...item,
              submission_files: [...item.submission_files, ...files],
            }
          : item
      )
    )
  }

  function removeSubmissionFile(localId, index) {
    setBatchRows((prev) =>
      prev.map((item) =>
        item.localId === localId
          ? {
              ...item,
              submission_files: item.submission_files.filter((_, fileIndex) => fileIndex !== index),
            }
          : item
      )
    )
  }

  function removeBatchRow(localId) {
    setBatchRows((prev) => {
      const nextRows = prev.filter((item) => item.localId !== localId)
      if (!nextRows.length) {
        const fresh = createDraftRow(profileGroup)
        setActiveBatchRowId(fresh.localId)
        return [fresh]
      }
      if (activeBatchRowId === localId) {
        setActiveBatchRowId(nextRows[0].localId)
      }
      return nextRows
    })
  }

  function appendEditFiles(files) {
    if (!files.length) return
    setEditFiles((prev) => [...prev, ...files])
  }

  function removeEditFile(targetIndex) {
    setEditFiles((prev) => prev.filter((_, index) => index !== targetIndex))
  }

  function resolveChargeGroup(value) {
    const normalized = String(value || '').trim().toUpperCase()
    return normalized || profileGroup
  }

  async function handleSaveBatch() {
    setSaving(true)
    setError('')
    setSuccess('')

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      setError(authError?.message || 'You need to sign in again.')
      setSaving(false)
      return
    }

    if (!profile?.reimbursement_account_name || !profile?.reimbursement_account_number) {
      setError('Please complete your reimbursement account in profile first.')
      setSaving(false)
      return
    }

    const createdClaimIds = []
    const uploadedPaths = []

    try {
      for (const row of batchRows) {
        if (!row.expense_category_id || !row.expense_date || !row.total_amount) {
          throw new Error('Each reimbursement row needs claim type, expense date, and amount.')
        }

        const chargeGroup = resolveChargeGroup(row.charge_group)
        if (!chargeGroup) {
          throw new Error('Cost center group is required.')
        }

        const amountValue = parseAmountInput(row.total_amount)
        if (amountValue <= 0) {
          throw new Error('Each reimbursement amount must be greater than zero.')
        }

        for (const file of row.submission_files) {
          if (file.size > 10 * 1024 * 1024) {
            throw new Error('Receipt file must be 10MB or below.')
          }
        }

        const payload = {
          employee_authenticated_id: user.id,
          employee_email_snapshot: String(user.email || profile?.email || '').toLowerCase(),
          employee_name_snapshot: profile?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Team',
          expense_date: row.expense_date,
          expense_category_id: Number(row.expense_category_id),
          status: 'SUBMITTED',
          description: String(row.description || '').trim() || null,
          total_amount: amountValue,
          payee_type: 'SELF_ACCOUNT',
          payee_authenticated_id: user.id,
          payee_bank_name: profile?.reimbursement_bank_name || null,
          payee_account_name: profile?.reimbursement_account_name || null,
          payee_account_number: profile?.reimbursement_account_number || null,
          submitted_at: new Date().toISOString(),
          created_by: String(user.email || profile?.email || '').toLowerCase(),
          group: chargeGroup,
        }

        const { data: insertedClaim, error: insertError } = await supabase
          .from(tableNames.claims)
          .insert(payload)
          .select('id, claim_number')
          .single()

        if (insertError) {
          throw new Error(insertError.message)
        }

        createdClaimIds.push(insertedClaim.id)

        for (const file of row.submission_files) {
          const uploadResult = await uploadReceiptFile({
            file,
            claimId: insertedClaim.id,
            claimNumber: insertedClaim.claim_number,
            uploadedBy: profile?.email || user.email || null,
          })
          uploadedPaths.push(uploadResult.storagePath)

          const { error: attachmentError } = await supabase.from(tableNames.attachments).insert(uploadResult.attachmentRow)
          if (attachmentError) {
            throw new Error(attachmentError.message)
          }
        }
      }

      setSuccess(`${batchRows.length} reimbursement claim${batchRows.length > 1 ? 's' : ''} submitted.`)
      resetBatchModal()
      await loadWorkspace(true)
    } catch (saveError) {
      if (uploadedPaths.length) {
        await supabase.storage.from(REIMBURSEMENT_BUCKET).remove(uploadedPaths)
      }
      if (createdClaimIds.length) {
        await supabase.from(tableNames.claims).delete().in('id', createdClaimIds)
      }
      setError(saveError?.message || 'Failed to save reimbursement batch.')
    } finally {
      setSaving(false)
    }
  }

  function openEditModal(claim) {
    setEditingClaim(claim)
    setEditDraft({
      expense_category_id: claim.expense_category_id || '',
      expense_date: claim.expense_date || '',
      description: claim.description || '',
      total_amount: formatAmountInput(claim.total_amount || ''),
      charge_group: claim.charge_group || profileGroup,
    })
    setEditFiles([])
    setError('')
    setSuccess('')
  }

  async function handleSaveEdit() {
    if (!editingClaim || !editDraft) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      if (!editDraft.expense_category_id || !editDraft.expense_date || !editDraft.total_amount) {
        throw new Error('Claim type, expense date, and amount are required.')
      }

      const chargeGroup = resolveChargeGroup(editDraft.charge_group)
      if (!chargeGroup) {
        throw new Error('Cost center group is required.')
      }

      const amountValue = parseAmountInput(editDraft.total_amount)
      if (amountValue <= 0) {
        throw new Error('Amount must be greater than zero.')
      }

      const payload = {
        expense_date: editDraft.expense_date,
        expense_category_id: Number(editDraft.expense_category_id),
        description: String(editDraft.description || '').trim() || null,
        total_amount: amountValue,
        group: chargeGroup,
        ...(editingClaim.status === 'NEED_REVISION' ? { status: 'SUBMITTED', comments: null } : {}),
      }

      const { error: updateError } = await supabase.from(tableNames.claims).update(payload).eq('id', editingClaim.id)
      if (updateError) {
        throw new Error(updateError.message)
      }

      for (const file of editFiles) {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('Receipt file must be 10MB or below.')
        }
        const uploadResult = await uploadReceiptFile({
          file,
          claimId: editingClaim.id,
          claimNumber: editingClaim.claim_number,
          uploadedBy: profile?.email || null,
        })
        const { error: attachmentError } = await supabase.from(tableNames.attachments).insert(uploadResult.attachmentRow)
        if (attachmentError) {
          throw new Error(attachmentError.message)
        }
      }

      setEditingClaim(null)
      setEditDraft(null)
      setEditFiles([])
      setSuccess(`Claim ${editingClaim.claim_number} updated.`)
      await loadWorkspace(true)
    } catch (editError) {
      setError(editError?.message || 'Failed to update claim.')
    } finally {
      setSaving(false)
    }
  }

  async function handleOpenAttachment(attachment) {
    if (!attachment) return

    setError('')
    const { data, error: signedUrlError } = await supabase.storage.from(attachment.storage_bucket).createSignedUrl(attachment.storage_path, 300)
    if (signedUrlError) {
      setError(signedUrlError.message)
      return
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    }
  }

  function syncClaimAttachments(claimId, nextAttachments) {
    setClaims((prev) => prev.map((item) => (item.id === claimId ? { ...item, attachments: nextAttachments } : item)))
    setSelectedClaim((prev) => (prev?.id === claimId ? { ...prev, attachments: nextAttachments } : prev))
    setEditingClaim((prev) => (prev?.id === claimId ? { ...prev, attachments: nextAttachments } : prev))
  }

  async function handleDeleteExistingAttachment(attachment) {
    if (!editingClaim || !attachment?.id) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      if (attachment.storage_path) {
        const { error: storageError } = await supabase
          .storage
          .from(attachment.storage_bucket || REIMBURSEMENT_BUCKET)
          .remove([attachment.storage_path])

        if (storageError) {
          throw new Error(storageError.message)
        }
      }

      const { error: deleteError } = await supabase.from(tableNames.attachments).delete().eq('id', attachment.id)
      if (deleteError) {
        throw new Error(deleteError.message)
      }

      const nextAttachments = (editingClaim.attachments || []).filter((item) => item.id !== attachment.id)
      syncClaimAttachments(editingClaim.id, nextAttachments)
      setSuccess(`Attachment ${attachment.file_name || ''} removed.`.trim())
    } catch (deleteError) {
      setError(deleteError?.message || 'Failed to remove attachment.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteClaim(claim) {
    if (!claim || claim.status !== 'SUBMITTED') return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const storagePaths = (claim.attachments || []).map((item) => item.storage_path).filter(Boolean)
      if (storagePaths.length) {
        const { error: storageError } = await supabase.storage.from(REIMBURSEMENT_BUCKET).remove(storagePaths)
        if (storageError) {
          throw new Error(storageError.message)
        }
      }

      const { error: deleteError } = await supabase.from(tableNames.claims).delete().eq('id', claim.id)
      if (deleteError) {
        throw new Error(deleteError.message)
      }

      setSuccess(`Claim ${claim.claim_number} deleted.`)
      await loadWorkspace(true)
    } catch (deleteError) {
      setError(deleteError?.message || 'Failed to delete claim.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.reimbursementShell}>
      <div className={styles.claimListHeader}>
        <div className={styles.claimHeaderMain}>
          <div className={styles.claimTitleBlock}>
            <h2 className={styles.reimbursementListTitle}>Reimbursement Claim</h2>
            <p className={styles.reimbursementListText}>History list with current statuses and quick actions.</p>
          </div>
          <div className={styles.claimTitleRow}>
            <div className={styles.claimSummaryInline}>
              <span>Total Claim Amount</span>
              <strong>{formatCurrency(totalHistoryAmount)}</strong>
            </div>
            {headerActions}
            <button
              type="button"
              className={styles.actionPillButton}
              onClick={openCreateModal}
              aria-label="New claim"
              title="New claim"
            >
              + Claim
            </button>
          </div>
        </div>
      </div>

      {error && !openBatchModal ? <p className={styles.errorText}>{error}</p> : null}
      {success ? <p className={styles.successText}>{success}</p> : null}

      <div className={styles.claimListSection}>
        {loading ? (
          <div className={styles.emptyText}>Loading claims...</div>
        ) : claims.length ? (
          <div className={styles.claimList}>
            {claims.map((claim) => (
              <article key={claim.id} className={styles.claimRow}>
                <div className={styles.claimRowTop}>
                  <div>
                    <p className={styles.claimRowTitle}>{claim.claim_number || claim.expense_category_name || 'Claim'}</p>
                    <p className={styles.claimRowMeta}>
                      {claim.expense_category_name || '-'} | {formatDate(claim.expense_date)} | {claim.charge_group || '-'}
                    </p>
                  </div>
                  <strong className={styles.claimAmount}>{formatCurrency(claim.total_amount)}</strong>
                </div>
                <p className={styles.claimRowText}>{claim.description || 'No description provided.'}</p>
                <div className={styles.claimRowSide}>
                  <div className={styles.claimActions}>
                    {claim.status === 'SUBMITTED' || claim.status === 'NEED_REVISION' ? (
                      <>
                        {(claim.attachments || []).some((item) => item.attachment_type === 'SUBMISSION_PROOF') ? (
                          <button
                            type="button"
                            className={styles.smallAction}
                            onClick={() => void handleOpenAttachment((claim.attachments || []).find((item) => item.attachment_type === 'SUBMISSION_PROOF'))}
                          >
                            Receipt
                          </button>
                        ) : null}
                        <button type="button" className={styles.smallAction} onClick={() => openEditModal(claim)}>
                          Edit
                        </button>
                        <button type="button" className={styles.smallDanger} onClick={() => void handleDeleteClaim(claim)} disabled={saving}>
                          Delete
                        </button>
                      </>
                    ) : (
                      <button type="button" className={styles.smallAction} onClick={() => setSelectedClaim(claim)}>
                        View Details
                      </button>
                    )}
                  </div>
                  <span className={`${styles.statusBadge} ${getStatusTone(claim.status)}`.trim()}>{claim.status}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyText}>No reimbursement claim submitted yet.</div>
        )}
      </div>

      {openBatchModal ? (
        <div className={styles.modalOverlay} onClick={resetBatchModal}>
          <div className={styles.modalWideCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Reimbursement Claim</h2>
            </div>

            <div className={styles.modalBody}>
              {error ? <p className={styles.errorText}>{error}</p> : null}

              <div className={styles.batchLayout}>
                <section className={styles.batchEditor}>
                  {activeBatchRow ? (
                    <>
                      <div className={styles.batchEditorHeader}>
                        <div>
                          <h3 className={styles.batchTitle}>Entry {batchRows.findIndex((item) => item.localId === activeBatchRow.localId) + 1}</h3>
                          <p className={styles.batchText}>Add reimbursement details for this row.</p>
                        </div>
                        <button type="button" className={styles.batchActionButton} onClick={addBatchRow}>
                          Add Row
                        </button>
                      </div>

                      <div className={styles.modalForm}>
                        <div className={styles.formGridTwo}>
                          <label className={styles.field}>
                            <span className={styles.label}>Claim Type</span>
                            <select
                              className={styles.select}
                              value={activeBatchRow.expense_category_id}
                              onChange={(event) => updateBatchRow(activeBatchRow.localId, { expense_category_id: event.target.value })}
                            >
                              <option value="">Select type</option>
                              {categories.map((item) => (
                                <option key={item.id} value={String(item.id)}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className={styles.field}>
                            <span className={styles.label}>Expense Date</span>
                            <input
                              className={styles.input}
                              type="date"
                              value={activeBatchRow.expense_date}
                              onChange={(event) => updateBatchRow(activeBatchRow.localId, { expense_date: event.target.value })}
                            />
                          </label>
                        </div>

                        <label className={styles.field}>
                          <span className={styles.label}>Description</span>
                          <textarea
                            className={styles.textarea}
                            value={activeBatchRow.description}
                            onChange={(event) => updateBatchRow(activeBatchRow.localId, { description: event.target.value })}
                          />
                        </label>

                        <div className={styles.formGridTwo}>
                          <label className={styles.field}>
                            <span className={styles.label}>Amount (Rp)</span>
                            <input
                              className={styles.input}
                              type="text"
                              inputMode="numeric"
                              value={activeBatchRow.total_amount}
                              onChange={(event) => handleBatchAmountChange(activeBatchRow.localId, event.target.value)}
                            />
                          </label>

                          <label className={styles.field}>
                            <span className={styles.label}>Cost Center</span>
                            {hqUser ? (
                              <select
                                className={styles.select}
                                value={activeBatchRow.charge_group}
                                onChange={(event) => updateBatchRow(activeBatchRow.localId, { charge_group: event.target.value })}
                              >
                                <option value="">Select group</option>
                                {availableGroupOptions.map((item) => (
                                  <option key={item} value={item}>
                                    {item}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input className={styles.input} type="text" value={activeBatchRow.charge_group} readOnly disabled />
                            )}
                          </label>
                        </div>

                        <div className={styles.field}>
                          <span className={styles.label}>Receipt Upload</span>
                          <input
                            id={batchFileInputId}
                            ref={batchFileInputRef}
                            className={styles.hiddenInput}
                            type="file"
                            multiple
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={(event) => {
                              appendSubmissionFiles(activeBatchRow.localId, Array.from(event.target.files || []))
                              event.target.value = ''
                            }}
                          />
                          <div className={styles.uploadPanel}>
                            <div className={styles.uploadPanelHeader}>
                              <div>
                                <p className={styles.uploadPanelTitle}>Receipt files</p>
                                <p className={styles.uploadPanelMeta}>{formatAttachmentCount(activeBatchRow.submission_files.length)}</p>
                              </div>
                            </div>

                    <div className={styles.uploadTileRow}>
                      <label htmlFor={batchFileInputId} className={styles.uploadAddButton} aria-label="Add receipt files">
                        +
                      </label>
                      {activeBatchRow.submission_files.map((file, index) => (
                                <div key={`${activeBatchRow.localId}-${file.name}-${index}`} className={styles.uploadFileTile}>
                                  <span className={styles.uploadFileName} title={file.name}>
                                    {truncateFileLabel(file.name)}
                                  </span>
                                  <button type="button" className={styles.fileChipRemove} onClick={() => removeSubmissionFile(activeBatchRow.localId, index)} aria-label={`Remove ${file.name}`}>
                                    x
                                  </button>
                                </div>
                              ))}
                            </div>

                            {!activeBatchRow.submission_files.length ? <p className={styles.uploadEmptyText}>Tap + to add one or more receipts.</p> : null}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </section>

                <aside className={styles.batchSidebar}>
                  <div className={styles.batchSidebarHeader}>
                    <h3 className={styles.batchTitle}>Added Entries</h3>
                    <strong className={styles.batchTotal}>{formatCurrency(batchRows.reduce((sum, item) => sum + parseAmountInput(item.total_amount), 0))}</strong>
                  </div>

                  <div className={styles.modalActions}>
                    <button type="button" className={styles.cancelDangerButton} onClick={resetBatchModal}>
                      Cancel
                    </button>
                    <button type="button" className={styles.primaryButton} onClick={() => void handleSaveBatch()} disabled={saving}>
                      {saving ? 'Saving...' : 'Submit Batch'}
                    </button>
                  </div>

                  <div className={styles.batchList}>
                    {batchRows.map((row, index) => {
                      const category = categories.find((item) => String(item.id) === String(row.expense_category_id))
                      return (
                        <button
                          key={row.localId}
                          type="button"
                          className={`${styles.batchRowButton} ${row.localId === activeBatchRowId ? styles.batchRowButtonActive : ''}`.trim()}
                          onClick={() => setActiveBatchRowId(row.localId)}
                        >
                          <div>
                            <p className={styles.batchRowTitle}>Entry {index + 1}</p>
                            <p className={styles.batchRowMeta}>{category?.name || 'No category yet'}</p>
                            <p className={styles.batchRowMeta}>{row.charge_group || '-'}</p>
                          </div>
                          <div className={styles.batchRowSide}>
                            <strong>{formatCurrency(parseAmountInput(row.total_amount))}</strong>
                            <span
                              className={styles.batchRowDelete}
                              onClick={(event) => {
                                event.stopPropagation()
                                removeBatchRow(row.localId)
                              }}
                            >
                              Remove
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingClaim && editDraft ? (
        <div className={styles.modalOverlay} onClick={() => setEditingClaim(null)}>
          <div className={styles.modalCard} style={{ maxHeight: '90vh', overflow: 'hidden' }} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Edit Claim</h2>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalForm}>
                <div className={styles.formGridTwo}>
                  <label className={styles.field}>
                    <span className={styles.label}>Claim Type</span>
                    <select
                      className={styles.select}
                      value={editDraft.expense_category_id}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, expense_category_id: event.target.value }))}
                    >
                      <option value="">Select type</option>
                      {categories.map((item) => (
                        <option key={item.id} value={String(item.id)}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span className={styles.label}>Expense Date</span>
                    <input
                      className={styles.input}
                      type="date"
                      value={editDraft.expense_date}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, expense_date: event.target.value }))}
                    />
                  </label>
                </div>

                <label className={styles.field}>
                  <span className={styles.label}>Description</span>
                  <textarea
                    className={styles.textarea}
                    value={editDraft.description}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </label>

                <div className={styles.formGridTwo}>
                  <label className={styles.field}>
                    <span className={styles.label}>Amount (Rp)</span>
                    <input
                      className={styles.input}
                      type="text"
                      inputMode="numeric"
                      value={editDraft.total_amount}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, total_amount: formatAmountInput(event.target.value) }))}
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.label}>Cost Center</span>
                    {hqUser ? (
                      <select
                        className={styles.select}
                        value={editDraft.charge_group}
                        onChange={(event) => setEditDraft((prev) => ({ ...prev, charge_group: event.target.value }))}
                      >
                        <option value="">Select group</option>
                        {availableGroupOptions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input className={styles.input} type="text" value={editDraft.charge_group} readOnly disabled />
                    )}
                  </label>
                </div>

                <div className={styles.field}>
                  <span className={styles.label}>Add Receipt</span>
                  <input
                    id={editFileInputId}
                    ref={editFileInputRef}
                    className={styles.hiddenInput}
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(event) => {
                      appendEditFiles(Array.from(event.target.files || []))
                      event.target.value = ''
                    }}
                  />
                  <div className={styles.uploadPanel}>
                    <div className={styles.uploadPanelHeader}>
                      <div>
                        <p className={styles.uploadPanelTitle}>New receipt files</p>
                        <p className={styles.uploadPanelMeta}>{formatAttachmentCount(editFiles.length)}</p>
                      </div>
                    </div>

                    <div className={styles.uploadTileRow}>
                      <button
                        type="button"
                        className={styles.uploadAddButton}
                        aria-label="Add receipt files"
                        onClick={() => editFileInputRef.current?.click()}
                      >
                        +
                      </button>
                      {editFiles.map((file, index) => (
                        <div key={`${editingClaim.id}-${file.name}-${index}`} className={styles.uploadFileTile}>
                          <span className={styles.uploadFileName} title={file.name}>
                            {truncateFileLabel(file.name)}
                          </span>
                          <button
                            type="button"
                            className={styles.fileChipRemove}
                            onClick={() => removeEditFile(index)}
                            aria-label={`Remove ${file.name}`}
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>

                    {!editFiles.length ? <p className={styles.uploadEmptyText}>Tap + to add one or more receipts.</p> : null}
                  </div>
                </div>

                {(editingClaim.attachments || []).length ? (
                  <div className={styles.detailSection}>
                    <p className={styles.detailLabel}>Current Attachments</p>
                    <div className={styles.uploadTileRow}>
                      {editingClaim.attachments.map((attachment) => (
                        <div key={attachment.id} className={styles.uploadFileTile}>
                          <button
                            type="button"
                            className={styles.uploadFileLink}
                            title={attachment.file_name}
                            onClick={() => void handleOpenAttachment(attachment)}
                          >
                            {truncateFileLabel(attachment.file_name)}
                          </button>
                          <button
                            type="button"
                            className={styles.fileChipRemove}
                            onClick={() => void handleDeleteExistingAttachment(attachment)}
                            disabled={saving}
                            aria-label={`Remove ${attachment.file_name}`}
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelDangerButton} onClick={() => setEditingClaim(null)}>
                    Cancel
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={() => void handleSaveEdit()} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedClaim ? (
        <div className={styles.modalOverlay} onClick={() => setSelectedClaim(null)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Claim Details</h2>
              <button type="button" className={styles.modalClose} onClick={() => setSelectedClaim(null)}>
                Close
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.detailStack}>
                <div className={styles.detailCard}>
                  <span className={styles.detailLabel}>Claim Number</span>
                  <strong>{selectedClaim.claim_number}</strong>
                </div>
                <div className={styles.detailCard}>
                  <span className={styles.detailLabel}>Status</span>
                  <strong>{selectedClaim.status}</strong>
                </div>
                <div className={styles.detailCard}>
                  <span className={styles.detailLabel}>Amount</span>
                  <strong>{formatCurrency(selectedClaim.total_amount)}</strong>
                </div>
                <div className={styles.detailCard}>
                  <span className={styles.detailLabel}>Cost Center</span>
                  <strong>{selectedClaim.charge_group || '-'}</strong>
                </div>
              </div>

              <div className={styles.detailSection}>
                <p className={styles.detailLabel}>Description</p>
                <p className={styles.detailParagraph}>{selectedClaim.description || 'No description provided.'}</p>
              </div>

              {selectedClaim.comments ? (
                <div className={styles.detailSection}>
                  <p className={styles.detailLabel}>Revision Comment</p>
                  <p className={styles.detailParagraph}>{selectedClaim.comments}</p>
                </div>
              ) : null}

              <div className={styles.detailSection}>
                <p className={styles.detailLabel}>Attachments</p>
                {(selectedClaim.attachments || []).length ? (
                  <div className={styles.attachmentList}>
                    {selectedClaim.attachments.map((attachment) => (
                      <button key={attachment.id} type="button" className={styles.attachmentButton} onClick={() => void handleOpenAttachment(attachment)}>
                        {attachment.file_name}
                        <span>{attachment.attachment_type === 'PAYMENT_PROOF' ? 'Payment Proof' : 'Submission Proof'}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyText}>No attachment available.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
