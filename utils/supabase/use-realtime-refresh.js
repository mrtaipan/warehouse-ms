'use client'

import { useEffect, useRef } from 'react'

export function useRealtimeRefresh({ supabase, topic, onRefresh, debounceMs = 500, paused = false, enabled = true }) {
  const refreshRef = useRef(onRefresh)
  const pausedRef = useRef(paused)
  const resumeRefreshRef = useRef(null)
  refreshRef.current = onRefresh

  useEffect(() => {
    const wasPaused = pausedRef.current
    pausedRef.current = paused

    if (wasPaused && !paused) {
      resumeRefreshRef.current?.()
    }
  }, [paused])

  useEffect(() => {
    if (!enabled) return undefined

    let channel = null
    let debounceTimer = null
    let disposed = false
    let hasSubscribed = false
    let refreshInFlight = false
    let refreshPending = false
    let refreshDeferred = false

    async function runRefresh() {
      if (disposed) return

      if (pausedRef.current) {
        refreshDeferred = true
        return
      }

      if (refreshInFlight) {
        refreshPending = true
        return
      }

      refreshInFlight = true

      try {
        await refreshRef.current()
      } catch {
        // Keep the existing page state when a background synchronization fails.
      } finally {
        refreshInFlight = false

        if (refreshPending && !disposed) {
          refreshPending = false
          scheduleRefresh()
        }
      }
    }

    function scheduleRefresh(delay = debounceMs) {
      if (disposed) return

      if (debounceTimer) {
        window.clearTimeout(debounceTimer)
      }

      debounceTimer = window.setTimeout(() => {
        debounceTimer = null
        void runRefresh()
      }, delay)
    }

    resumeRefreshRef.current = () => {
      if (!refreshDeferred) return

      refreshDeferred = false
      scheduleRefresh(0)
    }

    function syncWhenVisible() {
      if (document.visibilityState === 'visible') {
        scheduleRefresh(0)
      }
    }

    async function subscribe() {
      try {
        await supabase.realtime.setAuth()
      } catch {
        // The channel status will surface auth failures and retry after the session recovers.
      }

      if (disposed) return

      channel = supabase
        .channel(topic, { config: { private: true } })
        .on('broadcast', { event: 'changed' }, () => scheduleRefresh())
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') return

          if (hasSubscribed) {
            scheduleRefresh(0)
          }

          hasSubscribed = true
        })
    }

    void subscribe()
    window.addEventListener('focus', syncWhenVisible)
    window.addEventListener('online', syncWhenVisible)
    document.addEventListener('visibilitychange', syncWhenVisible)

    return () => {
      disposed = true
      resumeRefreshRef.current = null

      if (debounceTimer) {
        window.clearTimeout(debounceTimer)
      }

      window.removeEventListener('focus', syncWhenVisible)
      window.removeEventListener('online', syncWhenVisible)
      document.removeEventListener('visibilitychange', syncWhenVisible)

      if (channel) {
        void supabase.removeChannel(channel)
      }
    }
  }, [debounceMs, enabled, supabase, topic])
}
