import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import TakeRequestsMobile from '@/components/take-requests-mobile'

export default async function TakeRequestsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/take-requests')
  }

  return <TakeRequestsMobile />
}
