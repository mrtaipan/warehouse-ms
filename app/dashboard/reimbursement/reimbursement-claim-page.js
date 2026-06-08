'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'
import { ADMIN_EMAIL, expandImpliedPermissions, getArklineFeatureAccess, resolveRole } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

import styles from '../arkline/arkline.module.css'
import tableStyles from '../arkline/financial-management/financial-management.module.css'

const supabase = createClient()
const REIMBURSEMENT_BUCKET = 'reimbursement-claims'
const LEGACY_REIMBURSEMENT_TABLES = {
  claims: 'arkline_reimbursement_claims',
  attachments: 'arkline_reimbursement_attachments',
}
const HRGA_REIMBURSEMENT_TABLES = {
  claims: 'hrga_reimbursement_claims',
  attachments: 'hrga_reimbursement_attachments',
}

function createDraftRow() {
  return {
    localId:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    expense_date: '',
    expense_category_id: '',
    description: '',
    total_amount: '',
    payee_type: 'SELF_ACCOUNT',
    payee_bank_name: '',
    payee_account_name: '',
    payee_account_number: '',
    submission_files: [],
  }
}

function normalizeProfile(row, user) {
  return {
    id: row?.id || '',
    authenticated_id: row?.authenticated_id || user?.id || '',
    email: user?.email?.toLowerCase() || '',
    display_name: row?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '',
    role: resolveRole(row?.role || 'guest'),
    reimbursement_bank_name: row?.reimbursement_bank_name || '',
    reimbursement_account_name: row?.reimbursement_account_name || '',
    reimbursement_account_number: row?.reimbursement_account_number || '',
  }
}

function normalizeClaim(row) {
  const attachments = Array.isArray(row?.attachments) ? row.attachments : []
  const categoryName = row?.category?.name || ''

  return {
    id: row?.id || '',
    claim_number: row?.claim_number || '',
    employee_authenticated_id: row?.employee_authenticated_id || '',
    employee_email_snapshot: row?.employee_email_snapshot || '',
    employee_name_snapshot: row?.employee_name_snapshot || '',
    expense_date: row?.expense_date || '',
    expense_category_id: row?.expense_category_id ? String(row.expense_category_id) : '',
    expense_category_name: categoryName,
    status: row?.status || 'SUBMITTED',
    description: row?.description || '',
    group: row?.group || '',
    comments: row?.comments || '',
    total_amount: Number(row?.total_amount || 0),
    payee_type: row?.payee_type || 'SELF_ACCOUNT',
    payee_authenticated_id: row?.payee_authenticated_id || '',
    payee_bank_name: row?.payee_bank_name || '',
    payee_account_name: row?.payee_account_name || '',
    payee_account_number: row?.payee_account_number || '',
    submitted_at: row?.submitted_at || '',
    approved_at: row?.approved_at || '',
    paid_at: row?.paid_at || '',
    created_by: row?.created_by || '',
    approved_by: row?.approved_by || '',
    paid_by: row?.paid_by || '',
    created_at: row?.created_at || '',
    updated_at: row?.updated_at || '',
    attachments,
  }
}

function buildPayeeGroupKey(item) {
  return [item.payee_type, item.payee_bank_name || '', item.payee_account_name || '', item.payee_account_number || ''].join('::')
}

function buildPayeeGroupLabel(item) {
  return `${item.payee_bank_name ? `${item.payee_bank_name} - ` : ''}${item.payee_account_name || '-'} (${item.payee_account_number || '-'})`
}

function buildPaidBatchKey(item) {
  return [buildPayeeGroupKey(item), item.paid_at || 'unpaid'].join('::')
}

function getGroupedPaymentProofs(claims) {
  const uniqueMap = new Map()

  for (const claim of claims || []) {
    for (const attachment of claim.attachments || []) {
      if (attachment.attachment_type !== 'PAYMENT_PROOF') continue
      const key = `${attachment.file_name || ''}::${attachment.created_at || ''}`
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, attachment)
      }
    }
  }

  return Array.from(uniqueMap.values())
}

function getAttachmentsByType(claim, type) {
  return (claim?.attachments || []).filter((attachment) => attachment.attachment_type === type)
}

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
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

function isImageMimeType(value) {
  return String(value || '').toLowerCase().startsWith('image/')
}

function isImageFileName(value) {
  const normalizedValue = String(value || '').split('?')[0].split('#')[0]
  return /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i.test(normalizedValue)
}

function isPdfMimeType(value) {
  return String(value || '').toLowerCase() === 'application/pdf'
}

function isPdfFileName(value) {
  const normalizedValue = String(value || '').split('?')[0].split('#')[0]
  return /\.pdf$/i.test(normalizedValue)
}

function isPreviewableImageAttachment(attachment) {
  return isImageMimeType(attachment?.mime_type) || isImageFileName(attachment?.file_name)
}

function getAttachmentActionLabel(attachment) {
  if (isPreviewableImageAttachment(attachment)) {
    return 'Preview'
  }

  if (isPdfMimeType(attachment?.mime_type) || isPdfFileName(attachment?.file_name)) {
    return 'Open PDF'
  }

  return 'Open'
}

function buildCompressedName(fileName, mimeType) {
  const baseName = String(fileName || 'attachment').replace(/\.[^.]+$/, '')
  const extension = mimeType === 'image/webp' ? 'webp' : 'jpg'
  return `${baseName}.${extension}`
}

function normalizeUppercaseText(value) {
  return String(value || '').toUpperCase()
}

function normalizeAccountName(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trimStart()
}

function normalizeAccountNumber(value) {
  return String(value || '').replace(/\D/g, '')
}

function getClaimReferenceDate(item) {
  const source = item?.status === 'PAID' ? item?.paid_at || item?.expense_date || item?.submitted_at : item?.expense_date || item?.submitted_at
  const date = source ? new Date(source) : null
  if (!date || Number.isNaN(date.getTime())) return null
  return date
}

function buildClaimStorageFolder(claimNumber, fallbackId) {
  const safeClaimNumber = sanitizeFileName(String(claimNumber || '').trim()).replace(/\.+/g, '-')
  return safeClaimNumber || String(fallbackId || 'claim')
}

async function compressImageFile(file) {
  if (!isImageMimeType(file?.type) || /image\/(gif|svg\+xml)/i.test(String(file?.type || ''))) {
    return file
  }

  const imageUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to read image attachment.'))
      img.src = imageUrl
    })

    const maxDimension = 1600
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
    const targetWidth = Math.max(1, Math.round(image.width * scale))
    const targetHeight = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight

    const context = canvas.getContext('2d')
    if (!context) {
      return file
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight)

    const outputMimeType = /image\/webp/i.test(String(file.type || '')) ? 'image/webp' : 'image/jpeg'
    const compressedBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to compress image attachment.'))
        },
        outputMimeType,
        0.78
      )
    })

    if (compressedBlob.size >= file.size) {
      return file
    }

    return new File([compressedBlob], buildCompressedName(file.name, outputMimeType), {
      type: outputMimeType,
      lastModified: Date.now(),
    })
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

