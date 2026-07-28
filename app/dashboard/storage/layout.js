import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function StorageLayout({ children }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return children
}
