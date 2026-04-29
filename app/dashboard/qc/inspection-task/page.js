'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import { formatSeconds } from '../shared'

const supabase = createClient()
const BREAK_REASONS = ['TOILET', 'PRAYER', 'SUPERVISOR CALL', 'MATERIAL WAIT', 'OTHER', 'COORDINATOR BREAK']

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '18px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#6b7280',
    fontSize: '14px',
  },
  mobileStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  queueCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '18px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
  },
  queueHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'flex-start',
  },
  queueTitle: {
    margin: 0,
    fontSize: '18px',
  },
  badge: {
    padding: '6px 10px',
    borderRadius: '999px',
    background: '#dbeafe',
    color: '#1d4ed8',
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modelThumb: {
    width: '100%',
    height: '220px',
    objectFit: 'cover',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '220px',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
    color: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    letterSpacing: '0.08em',
  },
  bigQty: {
    fontSize: '52px',
    lineHeight: 1,
    fontWeight: '900',
    color: '#111827',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },
  metaCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    padding: '12px',
    background: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  metaLabel: {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.06em',
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
    width: '220px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: '#111827',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '500',
    lineHeight: 1.5,
    textTransform: 'none',
    letterSpacing: 'normal',
    zIndex: 20,
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.22)',
  },
  metaValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#111827',
  },
  timerBox: {
    borderRadius: '18px',
    background: '#111827',
    color: '#fff',
    padding: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  timerValue: {
    fontSize: '44px',
    lineHeight: 1,
    fontWeight: '900',
    letterSpacing: '0.04em',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '12px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#111827',
  },
  input: {
    height: '46px',
    padding: '0 12px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    fontSize: '16px',
    width: '100%',
    background: '#fff',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  primaryButton: {
    height: '46px',
    padding: '0 16px',
    border: 'none',
    borderRadius: '10px',
    background: '#111827',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  disabledButton: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  secondaryButton: {
    height: '46px',
    padding: '0 16px',
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    background: '#fff',
    color: '#111827',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  emptyState: {
    background: '#fff',
    border: '1px dashed #d1d5db',
    borderRadius: '18px',
    padding: '30px 20px',
    color: '#6b7280',
    textAlign: 'center',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
    fontWeight: '600',
  },
  successText: {
    margin: 0,
    color: '#16a34a',
    fontWeight: '600',
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
    maxWidth: '420px',
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
}

function getTaskModelInfo(task) {
  return {
    modelName: task.model_name || task.inbound_unload?.model_name || 'UNKNOWN MODEL',
    modelColor: task.model_color || task.inbound_unload?.model_color || '',
    photoUrl: task.photo_url || task.inbound_unload?.photo_url || '',
  }
}

function getTaskGradeInputs(task, gradeInputs) {
  if (!task) {
    return { qty_a: '', qty_b: '', qty_c: '' }
  }

  const draft = gradeInputs[task.id] || {}

  return {
    qty_a: draft.qty_a ?? '',
    qty_b: draft.qty_b ?? '',
    qty_c: draft.qty_c ?? '',
  }
}

function getCompletedQty(task) {
  return Number(task?.qty_a || 0) + Number(task?.qty_b || 0) + Number(task?.qty_c || 0)
}

function getLockedQty(task) {
  return Number(task?.locked_qty || 0)
}

function getRemainingQty(task) {
  return Math.max(0, Number(task?.allocated_qty || 0) - getLockedQty(task))
}

function getSubmittedQty(values) {
  return Number(values?.qty_a || 0) + Number(values?.qty_b || 0) + Number(values?.qty_c || 0)
}

async function createPauseLog({ taskId, pausedBy, pauseReason, pausedAt }) {
  const { error } = await supabase.from('qc_pause_logs').insert([
    {
      qc_item_id: taskId,
      paused_by: pausedBy || null,
      pause_reason: pauseReason,
      paused_at: pausedAt,
    },
  ])

  return error
}

async function closeOpenPauseLog({ taskId, resumedBy, resumedAt }) {
  const { data: openLog, error: openLogError } = await supabase
    .from('qc_pause_logs')
    .select('id')
    .eq('qc_item_id', taskId)
    .is('resumed_at', null)
    .order('paused_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (openLogError || !openLog) {
    return openLogError || null
  }

  const { error: updateError } = await supabase
    .from('qc_pause_logs')
    .update({
      resumed_at: resumedAt,
      resumed_by: resumedBy || null,
    })
    .eq('id', openLog.id)

  return updateError
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

export default function QcInspectionTaskPage() {
  const [userEmail, setUserEmail] = useState('')
  const [userLabel, setUserLabel] = useState('')
  const [isRegistered, setIsRegistered] = useState(false)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [clockNow, setClockNow] = useState(() => Date.now())
  const [gradeInputs, setGradeInputs] = useState({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [interruptReason, setInterruptReason] = useState('TOILET')
  const [showEmptySubmitModal, setShowEmptySubmitModal] = useState(false)
  const [showInterruptModal, setShowInterruptModal] = useState(false)
  const [completeChecks, setCompleteChecks] = useState({})

  useEffect(() => {
    let isMounted = true

    async function loadTasks() {
      setLoading(true)
      setError('')

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        if (isMounted) {
          setError(authError?.message || 'Unable to read the logged-in user.')
          setLoading(false)
        }
        return
      }

      const displayLabel =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        String(user.email || '').split('@')[0] ||
        ''

      if (isMounted) {
        setUserEmail(user.email || '')
        setUserLabel(displayLabel)
      }

      const { data: memberRow, error: memberError } = await supabase
        .from('qc_members')
        .select('id, email, display_name')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle()

      if (!isMounted) {
        return
      }

      if (memberError) {
        setError(memberError.message)
        setLoading(false)
        return
      }

      setIsRegistered(Boolean(memberRow))

      if (!memberRow) {
        setTasks([])
        if (isMounted) {
          setLoading(false)
        }
        return
      }

      const { data, error: taskError } = await supabase
        .from('qc_items')
        .select(`
          *,
          inbound:inbound_id (
            id,
            grn_number
          ),
          inbound_unload:inbound_unload_id (
            id,
            model_name,
            model_color,
            photo_url,
            koli_sequence
          )
        `)
        .eq('assigned_to', user.email)
        .in('status', ['queued', 'in_progress', 'paused'])
        .order('created_at', { ascending: true })

      if (!isMounted) {
        return
      }

      if (taskError) {
        setError(taskError.message)
        setLoading(false)
        return
      }

      setTasks(data || [])
      setLoading(false)
    }

    loadTasks()

    return () => {
      isMounted = false
    }
  }, [refreshKey])

  async function handleRegister() {
    setError('')
    setSuccess('')

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      setError(authError?.message || 'Unable to read the logged-in user.')
      return
    }

    const displayLabel =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      String(user.email || '').split('@')[0] ||
      ''

    const { error: insertError } = await supabase
      .from('qc_members')
      .upsert(
        [
          {
            email: user.email,
            display_name: displayLabel,
            is_active: true,
          },
        ],
        { onConflict: 'email' }
      )

    if (insertError) {
      setError(insertError.message)
      return
    }

    setIsRegistered(true)
    setUserEmail(user.email || '')
    setUserLabel(displayLabel)
    setSuccess('You are now registered for QC.')
    setRefreshKey((prev) => prev + 1)
  }

  const activeTask = useMemo(
    () =>
      tasks.find((task) => task.id === activeTaskId) ||
      tasks.find((task) => task.status === 'in_progress') ||
      null,
    [activeTaskId, tasks]
  )
  const activeTaskInputs = getTaskGradeInputs(activeTask, gradeInputs)
  const runningSeconds = useMemo(() => {
    if (!activeTask) {
      return 0
    }

    const baseSeconds = Number(activeTask.stopwatch_seconds || 0)
    const startedAtMs = activeTask.started_at ? new Date(activeTask.started_at).getTime() : null

    if (!startedAtMs || activeTask.status !== 'in_progress') {
      return baseSeconds
    }

    return baseSeconds + Math.max(0, Math.floor((clockNow - startedAtMs) / 1000))
  }, [activeTask, clockNow])

  useEffect(() => {
    if (!activeTask) {
      return
    }

    const startedAtMs = activeTask.started_at ? new Date(activeTask.started_at).getTime() : null

    if (activeTask.status !== 'in_progress' || !startedAtMs) {
      return
    }

    const intervalId = setInterval(() => {
      setClockNow(Date.now())
    }, 1000)

    return () => clearInterval(intervalId)
  }, [activeTask])

  async function handleStart(task) {
    setError('')
    setSuccess('')
    setGradeInputs((prev) => ({
      ...prev,
      [task.id]: { qty_a: '', qty_b: '', qty_c: '' },
    }))
    setCompleteChecks((prev) => ({
      ...prev,
      [task.id]: false,
    }))

    const startedAt = new Date().toISOString()
    const nextStatus = task.status === 'paused' ? 'in_progress' : 'in_progress'
    if (task.status === 'paused') {
      const closeLogError = await closeOpenPauseLog({
        taskId: task.id,
        resumedBy: userEmail,
        resumedAt: startedAt,
      })

      if (closeLogError) {
        setError(closeLogError.message)
        return
      }
    }

    const { data, error: updateError } = await supabase
      .from('qc_items')
      .update({
        status: nextStatus,
        started_at: startedAt,
        decided_by: userEmail,
      })
      .eq('id', task.id)
      .select(`
        *,
        inbound:inbound_id (
          id,
          grn_number
        ),
        inbound_unload:inbound_unload_id (
          id,
          model_name,
          model_color,
          photo_url,
          koli_sequence
        )
      `)
      .single()

    if (updateError) {
      setError(updateError.message)
      return
    }

    setTasks((prev) => prev.map((item) => (item.id === task.id ? data : item)))
    setActiveTaskId(task.id)
  }

  async function handleInterrupt(task) {
    setError('')
    setSuccess('')

    if (task.status !== 'in_progress') {
      setError('Only a running QC task can be interrupted.')
      return
    }

    const pausedAt = new Date().toISOString()
    const pauseLogError = await createPauseLog({
      taskId: task.id,
      pausedBy: userEmail,
      pauseReason: interruptReason,
      pausedAt,
    })

    if (pauseLogError) {
      setError(pauseLogError.message)
      return
    }

    const { data, error: updateError } = await supabase
      .from('qc_items')
      .update({
        status: 'paused',
        stopwatch_seconds: runningSeconds,
        pause_reason: interruptReason,
        paused_at: pausedAt,
        started_at: null,
        decided_by: userEmail,
      })
      .eq('id', task.id)
      .select(`
        *,
        inbound:inbound_id (
          id,
          grn_number
        ),
        inbound_unload:inbound_unload_id (
          id,
          model_name,
          model_color,
          photo_url,
          koli_sequence
        )
      `)
      .single()

    if (updateError) {
      setError(updateError.message)
      return
    }

    setTasks((prev) => prev.map((item) => (item.id === task.id ? data : item)))
    setSuccess(`QC task interrupted: ${interruptReason}.`)
    setShowInterruptModal(false)
    setActiveTaskId(null)
  }

  async function handleFinish(task) {
    setError('')
    setSuccess('')

    const currentInputs = gradeInputs[task.id] || { qty_a: '', qty_b: '', qty_c: '' }
    if (!currentInputs.qty_a && !currentInputs.qty_b && !currentInputs.qty_c) {
      setShowEmptySubmitModal(true)
      return
    }

    const { data: latestTaskRow, error: latestTaskError } = await supabase
      .from('qc_items')
      .select('qty_a, qty_b, qty_c, allocated_qty, locked_qty')
      .eq('id', task.id)
      .single()

    if (latestTaskError) {
      setError(latestTaskError.message)
      return
    }

    const remainingBeforeSubmit = Math.max(
      0,
      Number(latestTaskRow?.allocated_qty || task.allocated_qty || 0) - Number(latestTaskRow?.locked_qty || 0)
    )
    const submittedQty = getSubmittedQty(currentInputs)

    if (submittedQty > remainingBeforeSubmit) {
      setError(`Submitted qty (${submittedQty}) cannot be greater than remaining qty (${remainingBeforeSubmit}).`)
      return
    }

    const qtyA = Number(latestTaskRow?.qty_a || 0) + Number(currentInputs.qty_a || 0)
    const qtyB = Number(latestTaskRow?.qty_b || 0) + Number(currentInputs.qty_b || 0)
    const qtyC = Number(latestTaskRow?.qty_c || 0) + Number(currentInputs.qty_c || 0)
    const nextLockedQty = qtyA + qtyB + qtyC
    const isMarkedComplete = Boolean(completeChecks[task.id])
    const isTaskComplete =
      isMarkedComplete || nextLockedQty >= Number(latestTaskRow?.allocated_qty || task.allocated_qty || 0)
    const finishedAt = new Date().toISOString()

    if (!isTaskComplete) {
      const pauseLogError = await createPauseLog({
        taskId: task.id,
        pausedBy: userEmail,
        pauseReason: 'PARTIAL SUBMIT',
        pausedAt: finishedAt,
      })

      if (pauseLogError) {
        setError(pauseLogError.message)
        return
      }
    } else {
      const closeLogError = await closeOpenPauseLog({
        taskId: task.id,
        resumedBy: userEmail,
        resumedAt: finishedAt,
      })

      if (closeLogError) {
        setError(closeLogError.message)
        return
      }
    }

    const { data: updatedTask, error: updateError } = await supabase
      .from('qc_items')
      .update({
        status: isTaskComplete ? 'done' : 'paused',
        qty_a: qtyA,
        qty_b: qtyB,
        qty_c: qtyC,
        stopwatch_seconds: runningSeconds,
        finished_at: isTaskComplete ? finishedAt : null,
        decided_by: userEmail,
        locked_qty: nextLockedQty,
        started_at: null,
        paused_at: isTaskComplete ? null : finishedAt,
        pause_reason: isTaskComplete ? null : 'PARTIAL SUBMIT',
      })
      .eq('id', task.id)
      .select(`
        *,
        inbound:inbound_id (
          id,
          grn_number
        ),
        inbound_unload:inbound_unload_id (
          id,
          model_name,
          model_color,
          photo_url,
          koli_sequence
        )
      `)
      .single()

    if (updateError) {
      setError(updateError.message)
      return
    }

    setTasks((prev) =>
      isTaskComplete ? prev.filter((item) => item.id !== task.id) : prev.map((item) => (item.id === task.id ? updatedTask : item))
    )
    setActiveTaskId(null)
    setGradeInputs((prev) => {
      const next = { ...prev }
      delete next[task.id]
      return next
    })
    setCompleteChecks((prev) => {
      const next = { ...prev }
      delete next[task.id]
      return next
    })
    if (isTaskComplete) {
      const allocationGap = getLockedQty(updatedTask) - Number(updatedTask.allocated_qty || 0)
      setSuccess(
        allocationGap !== 0
          ? `QC task completed with allocation gap ${allocationGap}.`
          : 'QC task completed.'
      )
      return
    }

    setSuccess(`QC checkpoint saved. ${getRemainingQty(updatedTask)} qty still remaining in this task.`)
  }

  if (loading) {
    return <p style={styles.subtitle}>Loading QC task queue...</p>
  }

  if (!isRegistered) {
    return (
      <div style={styles.card}>
        <h1 style={styles.title}>Grading Task</h1>
        <p style={styles.subtitle}>
          Register this account first so the planner can allocate QC work to you dynamically.
        </p>
        {error ? <p style={styles.errorText}>{error}</p> : null}
        {success ? <p style={styles.successText}>{success}</p> : null}
        <div style={styles.buttonRow}>
          <button type="button" onClick={handleRegister} style={styles.primaryButton}>
            Register for QC
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div>
          <h1 style={styles.title}>Grading Task</h1>
        </div>
      </div>

      {error ? <p style={styles.errorText}>{error}</p> : null}
      {success ? <p style={styles.successText}>{success}</p> : null}

      {activeTask ? (
        <div style={styles.queueCard}>
          <div style={styles.queueHeader}>
            <div>
              <h2 style={styles.queueTitle}>Now Inspecting</h2>
              <p style={styles.subtitle}>
                {activeTask.inbound?.grn_number || '-'} · Koli {activeTask.inbound_unload?.koli_sequence || '-'}
              </p>
            </div>
            <span style={styles.badge}>{activeTask.assigned_to}</span>
          </div>

          {getTaskModelInfo(activeTask).photoUrl ? (
            <Image
              src={getTaskModelInfo(activeTask).photoUrl}
              alt={getTaskModelInfo(activeTask).modelName}
              width={640}
              height={220}
              unoptimized
              style={styles.modelThumb}
            />
          ) : (
            <div style={styles.thumbPlaceholder}>NO PHOTO</div>
          )}

          <div style={styles.mobileStack}>
            <div>
              <div style={styles.bigQty}>{getRemainingQty(activeTask)}</div>
              <div style={styles.subtitle}>Remaining Qty</div>
            </div>

            <div style={styles.metaGrid}>
              <div style={styles.metaCard}>
                <span style={styles.metaLabel}>Model</span>
                <span style={styles.metaValue}>{getTaskModelInfo(activeTask).modelName}</span>
              </div>
              <div style={styles.metaCard}>
                <span style={styles.metaLabel}>Color</span>
                <span style={styles.metaValue}>{getTaskModelInfo(activeTask).modelColor || 'NO COLOR'}</span>
              </div>
              <div style={styles.metaCard}>
                <span style={styles.metaLabel}>Allocated</span>
                <span style={styles.metaValue}>{Number(activeTask.allocated_qty || 0)}</span>
              </div>
              <div style={styles.metaCard}>
                <span style={styles.metaLabel}>
                  Graded Qty
                  <InfoHint text="Qty yang sudah di QC oleh Grader." />
                </span>
                <span style={styles.metaValue}>{getLockedQty(activeTask)}</span>
              </div>
            </div>
          </div>

          <div style={styles.timerBox}>
            <div>
              <div style={styles.metaLabel}>Stopwatch</div>
              <div style={styles.timerValue}>{formatSeconds(runningSeconds)}</div>
            </div>

            {activeTask.status === 'queued' || activeTask.status === 'paused' ? (
              <button type="button" onClick={() => handleStart(activeTask)} style={styles.primaryButton}>
                {activeTask.status === 'paused' ? 'Resume' : 'Start'}
              </button>
            ) : (
              <span style={{ fontWeight: '700' }}>Running</span>
            )}
          </div>

          <div style={styles.fieldGrid}>
            <div style={styles.field}>
              <label style={styles.label}>Qty A</label>
              <input
                type="number"
                min="0"
                value={activeTaskInputs.qty_a}
                onChange={(event) =>
                  setGradeInputs((prev) => ({
                    ...prev,
                    [activeTask.id]: {
                      ...getTaskGradeInputs(activeTask, prev),
                      qty_a: event.target.value,
                    },
                  }))
                }
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Qty B</label>
              <input
                type="number"
                min="0"
                value={activeTaskInputs.qty_b}
                onChange={(event) =>
                  setGradeInputs((prev) => ({
                    ...prev,
                    [activeTask.id]: {
                      ...getTaskGradeInputs(activeTask, prev),
                      qty_b: event.target.value,
                    },
                  }))
                }
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Qty C</label>
              <input
                type="number"
                min="0"
                value={activeTaskInputs.qty_c}
                onChange={(event) =>
                  setGradeInputs((prev) => ({
                    ...prev,
                    [activeTask.id]: {
                      ...getTaskGradeInputs(activeTask, prev),
                      qty_c: event.target.value,
                    },
                  }))
                }
                style={styles.input}
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>
            <input
              type="checkbox"
              checked={Boolean(completeChecks[activeTask.id])}
              onChange={(event) =>
                setCompleteChecks((prev) => ({
                  ...prev,
                  [activeTask.id]: event.target.checked,
                }))
              }
            />
            QC selesai untuk qty yang benar-benar masuk. Kalau allocated lebih besar dari aktual, task tetap boleh selesai dan gap-nya jadi catatan planner.
          </label>

          <div style={styles.buttonRow}>
            {activeTask.status === 'in_progress' ? (
              <>
                <button type="button" onClick={() => setShowInterruptModal(true)} style={styles.secondaryButton}>
                  Interrupt
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => handleFinish(activeTask)}
              style={styles.primaryButton}
              disabled={activeTask.status !== 'in_progress'}
            >
              Stop & Submit
            </button>
          </div>

          <p style={styles.subtitle}>
            Remaining Qty shows allocation gap (`allocated - graded qty`). Jika fisik yang masuk QC memang lebih sedikit,
            centang `QC selesai` lalu submit. Gap allocation akan tetap tersimpan sebagai catatan mismatch planner.
          </p>
        </div>
      ) : null}

      {tasks.filter((task) => task.id !== activeTask?.id).length ? (
        <div style={styles.mobileStack}>
          {tasks
            .filter((task) => task.id !== activeTask?.id)
            .map((task) => {
              const taskModel = getTaskModelInfo(task)

              return (
                <div key={task.id} style={styles.queueCard}>
                  <div style={styles.queueHeader}>
                    <div>
                      <h2 style={styles.queueTitle}>{taskModel.modelName}</h2>
                      <p style={styles.subtitle}>
                        {task.inbound?.grn_number || '-'} · Koli {task.inbound_unload?.koli_sequence || '-'}
                      </p>
                    </div>
                    <span style={styles.badge}>
                      {task.status === 'queued' ? 'Queued' : task.status === 'paused' ? 'Paused' : 'Running'}
                    </span>
                    
                  </div>

                  {taskModel.photoUrl ? (
                    <Image
                      src={taskModel.photoUrl}
                      alt={taskModel.modelName}
                      width={640}
                      height={220}
                      unoptimized
                      style={styles.modelThumb}
                    />
                  ) : (
                    <div style={styles.thumbPlaceholder}>NO PHOTO</div>
                  )}

                  <div style={styles.bigQty}>{getRemainingQty(task)}</div>
                  <div style={styles.subtitle}>Remaining Qty</div>
                  <p style={styles.subtitle}>
                    Graded Qty {getLockedQty(task)} / Allocated {Number(task.allocated_qty || 0)}
                  </p>

                  <div style={styles.buttonRow}>
                    <button type="button" onClick={() => handleStart(task)} style={styles.primaryButton}>
                      {task.status === 'paused' ? 'Resume' : 'Mulai'}
                    </button>
                  </div>
                </div>
              )
            })}
        </div>
      ) : null}

      {!activeTask && !tasks.length ? (
        <div style={styles.emptyState}>
          Tidak ada task QC untuk akun ini sekarang. Kalau kosong, berarti belum ada alokasi yang masuk ke {userLabel || userEmail}.
        </div>
      ) : null}

      {showEmptySubmitModal ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div>
              <h2 style={styles.queueTitle}>Qty Masih Kosong</h2>
              <p style={styles.subtitle}>Isi minimal salah satu dari Qty A, Qty B, atau Qty C sebelum submit QC.</p>
            </div>
            <div style={{ ...styles.buttonRow, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowEmptySubmitModal(false)} style={styles.primaryButton}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showInterruptModal && activeTask ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div>
              <h2 style={styles.queueTitle}>Interrupt QC?</h2>
              <p style={styles.subtitle}>Choose the reason first. If you cancel, QC will continue running.</p>
            </div>
            <select value={interruptReason} onChange={(event) => setInterruptReason(event.target.value)} style={styles.input}>
              {BREAK_REASONS.filter((reason) => reason !== 'COORDINATOR BREAK').map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
            <div style={{ ...styles.buttonRow, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowInterruptModal(false)} style={styles.secondaryButton}>
                Cancel
              </button>
              <button type="button" onClick={() => handleInterrupt(activeTask)} style={styles.primaryButton}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
