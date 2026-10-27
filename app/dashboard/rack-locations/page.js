import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import RackLocationsClient from './rack-locations-client'

export default async function RackLocationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const pageSize = 1000
  const data = []
  let error = null
  for (let offset = 0; ; offset += pageSize) {
    const result = await supabase
      .from('dir_rack_locations')
      .select('*')
      .order('location_id', { ascending: true })
      .order('location_type', { ascending: true })
      .order('location_code', { ascending: true })
      .order('sub_location', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (result.error) {
      error = result.error
      break
    }
    data.push(...(result.data || []))
    if (!result.data || result.data.length < pageSize) break
  }

  return <RackLocationsClient rackLocations={data} loadError={error?.message || ''} />
}
