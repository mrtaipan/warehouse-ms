'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { deliverySupabase } from '@/lib/delivery-supabase'
import { ADMIN_EMAIL } from '@/utils/permissions'
import { createClient } from '@/utils/supabase/browser'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import { EmptyState, Modal, ModuleHeader, StatusMessage } from './delivery-report-client'
import { GROUPS, formatDate, jakartaEnd, jakartaStart, romanMonth, safeNumber, todayIso } from './delivery-report-helpers'
import styles from './delivery-report.module.css'

const TABS = [
  ['registration', 'Return Registration'],
  ['receiving', 'Receiving Confirmation'],
  ['issues', 'Order Issues'],
  ['search', 'Product Search'],
]

const RETURN_FINANCIAL_FIELDS = [
  ['ongkir_masuk', 'Inbound Shipping Cost'],
  ['ongkir_keluar', 'Outbound Shipping Cost'],
  ['nilai_refund_kompensasi', 'Loss Value'],
  ['total_retur', 'Returned Item Value'],
]

const RETURN_FINANCIAL_HELP = {
  nilai_refund_kompensasi: 'Nilai refund atau kompensasi yang kita berikan kepada customer.',
  ongkir_keluar: 'Biaya ekspedisi tambahan untuk pengiriman dari gudang ke customer.',
  ongkir_masuk: 'Biaya ekspedisi tambahan untuk pengiriman dari customer ke gudang.',
  total_retur: 'Nilai yang akan menjadi acuan asuransi pengiriman.',
}

const ORDER_ISSUE_COST_HELP = 'Biaya timbul mencakup biaya harga barang yang direfund/biaya ekspedisi tambahan/biaya kompensasi.'

const RETURN_STATUS_OPTIONS = {
  Pending: {
    className: styles.resolutionStatusPending,
    description: 'The customer has submitted a return, but the item has not been shipped yet.',
    label: 'Pending',
  },
  Sending: {
    className: styles.resolutionStatusSending,
    description: 'The customer has shipped the item to the warehouse.',
    label: 'Sending',
  },
  Cancel: {
    className: styles.resolutionStatusCancel,
    description: 'The return case will not proceed.',
    label: 'Cancel',
  },
}

