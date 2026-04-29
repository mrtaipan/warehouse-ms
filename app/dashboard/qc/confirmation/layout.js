import Link from 'next/link'

export default function QcConfirmationLayout({ children }) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.subnav}>
        <Link href="/dashboard/qc/confirmation/next-process" style={styles.link}>
          Next Process
        </Link>
        <Link href="/dashboard/qc/confirmation/rejection" style={styles.link}>
          Rejection
        </Link>
      </div>

      {children}
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  subnav: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
  },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 14px',
    borderRadius: '10px',
    textDecoration: 'none',
    background: '#f3f4f6',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '600',
  },
}
