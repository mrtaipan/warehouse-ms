import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { loadAccessContext } from '@/utils/access-control'
import { hasPermission } from '@/utils/permissions'

export default async function MobileReceivingIndexPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { permissions, isAdmin } = await loadAccessContext(supabase, user, 'role')

  if (!hasPermission(permissions, 'inbound.receiving.edit', isAdmin)) {
    redirect('/dashboard')
  }

  const { data: inboundRows, error: inboundError } = await supabase
    .from('inbound')
    .select('id, grn_number, item_name, total_koli, inbound_date, created_at')
    .in('status', ['draft', 'inbound'])
    .order('inbound_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  if (inboundError) {
    return <EmptyState title="Receiving belum bisa dibuka" message={inboundError.message} />
  }

  const inboundIds = (inboundRows || []).map((row) => row.id).filter(Boolean)

  if (!inboundIds.length) {
    return <EmptyState title="Tidak ada GRN pending" message="Belum ada inbound yang bisa diinput receiving saat ini." />
  }

  const { data: detailRows, error: detailError } = await supabase
    .from('inbound_receiving')
    .select('inbound_id, unload_pic')
    .in('inbound_id', inboundIds)

  if (detailError) {
    return <EmptyState title="Receiving belum bisa dibuka" message={detailError.message} />
  }

  const submittedCountByInboundId = new Map()

  ;(detailRows || []).forEach((row) => {
    if (!String(row.unload_pic || '').trim()) return
    const key = String(row.inbound_id)
    submittedCountByInboundId.set(key, Number(submittedCountByInboundId.get(key) || 0) + 1)
  })

  const pendingInbound = (inboundRows || []).find((row) => {
    const totalKoli = Math.max(Number(row.total_koli || 0), 1)
    const submittedCount = Number(submittedCountByInboundId.get(String(row.id)) || 0)
    return submittedCount < totalKoli
  })

  if (pendingInbound?.id) {
    redirect(`/mobile/inbound/receiving/${pendingInbound.id}`)
  }

  return <EmptyState title="Receiving sudah selesai" message="Semua GRN terbaru sudah selesai diinput receiving." />
}

function EmptyState({ title, message }) {
  return (
    <main style={styles.shell}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>Inbound Receiving</p>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.message}>{message}</p>
        <Link href="/dashboard" style={styles.link}>
          Back to Dashboard
        </Link>
      </section>
    </main>
  )
}

const styles = {
  shell: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    background: '#f8fafc',
  },
  card: {
    width: 'min(420px, 100%)',
    border: '1px solid #e2e8f0',
    borderRadius: '22px',
    padding: '24px',
    background: '#fff',
    boxShadow: '0 18px 48px rgba(15, 23, 42, 0.08)',
  },
  eyebrow: {
    margin: 0,
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '8px 0 0',
    color: '#0f172a',
    fontSize: '26px',
    lineHeight: 1.08,
  },
  message: {
    margin: '12px 0 20px',
    color: '#475569',
    fontSize: '14px',
    lineHeight: 1.55,
  },
  link: {
    display: 'inline-flex',
    minHeight: '40px',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    padding: '0 14px',
    background: '#0f172a',
    color: '#fff',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 800,
  },
}
