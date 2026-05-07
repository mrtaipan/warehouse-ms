import Link from 'next/link'

export default function ForgotPasswordPage() {
  return (
    <main style={styles.wrapper}>
      <section style={styles.card}>
        <p style={styles.kicker}>Account Support</p>
        <h1 style={styles.title}>Forgot Password</h1>
        <p style={styles.subtitle}>
          Untuk sementara, silakan hubungi administrator atau PIC sistem Anda untuk membantu reset password akun.
        </p>

        <Link href="/login" style={styles.link}>
          Back to Login
        </Link>
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
  link: {
    marginTop: '8px',
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
}
