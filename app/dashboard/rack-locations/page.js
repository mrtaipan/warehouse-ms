import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import RackLocationsClient from './rack-locations-client'

export default async function RackLocationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('dir_rack_locations')
    .select('*')
    .order('location_id', { ascending: true })
    .order('location_type', { ascending: true })
    .order('location_code', { ascending: true })
    .order('sub_location', { ascending: true })

  return <RackLocationsClient rackLocations={data || []} loadError={error?.message || ''} />
}
