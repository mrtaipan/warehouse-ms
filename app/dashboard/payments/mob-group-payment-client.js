'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'
import { ADMIN_EMAIL, resolveRole } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

import shellStyles from '../arkline/arkline.module.css'
import styles from '../arkline/financial-management/financial-management.module.css'

const supabase = createClient()
const PAYMENT_BUCKET = 'mob-payments'
const MOB_PAYMENT_DETAIL_SELECT = `
  id,
  invoice_number,
  category_id,
  amount,
  notes,
  account_name,
  bank_name,
  account_number,
  status,
  employee_authenticated_id,
  employee_name_snapshot,
  employee_email_snapshot,
  created_by,
  approved_by,
  approved_at,
  paid_by,
  paid_at,
  created_at,
  updated_at,
  category:dir_reimbursement_categories(id, name),
  attachments:mob_payment_attachments(
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

async function getCurrentUserSafely() {
  try {
    const userResult = await supabase.auth.getUser()
    if (!userResult.error) {
      return userResult
    }

    if (!String(userResult.error.message || '').includes('was released because another request stole it')) {
      return userResult
    }

    const sessionResult = await supabase.auth.getSession()
    if (sessionResult.error) {
      return userResult
    }

    return {
      data: { user: sessionResult.data.session?.user ?? null },
      error: null,
    }
  } catch (error) {
    if (!String(error?.message || '').includes('was released because another request stole it')) {
      throw error
    }

    const sessionResult = await supabase.auth.getSession()
    if (sessionResult.error) {
      return {
        data: { user: null },
        error,
      }
    }

    return {
      data: { user: sessionResult.data.session?.user ?? null },
      error: null,
    }
  }
}

function createDraft(profile = {}) {
  return {
    invoice_number: '',
    no_invoice_number: false,
    category_id: '',
    amount: '',
    notes: '',
    account_name: '',
    bank_name: '',
    account_number: '',
    attachments: [],
  }
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

function getRequestDateForFilter(item) {
  const source = item?.status === 'PAID' ? item?.paid_at || item?.created_at : item?.created_at
  const date = source ? new Date(source) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

function getInternalInvoicePrefix(date = new Date()) {
  const month = ROMAN_MONTHS[date.getMonth()] || 'I'
  const year = String(date.getFullYear()).slice(-2)
  return `INV-${month}${year}`
}

async function generateInternalInvoiceNumber() {
  const prefix = getInternalInvoicePrefix()
  const { data, error } = await supabase.from('mob_payment').select('invoice_number').like('invoice_number', `${prefix}-%`)

  if (error) {
    throw new Error(error.message)
  }

  const maxIteration = (data || []).reduce((highest, item) => {
    const match = String(item?.invoice_number || '').match(new RegExp(`^${prefix}-(\\d{3})$`))
    if (!match) return highest
    return Math.max(highest, Number(match[1]))
  }, 0)

  return `${prefix}-${String(maxIteration + 1).padStart(3, '0')}`
}

function fallbackDisplayName(value) {
  const text = String(value || '').trim()
  if (!text) return '-'
  if (!text.includes('@')) return text
  return text.split('@')[0]
}

function buildRequestFolder(request) {
  const invoiceFolder = sanitizeFileName(request?.invoice_number || '').replace(/\.+/g, '-')
  return invoiceFolder || String(request?.id || 'request')
}

function isImageAttachment(attachment) {
  return String(attachment?.mime_type || '').toLowerCase().startsWith('image/')
}

function normalizeRequest(row) {
  return {
    id: row?.id || '',
    invoice_number: row?.invoice_number || '',
    category_id: row?.category_id ? String(row.category_id) : '',
    category_name: row?.category?.name || '',
    amount: Number(row?.amount || 0),
    notes: row?.notes || '',
    account_name: row?.account_name || '',
    bank_name: row?.bank_name || '',
    account_number: row?.account_number || '',
    status: row?.status || 'SUBMITTED',
    employee_name_snapshot: row?.employee_name_snapshot || '',
    employee_email_snapshot: row?.employee_email_snapshot || '',
    created_by: row?.created_by || '',
    approved_by: row?.approved_by || '',
    approved_at: row?.approved_at || '',
    paid_by: row?.paid_by || '',
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

    const { error: uploadError } = await supabase.storage.from(PAYMENT_BUCKET).upload(storagePath, file, { upsert: false })
    if (uploadError) throw new Error(uploadError.message)

    uploadedPaths.push(storagePath)
    attachmentRows.push({
      payment_id: request.id,
      storage_bucket: PAYMENT_BUCKET,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size || null,
      uploaded_by: uploadedBy || null,
    })
  }

  return { uploadedPaths, attachmentRows }
}

export default function MobGroupPaymentClient({
  mode = 'self',
  panelTitle = 'MOB Group Payment Submission',
  panelSubtitle = '',
  showHeader = true,
  allowCreate = false,
  hideHeaderCopy = false,
  embedded = false,
  createLabel = 'New Request',
}) {
  const hrgaMode = mode === 'hrga'
  const attachmentInputRef = useRef(null)
  const paymentProofInputRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [requests, setRequests] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [requesterFilter, setRequesterFilter] = useState('ALL')
  const [monthFilter, setMonthFilter] = useState('')
  const [dayFilter, setDayFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [selectedRequestIds, setSelectedRequestIds] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [draft, setDraft] = useState(createDraft())
  const [editingRequest, setEditingRequest] = useState(null)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imagePreviewZoom, setImagePreviewZoom] = useState(1)
  const [imagePreviewTool, setImagePreviewTool] = useState('zoom-in')
  const [imagePreviewOrigin, setImagePreviewOrigin] = useState({ x: 50, y: 50 })
  const [imagePreviewOffset, setImagePreviewOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [detailError, setDetailError] = useState('')
  const [paymentProofFiles, setPaymentProofFiles] = useState([])
  const [canApprove, setCanApprove] = useState(false)
  const [canPay, setCanPay] = useState(false)
  const imagePreviewDragRef = useRef(null)

  const hydrateRequestDisplayNames = useCallback(
    (row) => {
      const normalized = normalizeRequest(row)
      const cachedMatch = requests.find((item) => item.id === normalized.id)
      return {
        ...normalized,
        created_by_display_name:
          cachedMatch?.created_by_display_name || fallbackDisplayName(normalized.created_by),
        approved_by_display_name:
          cachedMatch?.approved_by_display_name || fallbackDisplayName(normalized.approved_by),
        paid_by_display_name:
          cachedMatch?.paid_by_display_name || fallbackDisplayName(normalized.paid_by),
      }
    },
    [requests]
  )

  const refreshSelectedRequestDetail = useCallback(
    async (requestId) => {
      if (!requestId) return

      const { data, error } = await supabase.from('mob_payment').select(MOB_PAYMENT_DETAIL_SELECT).eq('id', requestId).maybeSingle()
      if (error) {
        throw new Error(error.message)
      }

      if (data) {
        setSelectedRequest(hydrateRequestDisplayNames(data))
      }
    },
    [hydrateRequestDisplayNames]
  )

  const loadWorkspace = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError('')
    }

    const {
      data: { user },
      error: authError,
    } = await getCurrentUserSafely()

    if (authError) {
      setError(authError.message)
      if (!silent) setLoading(false)
      return
    }

    if (!user) {
      setError('You need to sign in again to open MOB payment submission.')
      if (!silent) setLoading(false)
      return
    }

    const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL
    const { data: profileRow, error: profileError } = await getProfileByAuthenticatedUser(
      supabase,
      user,
      'id, authenticated_id, email, display_name, role, reimbursement_bank_name, reimbursement_account_name, reimbursement_account_number'
    )

    if (profileError) {
      setError(profileError.message)
      if (!silent) setLoading(false)
      return
    }

    const role = resolveRole(profileRow?.role, isAdmin)
    const canManageHrga = isAdmin || role === 'hrga' || role === 'leader'

    const [{ data: paymentRows, error: paymentError }, { data: categoryRows, error: categoryError }, { data: profileRows }] = await Promise.all([
      (() => {
        let paymentQuery = supabase
          .from('mob_payment')
          .select(MOB_PAYMENT_DETAIL_SELECT)
          .order('created_at', { ascending: true })

        if (!hrgaMode) {
          paymentQuery = paymentQuery.eq('employee_authenticated_id', user.id)
        }

        return paymentQuery
      })(),
      supabase.from('dir_reimbursement_categories').select('id, name, is_active').eq('is_active', true).order('id', { ascending: true }),
      supabase.from('dir_user_profiles').select('email, display_name'),
    ])

    if (paymentError || categoryError) {
      setError(paymentError?.message || categoryError?.message || 'Failed to load MOB payment submission.')
      if (!silent) setLoading(false)
      return
    }

    const displayNameMap = new Map(
      (profileRows || [])
        .filter((item) => String(item.email || '').trim())
        .map((item) => [String(item.email || '').trim().toLowerCase(), String(item.display_name || '').trim()])
    )

    setProfile({
      id: profileRow?.id || '',
      authenticated_id: profileRow?.authenticated_id || user.id,
      email: String(profileRow?.email || user.email || '').toLowerCase(),
      display_name:
        profileRow?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '',
      reimbursement_bank_name: profileRow?.reimbursement_bank_name || '',
      reimbursement_account_name: profileRow?.reimbursement_account_name || '',
      reimbursement_account_number: profileRow?.reimbursement_account_number || '',
      role: profileRow?.role || '',
    })
    setRequests(
      (paymentRows || []).map((item) => {
        const normalized = normalizeRequest(item)
        return {
          ...normalized,
          created_by_display_name:
            displayNameMap.get(String(normalized.created_by || '').trim().toLowerCase()) || fallbackDisplayName(normalized.created_by),
          approved_by_display_name:
            displayNameMap.get(String(normalized.approved_by || '').trim().toLowerCase()) || fallbackDisplayName(normalized.approved_by),
          paid_by_display_name:
            displayNameMap.get(String(normalized.paid_by || '').trim().toLowerCase()) || fallbackDisplayName(normalized.paid_by),
        }
      })
    )
    setCategories((categoryRows || []).map((item) => ({ id: String(item.id), name: item.name })))
    setCanApprove(hrgaMode && canManageHrga)
    setCanPay(hrgaMode && canManageHrga)
    if (!silent) setLoading(false)
  }, [hrgaMode])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  useEffect(() => {
    if (loading) return undefined
    const intervalId = window.setInterval(() => {
      if (saving || actionLoading) return
      void loadWorkspace(true)
    }, 30000)
    return () => window.clearInterval(intervalId)
  }, [actionLoading, loadWorkspace, loading, saving])

  const filteredRequests = useMemo(() => {
    const keyword = search.trim().toUpperCase()
    const today = new Date()
    const todayYear = today.getFullYear()
    const todayMonth = today.getMonth()
    const todayDate = today.getDate()

    return requests.filter((item) => {
      const matchesKeyword =
        !keyword ||
        [
          item.invoice_number,
          item.employee_name_snapshot,
          item.employee_email_snapshot,
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
      const matchesRequester = requesterFilter === 'ALL' ? true : item.created_by === requesterFilter
      const filterDate = getRequestDateForFilter(item)
      const matchesMonth = !monthFilter || (filterDate ? String(filterDate.getMonth() + 1).padStart(2, '0') === monthFilter : false)
      const matchesDay = !dayFilter || (filterDate ? String(filterDate.getDate()).padStart(2, '0') === dayFilter : false)
      const matchesYear = !yearFilter || (filterDate ? String(filterDate.getFullYear()) === yearFilter : false)
      const withinDefaultPaidWindow =
        item.status !== 'PAID' ||
        monthFilter ||
        dayFilter ||
        yearFilter ||
        (filterDate
          ? filterDate.getFullYear() === todayYear && filterDate.getMonth() === todayMonth && filterDate.getDate() === todayDate
          : false)

      return matchesKeyword && matchesStatus && matchesRequester && matchesMonth && matchesDay && matchesYear && withinDefaultPaidWindow
    })
  }, [dayFilter, monthFilter, requests, requesterFilter, search, statusFilter, yearFilter])

  const monthFilterOptions = useMemo(() => {
    const map = new Map()

    requests.forEach((item) => {
      const date = getRequestDateForFilter(item)
      if (!date) return
      const value = String(date.getMonth() + 1).padStart(2, '0')
      if (!map.has(value)) {
        map.set(value, {
          value,
          label: date.toLocaleDateString('en-GB', { month: 'long' }),
        })
      }
    })

    return Array.from(map.values()).sort((left, right) => left.value.localeCompare(right.value))
  }, [requests])

  const dayFilterOptions = useMemo(() => {
    const values = new Set()

    requests.forEach((item) => {
      const date = getRequestDateForFilter(item)
      if (!date) return
      values.add(String(date.getDate()).padStart(2, '0'))
    })

    return Array.from(values).sort((left, right) => left.localeCompare(right))
  }, [requests])

  const yearFilterOptions = useMemo(() => {
    const values = new Set()

    requests.forEach((item) => {
      const date = getRequestDateForFilter(item)
      if (!date) return
      values.add(String(date.getFullYear()))
    })

    return Array.from(values).sort((left, right) => right.localeCompare(left))
  }, [requests])

  const requesterOptions = useMemo(
    () =>
      Array.from(
        new Map(
          requests
            .filter((item) => String(item.created_by || '').trim())
            .map((item) => [
              item.created_by,
              {
                value: item.created_by,
                label: item.created_by_display_name || item.employee_name_snapshot || fallbackDisplayName(item.created_by),
              },
            ])
        ).values()
      ).sort((left, right) => left.label.localeCompare(right.label)),
    [requests]
  )

  const selectableRequests = useMemo(() => filteredRequests.filter((item) => item.status === 'SUBMITTED'), [filteredRequests])
  const payableRequests = useMemo(() => filteredRequests.filter((item) => item.status === 'APPROVED'), [filteredRequests])
  const actionableRequests = useMemo(
    () => filteredRequests.filter((item) => item.status === 'SUBMITTED' || item.status === 'APPROVED'),
    [filteredRequests]
  )
  const allSelectableChecked = actionableRequests.length > 0 && actionableRequests.every((item) => selectedRequestIds.includes(item.id))
  const selectedSubmittedCount = selectableRequests.filter((item) => selectedRequestIds.includes(item.id)).length
  const selectedApprovedCount = payableRequests.filter((item) => selectedRequestIds.includes(item.id)).length

  const summary = useMemo(
    () => ({
      outstanding: requests.filter((item) => item.status !== 'PAID').reduce((sum, item) => sum + Number(item.amount || 0), 0),
    }),
    [requests]
  )

  function closeCreateModal() {
    if (saving) return
    setShowCreateModal(false)
    setDraft(createDraft(profile))
    setEditingRequest(null)
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
      invoice_number: item.invoice_number || '',
      no_invoice_number: false,
      category_id: item.category_id || '',
      amount: formatNumberInput(item.amount || ''),
      notes: item.notes || '',
      account_name: item.account_name || '',
      bank_name: item.bank_name || '',
      account_number: item.account_number || '',
      attachments: [],
    })
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

  function appendPaymentProofFiles(files) {
    setPaymentProofFiles((prev) => [...prev, ...files])
  }

  function removePaymentProofFile(targetIndex) {
    setPaymentProofFiles((prev) => prev.filter((_, index) => index !== targetIndex))
  }

  async function handleNoInvoiceNumberChange(checked) {
    if (!checked) {
      setDraft((prev) => ({ ...prev, no_invoice_number: false, invoice_number: '' }))
      return
    }

    try {
      const invoiceNumber = await generateInternalInvoiceNumber()
      setDraft((prev) => ({ ...prev, no_invoice_number: true, invoice_number: invoiceNumber }))
    } catch (invoiceError) {
      setError(invoiceError.message || 'Failed to generate internal invoice number.')
    }
  }

  useEffect(() => {
    setSelectedRequestIds((prev) =>
      prev.filter((id) =>
        filteredRequests.some((item) => item.id === id && (item.status === 'SUBMITTED' || item.status === 'APPROVED'))
      )
    )
  }, [filteredRequests])

  async function handleCreateRequest() {
    setError('')
    setSuccess('')

    if (!profile?.email || !profile?.authenticated_id) {
      setError('Your profile is not ready yet. Please refresh and try again.')
      return
    }

    if ((!draft.no_invoice_number && !String(draft.invoice_number || '').trim()) || !String(draft.amount || '').trim() || !String(draft.category_id || '').trim()) {
      setError('Invoice number, payment amount, and category are required.')
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

    setSaving(true)
    const uploadedPaths = []

    try {
      const resolvedInvoiceNumber = draft.no_invoice_number ? await generateInternalInvoiceNumber() : normalizeUppercase(draft.invoice_number).trim()
      const payload = {
        invoice_number: resolvedInvoiceNumber,
        category_id: Number(draft.category_id),
        amount: Number(normalizeDigits(draft.amount)),
        notes: String(draft.notes || '').trim() || null,
        account_name: normalizeLettersUppercase(draft.account_name).trim(),
        bank_name: normalizeUppercase(draft.bank_name).trim(),
        account_number: normalizeDigits(draft.account_number).trim(),
        status: 'SUBMITTED',
        employee_authenticated_id: profile.authenticated_id,
        employee_name_snapshot: profile.display_name || fallbackDisplayName(profile.email),
        employee_email_snapshot: profile.email,
        created_by: profile.email,
      }

      let targetRequest = editingRequest

      if (editingRequest) {
        const { error: updateError } = await supabase.from('mob_payment').update(payload).eq('id', editingRequest.id)
        if (updateError) throw new Error(updateError.message)
      } else {
        const { data: insertedRequest, error: insertError } = await supabase
          .from('mob_payment')
          .insert(payload)
          .select(
            `
              id,
              invoice_number,
              category_id,
              amount,
              notes,
              account_name,
              bank_name,
              account_number,
              status,
              employee_name_snapshot,
              employee_email_snapshot,
              created_by,
              approved_by,
              approved_at,
              paid_by,
              paid_at,
              created_at,
              updated_at,
              category:dir_reimbursement_categories(id, name),
              attachments:mob_payment_attachments(
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
        targetRequest = normalizeRequest(insertedRequest)
      }

      if (draft.attachments.length) {
        const uploadResult = await uploadRequestFiles({
          request: targetRequest,
          files: draft.attachments,
          uploadedBy: profile.email,
          folder: 'submission',
        })
        uploadedPaths.push(...uploadResult.uploadedPaths)

        const { error: attachmentInsertError } = await supabase.from('mob_payment_attachments').insert(uploadResult.attachmentRows)
        if (attachmentInsertError) throw new Error(attachmentInsertError.message)
      }

      closeCreateModal()
      await loadWorkspace(true)
      setSuccess(editingRequest ? 'MOB payment request updated.' : 'MOB payment request submitted.')
    } catch (saveError) {
      if (uploadedPaths.length) {
        await supabase.storage.from(PAYMENT_BUCKET).remove(uploadedPaths)
      }
      setError(saveError.message || 'Failed to submit MOB payment request.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRequest(request) {
    if (!request) return
    if (typeof window !== 'undefined' && !window.confirm(`Delete request ${request.invoice_number}?`)) return

    setActionLoading(true)
    setDetailError('')
    try {
      const attachmentPaths = (request.attachments || []).map((item) => item.storage_path).filter(Boolean)
      if (attachmentPaths.length) {
        await supabase.storage.from(PAYMENT_BUCKET).remove(attachmentPaths)
      }

      const { error: deleteError } = await supabase.from('mob_payment').delete().eq('id', request.id)
      if (deleteError) throw new Error(deleteError.message)

      closeRequestDetail()
      await loadWorkspace(true)
      setSuccess(`Request ${request.invoice_number} deleted.`)
    } catch (deleteError) {
      setDetailError(deleteError.message || 'Failed to delete payment request.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleApproveRequest(request) {
    if (!request) return

    setActionLoading(true)
    setDetailError('')
    try {
      const { error: approveError } = await supabase
        .from('mob_payment')
        .update({
          status: 'APPROVED',
          approved_by: profile?.email || '',
          approved_at: new Date().toISOString(),
        })
        .eq('id', request.id)

      if (approveError) throw new Error(approveError.message)
      await loadWorkspace(true)
      closeRequestDetail()
      setSuccess(`Request ${request.invoice_number} approved.`)
    } catch (approveError) {
      setDetailError(approveError.message || 'Failed to approve payment request.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleApproveSelected() {
    if (!canApprove || !selectedRequestIds.length) return

    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      const selectedSubmittedIds = filteredRequests
        .filter((item) => item.status === 'SUBMITTED' && selectedRequestIds.includes(item.id))
        .map((item) => item.id)

      if (!selectedSubmittedIds.length) {
        setSelectedRequestIds([])
        return
      }

      const { error: approveError } = await supabase
        .from('mob_payment')
        .update({
          status: 'APPROVED',
          approved_by: profile?.email || '',
          approved_at: new Date().toISOString(),
        })
        .in('id', selectedSubmittedIds)

      if (approveError) throw new Error(approveError.message)

      setSelectedRequestIds([])
      await loadWorkspace(true)
      setSuccess(`${selectedSubmittedIds.length} payment request${selectedSubmittedIds.length > 1 ? 's' : ''} approved.`)
    } catch (approveError) {
      setError(approveError.message || 'Failed to approve selected payment requests.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleMarkPaidSelected() {
    if (!canPay || !selectedRequestIds.length) return

    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      const selectedApprovedIds = filteredRequests
        .filter((item) => item.status === 'APPROVED' && selectedRequestIds.includes(item.id))
        .map((item) => item.id)

      if (!selectedApprovedIds.length) {
        setSelectedRequestIds([])
        return
      }

      const { error: paidError } = await supabase
        .from('mob_payment')
        .update({
          status: 'PAID',
          paid_by: profile?.email || '',
          paid_at: new Date().toISOString(),
        })
        .in('id', selectedApprovedIds)

      if (paidError) throw new Error(paidError.message)

      setSelectedRequestIds([])
      await loadWorkspace(true)
      setSuccess(`${selectedApprovedIds.length} payment request${selectedApprovedIds.length > 1 ? 's' : ''} marked as paid.`)
    } catch (paidError) {
      setError(paidError.message || 'Failed to mark selected payment requests as paid.')
    } finally {
      setActionLoading(false)
    }
  }

  function toggleRequestSelection(requestId) {
    setSelectedRequestIds((prev) => (prev.includes(requestId) ? prev.filter((id) => id !== requestId) : [...prev, requestId]))
  }

  function toggleSelectAll() {
    const eligibleRequests = filteredRequests.filter((item) => item.status === 'SUBMITTED' || item.status === 'APPROVED')
    if (!eligibleRequests.length) return

    setSelectedRequestIds((prev) => {
      const allEligibleChecked = eligibleRequests.every((item) => prev.includes(item.id))
      if (allEligibleChecked) {
        return prev.filter((id) => !eligibleRequests.some((item) => item.id === id))
      }

      const next = new Set(prev)
      eligibleRequests.forEach((item) => next.add(item.id))
      return Array.from(next)
    })
  }

  const isRequestOwner = useCallback(
    (request) => {
      const currentEmail = String(profile?.email || '').trim().toLowerCase()
      if (!currentEmail) return false
      return String(request?.created_by || '').trim().toLowerCase() === currentEmail
    },
    [profile]
  )

  async function handleUploadPaymentProof(request) {
    if (!request || !paymentProofFiles.length) return

    setActionLoading(true)
    setDetailError('')
    setSuccess('')
    const uploadedPaths = []

    try {
      const uploadResult = await uploadRequestFiles({
        request,
        files: paymentProofFiles,
        uploadedBy: profile?.email || '',
        folder: 'payment-proof',
      })
      uploadedPaths.push(...uploadResult.uploadedPaths)

      const { error: attachmentInsertError } = await supabase.from('mob_payment_attachments').insert(uploadResult.attachmentRows)
      if (attachmentInsertError) throw new Error(attachmentInsertError.message)

      setPaymentProofFiles([])
      await loadWorkspace(true)
      await refreshSelectedRequestDetail(request.id)
      setSuccess(`Payment proof uploaded for ${request.invoice_number}.`)
    } catch (uploadError) {
      if (uploadedPaths.length) {
        await supabase.storage.from(PAYMENT_BUCKET).remove(uploadedPaths)
      }
      setDetailError(uploadError.message || 'Failed to upload payment proof.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleMarkPaid(request) {
    if (!request) return
    setActionLoading(true)
    setDetailError('')
    const uploadedPaths = []

    try {
      if (paymentProofFiles.length) {
        const uploadResult = await uploadRequestFiles({
          request,
          files: paymentProofFiles,
          uploadedBy: profile?.email || '',
          folder: 'payment-proof',
        })
        uploadedPaths.push(...uploadResult.uploadedPaths)

        const { error: attachmentInsertError } = await supabase.from('mob_payment_attachments').insert(uploadResult.attachmentRows)
        if (attachmentInsertError) throw new Error(attachmentInsertError.message)
      }

      const { error: paidError } = await supabase
        .from('mob_payment')
        .update({
          status: 'PAID',
          paid_by: profile?.email || '',
          paid_at: new Date().toISOString(),
        })
        .eq('id', request.id)

      if (paidError) throw new Error(paidError.message)

      await loadWorkspace(true)
      closeRequestDetail()
      setSuccess(`Request ${request.invoice_number} marked as paid.`)
    } catch (paymentError) {
      if (uploadedPaths.length) {
        await supabase.storage.from(PAYMENT_BUCKET).remove(uploadedPaths)
      }
      setDetailError(paymentError.message || 'Failed to mark payment request as paid.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleOpenAttachment(attachment) {
    if (!attachment) return

    setDetailError('')
    const { data, error: signedUrlError } = await supabase.storage.from(attachment.storage_bucket).createSignedUrl(attachment.storage_path, 300)
    if (signedUrlError) {
      setDetailError(signedUrlError.message)
      return
    }

    if (data?.signedUrl) {
      if (isImageAttachment(attachment)) {
        setImagePreview({ name: attachment.file_name, src: data.signedUrl })
        setImagePreviewZoom(1)
        setImagePreviewTool('zoom-in')
        setImagePreviewOrigin({ x: 50, y: 50 })
        setImagePreviewOffset({ x: 0, y: 0 })
        return
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    }
  }

  function resetImagePreviewState() {
    setImagePreview(null)
    setImagePreviewZoom(1)
    setImagePreviewTool('zoom-in')
    setImagePreviewOrigin({ x: 50, y: 50 })
    setImagePreviewOffset({ x: 0, y: 0 })
    imagePreviewDragRef.current = null
  }

  function handleImagePreviewWrapClick(event) {
    if (imagePreviewTool === 'pan') return

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
    if (imagePreviewTool !== 'pan' || imagePreviewZoom <= 1) return

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
    if (!dragState || imagePreviewTool !== 'pan' || imagePreviewZoom <= 1) return

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

  const canManagePaymentProofOnDetail =
    selectedRequest &&
    ((((selectedRequest.status === 'APPROVED' || selectedRequest.status === 'PAID') && canPay) || isRequestOwner(selectedRequest)))

  const selfModeRows = filteredRequests

  return (
    <section className={styles.page}>
      <div className={`${styles.panel} ${embedded ? styles.panelEmbedded : ''}`.trim()}>
        {showHeader ? (
          <div className={styles.header}>
            {!hideHeaderCopy ? (
              <div className={styles.headerCopy}>
                <p className={styles.eyebrow}>{hrgaMode ? 'HRGA' : 'MyARKLIFE'}</p>
                <h1 className={styles.title}>{panelTitle}</h1>
                {panelSubtitle ? <p className={styles.subtitle}>{panelSubtitle}</p> : null}
              </div>
            ) : null}

            <div className={styles.headerActions}>
              <div className={styles.headerActionsInline}>
                <label className={styles.searchField}>
                  <span>Search</span>
                  <input className={styles.input} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice, person, bank" />
                </label>
                <label className={styles.filterField}>
                  <span className={styles.label}>Status</span>
                  <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="ALL">All Status</option>
                    <option value="SUBMITTED">Submitted</option>
                    <option value="APPROVED">Approved</option>
                    <option value="PAID">Paid</option>
                  </select>
                </label>
                <label className={styles.filterField}>
                  <span className={styles.label}>Requester</span>
                  <select className={styles.select} value={requesterFilter} onChange={(event) => setRequesterFilter(event.target.value)}>
                    <option value="ALL">All Requester</option>
                    {requesterOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                {hrgaMode ? (
                  <>
                    <label className={styles.filterField}>
                      <span className={styles.label}>Month</span>
                      <select className={styles.select} value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
                        <option value="">All Months</option>
                        {monthFilterOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.filterField}>
                      <span className={styles.label}>Day</span>
                      <select className={styles.select} value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}>
                        <option value="">All Days</option>
                        {dayFilterOptions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.filterField}>
                      <span className={styles.label}>Year</span>
                      <select className={styles.select} value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                        <option value="">All Years</option>
                        {yearFilterOptions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : null}
                {allowCreate ? (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => {
                      setDraft(createDraft(profile))
                      setEditingRequest(null)
                      setShowCreateModal(true)
                    }}
                  >
                    {createLabel}
                  </button>
                ) : (
                  <div className={styles.headerButtonGroup}>
                    {canApprove ? (
                      <button
                        type="button"
                        className={styles.compactApproveButton}
                        onClick={() => void handleApproveSelected()}
                        disabled={actionLoading || !selectedSubmittedCount}
                      >
                        {actionLoading ? 'Saving...' : `Approve${selectedSubmittedCount ? ` (${selectedSubmittedCount})` : ''}`}
                      </button>
                    ) : null}
                    {canPay ? (
                      <button
                        type="button"
                        className={styles.compactApproveButton}
                        onClick={() => void handleMarkPaidSelected()}
                        disabled={actionLoading || !selectedApprovedCount}
                      >
                        {actionLoading ? 'Saving...' : `Mark as Paid${selectedApprovedCount ? ` (${selectedApprovedCount})` : ''}`}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.ghostButton}
                      onClick={() => {
                        setSearch('')
                        setStatusFilter('ALL')
                        setRequesterFilter('ALL')
                        setMonthFilter('')
                        setDayFilter('')
                        setYearFilter('')
                      }}
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : hrgaMode ? (
          <div className={styles.headerActionsInline} style={{ marginBottom: '14px' }}>
            <label className={styles.searchField}>
              <span>Search</span>
              <input className={styles.input} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice, person, bank" />
            </label>
            <label className={styles.filterField}>
              <span className={styles.label}>Status</span>
              <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="ALL">All Status</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="APPROVED">Approved</option>
                <option value="PAID">Paid</option>
              </select>
            </label>
            <label className={styles.filterField}>
              <span className={styles.label}>Requester</span>
              <select className={styles.select} value={requesterFilter} onChange={(event) => setRequesterFilter(event.target.value)}>
                <option value="ALL">All Requester</option>
                {requesterOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.filterField}>
              <span className={styles.label}>Month</span>
              <select className={styles.select} value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
                <option value="">All Months</option>
                {monthFilterOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.filterField}>
              <span className={styles.label}>Day</span>
              <select className={styles.select} value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}>
                <option value="">All Days</option>
                {dayFilterOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.filterField}>
              <span className={styles.label}>Year</span>
              <select className={styles.select} value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                <option value="">All Years</option>
                {yearFilterOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.headerButtonGroup}>
              {canApprove ? (
                <button
                  type="button"
                  className={styles.compactApproveButton}
                  onClick={() => void handleApproveSelected()}
                  disabled={actionLoading || !selectedSubmittedCount}
                >
                  {actionLoading ? 'Saving...' : `Approve${selectedSubmittedCount ? ` (${selectedSubmittedCount})` : ''}`}
                </button>
              ) : null}
              {canPay ? (
                <button
                  type="button"
                  className={styles.compactApproveButton}
                  onClick={() => void handleMarkPaidSelected()}
                  disabled={actionLoading || !selectedApprovedCount}
                >
                  {actionLoading ? 'Saving...' : `Mark as Paid${selectedApprovedCount ? ` (${selectedApprovedCount})` : ''}`}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => {
                  setSearch('')
                  setStatusFilter('ALL')
                  setRequesterFilter('ALL')
                  setMonthFilter('')
                  setDayFilter('')
                  setYearFilter('')
                }}
              >
                Reset
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className={shellStyles.errorText}>{error}</p> : null}
        {success ? <p className={shellStyles.successText}>{success}</p> : null}

        {loading ? (
          <div className={shellStyles.emptyState}>Loading MOB payment submission...</div>
        ) : hrgaMode ? (
          filteredRequests.length ? (
            <section className={styles.listSection}>
          <div className={styles.columnHead}>
            <div className={styles.outstandingWrap}>
              <span className={styles.outstandingLabel}>Total Outstanding</span>
              <strong className={styles.outstandingValue}>
                {formatCurrency(filteredRequests.filter((item) => item.status !== 'PAID').reduce((sum, item) => sum + Number(item.amount || 0), 0))}
                  </strong>
                </div>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.checkboxColumn}>
                        <input
                          type="checkbox"
                          checked={allSelectableChecked}
                          onChange={toggleSelectAll}
                          disabled={!(canApprove || canPay) || !actionableRequests.length}
                          aria-label="Select all actionable requests"
                        />
                      </th>
                      <th>No Invoice</th>
                      <th>Submission Date</th>
                      <th>Submitted By</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((item) => (
                      <tr key={item.id}>
                        <td className={styles.checkboxColumn}>
                          <input
                            type="checkbox"
                            checked={selectedRequestIds.includes(item.id)}
                            onChange={() => toggleRequestSelection(item.id)}
                            disabled={!(canApprove || canPay) || (item.status !== 'SUBMITTED' && item.status !== 'APPROVED')}
                            aria-label={`Select ${item.invoice_number || 'payment request'}`}
                          />
                        </td>
                        <td>{item.invoice_number || '-'}</td>
                        <td>{formatDateTime(item.created_at)}</td>
                        <td>{item.employee_name_snapshot || fallbackDisplayName(item.employee_email_snapshot)}</td>
                        <td>{item.category_name || '-'}</td>
                        <td className={styles.amountCell}>{formatCurrency(item.amount)}</td>
                        <td>
                          <span
                            className={`${styles.statusPill} ${
                              item.status === 'PAID'
                                ? styles.statusPillPaid
                                : item.status === 'APPROVED'
                                  ? styles.statusPillApproved
                                  : styles.statusPillSubmitted
                            }`.trim()}
                          >
                            {item.status === 'PAID' ? 'Paid' : item.status === 'APPROVED' ? 'Approved' : 'Submitted'}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actionCell}>
                            {item.status === 'SUBMITTED' ? (
                              <>
                                {canApprove ? (
                                  <button
                                    type="button"
                                    className={`${styles.iconButton} ${styles.iconButtonSuccess}`.trim()}
                                    onClick={() => void handleApproveRequest(item)}
                                    title="Approve"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="m5 12 4.2 4.2L19 6.5" />
                                    </svg>
                                  </button>
                                ) : null}
                                <button type="button" className={styles.iconButton} onClick={() => openRequestDetail(item)} title="View detail">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                </button>
                              </>
                            ) : item.status === 'APPROVED' ? (
                              <>
                                <button type="button" className={styles.iconButton} onClick={() => openRequestDetail(item)} title="View detail">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                </button>
                                {canPay ? (
                                  <button
                                    type="button"
                                    className={`${styles.iconButton} ${styles.iconButtonSuccess}`.trim()}
                                    onClick={() => void handleMarkPaid(item)}
                                    title="Mark as paid"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M12 1v22" />
                                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6" />
                                    </svg>
                                  </button>
                                ) : null}
                              </>
                            ) : (
                              <button type="button" className={styles.iconButton} onClick={() => openRequestDetail(item)} title="View detail">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <div className={styles.emptyColumn}>No payment requests match this filter yet.</div>
          )
        ) : selfModeRows.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {selfModeRows.map((item) => (
                  <tr key={item.id}>
                    <td>{item.invoice_number || '-'}</td>
                    <td>{item.category_name || '-'}</td>
                    <td>{formatCurrency(item.amount)}</td>
                    <td>{item.status || '-'}</td>
                    <td>{formatDateTime(item.created_at)}</td>
                    <td>
                      <button type="button" className={styles.tertiaryButton} onClick={() => openRequestDetail(item)}>
                        View Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyColumn}>No payment request yet.</div>
        )}
      </div>

      {showCreateModal ? (
        <div className={shellStyles.modalOverlay} onClick={closeCreateModal}>
          <div className={`${shellStyles.modalCard} ${styles.modalCard}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>New Request</p>
                <h2 className={styles.modalTitle}>MOB Group Payment Request</h2>
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
              <div className={styles.formRowThree}>
                <div className={styles.field}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <label className={styles.label}>Invoice Number *</label>
                    {!editingRequest ? (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                        <input
                          type="checkbox"
                          checked={draft.no_invoice_number}
                          onChange={(event) => {
                            void handleNoInvoiceNumberChange(event.target.checked)
                          }}
                        />
                        No Invoice Number
                      </label>
                    ) : null}
                  </div>
                  <input
                    className={styles.input}
                    value={draft.invoice_number}
                    disabled={draft.no_invoice_number}
                    onChange={(event) => setDraft((prev) => ({ ...prev, invoice_number: normalizeUppercase(event.target.value) }))}
                    placeholder={draft.no_invoice_number ? 'Auto-generated internal invoice number' : ''}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Category *</label>
                  <select className={styles.select} value={draft.category_id} onChange={(event) => setDraft((prev) => ({ ...prev, category_id: event.target.value }))}>
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

              <div className={styles.formRowThree}>
                <div className={styles.field}>
                  <label className={styles.label}>Bank Name *</label>
                  <input
                    className={styles.input}
                    value={draft.bank_name}
                    onChange={(event) => setDraft((prev) => ({ ...prev, bank_name: normalizeUppercase(event.target.value) }))}
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
                  placeholder="Add supporting notes"
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
                  {selectedRequest.employee_name_snapshot || '-'} • {selectedRequest.employee_email_snapshot || selectedRequest.account_name}
                </p>
              </div>
              <span
                className={`${styles.statusBadge} ${
                  selectedRequest.status === 'PAID'
                    ? styles.statusPaid
                    : selectedRequest.status === 'APPROVED'
                      ? styles.statusApproved
                      : styles.statusSubmitted
                }`.trim()}
              >
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
                <strong>{selectedRequest.employee_name_snapshot || selectedRequest.created_by_display_name || '-'}</strong>
              </div>
              <div className={styles.metricCard}>
                <span>Approved By</span>
                <strong>{selectedRequest.approved_by_display_name || '-'}</strong>
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

            {canManagePaymentProofOnDetail ? (
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
              {!hrgaMode && selectedRequest.status === 'SUBMITTED' ? (
                <>
                  <button type="button" className={styles.secondaryButton} onClick={() => openEditRequest(selectedRequest)} disabled={actionLoading}>
                    Edit
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={() => void handleDeleteRequest(selectedRequest)} disabled={actionLoading}>
                    Delete
                  </button>
                </>
              ) : null}
              {selectedRequest.status === 'SUBMITTED' && canApprove ? (
                <button type="button" className={styles.primaryButton} onClick={() => void handleApproveRequest(selectedRequest)} disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Approve'}
                </button>
              ) : null}
              {paymentProofFiles.length && canManagePaymentProofOnDetail ? (
                <button type="button" className={styles.secondaryButton} onClick={() => void handleUploadPaymentProof(selectedRequest)} disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Upload Payment Proof'}
                </button>
              ) : null}
              {selectedRequest.status === 'APPROVED' && canPay ? (
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
        <div className={shellStyles.modalOverlay} onClick={resetImagePreviewState}>
          <div className={`${shellStyles.modalCard} ${styles.imageModal}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Attachment Preview</p>
                <h2 className={styles.modalTitle}>{imagePreview.name}</h2>
              </div>
            </div>
            <div className={shellStyles.reimbursementPreviewActions}>
              <button
                type="button"
                className={`${styles.secondaryButton} ${imagePreviewTool === 'zoom-out' ? shellStyles.reimbursementPreviewButtonActive : ''}`.trim()}
                onClick={() => {
                  setImagePreviewTool('zoom-out')
                }}
              >
                Zoom Out
              </button>
              <button
                type="button"
                className={`${styles.secondaryButton} ${imagePreviewTool === 'pan' ? shellStyles.reimbursementPreviewButtonActive : ''}`.trim()}
                onClick={() => {
                  setImagePreviewTool('pan')
                }}
              >
                Pan
              </button>
              <button
                type="button"
                className={`${styles.secondaryButton} ${imagePreviewTool === 'zoom-in' ? shellStyles.reimbursementPreviewButtonActive : ''}`.trim()}
                onClick={() => {
                  setImagePreviewTool('zoom-in')
                }}
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
                  setImagePreviewTool('zoom-in')
                }}
              >
                Reset
              </button>
              <button type="button" className={styles.secondaryButton} onClick={resetImagePreviewState}>
                Close
              </button>
            </div>
            <div
              className={shellStyles.reimbursementImagePreviewWrap}
              onClick={handleImagePreviewWrapClick}
              onPointerDown={handleImagePreviewPointerDown}
              onPointerMove={handleImagePreviewPointerMove}
              onPointerUp={handleImagePreviewPointerUp}
              onPointerCancel={handleImagePreviewPointerUp}
              style={{ cursor: imagePreviewTool === 'pan' && imagePreviewZoom > 1 ? 'grab' : imagePreviewTool === 'zoom-out' ? 'zoom-out' : 'zoom-in' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview.src}
                alt={imagePreview.name}
                className={shellStyles.reimbursementImagePreview}
                draggable={false}
                style={{
                  transform: `translate(${imagePreviewOffset.x}px, ${imagePreviewOffset.y}px) scale(${imagePreviewZoom})`,
                  transformOrigin: `${imagePreviewOrigin.x}% ${imagePreviewOrigin.y}%`,
                  cursor: imagePreviewTool === 'pan' && imagePreviewZoom > 1 ? 'grab' : imagePreviewTool === 'zoom-out' ? 'zoom-out' : 'zoom-in',
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
