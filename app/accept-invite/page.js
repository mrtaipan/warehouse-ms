'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'

function EyeIcon({ crossed = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={styles.passwordToggleIcon}
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.8" />
      {crossed ? <path d="M4 20 20 4" /> : null}
    </svg>
  )
}

function AcceptInviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const processedInviteRef = useRef(false)

  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [inviteReady, setInviteReady] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function detectInviteState() {
      const searchType = String(searchParams.get('type') || '').trim().toLowerCase()
      const authCode = String(searchParams.get('code') || '').trim()
      const tokenHash = String(searchParams.get('token_hash') || '').trim()
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
      const hashType = String(hashParams.get('type') || '').trim().toLowerCase()
      const hasInviteToken = Boolean(hashParams.get('access_token'))
      const refreshToken = String(hashParams.get('refresh_token') || '').trim()

      if (!processedInviteRef.current) {
        if (authCode) {
          processedInviteRef.current = true
          setLoading(true)
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode)

          if (!isMounted) return

          if (exchangeError) {
            setError('Invitation link is invalid or expired. Please request a new invitation.')
            setLoading(false)
            return
          }

          setInviteReady(true)
          setError('')
          setSuccess('')
          setLoading(false)
          window.history.replaceState({}, '', '/accept-invite')
          return
        }

        if (tokenHash && searchType === 'invite') {
          processedInviteRef.current = true
          setLoading(true)
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'invite',
          })

          if (!isMounted) return

          if (verifyError) {
            setError('Invitation link is invalid or expired. Please request a new invitation.')
            setLoading(false)
            return
          }

          setInviteReady(true)
          setError('')
          setSuccess('')
          setLoading(false)
          window.history.replaceState({}, '', '/accept-invite')
          return
        }

        if (hasInviteToken && refreshToken && hashType === 'invite') {
          processedInviteRef.current = true
          setLoading(true)
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: String(hashParams.get('access_token') || ''),
            refresh_token: refreshToken,
          })

          if (!isMounted) return

          if (sessionError) {
            setError('Invitation link is invalid or expired. Please request a new invitation.')
            setLoading(false)
            return
          }

          setInviteReady(true)
          setError('')
          setSuccess('')
          setLoading(false)
          window.history.replaceState({}, '', '/accept-invite')
          return
        }
      }

      if (searchType === 'invite' || hashType === 'invite' || hasInviteToken) {
        if (isMounted) setInviteReady(true)
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!isMounted) return

      if (session && session.user) {
        setInviteReady(true)
        const metaDisplayName =
          String(session.user.user_metadata?.display_name || '').trim() ||
          String(session.user.user_metadata?.full_name || '').trim()
        if (metaDisplayName) {
          setDisplayName(metaDisplayName)
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setInviteReady(true)
        setError('')
        if (session?.user) {
          const metaDisplayName =
            String(session.user.user_metadata?.display_name || '').trim() ||
            String(session.user.user_metadata?.full_name || '').trim()
          if (metaDisplayName) {
            setDisplayName(metaDisplayName)
          }
        }
      }
    })

    void detectInviteState()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [searchParams, supabase])

  async function handleAcceptInvite(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!password.trim()) {
      setError('Password is required.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Password confirmation does not match.')
      return
    }

    setLoading(true)

    const updatePayload = {
      password,
      data: {},
    }

    const normalizedDisplayName = displayName.trim()
    if (normalizedDisplayName) {
      updatePayload.data.display_name = normalizedDisplayName
      updatePayload.data.full_name = normalizedDisplayName
    }

    const { error: updateError } = await supabase.auth.updateUser(updatePayload)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess('Account is ready. Redirecting to dashboard...')
    setLoading(false)

    window.setTimeout(() => {
      router.push('/dashboard')
      router.refresh()
    }, 1200)
  }

  return (
    <>
      <main style={styles.wrapper}>
        <section style={styles.card}>
          <div style={styles.topRow}>
            <p style={styles.kicker}>New Account</p>
            <Link href="/login" style={styles.topLink}>
              Back to Login
            </Link>
          </div>
          <h1 style={styles.title}>Accept Invitation</h1>
          <p style={styles.subtitle}>
            {inviteReady
              ? 'Set your password to activate your account and start using the system.'
              : 'Opening your invitation link and preparing your account...'}
          </p>

          <form onSubmit={handleAcceptInvite} style={styles.form} noValidate>
            <div style={styles.field}>
              <label style={styles.label}>Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="name"
                placeholder="Enter your display name"
                style={styles.input}
                disabled={!inviteReady || loading}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <div style={styles.passwordWrap}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Create your password"
                  style={{
                    ...styles.input,
                    ...styles.inputWithToggle,
                  }}
                  disabled={!inviteReady || loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={styles.passwordToggle}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={!inviteReady || loading}
                >
                  <EyeIcon crossed={showPassword} />
                </button>
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Confirm Password</label>
              <div style={styles.passwordWrap}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  style={{
                    ...styles.input,
                    ...styles.inputWithToggle,
                  }}
                  disabled={!inviteReady || loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  style={styles.passwordToggle}
                  aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                  disabled={!inviteReady || loading}
                >
                  <EyeIcon crossed={showConfirmPassword} />
                </button>
              </div>
            </div>

            {error ? <p style={styles.error}>{error}</p> : null}
            {success ? <p style={styles.success}>{success}</p> : null}

            <button type="submit" style={styles.button} disabled={!inviteReady || loading}>
              {loading ? 'Preparing...' : 'Activate Account'}
            </button>
          </form>
        </section>
      </main>

      <style jsx global>{`
        input[type='password']::-ms-reveal,
        input[type='password']::-ms-clear {
          display: none;
        }

        input[type='password']::-webkit-credentials-auto-fill-button,
        input[type='password']::-webkit-password-reveal-button {
          visibility: hidden;
          display: none !important;
          pointer-events: none;
        }
      `}</style>
    </>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <main style={styles.wrapper}>
          <section style={styles.card}>
            <p style={styles.kicker}>New Account</p>
            <h1 style={styles.title}>Accept Invitation</h1>
            <p style={styles.subtitle}>Preparing your invitation...</p>
          </section>
        </main>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  )
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg, #fbfcfe 0%, #f2f6fb 100%)',
    padding: '20px',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: '#fff',
    border: '1px solid #dbe3ef',
    borderRadius: '24px',
    padding: '28px 22px',
    boxShadow: '0 22px 60px rgba(15, 23, 42, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  kicker: {
    margin: 0,
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.14em',
    color: '#5d7497',
    textTransform: 'uppercase',
  },
  topLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '32px',
    padding: '0 12px',
    borderRadius: '10px',
    background: '#e5e7eb',
    color: '#111827',
    textDecoration: 'none',
    fontWeight: '700',
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    color: '#0f172a',
  },
  subtitle: {
    margin: 0,
    color: '#64748b',
    lineHeight: 1.6,
    fontSize: '14px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111111',
  },
  input: {
    height: '48px',
    padding: '0 14px',
    borderRadius: '14px',
    border: '1px solid #d4d4d8',
    fontSize: '14px',
    outline: 'none',
    background: '#ffffff',
    color: '#111111',
    boxSizing: 'border-box',
    width: '100%',
  },
  inputWithToggle: {
    paddingRight: '92px',
  },
  button: {
    height: '50px',
    border: 'none',
    borderRadius: '14px',
    backgroundColor: '#111111',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    width: '100%',
  },
  passwordWrap: {
    position: 'relative',
  },
  passwordToggle: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    border: 'none',
    background: 'transparent',
    color: '#4b5563',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordToggleIcon: {
    width: '18px',
    height: '18px',
    display: 'block',
  },
  error: {
    margin: 0,
    color: '#b91c1c',
    fontSize: '13px',
    lineHeight: 1.5,
    background: '#fef2f2',
    borderRadius: '12px',
    padding: '10px 12px',
  },
  success: {
    margin: 0,
    color: '#166534',
    fontSize: '13px',
    lineHeight: 1.5,
    background: '#f0fdf4',
    borderRadius: '12px',
    padding: '10px 12px',
  },
}
