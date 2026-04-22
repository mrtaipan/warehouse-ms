'use client'

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
  summaryValue: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#111827',
  },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
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
}

function sameDay(dateString, selectedDate) {
  if (!selectedDate) return true
  if (!dateString) return false
  return String(dateString).slice(0, 10) === selectedDate
}

function getPrimaryObservedModel(item) {
  const firstObserved = Array.isArray(item.observed_items) ? item.observed_items[0] : null
  return firstObserved?.model_name || 'UNKNOWN MODEL'
}

function getBrandLabel(item) {
  return item.inbound_unload?.brands?.brand_name || 'UNBRANDED'
}

function getCategoryLabel(item) {
  return item.inbound_unload?.categories?.full_name || item.inbound_unload?.categories?.category_name || 'UNCATEGORIZED'
}

export default function QcDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qcItems, setQcItems] = useState([])
  const [qcMembers, setQcMembers] = useState([])
  const [grnFilter, setGrnFilter] = useState('')
  const [selectedDate, setSelectedDate] = useState('')

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true)
      setError('')

      const [{ data: qcRows, error: qcError }, { data: memberRows, error: memberError }] = await Promise.all([
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
              brands:brand_id (
                id,
                brand_name
              ),
              categories:category_id (
                id,
                category_name,
                full_name
              )
            )
          `)
          .order('created_at', { ascending: false }),
        supabase.from('qc_members').select('id, email, display_name, is_active').order('display_name', { ascending: true }),
      ])

      if (qcError || memberError) {
        setError(qcError?.message || memberError?.message || 'Failed to load QC dashboard.')
        setLoading(false)
        return
      }

      setQcItems(qcRows || [])
      setQcMembers(memberRows || [])
      setLoading(false)
    }

    loadDashboard()
  }, [])

  const grnOptions = useMemo(
    () => Array.from(new Set(qcItems.map((item) => item.inbound?.grn_number).filter(Boolean))),
    [qcItems]
  )

  const filteredItems = useMemo(
    () =>
      qcItems.filter((item) => {
        const matchesDate = sameDay(item.finished_at || item.created_at, selectedDate)
        const matchesGrn = !grnFilter || item.inbound?.grn_number === grnFilter
        return matchesDate && matchesGrn
      }),
    [grnFilter, qcItems, selectedDate]
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
      const model = getPrimaryObservedModel(item)
      const key = `${brand}|||${category}|||${model}`
      const current = grouped.get(key) || { brand, category, model, qtyA: 0, qtyB: 0, qtyC: 0, checked: 0 }
      current.qtyA += Number(item.qty_a || 0)
      current.qtyB += Number(item.qty_b || 0)
      current.qtyC += Number(item.qty_c || 0)
      current.checked += Number(item.qty_a || 0) + Number(item.qty_b || 0) + Number(item.qty_c || 0)
      grouped.set(key, current)
    })

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.brand !== b.brand) return a.brand.localeCompare(b.brand)
      if (a.category !== b.category) return a.category.localeCompare(b.category)
      return a.model.localeCompare(b.model)
    })
  }, [filteredItems])

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
          grouped.get(key) || { inspector: key, totalPcs: 0, totalMinutes: 0, daySet: new Set(), avgPerDay: 0, rate: 0 }

        current.totalPcs += totalPcs
        current.totalMinutes += minutes
        if (workDate) current.daySet.add(workDate)
        grouped.set(key, current)
      })

    return Array.from(grouped.values()).map((item) => {
      const dayCount = item.daySet.size || 1
      return {
        inspector: memberNameMap[item.inspector] || item.inspector,
        totalPcs: item.totalPcs,
        avgPerDay: Math.round((item.totalPcs / dayCount) * 100) / 100,
        rate: item.totalMinutes > 0 ? Math.round((item.totalPcs / item.totalMinutes) * 100) / 100 : 0,
      }
    })
  }, [filteredItems, memberNameMap])

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
  const totalChecked = filteredItems.reduce(
    (sum, item) => sum + Number(item.qty_a || 0) + Number(item.qty_b || 0) + Number(item.qty_c || 0),
    0
  )
  const today = new Date().toISOString().slice(0, 10)
  const todayItems = qcItems.filter((item) => sameDay(item.finished_at || item.created_at, today))
  const todayPcs = todayItems.reduce(
    (sum, item) => sum + Number(item.qty_a || 0) + Number(item.qty_b || 0) + Number(item.qty_c || 0),
    0
  )
  const activeInspectorsToday = qcMembers.filter((item) => item.is_active).length

  if (loading) {
    return <p style={styles.emptyText}>Loading QC dashboard...</p>
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div>
          <h1 style={styles.title}>QC Dashboard</h1>
          <p style={styles.subtitle}>
            See QC result summaries, inspector performance, category speed per PCS, today&apos;s active team, and allocation differences.
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
        </div>

        {error ? <p style={{ color: '#dc2626', margin: 0 }}>{error}</p> : null}

        <div style={styles.grid}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Today Active QC</span>
            <strong style={styles.summaryValue}>{activeInspectorsToday}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Today QC Qty</span>
            <strong style={styles.summaryValue}>{todayPcs}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Allocation</span>
            <strong style={styles.summaryValue}>{totalAllocated}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Difference</span>
            <strong style={styles.summaryValue}>{totalAllocated - totalChecked}</strong>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>QC Result Summary</h2>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
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
                  <td style={styles.td} colSpan={7}>
                    No QC result found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
              </tr>
            </thead>
            <tbody>
              {inspectorPerformance.length ? (
                inspectorPerformance.map((item) => (
                  <tr key={item.inspector}>
                    <td style={styles.td}>{item.inspector}</td>
                    <td style={styles.td}>{item.totalPcs}</td>
                    <td style={styles.td}>{item.avgPerDay}</td>
                    <td style={styles.td}>{item.rate}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={styles.td} colSpan={4}>
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
    </div>
  )
}
