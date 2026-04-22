import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'

async function toggleRackLocationStatus(formData) {
  'use server'

  const supabase = await createClient()
  const rackLocationId = formData.get('rackLocationId')
  const nextActiveValue = formData.get('nextActiveValue') === 'true'

  const { error } = await supabase
    .from('rack_locations')
    .update({ is_active: nextActiveValue })
    .eq('id', rackLocationId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/rack-locations')
}

export default async function RackLocationsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: rackLocations, error } = await supabase
    .from('rack_locations')
    .select('*')
    .order('location_type', { ascending: true })
    .order('location_id', { ascending: true })
    .order('location_code', { ascending: true })
    .order('sub_location', { ascending: true })

  return (
    <div>
      <h1 style={styles.title}>Rack Locations</h1>
      <p style={styles.subtitle}>List of rack location master data</p>

      <div style={{ marginBottom: '16px' }}>
        <Link href="/dashboard/rack-locations/new" style={styles.addButton}>
          + Add Rack Location
        </Link>
      </div>

      {error ? (
        <p style={styles.error}>Error: {error.message}</p>
      ) : rackLocations?.length === 0 ? (
        <div style={styles.emptyBox}>
          <p style={{ margin: 0 }}>No rack locations yet.</p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Warehouse Location</th>
                <th style={styles.th}>Pallet/Shelving Number</th>
                <th style={styles.th}>Carton Number</th>
                <th style={styles.th}>Active</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rackLocations.map((item) => (
                <tr key={item.id}>
                  <td style={styles.td}>{item.location_type}</td>
                  <td style={styles.td}>{item.location_id}</td>
                  <td style={styles.td}>{item.location_code}</td>
                  <td style={styles.td}>{item.sub_location}</td>
                  <td style={styles.td}>
                    <form action={toggleRackLocationStatus} style={styles.toggleForm}>
                      <input type="hidden" name="rackLocationId" value={item.id} />
                      <input
                        type="hidden"
                        name="nextActiveValue"
                        value={item.is_active ? 'false' : 'true'}
                      />
                      <button
                        type="submit"
                        style={styles.toggleButton}
                        aria-label={item.is_active ? 'Deactivate rack location' : 'Activate rack location'}
                      >
                        <span
                          style={{
                            ...styles.toggleTrack,
                            backgroundColor: item.is_active ? '#22c55e' : '#cbd5e1',
                          }}
                        >
                          <span
                            style={{
                              ...styles.toggleThumb,
                              transform: item.is_active ? 'translateX(20px)' : 'translateX(0)',
                            }}
                          />
                        </span>
                      </button>
                    </form>
                  </td>
                  <td style={styles.td}>
                    <Link href={`/dashboard/rack-locations/${item.id}`} style={styles.editButton}>
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const styles = {
  title: { marginTop: 0, marginBottom: '8px', fontSize: '28px' },
  subtitle: { marginTop: 0, marginBottom: '24px', color: '#6b7280' },
  error: { color: 'red' },
  emptyBox: { background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb' },
  tableWrap: { background: '#fff', borderRadius: '12px', overflowX: 'auto', border: '1px solid #e5e7eb' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '14px' },
  td: { padding: '14px', borderBottom: '1px solid #f1f5f9', fontSize: '14px', verticalAlign: 'middle' },
  addButton: { display: 'inline-block', padding: '10px 14px', background: '#111827', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600' },
  editButton: { display: 'inline-block', padding: '8px 12px', background: '#2563eb', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600' },
  toggleForm: { margin: 0 },
  toggleButton: { padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' },
  toggleTrack: { width: '44px', height: '24px', borderRadius: '999px', padding: '2px', display: 'flex', alignItems: 'center' },
  toggleThumb: { width: '20px', height: '20px', borderRadius: '999px', background: '#fff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)', transition: 'transform 0.2s ease' },
}
