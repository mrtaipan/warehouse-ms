import Link from 'next/link'

export default function InboundLayout({ children }) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.subnav}>
        <Link href="/dashboard/inbound" style={styles.link}>
          Dashboard
        </Link>
        <Link href="/dashboard/inbound/receiving" style={styles.link}>
          Receiving
        </Link>
        <Link href="/dashboard/inbound/unload" style={styles.link}>
          Unload
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
