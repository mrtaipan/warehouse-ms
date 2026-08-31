'use client'

import { useMemo, useState, useTransition } from 'react'
import { createClient } from '@/utils/supabase/browser'
import styles from './dashboard.module.css'

const supabase = createClient()

function AwardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="5" />
      <path d="m8.5 12.5-1.5 8 5-3 5 3-1.5-8" />
    </svg>
  )
}

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(value || 0))
}

function getTodayInputValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function normalizeGroup(value) {
  return String(value || 'Ungrouped').trim().toUpperCase() || 'UNGROUPED'
}

function getDivisionLabel(person = {}) {
  const prefix = String(person?.role || '').trim().toLowerCase().split('_')[0]
  const map = {
    packing: 'PACKING LIST',
    qc: 'QC',
    inbound: 'INBOUND',
    storage: 'STOCKKEEPING',
  }

  return map[prefix] || '-'
}

function isCoordinator(person = {}) {
  return String(person?.role || '').trim().toLowerCase().split('_').includes('coordinator')
}

function toProperCase(value) {
  return String(value || '')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function PenaltyPointsShortcutButton({ people = [], currentRows = [], canAdd = false }) {
  const [open, setOpen] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [selectedPersonText, setSelectedPersonText] = useState('')
  const [personFilter, setPersonFilter] = useState('')
  const [divisionFilter, setDivisionFilter] = useState('')
  const [penaltyDate, setPenaltyDate] = useState(getTodayInputValue())
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [rows, setRows] = useState(currentRows)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const activePeople = useMemo(
    () =>
      people.filter((person) => {
        const group = normalizeGroup(person?.group)
        const role = String(person?.role || '').trim().toLowerCase()
        return !String(person?.resign_date || '').trim() && group === 'WAREHOUSE' && role !== 'warehouse_leader'
      }),
    [people]
  )
  const pointsByProfile = useMemo(() => new Map(rows.map((row) => [row.employee_profile_id, Number(row.total_points || 0)])), [rows])
  const peopleWithPoints = useMemo(() => {
    return activePeople
      .map((person) => ({
        ...person,
        total_points: pointsByProfile.get(person.id) || 0,
      }))
      .sort((left, right) => right.total_points - left.total_points || String(left.display_name || left.id).localeCompare(String(right.display_name || right.id)))
  }, [activePeople, pointsByProfile])
  const divisionOptions = useMemo(() => Array.from(new Set(peopleWithPoints.map(getDivisionLabel).filter((item) => item !== '-'))).sort(), [peopleWithPoints])
  const inputPersonOptions = useMemo(
    () =>
      activePeople.map((person) => ({
        id: person.id,
        label: `${toProperCase(person.display_name || person.email || person.id)} - ${getDivisionLabel(person)}`,
      })),
    [activePeople]
  )
  const filteredPeople = useMemo(() => {
    const keyword = String(personFilter || '').trim().toLowerCase()
    return peopleWithPoints
      .filter((person) => {
        const matchesPerson =
          !keyword ||
          [person.id, person.display_name, person.email]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(keyword)
        const matchesDivision = !divisionFilter || getDivisionLabel(person) === divisionFilter
        return matchesPerson && matchesDivision
      })
      .sort((left, right) => Number(isCoordinator(right)) - Number(isCoordinator(left)))
  }, [divisionFilter, peopleWithPoints, personFilter])
  const filteredTotalPoints = filteredPeople.reduce((sum, item) => sum + Number(item.total_points || 0), 0)

  const resolvedSelectedProfileId = useMemo(() => {
    if (selectedProfileId) return selectedProfileId
    const normalizedText = String(selectedPersonText || '').trim().toLowerCase()
    return inputPersonOptions.find((person) => person.label.toLowerCase() === normalizedText)?.id || ''
  }, [inputPersonOptions, selectedPersonText, selectedProfileId])

  function resetModalState() {
    setSelectedProfileId('')
    setSelectedPersonText('')
    setPersonFilter('')
    setDivisionFilter('')
    setPenaltyDate(getTodayInputValue())
    setPoints('')
    setReason('')
    setMessage('')
    setError('')
  }

  function handleClose() {
    resetModalState()
    setOpen(false)
  }

  async function refreshCurrentRows() {
    const { data, error: fetchError } = await supabase.from('hrga_penalty_points_current').select('*')
    if (fetchError) {
      throw new Error(fetchError.message)
    }
    setRows(data || [])
  }

  function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    const normalizedPoints = Number.parseInt(String(points || '').trim(), 10)
    if (!resolvedSelectedProfileId || !penaltyDate || !normalizedPoints || normalizedPoints <= 0 || !reason.trim()) {
      setError('Person, date, points, and reason are required.')
      return
    }

    startTransition(async () => {
      const { error: insertError } = await supabase.from('hrga_penalty_points').insert({
        employee_profile_id: resolvedSelectedProfileId,
        penalty_date: penaltyDate,
        points: normalizedPoints,
        reason: reason.trim(),
      })

      if (insertError) {
        setError(insertError.message)
        return
      }

      setSelectedProfileId('')
      setSelectedPersonText('')
      setPoints('')
      setReason('')
      setMessage('Penalty point saved.')

      try {
        await refreshCurrentRows()
      } catch (refreshError) {
        setError(refreshError.message || 'Saved, but failed to refresh current totals.')
      }
    })
  }

  return (
    <>
      <button type="button" className={styles.heroProfileLink} onClick={() => setOpen(true)} aria-label="Open Penalty Points" title="Penalty Points">
        <AwardIcon />
      </button>

      {open ? (
        <div className={styles.modalOverlay} onClick={handleClose}>
          <div className={styles.penaltyModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.penaltyHeader}>
              <div>
                <h2 className={styles.penaltyTitle}>Penalty Points</h2>
              </div>
              <button type="button" className={styles.penaltyCloseButton} onClick={handleClose} aria-label="Close Penalty Points">
                X
              </button>
            </div>

            <div className={styles.penaltyContentGrid}>
              <section className={styles.penaltyPanel}>
                <div className={styles.penaltyPanelHeader}>
                  <h3>Current Period</h3>
                  <span>{formatNumber(filteredTotalPoints)} pts</span>
                </div>
                <div className={styles.penaltyFilterRow}>
                  <label>
                    <span>Person</span>
                    <input value={personFilter} onChange={(event) => setPersonFilter(event.target.value)} placeholder="Search person" />
                  </label>
                  <label>
                    <span>Division</span>
                    <select value={divisionFilter} onChange={(event) => setDivisionFilter(event.target.value)}>
                      <option value="">All divisions</option>
                      {divisionOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className={styles.penaltyTableWrap}>
                  <table className={styles.penaltyTable}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Division</th>
                        <th>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPeople.map((person) => (
                        <tr key={person.id}>
                          <td>{toProperCase(person.display_name || person.email || person.id)}</td>
                          <td>{getDivisionLabel(person)}</td>
                          <td>{formatNumber(person.total_points)}</td>
                        </tr>
                      ))}
                      {!filteredPeople.length ? (
                        <tr>
                          <td colSpan={3}>No penalty points data matches the current filters.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>

              {canAdd ? (
                <form className={styles.penaltyForm} onSubmit={handleSubmit}>
                  <h3>Input Points</h3>
                  <label>
                    <span>Person</span>
                    <input
                      list="penalty-person-options"
                      value={selectedPersonText}
                      onChange={(event) => {
                        const nextValue = event.target.value
                        const matchedPerson = inputPersonOptions.find((person) => person.label === nextValue)
                        setSelectedPersonText(nextValue)
                        setSelectedProfileId(matchedPerson?.id || '')
                      }}
                      placeholder="Search person"
                      required
                    />
                    <datalist id="penalty-person-options">
                      {inputPersonOptions.map((person) => (
                        <option key={person.id} value={person.label} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    <span>Date</span>
                    <input type="date" value={penaltyDate} onChange={(event) => setPenaltyDate(event.target.value)} required />
                  </label>
                  <label>
                    <span>Points</span>
                    <input type="number" min="1" step="1" value={points} onChange={(event) => setPoints(event.target.value)} required />
                  </label>
                  <label>
                    <span>Reason</span>
                    <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} required />
                  </label>
                  {error ? <p className={styles.penaltyError}>{error}</p> : null}
                  {message ? <p className={styles.penaltySuccess}>{message}</p> : null}
                  <button type="submit" className={styles.penaltyPrimaryButton} disabled={isPending}>
                    {isPending ? 'Saving...' : 'Save Points'}
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
