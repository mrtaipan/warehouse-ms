export default function StoragePage() {
  return (
    <div style={styles.wrapper}>
      <div>
        <h1 style={styles.title}>Storage Menu</h1>
        <p style={styles.subtitle}>
          Pilih proses storage yang ingin dibuka, termasuk akses cepat ke halaman mobile picker.
        </p>
      </div>

      <div style={styles.grid}>
        <a href="/dashboard/storage/overview" style={styles.card}>
          <span style={styles.eyebrow}>Storage</span>
          <strong style={styles.cardTitle}>Storage Overview</strong>
          <span style={styles.cardText}>Lihat stok dan lakukan take/edit dari tampilan utama.</span>
        </a>

        <a href="/dashboard/storage/registry" style={styles.card}>
          <span style={styles.eyebrow}>Storage</span>
          <strong style={styles.cardTitle}>Registry Storage</strong>
          <span style={styles.cardText}>Input barang masuk ke lokasi rack yang tepat.</span>
        </a>

        <a href="/dashboard/storage/search" style={styles.card}>
          <span style={styles.eyebrow}>Storage</span>
          <strong style={styles.cardTitle}>Search Storage</strong>
          <span style={styles.cardText}>Cari lokasi barang berdasarkan nama item.</span>
        </a>

        <a href="/take-requests" style={styles.mobileCard}>
          <span style={styles.eyebrow}>Mobile Picker</span>
          <strong style={styles.cardTitle}>Take Requests</strong>
          <span style={styles.cardText}>
            Buka halaman mobile tanpa sidebar untuk picker complete request.
          </span>
        </a>
      </div>
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  title: {
    margin: 0,
    fontSize: '30px',
  },
  subtitle: {
    marginTop: '8px',
    marginBottom: 0,
    color: '#6b7280',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '20px',
    borderRadius: '18px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    textDecoration: 'none',
    boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
  },
  mobileCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '20px',
    borderRadius: '18px',
    background: '#fff7ed',
    border: '1px solid #fdba74',
    textDecoration: 'none',
    boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
  },
  eyebrow: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#9a3412',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  cardTitle: {
    color: '#111827',
    fontSize: '20px',
  },
  cardText: {
    color: '#6b7280',
    fontSize: '14px',
    lineHeight: 1.5,
  },
}
