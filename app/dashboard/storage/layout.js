import Link from 'next/link'

export default function StorageLayout({ children }) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.subnav}>
        <Link href="/dashboard/storage/overview" style={styles.link}>
          Storage Overview
        </Link>
        <Link href="/dashboard/storage/registry" style={styles.link}>
          Registry Storage
        </Link>
        <Link href="/dashboard/storage/search" style={styles.link}>
          Search Storage
        </Link>
        <Link href="/restock-request" style={styles.link}>
          Restock Submit
        </Link>
        <Link href="/take-requests" style={styles.link}>
          Restock Picker
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
