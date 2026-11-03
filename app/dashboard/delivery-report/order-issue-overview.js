'use client'

import { useId, useState } from 'react'
import styles from './order-issue-overview.module.css'

const countFormat = new Intl.NumberFormat('en-US')
const moneyNumberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const moneyFormat = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const formatValue = (value, money) => money ? moneyFormat.format(value) : countFormat.format(value)

function MetricIcon({ kind }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'cases' ? <><rect x="5" y="4" width="14" height="17" rx="3" /><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h3" /></> : null}
    {kind === 'pending' ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> : null}
    {kind === 'cost' ? <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 9h18M15 14h3M6 5V3h11" /></> : null}
    {kind === 'handling' ? <><path d="M9 6h11M9 12h11M9 18h11M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2" /></> : null}
  </svg>
}

function ArrowIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" /></svg>
}

function EmptyChart({ message }) {
  return <div className={styles.emptyChart}><MetricIcon kind="cases" /><p>{message}</p><span>Try another reporting period.</span></div>
}

// The chart changes its presentation, not the source totals or reporting range.
function MetricChart({ series, groups, metric, money, monthly, label }) {
  const gradientId = useId().replace(/:/g, '')
  const [activeIndex, setActiveIndex] = useState(null)
  const isTrend = monthly || series.length > 1
  const data = isTrend
    ? series.map((item) => ({ label: monthly ? new Date(`${item.label}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : item.label, value: item[metric], detail: monthly ? new Date(`${item.label}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : item.label }))
    : groups.map((item) => ({ label: item.group, value: item[metric], detail: item.group }))
  const maximum = Math.max(1, ...data.map((item) => item.value))
  const magnitude = 10 ** Math.floor(Math.log10(maximum))
  const niceMaximum = magnitude * [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((step) => step * magnitude >= maximum)
  const ceiling = money ? niceMaximum : Math.max(2, Math.ceil(niceMaximum / 2) * 2)
  const width = 400
  const baseline = 136
  const top = 16
  const plotHeight = baseline - top
  const x = (index) => isTrend ? 12 + index * 376 / Math.max(1, data.length - 1) : (index + .5) * width / Math.max(1, data.length)
  const y = (value) => baseline - (value / ceiling) * plotHeight
  const points = data.map((item, index) => ({ x: x(index), y: y(item.value) }))
  const linePath = points.map((point, index) => {
    if (!index) return `M ${point.x} ${point.y}`
    const previous = points[index - 1]
    const middle = (previous.x + point.x) / 2
    return `C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`
  }).join(' ')
  const active = activeIndex === null ? null : data[activeIndex]
  const ticks = [...new Set([0, Math.round((data.length - 1) / 2), data.length - 1])].filter((index) => index >= 0)
  const peak = data.reduce((best, item) => !best || item.value > best.value ? item : best, null)
  const hasData = data.some((item) => item.value > 0)
  const chartCaption = isTrend ? monthly ? 'Monthly trend' : 'Yearly trend' : `By group${series[0] ? ` · ${series[0].label}` : ''}`

  if (!hasData) return <EmptyChart message={`No ${money ? 'additional cost' : metric === 'pending' ? 'cases needing handling' : 'cases'} in this period`} />

  function selectFromPointer(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const position = Math.max(0, Math.min(width, (event.clientX - rect.left) / rect.width * width))
    const index = isTrend ? Math.round((position - 12) / 376 * (data.length - 1)) : Math.floor(position / width * data.length)
    setActiveIndex(Math.max(0, Math.min(data.length - 1, index)))
  }

  return <div className={styles.chart}>
    <div className={styles.chartCaption}><span>{chartCaption}</span><span>{money ? 'IDR' : 'Cases'}</span></div>
    <div className={styles.chartBody}>
      <div className={styles.yAxis} aria-hidden="true"><span>{compactFormat.format(ceiling)}</span><span>{compactFormat.format(ceiling / 2)}</span><span>0</span></div>
      <div className={styles.plotColumn}>
        <div className={styles.plot} role="group" tabIndex={0} aria-label={`${label}. ${chartCaption}. Use left and right arrow keys to inspect values.`}
          onPointerMove={selectFromPointer} onPointerLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex(data.length - 1)} onBlur={() => setActiveIndex(null)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { setActiveIndex(null); return }
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            setActiveIndex((current) => event.key === 'Home' ? 0 : event.key === 'End' ? data.length - 1 : Math.max(0, Math.min(data.length - 1, (current ?? data.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1))))
          }}>
          <svg viewBox={`0 0 ${width} 144`} preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-accent)" stopOpacity=".18" /><stop offset="100%" stopColor="var(--chart-accent)" stopOpacity=".015" /></linearGradient></defs>
            {[top, top + plotHeight / 2, baseline].map((position) => <line key={position} x1="0" y1={position} x2={width} y2={position} className={styles.gridline} />)}
            {isTrend ? <>
              <path d={`${linePath} L ${points.at(-1).x} ${baseline} L ${points[0].x} ${baseline} Z`} fill={`url(#${gradientId})`} />
              <path d={linePath} className={styles.trendLine} />
              {data.length <= 12 ? points.map((point, index) => <circle key={data[index].label} cx={point.x} cy={point.y} r="3.5" className={styles.dataPoint} />) : null}
            </> : data.map((item, index) => {
              const barWidth = Math.min(64, width / data.length * .45)
              return <g key={item.label}><rect x={x(index) - barWidth / 2} y={top} width={barWidth} height={plotHeight} rx="6" className={styles.barTrack} /><rect x={x(index) - barWidth / 2} y={y(item.value)} width={barWidth} height={baseline - y(item.value)} rx="6" className={styles.comparisonBar} opacity={active && activeIndex !== index ? .38 : 1} /></g>
            })}
            {active ? <><line x1={x(activeIndex)} y1={top} x2={x(activeIndex)} y2={baseline} className={styles.crosshair} /><circle cx={x(activeIndex)} cy={y(active.value)} r="5" className={styles.activePoint} /></> : null}
          </svg>
          {active ? <div className={styles.tooltip} role="status" style={{ left: `${Math.max(24, Math.min(76, x(activeIndex) / width * 100))}%` }}><span>{active.detail}</span><strong>{formatValue(active.value, money)}{!money ? ' cases' : ''}</strong></div> : null}
        </div>
        <div className={styles.xAxis} aria-hidden="true">{(isTrend ? ticks : data.map((_, index) => index)).map((index) => <span key={index} style={{ left: `${x(index) / width * 100}%` }}>{data[index].label}</span>)}</div>
      </div>
    </div>
    <div className={styles.chartInsight}><span className={styles.insightDot} /><span>{isTrend ? 'Peak' : 'Largest group'} <b>{peak?.label}</b></span><strong>{formatValue(peak?.value || 0, money)}</strong></div>
  </div>
}

