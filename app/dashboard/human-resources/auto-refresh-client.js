'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HumanResourcesAutoRefreshClient({ intervalMs = 45000 }) {
  const router = useRouter()

  useEffect(() => {
    let timerId = null

    function scheduleRefresh() {
      if (timerId) {
        window.clearInterval(timerId)
      }

      timerId = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          router.refresh()
        }
      }, intervalMs)
    }

    scheduleRefresh()

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (timerId) {
        window.clearInterval(timerId)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [intervalMs, router])

  return null
}
