import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'
import { loadAccessContext } from '@/utils/access-control'

import DeliveryReportClient from './delivery-report-client'

export const metadata = {
  title: 'Delivery Report | Warehouse Management System',
}

export default async function DeliveryReportPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { isAdmin } = await loadAccessContext(supabase, user)

  if (!isAdmin) {
    redirect('/dashboard')
  }

  return <DeliveryReportClient />
}
