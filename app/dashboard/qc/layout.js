import Link from 'next/link'

export default function QcLayout({ children }) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.subnav}>
        <Link href="/dashboard/qc" style={styles.link}>
          Dashboard
        </Link>
        <Link href="/dashboard/qc/receiving" style={styles.link}>
          Receiving
        </Link>
        <Link href="/dashboard/qc/inspection-task" style={styles.link}>
          Inspection Task
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
    background: '#e5e7eb',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '600',
  },
}
