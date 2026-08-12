'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'
import { useRealtimeRefresh } from '@/utils/supabase/use-realtime-refresh'

const supabase = createClient()

export default function HumanResourcesAutoRefreshClient() {
  const router = useRouter()

  useRealtimeRefresh({
    supabase,
    topic: 'hr:dashboard',
    onRefresh: () => router.refresh(),
  })

  return null
}
