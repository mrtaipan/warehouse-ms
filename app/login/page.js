'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'

function isValidEmail(value) {
  return /\S+@\S+\.\S+/.test(value)
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState('')

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
    router.push(nextPath || '/dashboard/storage')
    router.refresh()
  }

  return (
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
                Lupa Password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField('')}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={{
                ...styles.input,
                ...(focusedField === 'password' ? styles.inputFocused : {}),
              }}
            />
          </div>

          {error ? <p style={styles.error}>{error}</p> : null}

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </section>
    </main>
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
  inputFocused: {
    border: '1px solid #111111',
    boxShadow: '0 0 0 3px rgba(17,17,17,0.08)',
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
