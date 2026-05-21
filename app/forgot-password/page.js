'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'

function isValidEmail(value) {
  return /\S+@\S+\.\S+/.test(value)
}

function ForgotPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const processedRecoveryRef = useRef(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function detectRecoveryState() {
      const searchType = String(searchParams.get('type') || '').trim().toLowerCase()
      const authCode = String(searchParams.get('code') || '').trim()
      const tokenHash = String(searchParams.get('token_hash') || '').trim()
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
      const hashType = String(hashParams.get('type') || '').trim().toLowerCase()
      const hasRecoveryToken = Boolean(hashParams.get('access_token'))
      const refreshToken = String(hashParams.get('refresh_token') || '').trim()

      if (!processedRecoveryRef.current) {
        if (authCode) {
          processedRecoveryRef.current = true
          setLoading(true)
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode)

          if (!isMounted) return

          if (exchangeError) {
            setError('Recovery link is invalid or expired. Please request a new reset link.')
            setLoading(false)
            return
          }

          setIsRecoveryMode(true)
          setError('')
          setSuccess('')
          setLoading(false)
          window.history.replaceState({}, '', '/forgot-password')
          return
        }

        if (tokenHash && searchType === 'recovery') {
          processedRecoveryRef.current = true
          setLoading(true)
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          })

          if (!isMounted) return

          if (verifyError) {
            setError('Recovery link is invalid or expired. Please request a new reset link.')
            setLoading(false)
            return
          }

          setIsRecoveryMode(true)
          setError('')
          setSuccess('')
          setLoading(false)
          window.history.replaceState({}, '', '/forgot-password')
          return
        }

        if (hasRecoveryToken && refreshToken && hashType === 'recovery') {
          processedRecoveryRef.current = true
          setLoading(true)
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: String(hashParams.get('access_token') || ''),
            refresh_token: refreshToken,
          })

          if (!isMounted) return

          if (sessionError) {
            setError('Recovery link is invalid or expired. Please request a new reset link.')
            setLoading(false)
            return
          }

          setIsRecoveryMode(true)
          setError('')
          setSuccess('')
          setLoading(false)
          window.history.replaceState({}, '', '/forgot-password')
          return
        }
      }

      if (searchType === 'recovery' || hashType === 'recovery' || hasRecoveryToken) {
        if (isMounted) setIsRecoveryMode(true)
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!isMounted) return

      if (session && session.user) {
        setIsRecoveryMode(true)
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true)
        setError('')
        setSuccess('')
      }
    })

    void detectRecoveryState()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [searchParams, supabase])

  async function handleSendResetLink(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setError('Email is required.')
      return
    }

    if (!isValidEmail(normalizedEmail)) {
      setError('Email format is not valid.')
      return
    }

    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/forgot-password`,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSuccess('Password reset link has been sent. Please check your email.')
    setLoading(false)
  }

  async function handleUpdatePassword(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!password.trim()) {
      setError('New password is required.')
      return
    }

    if (password.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Password confirmation does not match.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess('Password has been updated. Redirecting to login...')
    setLoading(false)

    window.setTimeout(() => {
      void supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    }, 1200)
  }

  return (
    <main style={styles.wrapper}>
      <section style={styles.card}>
        <p style={styles.kicker}>Account Support</p>
        <h1 style={styles.title}>{isRecoveryMode ? 'Set New Password' : 'Forgot Password'}</h1>
        <p style={styles.subtitle}>
          {isRecoveryMode
            ? 'Enter your new password below to finish resetting your account password.'
            : 'Enter your email address and we will send you a password reset link.'}
        </p>

        {isRecoveryMode ? (
          <form onSubmit={handleUpdatePassword} style={styles.form} noValidate>
            <div style={styles.field}>
              <label style={styles.label}>New Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Enter new password"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Repeat new password"
                style={styles.input}
              />
            </div>

            {error ? <p style={styles.error}>{error}</p> : null}
            {success ? <p style={styles.success}>{success}</p> : null}

            <button type="submit" style={styles.button} disabled={loading}>
              {loading ? 'Saving...' : 'Save New Password'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSendResetLink} style={styles.form} noValidate>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="Enter your email"
                style={styles.input}
              />
            </div>

            {error ? <p style={styles.error}>{error}</p> : null}
            {success ? <p style={styles.success}>{success}</p> : null}

            <button type="submit" style={styles.button} disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <Link href="/login" style={styles.link}>
          Back to Login
        </Link>
      </section>
    </main>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <main style={styles.wrapper}>
          <section style={styles.card}>
            <p style={styles.kicker}>Account Support</p>
            <h1 style={styles.title}>Forgot Password</h1>
            <p style={styles.subtitle}>Preparing password recovery...</p>
          </section>
        </main>
      }
    >
      <ForgotPasswordContent />
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
  kicker: {
    margin: 0,
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.14em',
    color: '#5d7497',
    textTransform: 'uppercase',
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
  link: {
    marginTop: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '48px',
    borderRadius: '14px',
    background: '#0f254b',
    color: '#fff',
    textDecoration: 'none',
    fontWeight: '700',
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
