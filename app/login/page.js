'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'

function isValidEmail(value) {
  return /\S+@\S+\.\S+/.test(value)
}

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

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState('')

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const hash = window.location.hash || ''
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
    const searchType = String(searchParams.get('type') || '').trim().toLowerCase()
    const hashType = String(hashParams.get('type') || '').trim().toLowerCase()
    const isInviteSignal = searchType === 'invite' || hashType === 'invite'
    const hasRecoverySignal =
      searchType === 'recovery' ||
      hashType === 'recovery' ||
      (Boolean(searchParams.get('token_hash')) && searchType === 'recovery') ||
      (Boolean(hashParams.get('access_token')) && hashType === 'recovery')

    if (isInviteSignal) {
      const nextUrl = new URL('/accept-invite', window.location.origin)
      searchParams.forEach((value, key) => {
        nextUrl.searchParams.set(key, value)
      })
      nextUrl.hash = hash
      router.replace(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
      return
    }

    if (!hasRecoverySignal) return

    const nextUrl = new URL('/forgot-password', window.location.origin)
    searchParams.forEach((value, key) => {
      nextUrl.searchParams.set(key, value)
    })
    nextUrl.hash = hash
    router.replace(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
  }, [router])

  async function handleLogin(event) {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Email dan password wajib diisi.')
      return
    }

    if (!isValidEmail(email.trim())) {
      setError('Format email belum valid.')
      return
    }

    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    const nextPath = new URLSearchParams(window.location.search).get('next')
    router.push(nextPath || '/dashboard')
    router.refresh()
  }

  return (
    <>
      <main style={styles.wrapper}>
        <section style={styles.card}>
          <div style={styles.brandBlock}>
            <Image src="/mob-text-logo.png" alt="MOB" width={240} height={80} priority style={styles.wordmark} />
          </div>

          <div style={styles.copyBlock}>
            <p style={styles.subtitle}>Warehouse Management System</p>
            <h1 style={styles.title}>Login</h1>
          </div>

          <form onSubmit={handleLogin} style={styles.form} noValidate>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField('')}
                placeholder="Enter your email"
                autoComplete="email"
                style={{
                  ...styles.input,
                  ...(focusedField === 'email' ? styles.inputFocused : {}),
                }}
              />
            </div>

            <div style={styles.field}>
              <div style={styles.fieldHeader}>
                <label style={styles.label}>Password</label>
                <Link href="/forgot-password" style={styles.forgotLink}>
                  Forgot Password?
                </Link>
              </div>
              <div style={styles.passwordWrap}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField('')}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  style={{
                    ...styles.input,
                    ...styles.inputWithToggle,
                    ...(focusedField === 'password' ? styles.inputFocused : {}),
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={styles.passwordToggle}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon crossed={showPassword} />
                </button>
              </div>
            </div>

            {error ? <p style={styles.error}>{error}</p> : null}

            <button type="submit" style={styles.button} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
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

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg, #fbfcfe 0%, #f3f6fb 100%)',
    padding: '16px',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    backgroundColor: '#ffffff',
    padding: '24px 20px',
    borderRadius: '20px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  brandBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '4px',
    marginBottom: '-10px',
  },
  wordmark: {
    width: 'min(240px, 72vw)',
    height: 'auto',
    objectFit: 'contain',
    display: 'block',
    marginBottom: '-16px',
  },
  copyBlock: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: '700',
    color: '#111111',
  },
  subtitle: {
    margin: 0,
    textAlign: 'center',
    color: '#666666',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fieldHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111111',
  },
  forgotLink: {
    fontSize: '12px',
    color: '#4b5563',
    textDecoration: 'none',
    fontWeight: '600',
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
    transition: 'border-color 160ms ease, box-shadow 160ms ease',
    boxSizing: 'border-box',
    width: '100%',
  },
  inputWithToggle: {
    paddingRight: '92px',
  },
  inputFocused: {
    border: '1px solid #111111',
    boxShadow: '0 0 0 3px rgba(17,17,17,0.08)',
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
  error: {
    margin: 0,
    color: '#b91c1c',
    fontSize: '13px',
    lineHeight: 1.5,
    background: '#fef2f2',
    borderRadius: '12px',
    padding: '10px 12px',
  },
}
