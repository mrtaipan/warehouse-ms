'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import { formatSeconds } from '../shared'

const supabase = createClient()

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
}

function getPrimaryObservedItem(task) {
  const firstObserved = Array.isArray(task.observed_items) ? task.observed_items[0] : null

  return {
    modelName: firstObserved?.model_name || task.inbound_unload?.model_name || 'UNKNOWN MODEL',
    modelColor: firstObserved?.model_color || task.inbound_unload?.model_color || '',
    photoUrl: firstObserved?.photo_url || task.inbound_unload?.photo_url || '',
  }
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
        .in('status', ['queued', 'in_progress'])
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
    () => tasks.find((task) => task.id === activeTaskId) || tasks.find((task) => task.status === 'in_progress') || null,
    [activeTaskId, tasks]
  )
  const activeTaskInputs = activeTask
    ? gradeInputs[activeTask.id] || {
        qty_a: String(activeTask.qty_a || ''),
        qty_b: String(activeTask.qty_b || ''),
        qty_c: String(activeTask.qty_c || ''),
      }
    : { qty_a: '', qty_b: '', qty_c: '' }
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

    const startedAt = new Date().toISOString()
    const { data, error: updateError } = await supabase
      .from('qc_items')
      .update({
        status: 'in_progress',
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

  async function handleFinish(task) {
    setError('')
    setSuccess('')

    const currentInputs = gradeInputs[task.id] || { qty_a: '', qty_b: '', qty_c: '' }
    const qtyA = Number(currentInputs.qty_a || 0)
    const qtyB = Number(currentInputs.qty_b || 0)
    const qtyC = Number(currentInputs.qty_c || 0)

    const { error: updateError } = await supabase
      .from('qc_items')
      .update({
        status: 'done',
        qty_a: qtyA,
        qty_b: qtyB,
        qty_c: qtyC,
        stopwatch_seconds: runningSeconds,
        finished_at: new Date().toISOString(),
        decided_by: userEmail,
      })
      .eq('id', task.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setTasks((prev) => prev.filter((item) => item.id !== task.id))
    setActiveTaskId(null)
    setSuccess('QC task completed.')
  }

  if (loading) {
    return <p style={styles.subtitle}>Loading QC task queue...</p>
  }

  if (!isRegistered) {
    return (
      <div style={styles.card}>
        <h1 style={styles.title}>Inspection Task</h1>
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
          <h1 style={styles.title}>Inspection Task</h1>
          <p style={styles.subtitle}>
            Mobile-friendly queue for {userLabel || userEmail}. Open one task, start the timer, then submit Qty A, Qty B, and Qty C when finished.
          </p>
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

          {getPrimaryObservedItem(activeTask).photoUrl ? (
            <Image
              src={getPrimaryObservedItem(activeTask).photoUrl}
              alt={getPrimaryObservedItem(activeTask).modelName}
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
              <div style={styles.bigQty}>{activeTask.allocated_qty}</div>
              <div style={styles.subtitle}>Allocated Qty</div>
            </div>

            <div style={styles.metaGrid}>
              <div style={styles.metaCard}>
                <span style={styles.metaLabel}>Model</span>
                <span style={styles.metaValue}>{getPrimaryObservedItem(activeTask).modelName}</span>
              </div>
              <div style={styles.metaCard}>
                <span style={styles.metaLabel}>Color</span>
                <span style={styles.metaValue}>{getPrimaryObservedItem(activeTask).modelColor || 'NO COLOR'}</span>
              </div>
            </div>
          </div>

          <div style={styles.timerBox}>
            <div>
              <div style={styles.metaLabel}>Stopwatch</div>
              <div style={styles.timerValue}>{formatSeconds(runningSeconds)}</div>
            </div>

            {activeTask.status === 'queued' ? (
              <button type="button" onClick={() => handleStart(activeTask)} style={styles.primaryButton}>
                Start
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
                      ...prev[activeTask.id],
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
                      ...prev[activeTask.id],
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
                      ...prev[activeTask.id],
                      qty_c: event.target.value,
                    },
                  }))
                }
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.buttonRow}>
            <button
              type="button"
              onClick={() => handleFinish(activeTask)}
              style={styles.primaryButton}
              disabled={activeTask.status !== 'in_progress'}
            >
              Stop & Submit
            </button>
          </div>
        </div>
      ) : null}

      {tasks.filter((task) => task.id !== activeTask?.id).length ? (
        <div style={styles.mobileStack}>
          {tasks
            .filter((task) => task.id !== activeTask?.id)
            .map((task) => {
              const primaryObserved = getPrimaryObservedItem(task)

              return (
                <div key={task.id} style={styles.queueCard}>
                  <div style={styles.queueHeader}>
                    <div>
                      <h2 style={styles.queueTitle}>{primaryObserved.modelName}</h2>
                      <p style={styles.subtitle}>
                        {task.inbound?.grn_number || '-'} · Koli {task.inbound_unload?.koli_sequence || '-'}
                      </p>
                    </div>
                    <span style={styles.badge}>{task.status === 'queued' ? 'Queued' : 'Running'}</span>
                  </div>

                  {primaryObserved.photoUrl ? (
                    <Image
                      src={primaryObserved.photoUrl}
                      alt={primaryObserved.modelName}
                      width={640}
                      height={220}
                      unoptimized
                      style={styles.modelThumb}
                    />
                  ) : (
                    <div style={styles.thumbPlaceholder}>NO PHOTO</div>
                  )}

                  <div style={styles.bigQty}>{task.allocated_qty}</div>
                  <div style={styles.subtitle}>Allocated Qty</div>

                  <div style={styles.buttonRow}>
                    <button type="button" onClick={() => handleStart(task)} style={styles.primaryButton}>
                      Mulai
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
    </div>
  )
}
