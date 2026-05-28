import PublicRequestClient from './public-request-client'
import styles from './page.module.css'
import { verifyHrgaRequestLinkPayload } from '@/utils/hrga-request-link'
import { createClient } from '@/utils/supabase/server'

export default async function PublicPeopleRequestPage({ searchParams }) {
  const resolvedSearchParams = await searchParams
  const payload = String(resolvedSearchParams?.payload || '').trim()
  const signature = String(resolvedSearchParams?.sig || '').trim()
  const decoded = verifyHrgaRequestLinkPayload(payload, signature)
  const supabase = await createClient()

  const [usedResult, holidaysResult] = decoded
    ? await Promise.all([
        supabase.rpc('is_signed_hrga_request_used', { p_signature: signature }),
        supabase.rpc('get_public_hrga_holidays'),
      ])
    : [{ data: false }, { data: [] }]

  const isUsed = Boolean(usedResult?.data)
  const publicHolidayRows = Array.isArray(holidaysResult?.data) ? holidaysResult.data : []

  return (
    <main className={styles.page}>
      {!decoded ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>This request link is invalid or expired.</div>
        </div>
      ) : isUsed ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>This request has already been submitted and is currently being processed.</div>
        </div>
      ) : (
        <PublicRequestClient payload={payload} signature={signature} linkData={decoded} publicHolidayRows={publicHolidayRows} />
      )}
    </main>
  )
}
