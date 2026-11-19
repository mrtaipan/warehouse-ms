import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import PackagingScanClient from '@/components/packaging-scan-client'

export default async function PackagingScanPage({ params }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/packaging/${id}`)}`)
  return <PackagingScanClient itemId={id} />
}
