'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function PackingListItemStoringRedirectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const grn = searchParams.get('grn') || ''

  useEffect(() => {
    router.replace(`/mobile/packing-list/item-storing?grn=${encodeURIComponent(grn)}`)
  }, [grn, router])

  return null
}
