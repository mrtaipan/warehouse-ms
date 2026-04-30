import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import RestockRequestSubmit from '@/components/restock-request-submit'

export default async function RestockRequestPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/restock-request')
  }

  return (
    <RestockRequestSubmit
      showPickerLink={true}
      pickerHref="/take-requests"
      pickerLabel="Open Picker"
      title="Restock Request"
      subtitle=""
      showBackToStorage={true}
    />
  )
}
