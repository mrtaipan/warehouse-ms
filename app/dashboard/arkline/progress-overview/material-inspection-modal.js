'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'
import { calculateDocumentSummary, calculateRollSummary } from './material-inspection-utils.mjs'
import styles from './material-inspection-modal.module.css'

const supabase = createClient()

function newDefect() {
  return { key: crypto.randomUUID(), groupId: '', defectId: '', positionYards: '', points: '' }
}

function newRoll() {
  return {
    key: crypto.randomUUID(),
    rollNo: '',
    actualYards: '',
    actualGsm: '',
    actualWidthIn: '',
    remarks: '',
    defects: [],
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(value || 0))
}

function suggestedCode(prefix, defects) {
  const highest = defects.reduce((max, defect) => {
    const code = String(defect.code || '')
    if (!code.startsWith(prefix)) return max
    const suffix = code.slice(prefix.length)
    return /^\d+$/.test(suffix) ? Math.max(max, Number(suffix)) : max
  }, 0)
  return `${prefix}${String(highest + 1).padStart(2, '0')}`
}

function GradeBadge({ grade }) {
  return <span className={`${styles.gradeBadge} ${styles[`grade${grade || 'Pending'}`]}`}>Grade {grade || '-'}</span>
}

export default function MaterialInspectionModal({ item, inspection, onClose, onSaved, onPrint, printing }) {
  const viewOnly = Boolean(inspection?.id)
  const [groups, setGroups] = useState([])
  const [allDefectTypes, setDefectTypes] = useState([])
  const defectTypes = allDefectTypes.filter((type) => type.is_active)
  const [lot, setLot] = useState('')
  const [inspectionDate, setInspectionDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [nominalWidthIn, setNominalWidthIn] = useState('')
  const [nominalGsm, setNominalGsm] = useState('')
  const [remarks, setRemarks] = useState('')
  const [rolls, setRolls] = useState(() => viewOnly ? [] : [newRoll()])
  const [collapsedRollKeys, setCollapsedRollKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [catalogMode, setCatalogMode] = useState('')
  const [catalogSaving, setCatalogSaving] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupPrefix, setGroupPrefix] = useState('')
  const [newDefectGroupId, setNewDefectGroupId] = useState('')
  const prefix = groups.find((row) => row.id === newDefectGroupId)?.code_prefix
  const newDefectCode = prefix ? suggestedCode(prefix, allDefectTypes) : ''
  const [newDefectName, setNewDefectName] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [{ data: groupRows, error: groupError }, { data: defectRows, error: defectError }] = await Promise.all([
          supabase.from('arkline_cmt_fabric_defect_groups')
            .select('id, name, code_prefix, sort_order, is_active')
            .eq('is_active', true)
            .order('sort_order'),
          supabase.from('arkline_cmt_fabric_defects')
            .select('id, group_id, code, defect_name, sort_order, is_active')
            .order('code'),
        ])
        if (groupError || defectError) throw new Error(groupError?.message || defectError?.message)
        if (cancelled) return
        setGroups(groupRows || [])
        setDefectTypes(defectRows || [])

        if (inspection?.id) {
          const { data: rollRows, error: rollError } = await supabase
            .from('arkline_cmt_material_rolls')
            .select('id, roll_no, actual_yards, actual_width_in, actual_gsm, remarks, total_points, scored_points, points_per_100_sq_yd, grade, created_at')
            .eq('inspection_id', inspection.id)
            .order('created_at')
          if (rollError) throw new Error(rollError.message)
          const rollIds = (rollRows || []).map((roll) => roll.id)
          const { data: defectRowsForRolls, error: rollDefectError } = rollIds.length
            ? await supabase.from('arkline_cmt_material_roll_defects')
              .select('id, roll_id, defect_code, defect_name, position_yards, points, yard_bucket')
              .in('roll_id', rollIds)
              .order('position_yards')
            : { data: [], error: null }
          if (rollDefectError) throw new Error(rollDefectError.message)
          if (cancelled) return
          setRolls((rollRows || []).map((roll) => ({
            ...roll,
            key: roll.id,
            defects: (defectRowsForRolls || []).filter((defect) => defect.roll_id === roll.id),
          })))
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Failed to load fabric inspection.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [inspection?.id])

  function updateRoll(key, field, value) {
    setRolls((current) => current.map((roll) => roll.key === key ? { ...roll, [field]: value } : roll))
  }

  function updateDefect(rollKey, defectKey, field, value) {
    setRolls((current) => current.map((roll) => {
      if (roll.key !== rollKey) return roll
      return {
        ...roll,
        defects: roll.defects.map((defect) => defect.key === defectKey
          ? { ...defect, [field]: value, ...(field === 'groupId' ? { defectId: '' } : {}) }
          : defect),
      }
    }))
  }

  function addDefect(rollKey) {
    setRolls((current) => current.map((roll) => roll.key === rollKey
      ? { ...roll, defects: [...roll.defects, newDefect()] }
      : roll))
  }

  function removeDefect(rollKey, defectKey) {
    setRolls((current) => current.map((roll) => roll.key === rollKey
      ? { ...roll, defects: roll.defects.filter((defect) => defect.key !== defectKey) }
      : roll))
  }

  async function saveCatalog() {
    setCatalogError('')
    setCatalogSaving(true)
    try {
      if (catalogMode === 'group') {
        const name = groupName.trim()
        const codePrefix = groupPrefix.trim().toUpperCase()
        if (groups.some((row) => row.code_prefix === codePrefix)) throw new Error('This prefix is already in use.')
        if (!name || !/^[A-Z]$/.test(codePrefix)) {
          throw new Error('Enter a group name and a unique prefix of one letter (A-Z).')
        }
        const { data, error: insertError } = await supabase
          .from('arkline_cmt_fabric_defect_groups')
          .insert({ name, code_prefix: codePrefix, sort_order: groups.length + 1 })
          .select('id, name, code_prefix, sort_order, is_active')
          .single()
        if (insertError?.code === '23505') throw new Error('The group name or prefix is already in use.')
        if (insertError) throw new Error(insertError.message)
        setGroups((current) => [...current, data])
        setNewDefectGroupId(data.id)
        setGroupName('')
        setGroupPrefix('')
      } else {
        const group = groups.find((row) => row.id === newDefectGroupId)
        const code = newDefectCode
        const name = newDefectName.trim()
        if (!group || !name || !new RegExp(`^${group.code_prefix}\\d{2,}$`).test(code)) {
          throw new Error('Choose a group, defect name, and a code matching its prefix.')
        }
        const { data, error: insertError } = await supabase
          .from('arkline_cmt_fabric_defects')
          .insert({ group_id: group.id, code, defect_name: name, sort_order: defectTypes.length + 1 })
          .select('id, group_id, code, defect_name, sort_order, is_active')
          .single()
        if (insertError) throw new Error(insertError.message)
        setDefectTypes((current) => [...current, data])
        setNewDefectName('')
      }
      setCatalogMode('')
    } catch (saveError) {
      setCatalogError(saveError.message || 'Failed to add classification.')
    } finally {
      setCatalogSaving(false)
    }
  }

  async function handleSave() {
    setError('')
    if (!inspectionDate) { setError('Inspection date is required.'); return }
    if (!lot.trim() || !(Number(nominalWidthIn) > 0) || !(Number(nominalGsm) > 0)) {
      setError('Fill Lot, nominal width, and nominal GSM before saving.')
      return
    }
    if (!rolls.length) {
      setError('Add at least one roll.')
      return
    }

    const rollNumbers = new Set()
    for (const [index, roll] of rolls.entries()) {
      const rollNo = `R-${String(index + 1).padStart(2, '0')}`
      const yards = Number(roll.actualYards)
      if (!rollNo || !(yards > 0) || !(Number(roll.actualWidthIn) > 0) || !(Number(roll.actualGsm) > 0)) {
        setError(`Roll ${index + 1}: fill roll number, actual yards, width, and GSM.`)
        return
      }
      if (rollNumbers.has(rollNo)) {
        setError(`Roll ${index + 1}: roll number ${rollNo} is already used in this inspection.`)
        return
      }
      rollNumbers.add(rollNo)
      for (const defect of roll.defects) {
        if (!defect.groupId || !defect.defectId || !(Number(defect.positionYards) > 0) ||
            Number(defect.positionYards) > yards || !Number.isInteger(Number(defect.points)) ||
            Number(defect.points) < 1 || Number(defect.points) > 4) {
          setError(`Roll ${index + 1}: complete each defect, position (within the roll), and 1-4 points.`)
          return
        }
      }
    }

    setSaving(true)
    try {
      const { error: saveError } = await supabase.rpc('create_arkline_cmt_material_inspection', {
        p_material_po_ordered_item_id: item.materialOrderedItemId,
        p_lot: lot.trim(),
        p_nominal_width_in: Number(nominalWidthIn),
        p_nominal_gsm: Number(nominalGsm),
        p_remarks: remarks.trim() || null,
        p_rolls: rolls.map((roll, index) => ({
          inspection_date: inspectionDate,
          roll_no: `R-${String(index + 1).padStart(2, '0')}`,
          actual_yards: Number(roll.actualYards),
          actual_width_in: Number(roll.actualWidthIn),
          actual_gsm: Number(roll.actualGsm),
          remarks: roll.remarks.trim() || null,
          defects: roll.defects.map((defect) => ({
            defect_id: defect.defectId,
            position_yards: Number(defect.positionYards),
            points: Number(defect.points),
          })),
        })),
      })
      if (saveError) throw new Error(saveError.message)
      await onSaved()
    } catch (saveError) {
      setError(saveError.message || 'Failed to save fabric inspection.')
    } finally {
      setSaving(false)
    }
  }

  const documentSummary = viewOnly
    ? { totalPoints: inspection.total_points, scoredPoints: inspection.scored_points, pointsPer100SqYd: inspection.points_per_100_sq_yd, grade: inspection.grade }
    : calculateDocumentSummary(rolls)

  return (
    <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="material-inspection-title">
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <p className={styles.eyebrow}>ARKLINE / CMT MATERIAL</p>
            <h2 id="material-inspection-title">Fabric Inspection</h2>
            <p className={styles.subtitle}>{viewOnly ? 'Saved inspection detail' : 'Inspect each fabric roll and record every defect.'}</p>
          </div>
          <div className={styles.headerResults} aria-label="Inspection result summary">
            <div><span>Total Pts</span><strong>{formatNumber(documentSummary.totalPoints)}</strong></div>
            <div><span>Total Pts / 100 sq yd</span><strong>{documentSummary.pointsPer100SqYd ?? '-'}</strong></div>
            <GradeBadge grade={documentSummary.grade} />
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} disabled={saving} aria-label="Close fabric inspection">×</button>
        </header>

        <div className={styles.body}>
          <div className={styles.contextPanel}>
            <div className={styles.contextGrid}>
              <div><span>Material PO</span><strong>{item.poId || '-'}</strong></div>
              <div><span>Supplier</span><strong>{item.supplier || '-'}</strong></div>
              <div><span>Material</span><strong>{item.productName || '-'}</strong></div>
              {viewOnly ? <div><span>Inspected by</span><strong>{inspection.inspected_by || '-'}</strong></div> : null}
            </div>
            <p className={styles.ruleNote}>Grade A: &lt;20 | B: 20-29 | C: 30-40 | X: &gt;40 points per 100 sq yd. Scores are rounded up.</p>
          </div>

          {loading ? <p className={styles.empty}>Loading inspection data...</p> : null}

          <section className={styles.section}>
            <div className={styles.sectionTitle}><h3>Inspection Details</h3>{viewOnly ? <GradeBadge grade={inspection.grade} /> : null}</div>
            <div className={styles.headerFields}>
              <label className={styles.field}>Inspection Date<input type="date" value={viewOnly ? (inspection.inspected_at ? new Date(inspection.inspected_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) : '') : inspectionDate} onChange={(event) => setInspectionDate(event.target.value)} readOnly={viewOnly} required /></label>
              <label className={styles.field}>Lot <input value={viewOnly ? inspection.lot : lot} onChange={(event) => setLot(event.target.value)} readOnly={viewOnly} placeholder="Fabric lot" /></label>
              <label className={styles.field}>Expected Width <span className={styles.inputUnit}><input type="number" min="0" step="0.01" value={viewOnly ? inspection.nominal_width_in : nominalWidthIn} onChange={(event) => setNominalWidthIn(event.target.value)} readOnly={viewOnly} placeholder="0" /><span>in</span></span></label>
              <label className={styles.field}>Expected GSM <span className={styles.inputUnit}><input type="number" min="0" step="0.01" value={viewOnly ? inspection.nominal_gsm : nominalGsm} onChange={(event) => setNominalGsm(event.target.value)} readOnly={viewOnly} placeholder="0" /><span>gsm</span></span></label>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <h3>Roll Inspection</h3>
            </div>

            {!viewOnly && catalogMode ? (
              <div className={styles.catalogOverlay}><div className={styles.catalogPanel} role="dialog" aria-modal="true" aria-label="New Defect">
                <div className={styles.catalogHead}><strong>New Defect</strong><button type="button" disabled={catalogSaving} onClick={() => { setCatalogMode(''); setCatalogError('') }}>Close</button></div>
                <p className={styles.catalogIntro}>Add a classification to the shared defect directory.</p>
                <div className={styles.catalogTabs}><button type="button" disabled={catalogSaving} onClick={() => setCatalogMode('group')} aria-pressed={catalogMode === 'group'}>Defect Group</button><button type="button" disabled={catalogSaving} onClick={() => setCatalogMode('defect')} aria-pressed={catalogMode === 'defect'}>Defect Type</button></div>
                <p className={styles.catalogIntro}>{catalogMode === 'group' ? 'Create a group with its own code prefix, such as Dyeing (D).' : 'Choose a group, then add a specific defect and its code.'}</p>
                {catalogMode === 'group' ? (
                  <div className={styles.catalogFields}>
                    <label className={styles.field}>Group Name<input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. Coating" /></label>
                    <label className={styles.field}>Code Prefix<input value={groupPrefix} onChange={(event) => setGroupPrefix(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1))} placeholder="C" maxLength={1} /></label>
                  </div>
                ) : (
                  <div className={styles.catalogFields}>
                    <label className={styles.field}>Defect Group<select value={newDefectGroupId} onChange={(event) => setNewDefectGroupId(event.target.value)}><option value="">Select group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
                    <label className={styles.field}>Code<input value={newDefectCode} readOnly placeholder="Select group first" /></label>
                    <label className={styles.field}>Defect Name<input value={newDefectName} onChange={(event) => setNewDefectName(event.target.value)} placeholder="New defect type" /></label>
                  </div>
                )}
                {catalogError ? <p className={styles.error}>{catalogError}</p> : null}
                <button type="button" className={styles.darkButton} onClick={() => void saveCatalog()} disabled={catalogSaving}>{catalogSaving ? 'Saving...' : 'Add to Classification'}</button>
              </div></div>
            ) : null}

            {rolls.map((roll, index) => {
              const summary = viewOnly
                ? { totalPoints: roll.total_points, scoredPoints: roll.scored_points, pointsPer100SqYd: roll.points_per_100_sq_yd, grade: roll.grade }
                : calculateRollSummary(roll)
              return (
                <details key={roll.key} className={styles.rollCard} open={!collapsedRollKeys.includes(roll.key)}>
                  <summary className={styles.rollHead} onClick={(event) => {
                    if (event.target.closest('button')) return
                    event.preventDefault()
                    setCollapsedRollKeys((current) => current.includes(roll.key) ? current.filter((key) => key !== roll.key) : [...current, roll.key])
                  }}>
                    <div className={styles.rollIdentity}><strong>{viewOnly ? roll.roll_no : `Roll ${index + 1}`}</strong><span>{roll.defects.length} defect(s)</span></div>
                    <div className={styles.rollMetrics}>
                      <div><span>Total Pts</span><strong>{formatNumber(summary.totalPoints)}</strong></div>
                      <div><span>Total Pts / 100 sq yd</span><strong>{summary.pointsPer100SqYd ?? '-'}</strong></div>
                    </div>
                    <div className={styles.rollHeadActions}><GradeBadge grade={summary.grade} />{!viewOnly && rolls.length > 1 ? <button type="button" className={styles.removeButton} onClick={(event) => { event.stopPropagation(); setRolls((current) => current.filter((row) => row.key !== roll.key)) }}>Remove roll</button> : null}</div>
                  </summary>
                  <div className={styles.rollFields}>
                    <label className={styles.field}>Actual Length<span className={styles.inputUnit}><input type="number" min="0" step="0.01" value={viewOnly ? roll.actual_yards : roll.actualYards} onChange={(event) => updateRoll(roll.key, 'actualYards', event.target.value)} readOnly={viewOnly} placeholder="0" /><span>yd</span></span></label>
                    <label className={styles.field}>Actual GSM<span className={styles.inputUnit}><input type="number" min="0" step="0.01" value={viewOnly ? roll.actual_gsm : roll.actualGsm} onChange={(event) => updateRoll(roll.key, 'actualGsm', event.target.value)} readOnly={viewOnly} placeholder="0" /><span>gsm</span></span></label>
                    <label className={styles.field}>Actual Width<span className={styles.inputUnit}><input type="number" min="0" step="0.01" value={viewOnly ? roll.actual_width_in : roll.actualWidthIn} onChange={(event) => updateRoll(roll.key, 'actualWidthIn', event.target.value)} readOnly={viewOnly} placeholder="0" /><span>in</span></span></label>
                    <label className={styles.field}>Roll Comment<input value={viewOnly ? roll.remarks || '' : roll.remarks} onChange={(event) => updateRoll(roll.key, 'remarks', event.target.value)} readOnly={viewOnly} placeholder="Optional comment" /></label>
                  </div>

                  <div className={styles.defectSection}>
                    <div className={styles.defectHead}>
                      <strong>Defects <small>{roll.defects.length}</small></strong>
                      {!viewOnly ? <div className={styles.defectActions}><button type="button" onClick={() => { setCatalogMode('defect'); setCatalogError('') }}>New Defect</button>{!roll.defects.length ? <button type="button" className={styles.addDefectButton} onClick={() => addDefect(roll.key)}>+ Add Defect</button> : null}</div> : null}
                    </div>
                    {roll.defects.length ? (
                      <div className={styles.defectList}>
                        {viewOnly ? <div className={styles.savedDefectTableHead}><span>Defect</span><span>Position (yd)</span><span>Point</span></div> : <div className={styles.defectTableHead}><span>Group</span><span>Defect</span><span>Position (yd)</span><span>Point</span><span>Action</span></div>}
                        {roll.defects.map((defect) => viewOnly ? (
                          <div key={defect.id} className={styles.savedDefectRow}><strong>{defect.defect_code} · {defect.defect_name}</strong><span>Yard {formatNumber(defect.position_yards)}</span><span>{defect.points} point(s)</span></div>
                        ) : (
                          <div key={defect.key} className={styles.defectRow}>
                            <label className={styles.field}><span className={styles.mobileFieldLabel}>Group</span><select aria-label="Defect group" value={defect.groupId} onChange={(event) => updateDefect(roll.key, defect.key, 'groupId', event.target.value)}><option value="">Select group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
                            <label className={styles.field}><span className={styles.mobileFieldLabel}>Defect</span><select aria-label="Defect type" value={defect.defectId} onChange={(event) => updateDefect(roll.key, defect.key, 'defectId', event.target.value)} disabled={!defect.groupId}><option value="">Select defect</option>{defectTypes.filter((type) => type.group_id === defect.groupId).map((type) => <option key={type.id} value={type.id}>{type.code} · {type.defect_name}</option>)}</select></label>
                            <label className={styles.field}><span className={styles.mobileFieldLabel}>Position (yd)</span><span className={styles.inputUnit}><input aria-label="Defect position in yards" type="number" min="0" step="0.01" value={defect.positionYards} onChange={(event) => updateDefect(roll.key, defect.key, 'positionYards', event.target.value)} placeholder="0" /><span>yd</span></span></label>
                            <label className={styles.field}><span className={styles.mobileFieldLabel}>Point</span><select aria-label="Defect point" value={defect.points} onChange={(event) => updateDefect(roll.key, defect.key, 'points', event.target.value)}><option value="">-</option>{[1, 2, 3, 4].map((point) => <option key={point} value={point}>{point}</option>)}</select></label>
                            <div className={styles.defectRowActions}>
                              <button type="button" className={styles.removeDefect} onClick={() => removeDefect(roll.key, defect.key)} aria-label="Remove defect">×</button>
                              {roll.defects.at(-1)?.key === defect.key ? <button type="button" className={styles.addDefectInline} onClick={() => addDefect(roll.key)} aria-label="Add another defect" title="Add another defect">+</button> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className={styles.noDefect}>No defects recorded for this roll.</p>}
                  </div>

                </details>
              )
            })}
            {!viewOnly ? <button type="button" className={`${styles.secondaryButton} ${styles.addRollButton}`} onClick={() => setRolls((current) => [...current, newRoll()])}>+ Add Roll</button> : null}
          </section>

          <label className={`${styles.field} ${styles.documentRemarks}`}>Document Remarks / Conclusion<textarea value={viewOnly ? inspection.remarks || '' : remarks} onChange={(event) => setRemarks(event.target.value)} readOnly={viewOnly} rows={3} placeholder="Overall decision, follow-up, or cutting conditions" /></label>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>

        <footer className={styles.footer}><button type="button" className={styles.secondaryButton} onClick={onClose} disabled={saving}>{viewOnly ? 'Close' : 'Cancel'}</button>{viewOnly ? <button type="button" className={styles.darkButton} onClick={() => void onPrint(inspection, item)} disabled={printing || loading}>{printing ? 'Generating PDF...' : 'Print PDF'}</button> : <button type="button" className={styles.darkButton} onClick={() => void handleSave()} disabled={saving || loading}>{saving ? 'Saving inspection...' : 'Save Inspection'}</button>}</footer>
      </div>
    </div>
  )
}
