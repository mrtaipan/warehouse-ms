'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import { analyzeExpenses, monthKey, shiftMonth } from './expense-analysis.mjs'
import styles from './expense-explorer.module.css'
import ExpenseDetail from './expense-detail'

Chart.register(...registerables)
const money = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const compact = value => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
const monthLabel = key => new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`))

const lineGlow = {
  id: 'expenseLineGlow',
  beforeDatasetDraw(chart, { index }) {
    chart.ctx.save()
    chart.ctx.shadowColor = index === 0 ? '#2563eb66' : '#16a34a55'
    chart.ctx.shadowBlur = 8
    chart.ctx.shadowOffsetY = 3
  },
  afterDatasetDraw(chart) { chart.ctx.restore() },
}
function areaGradient({ chart, datasetIndex }) {
  const area = chart.chartArea
  if (!area) return 'transparent'
  const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
  const color = datasetIndex === 0 ? '37,99,235' : '22,163,74'
  gradient.addColorStop(0, `rgba(${color},0.22)`)
  gradient.addColorStop(0.7, `rgba(${color},0.06)`)
  gradient.addColorStop(1, `rgba(${color},0)`)
  return gradient
}

function ExpenseChart({ series, onSelect }) {
  const canvas = useRef(null)
  useEffect(() => {
    const chart = new Chart(canvas.current, {
      type: 'line',
      plugins: [lineGlow],
      data: {
        labels: series.map(row => monthLabel(row.month)),
        datasets: [
          { label: 'Payment', data: series.map(row => row.payment), borderColor: '#2563eb', backgroundColor: '#2563eb12', fill: true },
          { label: 'Reimbursement', data: series.map(row => row.reimbursement), borderColor: '#16a34a', backgroundColor: '#16a34a0d', fill: true },
        ].map(row => ({ ...row, backgroundColor: areaGradient, tension: 0.35, cubicInterpolationMode: 'monotone', borderWidth: 3, borderCapStyle: 'round', borderJoinStyle: 'round', pointRadius: series.length === 1 ? 4 : 0, pointHoverRadius: 5, pointBackgroundColor: '#ffffff', pointBorderWidth: 2, pointHitRadius: 20 })),
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        onClick: (_, elements) => { if (elements.length) onSelect(series[elements[0].index].month) },
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 20, color: '#667085' } }, tooltip: { backgroundColor: '#182230', padding: 12, cornerRadius: 8, titleMarginBottom: 8, boxPadding: 6, callbacks: { label: context => `${context.dataset.label}: ${money(context.parsed.y)}` } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0 }, border: { display: false } },
          y: { beginAtZero: true, ticks: { maxTicksLimit: 5, callback: value => compact(value) }, grid: { color: '#edf0f4' }, border: { display: false }, title: { display: true, text: 'IDR' } },
        },
      },
    })
    return () => chart.destroy()
  }, [series, onSelect])
  return <div className={styles.chart}><canvas ref={canvas} role="img" aria-label="Monthly payment and reimbursement expenditure" /></div>
}

export default function ExpenseExplorer({ payments, reimbursements, payables }) {
  const rows = useMemo(() => [...payments, ...reimbursements.filter(row => row.group.toUpperCase() === 'ARKLINE')]
    .map(row => ({ ...row, month: monthKey(row.paid_at) })).filter(row => row.month), [payments, reimbursements])
  const latest = rows.map(row => row.month).sort().at(-1) || monthKey(new Date())
  const [start, setStart] = useState(() => shiftMonth(latest, -5))
  const [end, setEnd] = useState(latest)
  const [category, setCategory] = useState('ALL')
  const [source, setSource] = useState('ALL')
  const [requester, setRequester] = useState('ALL')
  const [detail, setDetail] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [transactionSearch, setTransactionSearch] = useState('')
  const [page, setPage] = useState(0)
  const personRows = useMemo(() => rows.filter(row => requester === 'ALL' || row.requester_id === requester), [rows, requester])
  const analysis = useMemo(() => analyzeExpenses(personRows, start, end, category, source), [personRows, start, end, category, source])
  const categoryOptions = useMemo(() => Array.from(new Set(personRows.filter(row => row.month >= start && row.month <= end && (source === 'ALL' || row.source === source)).map(row => row.category_name))).sort(), [personRows, start, end, source])
  const requesterOptions = useMemo(() => Array.from(new Map(rows.filter(row => (row.month >= start && row.month <= end && (source === 'ALL' || row.source === source) && (category === 'ALL' || row.category_name === category)) || row.requester_id === requester).map(row => [row.requester_id, row.requester_name])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [rows, start, end, source, category, requester])
  const transactions = analysis.selected.filter(row => (!selectedMonth || row.month === selectedMonth) && `${row.category_name} ${row.po_number || ''} ${row.invoice_number || ''} ${row.claim_number || ''} ${row.requester_name} ${row.submitted_by_name} ${row.id}`.toLowerCase().includes(transactionSearch.toLowerCase())).sort((a, b) => b.paid_at.localeCompare(a.paid_at))
  const change = analysis.previous ? (analysis.total - analysis.previous) / analysis.previous * 100 : null
  const peak = analysis.series.reduce((best, row) => row.total > (best?.total || 0) ? row : best, null)
  const outstanding = payables.reduce((sum, row) => sum + row.amount, 0)
  const pendingReturn = payables.some(row => row.hasOpenReturn)
  const visiblePage = Math.min(page, Math.max(0, Math.ceil(transactions.length / 20) - 1))
  function resetDetail() { setSelectedMonth(''); setPage(0) }
  function chooseCategory(value) { setCategory(value); resetDetail() }

  return <div className={styles.page}>
    <header className={styles.header}><p>ARKLINE</p><h1>Financial Reporting</h1></header>
    <div className={styles.filters}>
      <label>From<input type="month" value={start} max={end} onChange={event => { if (event.target.value) { setStart(event.target.value > end ? end : event.target.value); resetDetail() } }} /></label>
      <label>To<input type="month" value={end} min={start} onChange={event => { if (event.target.value) { setEnd(event.target.value < start ? start : event.target.value); resetDetail() } }} /></label>
      <label className={styles.categoryFilter}>Category<select value={category} onChange={event => chooseCategory(event.target.value)}><option value="ALL">All categories</option>{category !== 'ALL' && !categoryOptions.includes(category) && <option>{category}</option>}{categoryOptions.map(name => <option key={name}>{name}</option>)}</select></label>
      <label>Source<select value={source} onChange={event => { setSource(event.target.value); resetDetail() }}><option value="ALL">All sources</option><option value="PAYMENT">Payment</option><option value="REIMBURSEMENT">Reimbursement</option></select></label>
      <button className={styles.reset} title="Reset filters" aria-label="Reset filters" onClick={() => { setStart(shiftMonth(latest, -5)); setEnd(latest); setCategory('ALL'); setSource('ALL'); setTransactionSearch(''); resetDetail() }}>&#8634;</button>
    </div>
    <div className={styles.metrics}>
      <article><span>Total expenditure</span><strong>{money(analysis.total)}</strong><small>{analysis.selected.length} paid records</small></article>
      <article><span>Previous period</span><strong>{change === null ? 'No baseline' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}</strong><small>{money(analysis.previous)} · {monthLabel(analysis.previousStart)} – {monthLabel(analysis.previousEnd)}</small></article>
      <article><span>Monthly average</span><strong>{money(analysis.total / (analysis.months.length || 1))}</strong><small>{peak ? `Peak: ${monthLabel(peak.month)} · ${money(peak.total)}` : 'No paid expenditure'}</small></article>
      <article><span>Account payable {pendingReturn && <b title="Unresolved product returns">*</b>}</span><strong>{money(outstanding)}</strong><small>Current outstanding · all POs, all periods</small></article>
    </div>
    {pendingReturn && <p className={styles.footnote}>* Includes products with unresolved returns.</p>}
    <div className={styles.visuals}>
      <section><div className={styles.sectionHead}><div><h2>Expenditure trend</h2><p>{category === 'ALL' ? 'All categories' : category} · {monthLabel(start)} – {monthLabel(end)}</p></div></div><ExpenseChart series={analysis.series} onSelect={setSelectedMonth} /></section>
      <section className={styles.categorySection}><div className={styles.sectionHead}><h2>Expense category</h2>{category !== 'ALL' && <button onClick={() => chooseCategory('ALL')}>All categories</button>}</div>
        <div className={styles.categories}>{analysis.categories.length ? analysis.categories.map(row => <button key={row.name} aria-pressed={category === row.name} onClick={() => chooseCategory(category === row.name ? 'ALL' : row.name)}><span><span>{row.name}</span><strong>{money(row.total)}</strong></span><span className={styles.track}><i style={{ width: `${row.total / (analysis.categories[0]?.total || 1) * 100}%` }} /></span><small>{row.count} records · {analysis.total ? (row.total / analysis.total * 100).toFixed(1) : 0}% of expenditure</small></button>) : <p className={styles.empty}>No paid records in this selection.</p>}</div>
      </section>
    </div>
    <section className={styles.tableSection}><div className={styles.sectionHead}><h2>Monthly category breakdown</h2><span>IDR</span></div><div className={styles.tableScroll}>
      <table><thead><tr><th>Category</th>{analysis.months.map(month => <th key={month}>{monthLabel(month)}</th>)}<th>Total</th></tr></thead><tbody>{analysis.categories.map(row => <tr key={row.name}><th><button onClick={() => chooseCategory(row.name)}>{row.name}</button></th>{row.months.map((value, index) => <td key={analysis.months[index]}><button disabled={!value} onClick={() => { setCategory(row.name); setSelectedMonth(analysis.months[index]); setPage(0) }}>{value ? money(value) : '—'}</button></td>)}<td><strong>{money(row.total)}</strong></td></tr>)}{!analysis.categories.length && <tr><td colSpan={analysis.months.length + 2}>No expenditure found.</td></tr>}</tbody><tfoot><tr><th>Total</th>{analysis.series.map(row => <td key={row.month}>{money(row.total)}</td>)}<td>{money(analysis.total)}</td></tr></tfoot></table>
    </div></section>
    <section className={styles.tableSection}><div className={styles.sectionHead}><div><h2>Payment detail</h2><p>{selectedMonth ? monthLabel(selectedMonth) : 'All selected months'} · {transactions.length} records · {money(transactions.reduce((sum, row) => sum + row.amount, 0))}</p></div><div className={styles.detailActions}>{selectedMonth && <button onClick={resetDetail}>All selected months</button>}<input aria-label="Search payment detail" placeholder="Category, PO or record ID" value={transactionSearch} onChange={event => { setTransactionSearch(event.target.value); setPage(0) }} /></div></div>
      <div className={styles.tableScroll}><table><thead><tr><th>Payment date</th><th>Source</th><th>Category</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{transactions.slice(visiblePage * 20, visiblePage * 20 + 20).map(row => <tr key={`${row.source}-${row.id}`}><th>{new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', dateStyle: 'medium' }).format(new Date(row.paid_at))}</th><td><span className={row.source === 'PAYMENT' ? styles.payment : styles.reimbursement}>{row.source === 'PAYMENT' ? 'Payment' : 'Reimbursement'}</span></td><td>{row.category_name}</td><td title={`Record ID: ${row.id}`}>{row.po_number || `#${row.id}`}</td><td>{money(row.amount)}</td></tr>)}{!transactions.length && <tr><td colSpan="5">No paid records match these filters.</td></tr>}</tbody></table></div>
      <div className={styles.pagination}><span>{transactions.length ? visiblePage * 20 + 1 : 0}–{Math.min((visiblePage + 1) * 20, transactions.length)} of {transactions.length}</span><button aria-label="Previous page" disabled={!visiblePage} onClick={() => setPage(visiblePage - 1)}>←</button><button aria-label="Next page" disabled={(visiblePage + 1) * 20 >= transactions.length} onClick={() => setPage(visiblePage + 1)}>→</button></div>
    </section>
  </div>
}
