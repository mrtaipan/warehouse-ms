'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { deliverySupabase } from '@/lib/delivery-supabase'
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
  nilai_refund_kompensasi: 'Refund or compensation value given to the customer.',
  ongkir_keluar: 'Shipping cost paid by us.',
  ongkir_masuk: 'Shipping cost received by us.',
  total_retur: 'Returned item value used as the shipping insurance reference.',
}

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
        <span className={styles.infoDot}>i</span>
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

const GROUP_CHOICE_CLASS = {
  ARKLINE: styles.groupChoiceArkline,
  MOB: styles.groupChoiceMob,
  OI: styles.groupChoiceOi,
}

const TYPE_CHOICE_CLASS = {
  External: styles.typeChoiceExternal,
  Internal: styles.typeChoiceInternal,
}

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
  group_order: 'MOB',
  keterangan: '',
  nama: '',
  no_hp: '',
  order_id: '',
  produk_bermasalah: '',
  produk_pengganti: '',
  tim: '',
  tindak_lanjut: '',
})

export default function ResolutionCenter() {
  const supabase = useMemo(() => createClient(), [])
  const today = useMemo(() => todayIso(), [])
  const [activeTab, setActiveTab] = useState('registration')
  const [pic, setPic] = useState('')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [filters, setFilters] = useState({ from: addDays(today, -6), group: '', search: '', to: today })
  const [cases, setCases] = useState([])
  const [issues, setIssues] = useState([])
  const [masters, setMasters] = useState({ actions: [], couriers: [], issueActions: [], issueReasons: [], reasons: [], services: [] })
  const [returnForm, setReturnForm] = useState(blankReturn(today))
  const [issueForm, setIssueForm] = useState(blankIssue())
  const [caseCode, setCaseCode] = useState('')
  const [detail, setDetail] = useState(null)
  const [productSearch, setProductSearch] = useState('')

  const loadMasters = useCallback(async () => {
    const results = await Promise.all([
      deliverySupabase.from('Retur_Reason').select('*').neq('is_active', false).order('id'),
      deliverySupabase.from('Retur_Action').select('*').neq('is_active', false).order('id'),
      deliverySupabase.from('Delivery_Courier').select('*').neq('is_active', false).order('nama'),
      deliverySupabase.from('Courier_Subclass').select('*').neq('is_active', false).order('courier_name'),
      deliverySupabase.from('Order_Issue').select('*').neq('is_active', false).order('id'),
      deliverySupabase.from('Order_Handling').select('*').neq('is_active', false).order('id'),
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
    })
  }, [])

  const getActorDisplayName = useCallback(async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) throw error
    if (!user) throw new Error('User session was not found.')

    const { data: profile, error: profileError } = await getProfileByAuthenticatedUser(supabase, user, 'display_name')
    if (profileError) throw profileError

    const metadataName =
      String(user.user_metadata?.display_name || '').trim() ||
      String(user.user_metadata?.full_name || '').trim() ||
      String(user.user_metadata?.name || '').trim()
    const displayName = String(profile?.display_name || metadataName || user.email || '').trim()

    if (!displayName) throw new Error('User display name was not found. Please complete the profile first.')
    return displayName
  }, [supabase])

  const loadCases = useCallback(async () => {
    let query = deliverySupabase
      .from('Error_Retur_Cases')
      .select('*')
      .gte('tanggal_pengajuan', jakartaStart(filters.from))
      .lte('tanggal_pengajuan', jakartaEnd(filters.to))
      .order('tanggal_pengajuan', { ascending: false })
    if (filters.group) query = query.eq('group_order', filters.group)
    const { data, error } = await query
    if (error) setStatus({ type: 'error', message: `Failed to load return cases: ${error.message}` })
    else setCases(data || [])
  }, [filters.from, filters.group, filters.to])

  const loadIssues = useCallback(async () => {
    const { data, error } = await deliverySupabase.from('Order_Issue_Cases').select('*').order('created_at', { ascending: false }).limit(500)
    if (error) setStatus({ type: 'error', message: `Failed to load order issues: ${error.message}` })
    else setIssues(data || [])
  }, [])

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

    getActorDisplayName()
      .then((displayName) => {
        if (!ignore) setPic(displayName)
      })
      .catch((error) => {
        if (!ignore) setStatus({ type: 'error', message: error.message || 'Failed to load signed-in user.' })
      })

    return () => {
      ignore = true
    }
  }, [getActorDisplayName])

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

  const visibleCases = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase()
    if (!keyword) return cases
    return cases.filter((row) => [row.kode_kejadian, row.order_id, row.no_resi_pengiriman, row.nama_customer].some((value) => String(value || '').toLowerCase().includes(keyword)))
  }, [cases, filters.search])

  const casesWithWarningMeta = useMemo(() => {
    return cases.map((row) => ({ meta: getCaseWarningMeta(row, today), row }))
  }, [cases, today])

  const stats = useMemo(() => {
    const warning = casesWithWarningMeta.filter(({ meta }) => meta.rank === 1).length
    const overdue = casesWithWarningMeta.filter(({ meta }) => meta.rank === 2).length
    const internal = countByValue(cases, 'internal_external', 'Internal')
    const external = countByValue(cases, 'internal_external', 'External')
    return { external, internal, overdue, warning }
  }, [cases, casesWithWarningMeta])

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
    if (!cases.length) {
      return [
        {
          detail: 'Insights will appear after real case data is loaded.',
          title: 'No data yet',
        },
      ]
    }

    const statusBreakdown = getTopCounts(cases, 'status_barang', 4)
    const topPic = getTopCounts(cases, 'pic', 3)
    const topGroups = getTopCounts(cases, 'group_order', 3)
    const topReasons = getTopCounts(cases, 'retur_reason', 3)
    const topActions = getTopCounts(cases, 'retur_action', 3)
    const totalLoss = cases.reduce((sum, row) => sum + safeNumber(row.nilai_refund_kompensasi), 0)
    const outboundCost = cases.reduce((sum, row) => sum + safeNumber(row.ongkir_keluar), 0)
    const inboundCost = cases.reduce((sum, row) => sum + safeNumber(row.ongkir_masuk), 0)

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
  }, [cases])

  const returnActionRules = useMemo(() => {
    const actionMeta = masters.actions.find((item) => String(item.name || '').trim() === String(returnForm.retur_action || '').trim()) || null
    return getReturnActionRules(actionMeta)
  }, [masters.actions, returnForm.retur_action])

  async function resolveActorName() {
    const actorName = pic || await getActorDisplayName()
    setPic(actorName)
    return actorName
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
      updated_at: new Date().toISOString(),
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
    if (!issueForm.order_id || !issueForm.nama || !issueForm.alasan_bermasalah || !issueForm.tindak_lanjut) {
      setStatus({ type: 'error', message: 'Complete Order ID, name, issue reason, and handling action.' })
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
    const { error } = await deliverySupabase.from('Order_Issue_Cases').insert({
      ...issueForm,
      biaya_timbul: safeNumber(issueForm.biaya_timbul),
      created_at: new Date().toISOString(),
      pic: actorName,
      updated_at: new Date().toISOString(),
    })
    setBusy(false)
    if (error) setStatus({ type: 'error', message: `Failed to save issue: ${error.message}` })
    else {
      setStatus({ type: 'success', message: 'Order issue was saved successfully.' })
      setIssueForm(blankIssue())
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
    const { error } = await deliverySupabase.from('Error_Retur_Cases').update({ pic: actorName, status_barang: nextStatus, updated_at: new Date().toISOString() }).eq('id', row.id)
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
  const issueField = (key) => (event) => setIssueForm((current) => ({ ...current, [key]: event.target.value }))
  const serviceOptions = masters.services.filter((item) => item.courier_name === returnForm.courier_name)
  const sendingCases = cases.filter((row) => ['Sending', 'Completed'].includes(row.status_barang))

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
    const returnRows = cases
      .filter((row) => [row.produk_diretur, row.produk_pengganti, row.order_id, row.nama_customer].some((value) => String(value || '').toLowerCase().includes(keyword)))
      .map((row) => ({ row, subtitle: `${row.kode_kejadian} • ${row.nama_customer}`, title: row.produk_diretur || row.order_id, type: 'RETURN' }))
    const issueRows = issues
      .filter((row) => [row.produk_bermasalah, row.produk_pengganti, row.order_id, row.nama].some((value) => String(value || '').toLowerCase().includes(keyword)))
      .map((row) => ({ row, subtitle: `${row.order_id} • ${row.nama}`, title: row.produk_bermasalah || row.order_id, type: 'ISSUE' }))
    return [...returnRows, ...issueRows]
  }, [cases, issues, productSearch])

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
                    <label className={styles.fullField}><span>{labelText('RETURNED / PROBLEM PRODUCT', returnActionRules.requiresReturn === true)}</span><textarea placeholder="> " value={returnForm.produk_diretur} onChange={returnField('produk_diretur')} /></label>
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
                    <button key={row.id} className={`${styles.resolutionWarningCard} ${meta.tone}`} onClick={() => setDetail(row)}>
                      <span>{meta.label}</span>
                      <strong>{row.kode_kejadian || row.order_id || '-'}</strong>
                      <small>{row.nama_customer || '-'} • Deadline {formatDate(row.batas_tanggal_retur)}</small>
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
            <div className={styles.panelHeader}><h2>CASE LIST</h2><span>{visibleCases.length} Rows</span></div>
            <div className={styles.panelBody}>
              <div className={styles.databaseFilter}>
                <label><span>GROUP</span><select value={filters.group} onChange={(event) => setFilters({ ...filters, group: event.target.value })}><option value="">ALL GROUPS</option>{GROUPS.map((group) => <option key={group}>{group}</option>)}</select></label>
                <label className={styles.searchField}><span>SEARCH</span><input placeholder="Search case code, order ID, AWB, or customer name" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
                <button className={styles.softButton} onClick={loadCases}>Refresh</button>
              </div>
              <div className={styles.tableWrap}><table><thead><tr><th>Date</th><th>Code</th><th>Group</th><th>Type</th><th>Customer</th><th>Order ID</th><th>AWB</th><th>Warning</th><th>Status</th><th>Action</th></tr></thead><tbody>
                {!visibleCases.length ? <tr><td colSpan="10"><EmptyState label="No data yet" /></td></tr> : visibleCases.map((row) => {
                  const meta = getCaseWarningMeta(row, today)
                  return <tr key={row.id}><td>{formatDate(row.tanggal_pengajuan)}</td><td><strong>{row.kode_kejadian}</strong></td><td>{row.group_order}</td><td>{row.internal_external}</td><td>{row.nama_customer}</td><td>{row.order_id}</td><td>{row.no_resi_pengiriman}</td><td><span className={`${styles.statusBadge} ${meta.tone}`}>{meta.label}</span></td><td><span className={styles.statusBadge}>{row.status_barang}</span></td><td><button className={styles.editButton} onClick={() => setDetail(row)}>Detail</button></td></tr>
                })}
              </tbody></table></div>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'receiving' ? (
        <section className={styles.dataCard}>
          <div className={styles.cardTitleRow}><div><h2>RECEIVING CONFIRMATION</h2><p className={styles.cardHint}>Cases with Sending status can be confirmed after returned goods are received.</p></div><button className={styles.softButton} onClick={loadCases}>Refresh</button></div>
          <div className={styles.tableWrap}><table><thead><tr><th>Code</th><th>Customer</th><th>AWB</th><th>Courier</th><th>Deadline</th><th>Status</th><th>Action</th></tr></thead><tbody>
            {!sendingCases.length ? <tr><td colSpan="7"><EmptyState label="No data yet" /></td></tr> : sendingCases.map((row) => <tr key={row.id}><td><strong>{row.kode_kejadian}</strong></td><td>{row.nama_customer}</td><td>{row.no_resi_pengiriman}</td><td>{row.courier_name || '-'}</td><td>{formatDate(row.batas_tanggal_retur)}</td><td>{row.status_barang}</td><td>{row.status_barang === 'Sending' ? <button className={styles.primaryButton} onClick={() => updateStatus(row, 'Completed')}>Complete</button> : <button className={styles.editButton} onClick={() => setDetail(row)}>Detail</button>}</td></tr>)}
          </tbody></table></div>
        </section>
      ) : null}

      {activeTab === 'issues' ? (
        <section className={styles.resolutionGrid}>
          <article className={styles.formPanel}>
            <div className={styles.panelHeader}><h2>INPUT ORDER ISSUE</h2><span>Issue Registration</span></div>
            <div className={styles.panelBody}>
              <div className={styles.formGrid}>
                <label><span>GROUP ORDER</span><select value={issueForm.group_order} onChange={issueField('group_order')}>{GROUPS.map((group) => <option key={group}>{group}</option>)}</select></label>
                <label><span>ORDER ID*</span><input value={issueForm.order_id} onChange={issueField('order_id')} /></label>
                <label><span>NAME*</span><input value={issueForm.nama} onChange={issueField('nama')} /></label>
                <label><span>PHONE NUMBER</span><input value={issueForm.no_hp} onChange={issueField('no_hp')} /></label>
                <label className={styles.fullField}><span>PROBLEM PRODUCT</span><textarea value={issueForm.produk_bermasalah} onChange={issueField('produk_bermasalah')} /></label>
                <label><span>ISSUE REASON*</span><select value={issueForm.alasan_bermasalah} onChange={issueField('alasan_bermasalah')}><option value="">SELECT REASON</option>{masters.issueReasons.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
                <label><span>HANDLING ACTION*</span><select value={issueForm.tindak_lanjut} onChange={issueField('tindak_lanjut')}><option value="">SELECT HANDLING</option>{masters.issueActions.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
                <label className={styles.fullField}><span>REPLACEMENT PRODUCT</span><textarea value={issueForm.produk_pengganti} onChange={issueField('produk_pengganti')} /></label>
                <label><span>TEAM</span><input value={issueForm.tim} onChange={issueField('tim')} /></label>
                <label><span>ADDITIONAL COST</span><input value={issueForm.biaya_timbul} onChange={issueField('biaya_timbul')} /></label>
                <label className={styles.fullField}><span>NOTES</span><textarea value={issueForm.keterangan} onChange={issueField('keterangan')} /></label>
              </div>
              <div className={styles.formActions}><button className={styles.primaryButton} disabled={busy} onClick={saveIssue}>Save</button><button className={styles.softButton} onClick={() => setIssueForm(blankIssue())}>Reset</button></div>
            </div>
          </article>
          <article className={styles.tablePanel}>
            <div className={styles.panelHeader}><h2>ORDER ISSUE LIST</h2><span>{issues.length} Rows</span></div>
            <div className={styles.panelBody}><div className={styles.tableWrap}><table><thead><tr><th>Date</th><th>Group</th><th>Order ID</th><th>Name</th><th>Issue</th><th>Handling</th><th>PIC</th></tr></thead><tbody>{!issues.length ? <tr><td colSpan="7"><EmptyState label="No data yet" /></td></tr> : issues.map((row) => <tr key={row.id}><td>{formatDate(row.created_at)}</td><td>{row.group_order}</td><td><strong>{row.order_id}</strong></td><td>{row.nama}</td><td>{row.alasan_bermasalah}</td><td>{row.tindak_lanjut}</td><td>{row.pic}</td></tr>)}</tbody></table></div></div>
          </article>
        </section>
      ) : null}

      {activeTab === 'search' ? (
        <section className={styles.dataCard}>
          <div className={styles.cardTitleRow}><div><h2>PRODUCT SEARCH</h2><p className={styles.cardHint}>Search products, customers, or Order IDs across return cases and order issues.</p></div></div>
          <label className={styles.bigSearch}><span>SEARCH</span><input autoFocus placeholder="Type product name, customer, or Order ID" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} /></label>
          <div className={styles.searchResults}>{!productSearch ? <EmptyState label="Enter a search keyword." /> : !searchResults.length ? <EmptyState label="No data found." /> : searchResults.map((result, index) => <button key={`${result.type}-${index}`} onClick={() => setDetail(result.row)}><span>{result.type}</span><strong>{result.title}</strong><small>{result.subtitle}</small></button>)}</div>
        </section>
      ) : null}

      <Modal open={Boolean(detail)} title={detail?.kode_kejadian ? `Case ${detail.kode_kejadian}` : `Order ${detail?.order_id || ''}`} description={detail?.nama_customer || detail?.nama || ''} onClose={() => setDetail(null)} actions={<button className={styles.softButton} onClick={() => setDetail(null)}>Close</button>}>
        {detail ? <div className={styles.detailGrid}>{Object.entries(detail).filter(([, value]) => value !== null && value !== '').slice(0, 18).map(([key, value]) => <div key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</strong></div>)}</div> : null}
      </Modal>
    </div>
  )
}