function GroupBreakdown({ groups, metric, money, onSelectGroup, orderTotals, ordersLoading, ordersError }) {
  const total = groups.reduce((sum, item) => sum + item[metric], 0)
  if (total <= 0 && !orderTotals) return null
  return <div className={styles.breakdown}>
    <div className={styles.breakdownHeading}><span>Group breakdown</span><span>Share of {money ? 'cost' : metric === 'pending' ? 'cases needing handling' : 'all cases'} · View cases <ArrowIcon /></span></div>
    {groups.map((item) => <button type="button" className={styles.groupRow} key={item.group} onClick={() => onSelectGroup(item.group)} aria-label={`View ${item.group} cases`}>
      <span className={styles.groupName}><i data-group={item.group} />{item.group}</span>
      <span className={styles.groupValue}>{formatValue(item[metric], money)}</span>
      <span className={styles.groupPercent}>{total ? Math.round(item[metric] / total * 100) : 0}%</span>
      <ArrowIcon />
      {orderTotals ? <span className={styles.orderComparison}>{ordersLoading ? 'Loading order quantities…' : ordersError ? 'Order quantities unavailable' : `${countFormat.format(orderTotals[item.group] || 0)} order qty · ${orderTotals[item.group] ? (item.count / orderTotals[item.group] * 100).toFixed(1) : '—'}% cases / order qty`}</span> : null}
    </button>)}
  </div>
}

