'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#6b7280',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '20px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '16px',
  },
  summaryCard: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  summaryLabel: {
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  infoIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    marginLeft: '6px',
    borderRadius: '999px',
    border: '1px solid #9ca3af',
    color: '#6b7280',
    fontSize: '11px',
    fontWeight: '700',
    lineHeight: 1,
    cursor: 'help',
    textTransform: 'none',
  },
  infoWrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  },
  infoTooltip: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '240px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: '#111827',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '500',
    lineHeight: 1.5,
    textTransform: 'none',
    zIndex: 20,
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.22)',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#111827',
  },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
  },
  input: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
  },
  select: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    background: '#fff',
    width: '100%',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: '700',
    color: '#374151',
    padding: '12px 14px',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
  },
  td: {
    padding: '12px 14px',
    fontSize: '14px',
    color: '#111827',
    borderBottom: '1px solid #f1f5f9',
  },
  emptyText: {
    margin: 0,
    color: '#6b7280',
  },
  previewButton: {
    width: '36px',
    height: '36px',
    border: '1px solid #d1d5db',
    borderRadius: '999px',
    background: '#fff',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  detailButton: {
    height: '34px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '999px',
    background: '#fff',
    color: '#111827',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 40,
  },
  modal: {
    width: '100%',
    maxWidth: '520px',
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  previewImage: {
    width: '100%',
    height: 'auto',
    maxHeight: '70vh',
    objectFit: 'contain',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
  modalTableWrap: {
    maxHeight: '360px',
    overflow: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
  },
}

function sameDay(dateString, selectedDate) {
  if (!selectedDate) return true
  if (!dateString) return false
  return String(dateString).slice(0, 10) === selectedDate
}

function getTaskModelInfo(item) {
  return {
    model: item.model_name || 'UNKNOWN MODEL',
    photoUrl: item.photo_url || '',
  }
}

function getBrandLabel(item) {
  return item.inbound_unload?.brands?.brand_name || 'UNBRANDED'
}

function getCategoryLabel(item) {
  return item.inbound_unload?.categories?.full_name || item.inbound_unload?.categories?.category_name || 'UNCATEGORIZED'
}

function getConfirmBrandLabel(item) {
  return item.brands?.brand_name || 'UNBRANDED'
}

function getConfirmCategoryLabel(item) {
  return item.categories?.full_name || item.categories?.category_name || 'UNCATEGORIZED'
}

function getReturnBrandLabel(item) {
  return item.brands?.brand_name || 'UNBRANDED'
}

function getReturnCategoryLabel(item) {
  return item.categories?.full_name || item.categories?.category_name || 'UNCATEGORIZED'
}

function getPauseDurationSeconds(item) {
  if (Number(item.duration_seconds || 0) > 0) {
    return Number(item.duration_seconds || 0)
  }

  const pausedAtMs = item.paused_at ? new Date(item.paused_at).getTime() : null
  const resumedAtMs = item.resumed_at ? new Date(item.resumed_at).getTime() : null

  if (!pausedAtMs) {
    return 0
  }

  const endMs = resumedAtMs || Date.now()
  return Math.max(0, Math.floor((endMs - pausedAtMs) / 1000))
}

function formatHours(seconds) {
  return Math.round((Number(seconds || 0) / 3600) * 100) / 100
}

function InfoHint({ text }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      style={styles.infoWrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button type="button" style={styles.infoIcon} aria-label={text}>
        i
      </button>
      {open ? <span style={styles.infoTooltip}>{text}</span> : null}
    </span>
  )
}

export default function QcDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pausingAll, setPausingAll] = useState(false)
  const [showPauseConfirm, setShowPauseConfirm] = useState(false)
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [qcItems, setQcItems] = useState([])
  const [qcConfirmRows, setQcConfirmRows] = useState([])
  const [returnRows, setReturnRows] = useState([])
  const [qcMembers, setQcMembers] = useState([])
  const [pauseLogs, setPauseLogs] = useState([])
  const [grnFilter, setGrnFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [pauseDetailInspector, setPauseDetailInspector] = useState('')

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true)
      setError('')

      const [
        { data: qcRows, error: qcError },
        { data: confirmRows, error: confirmError },
        { data: returnData, error: returnError },
        { data: memberRows, error: memberError },
        { data: pauseLogRows, error: pauseLogError },
      ] = await Promise.all([
        supabase
          .from('qc_items')
          .select(`
            *,
            inbound:inbound_id (
              id,
              grn_number
            ),
            inbound_unload:inbound_unload_id (
              id,
              brand_id,
              category_id,
              brands:dir_brands!brand_id (
                id,
                brand_name
              ),
              categories:dir_categories!category_id (
                id,
                category_name,
                full_name
              )
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('qc_confirm')
          .select(`
            id,
            inbound_id,
            model_name,
            model_color,
            photo_url,
            qty,
            grade,
            is_adjustment,
            created_at,
            inbound:inbound_id (
              id,
              grn_number
            ),
            brands:dir_brands!brand_id (
              id,
              brand_name
            ),
            categories:dir_categories!category_id (
              id,
              category_name,
              full_name
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('warehouse_returns')
          .select(`
            id,
            inbound_id,
            model_name,
            model_color,
            qty,
            grade,
            is_adjustment,
            created_at,
            source_phase,
            inbound:inbound_id (
              id,
              grn_number
            ),
            brands:dir_brands!brand_id (
              id,
              brand_name
            ),
            categories:dir_categories!category_id (
              id,
              category_name,
              full_name
            )
          `)
          .eq('source_phase', 'qc')
          .order('created_at', { ascending: false }),
        supabase.from('qc_members').select('id, email, display_name, is_active').order('display_name', { ascending: true }),
        supabase
          .from('qc_pause_logs')
          .select(`
            id,
            qc_item_id,
            paused_by,
            pause_reason,
            paused_at,
            resumed_at,
            resumed_by,
            duration_seconds,
            qc_item:qc_item_id (
              id,
              assigned_to,
              inbound:inbound_id (
                id,
                grn_number
              ),
              inbound_unload:inbound_unload_id (
                id,
                brand_id,
                category_id,
                brands:dir_brands!brand_id (
                  id,
                  brand_name
                ),
                categories:dir_categories!category_id (
                  id,
                  category_name,
                  full_name
                )
              )
            )
          `)
          .order('paused_at', { ascending: false }),
      ])

      if (qcError || confirmError || returnError || memberError || pauseLogError) {
        setError(qcError?.message || confirmError?.message || returnError?.message || memberError?.message || pauseLogError?.message || 'Failed to load QC dashboard.')
        setLoading(false)
        return
      }

      setQcItems(qcRows || [])
      setQcConfirmRows(confirmRows || [])
      setReturnRows(returnData || [])
      setQcMembers(memberRows || [])
      setPauseLogs(pauseLogRows || [])
      setLoading(false)
    }

    loadDashboard()
  }, [])

  const grnOptions = useMemo(
    () => Array.from(new Set(qcItems.map((item) => item.inbound?.grn_number).filter(Boolean))),
    [qcItems]
  )
  const brandOptions = useMemo(
    () => Array.from(new Set(qcItems.map((item) => getBrandLabel(item)).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [qcItems]
  )
  const categoryOptions = useMemo(
    () => Array.from(new Set(qcItems.map((item) => getCategoryLabel(item)).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [qcItems]
  )

  const filteredItems = useMemo(
    () =>
      qcItems.filter((item) => {
        const matchesDate = sameDay(item.finished_at || item.created_at, selectedDate)
        const matchesGrn = !grnFilter || item.inbound?.grn_number === grnFilter
        const matchesBrand = !brandFilter || getBrandLabel(item) === brandFilter
        const matchesCategory = !categoryFilter || getCategoryLabel(item) === categoryFilter
        return matchesDate && matchesGrn && matchesBrand && matchesCategory
      }),
    [brandFilter, categoryFilter, grnFilter, qcItems, selectedDate]
  )

  const filteredAdjustmentRows = useMemo(
    () =>
      qcConfirmRows.filter((item) => {
        if (!item.is_adjustment) {
          return false
        }

        const matchesDate = sameDay(item.created_at, selectedDate)
        const matchesGrn = !grnFilter || item.inbound?.grn_number === grnFilter
        const matchesBrand = !brandFilter || getConfirmBrandLabel(item) === brandFilter
        const matchesCategory = !categoryFilter || getConfirmCategoryLabel(item) === categoryFilter
        return matchesDate && matchesGrn && matchesBrand && matchesCategory
      }),
    [brandFilter, categoryFilter, grnFilter, qcConfirmRows, selectedDate]
  )

  const filteredReturnAdjustmentRows = useMemo(
    () =>
      returnRows.filter((item) => {
        if (!item.is_adjustment) {
          return false
        }

        const matchesDate = sameDay(item.created_at, selectedDate)
        const matchesGrn = !grnFilter || item.inbound?.grn_number === grnFilter
        const matchesBrand = !brandFilter || getReturnBrandLabel(item) === brandFilter
        const matchesCategory = !categoryFilter || getReturnCategoryLabel(item) === categoryFilter
        return matchesDate && matchesGrn && matchesBrand && matchesCategory
      }),
    [brandFilter, categoryFilter, grnFilter, returnRows, selectedDate]
  )

  const filteredPauseLogs = useMemo(
    () =>
      pauseLogs.filter((item) => {
        const matchesDate = sameDay(item.paused_at, selectedDate)
        const matchesGrn = !grnFilter || item.qc_item?.inbound?.grn_number === grnFilter
        const matchesBrand = !brandFilter || getBrandLabel(item.qc_item || {}) === brandFilter
        const matchesCategory = !categoryFilter || getCategoryLabel(item.qc_item || {}) === categoryFilter
        return matchesDate && matchesGrn && matchesBrand && matchesCategory
      }),
    [brandFilter, categoryFilter, grnFilter, pauseLogs, selectedDate]
  )

  const memberNameMap = useMemo(
    () =>
      qcMembers.reduce((result, item) => {
        result[item.email] = item.display_name || item.email
        return result
      }, {}),
    [qcMembers]
  )

  const qcResultSummary = useMemo(() => {
    const grouped = new Map()

    filteredItems.forEach((item) => {
      const brand = getBrandLabel(item)
      const category = getCategoryLabel(item)
      const taskModel = getTaskModelInfo(item)
      const model = taskModel.model
      const key = `${brand}|||${category}|||${model}`
      const current = grouped.get(key) || { brand, category, model, photoUrl: taskModel.photoUrl, qtyA: 0, qtyB: 0, qtyC: 0, checked: 0 }
      current.qtyA += Number(item.qty_a || 0)
      current.qtyB += Number(item.qty_b || 0)
      current.qtyC += Number(item.qty_c || 0)
      current.checked += Number(item.qty_a || 0) + Number(item.qty_b || 0) + Number(item.qty_c || 0)
      current.photoUrl = current.photoUrl || taskModel.photoUrl
      grouped.set(key, current)
    })

    filteredAdjustmentRows.forEach((item) => {
      const brand = getConfirmBrandLabel(item)
      const category = getConfirmCategoryLabel(item)
      const model = item.model_name || 'UNKNOWN MODEL'
      const key = `${brand}|||${category}|||${model}`
      const current = grouped.get(key) || { brand, category, model, photoUrl: item.photo_url || '', qtyA: 0, qtyB: 0, qtyC: 0, checked: 0 }
      const grade = String(item.grade || 'A').toUpperCase()
      const qty = Number(item.qty || 0)

      if (grade === 'A') current.qtyA += qty
      if (grade === 'B') current.qtyB += qty
      if (grade === 'C') current.qtyC += qty
      current.checked += qty
      current.photoUrl = current.photoUrl || item.photo_url || ''
      grouped.set(key, current)
    })

    filteredReturnAdjustmentRows.forEach((item) => {
      const brand = getReturnBrandLabel(item)
      const category = getReturnCategoryLabel(item)
      const model = item.model_name || 'UNKNOWN MODEL'
      const key = `${brand}|||${category}|||${model}`
      const current = grouped.get(key) || { brand, category, model, photoUrl: '', qtyA: 0, qtyB: 0, qtyC: 0, checked: 0 }
      const grade = String(item.grade || 'A').toUpperCase()
      const qty = Number(item.qty || 0)

      if (grade === 'A') current.qtyA += qty
      if (grade === 'B') current.qtyB += qty
      if (grade === 'C') current.qtyC += qty
      current.checked += qty
      grouped.set(key, current)
    })

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.brand !== b.brand) return a.brand.localeCompare(b.brand)
      if (a.category !== b.category) return a.category.localeCompare(b.category)
      return a.model.localeCompare(b.model)
    })
  }, [filteredAdjustmentRows, filteredItems, filteredReturnAdjustmentRows])

  const inspectorPerformance = useMemo(() => {
    const grouped = new Map()

    filteredItems
      .filter((item) => item.status === 'done')
      .forEach((item) => {
        const key = item.assigned_to || '-'
        const totalPcs = Number(item.qty_a || 0) + Number(item.qty_b || 0) + Number(item.qty_c || 0)
        const minutes = Number(item.stopwatch_seconds || 0) / 60
        const workDate = String(item.finished_at || item.created_at || '').slice(0, 10)
        const current =
          grouped.get(key) || {
            inspector: key,
            totalPcs: 0,
            totalMinutes: 0,
            daySet: new Set(),
            avgPerDay: 0,
            rate: 0,
            nonProductiveSeconds: 0,
            pauseLogs: [],
          }

        current.totalPcs += totalPcs
        current.totalMinutes += minutes
        if (workDate) current.daySet.add(workDate)
        grouped.set(key, current)
      })

    filteredPauseLogs.forEach((item) => {
      const key = item.qc_item?.assigned_to || item.paused_by || '-'
      const current =
        grouped.get(key) || {
          inspector: key,
          totalPcs: 0,
          totalMinutes: 0,
          daySet: new Set(),
          avgPerDay: 0,
          rate: 0,
          nonProductiveSeconds: 0,
          pauseLogs: [],
        }

      current.nonProductiveSeconds += getPauseDurationSeconds(item)
      current.pauseLogs.push(item)
      grouped.set(key, current)
    })

    return Array.from(grouped.values()).map((item) => {
      const dayCount = item.daySet.size || 1
      return {
        inspector: memberNameMap[item.inspector] || item.inspector,
        inspectorKey: item.inspector,
        totalPcs: item.totalPcs,
        avgPerDay: Math.round((item.totalPcs / dayCount) * 100) / 100,
        rate: item.totalMinutes > 0 ? Math.round((item.totalPcs / item.totalMinutes) * 100) / 100 : 0,
        nonProductiveHours: formatHours(item.nonProductiveSeconds),
        pauseLogs: [...(item.pauseLogs || [])].sort((a, b) => new Date(b.paused_at || 0).getTime() - new Date(a.paused_at || 0).getTime()),
      }
    })
  }, [filteredItems, filteredPauseLogs, memberNameMap])

  const categoryTimes = useMemo(() => {
    const grouped = new Map()

    filteredItems
      .filter((item) => item.status === 'done')
      .forEach((item) => {
        const categoryLabel =
          item.inbound_unload?.categories?.full_name || item.inbound_unload?.categories?.category_name || 'UNCATEGORIZED'
        const checkedQty = Number(item.qty_a || 0) + Number(item.qty_b || 0) + Number(item.qty_c || 0)
        const current = grouped.get(categoryLabel) || { category: categoryLabel, totalSeconds: 0, totalPcs: 0 }
        current.totalSeconds += Number(item.stopwatch_seconds || 0)
        current.totalPcs += checkedQty
        grouped.set(categoryLabel, current)
      })

    return Array.from(grouped.values()).map((item) => ({
      category: item.category,
      secondsPerPcs: item.totalPcs ? Math.round((item.totalSeconds / item.totalPcs) * 100) / 100 : 0,
    }))
  }, [filteredItems])

  const totalAllocated = filteredItems.reduce((sum, item) => sum + Number(item.allocated_qty || 0), 0)
  const totalLocked = filteredItems.reduce((sum, item) => sum + Number(item.locked_qty || 0), 0)
  const totalChecked =
    filteredItems.reduce((sum, item) => sum + Number(item.qty_a || 0) + Number(item.qty_b || 0) + Number(item.qty_c || 0), 0) +
    filteredAdjustmentRows.reduce((sum, item) => sum + Number(item.qty || 0), 0) +
    filteredReturnAdjustmentRows.reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const totalGradeA =
    filteredItems.reduce((sum, item) => sum + Number(item.qty_a || 0), 0) +
    filteredAdjustmentRows
      .filter((item) => String(item.grade || 'A').toUpperCase() === 'A')
      .reduce((sum, item) => sum + Number(item.qty || 0), 0) +
    filteredReturnAdjustmentRows
      .filter((item) => String(item.grade || 'A').toUpperCase() === 'A')
      .reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const totalGradeB =
    filteredItems.reduce((sum, item) => sum + Number(item.qty_b || 0), 0) +
    filteredAdjustmentRows
      .filter((item) => String(item.grade || 'A').toUpperCase() === 'B')
      .reduce((sum, item) => sum + Number(item.qty || 0), 0) +
    filteredReturnAdjustmentRows
      .filter((item) => String(item.grade || 'A').toUpperCase() === 'B')
      .reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const totalGradeC =
    filteredItems.reduce((sum, item) => sum + Number(item.qty_c || 0), 0) +
    filteredAdjustmentRows
      .filter((item) => String(item.grade || 'A').toUpperCase() === 'C')
      .reduce((sum, item) => sum + Number(item.qty || 0), 0) +
    filteredReturnAdjustmentRows
      .filter((item) => String(item.grade || 'A').toUpperCase() === 'C')
      .reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const selectedInspectorPauseLogs =
    inspectorPerformance.find((item) => item.inspectorKey === pauseDetailInspector)?.pauseLogs || []
  const totalRemaining = filteredItems.reduce(
    (sum, item) => sum + (Number(item.locked_qty || 0) - Number(item.allocated_qty || 0)),
    0
  )

  async function handlePauseAllQc() {
    setError('')
    setSuccess('')
    setPausingAll(true)

    const runningTasks = qcItems.filter((item) => item.status === 'in_progress')

    if (!runningTasks.length) {
      setSuccess('There are no running QC tasks to pause right now.')
      setPausingAll(false)
      return
    }

    const updates = runningTasks.map(async (item) => {
      const baseSeconds = Number(item.stopwatch_seconds || 0)
      const startedAtMs = item.started_at ? new Date(item.started_at).getTime() : null
      const liveSeconds = startedAtMs
        ? baseSeconds + Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
        : baseSeconds
      const pausedAt = new Date().toISOString()

      return supabase
        .from('qc_items')
        .update({
          status: 'paused',
          stopwatch_seconds: liveSeconds,
          pause_reason: 'COORDINATOR BREAK',
          paused_at: pausedAt,
          started_at: null,
        })
        .eq('id', item.id)
    })

    const results = await Promise.all(updates)
    const failed = results.find((result) => result.error)

    if (failed?.error) {
      setError(failed.error.message)
      setPausingAll(false)
      return
    }

    setQcItems((prev) =>
      prev.map((item) => {
        if (item.status !== 'in_progress') return item
        const baseSeconds = Number(item.stopwatch_seconds || 0)
        const startedAtMs = item.started_at ? new Date(item.started_at).getTime() : null
        const liveSeconds = startedAtMs
          ? baseSeconds + Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
          : baseSeconds

        return {
          ...item,
          status: 'paused',
          stopwatch_seconds: liveSeconds,
          pause_reason: 'COORDINATOR BREAK',
          paused_at: new Date().toISOString(),
          started_at: null,
        }
      })
    )
    setSuccess('All running QC stopwatches are now paused. Inspectors can resume later from Grading Task.')
    setPausingAll(false)
    setShowPauseConfirm(false)
  }

  if (loading) {
    return <p style={styles.emptyText}>Loading QC dashboard...</p>
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div>
          <h1 style={styles.title}>QC Dashboard</h1>
          <p style={styles.subtitle}>
            See QC result summaries, inspector performance, category speed per PCS, and current allocation progress.
          </p>
          <p style={styles.subtitle}>
            Allocation gap keeps planner mismatch visible even when the grading task is already done.
          </p>
        </div>

        <div style={styles.filters}>
          <div style={styles.field}>
            <label style={styles.label}>View Mode</label>
            <select
              value={selectedDate ? 'daily' : 'total'}
              onChange={(event) => {
                if (event.target.value === 'total') {
                  setSelectedDate('')
                } else if (!selectedDate) {
                  setSelectedDate(today)
                }
              }}
              style={styles.select}
            >
              <option value="total">Total</option>
              <option value="daily">Per Day</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              style={styles.input}
              disabled={!selectedDate && false}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>GRN Number</label>
            <input
              list="qc-dashboard-grn-options"
              value={grnFilter}
              onChange={(event) => setGrnFilter(event.target.value)}
              style={styles.input}
              placeholder="All GRN"
            />
            <datalist id="qc-dashboard-grn-options">
              {grnOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Brand</label>
            <input
              list="qc-dashboard-brand-options"
              value={brandFilter}
              onChange={(event) => setBrandFilter(event.target.value)}
              style={styles.input}
              placeholder="All Brand"
            />
            <datalist id="qc-dashboard-brand-options">
              {brandOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Category</label>
            <input
              list="qc-dashboard-category-options"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              style={styles.input}
              placeholder="All Category"
            />
            <datalist id="qc-dashboard-category-options">
              {categoryOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
        </div>

        {error ? <p style={{ color: '#dc2626', margin: 0 }}>{error}</p> : null}
        {success ? <p style={{ color: '#16a34a', margin: 0 }}>{success}</p> : null}

        <div style={styles.buttonRow}>
          <button
            type="button"
            onClick={() => setShowPauseConfirm(true)}
            disabled={pausingAll}
            style={{
              height: '42px',
              padding: '0 16px',
              border: 'none',
              borderRadius: '8px',
              background: '#dc2626',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              opacity: pausingAll ? 0.6 : 1,
            }}
          >
            {pausingAll ? 'Pausing...' : 'Pause All QC'}
          </button>
        </div>

        <div style={styles.grid}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Allocation</span>
            <strong style={styles.summaryValue}>{totalAllocated}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>
              Graded Qty
              <InfoHint text="Qty yang sudah di QC oleh Grader." />
            </span>
            <strong style={styles.summaryValue}>{totalLocked}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>
              Allocation Gap
              <InfoHint text="Perbedaan Qty antara Qty yang dialokasikan dan Qty yang diQC oleh Grader." />
            </span>
            <strong style={{ ...styles.summaryValue, color: totalRemaining > 0 ? '#16a34a' : totalRemaining < 0 ? '#dc2626' : '#111827' }}>
              {totalRemaining > 0 ? '+' : ''}
              {totalRemaining}
            </strong>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>QC Result Summary</h2>
        {!grnFilter ? <p style={styles.emptyText}>Choose a GRN Number first to see QC result summary for that GRN.</p> : null}
        {grnFilter ? (
        <>
        <div style={styles.grid}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Grade A</span>
            <strong style={styles.summaryValue}>{totalGradeA}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Grade B</span>
            <strong style={styles.summaryValue}>{totalGradeB}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Grade C</span>
            <strong style={styles.summaryValue}>{totalGradeC}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Checked Total</span>
            <strong style={styles.summaryValue}>{totalChecked}</strong>
          </div>
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Photo</th>
                <th style={styles.th}>Brand</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Model</th>
                <th style={styles.th}>Qty A</th>
                <th style={styles.th}>Qty B</th>
                <th style={styles.th}>Qty C</th>
                <th style={styles.th}>Checked Total</th>
              </tr>
            </thead>
            <tbody>
              {qcResultSummary.length ? (
                qcResultSummary.map((item) => (
                  <tr key={`${item.brand}-${item.category}-${item.model}`}>
                    <td style={styles.td}>
                      {item.photoUrl ? (
                        <button type="button" style={styles.previewButton} onClick={() => setPreviewPhoto({ url: item.photoUrl, label: item.model })} title="Preview photo">
                          👁
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td style={styles.td}>{item.brand}</td>
                    <td style={styles.td}>{item.category}</td>
                    <td style={styles.td}>{item.model}</td>
                    <td style={styles.td}>{item.qtyA}</td>
                    <td style={styles.td}>{item.qtyB}</td>
                    <td style={styles.td}>{item.qtyC}</td>
                    <td style={styles.td}>{item.checked}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={styles.td} colSpan={8}>
                    No QC result found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
        ) : null}
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Inspector Performance</h2>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Inspector</th>
                <th style={styles.th}>Total PCS</th>
                <th style={styles.th}>Average PCS / Day</th>
                <th style={styles.th}>QC Rate PCS / Minute</th>
                <th style={styles.th}>Non-Productive Hours</th>
                <th style={styles.th}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {inspectorPerformance.length ? (
                inspectorPerformance.map((item) => (
                  <tr key={item.inspectorKey}>
                    <td style={styles.td}>{item.inspector}</td>
                    <td style={styles.td}>{item.totalPcs}</td>
                    <td style={styles.td}>{item.avgPerDay}</td>
                    <td style={styles.td}>{item.rate}</td>
                    <td style={styles.td}>{item.nonProductiveHours}</td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        style={styles.detailButton}
                        onClick={() => setPauseDetailInspector(item.inspectorKey)}
                        disabled={!item.pauseLogs.length}
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={styles.td} colSpan={6}>
                    No inspector data found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>QC Speed Per Category</h2>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Seconds / PCS</th>
              </tr>
            </thead>
            <tbody>
              {categoryTimes.length ? (
                categoryTimes.map((item) => (
                  <tr key={item.category}>
                    <td style={styles.td}>{item.category}</td>
                    <td style={styles.td}>{item.secondsPerPcs}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={styles.td} colSpan={2}>
                    No category timing data found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPauseConfirm ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div>
              <h2 style={styles.sectionTitle}>Pause All QC?</h2>
              <p style={styles.subtitle}>All running QC stopwatches will be paused first, then each inspector can resume individually later.</p>
            </div>
            <div style={styles.buttonRow}>
              <button type="button" onClick={() => setShowPauseConfirm(false)} style={{ height: '42px', padding: '0 16px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: '#111827', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="button" onClick={handlePauseAllQc} style={{ height: '42px', padding: '0 16px', border: 'none', borderRadius: '8px', background: '#dc2626', color: '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                {pausingAll ? 'Pausing...' : 'Pause All QC'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewPhoto ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div>
              <h2 style={styles.sectionTitle}>{previewPhoto.label}</h2>
            </div>
            <Image src={previewPhoto.url} alt={previewPhoto.label} width={720} height={720} unoptimized style={styles.previewImage} />
            <div style={styles.buttonRow}>
              <button type="button" onClick={() => setPreviewPhoto(null)} style={{ height: '42px', padding: '0 16px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: '#111827', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pauseDetailInspector ? (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: '760px' }}>
            <div>
              <h2 style={styles.sectionTitle}>
                Non-Productive Detail - {memberNameMap[pauseDetailInspector] || pauseDetailInspector}
              </h2>
              <p style={styles.subtitle}>Detail kegiatan non-produktif yang tercatat dari pause log inspector ini.</p>
            </div>
            <div style={styles.modalTableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Reason</th>
                    <th style={styles.th}>Paused At</th>
                    <th style={styles.th}>Resumed At</th>
                    <th style={styles.th}>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInspectorPauseLogs.length ? (
                    selectedInspectorPauseLogs.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>{item.pause_reason || '-'}</td>
                        <td style={styles.td}>{item.paused_at ? new Date(item.paused_at).toLocaleString() : '-'}</td>
                        <td style={styles.td}>{item.resumed_at ? new Date(item.resumed_at).toLocaleString() : '-'}</td>
                        <td style={styles.td}>{formatHours(getPauseDurationSeconds(item))}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td style={styles.td} colSpan={4}>
                        No non-productive activity detail found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={styles.buttonRow}>
              <button type="button" onClick={() => setPauseDetailInspector('')} style={{ height: '42px', padding: '0 16px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: '#111827', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