const ACTIVE_RETURN_STATUSES = new Set(['Pending', 'Sending'])

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00+07:00`)
  value.setDate(value.getDate() + days)
  return value.toISOString().slice(0, 10)
}

function countByValue(rows, key, expected) {
  return rows.filter((row) => String(row?.[key] || '').trim().toLowerCase() === String(expected).trim().toLowerCase()).length
}

function getTopCounts(rows, key, limit = 3) {
  const counts = new Map()

  rows.forEach((row) => {
    const value = String(row?.[key] || '').trim()
    if (!value) return
    counts.set(value, (counts.get(value) || 0) + 1)
  })

  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .slice(0, limit)
    .map(([label, count]) => `${label} (${count})`)
}

function formatMoney(value) {
  return new Intl.NumberFormat('id-ID', {
    currency: 'IDR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(safeNumber(value))
}

function normalizeNullableBoolean(value) {
  if (value === true) return true
  if (value === false) return false
  return null
}

function getReturnActionRules(actionMeta) {
  return {
    replacementRequired: actionMeta ? normalizeNullableBoolean(actionMeta.replacement_required) : null,
    requireRefundValue: actionMeta ? normalizeNullableBoolean(actionMeta.requires_refund_value) : null,
    requiresReturn: actionMeta ? normalizeNullableBoolean(actionMeta.requires_return) : null,
  }
}

function cleanText(value) {
  return String(value || '').trim()
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase()
}

function cleanNullableText(value) {
  const text = cleanText(value)
  return text || null
}

function cleanNullableUpper(value) {
  const text = cleanUpper(value)
  return text || null
}

function cleanDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function cleanNumeric(value) {
  const normalized = String(value || '').replace(/\./g, '').replace(/,/g, '.').trim()
  if (!normalized) return null
  const numberValue = Number(normalized)
  return Number.isFinite(numberValue) ? numberValue : null
}

function dateOnly(value) {
  return String(value || '').slice(0, 10)
}

function formatShortDate(value) {
  const dateValue = dateOnly(value)
  if (!dateValue) return '-'
  const date = new Date(`${dateValue}T00:00:00+07:00`)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
  }).format(date).replace(',', '')
}

function normalizeBarcodeRuleKey(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '')
}

function sanitizeBarcodePattern(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '')
}

function isRefundOnlyCase(row) {
  return String(row?.retur_action || '').toLowerCase().includes('refund')
}

function ensureBulletText(value) {
  const lines = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^>\s*/, '').trim())
    .filter(Boolean)
  return lines.length ? lines.map((line) => `> ${line}`).join('\n') : ''
}

function hasMeaningfulBulletText(value) {
  return String(value || '').replace(/>/g, '').trim() !== ''
}

function getMonthDateRange(monthValue, fallbackDate) {
  const monthText = String(monthValue || fallbackDate.slice(0, 7)).slice(0, 7)
  const start = new Date(`${monthText}-01T00:00:00+07:00`)
  if (Number.isNaN(start.getTime())) return { from: fallbackDate, to: fallbackDate }
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  end.setDate(0)
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}

function normalizeIssueHandlingKey(value) {
  return cleanUpper(value)
}

function isTruthyFlag(value) {
  return value === true || String(value || '').trim().toLowerCase() === 'true'
}

function formatIssueTeamLabel(value) {
  return cleanUpper(value) === 'INSTANT PACKING' ? 'INST. PACKER' : value || '-'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getGroupPrefix(group) {
  if (group === 'MOB') return 'M'
  if (group === 'OI') return 'O'
  return 'A'
}

function timestampWithCurrentJakartaTime(dateValue) {
  const dateText = cleanText(dateValue) || todayIso()
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).formatToParts(new Date())
  const map = Object.fromEntries(timeParts.map((part) => [part.type, part.value]))
  return new Date(`${dateText}T${map.hour}:${map.minute}:${map.second}+07:00`).toISOString()
}

function labelText(label, isRequired = false) {
  return (
    <>
      {label}
      {isRequired ? <span className={styles.requiredStar}>*</span> : null}
    </>
  )
}

function labelWithInfo(label, helper, isRequired = false) {
  return (
    <>
      {labelText(label, isRequired)}
      <span className={styles.infoWrap}>
        <span className={styles.infoDot}>ℹ️</span>
        <span className={styles.infoTooltip}>{helper}</span>
      </span>
    </>
  )
}

function getCaseWarningMeta(row, today) {
  if (row?.need_prioritized) {
    return {
      label: 'Prioritized',
      rank: 3,
      tone: styles.resolutionWarningPriority,
    }
  }

  if (!ACTIVE_RETURN_STATUSES.has(row?.status_barang)) {
    return {
      label: 'Normal',
      rank: 0,
      tone: '',
    }
  }

  const deadlineValue = String(row?.batas_tanggal_retur || '').slice(0, 10)
  if (!deadlineValue) {
    return {
      label: 'Normal',
      rank: 0,
      tone: '',
    }
  }

  const deadline = new Date(`${deadlineValue}T00:00:00+07:00`).getTime()
  const current = new Date(`${today}T00:00:00+07:00`).getTime()
  const diffDays = Math.round((deadline - current) / 86400000)

  if (diffDays < 0) {
    return {
      label: 'Overdue',
      rank: 2,
      tone: styles.resolutionWarningOverdue,
    }
  }

  if (diffDays <= 1) {
    return {
      label: 'H-1',
      rank: 1,
      tone: styles.resolutionWarningDue,
    }
  }

  return {
    label: 'Normal',
    rank: 0,
    tone: '',
  }
}

function normalizeReturnPayload(form, code, actorName) {
  return {
    alamat: cleanText(form.alamat),
    batas_tanggal_retur: timestampWithCurrentJakartaTime(form.batas_tanggal_retur),
    courier_name: cleanNullableUpper(form.courier_name),
    courier_service: cleanNullableUpper(form.courier_service),
    group_order: cleanUpper(form.group_order),
    internal_external: cleanText(form.internal_external),
    keterangan_tambahan: cleanNullableText(form.keterangan_tambahan),
    kode_kejadian: cleanUpper(code),
    nama_customer: cleanUpper(form.nama_customer),
    need_prioritized: Boolean(form.need_prioritized),
    nilai_refund_kompensasi: cleanNumeric(form.nilai_refund_kompensasi),
    no_handphone: cleanDigits(form.no_handphone),
    no_resi_pengiriman: cleanUpper(form.no_resi_pengiriman),
    nomor_tim: cleanUpper(form.nomor_tim),
    note_konsumen: cleanNullableText(form.note_konsumen),
    ongkir_keluar: cleanNumeric(form.ongkir_keluar),
    ongkir_masuk: cleanNumeric(form.ongkir_masuk),
    order_id: cleanUpper(form.order_id),
    pic: cleanUpper(actorName),
    produk_diretur: cleanNullableText(form.produk_diretur),
    produk_pengganti: cleanNullableText(form.produk_pengganti),
    retur_action: cleanNullableText(form.retur_action),
    retur_reason: cleanNullableText(form.retur_reason),
    status_barang: cleanText(form.status_barang),
    tanggal_pengajuan: timestampWithCurrentJakartaTime(form.tanggal_pengajuan),
    total_retur: cleanNumeric(form.total_retur),
  }
}

function normalizeIssuePayload(form, actorName) {
  return {
    alasan_bermasalah: cleanNullableText(form.alasan_bermasalah),
    biaya_timbul: cleanNumeric(form.biaya_timbul),
    group_order: cleanUpper(form.group_order),
    keterangan: cleanNullableText(form.keterangan),
    nama: cleanUpper(form.nama),
    no_hp: cleanDigits(form.no_hp),
    order_id: cleanUpper(form.order_id),
    pic: cleanUpper(actorName),
    produk_bermasalah: ensureBulletText(form.produk_bermasalah),
    produk_pengganti: cleanNullableText(ensureBulletText(form.produk_pengganti)),
    tim: cleanNullableUpper(form.tim),
    tindak_lanjut: cleanNullableText(form.tindak_lanjut),
  }
}

const GROUP_CHOICE_CLASS = {
  ARKLINE: styles.groupChoiceArkline,
  MOB: styles.groupChoiceMob,
  OI: styles.groupChoiceOi,
}

const TYPE_CHOICE_CLASS = {
  External: styles.typeChoiceExternal,
  Internal: styles.typeChoiceInternal,
}

const ISSUE_TEAMS = ['TIM 1', 'TIM 2', 'TIM 3', 'INSTANT PACKING']

const blankReturn = (date) => ({
  alamat: '',
  batas_tanggal_retur: addDays(date, 14),
  courier_name: '',
  courier_service: '',
  group_order: 'MOB',
  internal_external: 'Internal',
  keterangan_tambahan: '',
  nama_customer: '',
  need_prioritized: false,
  nilai_refund_kompensasi: '',
  no_handphone: '',
  no_resi_pengiriman: '',
  nomor_tim: '',
  note_konsumen: '',
  ongkir_keluar: '',
  ongkir_masuk: '',
  order_id: '',
  produk_diretur: '',
  produk_pengganti: '',
  retur_action: '',
  retur_reason: '',
  status_barang: 'Pending',
  tanggal_pengajuan: date,
  total_retur: '',
})

const blankIssue = () => ({
  alasan_bermasalah: '',
  biaya_timbul: '',
  group_order: 'ARKLINE',
  keterangan: '',
  nama: '',
  no_hp: '',
  order_id: '',
  produk_bermasalah: '',
  produk_pengganti: '',
  tim: 'TIM 1',
  tindak_lanjut: '',
})

export default function ResolutionCenter() {
  const supabase = useMemo(() => createClient(), [])
  const today = useMemo(() => todayIso(), [])
  const [activeTab, setActiveTab] = useState('registration')
  const [pic, setPic] = useState('')
  const [caseListAccess, setCaseListAccess] = useState({ isAdmin: false, name: '', ready: false })
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [filters, setFilters] = useState({ courier: '', from: addDays(today, -6), group: '', search: '', to: today, warningOnly: false })
  const [cases, setCases] = useState([])
  const [issues, setIssues] = useState([])
  const [masters, setMasters] = useState({ actions: [], barcodeRules: [], couriers: [], issueActions: [], issueReasons: [], reasons: [], services: [] })
  const [returnForm, setReturnForm] = useState(blankReturn(today))
  const [issueForm, setIssueForm] = useState(blankIssue())
  const [editingIssueId, setEditingIssueId] = useState(null)
  const [issueDetail, setIssueDetail] = useState(null)
  const [issueDetailReadonly, setIssueDetailReadonly] = useState(false)
  const [issueFilters, setIssueFilters] = useState({ from: addDays(today, -6), group: '', search: '', to: today })
  const [issueSummaryMonth, setIssueSummaryMonth] = useState(today.slice(0, 7))
  const [caseCode, setCaseCode] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailDraft, setDetailDraft] = useState(null)
  const [detailMode, setDetailMode] = useState('view')
  const [detailReadonly, setDetailReadonly] = useState(false)
  const [receivingAddOpen, setReceivingAddOpen] = useState(false)
  const [receivingAddSearch, setReceivingAddSearch] = useState('')
  const [receivingAddSelectedIds, setReceivingAddSelectedIds] = useState([])
  const [receivingReprintOpen, setReceivingReprintOpen] = useState(false)
  const [receivingReprintSearch, setReceivingReprintSearch] = useState('')
  const [receivingSelectedIds, setReceivingSelectedIds] = useState([])
  const [receivingReprintSelectedIds, setReceivingReprintSelectedIds] = useState([])
  const [receivingFilters, setReceivingFilters] = useState({ courier: '', group: '', search: '' })
  const [productSearch, setProductSearch] = useState('')
  const [productSearchFilters, setProductSearchFilters] = useState({ group: '', scope: '', type: '' })

  const loadMasters = useCallback(async () => {
    const results = await Promise.all([
      deliverySupabase.from('Retur_Reason').select('*').neq('is_active', false).order('id'),
      deliverySupabase.from('Retur_Action').select('*').neq('is_active', false).order('id'),
      deliverySupabase.from('Delivery_Courier').select('*').neq('is_active', false).order('nama'),
      deliverySupabase.from('Courier_Subclass').select('*').neq('is_active', false).order('courier_name'),
      deliverySupabase.from('Order_Issue').select('*').neq('is_active', false).order('id'),
      deliverySupabase.from('Order_Handling').select('*').neq('is_active', false).order('id'),
      deliverySupabase.from('Barcode_Rules').select('result_value, pattern, match_type, priority').order('priority', { ascending: true }),
    ])
    const error = results.find((result) => result.error)?.error
    if (error) setStatus({ type: 'error', message: `Failed to load Resolution Center master data: ${error.message}` })
    setMasters({
      actions: results[1].data || [],
      couriers: results[2].data || [],
      issueActions: results[5].data || [],
      issueReasons: results[4].data || [],
      reasons: results[0].data || [],
      services: results[3].data || [],
      barcodeRules: results[6].data || [],
    })
  }, [])

  const getActorContext = useCallback(async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) throw error
    if (!user) throw new Error('User session was not found.')

    const { data: profile, error: profileError } = await getProfileByAuthenticatedUser(supabase, user, 'display_name, role')
    if (profileError) throw profileError

    const metadataName =
      String(user.user_metadata?.display_name || '').trim() ||
      String(user.user_metadata?.full_name || '').trim() ||
      String(user.user_metadata?.name || '').trim()
    const displayName = String(profile?.display_name || metadataName || user.email || '').trim()
    const isAdminUser = String(user.email || '').trim().toLowerCase() === ADMIN_EMAIL || String(profile?.role || '').trim().toLowerCase() === 'admin'

    if (!displayName) throw new Error('User display name was not found. Please complete the profile first.')
    return { displayName, isAdmin: isAdminUser }
  }, [supabase])

  const getActorDisplayName = useCallback(async () => {
    const { displayName, isAdmin } = await getActorContext()
    setCaseListAccess({ isAdmin, name: cleanUpper(displayName), ready: true })
    return displayName
  }, [getActorContext])

  const loadCases = useCallback(async () => {
    if (!caseListAccess.ready) return
    let query = deliverySupabase
      .from('Error_Retur_Cases')
      .select('*')
      .gte('tanggal_pengajuan', jakartaStart(filters.from))
      .lte('tanggal_pengajuan', jakartaEnd(filters.to))
      .order('tanggal_pengajuan', { ascending: false })
    if (filters.group) query = query.eq('group_order', filters.group)
    if (filters.courier) query = query.eq('courier_name', filters.courier)
    if (!caseListAccess.isAdmin) {
      if (!caseListAccess.name) {
        setCases([])
        return
      }
      query = query.eq('pic', caseListAccess.name)
    }
    const { data, error } = await query
    if (error) setStatus({ type: 'error', message: `Failed to load return cases: ${error.message}` })
    else setCases(data || [])
  }, [caseListAccess.isAdmin, caseListAccess.name, caseListAccess.ready, filters.courier, filters.from, filters.group, filters.to])

  const loadIssues = useCallback(async () => {
    if (!caseListAccess.ready) return
    let query = deliverySupabase.from('Order_Issue_Cases').select('*').order('created_at', { ascending: false }).limit(5000)
    if (!caseListAccess.isAdmin) {
      if (!caseListAccess.name) {
        setIssues([])
        return
      }
      query = query.eq('pic', caseListAccess.name)
    }
    const { data, error } = await query
    if (error) setStatus({ type: 'error', message: `Failed to load order issues: ${error.message}` })
    else setIssues(data || [])
  }, [caseListAccess.isAdmin, caseListAccess.name, caseListAccess.ready])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMasters()
      loadCases()
      loadIssues()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCases, loadIssues, loadMasters])

  useEffect(() => {
    let ignore = false

    getActorContext()
      .then(({ displayName, isAdmin }) => {
        if (!ignore) {
          setPic(displayName)
          setCaseListAccess({ isAdmin, name: cleanUpper(displayName), ready: true })
        }
      })
      .catch((error) => {
        if (!ignore) {
          setCaseListAccess({ isAdmin: false, name: '', ready: true })
          setStatus({ type: 'error', message: error.message || 'Failed to load signed-in user.' })
        }
      })

    return () => {
      ignore = true
    }
  }, [getActorContext])

  const generateNextCaseCode = useCallback(async (groupOrder, submissionDate) => {
    const normalizedGroup = cleanUpper(groupOrder || 'ARKLINE')
    const date = new Date(`${submissionDate || today}T00:00:00+07:00`)
    const codePrefix = `${getGroupPrefix(normalizedGroup)}${romanMonth(date)}${String(date.getFullYear()).slice(-2)}-`
    const { data, error } = await deliverySupabase
      .from('Error_Retur_Cases')
      .select('kode_kejadian')
      .eq('group_order', normalizedGroup)
      .like('kode_kejadian', `${codePrefix}%`)
      .order('created_at', { ascending: false })
      .limit(2000)

    if (error) throw error

    const maxNumber = (data || []).reduce((max, row) => {
      const value = String(row.kode_kejadian || '')
      if (!value.startsWith(codePrefix)) return max
      const numberPart = Number.parseInt(value.slice(codePrefix.length), 10)
      return Number.isFinite(numberPart) && numberPart > max ? numberPart : max
    }, 0)

    return `${codePrefix}${maxNumber + 1}`
  }, [today])

  useEffect(() => {
    let ignore = false
    const timer = window.setTimeout(() => {
      generateNextCaseCode(returnForm.group_order, returnForm.tanggal_pengajuan)
        .then((nextCode) => {
          if (!ignore) setCaseCode(nextCode)
        })
        .catch((error) => {
          if (!ignore) setStatus({ type: 'error', message: `Failed to generate case code: ${error.message}` })
        })
    }, 250)

    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [generateNextCaseCode, returnForm.group_order, returnForm.tanggal_pengajuan])

  const accessibleCases = useMemo(() => {
    if (!caseListAccess.ready) return []
    if (caseListAccess.isAdmin) return cases
    return cases.filter((row) => [row.pic, row.created_by].some((value) => cleanUpper(value) === caseListAccess.name))
  }, [caseListAccess.isAdmin, caseListAccess.name, caseListAccess.ready, cases])

  const visibleCases = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase()
    return accessibleCases.filter((row) => {
      if (filters.warningOnly && getCaseWarningMeta(row, today).rank <= 0) return false
      if (!keyword) return true
      return [row.kode_kejadian, row.order_id, row.no_resi_pengiriman, row.nama_customer].some((value) => String(value || '').toLowerCase().includes(keyword))
    })
  }, [accessibleCases, filters.search, filters.warningOnly, today])

  const casesWithWarningMeta = useMemo(() => {
    return accessibleCases.map((row) => ({ meta: getCaseWarningMeta(row, today), row }))
  }, [accessibleCases, today])

  const caseListStats = useMemo(() => {
    const visibleWithWarningMeta = visibleCases.map((row) => ({ meta: getCaseWarningMeta(row, today), row }))
    const warning = visibleWithWarningMeta.filter(({ meta }) => meta.rank === 1 || meta.rank === 3).length
    const overdue = visibleWithWarningMeta.filter(({ meta }) => meta.rank === 2).length
    return { overdue, warning }
  }, [today, visibleCases])

  const courierOptions = useMemo(() => {
    return Array.from(new Set(accessibleCases.map((row) => cleanUpper(row.courier_name)).filter(Boolean))).sort()
  }, [accessibleCases])

  const stats = useMemo(() => {
    const warning = casesWithWarningMeta.filter(({ meta }) => meta.rank === 1).length
    const overdue = casesWithWarningMeta.filter(({ meta }) => meta.rank === 2).length
    const internal = countByValue(accessibleCases, 'internal_external', 'Internal')
    const external = countByValue(accessibleCases, 'internal_external', 'External')
    return { external, internal, overdue, warning }
  }, [accessibleCases, casesWithWarningMeta])

  const warningRows = useMemo(() => {
    return casesWithWarningMeta
      .filter(({ meta }) => meta.rank > 0)
      .sort((first, second) => {
        if (second.meta.rank !== first.meta.rank) return second.meta.rank - first.meta.rank
        return String(first.row.batas_tanggal_retur || '').localeCompare(String(second.row.batas_tanggal_retur || ''))
      })
      .slice(0, 6)
  }, [casesWithWarningMeta])

  const quickInsights = useMemo(() => {
    if (!accessibleCases.length) {
      return [
        {
          detail: 'Insights will appear after real case data is loaded.',
          title: 'No data yet',
        },
      ]
    }

    const statusBreakdown = getTopCounts(accessibleCases, 'status_barang', 4)
    const topPic = getTopCounts(accessibleCases, 'pic', 3)
    const topGroups = getTopCounts(accessibleCases, 'group_order', 3)
    const topReasons = getTopCounts(accessibleCases, 'retur_reason', 3)
    const topActions = getTopCounts(accessibleCases, 'retur_action', 3)
    const totalLoss = accessibleCases.reduce((sum, row) => sum + safeNumber(row.nilai_refund_kompensasi), 0)
    const outboundCost = accessibleCases.reduce((sum, row) => sum + safeNumber(row.ongkir_keluar), 0)
    const inboundCost = accessibleCases.reduce((sum, row) => sum + safeNumber(row.ongkir_masuk), 0)

    return [
      {
        detail: statusBreakdown.join(', ') || 'No status data yet.',
        title: 'Status Breakdown',
      },
      {
        detail: topPic.join(', ') || 'No PIC data yet.',
        title: 'Top Entry PIC',
      },
      {
        detail: topGroups.join(', ') || 'No group data yet.',
        title: 'Most Affected Group',
      },
      {
        detail: topReasons.join(', ') || 'No return reason data yet.',
        title: 'Top Return Reason',
      },
      {
        detail: topActions.join(', ') || 'No follow-up action data yet.',
        title: 'Most Common Follow-up',
      },
      {
        detail: `Loss: ${formatMoney(totalLoss)} | Outbound: ${formatMoney(outboundCost)} | Inbound: ${formatMoney(inboundCost)}`,
        title: 'Nominal Summary',
      },
    ]
  }, [accessibleCases])

  const accessibleIssues = useMemo(() => {
    if (!caseListAccess.ready) return []
    if (caseListAccess.isAdmin) return issues
    return issues.filter((row) => cleanUpper(row.pic) === caseListAccess.name)
  }, [caseListAccess.isAdmin, caseListAccess.name, caseListAccess.ready, issues])

  const selectedIssueHandlingMeta = useMemo(() => {
    const selected = normalizeIssueHandlingKey(issueForm.tindak_lanjut)
    return masters.issueActions.find((item) => normalizeIssueHandlingKey(item.name) === selected) || null
  }, [issueForm.tindak_lanjut, masters.issueActions])

  const issueNeedsCost = isTruthyFlag(selectedIssueHandlingMeta?.add_cost)

  const isIssuePending = useCallback((row) => {
    const selected = normalizeIssueHandlingKey(row?.tindak_lanjut)
    if (!selected) return false
    const meta = masters.issueActions.find((item) => normalizeIssueHandlingKey(item.name) === selected)
    return isTruthyFlag(meta?.is_pending)
  }, [masters.issueActions])

  const issueSummaryRange = useMemo(() => getMonthDateRange(issueSummaryMonth, today), [issueSummaryMonth, today])

  const issueSummaryRows = useMemo(() => {
    return accessibleIssues.filter((row) => {
      const createdDate = dateOnly(row.created_at)
      if (createdDate && createdDate < issueSummaryRange.from) return false
      if (createdDate && createdDate > issueSummaryRange.to) return false
      return true
    })
  }, [accessibleIssues, issueSummaryRange.from, issueSummaryRange.to])

  const visibleIssues = useMemo(() => {
    const keyword = issueFilters.search.trim().toLowerCase()
    return accessibleIssues.filter((row) => {
      const createdDate = dateOnly(row.created_at)
      const groupValue = cleanUpper(row.group_order)
      const haystack = [row.order_id, row.nama, row.tim, row.produk_bermasalah, row.alasan_bermasalah, row.tindak_lanjut, row.keterangan].join(' ').toLowerCase()

      if (issueFilters.from && createdDate && createdDate < issueFilters.from) return false
      if (issueFilters.to && createdDate && createdDate > issueFilters.to) return false
      if (issueFilters.group && groupValue !== issueFilters.group) return false
      if (keyword && !haystack.includes(keyword)) return false
      return true
    })
  }, [accessibleIssues, issueFilters.from, issueFilters.group, issueFilters.search, issueFilters.to])

  const issueSummaryStats = useMemo(() => {
    const pendingRows = issueSummaryRows.filter(isIssuePending)
    const costTotal = issueSummaryRows.reduce((sum, row) => sum + safeNumber(row.biaya_timbul), 0)
    const groups = GROUPS.map((group) => {
      const rows = issueSummaryRows.filter((row) => cleanUpper(row.group_order) === group)
      const pending = rows.filter(isIssuePending)
      return {
        cost: rows.reduce((sum, row) => sum + safeNumber(row.biaya_timbul), 0),
        count: rows.length,
        group,
        pending: pending.length,
      }
    })
    const handlingCounts = new Map()
    issueSummaryRows.forEach((row) => {
      const value = cleanText(row.tindak_lanjut)
      if (!value) return
      handlingCounts.set(value, (handlingCounts.get(value) || 0) + 1)
    })
    const topHandling = [...handlingCounts.entries()]
      .map(([label, value]) => ({ key: label, label, value }))
      .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label))
      .slice(0, 5)

    return {
      costTotal,
      groups,
      pendingRows,
      topHandling,
      total: issueSummaryRows.length,
    }
  }, [isIssuePending, issueSummaryRows])

  const issueQuickInsights = useMemo(() => {
    const pendingRows = issueSummaryStats.pendingRows
    return pendingRows.slice(0, 8).map((row) => ({
      detail: `${row.nama || '-'} • ${row.group_order || '-'} • ${formatIssueTeamLabel(row.tim)} | ${row.alasan_bermasalah || '-'} → ${row.tindak_lanjut || '-'}`,
      id: row.id,
      row,
      title: row.order_id || '-',
    }))
  }, [issueSummaryStats.pendingRows])

  const renderIssueMetricRows = (items, formatter = (value) => `${value} cases`) => {
    const safeItems = (items || []).filter((item) => safeNumber(item.value) > 0)
    const totalValue = safeItems.reduce((sum, item) => sum + safeNumber(item.value), 0)
    if (!safeItems.length || !totalValue) return null

    return (
      <div className={styles.orderIssueChart}>
        {safeItems.map((item) => {
          const percent = Math.round((safeNumber(item.value) / totalValue) * 100)
          return (
            <button key={item.key || item.label} type="button" className={styles.orderIssueChartRow} onClick={item.onClick}>
              <div className={styles.orderIssueChartMeta}><span>{item.label}</span><strong>{formatter(item.value)}</strong></div>
              <div className={styles.orderIssueChartTrack}><div className={`${styles.orderIssueChartFill} ${item.className || ''}`} style={{ width: `${Math.max(percent, item.value ? 6 : 0)}%` }} /></div>
            </button>
          )
        })}
      </div>
    )
  }

  const returnActionRules = useMemo(() => {
    const actionMeta = masters.actions.find((item) => String(item.name || '').trim() === String(returnForm.retur_action || '').trim()) || null
    return getReturnActionRules(actionMeta)
  }, [masters.actions, returnForm.retur_action])

  async function resolveActorName() {
    const actorName = pic || await getActorDisplayName()
    setPic(actorName)
    return actorName
  }

  function createDetailDraft(row) {
    if (!row) return null
    return {
      ...blankReturn(today),
      alamat: row.alamat || '',
      batas_tanggal_retur: dateOnly(row.batas_tanggal_retur) || today,
      courier_name: row.courier_name || '',
      courier_service: row.courier_service || '',
      group_order: row.group_order || 'MOB',
      internal_external: row.internal_external || 'Internal',
      keterangan_tambahan: row.keterangan_tambahan || '',
      kode_kejadian: row.kode_kejadian || '',
      nama_customer: row.nama_customer || '',
      need_prioritized: Boolean(row.need_prioritized),
      nilai_refund_kompensasi: row.nilai_refund_kompensasi ?? '',
      no_handphone: row.no_handphone || '',
      no_resi_pengiriman: row.no_resi_pengiriman || '',
      nomor_tim: row.nomor_tim || '',
      note_konsumen: row.note_konsumen || '',
      ongkir_keluar: row.ongkir_keluar ?? '',
      ongkir_masuk: row.ongkir_masuk ?? '',
      order_id: row.order_id || '',
      pic: row.pic || '',
      produk_diretur: row.produk_diretur || '',
      produk_pengganti: row.produk_pengganti || '',
      retur_action: row.retur_action || '',
      retur_reason: row.retur_reason || '',
      status_barang: row.status_barang || 'Pending',
      tanggal_pengajuan: dateOnly(row.tanggal_pengajuan) || today,
      total_retur: row.total_retur ?? '',
    }
  }

  function openCaseDetail(row, options = {}) {
    setReceivingAddOpen(false)
    setReceivingReprintOpen(false)
    setDetailReadonly(Boolean(options.readonly))
    setDetail(row)
    setDetailDraft(row?.kode_kejadian ? createDetailDraft(row) : null)
    setDetailMode('view')
  }

  function closeCaseDetail() {
    setDetail(null)
    setDetailDraft(null)
    setDetailMode('view')
    setDetailReadonly(false)
  }

  const detailField = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setDetailDraft((current) => ({ ...current, [key]: value }))
  }

  async function saveDetailEdit() {
    if (!detail || !detailDraft) return
    setBusy(true)
    let actorName = pic
    try {
      actorName = await resolveActorName()
    } catch (error) {
      setBusy(false)
      setStatus({ type: 'error', message: error.message || 'Failed to load signed-in user.' })
      return
    }

    const updatePayload = {
      ...normalizeReturnPayload(detailDraft, detail.kode_kejadian || detailDraft.kode_kejadian, detailDraft.pic || detail.pic || actorName),
      updated_at: new Date().toISOString(),
      updated_by: actorName,
    }
    const { data, error } = await deliverySupabase.from('Error_Retur_Cases').update(updatePayload).eq('id', detail.id).select('*').single()
    setBusy(false)
    if (error) {
      setStatus({ type: 'error', message: `Failed to update case: ${error.message}` })
      return
    }
    setStatus({ type: 'success', message: `${detail.kode_kejadian || 'Case'} was updated successfully.` })
    setDetail(data)
    setDetailDraft(createDetailDraft(data))
    setDetailMode('view')
    await loadCases()
  }

  async function saveReturn() {
    const checks = [
      [returnForm.order_id, 'Order ID is required.'],
      [returnForm.nama_customer, 'Customer name is required.'],
      [returnForm.no_handphone, 'Phone number is required.'],
      [returnForm.alamat, 'Address is required.'],
      [returnForm.no_resi_pengiriman, 'Shipment AWB is required.'],
      [returnForm.retur_reason, 'Return reason is required.'],
      [returnForm.retur_action, 'Follow-up action is required.'],
    ]

    if (returnActionRules.replacementRequired === true) {
      checks.push([returnForm.courier_name, 'Shipping courier is required for this follow-up action.'])
      checks.push([returnForm.produk_pengganti, 'Replacement product is required for this follow-up action.'])
      checks.push([returnForm.total_retur, 'Returned item value is required for this follow-up action.'])
    }
    if (returnActionRules.requireRefundValue === true) checks.push([returnForm.nilai_refund_kompensasi, 'Loss value is required for this follow-up action.'])
    if (returnActionRules.requiresReturn === true) checks.push([returnForm.produk_diretur, 'Returned / problem product is required for this follow-up action.'])

    const missingField = checks.find(([value]) => !String(value || '').trim())
    if (missingField) {
      setStatus({ type: 'error', message: missingField[1] })
      return
    }
    setBusy(true)
    let actorName = pic
    let nextCaseCode = caseCode
    try {
      actorName = await resolveActorName()
      nextCaseCode = await generateNextCaseCode(returnForm.group_order, returnForm.tanggal_pengajuan)
      setCaseCode(nextCaseCode)
    } catch (error) {
      setBusy(false)
      setStatus({ type: 'error', message: error.message || 'Failed to load signed-in user.' })
      return
    }
    const { error } = await deliverySupabase.from('Error_Retur_Cases').insert({
      ...normalizeReturnPayload(returnForm, nextCaseCode, actorName),
      created_at: new Date().toISOString(),
      created_by: actorName,
      updated_at: new Date().toISOString(),
      updated_by: actorName,
    })
    setBusy(false)
    if (error) setStatus({ type: 'error', message: `Failed to save case: ${error.message}` })
    else {
      setStatus({ type: 'success', message: `Case ${nextCaseCode} was saved successfully.` })
      setReturnForm(blankReturn(today))
      await loadCases()
    }
  }

  async function saveIssue() {
    const checks = [
      [issueForm.order_id, 'Order ID is required.'],
      [issueForm.nama, 'Customer name is required.'],
      [issueForm.no_hp, 'Phone number is required.'],
      [issueForm.alasan_bermasalah, 'Issue reason is required.'],
      [issueForm.tindak_lanjut, 'Handling action is required.'],
      [hasMeaningfulBulletText(issueForm.produk_bermasalah), 'Faulty product is required.'],
    ]
    if (issueNeedsCost) checks.push([issueForm.biaya_timbul, 'Additional cost is required for this handling action.'])

    const missingField = checks.find(([value]) => !value)
    if (missingField) {
      setStatus({ type: 'error', message: missingField[1] })
      return
    }
    setBusy(true)
    let actorName = pic
    try {
      actorName = await resolveActorName()
    } catch (error) {
      setBusy(false)
      setStatus({ type: 'error', message: error.message || 'Failed to load signed-in user.' })
      return
    }
    const payload = normalizeIssuePayload(issueForm, actorName)
    const timestamp = new Date().toISOString()
    const request = editingIssueId
      ? deliverySupabase.from('Order_Issue_Cases').update({ ...payload, updated_at: timestamp }).eq('id', editingIssueId)
      : deliverySupabase.from('Order_Issue_Cases').insert({ ...payload, created_at: timestamp, updated_at: timestamp })
    const { error } = await request
    setBusy(false)
    if (error) setStatus({ type: 'error', message: `Failed to save issue: ${error.message}` })
    else {
      setStatus({ type: 'success', message: editingIssueId ? 'Order issue was updated successfully.' : 'Order issue was saved successfully.' })
      setIssueForm(blankIssue())
      setEditingIssueId(null)
      await loadIssues()
    }
  }

  async function updateStatus(row, nextStatus) {
    let actorName = pic
    try {
      actorName = await resolveActorName()
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to load signed-in user.' })
      return
    }
    const { error } = await deliverySupabase.from('Error_Retur_Cases').update({ pic: actorName, status_barang: nextStatus, updated_at: new Date().toISOString(), updated_by: actorName }).eq('id', row.id)
    if (error) setStatus({ type: 'error', message: `Failed to update status: ${error.message}` })
    else {
      setStatus({ type: 'success', message: `${row.kode_kejadian} was updated to ${nextStatus}.` })
      await loadCases()
    }
  }

  const returnField = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setReturnForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'no_resi_pengiriman' ? { nomor_tim: '' } : {}),
    }))
  }
  const issueField = (key) => (event) => {
    const rawValue = event.target.value
    let value = rawValue
    if (['group_order', 'order_id', 'nama', 'tim'].includes(key)) value = cleanUpper(rawValue)
    if (key === 'no_hp') value = cleanDigits(rawValue)
    setIssueForm((current) => ({ ...current, [key]: value }))
  }

  function resetIssueForm() {
    setIssueForm(blankIssue())
    setEditingIssueId(null)
  }

  function openIssueDetail(rowOrId, options = {}) {
    const row = typeof rowOrId === 'object' ? rowOrId : accessibleIssues.find((item) => String(item.id) === String(rowOrId))
    if (!row) return
    setIssueDetailReadonly(Boolean(options.readonly))
    setIssueDetail(row)
  }

  function loadIssueEditState(rowOrId) {
    const row = typeof rowOrId === 'object' ? rowOrId : accessibleIssues.find((item) => String(item.id) === String(rowOrId))
    if (!row) return
    setEditingIssueId(row.id)
    setIssueDetail(null)
    setIssueDetailReadonly(false)
    setIssueForm({
      alasan_bermasalah: row.alasan_bermasalah || '',
      biaya_timbul: row.biaya_timbul ?? '',
      group_order: cleanUpper(row.group_order || 'ARKLINE'),
      keterangan: row.keterangan || '',
      nama: cleanUpper(row.nama),
      no_hp: cleanDigits(row.no_hp),
      order_id: cleanUpper(row.order_id),
      produk_bermasalah: ensureBulletText(row.produk_bermasalah),
      produk_pengganti: ensureBulletText(row.produk_pengganti),
      tim: cleanUpper(row.tim || 'TIM 1'),
      tindak_lanjut: row.tindak_lanjut || '',
    })
    setActiveTab('issues')
    setStatus({ type: 'info', message: `Editing order issue ${row.order_id || '-'}.` })
  }
  const serviceOptions = masters.services.filter((item) => item.courier_name === returnForm.courier_name)
  const detailServiceOptions = masters.services.filter((item) => item.courier_name === detailDraft?.courier_name)
  useEffect(() => {
    const barcode = cleanUpper(returnForm.no_resi_pengiriman)
    if (!barcode) return undefined

    let ignore = false
    const timer = window.setTimeout(async () => {
      const { data, error } = await deliverySupabase
        .from('Delivery_Barcode')
        .select('barcode,packing_team')
        .eq('barcode', barcode)
        .limit(1)

      if (ignore || error) return
      const packingTeam = cleanUpper(data?.[0]?.packing_team)
      setReturnForm((current) => {
        if (cleanUpper(current.no_resi_pengiriman) !== barcode || current.nomor_tim === packingTeam) return current
        return { ...current, nomor_tim: packingTeam }
      })
    }, 350)

    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [returnForm.no_resi_pengiriman])

  const searchResults = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase()
    if (!keyword) return []
    const returnRows = accessibleCases
      .map((row) => ({
        action: row.retur_action || '-',
        code: row.kode_kejadian || '-',
        customer: row.nama_customer || '-',
        dateValue: row.tanggal_pengajuan || row.created_at,
        groupOrder: row.group_order || '-',
        reason: row.retur_reason || '-',
        replacementProduct: row.produk_pengganti || '',
        returnedLabel: 'Return / Faulty Product',
        returnedProduct: row.produk_diretur || '',
        row,
        sourceLabel: 'Return',
        sourceType: 'return',
      }))
    const issueRows = accessibleIssues
      .map((row) => ({
        action: row.tindak_lanjut || '-',
        code: row.order_id || '-',
        customer: row.nama || '-',
        dateValue: row.created_at,
        groupOrder: row.group_order || '-',
        reason: row.alasan_bermasalah || '-',
        replacementProduct: row.produk_pengganti || '',
        returnedLabel: 'Faulty Product',
        returnedProduct: row.produk_bermasalah || '',
        row,
        sourceLabel: 'Order Issue',
        sourceType: 'issue',
      }))

    return [...returnRows, ...issueRows]
      .filter((row) => {
        const returnedText = String(row.returnedProduct || '').toLowerCase()
        const replacementText = String(row.replacementProduct || '').toLowerCase()
        const inReturned = returnedText.includes(keyword)
        const inReplacement = replacementText.includes(keyword)
        const matchType = !productSearchFilters.type || row.sourceType === productSearchFilters.type
        const matchGroup = !productSearchFilters.group || cleanUpper(row.groupOrder) === productSearchFilters.group

        if (!matchType || !matchGroup) return false
        if (productSearchFilters.scope === 'returned') return inReturned
        if (productSearchFilters.scope === 'replacement') return inReplacement
        return inReturned || inReplacement
      })
      .map((row) => {
        const returnedText = String(row.returnedProduct || '').toLowerCase()
        const replacementText = String(row.replacementProduct || '').toLowerCase()
        const foundIn = []
        if (returnedText.includes(keyword)) foundIn.push(row.returnedLabel)
        if (replacementText.includes(keyword)) foundIn.push('Replacement Product')
        return { ...row, foundIn }
      })
      .sort((first, second) => String(second.dateValue || '').localeCompare(String(first.dateValue || '')))
  }, [accessibleCases, accessibleIssues, productSearch, productSearchFilters.group, productSearchFilters.scope, productSearchFilters.type])

  const detailStatusOption = RETURN_STATUS_OPTIONS[detailDraft?.status_barang] || RETURN_STATUS_OPTIONS.Pending
  const canEditDetail = Boolean(detailDraft) && !detailReadonly && activeTab !== 'receiving'

  const renderGroupBadge = (group) => <span className={`${styles.casePill} ${styles[`casePill${cleanUpper(group).charAt(0)}${cleanUpper(group).slice(1).toLowerCase()}`] || ''}`}>{group || '-'}</span>
  const renderTypeBadge = (type) => <span className={`${styles.casePill} ${type === 'Internal' ? styles.casePillInternal : type === 'External' ? styles.casePillExternal : ''}`}>{type || '-'}</span>
  const renderReturnStatusBadge = (statusValue) => {
    const value = cleanText(statusValue) || '-'
    const optionClass = RETURN_STATUS_OPTIONS[value]?.className || (value === 'Completed' ? styles.statusCompletedBadge : '')
    return <span className={`${styles.statusBadge} ${optionClass}`}>{value}</span>
  }
  const getGroupFillClass = (group) => styles[`orderIssueFill${cleanUpper(group).charAt(0)}${cleanUpper(group).slice(1).toLowerCase()}`] || ''

  const receivingRows = useMemo(() => {
    const keyword = cleanUpper(receivingFilters.search)
    return accessibleCases
      .filter((row) => ['Sending', 'Completed'].includes(row.status_barang))
      .filter((row) => !receivingFilters.group || row.group_order === receivingFilters.group)
      .filter((row) => !receivingFilters.courier || row.courier_name === receivingFilters.courier)
      .filter((row) => !keyword || [row.kode_kejadian, row.nama_customer, row.order_id, row.no_resi_pengiriman].some((value) => cleanUpper(value).includes(keyword)))
  }, [accessibleCases, receivingFilters.courier, receivingFilters.group, receivingFilters.search])

  const receivingCourierOptions = useMemo(() => {
    return Array.from(new Set(accessibleCases.filter((row) => ['Sending', 'Completed'].includes(row.status_barang)).map((row) => cleanUpper(row.courier_name)).filter(Boolean))).sort()
  }, [accessibleCases])

  const receivingAddRows = useMemo(() => {
    const keyword = cleanUpper(receivingAddSearch)
    return accessibleCases
      .filter((row) => row.status_barang === 'Pending')
      .filter((row) => !keyword || cleanUpper(row.kode_kejadian).includes(keyword))
      .slice(0, 20)
  }, [accessibleCases, receivingAddSearch])

  const selectedReceivingAddRows = useMemo(() => {
    const selected = new Set(receivingAddSelectedIds.map(String))
    return receivingAddRows.filter((row) => selected.has(String(row.id)))
  }, [receivingAddRows, receivingAddSelectedIds])

  const receivingReprintRows = useMemo(() => {
    const keyword = cleanUpper(receivingReprintSearch)
    return accessibleCases
      .filter((row) => row.status_barang === 'Completed')
      .filter((row) => !isRefundOnlyCase(row))
      .filter((row) => !keyword || [row.kode_kejadian, row.nama_customer, row.no_resi_pengiriman].some((value) => cleanUpper(value).includes(keyword)))
      .slice(0, 30)
  }, [accessibleCases, receivingReprintSearch])

  const selectedReceivingRows = useMemo(() => {
    const selected = new Set(receivingSelectedIds.map(String))
    return receivingRows.filter((row) => row.status_barang === 'Sending' && selected.has(String(row.id)))
  }, [receivingRows, receivingSelectedIds])

  const selectedReprintRows = useMemo(() => {
    const selected = new Set(receivingReprintSelectedIds.map(String))
    return receivingReprintRows.filter((row) => selected.has(String(row.id)))
  }, [receivingReprintRows, receivingReprintSelectedIds])

  const allReceivingSelected = receivingRows.some((row) => row.status_barang === 'Sending') && receivingRows.filter((row) => row.status_barang === 'Sending').every((row) => receivingSelectedIds.includes(String(row.id)))

  function resolveReturnBarcodePattern(courierName) {
    const normalizedName = normalizeBarcodeRuleKey(courierName)
    if (!normalizedName) return ''
    const rows = (masters.barcodeRules || [])
      .map((row) => ({
        matchType: String(row.match_type || '').trim().toLowerCase(),
        pattern: sanitizeBarcodePattern(row.pattern),
        resultValue: row.result_value,
      }))
      .filter((row) => row.matchType === 'suffix' && row.pattern && row.resultValue)
    const exactMatches = rows.filter((row) => normalizeBarcodeRuleKey(row.resultValue) === normalizedName)
    const looseMatches = rows.filter((row) => {
      const key = normalizeBarcodeRuleKey(row.resultValue)
      return key && (key.includes(normalizedName) || normalizedName.includes(key))
    })
    return (exactMatches[0] || looseMatches[0])?.pattern || ''
  }

  function prepareReceivingPrintRows(rows) {
    return rows.map((row) => {
      const pattern = resolveReturnBarcodePattern(row.courier_name)
      return {
        ...row,
        barcode_pattern: pattern,
        barcode_source: `R${cleanUpper(row.kode_kejadian)}${pattern}`,
      }
    })
  }

  function buildReceivingLabelHtml(rows) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Print Return Label</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39+Extended+Text&display=swap" rel="stylesheet"><style>@page{size:A6;margin:6mm}body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;color:#111827;background:#fff}.sheet{display:grid;gap:6mm}.label{page-break-after:always;border:1.5px solid #0f172a;border-radius:10px;padding:10px}.label:last-child{page-break-after:auto}.top{border-bottom:1.5px solid #0f172a;padding-bottom:8px;margin-bottom:10px}.title{font-size:17px;font-weight:900;letter-spacing:.08em;text-align:center}.meta{margin-top:6px;display:flex;justify-content:space-between;gap:10px;font-size:11px;font-weight:800;text-transform:uppercase}.block{border:1px solid #cbd5e1;border-radius:8px;padding:7px 8px;margin-top:7px}.k{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#475569}.v{margin-top:4px;font-size:12px;line-height:1.35;font-weight:600;white-space:pre-wrap;word-break:break-word}.v.big{font-size:14px;font-weight:800}.double{display:grid;grid-template-columns:1fr 1fr;gap:7px;align-items:start}.barcode-wrap{margin-top:10px;border:1.5px dashed #94a3b8;border-radius:10px;padding:10px 6px;overflow:hidden}.barcode{font-family:"Libre Barcode 39 Extended Text",cursive;font-size:46px;line-height:1;text-align:center;white-space:nowrap}</style></head><body><div class="sheet">${rows.map((row) => {
      const barcodeValue = `*${row.barcode_source || `R${cleanUpper(row.kode_kejadian)}${row.barcode_pattern || ''}`}*`
      return `<div class="label"><div class="top"><div class="title">FORM RETUR</div><div class="meta"><span>${escapeHtml(row.group_order || '-')}</span><span>${escapeHtml(`${row.courier_name || '-'}${row.courier_service ? ` - ${row.courier_service}` : ''}`)}</span></div></div><div class="double"><div class="block"><div class="k">Customer Name</div><div class="v big">${escapeHtml(row.nama_customer || '-')}</div></div><div class="block"><div class="k">Phone Number</div><div class="v">${escapeHtml(row.no_handphone || '-')}</div></div></div><div class="block"><div class="k">Address</div><div class="v">${escapeHtml(row.alamat || '-')}</div></div><div class="block"><div class="k">Replacement Product</div><div class="v">${escapeHtml(row.produk_pengganti || '-')}</div></div><div class="block"><div class="k">Item Value</div><div class="v">${escapeHtml(formatMoney(row.total_retur))}</div></div><div class="barcode-wrap"><div class="barcode">${escapeHtml(barcodeValue)}</div></div></div>`
    }).join('')}</div></body></html>`
  }

  function printReceivingRows(rows) {
    const printableRows = rows.filter((row) => !isRefundOnlyCase(row))
    if (!printableRows.length) {
      setStatus({ type: 'error', message: rows.length ? 'Refund follow-up cases cannot be printed.' : 'Select at least one case to print.' })
      return
    }
    const preparedRows = prepareReceivingPrintRows(printableRows)
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      setStatus({ type: 'error', message: 'Print popup was blocked. Please allow popups and try again.' })
      return
    }
    printWindow.document.open()
    printWindow.document.write(buildReceivingLabelHtml(preparedRows))
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => printWindow.print(), 500)
  }

  async function completeReceivingRows(rows) {
    if (!rows.length) {
      setStatus({ type: 'error', message: 'Select at least one Sending case to complete.' })
      return
    }

    const printableRows = rows.filter((row) => !isRefundOnlyCase(row))
    if (printableRows.length) printReceivingRows(printableRows)

    setBusy(true)
    let actorName = pic
    try {
      actorName = await resolveActorName()
    } catch (error) {
      setBusy(false)
      setStatus({ type: 'error', message: error.message || 'Failed to load signed-in user.' })
      return
    }

    const ids = rows.map((row) => row.id).filter(Boolean)
    const { error } = await deliverySupabase
      .from('Error_Retur_Cases')
      .update({ pic: actorName, status_barang: 'Completed', updated_at: new Date().toISOString(), updated_by: actorName })
      .in('id', ids)

    setBusy(false)
    if (error) {
      setStatus({ type: 'error', message: `Failed to complete receiving: ${error.message}` })
      return
    }

    const refundCount = rows.length - printableRows.length
    setReceivingSelectedIds([])
    setStatus({
      type: 'success',
      message: `${rows.length} receiving case${rows.length > 1 ? 's' : ''} completed.${printableRows.length ? ' Return label print was opened.' : ''}${refundCount ? ` ${refundCount} refund case${refundCount > 1 ? 's' : ''} skipped printing.` : ''}`,
    })
    await loadCases()
  }

  async function addRowsToReceiving(rows) {
    const pendingRows = rows.filter((row) => row?.status_barang === 'Pending')
    if (!pendingRows.length) {
      setStatus({ type: 'error', message: 'Only Pending cases can be added to Receiving Confirmation.' })
      return
    }

    setBusy(true)
    let actorName = pic
    try {
      actorName = await resolveActorName()
    } catch (error) {
      setBusy(false)
      setStatus({ type: 'error', message: error.message || 'Failed to load signed-in user.' })
      return
    }

    const ids = pendingRows.map((row) => row.id).filter(Boolean)
    const { error } = await deliverySupabase
      .from('Error_Retur_Cases')
      .update({ pic: actorName, status_barang: 'Sending', updated_at: new Date().toISOString(), updated_by: actorName })
      .in('id', ids)

    setBusy(false)
    if (error) {
      setStatus({ type: 'error', message: `Failed to add case to Receiving Confirmation: ${error.message}` })
      return
    }

    setReceivingAddOpen(false)
    setReceivingAddSearch('')
    setReceivingAddSelectedIds([])
    setStatus({ type: 'success', message: `${pendingRows.length} case${pendingRows.length > 1 ? 's' : ''} added to Sending.` })
    await loadCases()
  }

  async function addCaseToReceiving(row) {
    if (!row) return
    await addRowsToReceiving([row])
  }

  async function addCaseByCode() {
    if (selectedReceivingAddRows.length) {
      await addRowsToReceiving(selectedReceivingAddRows)
      return
    }

    const code = cleanUpper(receivingAddSearch)
    if (!code) {
      setStatus({ type: 'error', message: 'Select at least one Pending case or enter a case code first.' })
      return
    }
    let query = deliverySupabase.from('Error_Retur_Cases').select('*').eq('kode_kejadian', code).limit(1)
    if (!caseListAccess.isAdmin) query = query.eq('pic', caseListAccess.name)
    const { data, error } = await query.maybeSingle()
    if (error) {
      setStatus({ type: 'error', message: `Failed to find case: ${error.message}` })
      return
    }
    if (!data) {
      setStatus({ type: 'error', message: 'Case code was not found for your access.' })
      return
    }
    await addCaseToReceiving(data)
  }

  const displayDetailValue = (key, value) => {
    if (key === 'group_order') return renderGroupBadge(value)
    if (key === 'internal_external') return renderTypeBadge(value)
    if (key === 'need_prioritized') return value ? 'Yes' : 'No'
    if (RETURN_FINANCIAL_FIELDS.some(([field]) => field === key)) return formatMoney(value)
    if (['tanggal_pengajuan', 'batas_tanggal_retur'].includes(key)) return formatDate(value)
    return value || '-'
  }

  const renderDetailField = ({ key, label, options = [], textarea = false, type = 'text', readonly = false }) => {
    const value = detailDraft?.[key] ?? ''
    const labelNode = RETURN_FINANCIAL_HELP[key] ? labelWithInfo(label, RETURN_FINANCIAL_HELP[key]) : label
    if (canEditDetail && detailMode === 'edit' && !readonly) {
      if (options.length) {
        return (
          <label key={key} className={styles.resolutionDetailField}>
            <span>{labelNode}</span>
            <select value={value} onChange={detailField(key)}>
              <option value="">Select</option>
              {options.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        )
      }
      if (textarea) {
        return <label key={key} className={`${styles.resolutionDetailField} ${styles.fullField}`}><span>{labelNode}</span><textarea value={value} onChange={detailField(key)} /></label>
      }
      return <label key={key} className={styles.resolutionDetailField}><span>{labelNode}</span><input type={type} value={value} onChange={detailField(key)} /></label>
    }
    return <div key={key} className={styles.resolutionDetailValue}><span>{labelNode}</span><strong>{displayDetailValue(key, value)}</strong></div>
  }

  return (
    <div className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Delivery Report • Returns"
        subtitle="Manage and monitor delivery return cases and order issues in a structured workflow."
        title="Resolution Monitoring Center"
      />
      <div className={styles.resolutionTabs}>{TABS.map(([id, label]) => <button key={id} className={activeTab === id ? styles.active : ''} onClick={() => setActiveTab(id)}>{label}</button>)}</div>
      <StatusMessage status={status} />

      {activeTab === 'registration' ? (
        <>
          <section className={`${styles.dataCard} ${styles.resolutionSummaryPanel}`}>
            <div className={styles.resolutionSummaryControls}>
              <label><span>DATE FROM</span><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
              <label><span>DATE TO</span><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
              <button className={styles.primaryButton} onClick={loadCases}>Apply Summary</button>
            </div>
            <div className={styles.resolutionMetricGrid}>
              <div className={styles.resolutionMetricCard}><span>CASES</span><strong>{cases.length}</strong><p>Total cases in the selected date range.</p></div>
              <div className={styles.resolutionMetricCard}><span>WARNING H-1</span><strong>{stats.warning}</strong><p>Cases approaching the return deadline.</p></div>
              <div className={styles.resolutionMetricCard}><span>OVERDUE</span><strong>{stats.overdue}</strong><p>Cases past the return deadline and still active.</p></div>
              <div className={styles.resolutionMetricCard}><span>INTERNAL / EXTERNAL</span><strong>{stats.internal} / {stats.external}</strong><p>Case type split for the active period.</p></div>
            </div>
          </section>

          <section className={styles.resolutionRegistrationGrid}>
            <article className={styles.formPanel}>
              <div className={styles.panelHeader}><h2>INPUT NEW CASE</h2><span>Case Registration</span></div>
              <div className={styles.panelBody}>
                <section className={styles.resolutionCaseHeaderCompact}>
                  <div className={styles.resolutionDateRow}>
                    <div className={styles.caseCode}><span>CASE CODE</span><strong>{caseCode || '...'}</strong></div>
                    <label><span>SUBMISSION DATE</span><input type="date" value={returnForm.tanggal_pengajuan} onChange={(event) => setReturnForm({ ...returnForm, batas_tanggal_retur: addDays(event.target.value, 14), tanggal_pengajuan: event.target.value })} /></label>
                    <label><span>RETURN DEADLINE</span><input type="date" value={returnForm.batas_tanggal_retur} onChange={returnField('batas_tanggal_retur')} /></label>
                  </div>
                  <div className={styles.resolutionChoiceRow}>
                    <div><span className={styles.fieldTitle}>GROUP ORDER</span><div className={styles.choicePills}>{GROUPS.map((group) => <button key={group} className={`${returnForm.group_order === group ? styles.active : ''} ${GROUP_CHOICE_CLASS[group] || ''}`} onClick={() => setReturnForm({ ...returnForm, group_order: group })}>{group}</button>)}</div></div>
                    <div><span className={styles.fieldTitle}>INTERNAL / EXTERNAL</span><div className={styles.choicePills}>{['Internal', 'External'].map((type) => <button key={type} className={`${returnForm.internal_external === type ? styles.active : ''} ${TYPE_CHOICE_CLASS[type] || ''}`} onClick={() => setReturnForm({ ...returnForm, internal_external: type })}>{type}</button>)}</div></div>
                  </div>
                </section>

                <details className={styles.resolutionFormSection} open>
                  <summary className={styles.resolutionFormSectionHeader}>
                    <div>
                      <h3>Subject Identity</h3>
                      <p>Customer, shipment, and team information tied to the case.</p>
                    </div>
                    <span aria-hidden="true">−</span>
                  </summary>
                  <div className={`${styles.formGrid} ${styles.resolutionIdentityGrid}`}>
                    <label><span>{labelText('ORDER ID', true)}</span><input value={returnForm.order_id} onChange={returnField('order_id')} /></label>
                    <label><span>{labelText('CUSTOMER NAME', true)}</span><input value={returnForm.nama_customer} onChange={returnField('nama_customer')} /></label>
                    <label><span>{labelText('PHONE NUMBER', true)}</span><input value={returnForm.no_handphone} onChange={returnField('no_handphone')} /></label>
                    <label className={styles.fullField}><span>{labelText('ADDRESS', true)}</span><textarea value={returnForm.alamat} onChange={returnField('alamat')} /></label>
                    <label><span>{labelText('SHIPMENT AWB', true)}</span><input value={returnForm.no_resi_pengiriman} onChange={returnField('no_resi_pengiriman')} /></label>
                    <label><span>PACKING TEAM</span><input readOnly placeholder="Auto-filled from shipment AWB" value={returnForm.nomor_tim} /></label>
                  </div>
                </details>

                <details className={styles.resolutionFormSection} open>
                  <summary className={styles.resolutionFormSectionHeader}>
                    <div>
                      <h3>Returns Detail</h3>
                      <p>Reason, action, products, courier, cost, and notes.</p>
                    </div>
                    <span aria-hidden="true">−</span>
                  </summary>
                  <div className={styles.formGrid}>
                    <label><span>{labelText('RETURN REASON', true)}</span><select value={returnForm.retur_reason} onChange={returnField('retur_reason')}><option value="">SELECT REASON</option>{masters.reasons.filter((item) => !item.reasoning_type || item.reasoning_type.toLowerCase() === returnForm.internal_external.toLowerCase()).map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
                    <label><span>{labelText('FOLLOW-UP ACTION', true)}</span><select value={returnForm.retur_action} onChange={returnField('retur_action')}><option value="">SELECT FOLLOW-UP</option>{masters.actions.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
                    <label className={styles.fullField}><span>{labelText('RETURN / FAULTY PRODUCT', returnActionRules.requiresReturn === true)}</span><textarea placeholder="> " value={returnForm.produk_diretur} onChange={returnField('produk_diretur')} /></label>
                    <label className={styles.fullField}><span>{labelText('REPLACEMENT PRODUCT', returnActionRules.replacementRequired === true)}</span><textarea placeholder="> " value={returnForm.produk_pengganti} onChange={returnField('produk_pengganti')} /></label>
                    <label><span>{labelText('SHIPPING COURIER', returnActionRules.replacementRequired === true)}</span><select value={returnForm.courier_name} onChange={(event) => setReturnForm({ ...returnForm, courier_name: event.target.value, courier_service: '' })}><option value="">SELECT COURIER</option>{masters.couriers.map((item) => <option key={item.id}>{item.nama}</option>)}</select></label>
                    <label><span>SHIPPING SERVICE</span><select value={returnForm.courier_service} onChange={returnField('courier_service')}><option value="">SELECT SERVICE</option>{serviceOptions.map((item) => <option key={item.id}>{item.courier_service}</option>)}</select></label>
                    {RETURN_FINANCIAL_FIELDS.map(([key, label]) => {
                      const required = (key === 'nilai_refund_kompensasi' && returnActionRules.requireRefundValue === true) || (key === 'total_retur' && returnActionRules.replacementRequired === true)
                      return <label key={key}><span>{labelWithInfo(label.toUpperCase(), RETURN_FINANCIAL_HELP[key], required)}</span><input inputMode="numeric" value={returnForm[key]} onChange={returnField(key)} /></label>
                    })}
                    <label><span>INTERNAL ADDITIONAL NOTES</span><textarea value={returnForm.keterangan_tambahan} onChange={returnField('keterangan_tambahan')} /></label>
                    <label><span>CUSTOMER NOTES</span><textarea value={returnForm.note_konsumen} onChange={returnField('note_konsumen')} /></label>
                  </div>
                </details>

                <section className={`${styles.resolutionFormSection} ${styles.resolutionStatusSection}`}>
                  <div className={styles.resolutionStaticSectionTitle}>Status</div>
                  <div className={styles.resolutionStatusPanel}>
                    <div className={`${styles.resolutionStatusPreview} ${RETURN_STATUS_OPTIONS[returnForm.status_barang]?.className || ''}`}>
                      <span>ACTIVE STATUS</span>
                      <strong>{RETURN_STATUS_OPTIONS[returnForm.status_barang]?.label || returnForm.status_barang}</strong>
                      <p>{RETURN_STATUS_OPTIONS[returnForm.status_barang]?.description || 'Select the current case status.'}</p>
                    </div>
                    <div className={styles.resolutionStatusControls}>
                      <div className={styles.resolutionStatusButtons}>
                        {Object.entries(RETURN_STATUS_OPTIONS).map(([value, option]) => (
                          <button
                            key={value}
                            className={`${returnForm.status_barang === value ? styles.active : ''} ${option.className}`}
                            onClick={() => setReturnForm({ ...returnForm, status_barang: value })}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <label className={styles.resolutionPriorityToggle}>
                        <input type="checkbox" checked={returnForm.need_prioritized} onChange={returnField('need_prioritized')} />
                        <span>Priority case / needs special attention</span>
                      </label>
                    </div>
                  </div>
                </section>

                <div className={styles.formActions}><button className={styles.primaryButton} disabled={busy} onClick={saveReturn}>{busy ? 'Saving...' : 'Save'}</button><button className={styles.softButton} onClick={() => setReturnForm(blankReturn(today))}>Reset Form</button></div>
              </div>
            </article>

            <aside className={styles.resolutionSideStack}>
              <article className={styles.resolutionInsightCard}>
                <div className={styles.cardTitleRow}>
                  <div>
                    <h2>WARNING PANEL</h2>
                    <p className={styles.cardHint}>Prioritized, H-1, and overdue cases that need faster follow-up.</p>
                  </div>
                </div>
                <div className={styles.resolutionWarningList}>
                  {!warningRows.length ? (
                    <div className={styles.resolutionEmptyBox}><strong>No attention cases</strong><span>No prioritized, H-1, or overdue cases in this period.</span></div>
                  ) : warningRows.map(({ meta, row }) => (
                    <button key={row.id} className={`${styles.resolutionWarningCard} ${meta.tone}`} onClick={() => openCaseDetail(row)}>
                      <span>{meta.label}</span>
                      <strong>{row.kode_kejadian || row.order_id || '-'}</strong>
                      <small>{row.nama_customer || '-'} • Deadline {formatShortDate(row.batas_tanggal_retur)}</small>
                    </button>
                  ))}
                </div>
              </article>
              <article className={styles.resolutionInsightCard}>
                <div className={styles.cardTitleRow}>
                  <div>
                    <h2>QUICK INSIGHT</h2>
                    <p className={styles.cardHint}>Auto-generated highlights from the loaded case data.</p>
                  </div>
                </div>
                <div className={styles.resolutionQuickList}>
                  {quickInsights.map((item) => (
                    <div key={item.title} className={styles.resolutionQuickItem}>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                  ))}
                </div>
              </article>
            </aside>
          </section>

          <section className={`${styles.tablePanel} ${styles.resolutionCaseListPanel}`}>
            <div className={styles.resolutionCaseListHeader}>
              <div>
                <div className={styles.resolutionCaseListTitleRow}>
                  <h2>Case Lists</h2>
                  <span className={styles.caseCountPill}>{visibleCases.length} Rows</span>
                  <span className={styles.warningCountPill}>{caseListStats.warning} Warning</span>
                  <span className={styles.overdueCountPill}>{caseListStats.overdue} Overdue</span>
                </div>
                <p>Monitor cases quickly with filters, detail views, edits, and direct status updates.</p>
              </div>
              <div className={styles.resolutionCaseFilters}>
                <label><span>DATE FROM</span><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
                <label><span>DATE TO</span><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
                <label><span>GROUP</span><select value={filters.group} onChange={(event) => setFilters({ ...filters, group: event.target.value })}><option value="">ALL GROUPS</option>{GROUPS.map((group) => <option key={group}>{group}</option>)}</select></label>
                <label><span>COURIER</span><select value={filters.courier} onChange={(event) => setFilters({ ...filters, courier: event.target.value })}><option value="">ALL COURIERS</option>{courierOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className={styles.searchField}><span>SEARCH</span><input placeholder="Search case code, order ID, AWB, or customer name" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
                <button className={styles.softButton} onClick={loadCases}>Refresh</button>
                <button className={`${styles.warningOnlyButton} ${filters.warningOnly ? styles.active : ''}`} onClick={() => setFilters({ ...filters, warningOnly: !filters.warningOnly })} aria-pressed={filters.warningOnly}>Warning Only</button>
              </div>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.tableWrap}><table><thead><tr><th>Date</th><th>Code</th><th>Group</th><th>Type</th><th>Customer</th><th>Order ID</th><th>AWB</th><th>Return Reason</th><th>Follow Up</th><th>Status</th><th>Action</th></tr></thead><tbody>
                {!visibleCases.length ? <tr><td colSpan="11"><EmptyState label="No data yet" /></td></tr> : visibleCases.map((row) => {
                  const meta = getCaseWarningMeta(row, today)
                  const rowTone = meta.rank === 2 ? styles.caseRowOverdue : meta.rank > 0 ? styles.caseRowWarning : ''
                  return <tr key={row.id} className={rowTone}><td>{formatShortDate(row.tanggal_pengajuan)}</td><td><strong>{row.kode_kejadian}</strong></td><td>{renderGroupBadge(row.group_order)}</td><td>{renderTypeBadge(row.internal_external)}</td><td><strong>{row.nama_customer || '-'}</strong><small>{row.nomor_tim || row.pic || '-'}</small></td><td>{row.order_id}</td><td>{row.no_resi_pengiriman}</td><td>{row.retur_reason || '-'}</td><td>{row.retur_action || '-'}</td><td>{renderReturnStatusBadge(row.status_barang)}</td><td><button className={styles.iconActionButton} aria-label={`Open detail for ${row.kode_kejadian || row.order_id}`} onClick={() => openCaseDetail(row)}>🔍</button></td></tr>
                })}
              </tbody></table></div>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'receiving' ? (
        <section className={`${styles.dataCard} ${styles.receivingConfirmationPanel}`}>
          <div className={styles.cardTitleRow}>
            <div><h2>RECEIVING CONFIRMATION</h2><p className={styles.cardHint}>Sending cases are confirmed here for return receiving and return-label printing.</p></div>
            <button className={styles.softButton} onClick={loadCases}>Refresh</button>
          </div>
          <div className={styles.receivingToolbar}>
            <span className={styles.caseCountPill}>{receivingRows.filter((row) => row.status_barang === 'Sending').length} Sending</span>
            <span className={styles.selectedCountPill}>{selectedReceivingRows.length} Selected</span>
            <label className={styles.inlineCheck}><input className={styles.compactCheckbox} type="checkbox" checked={allReceivingSelected} onChange={(event) => setReceivingSelectedIds(event.target.checked ? receivingRows.filter((row) => row.status_barang === 'Sending').map((row) => String(row.id)) : [])} /> Select All</label>
            <select className={styles.receivingSelect} aria-label="Group Order" value={receivingFilters.group} onChange={(event) => setReceivingFilters({ ...receivingFilters, group: event.target.value })}><option value="">ALL GROUPS</option>{GROUPS.map((group) => <option key={group}>{group}</option>)}</select>
            <select className={styles.receivingSelect} aria-label="Courier" value={receivingFilters.courier} onChange={(event) => setReceivingFilters({ ...receivingFilters, courier: event.target.value })}><option value="">ALL COURIERS</option>{receivingCourierOptions.map((courier) => <option key={courier}>{courier}</option>)}</select>
            <input className={styles.receivingToolbarSearch} aria-label="Search receiving cases" placeholder="SEARCH CODE / CUSTOMER / ORDER ID / AWB" value={receivingFilters.search} onChange={(event) => setReceivingFilters({ ...receivingFilters, search: event.target.value })} />
            <button className={styles.softButton} onClick={() => setReceivingAddOpen(true)}>Add by Case Code</button>
            <button className={styles.primaryButton} onClick={() => completeReceivingRows(selectedReceivingRows)}>✓ Complete & Print</button>
          </div>
          <div className={styles.tableWrap}><table><thead><tr><th>Select</th><th>Code</th><th>Customer</th><th>Order ID</th><th>AWB</th><th>Group</th><th>Courier</th><th>Deadline</th><th>Status</th><th>Action</th></tr></thead><tbody>
            {!receivingRows.length ? <tr><td colSpan="10"><EmptyState label="No receiving cases yet" /></td></tr> : receivingRows.map((row) => {
              const selected = receivingSelectedIds.includes(String(row.id))
              return <tr key={row.id}><td><input className={styles.compactCheckbox} type="checkbox" disabled={row.status_barang !== 'Sending'} checked={selected} onChange={(event) => setReceivingSelectedIds((current) => event.target.checked ? [...new Set([...current, String(row.id)])] : current.filter((id) => id !== String(row.id)))} /></td><td><strong>{row.kode_kejadian}</strong></td><td><strong>{row.nama_customer || '-'}</strong><small>{row.nomor_tim || row.pic || '-'}</small></td><td>{row.order_id || '-'}</td><td>{row.no_resi_pengiriman || '-'}</td><td>{renderGroupBadge(row.group_order)}</td><td>{row.courier_name || '-'}</td><td>{formatShortDate(row.batas_tanggal_retur)}</td><td>{renderReturnStatusBadge(row.status_barang)}</td><td><div className={styles.rowActions}><button className={styles.iconActionButton} onClick={() => openCaseDetail(row, { readonly: true })} aria-label={`Open detail for ${row.kode_kejadian || row.order_id}`}>🔍</button>{row.status_barang === 'Completed' && !isRefundOnlyCase(row) ? <button className={styles.iconPrintButton} onClick={() => printReceivingRows([row])} aria-label={`Reprint ${row.kode_kejadian || row.order_id}`}>🖨️</button> : null}</div></td></tr>
            })}
          </tbody></table></div>
        </section>
      ) : null}

      {activeTab === 'issues' ? (
        <>
          <section className={`${styles.dataCard} ${styles.orderIssueSummaryPanel}`}>
            <div className={styles.cardTitleRow}>
              <div><h2>ORDER ISSUE SUMMARY</h2><p className={styles.cardHint}>Monthly overview from issue cases, pending handling, additional cost, and handling frequency.</p></div>
              <div className={styles.orderIssueMonthControl}>
                <label><span>MONTH</span><input type="month" value={issueSummaryMonth} onChange={(event) => setIssueSummaryMonth(event.target.value)} /></label>
                <button className={styles.softButton} onClick={loadIssues}>Refresh</button>
              </div>
            </div>
            <div className={styles.orderIssueSummaryGrid}>
              <article className={styles.resolutionMetricCard}>
                <span>Total Cases</span>
                <strong>{issueSummaryStats.total}</strong>
                {renderIssueMetricRows(issueSummaryStats.groups.map((item) => ({
                  className: getGroupFillClass(item.group),
                  key: item.group,
                  label: item.group,
                  onClick: () => setIssueFilters({ ...issueFilters, from: issueSummaryRange.from, group: item.group, to: issueSummaryRange.to }),
                  value: item.count,
                })))}
              </article>
              <article className={styles.resolutionMetricCard}>
                <span>Need Handling</span>
                <strong>{issueSummaryStats.pendingRows.length}</strong>
                {renderIssueMetricRows(issueSummaryStats.groups.map((item) => ({
                  className: getGroupFillClass(item.group),
                  key: item.group,
                  label: item.group,
                  onClick: () => setIssueFilters({ ...issueFilters, from: issueSummaryRange.from, group: item.group, to: issueSummaryRange.to }),
                  value: item.pending,
                })))}
              </article>
              <article className={styles.resolutionMetricCard}>
                <span>Additional Cost</span>
                <strong>{formatMoney(issueSummaryStats.costTotal)}</strong>
                {renderIssueMetricRows(issueSummaryStats.groups.map((item) => ({
                  className: getGroupFillClass(item.group),
                  key: item.group,
                  label: item.group,
                  onClick: () => setIssueFilters({ ...issueFilters, from: issueSummaryRange.from, group: item.group, to: issueSummaryRange.to }),
                  value: item.cost,
                })), formatMoney)}
              </article>
              <article className={styles.resolutionMetricCard}>
                <span>Handling Frequency</span>
                <strong>{issueSummaryStats.topHandling[0]?.label || '-'}</strong>
                {renderIssueMetricRows(issueSummaryStats.topHandling.map((item) => ({
                  className: styles.orderIssueFillArkline,
                  key: item.key,
                  label: item.label,
                  onClick: () => setIssueFilters({ ...issueFilters, from: issueSummaryRange.from, search: item.label, to: issueSummaryRange.to }),
                  value: item.value,
                })))}
              </article>
            </div>
          </section>

          <section className={styles.orderIssueMainGrid}>
            <article className={styles.formPanel}>
              <div className={styles.panelHeader}><h2>{editingIssueId ? 'EDIT ISSUE' : 'INPUT NEW ISSUE'}</h2><span>Order Issue</span></div>
              <div className={styles.panelBody}>
                <section className={styles.resolutionCaseHeaderCompact}>
                  <div className={styles.resolutionChoiceRow}>
                    <div>
                      <span className={styles.fieldTitle}>GROUP ORDER</span>
                      <div className={styles.choicePills}>
                        {GROUPS.map((group) => (
                          <button key={group} type="button" className={`${issueForm.group_order === group ? styles.active : ''} ${styles[`groupChoice${group.charAt(0)}${group.slice(1).toLowerCase()}`] || ''}`} onClick={() => setIssueForm((current) => ({ ...current, group_order: group }))}>{group}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className={styles.fieldTitle}>TEAM</span>
                      <div className={styles.choicePills}>
                        {ISSUE_TEAMS.map((team) => (
                          <button key={team} type="button" className={issueForm.tim === team ? styles.active : ''} onClick={() => setIssueForm((current) => ({ ...current, tim: team }))}>{formatIssueTeamLabel(team)}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <div className={`${styles.formGrid} ${styles.orderIssueFormGrid}`}>
                  <label><span>{labelText('ORDER ID', true)}</span><input value={issueForm.order_id} onChange={issueField('order_id')} /></label>
                  <label><span>{labelText('CUSTOMER NAME', true)}</span><input value={issueForm.nama} onChange={issueField('nama')} /></label>
                  <label><span>{labelText('PHONE NUMBER', true)}</span><input inputMode="numeric" value={issueForm.no_hp} onChange={issueField('no_hp')} /></label>
                  <label><span>{labelText('ISSUE REASON', true)}</span><select value={issueForm.alasan_bermasalah} onChange={issueField('alasan_bermasalah')}><option value="">SELECT ISSUE REASON</option>{masters.issueReasons.map((item) => <option key={item.id || item.name}>{item.name}</option>)}</select></label>
                  <label><span>{labelText('HANDLING ACTION', true)}</span><select value={issueForm.tindak_lanjut} onChange={issueField('tindak_lanjut')}><option value="">SELECT HANDLING</option>{masters.issueActions.map((item) => <option key={item.id || item.name}>{item.name}</option>)}</select></label>
                  <label><span>{labelWithInfo('ADDITIONAL COST', ORDER_ISSUE_COST_HELP, issueNeedsCost)}</span><input inputMode="numeric" value={issueForm.biaya_timbul} onChange={issueField('biaya_timbul')} /></label>
                  <label className={styles.fullField}><span>{labelText('FAULTY PRODUCT', true)}</span><textarea placeholder="> " value={issueForm.produk_bermasalah} onBlur={(event) => setIssueForm((current) => ({ ...current, produk_bermasalah: ensureBulletText(event.target.value) }))} onChange={issueField('produk_bermasalah')} /></label>
                  <label className={styles.fullField}><span>REPLACEMENT PRODUCT</span><textarea placeholder="> " value={issueForm.produk_pengganti} onBlur={(event) => setIssueForm((current) => ({ ...current, produk_pengganti: ensureBulletText(event.target.value) }))} onChange={issueField('produk_pengganti')} /></label>
                  <label className={styles.fullField}><span>NOTES</span><textarea value={issueForm.keterangan} onChange={issueField('keterangan')} /></label>
                </div>
                <div className={styles.formActions}>
                  <button className={styles.primaryButton} disabled={busy} onClick={saveIssue}>{busy ? 'Saving...' : editingIssueId ? 'Update Issue' : 'Save Issue'}</button>
                  <button className={styles.softButton} onClick={resetIssueForm}>{editingIssueId ? 'Cancel Edit' : 'Reset Form'}</button>
                </div>
              </div>
            </article>

            <aside className={styles.resolutionSideStack}>
              <article className={styles.resolutionInsightCard}>
                <div className={styles.cardTitleRow}><div><h2>QUICK INSIGHT</h2></div></div>
                <div className={styles.resolutionQuickList}>
                  {!issueQuickInsights.length ? (
                    <div className={styles.resolutionQuickItem}>
                      <strong>Tidak ada kasus yang membutuhkan perhatian khusus.</strong>
                    </div>
                  ) : issueQuickInsights.map((item) => (
                    <div key={item.id || item.title} className={styles.resolutionQuickItem}>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                      {item.row ? <div className={styles.orderIssueQuickActions}><button className={styles.iconActionButton} onClick={() => openIssueDetail(item.row)} aria-label={`Open issue ${item.title}`}>🔍</button><button className={styles.iconActionButton} onClick={() => loadIssueEditState(item.row)} aria-label={`Edit issue ${item.title}`}>✎</button></div> : null}
                    </div>
                  ))}
                </div>
              </article>
            </aside>
          </section>

          <section className={`${styles.tablePanel} ${styles.orderIssueListPanel}`}>
            <div className={styles.resolutionCaseListHeader}>
              <div className={styles.resolutionCaseListTitleRow}>
                <h2>Issue Lists</h2>
                <span className={styles.caseCountPill}>{visibleIssues.length} Rows</span>
                <span className={styles.warningCountPill}>{issueSummaryStats.pendingRows.length} Need Handling</span>
                <span className={styles.overdueCountPill}>{formatMoney(issueSummaryStats.costTotal)}</span>
              </div>
              <p>Monitor, filter, review details, and edit order issue cases directly from one list.</p>
              <div className={styles.resolutionCaseFilters}>
                <label><span>DATE FROM</span><input type="date" value={issueFilters.from} onChange={(event) => setIssueFilters({ ...issueFilters, from: event.target.value })} /></label>
                <label><span>DATE TO</span><input type="date" value={issueFilters.to} onChange={(event) => setIssueFilters({ ...issueFilters, to: event.target.value })} /></label>
                <label><span>GROUP</span><select value={issueFilters.group} onChange={(event) => setIssueFilters({ ...issueFilters, group: event.target.value })}><option value="">ALL GROUPS</option>{GROUPS.map((group) => <option key={group}>{group}</option>)}</select></label>
                <label className={styles.searchField}><span>SEARCH</span><input placeholder="Search order ID, customer, reason, handling, product, or team" value={issueFilters.search} onChange={(event) => setIssueFilters({ ...issueFilters, search: event.target.value })} /></label>
                <button className={styles.softButton} onClick={loadIssues}>Refresh</button>
              </div>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.tableWrap}><table><thead><tr><th>Date</th><th>Group</th><th>Order ID</th><th>Customer</th><th>Faulty Product</th><th>Issue Reason</th><th>Handling</th><th>Team</th><th>Cost</th><th>PIC</th><th>Action</th></tr></thead><tbody>
                {!visibleIssues.length ? <tr><td colSpan="11"><EmptyState label="No order issue data yet" /></td></tr> : visibleIssues.map((row) => (
                  <tr key={row.id} className={isIssuePending(row) ? styles.caseRowWarning : ''}>
                    <td>{formatShortDate(row.created_at)}</td>
                    <td>{renderGroupBadge(row.group_order)}</td>
                    <td><strong>{row.order_id || '-'}</strong></td>
                    <td>{row.nama || '-'}</td>
                    <td>{row.produk_bermasalah || '-'}</td>
                    <td>{row.alasan_bermasalah || '-'}</td>
                    <td>{row.tindak_lanjut || '-'}</td>
                    <td>{formatIssueTeamLabel(row.tim)}</td>
                    <td>{formatMoney(row.biaya_timbul)}</td>
                    <td>{row.pic || '-'}</td>
                    <td><div className={styles.rowActions}><button className={styles.iconActionButton} onClick={() => openIssueDetail(row)} aria-label={`Open issue ${row.order_id || row.id}`}>🔍</button></div></td>
                  </tr>
                ))}
              </tbody></table></div>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'search' ? (
        <section className={`${styles.dataCard} ${styles.productSearchPanel}`}>
          <div className={styles.cardTitleRow}>
            <div><h2>PRODUCT SEARCH</h2><p className={styles.cardHint}>Search product history from Return Registration and Order Issues.</p></div>
            <span className={styles.caseCountPill}>{searchResults.length} Results</span>
          </div>
          <div className={styles.productSearchToolbar}>
            <label className={styles.searchField}><span>PRODUCT SEARCH</span><input autoFocus placeholder="EXAMPLE: BLACK OVERSIZE T-SHIRT" value={productSearch} onChange={(event) => setProductSearch(cleanUpper(event.target.value))} /></label>
            <label><span>TYPE</span><select value={productSearchFilters.type} onChange={(event) => setProductSearchFilters({ ...productSearchFilters, type: event.target.value })}><option value="">ALL TYPES</option><option value="return">RETURN</option><option value="issue">ORDER ISSUE</option></select></label>
            <label><span>ITEM TYPE</span><select value={productSearchFilters.scope} onChange={(event) => setProductSearchFilters({ ...productSearchFilters, scope: event.target.value })}><option value="">ALL ITEM TYPES</option><option value="returned">RETURN / FAULTY PRODUCT</option><option value="replacement">REPLACEMENT PRODUCT</option></select></label>
            <label><span>GROUP ORDER</span><select value={productSearchFilters.group} onChange={(event) => setProductSearchFilters({ ...productSearchFilters, group: event.target.value })}><option value="">ALL GROUPS</option>{GROUPS.map((group) => <option key={group}>{group}</option>)}</select></label>
            <button className={styles.softButton} onClick={() => { setProductSearch(''); setProductSearchFilters({ group: '', scope: '', type: '' }) }}>Reset</button>
          </div>
          <div className={styles.productSearchResults}>
            {!productSearch ? (
              <div className={styles.productSearchEmpty}><strong>No data yet</strong><span>Enter a product name to view related case history.</span></div>
            ) : !searchResults.length ? (
              <div className={styles.productSearchEmpty}><strong>No data found</strong><span>This product was not found in faulty/returned products or replacement products.</span></div>
            ) : searchResults.map((result) => (
              <article key={`${result.sourceType}-${result.row.id}`} className={styles.productResultCard}>
                <div className={styles.productResultHeader}>
                  <div>
                    <strong>{result.code}</strong>
                    <span>{result.sourceLabel} • Found in: {result.foundIn.join(' & ') || '-'}</span>
                  </div>
                  <button className={styles.iconActionButton} onClick={() => result.sourceType === 'issue' ? openIssueDetail(result.row, { readonly: true }) : openCaseDetail(result.row, { readonly: true })} aria-label={`Open detail for ${result.code}`}>🔍</button>
                </div>
                <div className={styles.productResultGrid}>
                  <div><span>Type</span><strong>{result.sourceLabel}</strong></div>
                  <div><span>Date</span><strong>{formatShortDate(result.dateValue)}</strong></div>
                  <div className={styles.productResultGroupCell}><span>Group Order</span><strong>{renderGroupBadge(result.groupOrder)}</strong></div>
                  <div><span>Reason</span><strong>{result.reason}</strong></div>
                  <div><span>Follow-up</span><strong>{result.action}</strong></div>
                  <div><span>Customer</span><strong>{result.customer}</strong></div>
                  <div className={styles.productResultWide}><span>{result.returnedLabel}</span><strong>{result.returnedProduct || '-'}</strong></div>
                  <div className={styles.productResultWide}><span>Replacement Product</span><strong>{result.replacementProduct || '-'}</strong></div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <Modal open={receivingAddOpen} title="Add by Case Code" description="Search Pending cases, tick the checkbox, then use the Add button." onClose={() => { setReceivingAddOpen(false); setReceivingAddSelectedIds([]) }}>
        <div className={`${styles.receivingModalBody} ${styles.receivingAddModalBody}`}>
          <div className={styles.inputWithAction}>
            <input value={receivingAddSearch} onChange={(event) => setReceivingAddSearch(cleanUpper(event.target.value))} placeholder="TYPE CASE CODE" />
            <button disabled={busy} onClick={addCaseByCode}>{busy ? 'Adding...' : 'Add'}</button>
          </div>
          <div className={styles.receivingAddMeta}><span className={styles.caseCountPill}>{receivingAddRows.length} Pending</span><span className={styles.selectedCountPill}>{selectedReceivingAddRows.length} Selected</span></div>
          <div className={styles.receivingResultList}>
            {!receivingAddRows.length ? <EmptyState label="No Pending case found in the current period." /> : receivingAddRows.map((row) => {
              const selected = receivingAddSelectedIds.includes(String(row.id))
              return (
                <div key={row.id} className={styles.receivingResultItem}>
                  <input className={styles.compactCheckbox} type="checkbox" checked={selected} onChange={(event) => setReceivingAddSelectedIds((current) => event.target.checked ? [...new Set([...current, String(row.id)])] : current.filter((id) => id !== String(row.id)))} aria-label={`Select ${row.kode_kejadian || row.order_id}`} />
                  <div><strong>{row.kode_kejadian || '-'}</strong><span>{row.nama_customer || '-'} • {row.status_barang || '-'}</span></div>
                  <div className={styles.rowActions}><button className={styles.iconActionButton} onClick={() => openCaseDetail(row, { readonly: true })} aria-label={`Open detail for ${row.kode_kejadian || row.order_id}`}>🔍</button></div>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>

      <Modal open={receivingReprintOpen} title="Reprint Completed" description="Select completed return cases to print their labels again." onClose={() => setReceivingReprintOpen(false)}>
        <div className={styles.receivingModalBody}>
          <input className={styles.receivingSearchInput} value={receivingReprintSearch} onChange={(event) => setReceivingReprintSearch(cleanUpper(event.target.value))} placeholder="SEARCH CASE CODE, CUSTOMER, OR AWB" />
          <div className={styles.receivingMeta}><span className={styles.caseCountPill}>{receivingReprintRows.length} Completed</span><span className={styles.selectedCountPill}>{selectedReprintRows.length} Selected</span><button className={styles.primaryButton} onClick={() => printReceivingRows(selectedReprintRows)}>Print Selected</button></div>
          <div className={styles.receivingResultList}>
            {!receivingReprintRows.length ? <EmptyState label="No completed case found." /> : receivingReprintRows.map((row) => {
              const selected = receivingReprintSelectedIds.includes(String(row.id))
              return (
                <div key={row.id} className={styles.receivingResultItem}>
                  <label className={styles.inlineCheck}><input type="checkbox" checked={selected} onChange={(event) => setReceivingReprintSelectedIds((current) => event.target.checked ? [...new Set([...current, String(row.id)])] : current.filter((id) => id !== String(row.id)))} /> <span>{row.kode_kejadian || '-'}</span></label>
                  <div><strong>{row.nama_customer || '-'}</strong><span>{row.no_resi_pengiriman || '-'} • Completed</span></div>
                  <div className={styles.rowActions}><button className={styles.iconActionButton} onClick={() => openCaseDetail(row, { readonly: true })} aria-label={`Open detail for ${row.kode_kejadian || row.order_id}`}>🔍</button><button className={styles.primaryButton} onClick={() => printReceivingRows([row])}>Print</button></div>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(issueDetail)} title="Order Issue Details" description="Review order issue data without leaving the monitoring page." onClose={() => { setIssueDetail(null); setIssueDetailReadonly(false) }}>
        {issueDetail ? (
          <div className={styles.resolutionDetailModalBody}>
            <div className={styles.resolutionModalToolbar}>
              <div><strong>{issueDetail.order_id || '-'}</strong><span>{issueDetail.nama || '-'}</span></div>
              {!issueDetailReadonly ? <button className={styles.primaryButton} onClick={() => loadIssueEditState(issueDetail)}>Edit</button> : null}
            </div>

            <section className={`${styles.resolutionDetailSection} ${styles.resolutionDetailCaseOverview}`}>
              <h3>Issue Overview</h3>
              <div className={styles.resolutionDetailGrid}>
                <div className={styles.resolutionDetailValue}><span>Created Date</span><strong>{formatShortDate(issueDetail.created_at)}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Group Order</span><strong>{renderGroupBadge(issueDetail.group_order)}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Team</span><strong>{formatIssueTeamLabel(issueDetail.tim)}</strong></div>
                <div className={styles.resolutionDetailValue}><span>PIC</span><strong>{issueDetail.pic || '-'}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Need Handling</span><strong>{isIssuePending(issueDetail) ? 'Yes' : 'No'}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Additional Cost</span><strong>{formatMoney(issueDetail.biaya_timbul)}</strong></div>
              </div>
            </section>

            <section className={`${styles.resolutionDetailSection} ${styles.resolutionDetailSubject}`}>
              <h3>Subject Identity</h3>
              <div className={styles.resolutionDetailGrid}>
                <div className={styles.resolutionDetailValue}><span>Order ID</span><strong>{issueDetail.order_id || '-'}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Customer Name</span><strong>{issueDetail.nama || '-'}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Phone Number</span><strong>{issueDetail.no_hp || '-'}</strong></div>
              </div>
            </section>

            <section className={`${styles.resolutionDetailSection} ${styles.resolutionDetailReturns}`}>
              <h3>Issue Detail</h3>
              <div className={styles.resolutionDetailGrid}>
                <div className={styles.resolutionDetailValue}><span>Issue Reason</span><strong>{issueDetail.alasan_bermasalah || '-'}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Handling Action</span><strong>{issueDetail.tindak_lanjut || '-'}</strong></div>
                <div className={styles.resolutionDetailValue}><span>Additional Cost</span><strong>{formatMoney(issueDetail.biaya_timbul)}</strong></div>
                <div className={`${styles.resolutionDetailValue} ${styles.orderIssueWideDetail}`}><span>Faulty Product</span><strong>{issueDetail.produk_bermasalah || '-'}</strong></div>
                <div className={`${styles.resolutionDetailValue} ${styles.orderIssueWideDetail}`}><span>Replacement Product</span><strong>{issueDetail.produk_pengganti || '-'}</strong></div>
                <div className={`${styles.resolutionDetailValue} ${styles.orderIssueWideDetail}`}><span>Notes</span><strong>{issueDetail.keterangan || '-'}</strong></div>
              </div>
            </section>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(detail)} title={detail?.kode_kejadian ? 'Case Details' : `Order ${detail?.order_id || ''}`} description={detail?.kode_kejadian ? 'Review return case data without leaving the monitoring page.' : (detail?.nama || detail?.nama_customer || '')} onClose={closeCaseDetail}>
        {detailDraft ? (
          <div className={styles.resolutionDetailModalBody}>
            <div className={styles.resolutionModalToolbar}>
              <div><strong>{detailDraft.kode_kejadian || detailDraft.order_id}</strong><span>{detailDraft.nama_customer || detailDraft.nama || '-'}</span></div>
              {canEditDetail && detailMode === 'edit' ? (
                <div className={styles.resolutionModalActions}>
                  <button className={styles.softButton} onClick={() => { setDetailDraft(createDetailDraft(detail)); setDetailMode('view') }}>Cancel</button>
                  <button className={styles.primaryButton} disabled={busy} onClick={saveDetailEdit}>{busy ? 'Saving...' : 'Save Changes'}</button>
                </div>
              ) : canEditDetail ? (
                <button className={styles.primaryButton} onClick={() => setDetailMode('edit')}>Edit</button>
              ) : null}
            </div>

            <section className={`${styles.resolutionDetailSection} ${styles.resolutionDetailCaseOverview}`}>
              <h3>Case Overview</h3>
              <div className={styles.resolutionDetailGrid}>
                {renderDetailField({ key: 'kode_kejadian', label: 'Case Code', readonly: true })}
                {renderDetailField({ key: 'tanggal_pengajuan', label: 'Submission Date', type: 'date' })}
                {renderDetailField({ key: 'batas_tanggal_retur', label: 'Return Deadline', type: 'date' })}
                {renderDetailField({ key: 'group_order', label: 'Group Order', options: GROUPS })}
                {renderDetailField({ key: 'internal_external', label: 'Internal / External', options: ['Internal', 'External'] })}
                <div className={styles.resolutionDetailValue}><span>Warning</span><strong><span className={`${styles.statusBadge} ${getCaseWarningMeta(detailDraft, today).tone}`}>{getCaseWarningMeta(detailDraft, today).label}</span></strong></div>
              </div>
            </section>

            <section className={`${styles.resolutionDetailSection} ${styles.resolutionDetailSubject}`}>
              <h3>Subject Identity</h3>
              <div className={styles.resolutionDetailGrid}>
                {renderDetailField({ key: 'order_id', label: 'Order ID' })}
                {renderDetailField({ key: 'nama_customer', label: 'Customer Name' })}
                {renderDetailField({ key: 'no_handphone', label: 'Phone Number' })}
                {renderDetailField({ key: 'alamat', label: 'Address', textarea: true })}
                {renderDetailField({ key: 'no_resi_pengiriman', label: 'Shipment AWB' })}
                {renderDetailField({ key: 'nomor_tim', label: 'Packing Team', readonly: true })}
              </div>
            </section>

            <section className={`${styles.resolutionDetailSection} ${styles.resolutionDetailReturns}`}>
              <h3>Returns Detail</h3>
              <div className={styles.resolutionDetailGrid}>
                {renderDetailField({ key: 'retur_reason', label: 'Return Reason', options: masters.reasons.filter((item) => !item.reasoning_type || item.reasoning_type.toLowerCase() === detailDraft.internal_external.toLowerCase()).map((item) => item.name) })}
                {renderDetailField({ key: 'retur_action', label: 'Follow-up Action', options: masters.actions.map((item) => item.name) })}
                {renderDetailField({ key: 'courier_name', label: 'Shipping Courier', options: masters.couriers.map((item) => item.nama) })}
                {renderDetailField({ key: 'ongkir_masuk', label: 'Inbound Shipping Cost', type: 'number' })}
                {renderDetailField({ key: 'ongkir_keluar', label: 'Outbound Shipping Cost', type: 'number' })}
                {renderDetailField({ key: 'nilai_refund_kompensasi', label: 'Loss Value', type: 'number' })}
                {renderDetailField({ key: 'total_retur', label: 'Returned Item Value', type: 'number' })}
                {renderDetailField({ key: 'courier_service', label: 'Shipping Service', options: detailServiceOptions.map((item) => item.courier_service) })}
                {renderDetailField({ key: 'produk_diretur', label: 'Return / Faulty Product', textarea: true })}
                {renderDetailField({ key: 'produk_pengganti', label: 'Replacement Product', textarea: true })}
                {renderDetailField({ key: 'keterangan_tambahan', label: 'Internal Additional Notes', textarea: true })}
                {renderDetailField({ key: 'note_konsumen', label: 'Customer Notes', textarea: true })}
              </div>
            </section>

            <section className={`${styles.resolutionDetailSection} ${styles.resolutionDetailStatus}`}>
              <h3>Status</h3>
              <div className={styles.resolutionStatusPanel}>
                <div className={`${styles.resolutionStatusPreview} ${detailStatusOption.className}`}>
                  <span>ACTIVE STATUS</span>
                  <strong>{detailStatusOption.label}</strong>
                  <p>{detailStatusOption.description}</p>
                </div>
                <div className={styles.resolutionStatusControls}>
                  {canEditDetail && detailMode === 'edit' ? (
                    <div className={styles.resolutionStatusButtons}>
                      {Object.entries(RETURN_STATUS_OPTIONS).map(([value, option]) => (
                        <button key={value} className={`${detailDraft.status_barang === value ? styles.active : ''} ${option.className}`} onClick={() => setDetailDraft((current) => ({ ...current, status_barang: value }))}>{option.label}</button>
                      ))}
                    </div>
                  ) : null}
                  <label className={styles.resolutionPriorityToggle}><input type="checkbox" checked={Boolean(detailDraft.need_prioritized)} disabled={detailMode !== 'edit'} onChange={detailField('need_prioritized')} /> Priority case / needs special attention</label>
                </div>
              </div>
            </section>
          </div>
        ) : detail ? <div className={styles.resolutionDetailModalBody}><div className={styles.detailGrid}>{Object.entries(detail).filter(([, value]) => value !== null && value !== '').map(([key, value]) => <div key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</strong></div>)}</div></div> : null}
      </Modal>
    </div>
  )
}
