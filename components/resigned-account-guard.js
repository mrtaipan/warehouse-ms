'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'

const STATUS_CHECK_INTERVAL_MS = 30_000

export default function ResignedAccountGuard() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let hasSession = false
    let checking = false
    let stopped = false

    async function checkAccountStatus() {
      if (!hasSession || checking || stopped || document.visibilityState !== 'visible') return

      checking = true
      try {
        const response = await fetch('/api/account-status', { cache: 'no-store' })
        if (response.status !== 403) return

        const result = await response.json().catch(() => null)
        if (result?.reason !== 'resigned') return

        stopped = true
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        router.replace('/login?reason=inactive')
        router.refresh()
      } catch {
        // Keep the current session on transient network failures.
      } finally {
        checking = false
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      hasSession = Boolean(session)
      if (hasSession) window.setTimeout(checkAccountStatus, 0)
    })

    const intervalId = window.setInterval(checkAccountStatus, STATUS_CHECK_INTERVAL_MS)

    return () => {
      stopped = true
      window.clearInterval(intervalId)
      subscription.unsubscribe()
    }
  }, [router])

  return null
}
