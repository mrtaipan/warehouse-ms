import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function TakeShortcutPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/restock-request')
  }

  redirect('/restock-request')
}