async function uploadClaimFiles({ claimId, claimNumber, files, folder, uploadedBy }) {
  const uploadedPaths = []
  const attachmentRows = []
  const year = new Date().getFullYear()
  const claimFolder = buildClaimStorageFolder(claimNumber, claimId)

  for (const sourceFile of files) {
    const file = await compressImageFile(sourceFile)
    const extension = String(file?.name || '').split('.').pop()?.toLowerCase() || 'bin'
    const safeName = sanitizeFileName(file?.name || `attachment.${extension}`)
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`
    const storagePath = `${year}/${claimFolder}/${folder}/${fileName}`

    const { error: uploadError } = await supabase.storage.from(REIMBURSEMENT_BUCKET).upload(storagePath, file, { upsert: false })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    uploadedPaths.push(storagePath)
    attachmentRows.push({
      claim_id: claimId,
      attachment_type: folder === 'payment' ? 'PAYMENT_PROOF' : 'SUBMISSION_PROOF',
      storage_bucket: REIMBURSEMENT_BUCKET,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size || null,
      uploaded_by: uploadedBy || null,
    })
  }

  return { attachmentRows, uploadedPaths }
}

export default function ReimbursementClaimPage({
  eyebrow = 'HRGA',
  title = 'Reimbursement Claim',
  selfOnly = false,
  showSummary = true,
  showSummaryBreakdown = true,
  showSummaryMonthFilter = true,
  allowBatchCreation = true,
  allowHrgaApproverView = false,
  showHeader = true,
  showToolbar = true,
  compactToolbar = false,
  showAccountInfo = true,
  showGroupFilterOnly = false,
  initialGroupFilter = '',
  initialRequesterFilter = '',
  onRequesterOptionsChange = null,
  tableView = false,
} = {}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [claims, setClaims] = useState([])
  const [categories, setCategories] = useState([])
  const [profile, setProfile] = useState(null)
  const [access, setAccess] = useState({
    reimbursementView: false,
    reimbursementSubmit: false,
    reimbursementApprove: false,
    reimbursementPay: false,
  })
  const [search, setSearch] = useState('')
  const [requesterFilter, setRequesterFilter] = useState(initialRequesterFilter)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState(initialGroupFilter)
  const [monthFilter, setMonthFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchRows, setBatchRows] = useState([createDraftRow()])
  const [activeBatchRowId, setActiveBatchRowId] = useState('')
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [selectedApprovedGroup, setSelectedApprovedGroup] = useState(null)
  const [selectedPaidGroup, setSelectedPaidGroup] = useState(null)
  const [selectedSubmittedClaimIds, setSelectedSubmittedClaimIds] = useState([])
  const [selectedApprovedClaimIds, setSelectedApprovedClaimIds] = useState([])
  const [selectedApprovedGroupKeys, setSelectedApprovedGroupKeys] = useState([])
  const [editingClaim, setEditingClaim] = useState(null)
  const [editDraft, setEditDraft] = useState(null)
  const [editFiles, setEditFiles] = useState([])
  const [paymentFiles, setPaymentFiles] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionError, setActionError] = useState('')
  const [revisionComment, setRevisionComment] = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [imagePreviewZoom, setImagePreviewZoom] = useState(1)
  const [imagePreviewTool, setImagePreviewTool] = useState('zoom-in')
  const [imagePreviewOrigin, setImagePreviewOrigin] = useState({ x: 50, y: 50 })
  const [imagePreviewOffset, setImagePreviewOffset] = useState({ x: 0, y: 0 })
  const [tableNames, setTableNames] = useState(HRGA_REIMBURSEMENT_TABLES)
  const submissionFileInputRef = useRef(null)
  const editSubmissionFileInputRef = useRef(null)
  const paymentFileInputRef = useRef(null)
  const imagePreviewDragRef = useRef(null)

  function resetImagePreviewState() {
    setImagePreview(null)
    setImagePreviewZoom(1)
    setImagePreviewTool('zoom-in')
    setImagePreviewOrigin({ x: 50, y: 50 })
    setImagePreviewOffset({ x: 0, y: 0 })
    imagePreviewDragRef.current = null
  }

  const loadWorkspace = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError('')
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      setError(authError.message)
      if (!silent) setLoading(false)
      return
    }

    if (!user) {
      setError('You need to sign in again to open reimbursement claims.')
      if (!silent) setLoading(false)
      return
    }

    const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL
    const { data: profileRow, error: profileError } = await getProfileByAuthenticatedUser(
      supabase,
      user,
      'id, authenticated_id, display_name, role, reimbursement_bank_name, reimbursement_account_name, reimbursement_account_number'
    )

    if (profileError) {
      setError(profileError.message)
      if (!silent) setLoading(false)
      return
    }

    const normalizedProfile = normalizeProfile(profileRow, user)
    const role = resolveRole(normalizedProfile.role, isAdmin)

    const { error: hrgaClaimProbeError } = await supabase.from(HRGA_REIMBURSEMENT_TABLES.claims).select('id').limit(1)
    const resolvedTables = hrgaClaimProbeError?.code === '42P01' ? LEGACY_REIMBURSEMENT_TABLES : HRGA_REIMBURSEMENT_TABLES

    const [{ data: rolePermissions, error: permissionError }, { data: categoryRows, error: categoryError }, { data: claimRows, error: claimError }] =
      await Promise.all([
        supabase.from('dir_user_roles').select('permission_code').eq('role', role),
        supabase.from('dir_reimbursement_categories').select('id, name, is_active').order('id', { ascending: true }),
        supabase
          .from(resolvedTables.claims)
          .select(
            `
              id,
              claim_number,
              employee_authenticated_id,
              employee_email_snapshot,
              employee_name_snapshot,
              expense_date,
              expense_category_id,
              status,
              description,
              "group",
              comments,
              total_amount,
              payee_type,
              payee_authenticated_id,
              payee_bank_name,
              payee_account_name,
              payee_account_number,
              submitted_at,
              approved_at,
              paid_at,
              created_by,
              approved_by,
              paid_by,
              created_at,
              updated_at,
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
          .order('submitted_at', { ascending: true }),
      ])

    if (permissionError || categoryError || claimError) {
      setError(permissionError?.message || categoryError?.message || claimError?.message || 'Failed to load reimbursement workspace.')
      if (!silent) setLoading(false)
      return
    }

    const permissions = Array.from(expandImpliedPermissions((rolePermissions || []).map((item) => item.permission_code)))
    const resolvedAccess = getArklineFeatureAccess(role, permissions, isAdmin)
    setTableNames(resolvedTables)

    setAccess(resolvedAccess)
    setProfile(normalizedProfile)
    setCategories((categoryRows || []).filter((item) => item.is_active !== false))
    setClaims((claimRows || []).map(normalizeClaim))
    if (!silent) setLoading(false)
  }, [])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  useEffect(() => {
    setGroupFilter(initialGroupFilter || '')
  }, [initialGroupFilter])

  useEffect(() => {
    setRequesterFilter(initialRequesterFilter || '')
  }, [initialRequesterFilter])

  useEffect(() => {
    setSelectedSubmittedClaimIds((prev) => prev.filter((id) => claims.some((item) => item.id === id && item.status === 'SUBMITTED')))
  }, [claims])

  useEffect(() => {
    setSelectedApprovedClaimIds((prev) => prev.filter((id) => claims.some((item) => item.id === id && item.status === 'APPROVED')))
  }, [claims])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (showBatchModal || editingClaim || selectedClaim || selectedApprovedGroup || selectedPaidGroup || saving || actionLoading) return
      void loadWorkspace(true)
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [actionLoading, editingClaim, loadWorkspace, saving, selectedApprovedGroup, selectedClaim, selectedPaidGroup, showBatchModal])

  const isClaimOwner = useCallback((claim) => {
    const currentEmail = String(profile?.email || '').toLowerCase()
    if (!currentEmail) return false
    return [claim?.created_by, claim?.employee_email_snapshot].some((value) => String(value || '').toLowerCase() === currentEmail)
  }, [profile])

  const visibleClaims = useMemo(
    () =>
      claims.filter((item) => {
        if (selfOnly) {
          return isClaimOwner(item)
        }
        if (item.status !== 'SUBMITTED') return true
        if (isClaimOwner(item)) return true
        return access.reimbursementApprove
      }),
    [access.reimbursementApprove, claims, isClaimOwner, selfOnly]
  )

  const filteredClaims = useMemo(() => {
    const keyword = search.trim().toUpperCase()
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    return visibleClaims.filter((item) => {
      const matchesKeyword =
        !keyword ||
        [
          item.claim_number,
          item.employee_name_snapshot,
          item.employee_email_snapshot,
          item.expense_category_name,
          item.description,
          item.payee_account_name,
          item.payee_account_number,
        ]
          .filter(Boolean)
          .join(' ')
          .toUpperCase()
          .includes(keyword)

      const matchesRequester =
        !requesterFilter ||
        String(item.employee_name_snapshot || item.employee_email_snapshot || '')
          .trim()
          .toUpperCase()
          .includes(String(requesterFilter || '').trim().toUpperCase())

      const matchesCategory = !categoryFilter || item.expense_category_id === categoryFilter
      const matchesGroup = !groupFilter || String(item.group || '').toUpperCase() === groupFilter
      const referenceDate = getClaimReferenceDate(item)
      const matchesMonth = !monthFilter || (referenceDate ? String(referenceDate.getMonth() + 1).padStart(2, '0') === monthFilter : false)
      const matchesYear = !yearFilter || (referenceDate ? String(referenceDate.getFullYear()) === yearFilter : false)
      const withinRecentPaidWindow =
        item.status !== 'PAID' || monthFilter || yearFilter || (referenceDate ? referenceDate >= sevenDaysAgo : false)

      return matchesKeyword && matchesRequester && matchesCategory && matchesGroup && matchesMonth && matchesYear && withinRecentPaidWindow
    })
  }, [categoryFilter, groupFilter, monthFilter, requesterFilter, search, visibleClaims, yearFilter])

  const groupFilterOptions = useMemo(
    () =>
      Array.from(new Set(visibleClaims.map((item) => String(item.group || '').trim().toUpperCase()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [visibleClaims]
  )

  const requesterFilterOptions = useMemo(
    () =>
      Array.from(
        new Set(
          visibleClaims
            .map((item) => String(item.employee_name_snapshot || item.employee_email_snapshot || '').trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [visibleClaims]
  )

  useEffect(() => {
    if (typeof onRequesterOptionsChange === 'function') {
      onRequesterOptionsChange(requesterFilterOptions)
    }
  }, [onRequesterOptionsChange, requesterFilterOptions])

  const yearFilterOptions = useMemo(
    () =>
      Array.from(
        new Set(
          visibleClaims
            .map((item) => {
              const date = getClaimReferenceDate(item)
              return date ? String(date.getFullYear()) : ''
            })
            .filter(Boolean)
        )
      ).sort((a, b) => Number(b) - Number(a)),
    [visibleClaims]
  )

  const monthFilterOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const value = String(index + 1).padStart(2, '0')
        const label = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(new Date(2024, index, 1))
        return { value, label }
      }),
    []
  )

  const summaryClaims = useMemo(() => {
    if (!showSummaryMonthFilter) return filteredClaims
    return visibleClaims
  }, [filteredClaims, showSummaryMonthFilter, visibleClaims])

  const summary = useMemo(
    () => ({
      total: summaryClaims.length,
      totalAmount: summaryClaims.reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
      totalPaidAmount: summaryClaims.filter((item) => item.status === 'PAID').reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
      submitted: summaryClaims.filter((item) => item.status === 'SUBMITTED').length,
      needRevision: summaryClaims.filter((item) => item.status === 'NEED_REVISION').length,
      approved: summaryClaims.filter((item) => item.status === 'APPROVED').length,
      paid: summaryClaims.filter((item) => item.status === 'PAID').length,
    }),
    [summaryClaims]
  )

  const claimColumns = useMemo(
    () => {
      const approvedClaims = filteredClaims.filter((item) => item.status === 'APPROVED')
      const approvedGroups = Array.from(
        approvedClaims.reduce((map, item) => {
          const key = buildPayeeGroupKey(item)
          const existing = map.get(key)

          if (existing) {
            existing.claims.push(item)
            existing.total_amount += Number(item.total_amount || 0)
            return map
          }

          map.set(key, {
            key,
            payee_bank_name: item.payee_bank_name || '',
            payee_account_name: item.payee_account_name || '',
            payee_account_number: item.payee_account_number || '',
            payee_label: buildPayeeGroupLabel(item),
            total_amount: Number(item.total_amount || 0),
            claims: [item],
          })
          return map
        }, new Map()).values()
      )

      return [
        {
          key: 'SUBMITTED',
          label: 'Submitted',
          items: filteredClaims.filter((item) => item.status === 'SUBMITTED' || item.status === 'NEED_REVISION'),
          badgeCount: filteredClaims.filter((item) => item.status === 'SUBMITTED' || item.status === 'NEED_REVISION').length,
        },
        {
          key: 'APPROVED',
          label: 'Approved',
          items: approvedGroups,
          badgeCount: approvedClaims.length,
        },
        {
          key: 'PAID',
          label: 'Paid',
          items: Array.from(
            filteredClaims
              .filter((item) => item.status === 'PAID')
              .reduce((map, item) => {
                const key = buildPaidBatchKey(item)
                const existing = map.get(key)

                if (existing) {
                  existing.claims.push(item)
                  existing.total_amount += Number(item.total_amount || 0)
                  return map
                }

                map.set(key, {
                  key,
                  paid_at: item.paid_at || '',
                  payee_bank_name: item.payee_bank_name || '',
                  payee_account_name: item.payee_account_name || '',
                  payee_account_number: item.payee_account_number || '',
                  payee_label: buildPayeeGroupLabel(item),
                  total_amount: Number(item.total_amount || 0),
                  claims: [item],
                })
                return map
              }, new Map())
              .values()
          ),
          badgeCount: filteredClaims.filter((item) => item.status === 'PAID').length,
        },
      ]
    },
    [filteredClaims]
  )

  useEffect(() => {
    const approvedGroupKeys = new Set(
      (claimColumns.find((column) => column.key === 'APPROVED')?.items || []).map((item) => item.key).filter(Boolean)
    )
    setSelectedApprovedGroupKeys((prev) => prev.filter((key) => approvedGroupKeys.has(key)))
  }, [claimColumns])

  function openBatchModal() {
    const firstRow = createDraftRow()
    setBatchRows([firstRow])
    setActiveBatchRowId(firstRow.localId)
    setShowBatchModal(true)
    setError('')
    setSuccess('')
  }

  function closeBatchModal() {
    if (saving) return
    setShowBatchModal(false)
    setBatchRows([createDraftRow()])
    setActiveBatchRowId('')
  }

  function addBatchRow() {
    const nextRow = createDraftRow()
    setBatchRows((prev) => [...prev, nextRow])
    setActiveBatchRowId(nextRow.localId)
  }

  function removeBatchRow(localId) {
    setBatchRows((prev) => {
      if (prev.length === 1) return prev
      const nextRows = prev.filter((item) => item.localId !== localId)
      if (activeBatchRowId === localId) {
        setActiveBatchRowId(nextRows[0]?.localId || '')
      }
      return nextRows
    })
  }

  function updateBatchRow(localId, patch) {
    setBatchRows((prev) => prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item)))
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

  function removeSubmissionFile(localId, targetIndex) {
    setBatchRows((prev) =>
      prev.map((item) =>
        item.localId === localId
          ? {
              ...item,
              submission_files: item.submission_files.filter((_, index) => index !== targetIndex),
            }
          : item
      )
    )
  }

  function appendPaymentFiles(files) {
    setPaymentFiles((prev) => [...prev, ...files])
  }

  function removePaymentFile(targetIndex) {
    setPaymentFiles((prev) => prev.filter((_, index) => index !== targetIndex))
  }

  function openClaimModal(claim) {
    setSelectedClaim(claim)
    setSelectedApprovedGroup(null)
    setPaymentFiles([])
    setActionError('')
    setRevisionComment(claim?.comments || '')
  }

  function closeClaimModal() {
    if (actionLoading) return
    setSelectedClaim(null)
    setPaymentFiles([])
    setActionError('')
    setRevisionComment('')
  }

  function openApprovedGroupModal(group) {
    setSelectedApprovedGroup(group)
    setSelectedClaim(null)
    setSelectedPaidGroup(null)
    setPaymentFiles([])
    setActionError('')
  }

  function closeApprovedGroupModal() {
    if (actionLoading) return
    setSelectedApprovedGroup(null)
    setPaymentFiles([])
    setActionError('')
  }

  function openPaidGroupModal(group) {
    setSelectedPaidGroup(group)
    setSelectedClaim(null)
    setSelectedApprovedGroup(null)
    setPaymentFiles([])
    setActionError('')
  }

  function closePaidGroupModal() {
    if (actionLoading) return
    setSelectedPaidGroup(null)
    setPaymentFiles([])
    setActionError('')
  }

  function openEditClaimModal(claim) {
    setEditingClaim(claim)
    setEditDraft({
      expense_date: claim.expense_date || '',
      expense_category_id: claim.expense_category_id || '',
      total_amount: String(claim.total_amount || ''),
      payee_type: claim.payee_type || 'SELF_ACCOUNT',
      payee_bank_name: claim.payee_bank_name || '',
      payee_account_name: claim.payee_account_name || '',
      payee_account_number: claim.payee_account_number || '',
      description: claim.description || '',
    })
    setEditFiles([])
    setActionError('')
  }

  function closeEditClaimModal() {
    if (actionLoading) return
    setEditingClaim(null)
    setEditDraft(null)
    setEditFiles([])
    setActionError('')
  }

  async function handleSaveBatch() {
    setError('')
    setSuccess('')

    if (!profile?.id) {
      setError('Your profile is not ready yet. Please refresh and try again.')
      return
    }

    if (!batchRows.length) {
      setError('Add at least one reimbursement row before saving.')
      return
    }

    for (const [index, row] of batchRows.entries()) {
      if (!row.expense_date || !row.expense_category_id || !row.total_amount) {
        setError(`Row ${index + 1} still needs expense date, category, and total amount.`)
        return
      }

      if (Number(row.total_amount) <= 0) {
        setError(`Row ${index + 1} must have a total amount above zero.`)
        return
      }

      if (row.payee_type === 'SELF_ACCOUNT') {
        if (!profile.reimbursement_account_name || !profile.reimbursement_account_number) {
          setError('Your reimbursement account is incomplete. Please update it first on the Profile page.')
          return
        }
      }

      if (row.payee_type === 'OTHER_ACCOUNT' && (!row.payee_account_name.trim() || !row.payee_account_number.trim())) {
        setError(`Row ${index + 1} needs account name and account number for other-account payment.`)
        return
      }
    }

    setSaving(true)
    const createdClaimIds = []
    const uploadedPaths = []

    try {
      for (const row of batchRows) {
        const normalizedBankName = normalizeUppercaseText(row.payee_bank_name).trim()
        const normalizedAccountName = normalizeAccountName(row.payee_account_name).trim()
        const normalizedAccountNumber = normalizeAccountNumber(row.payee_account_number).trim()

        const payload = {
          employee_authenticated_id: profile.authenticated_id || null,
          employee_email_snapshot: profile.email || null,
          employee_name_snapshot: profile.display_name || null,
          expense_date: row.expense_date,
          expense_category_id: Number(row.expense_category_id),
          status: 'SUBMITTED',
          description: row.description.trim() || null,
          total_amount: Number(row.total_amount),
          payee_type: row.payee_type,
          payee_authenticated_id: row.payee_type === 'SELF_ACCOUNT' ? profile.authenticated_id || null : null,
          payee_bank_name:
            row.payee_type === 'SELF_ACCOUNT'
              ? profile.reimbursement_bank_name || null
              : normalizedBankName || null,
          payee_account_name:
            row.payee_type === 'SELF_ACCOUNT'
              ? profile.reimbursement_account_name || null
              : normalizedAccountName || null,
          payee_account_number:
            row.payee_type === 'SELF_ACCOUNT'
              ? profile.reimbursement_account_number || null
              : normalizedAccountNumber || null,
          submitted_at: new Date().toISOString(),
          created_by: profile.email || null,
        }

        const { data: insertedClaim, error: insertError } = await supabase
          .from(tableNames.claims)
          .insert(payload)
          .select(
            `
              id,
              claim_number,
              employee_authenticated_id,
              employee_email_snapshot,
              employee_name_snapshot,
              expense_date,
              expense_category_id,
              status,
              description,
              total_amount,
              payee_type,
              payee_authenticated_id,
              payee_bank_name,
              payee_account_name,
              payee_account_number,
              submitted_at,
              approved_at,
              paid_at,
              created_by,
              approved_by,
              paid_by,
              created_at,
              updated_at,
              category:dir_reimbursement_categories(id, name),
              attachments:${tableNames.attachments}(
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
          .single()

        if (insertError) {
          throw new Error(insertError.message)
        }

        createdClaimIds.push(insertedClaim.id)

        const uploadResult = await uploadClaimFiles({
          claimId: insertedClaim.id,
          claimNumber: insertedClaim.claim_number,
          files: row.submission_files,
          folder: 'submission',
          uploadedBy: profile.email,
        })

        uploadedPaths.push(...uploadResult.uploadedPaths)

        const { error: attachmentInsertError } = await supabase.from(tableNames.attachments).insert(uploadResult.attachmentRows)

        if (attachmentInsertError) {
          throw new Error(attachmentInsertError.message)
        }
      }

      setShowBatchModal(false)
      setBatchRows([createDraftRow()])
      setSuccess(`${batchRows.length} reimbursement claim${batchRows.length > 1 ? 's' : ''} submitted.`)
      await loadWorkspace()
    } catch (saveError) {
      if (uploadedPaths.length) {
        await supabase.storage.from(REIMBURSEMENT_BUCKET).remove(uploadedPaths)
      }

      if (createdClaimIds.length) {
        await supabase.from(tableNames.claims).delete().in('id', createdClaimIds)
      }

      setError(saveError.message || 'Failed to save reimbursement claims.')
    } finally {
      setSaving(false)
    }
  }

  async function handleApproveClaim(claim) {
    setActionLoading(true)
    setActionError('')
    setSuccess('')

    const { error: updateError } = await supabase
      .from(tableNames.claims)
      .update({
        status: 'APPROVED',
        approved_at: new Date().toISOString(),
        approved_by: profile?.email || null,
        comments: null,
      })
      .eq('id', claim.id)

    if (updateError) {
      setActionError(updateError.message)
      setActionLoading(false)
      return
    }

    setSuccess(`Claim ${claim.claim_number} approved.`)
    setActionLoading(false)
    closeClaimModal()
    await loadWorkspace()
  }

  async function handleRequestRevision(claim) {
    const normalizedComment = String(revisionComment || '').trim()
    if (!normalizedComment) {
      setActionError('Please add revision comments first.')
      return
    }

    setActionLoading(true)
    setActionError('')
    setSuccess('')

    const { error: updateError } = await supabase
      .from(tableNames.claims)
      .update({
        status: 'NEED_REVISION',
        comments: normalizedComment,
        approved_at: null,
        approved_by: null,
      })
      .eq('id', claim.id)

    if (updateError) {
      setActionError(updateError.message)
      setActionLoading(false)
      return
    }

    setSuccess(`Claim ${claim.claim_number} marked as need revision.`)
    setActionLoading(false)
    closeClaimModal()
    await loadWorkspace()
  }

  async function handleApproveSelectedClaims() {
    const targetClaims = filteredClaims.filter((item) => selectedSubmittedClaimIds.includes(item.id) && item.status === 'SUBMITTED')
    if (!targetClaims.length) return

    setActionLoading(true)
    setActionError('')
    setSuccess('')

    const { error: updateError } = await supabase
      .from(tableNames.claims)
      .update({
        status: 'APPROVED',
        approved_at: new Date().toISOString(),
        approved_by: profile?.email || null,
        comments: null,
      })
      .in('id', targetClaims.map((item) => item.id))

    if (updateError) {
      setActionError(updateError.message)
      setActionLoading(false)
      return
    }

    setSuccess(`${targetClaims.length} claim${targetClaims.length > 1 ? 's' : ''} approved.`)
    setSelectedSubmittedClaimIds([])
    setActionLoading(false)
    await loadWorkspace()
  }

  async function handleMarkPaidSelectedClaims() {
    const targetClaims = filteredClaims.filter((item) => selectedApprovedClaimIds.includes(item.id) && item.status === 'APPROVED')
    if (!targetClaims.length) return

    setActionLoading(true)
    setActionError('')
    setSuccess('')

    try {
      const { error: updateError } = await supabase
        .from(tableNames.claims)
        .update({
          status: 'PAID',
          paid_at: new Date().toISOString(),
          paid_by: profile?.email || null,
        })
        .in('id', targetClaims.map((item) => item.id))

      if (updateError) {
        throw new Error(updateError.message || 'Failed to mark selected claims as paid.')
      }

      setSuccess(`${targetClaims.length} claim${targetClaims.length > 1 ? 's' : ''} marked as paid.`)
      setSelectedApprovedClaimIds([])
      await loadWorkspace()
    } catch (markPaidError) {
      setActionError(markPaidError.message || 'Failed to mark selected claims as paid.')
    } finally {
      setActionLoading(false)
    }
  }

  function toggleSubmittedClaimSelection(claimId) {
    setSelectedSubmittedClaimIds((prev) => (prev.includes(claimId) ? prev.filter((item) => item !== claimId) : [...prev, claimId]))
  }

  function toggleApprovedClaimSelection(claimId) {
    setSelectedApprovedClaimIds((prev) => (prev.includes(claimId) ? prev.filter((item) => item !== claimId) : [...prev, claimId]))
  }

  function toggleSelectAllSubmittedClaims(items) {
    const submittedIds = (items || []).filter((item) => item.status === 'SUBMITTED').map((item) => item.id)
    if (!submittedIds.length) return

    const allSelected = submittedIds.every((id) => selectedSubmittedClaimIds.includes(id))
    setSelectedSubmittedClaimIds((prev) => {
      if (allSelected) {
        return prev.filter((id) => !submittedIds.includes(id))
      }
      return Array.from(new Set([...prev, ...submittedIds]))
    })
  }

  function toggleSelectAllFilteredSubmittedClaims() {
    const submittedIds = filteredClaims.filter((item) => item.status === 'SUBMITTED').map((item) => item.id)
    if (!submittedIds.length) return

    const allSelected = submittedIds.every((id) => selectedSubmittedClaimIds.includes(id))
    setSelectedSubmittedClaimIds((prev) => {
      if (allSelected) {
        return prev.filter((id) => !submittedIds.includes(id))
      }

      return Array.from(new Set([...prev, ...submittedIds]))
    })
  }

  function toggleSelectAllFilteredApprovedClaims() {
    const approvedIds = filteredClaims.filter((item) => item.status === 'APPROVED').map((item) => item.id)
    if (!approvedIds.length) return

    const allSelected = approvedIds.every((id) => selectedApprovedClaimIds.includes(id))
    setSelectedApprovedClaimIds((prev) => {
      if (allSelected) {
        return prev.filter((id) => !approvedIds.includes(id))
      }

      return Array.from(new Set([...prev, ...approvedIds]))
    })
  }

  function toggleSelectAllFilteredActionableClaims() {
    const submittedIds = filteredClaims.filter((item) => item.status === 'SUBMITTED').map((item) => item.id)
    const approvedIds = filteredClaims.filter((item) => item.status === 'APPROVED').map((item) => item.id)
    const allSubmittedSelected = !submittedIds.length || submittedIds.every((id) => selectedSubmittedClaimIds.includes(id))
    const allApprovedSelected = !approvedIds.length || approvedIds.every((id) => selectedApprovedClaimIds.includes(id))

    if (allSubmittedSelected && allApprovedSelected) {
      setSelectedSubmittedClaimIds((prev) => prev.filter((id) => !submittedIds.includes(id)))
      setSelectedApprovedClaimIds((prev) => prev.filter((id) => !approvedIds.includes(id)))
      return
    }

    setSelectedSubmittedClaimIds((prev) => Array.from(new Set([...prev, ...submittedIds])))
    setSelectedApprovedClaimIds((prev) => Array.from(new Set([...prev, ...approvedIds])))
  }

  function toggleApprovedGroupSelection(groupKey) {
    setSelectedApprovedGroupKeys((prev) => (prev.includes(groupKey) ? prev.filter((item) => item !== groupKey) : [...prev, groupKey]))
  }

  function toggleSelectAllApprovedGroups(groups) {
    const approvedKeys = (groups || []).map((item) => item.key).filter(Boolean)
    if (!approvedKeys.length) return

    const allSelected = approvedKeys.every((key) => selectedApprovedGroupKeys.includes(key))
    setSelectedApprovedGroupKeys((prev) => {
      if (allSelected) {
        return prev.filter((key) => !approvedKeys.includes(key))
      }

      return Array.from(new Set([...prev, ...approvedKeys]))
    })
  }

  async function handleSaveEditClaim() {
    if (!editingClaim || !editDraft) return

    setActionLoading(true)
    setActionError('')
    setSuccess('')

    if (!editDraft.expense_date || !editDraft.expense_category_id || !editDraft.total_amount) {
      setActionError('Expense date, category, and total amount are required.')
      setActionLoading(false)
      return
    }

    if (Number(editDraft.total_amount) <= 0) {
      setActionError('Total amount must be above zero.')
      setActionLoading(false)
      return
    }

    if (editDraft.payee_type === 'SELF_ACCOUNT' && (!profile?.reimbursement_account_name || !profile?.reimbursement_account_number)) {
      setActionError('Your reimbursement account is incomplete. Please update it first on the Profile page.')
      setActionLoading(false)
      return
    }

    if (
      editDraft.payee_type === 'OTHER_ACCOUNT' &&
      (!String(editDraft.payee_account_name || '').trim() || !String(editDraft.payee_account_number || '').trim())
    ) {
      setActionError('Account name and account number are required for other-account payment.')
      setActionLoading(false)
      return
    }

    const normalizedBankName = normalizeUppercaseText(editDraft.payee_bank_name).trim()
    const normalizedAccountName = normalizeAccountName(editDraft.payee_account_name).trim()
    const normalizedAccountNumber = normalizeAccountNumber(editDraft.payee_account_number).trim()

    const payload = {
      expense_date: editDraft.expense_date,
      expense_category_id: Number(editDraft.expense_category_id),
      description: String(editDraft.description || '').trim() || null,
      total_amount: Number(editDraft.total_amount),
      payee_type: editDraft.payee_type,
      payee_authenticated_id: editDraft.payee_type === 'SELF_ACCOUNT' ? profile?.authenticated_id || null : null,
      payee_bank_name:
        editDraft.payee_type === 'SELF_ACCOUNT'
          ? profile?.reimbursement_bank_name || null
          : normalizedBankName || null,
      payee_account_name:
        editDraft.payee_type === 'SELF_ACCOUNT'
          ? profile?.reimbursement_account_name || null
          : normalizedAccountName || null,
      payee_account_number:
        editDraft.payee_type === 'SELF_ACCOUNT'
          ? profile?.reimbursement_account_number || null
          : normalizedAccountNumber || null,
      ...(editingClaim.status === 'NEED_REVISION' ? { status: 'SUBMITTED', comments: null } : {}),
    }

    const uploadedPaths = []

    try {
      const { error: updateError } = await supabase.from(tableNames.claims).update(payload).eq('id', editingClaim.id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      if (editFiles.length) {
        const uploadResult = await uploadClaimFiles({
          claimId: editingClaim.id,
          claimNumber: editingClaim.claim_number,
          files: editFiles,
          folder: 'submission',
          uploadedBy: profile?.email || null,
        })

        uploadedPaths.push(...uploadResult.uploadedPaths)

        const { error: attachmentInsertError } = await supabase.from(tableNames.attachments).insert(uploadResult.attachmentRows)

        if (attachmentInsertError) {
          throw new Error(attachmentInsertError.message)
        }
      }

      setSuccess(`Claim ${editingClaim.claim_number} updated.`)
      closeEditClaimModal()
      closeClaimModal()
      await loadWorkspace()
    } catch (editError) {
      if (uploadedPaths.length) {
        await supabase.storage.from(REIMBURSEMENT_BUCKET).remove(uploadedPaths)
      }
      setActionError(editError.message || 'Failed to update reimbursement claim.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleMarkPaid(claim) {
    setActionLoading(true)
    setActionError('')
    setSuccess('')

    const uploadedPaths = []

    try {
      if (paymentFiles.length) {
        const uploadResult = await uploadClaimFiles({
          claimId: claim.id,
          claimNumber: claim.claim_number,
          files: paymentFiles,
          folder: 'payment',
          uploadedBy: profile?.email || null,
        })

        uploadedPaths.push(...uploadResult.uploadedPaths)

        const { error: attachmentInsertError } = await supabase.from(tableNames.attachments).insert(uploadResult.attachmentRows)

        if (attachmentInsertError) {
          throw new Error(attachmentInsertError.message)
        }
      }

      const { error: updateError } = await supabase
        .from(tableNames.claims)
        .update({
          status: 'PAID',
          paid_at: new Date().toISOString(),
          paid_by: profile?.email || null,
        })
        .eq('id', claim.id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      setSuccess(`Claim ${claim.claim_number} marked as paid.`)
      setPaymentFiles([])
      closeClaimModal()
      await loadWorkspace()
    } catch (paymentError) {
      if (uploadedPaths.length) {
        await supabase.storage.from(REIMBURSEMENT_BUCKET).remove(uploadedPaths)
      }

      if (uploadedPaths.length) {
        await supabase.from(tableNames.attachments).delete().eq('claim_id', claim.id).in('storage_path', uploadedPaths)
      }

      setActionError(paymentError.message || 'Failed to upload payment proof.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleMarkPaidGroup(group) {
    if (!group?.claims?.length) return

    setActionLoading(true)
    setActionError('')
    setSuccess('')

    const uploadedPaths = []

    try {
      if (paymentFiles.length) {
        for (const claim of group.claims) {
          const uploadResult = await uploadClaimFiles({
            claimId: claim.id,
            claimNumber: claim.claim_number,
            files: paymentFiles,
            folder: 'payment',
            uploadedBy: profile?.email || null,
          })

          uploadedPaths.push(...uploadResult.uploadedPaths)

          const { error: attachmentInsertError } = await supabase.from(tableNames.attachments).insert(uploadResult.attachmentRows)

          if (attachmentInsertError) {
            throw new Error(attachmentInsertError.message)
          }
        }
      }

      const claimIds = group.claims.map((item) => item.id)
      const { error: updateError } = await supabase
        .from(tableNames.claims)
        .update({
          status: 'PAID',
          paid_at: new Date().toISOString(),
          paid_by: profile?.email || null,
        })
        .in('id', claimIds)

      if (updateError) {
        throw new Error(updateError.message)
      }

      setSuccess(`${group.claims.length} approved claim${group.claims.length > 1 ? 's' : ''} marked as paid.`)
      setPaymentFiles([])
      closeApprovedGroupModal()
      await loadWorkspace()
    } catch (paymentError) {
      if (uploadedPaths.length) {
        await supabase.storage.from(REIMBURSEMENT_BUCKET).remove(uploadedPaths)
        await supabase.from(tableNames.attachments).delete().in('storage_path', uploadedPaths)
      }

      setActionError(paymentError.message || 'Failed to upload payment proof for this account batch.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleMarkPaidSelectedGroups(groups) {
    const targetGroups = (groups || []).filter((group) => selectedApprovedGroupKeys.includes(group.key))
    if (!targetGroups.length) return

    const claimIds = targetGroups.flatMap((group) => group.claims.map((item) => item.id))
    if (!claimIds.length) return

    setActionLoading(true)
    setActionError('')
    setSuccess('')

    try {
      const { error: updateError } = await supabase
        .from(tableNames.claims)
        .update({
          status: 'PAID',
          paid_at: new Date().toISOString(),
          paid_by: profile?.email || null,
        })
        .in('id', claimIds)

      if (updateError) {
        throw new Error(updateError.message || 'Failed to mark selected approved groups as paid.')
      }

      setSuccess(`${claimIds.length} claim${claimIds.length > 1 ? 's' : ''} marked as paid.`)
      setSelectedApprovedGroupKeys([])
      await loadWorkspace()
    } catch (markPaidError) {
      setActionError(markPaidError.message || 'Failed to mark selected approved groups as paid.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDeleteClaim(claim) {
    if (!claim || claim.status !== 'SUBMITTED' || !isClaimOwner(claim)) return

    setActionLoading(true)
    setActionError('')
    setSuccess('')

    const storagePaths = (claim.attachments || []).map((item) => item.storage_path).filter(Boolean)

    try {
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
      closeEditClaimModal()
      closeClaimModal()
      await loadWorkspace()
    } catch (deleteClaimError) {
      setActionError(deleteClaimError.message || 'Failed to delete reimbursement claim.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleOpenAttachment(attachment) {
    setActionError('')

    const { data, error: signedUrlError } = await supabase.storage
      .from(attachment.storage_bucket)
      .createSignedUrl(attachment.storage_path, 300)

    if (signedUrlError) {
      setActionError(signedUrlError.message)
      return
    }

    if (data?.signedUrl) {
      if (isPreviewableImageAttachment(attachment)) {
        setImagePreview({
          src: data.signedUrl,
          name: attachment.file_name,
        })
        setImagePreviewZoom(1)
        setImagePreviewTool('zoom-in')
        setImagePreviewOrigin({ x: 50, y: 50 })
        setImagePreviewOffset({ x: 0, y: 0 })
        return
      }

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    }
  }

  function handleImagePreviewWrapClick(event) {
    if (imagePreviewTool === 'pan') {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 100
    const y = ((event.clientY - bounds.top) / bounds.height) * 100

    setImagePreviewOrigin({
      x: Number.isFinite(x) ? x : 50,
      y: Number.isFinite(y) ? y : 50,
    })

    if (imagePreviewTool === 'zoom-in') {
      setImagePreviewZoom((currentZoom) => Math.min(4, Number((currentZoom + 0.35).toFixed(2))))
      return
    }

    setImagePreviewZoom((currentZoom) => {
      const nextZoom = Math.max(1, Number((currentZoom - 0.35).toFixed(2)))
      if (nextZoom === 1) {
        setImagePreviewOffset({ x: 0, y: 0 })
      }
      return nextZoom
    })
  }

  function handleImagePreviewPointerDown(event) {
    if (imagePreviewTool !== 'pan' || imagePreviewZoom <= 1) {
      return
    }

    imagePreviewDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      offsetX: imagePreviewOffset.x,
      offsetY: imagePreviewOffset.y,
    }

    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handleImagePreviewPointerMove(event) {
    const dragState = imagePreviewDragRef.current
    if (!dragState || imagePreviewTool !== 'pan' || imagePreviewZoom <= 1) {
      return
    }

    const deltaX = event.clientX - dragState.startX
    const deltaY = event.clientY - dragState.startY

    setImagePreviewOffset({
      x: dragState.offsetX + deltaX,
      y: dragState.offsetY + deltaY,
    })
  }

  function handleImagePreviewPointerUp(event) {
    if (imagePreviewDragRef.current) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
    imagePreviewDragRef.current = null
  }

  const canView = selfOnly ? true : access.reimbursementView
  const canSubmit = allowBatchCreation && (selfOnly ? true : access.reimbursementSubmit)
  const canApprove = access.reimbursementApprove
  const canPay = access.reimbursementPay
  const activeBatchRow = batchRows.find((item) => item.localId === activeBatchRowId) || batchRows[0] || null
  const batchTotalAmount = batchRows.reduce((sum, item) => sum + Number(item.total_amount || 0), 0)

  return (
    <div className={styles.directorySection}>
      {showHeader ? (
        <div className={styles.sectionHeader}>
          <div>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            <h1 className={styles.sectionTitle}>{title}</h1>
          </div>

          {canSubmit ? (
            <div className={styles.buttonRow}>
              <button type="button" className={styles.primaryButton} onClick={openBatchModal}>
                + New Claim Batch
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {showToolbar ? (
        <div
          className={styles.toolbar}
          style={
            compactToolbar
              ? {
                  display: 'grid',
                  gridTemplateColumns: showGroupFilterOnly ? 'minmax(220px, 0.9fr) auto' : 'minmax(180px, 1.1fr) repeat(4, minmax(0, 0.9fr)) auto',
                  alignItems: 'end',
                  gap: '10px',
                }
              : undefined
          }
        >
          {!showGroupFilterOnly ? (
            <>
              <div className={styles.field} style={compactToolbar ? { minWidth: 0 } : undefined}>
                <input
                  className={styles.input}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search claim number, employee, category, or description"
                />
              </div>

              <div className={styles.field} style={compactToolbar ? { minWidth: 0 } : undefined}>
                <select className={styles.select} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="">All categories</option>
                  {categories.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field} style={compactToolbar ? { minWidth: 0 } : undefined}>
                <select className={styles.select} value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
                  <option value="">All groups</option>
                  {groupFilterOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field} style={compactToolbar ? { minWidth: 0 } : undefined}>
                <select className={styles.select} value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
                  <option value="">All months</option>
                  {monthFilterOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field} style={compactToolbar ? { minWidth: 0 } : undefined}>
                <select className={styles.select} value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                  <option value="">All years</option>
                  {yearFilterOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className={styles.field} style={compactToolbar ? { minWidth: 0 } : undefined}>
              <select className={styles.select} value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
                <option value="">All groups</option>
                {groupFilterOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.buttonRow}>
            {tableView && canApprove ? (
              <>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={toggleSelectAllFilteredSubmittedClaims}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => void handleApproveSelectedClaims()}
                  disabled={actionLoading || !selectedSubmittedClaimIds.length}
                >
                  {actionLoading ? 'Saving...' : `Approve${selectedSubmittedClaimIds.length ? ` (${selectedSubmittedClaimIds.length})` : ''}`}
                </button>
              </>
            ) : null}
            {tableView && canPay ? (
              <>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={toggleSelectAllFilteredApprovedClaims}
                >
                  Select All Approved
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => void handleMarkPaidSelectedClaims()}
                  disabled={actionLoading || !selectedApprovedClaimIds.length}
                >
                  {actionLoading ? 'Saving...' : `Mark as Paid${selectedApprovedClaimIds.length ? ` (${selectedApprovedClaimIds.length})` : ''}`}
                </button>
              </>
            ) : null}
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => {
                setSearch('')
                setGroupFilter('')
                if (!showGroupFilterOnly) {
                  setCategoryFilter('')
                  setMonthFilter('')
                  setYearFilter('')
                }
              }}
            >
              Reset
            </button>
          </div>
        </div>
      ) : null}

      {showSummary ? (
        <div className={`${styles.materialFulfillmentSummaryRow} ${styles.reimbursementSummaryRow}`.trim()}>
          <div className={styles.materialFulfillmentStat}>
            <span>Number of Claims</span>
            <strong>{summary.total}</strong>
          </div>
          <div className={styles.materialFulfillmentStat}>
            <span>Total Amount</span>
            <strong>{formatCurrency(summary.totalAmount)}</strong>
          </div>
          <div className={styles.materialFulfillmentStat}>
            <span>Total Paid</span>
            <strong>{formatCurrency(summary.totalPaidAmount)}</strong>
          </div>
          {showSummaryBreakdown ? (
            <>
              <div className={styles.materialFulfillmentStat}>
                <span>Submitted</span>
                <strong>{summary.submitted + summary.needRevision}</strong>
              </div>
              <div className={styles.materialFulfillmentStat}>
                <span>Need Revision</span>
                <strong>{summary.needRevision}</strong>
              </div>
              <div className={styles.materialFulfillmentStat}>
                <span>Approved</span>
                <strong>{summary.approved}</strong>
              </div>
              <div className={styles.materialFulfillmentStat}>
                <span>Paid</span>
                <strong>{summary.paid}</strong>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {showAccountInfo && (profile?.reimbursement_account_name && profile?.reimbursement_account_number) ? (
        <div className={styles.reimbursementInfoCard}>
          <p className={styles.reimbursementInfoTitle}>Default reimbursement account</p>
          <p className={styles.reimbursementInfoText}>
            {profile.reimbursement_bank_name || 'Bank'} - {profile.reimbursement_account_name} ({profile.reimbursement_account_number})
          </p>
        </div>
      ) : showAccountInfo ? (
        <div className={styles.materialFulfillmentNote}>
          Your profile does not have a reimbursement account yet. Please register it with admin or HRD before using the &quot;own account&quot; payment option.
        </div>
      ) : null}

      {error ? <p className={styles.errorText}>{error}</p> : null}
      {success ? <p className={styles.successText}>{success}</p> : null}

      {loading ? (
        <div className={styles.emptyState}>Loading reimbursement claims...</div>
      ) : !canView ? (
        <div className={styles.emptyState}>Your account does not have reimbursement access yet.</div>
      ) : !filteredClaims.length ? (
        <div className={styles.emptyState}>No reimbursement claim matches the current filters.</div>
      ) : tableView ? (
        <section className={tableStyles.listSection}>
          <div className={tableStyles.columnHead}>
            <div className={tableStyles.outstandingWrap}>
              <span className={tableStyles.outstandingLabel}>Total Reimbursement</span>
              <strong className={tableStyles.outstandingValue}>{formatCurrency(filteredClaims.reduce((sum, item) => sum + Number(item.total_amount || 0), 0))}</strong>
            </div>
          </div>

          <div className={tableStyles.tableWrap}>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th className={tableStyles.checkboxColumn}>
                    <input
                      type="checkbox"
                      checked={
                        filteredClaims.filter((item) => item.status === 'SUBMITTED' || item.status === 'APPROVED').length > 0 &&
                        filteredClaims
                          .filter((item) => item.status === 'SUBMITTED' || item.status === 'APPROVED')
                          .every((item) =>
                            item.status === 'SUBMITTED'
                              ? selectedSubmittedClaimIds.includes(item.id)
                              : selectedApprovedClaimIds.includes(item.id)
                          )
                      }
                      onChange={toggleSelectAllFilteredActionableClaims}
                      disabled={!(canApprove || canPay) || !filteredClaims.some((item) => item.status === 'SUBMITTED' || item.status === 'APPROVED')}
                      aria-label="Select all actionable claims"
                    />
                  </th>
                  <th>Claim No</th>
                  <th>Expense Date</th>
                  <th>Requester</th>
                  <th>Group</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.map((item) => (
                  <tr key={item.id}>
                    <td className={tableStyles.checkboxColumn}>
                      <input
                        type="checkbox"
                        checked={item.status === 'SUBMITTED' ? selectedSubmittedClaimIds.includes(item.id) : selectedApprovedClaimIds.includes(item.id)}
                        onChange={() => {
                          if (item.status === 'SUBMITTED') {
                            toggleSubmittedClaimSelection(item.id)
                          } else if (item.status === 'APPROVED') {
                            toggleApprovedClaimSelection(item.id)
                          }
                        }}
                        disabled={(item.status === 'SUBMITTED' && !canApprove) || (item.status === 'APPROVED' && !canPay) || (item.status !== 'SUBMITTED' && item.status !== 'APPROVED')}
                        aria-label={`Select ${item.claim_number || 'claim'}`}
                      />
                    </td>
                    <td>{item.claim_number || '-'}</td>
                    <td>{formatDate(item.expense_date)}</td>
                    <td>{item.employee_name_snapshot || item.employee_email_snapshot || '-'}</td>
                    <td>{item.group || '-'}</td>
                    <td>{item.description || '-'}</td>
                    <td>{item.expense_category_name || '-'}</td>
                    <td className={tableStyles.amountCell}>{formatCurrency(item.total_amount)}</td>
                    <td>
                      <span
                        className={`${tableStyles.statusPill} ${
                          item.status === 'PAID'
                            ? tableStyles.statusPillPaid
                            : item.status === 'APPROVED'
                              ? tableStyles.statusPillApproved
                              : item.status === 'NEED_REVISION'
                                ? styles.reimbursementStatusNEED_REVISION
                                : tableStyles.statusPillSubmitted
                        }`.trim()}
                      >
                        {item.status === 'NEED_REVISION' ? 'Need Revision' : item.status === 'PAID' ? 'Paid' : item.status === 'APPROVED' ? 'Approved' : 'Submitted'}
                      </span>
                    </td>
                    <td>
                      <div className={tableStyles.actionCell}>
                        {item.status === 'SUBMITTED' && canApprove ? (
                          <button
                            type="button"
                            className={`${tableStyles.iconButton} ${tableStyles.iconButtonSuccess}`.trim()}
                            onClick={() => void handleApproveClaim(item)}
                            title="Approve claim"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="m5 12 4.2 4.2L19 6.5" />
                            </svg>
                          </button>
                        ) : null}
                        {item.status === 'APPROVED' && canPay ? (
                          <button
                            type="button"
                            className={`${tableStyles.iconButton} ${tableStyles.iconButtonSuccess}`.trim()}
                            onClick={() => void handleMarkPaid(item)}
                            title="Mark as paid"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 12h14" />
                              <path d="M12 5l7 7-7 7" />
                            </svg>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={tableStyles.iconButton}
                          onClick={() => openClaimModal(item)}
                          title="View claim"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className={styles.reimbursementBoard}>
          {claimColumns.map((column) => (
            <section key={column.key} className={styles.reimbursementColumn}>
              <div className={styles.reimbursementColumnHeader}>
                <div>
                  <p className={styles.reimbursementColumnEyebrow}>Status</p>
                  <h2 className={styles.reimbursementColumnTitle}>{column.label}</h2>
                </div>
                <div className={styles.buttonRow}>
                  {column.key === 'SUBMITTED' && canApprove ? (
                    <>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => toggleSelectAllSubmittedClaims(column.items)}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => void handleApproveSelectedClaims()}
                        disabled={actionLoading || !selectedSubmittedClaimIds.length}
                      >
                        {actionLoading ? 'Saving...' : `Approve${selectedSubmittedClaimIds.length ? ` (${selectedSubmittedClaimIds.length})` : ''}`}
                      </button>
                    </>
                  ) : null}
                  {column.key === 'APPROVED' && canPay ? (
                    <>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => toggleSelectAllApprovedGroups(column.items)}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => void handleMarkPaidSelectedGroups(column.items)}
                        disabled={actionLoading || !selectedApprovedGroupKeys.length}
                      >
                        {actionLoading ? 'Saving...' : `Mark as Paid${selectedApprovedGroupKeys.length ? ` (${selectedApprovedGroupKeys.length})` : ''}`}
                      </button>
                    </>
                  ) : null}
                  <span className={`${styles.reimbursementStatus} ${styles[`reimbursementStatus${column.key}`]}`.trim()}>
                    {column.badgeCount ?? column.items.length}
                  </span>
                </div>
              </div>

              {!column.items.length ? (
                <div className={styles.reimbursementColumnEmpty}>No claims in this status.</div>
              ) : (
                <div className={styles.reimbursementCardStack}>
                  {column.key === 'APPROVED'
                    ? column.items.map((group) => (
                        <article key={group.key} className={styles.reimbursementCard}>
                          <div className={styles.reimbursementCardTop}>
                            <div className={styles.buttonRow}>
                              <label className={styles.reimbursementSelectPill}>
                                <input
                                  type="checkbox"
                                  checked={selectedApprovedGroupKeys.includes(group.key)}
                                  onChange={() => toggleApprovedGroupSelection(group.key)}
                                />
                              </label>
                              <div>
                                <p className={styles.reimbursementCardNumber}>Approved Batch</p>
                                <h3 className={styles.cellTitle}>{group.payee_account_name || '-'}</h3>
                              </div>
                            </div>
                            <button
                              type="button"
                              className={styles.reimbursementViewButton}
                              onClick={() => openApprovedGroupModal(group)}
                              aria-label={`View approved batch for ${group.payee_account_name || 'account'}`}
                              title="View approved batch"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                          </div>

                          <p className={styles.reimbursementCardMeta}>{group.payee_bank_name || 'Bank'}</p>
                          <p className={styles.reimbursementCardMeta}>
                            {group.payee_account_number || '-'} • {group.claims.length} claim{group.claims.length > 1 ? 's' : ''}
                          </p>
                          <p className={styles.reimbursementCardAmount}>{formatCurrency(group.total_amount)}</p>
                        </article>
                      ))
                    : column.key === 'PAID'
                      ? column.items.map((group) => (
                          <article key={group.key} className={styles.reimbursementCard}>
                            <div className={styles.reimbursementCardTop}>
                              <div>
                                <p className={styles.reimbursementCardNumber}>Paid Batch</p>
                                <h3 className={styles.cellTitle}>{group.payee_account_name || '-'}</h3>
                              </div>
                              <button
                                type="button"
                                className={styles.reimbursementViewButton}
                                onClick={() => openPaidGroupModal(group)}
                                aria-label={`View paid batch for ${group.payee_account_name || 'account'}`}
                                title="View paid batch"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>
                            </div>

                            <p className={styles.reimbursementCardMeta}>{group.payee_bank_name || 'Bank'}</p>
                            <p className={styles.reimbursementCardMeta}>
                              {formatDateTime(group.paid_at)} • {group.claims.length} claim{group.claims.length > 1 ? 's' : ''}
                            </p>
                            <p className={styles.reimbursementCardAmount}>{formatCurrency(group.total_amount)}</p>
                          </article>
                        ))
                    : column.items.map((item) => (
                        <article
                          key={item.id}
                          className={`${styles.reimbursementCard} ${item.status === 'NEED_REVISION' ? styles.reimbursementCardRevision : ''}`.trim()}
                        >
                          <div className={styles.reimbursementCardTop}>
                            <div className={styles.buttonRow}>
                              {item.status === 'SUBMITTED' && canApprove ? (
                                <label className={styles.reimbursementSelectPill}>
                                  <input
                                    type="checkbox"
                                    checked={selectedSubmittedClaimIds.includes(item.id)}
                                    onChange={() => toggleSubmittedClaimSelection(item.id)}
                                  />
                                </label>
                              ) : null}
                              <div>
                                <p className={styles.reimbursementCardNumber}>{item.claim_number}</p>
                                <p className={styles.reimbursementCardMeta}>
                                  {[item.employee_name_snapshot || item.employee_email_snapshot, item.group].filter(Boolean).join(' • ')}
                                </p>
                              </div>
                            </div>
                            <div className={styles.buttonRow}>
                              <button
                                type="button"
                                className={styles.reimbursementViewButton}
                                onClick={() => openClaimModal(item)}
                                aria-label={`View ${item.claim_number}`}
                                title="View claim"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>
                              {item.status === 'SUBMITTED' && canApprove ? (
                                <button
                                  type="button"
                                  className={styles.reimbursementViewButton}
                                  onClick={() => void handleApproveClaim(item)}
                                  aria-label={`Approve ${item.claim_number}`}
                                  title="Approve claim"
                                  disabled={actionLoading}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="m5 12 4.2 4.2L19 6.5" />
                                  </svg>
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {item.comments ? <p className={styles.reimbursementCardMeta}>Comment: {item.comments}</p> : null}
                          <p className={styles.reimbursementCardDescription}>{item.description || 'No description provided.'}</p>
                          <p className={styles.reimbursementCardMeta}>{item.expense_category_name || '-'}</p>
                          {getAttachmentsByType(item, 'SUBMISSION_PROOF').length ? (
                            <div className={styles.reimbursementInlineAttachmentList}>
                              {getAttachmentsByType(item, 'SUBMISSION_PROOF').map((attachment) => (
                                <button
                                  key={attachment.id}
                                  type="button"
                                  className={styles.reimbursementInlineAttachmentButton}
                                  onClick={() => void handleOpenAttachment(attachment)}
                                  title={attachment.file_name}
                                >
                                  {attachment.file_name}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <p className={styles.reimbursementCardAmount}>{formatCurrency(item.total_amount)}</p>
                        </article>
                      ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {showBatchModal ? (
        <div className={styles.modalOverlay} onClick={closeBatchModal}>
          <div className={`${styles.modalCard} ${styles.reimbursementBatchModal}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.reimbursementModalHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Reimbursement Entry</h2>
              </div>
              <div className={styles.buttonRow}>
                <button type="button" className={styles.primaryButton} onClick={handleSaveBatch} disabled={saving}>
                  {saving ? 'Saving batch...' : 'Save Batch'}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={closeBatchModal} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>

            {error ? <p className={styles.errorText}>{error}</p> : null}

            <div className={styles.reimbursementBatchLayout}>
              {activeBatchRow ? (
                <section className={styles.reimbursementDraftCard}>
                  <div className={styles.reimbursementDraftHeader}>
                    <div>
                      <p className={styles.reimbursementDraftEyebrow}>Entry Form</p>
                      <h3 className={styles.reimbursementDraftTitle}>
                        Entry {batchRows.findIndex((item) => item.localId === activeBatchRow.localId) + 1}
                      </h3>
                    </div>
                    <button type="button" className={styles.secondaryButton} onClick={addBatchRow} disabled={saving}>
                      + Add Row
                    </button>
                  </div>

                  <div className={styles.formGrid}>
                    <div className={`${styles.formRowFour} ${styles.fullSpan}`.trim()}>
                      <div className={styles.field}>
                        <label className={styles.label}>Expense Date *</label>
                        <input
                          className={styles.input}
                          type="date"
                          value={activeBatchRow.expense_date}
                          onChange={(event) => updateBatchRow(activeBatchRow.localId, { expense_date: event.target.value })}
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Expense Category *</label>
                        <select
                          className={`${styles.select} ${styles.compactFieldText}`.trim()}
                          value={activeBatchRow.expense_category_id}
                          onChange={(event) => updateBatchRow(activeBatchRow.localId, { expense_category_id: event.target.value })}
                        >
                          <option value="">Choose category</option>
                          {categories.map((item) => (
                            <option key={item.id} value={String(item.id)}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Payment To *</label>
                        <select
                          className={styles.select}
                          value={activeBatchRow.payee_type}
                          onChange={(event) => updateBatchRow(activeBatchRow.localId, { payee_type: event.target.value })}
                        >
                          <option value="SELF_ACCOUNT">Saved Account</option>
                          <option value="OTHER_ACCOUNT">Other account</option>
                        </select>
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Total Amount *</label>
                        <input
                          className={styles.input}
                          type="number"
                          min="0"
                          step="1000"
                          value={activeBatchRow.total_amount}
                          onChange={(event) => updateBatchRow(activeBatchRow.localId, { total_amount: event.target.value })}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {activeBatchRow.payee_type === 'SELF_ACCOUNT' ? (
                      <div className={`${styles.field} ${styles.fullSpan}`.trim()}>
                        <label className={styles.label}>Saved Account</label>
                        <div className={styles.mutedValue}>
                          {profile?.reimbursement_account_name && profile?.reimbursement_account_number
                            ? `${profile.reimbursement_bank_name || 'Bank'} - ${profile.reimbursement_account_name} (${profile.reimbursement_account_number})`
                            : 'No saved reimbursement account on your profile yet.'}
                        </div>
                      </div>
                    ) : (
                      <div className={`${styles.formRowThree} ${styles.fullSpan}`.trim()}>
                        <div className={styles.field}>
                          <label className={styles.label}>Bank Name</label>
                          <input
                            className={styles.input}
                            value={activeBatchRow.payee_bank_name}
                            onChange={(event) =>
                              updateBatchRow(activeBatchRow.localId, { payee_bank_name: normalizeUppercaseText(event.target.value) })
                            }
                            placeholder="Bank"
                          />
                        </div>

                        <div className={styles.field}>
                          <label className={styles.label}>Account Name *</label>
                          <input
                            className={styles.input}
                            value={activeBatchRow.payee_account_name}
                            onChange={(event) =>
                              updateBatchRow(activeBatchRow.localId, { payee_account_name: normalizeAccountName(event.target.value) })
                            }
                            placeholder="Account name"
                          />
                        </div>

                        <div className={styles.field}>
                          <label className={styles.label}>Account Number *</label>
                          <input
                            className={styles.input}
                            value={activeBatchRow.payee_account_number}
                            onChange={(event) =>
                              updateBatchRow(activeBatchRow.localId, { payee_account_number: normalizeAccountNumber(event.target.value) })
                            }
                            placeholder="Account number"
                          />
                        </div>
                      </div>
                    )}

                    <div className={`${styles.field} ${styles.fullSpan}`.trim()}>
                      <label className={styles.label}>Description</label>
                      <textarea
                        className={styles.textarea}
                        value={activeBatchRow.description}
                        onChange={(event) => updateBatchRow(activeBatchRow.localId, { description: event.target.value })}
                        placeholder="Describe the expense"
                      />
                    </div>

                    <div className={`${styles.field} ${styles.fullSpan}`.trim()}>
                      <label className={styles.label}>Submission Attachment</label>
                      <input
                        ref={submissionFileInputRef}
                        className={styles.reimbursementHiddenInput}
                        type="file"
                        multiple
                        onChange={(event) => {
                          appendSubmissionFiles(activeBatchRow.localId, Array.from(event.target.files || []))
                          event.target.value = ''
                        }}
                      />
                      <button
                        type="button"
                        className={styles.reimbursementAttachmentAddButton}
                        onClick={() => submissionFileInputRef.current?.click()}
                      >
                        <span className={styles.reimbursementAttachmentPlus}>+</span>
                        <span>Add Attachment</span>
                      </button>
                      {activeBatchRow.submission_files.length ? (
                        <div className={styles.reimbursementFileList}>
                          {activeBatchRow.submission_files.map((file, index) => (
                            <span
                              key={`${activeBatchRow.localId}-${file.name}-${file.size}-${index}`}
                              className={styles.reimbursementFileChip}
                            >
                              {file.name}
                              <button
                                type="button"
                                className={styles.reimbursementFileChipRemove}
                                onClick={() => removeSubmissionFile(activeBatchRow.localId, index)}
                                aria-label={`Remove ${file.name}`}
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>
              ) : null}

              <aside className={styles.reimbursementBatchSummary}>
                <div className={styles.reimbursementBatchSummaryHeader}>
                  <div>
                    <h3 className={styles.reimbursementDraftTitle}>Added Entries</h3>
                  </div>
                  <div className={styles.reimbursementBatchSummaryTotals}>
                    <span className={styles.reimbursementBatchCount}>{batchRows.length}</span>
                    <strong className={styles.reimbursementBatchGrandTotal}>{formatCurrency(batchTotalAmount)}</strong>
                  </div>
                </div>

                <div className={styles.reimbursementBatchSummaryList}>
                  {batchRows.map((row, index) => {
                    const category = categories.find((item) => String(item.id) === String(row.expense_category_id))
                    const isActive = row.localId === activeBatchRow?.localId

                    return (
                      <div
                        key={row.localId}
                        className={`${styles.reimbursementBatchSummaryRow} ${isActive ? styles.reimbursementBatchSummaryRowActive : ''}`.trim()}
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveBatchRowId(row.localId)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setActiveBatchRowId(row.localId)
                          }
                        }}
                      >
                        <div>
                          <p className={styles.reimbursementBatchSummaryTitle}>Entry {index + 1}</p>
                          <p className={styles.reimbursementBatchSummaryMeta}>{category?.name || 'No category yet'}</p>
                        </div>
                        <div className={styles.reimbursementBatchSummaryActions}>
                          <strong className={styles.reimbursementBatchSummaryAmount}>{formatCurrency(row.total_amount || 0)}</strong>
                          <button
                            type="button"
                            className={styles.reimbursementBatchRemoveButton}
                            onClick={(event) => {
                              event.stopPropagation()
                              removeBatchRow(row.localId)
                            }}
                            disabled={saving || batchRows.length === 1}
                            aria-label={`Remove entry ${index + 1}`}
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}

      {selectedClaim ? (
        <div className={styles.modalOverlay} onClick={closeClaimModal}>
          <div className={`${styles.modalCard} ${styles.reimbursementClaimModal}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.reimbursementModalHeader}>
              <div>
                <p className={styles.eyebrow}>Claim Detail</p>
                <h2 className={styles.sectionTitle}>{selectedClaim.claim_number}</h2>
                <p className={styles.sectionSubtitle}>
                  {selectedClaim.employee_name_snapshot || selectedClaim.employee_email_snapshot} - {selectedClaim.expense_category_name || '-'}
                </p>
              </div>
              <span className={`${styles.reimbursementStatus} ${styles[`reimbursementStatus${selectedClaim.status}`]}`.trim()}>
                {selectedClaim.status}
              </span>
            </div>

            <div className={styles.reimbursementDetailGrid}>
              <div className={styles.reimbursementMetricCard}>
                <span>Expense Date</span>
                <strong>{formatDate(selectedClaim.expense_date)}</strong>
              </div>
              <div className={styles.reimbursementMetricCard}>
                <span>Total Amount</span>
                <strong>{formatCurrency(selectedClaim.total_amount)}</strong>
              </div>
              <div className={styles.reimbursementMetricCard}>
                <span>Updated</span>
                <strong>{formatDateTime(selectedClaim.updated_at)}</strong>
              </div>
              <div className={styles.reimbursementMetricCard}>
                <span>Group</span>
                <strong>{selectedClaim.group || '-'}</strong>
              </div>
            </div>

            <div className={styles.reimbursementDetailSection}>
              <h3 className={styles.reimbursementSectionTitle}>Description</h3>
              <p className={styles.reimbursementDetailText}>{selectedClaim.description || 'No description provided.'}</p>
            </div>

            <div className={styles.reimbursementDetailSection}>
              <h3 className={styles.reimbursementSectionTitle}>Payment Target</h3>
              <p className={styles.reimbursementDetailText}>
                {selectedClaim.payee_bank_name ? `${selectedClaim.payee_bank_name} - ` : ''}
                {selectedClaim.payee_account_name || '-'} ({selectedClaim.payee_account_number || '-'})
              </p>
            </div>

            {selectedClaim.comments ? (
              <div className={styles.reimbursementDetailSection}>
                <h3 className={styles.reimbursementSectionTitle}>Revision Comment</h3>
                <p className={styles.reimbursementDetailText}>{selectedClaim.comments}</p>
              </div>
            ) : null}

            <div className={styles.reimbursementAttachmentGrid}>
              <section className={styles.reimbursementAttachmentCard}>
                <h3 className={styles.reimbursementSectionTitle}>Submission Proof</h3>
                {selectedClaim.attachments.filter((item) => item.attachment_type === 'SUBMISSION_PROOF').length ? (
                  <div className={styles.reimbursementAttachmentList}>
                    {selectedClaim.attachments
                      .filter((item) => item.attachment_type === 'SUBMISSION_PROOF')
                      .map((attachment) => (
                        <div key={attachment.id} className={styles.reimbursementAttachmentRow}>
                          <div>
                            <p className={styles.reimbursementAttachmentName}>{attachment.file_name}</p>
                            <p className={styles.cellMeta}>{formatDateTime(attachment.created_at)}</p>
                          </div>
                          <button type="button" className={styles.secondaryButton} onClick={() => void handleOpenAttachment(attachment)}>
                            {getAttachmentActionLabel(attachment)}
                          </button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>No submission proof uploaded.</div>
                )}
              </section>

              <section className={styles.reimbursementAttachmentCard}>
                <h3 className={styles.reimbursementSectionTitle}>Payment Proof</h3>
                {selectedClaim.attachments.filter((item) => item.attachment_type === 'PAYMENT_PROOF').length ? (
                  <div className={styles.reimbursementAttachmentList}>
                    {selectedClaim.attachments
                      .filter((item) => item.attachment_type === 'PAYMENT_PROOF')
                      .map((attachment) => (
                        <div key={attachment.id} className={styles.reimbursementAttachmentRow}>
                          <div>
                            <p className={styles.reimbursementAttachmentName}>{attachment.file_name}</p>
                            <p className={styles.cellMeta}>{formatDateTime(attachment.created_at)}</p>
                          </div>
                          <button type="button" className={styles.secondaryButton} onClick={() => void handleOpenAttachment(attachment)}>
                            {getAttachmentActionLabel(attachment)}
                          </button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>No payment proof uploaded.</div>
                )}
              </section>
            </div>

            {selectedClaim.status === 'APPROVED' && canPay ? (
              <div className={styles.reimbursementDetailSection}>
                <h3 className={styles.reimbursementSectionTitle}>Mark as Paid</h3>
                <input
                  ref={paymentFileInputRef}
                  className={styles.reimbursementHiddenInput}
                  type="file"
                  multiple
                  onChange={(event) => {
                    appendPaymentFiles(Array.from(event.target.files || []))
                    event.target.value = ''
                  }}
                />
                <button
                  type="button"
                  className={styles.reimbursementAttachmentAddButton}
                  onClick={() => paymentFileInputRef.current?.click()}
                >
                  <span className={styles.reimbursementAttachmentPlus}>+</span>
                  <span>Add Attachment</span>
                </button>
                {paymentFiles.length ? (
                  <div className={styles.reimbursementFileList}>
                    {paymentFiles.map((file, index) => (
                      <span key={`${selectedClaim.id}-${file.name}-${file.size}-${index}`} className={styles.reimbursementFileChip}>
                        {file.name}
                        <button
                          type="button"
                          className={styles.reimbursementFileChipRemove}
                          onClick={() => removePaymentFile(index)}
                          aria-label={`Remove ${file.name}`}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {(selectedClaim.status === 'SUBMITTED' || selectedClaim.status === 'NEED_REVISION') && canApprove ? (
              <div className={styles.reimbursementDetailSection}>
                <h3 className={styles.reimbursementSectionTitle}>Approver Comment</h3>
                <textarea
                  className={styles.textarea}
                  value={revisionComment}
                  onChange={(event) => setRevisionComment(event.target.value)}
                  placeholder="Add revision notes if needed"
                />
              </div>
            ) : null}

            {actionError ? <p className={styles.errorText}>{actionError}</p> : null}

            <div className={styles.buttonRow}>
              {(selectedClaim.status === 'SUBMITTED' || selectedClaim.status === 'NEED_REVISION') && isClaimOwner(selectedClaim) ? (
                <button
                  type="button"
                  className={styles.accentButton}
                  onClick={() => openEditClaimModal(selectedClaim)}
                  disabled={actionLoading}
                >
                  Edit Claim
                </button>
              ) : null}

              {(selectedClaim.status === 'SUBMITTED' || selectedClaim.status === 'NEED_REVISION') && isClaimOwner(selectedClaim) ? (
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={() => void handleDeleteClaim(selectedClaim)}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Deleting...' : 'Delete Claim'}
                </button>
              ) : null}

              {(selectedClaim.status === 'SUBMITTED' || selectedClaim.status === 'NEED_REVISION') && canApprove ? (
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={() => void handleRequestRevision(selectedClaim)}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : 'Need Revision'}
                </button>
              ) : null}

              {(selectedClaim.status === 'SUBMITTED' || selectedClaim.status === 'NEED_REVISION') && canApprove ? (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleApproveClaim(selectedClaim)}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : 'Approve Claim'}
                </button>
              ) : null}

              {selectedClaim.status === 'APPROVED' && canPay ? (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleMarkPaid(selectedClaim)}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : 'Mark as Paid'}
                </button>
              ) : null}

              <button type="button" className={styles.secondaryButton} onClick={closeClaimModal} disabled={actionLoading}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedApprovedGroup ? (
        <div className={styles.modalOverlay} onClick={closeApprovedGroupModal}>
          <div className={`${styles.modalCard} ${styles.reimbursementClaimModal}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.reimbursementModalHeader}>
              <div>
                <p className={styles.eyebrow}>Approved Account Batch</p>
                <h2 className={styles.sectionTitle}>{selectedApprovedGroup.payee_account_name || '-'}</h2>
                <p className={styles.sectionSubtitle}>
                  {selectedApprovedGroup.payee_bank_name || 'Bank'} - {selectedApprovedGroup.payee_account_number || '-'}
                </p>
              </div>
              <span className={`${styles.reimbursementStatus} ${styles.reimbursementStatusAPPROVED}`.trim()}>
                {selectedApprovedGroup.claims.length} Claim{selectedApprovedGroup.claims.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className={styles.reimbursementDetailGrid}>
              <div className={styles.reimbursementMetricCard}>
                <span>Total Claims</span>
                <strong>{selectedApprovedGroup.claims.length}</strong>
              </div>
              <div className={styles.reimbursementMetricCard}>
                <span>Total Amount</span>
                <strong>{formatCurrency(selectedApprovedGroup.total_amount)}</strong>
              </div>
              <div className={styles.reimbursementMetricCard}>
                <span>Bank</span>
                <strong>{selectedApprovedGroup.payee_bank_name || '-'}</strong>
              </div>
              <div className={styles.reimbursementMetricCard}>
                <span>Account Number</span>
                <strong>{selectedApprovedGroup.payee_account_number || '-'}</strong>
              </div>
            </div>

            <div className={styles.reimbursementDetailSection}>
              <h3 className={styles.reimbursementSectionTitle}>Claim List</h3>
              <div className={styles.reimbursementAttachmentList}>
                {selectedApprovedGroup.claims.map((claim) => (
                  <div key={claim.id} className={styles.reimbursementAttachmentRow}>
                    <div>
                      <p className={styles.reimbursementAttachmentName}>{claim.claim_number}</p>
                      <p className={styles.cellMeta}>
                        {[claim.employee_name_snapshot || claim.employee_email_snapshot, formatDate(claim.expense_date), claim.group].filter(Boolean).join(' • ')}
                      </p>
                      <p className={styles.reimbursementCardDescription}>{claim.description || 'No description provided.'}</p>
                      <p className={styles.cellMeta}>{claim.expense_category_name || '-'}</p>
                      {getAttachmentsByType(claim, 'SUBMISSION_PROOF').length ? (
                        <div className={styles.reimbursementInlineAttachmentList}>
                          {getAttachmentsByType(claim, 'SUBMISSION_PROOF').map((attachment) => (
                            <button
                              key={attachment.id}
                              type="button"
                              className={styles.reimbursementInlineAttachmentButton}
                              onClick={() => void handleOpenAttachment(attachment)}
                              title={attachment.file_name}
                            >
                              {attachment.file_name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <strong className={styles.reimbursementBatchSummaryAmount}>{formatCurrency(claim.total_amount)}</strong>
                  </div>
                ))}
              </div>
            </div>

            {canPay ? (
              <div className={styles.reimbursementDetailSection}>
                <h3 className={styles.reimbursementSectionTitle}>Mark as Paid</h3>
                <input
                  ref={paymentFileInputRef}
                  className={styles.reimbursementHiddenInput}
                  type="file"
                  multiple
                  onChange={(event) => {
                    appendPaymentFiles(Array.from(event.target.files || []))
                    event.target.value = ''
                  }}
                />
                <button
                  type="button"
                  className={styles.reimbursementAttachmentAddButton}
                  onClick={() => paymentFileInputRef.current?.click()}
                >
                  <span className={styles.reimbursementAttachmentPlus}>+</span>
                  <span>Add Attachment</span>
                </button>
                {paymentFiles.length ? (
                  <div className={styles.reimbursementFileList}>
                    {paymentFiles.map((file, index) => (
                      <span key={`${selectedApprovedGroup.key}-${file.name}-${file.size}-${index}`} className={styles.reimbursementFileChip}>
                        {file.name}
                        <button
                          type="button"
                          className={styles.reimbursementFileChipRemove}
                          onClick={() => removePaymentFile(index)}
                          aria-label={`Remove ${file.name}`}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {actionError ? <p className={styles.errorText}>{actionError}</p> : null}

            <div className={styles.buttonRow}>
              {canPay ? (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleMarkPaidGroup(selectedApprovedGroup)}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : 'Mark as Paid'}
                </button>
              ) : null}

              <button type="button" className={styles.secondaryButton} onClick={closeApprovedGroupModal} disabled={actionLoading}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedPaidGroup ? (
        <div className={styles.modalOverlay} onClick={closePaidGroupModal}>
          <div className={`${styles.modalCard} ${styles.reimbursementClaimModal}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.reimbursementModalHeader}>
              <div>
                <p className={styles.eyebrow}>Paid Account Batch</p>
                <h2 className={styles.sectionTitle}>{selectedPaidGroup.payee_account_name || '-'}</h2>
                <p className={styles.sectionSubtitle}>
                  {selectedPaidGroup.payee_bank_name || 'Bank'} - {selectedPaidGroup.payee_account_number || '-'}
                </p>
              </div>
              <span className={`${styles.reimbursementStatus} ${styles.reimbursementStatusPAID}`.trim()}>
                {selectedPaidGroup.claims.length} Claim{selectedPaidGroup.claims.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className={styles.reimbursementDetailGrid}>
              <div className={styles.reimbursementMetricCard}>
                <span>Total Claims</span>
                <strong>{selectedPaidGroup.claims.length}</strong>
              </div>
              <div className={styles.reimbursementMetricCard}>
                <span>Total Amount</span>
                <strong>{formatCurrency(selectedPaidGroup.total_amount)}</strong>
              </div>
              <div className={styles.reimbursementMetricCard}>
                <span>Paid At</span>
                <strong>{formatDateTime(selectedPaidGroup.paid_at)}</strong>
              </div>
              <div className={styles.reimbursementMetricCard}>
                <span>Account Number</span>
                <strong>{selectedPaidGroup.payee_account_number || '-'}</strong>
              </div>
            </div>

            <div className={styles.reimbursementDetailSection}>
              <h3 className={styles.reimbursementSectionTitle}>Claim List</h3>
              <div className={styles.reimbursementAttachmentList}>
                {selectedPaidGroup.claims.map((claim) => (
                  <div key={claim.id} className={styles.reimbursementAttachmentRow}>
                    <div>
                      <p className={styles.reimbursementAttachmentName}>{claim.claim_number}</p>
                      <p className={styles.cellMeta}>
                        {[claim.employee_name_snapshot || claim.employee_email_snapshot, formatDate(claim.expense_date), claim.group].filter(Boolean).join(' • ')}
                      </p>
                      <p className={styles.reimbursementCardDescription}>{claim.description || 'No description provided.'}</p>
                      <p className={styles.cellMeta}>{claim.expense_category_name || '-'}</p>
                      {getAttachmentsByType(claim, 'SUBMISSION_PROOF').length ? (
                        <div className={styles.reimbursementInlineAttachmentList}>
                          {getAttachmentsByType(claim, 'SUBMISSION_PROOF').map((attachment) => (
                            <button
                              key={attachment.id}
                              type="button"
                              className={styles.reimbursementInlineAttachmentButton}
                              onClick={() => void handleOpenAttachment(attachment)}
                              title={attachment.file_name}
                            >
                              {attachment.file_name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <strong className={styles.reimbursementBatchSummaryAmount}>{formatCurrency(claim.total_amount)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.reimbursementAttachmentGrid}>
              <section className={styles.reimbursementAttachmentCard}>
                <h3 className={styles.reimbursementSectionTitle}>Payment Proof</h3>
                {getGroupedPaymentProofs(selectedPaidGroup.claims).length ? (
                  <div className={styles.reimbursementAttachmentList}>
                    {getGroupedPaymentProofs(selectedPaidGroup.claims).map((attachment, index) => (
                      <div key={`${attachment.file_name}-${attachment.created_at}-${index}`} className={styles.reimbursementAttachmentRow}>
                        <div>
                          <p className={styles.reimbursementAttachmentName}>{attachment.file_name}</p>
                          <p className={styles.cellMeta}>{formatDateTime(attachment.created_at)}</p>
                        </div>
                        <button type="button" className={styles.secondaryButton} onClick={() => void handleOpenAttachment(attachment)}>
                          Open
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>No payment proof uploaded.</div>
                )}
              </section>
            </div>

            <div className={styles.buttonRow}>
              <button type="button" className={styles.secondaryButton} onClick={closePaidGroupModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingClaim && editDraft ? (
        <div className={styles.modalOverlay} onClick={closeEditClaimModal}>
          <div className={`${styles.modalCard} ${styles.reimbursementClaimModal}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.reimbursementModalHeader}>
              <div>
                <p className={styles.eyebrow}>Edit Submitted Claim</p>
                <h2 className={styles.sectionTitle}>{editingClaim.claim_number}</h2>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={`${styles.formRowFour} ${styles.fullSpan}`.trim()}>
                <div className={styles.field}>
                  <label className={styles.label}>Expense Date *</label>
                  <input
                    className={styles.input}
                    type="date"
                    value={editDraft.expense_date}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, expense_date: event.target.value }))}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Expense Category *</label>
                  <select
                    className={`${styles.select} ${styles.compactFieldText}`.trim()}
                    value={editDraft.expense_category_id}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, expense_category_id: event.target.value }))}
                  >
                    <option value="">Choose category</option>
                    {categories.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Payment To *</label>
                  <select
                    className={styles.select}
                    value={editDraft.payee_type}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, payee_type: event.target.value }))}
                  >
                    <option value="SELF_ACCOUNT">Saved Account</option>
                    <option value="OTHER_ACCOUNT">Other account</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Total Amount *</label>
                  <input
                    className={styles.input}
                    type="number"
                    min="0"
                    step="1000"
                    value={editDraft.total_amount}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, total_amount: event.target.value }))}
                  />
                </div>
              </div>

              {editDraft.payee_type === 'SELF_ACCOUNT' ? (
                <div className={`${styles.field} ${styles.fullSpan}`.trim()}>
                  <label className={styles.label}>Saved Account</label>
                  <div className={styles.mutedValue}>
                    {profile?.reimbursement_account_name && profile?.reimbursement_account_number
                      ? `${profile.reimbursement_bank_name || 'Bank'} - ${profile.reimbursement_account_name} (${profile.reimbursement_account_number})`
                      : 'No saved reimbursement account on your profile yet.'}
                  </div>
                </div>
              ) : (
                <div className={`${styles.formRowThree} ${styles.fullSpan}`.trim()}>
                  <div className={styles.field}>
                    <label className={styles.label}>Bank Name</label>
                    <input
                      className={styles.input}
                      value={editDraft.payee_bank_name}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, payee_bank_name: normalizeUppercaseText(event.target.value) }))}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Account Name *</label>
                    <input
                      className={styles.input}
                      value={editDraft.payee_account_name}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, payee_account_name: normalizeAccountName(event.target.value) }))}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Account Number *</label>
                    <input
                      className={styles.input}
                      value={editDraft.payee_account_number}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, payee_account_number: normalizeAccountNumber(event.target.value) }))}
                    />
                  </div>
                </div>
              )}

              <div className={`${styles.field} ${styles.fullSpan}`.trim()}>
                <label className={styles.label}>Description</label>
                <textarea
                  className={styles.textarea}
                  value={editDraft.description}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>

              <div className={`${styles.field} ${styles.fullSpan}`.trim()}>
                <label className={styles.label}>Add Submission Attachment</label>
                <input
                  ref={editSubmissionFileInputRef}
                  className={styles.reimbursementHiddenInput}
                  type="file"
                  multiple
                  onChange={(event) => {
                    setEditFiles((prev) => [...prev, ...Array.from(event.target.files || [])])
                    event.target.value = ''
                  }}
                />
                <button type="button" className={styles.reimbursementAttachmentAddButton} onClick={() => editSubmissionFileInputRef.current?.click()}>
                  <span className={styles.reimbursementAttachmentPlus}>+</span>
                  <span>Add Attachment</span>
                </button>
                {editFiles.length ? (
                  <div className={styles.reimbursementFileList}>
                    {editFiles.map((file, index) => (
                      <span key={`${editingClaim.id}-${file.name}-${file.size}-${index}`} className={styles.reimbursementFileChip}>
                        {file.name}
                        <button type="button" className={styles.reimbursementFileChipRemove} onClick={() => setEditFiles((prev) => prev.filter((_, i) => i !== index))}>
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {actionError ? <p className={styles.errorText}>{actionError}</p> : null}

            <div className={styles.buttonRow}>
              <button type="button" className={styles.primaryButton} onClick={() => void handleSaveEditClaim()} disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={closeEditClaimModal} disabled={actionLoading}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {imagePreview ? (
        <div
          className={styles.modalOverlay}
          onClick={resetImagePreviewState}
        >
          <div className={`${styles.modalCard} ${styles.reimbursementImageModal}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.reimbursementModalHeader}>
              <div>
                <p className={styles.eyebrow}>Attachment Preview</p>
                <h2 className={styles.sectionTitle}>{imagePreview.name}</h2>
              </div>
              <div className={styles.reimbursementPreviewActions}>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${imagePreviewTool === 'zoom-out' ? styles.reimbursementPreviewButtonActive : ''}`.trim()}
                  onClick={() => setImagePreviewTool('zoom-out')}
                >
                  Zoom Out
                </button>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${imagePreviewTool === 'pan' ? styles.reimbursementPreviewButtonActive : ''}`.trim()}
                  onClick={() => setImagePreviewTool('pan')}
                >
                  Pan
                </button>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${imagePreviewTool === 'zoom-in' ? styles.reimbursementPreviewButtonActive : ''}`.trim()}
                  onClick={() => setImagePreviewTool('zoom-in')}
                >
                  Zoom In
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setImagePreviewZoom(1)
                    setImagePreviewOrigin({ x: 50, y: 50 })
                    setImagePreviewOffset({ x: 0, y: 0 })
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={resetImagePreviewState}
                >
                  Close
                </button>
              </div>
            </div>

            <div
              className={styles.reimbursementImagePreviewWrap}
              style={{
                cursor:
                  imagePreviewTool === 'pan'
                    ? imagePreviewZoom > 1
                      ? imagePreviewDragRef.current
                        ? 'grabbing'
                        : 'grab'
                      : 'default'
                    : imagePreviewTool === 'zoom-out'
                      ? 'zoom-out'
                      : 'zoom-in',
              }}
              onClick={handleImagePreviewWrapClick}
              onPointerDown={handleImagePreviewPointerDown}
              onPointerMove={handleImagePreviewPointerMove}
              onPointerUp={handleImagePreviewPointerUp}
              onPointerCancel={handleImagePreviewPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview.src}
                alt={imagePreview.name}
                className={styles.reimbursementImagePreview}
                draggable={false}
                style={{
                  transform: `translate(${imagePreviewOffset.x}px, ${imagePreviewOffset.y}px) scale(${imagePreviewZoom})`,
                  transformOrigin: `${imagePreviewOrigin.x}% ${imagePreviewOrigin.y}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