function MetricCard({ title, kind, value, description, badge, children, money = false }) {
  return <article className={`${styles.card} ${kind === 'cases' ? styles.volumeCard : kind === 'pending' ? styles.attentionCard : ''}`}>
    <header className={styles.cardHeader}><h3>{title}</h3><span className={styles.metricIcon}><MetricIcon kind={kind} /></span></header>
    <div className={`${styles.metric} ${money ? styles.moneyMetric : ''}`} title={formatValue(value, money)}>{money ? <span className={styles.currency}>Rp</span> : null}<strong>{money ? moneyNumberFormat.format(value) : countFormat.format(value)}</strong></div>
    <div className={styles.metricContext}><p>{description}</p>{badge ? <span className={styles.contextBadge}>{badge}</span> : null}</div>
    {children}
  </article>
}

export default function OrderIssueOverview({ stats, series, monthly, orderTotals, ordersLoading, ordersError, onSelectGroup, onSelectHandling }) {
  const pendingPercent = stats.total ? Math.round(stats.pendingRows.length / stats.total * 100) : 0
  const handlingMax = Math.max(1, ...stats.topHandling.map((item) => item.value))
  const listedHandling = stats.topHandling.reduce((sum, item) => sum + item.value, 0)
  return <div className={styles.overview}>
    <MetricCard title="Total Cases" kind="cases" value={stats.total} description="All recorded order issues">
      <MetricChart series={series} groups={stats.groups} metric="count" monthly={monthly} label="Total cases" />
      <GroupBreakdown groups={stats.groups} metric="count" orderTotals={orderTotals} ordersLoading={ordersLoading} ordersError={ordersError} onSelectGroup={onSelectGroup} />
    </MetricCard>
    <MetricCard title="Need Handling" kind="pending" value={stats.pendingRows.length} description="Cases requiring follow-up" badge={`${pendingPercent}% of cases`}>
      <MetricChart series={series} groups={stats.groups} metric="pending" monthly={monthly} label="Cases needing handling" />
      <GroupBreakdown groups={stats.groups} metric="pending" onSelectGroup={onSelectGroup} />
    </MetricCard>
    <MetricCard title="Additional Cost" kind="cost" value={stats.costTotal} description="Total recorded additional cost" money>
      <MetricChart series={series} groups={stats.groups} metric="cost" monthly={monthly} label="Additional cost" money />
      <GroupBreakdown groups={stats.groups} metric="cost" money onSelectGroup={onSelectGroup} />
    </MetricCard>
    <MetricCard title="Handling Frequency" kind="handling" value={stats.handlingTotal} description="Cases with a handling action">
      {stats.topHandling.length ? <>
        <div className={styles.rankingHeader}><span>Most frequent actions</span><span>Cases</span></div>
        <ol className={styles.ranking}>{stats.topHandling.map((item, index) => <li key={item.key}>
          <button type="button" className={styles.rankButton} onClick={() => onSelectHandling(item.label)} aria-label={`View ${item.label}: ${countFormat.format(item.value)} cases`}>
            <span className={styles.rankNumber}>{String(index + 1).padStart(2, '0')}</span>
            <div className={styles.rankContent}><div className={styles.rankLabel}><span>{item.label}</span><strong>{countFormat.format(item.value)}</strong></div><div className={styles.rankTrack}><span style={{ width: `${item.value / handlingMax * 100}%` }} /></div></div>
            <ArrowIcon />
          </button>
        </li>)}</ol>
        <div className={styles.rankingFootnote}><span>Top {stats.topHandling.length} actions</span><span>{countFormat.format(listedHandling)} of {countFormat.format(stats.handlingTotal)} cases</span></div>
      </> : <EmptyChart message="No handling actions recorded" />}
    </MetricCard>
  </div>
}
