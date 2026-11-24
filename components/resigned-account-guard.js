'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'

const STATUS_CHECK_INTERVAL_MS = 600_000

export default function ResignedAccountGuard() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let hasSession = false
    let checking = false
    let stopped = false
    let timerId = null
    let currentUserId = null

    function clearTimer() {
      window.clearTimeout(timerId)
      timerId = null
    }

    function scheduleCheck(delay = STATUS_CHECK_INTERVAL_MS) {
      clearTimer()
      if (!hasSession || stopped || document.visibilityState !== 'visible') return
      timerId = window.setTimeout(checkAccountStatus, delay)
    }

    async function checkAccountStatus() {
      if (!hasSession || checking || stopped || document.visibilityState !== 'visible') return

      checking = true
      clearTimer()
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
        scheduleCheck()
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id || null
      const userChanged = nextUserId !== currentUserId
      currentUserId = nextUserId
      hasSession = Boolean(session)
      if (!hasSession) clearTimer()
      else if (userChanged) scheduleCheck(0)
    })

    function handleVisibilityChange() {
      clearTimer()
      if (document.visibilityState === 'visible') void checkAccountStatus()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopped = true
      clearTimer()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      subscription.unsubscribe()
    }
  }, [router])

  return null
}
