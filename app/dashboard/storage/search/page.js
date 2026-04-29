'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()
const RACK_LOCATION_BATCH_SIZE = 1000

async function fetchAllRackLocations() {
  const allRows = []
  let from = 0

  while (true) {
    const to = from + RACK_LOCATION_BATCH_SIZE - 1
    const { data, error } = await supabase
      .from('dir_rack_locations')
      .select('id, location_type, location_id, location_code, sub_location')
      .order('location_type', { ascending: true })
      .order('location_id', { ascending: true })
      .order('location_code', { ascending: true })
      .order('sub_location', { ascending: true })
      .range(from, to)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      break
    }

    allRows.push(...data)

    if (data.length < RACK_LOCATION_BATCH_SIZE) {
      break
    }

    from += RACK_LOCATION_BATCH_SIZE
  }

  return allRows
}

export default function SearchStoragePage() {
  const [rackLocations, setRackLocations] = useState([])
  const [results, setResults] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadRackLocations() {
      setLoading(true)
      setError('')

      try {
        const rackData = await fetchAllRackLocations()
        const normalizedRackLocations = (rackData || []).map((item) => ({
          ...item,
          location_type: typeof item.location_type === 'string' ? item.location_type.trim() : item.location_type,
          location_id: typeof item.location_id === 'string' ? item.location_id.trim() : item.location_id,
          location_code: typeof item.location_code === 'string' ? item.location_code.trim() : item.location_code,
          sub_location: typeof item.sub_location === 'string' ? item.sub_location.trim() : item.sub_location,
        }))

        setRackLocations(normalizedRackLocations)
        setLoading(false)
      } catch (loadError) {
        setError(loadError.message || 'Failed to load storage search data.')
        setLoading(false)
      }
    }

    loadRackLocations()
  }, [])

  function getLocationLabel(rackLocationId) {
    const location = rackLocations.find((item) => item.id === rackLocationId)

    if (!location) {
      return '-'
    }

    return `${location.location_type} / ${location.location_id} / ${location.location_code} / ${location.sub_location}`
  }

  async function handleSearch(event) {
    event.preventDefault()
    setSearching(true)
    setError('')

    const searchTerm = query.trim()

    if (!searchTerm) {
      setResults([])
      setSearching(false)
      return
    }

    const { data, error: searchError } = await supabase
      .from('warehouse_storage')
      .select('id, rack_location_id, item_name, size, qty, notes, created_at')
      .ilike('item_name', `%${searchTerm}%`)
      .order('item_name', { ascending: true })
      .order('created_at', { ascending: false })

    if (searchError) {
      setError(searchError.message)
      setSearching(false)
      return
    }

    setResults(data || [])
    setSearching(false)
  }

  if (loading) {
    return <p style={styles.loading}>Loading storage search...</p>
  }

  return (
    <div style={styles.wrapper}>
      <div>
        <h1 style={styles.title}>Search Storage</h1>
        <p style={styles.subtitle}>
          Search a product name to see all warehouse locations where it is stored.
        </p>
      </div>

      <div style={styles.card}>
        <form onSubmit={handleSearch} style={styles.searchForm}>
          <div style={styles.field}>
            <label style={styles.label}>Product Name</label>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value.toUpperCase())}
              style={styles.input}
              placeholder="Search by product name"
            />
          </div>

          <div style={styles.actions}>
            <button type="submit" style={styles.button}>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {error ? <p style={styles.error}>{error}</p> : null}

        {!query.trim() ? (
          <div style={styles.emptyState}>
            <p style={{ margin: 0 }}>Enter a product name to search its locations.</p>
          </div>
        ) : results.length === 0 && !searching ? (
          <div style={styles.emptyState}>
            <p style={{ margin: 0 }}>No storage records found for that product.</p>
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Item</th>
                  <th style={styles.th}>Location</th>
                  <th style={styles.th}>Size</th>
                  <th style={styles.th}>Qty</th>
                  <th style={styles.th}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {results.map((entry) => (
                  <tr key={entry.id}>
                    <td style={styles.td}>{entry.item_name}</td>
                    <td style={styles.td}>{getLocationLabel(entry.rack_location_id)}</td>
                    <td style={styles.td}>{entry.size || '-'}</td>
                    <td style={styles.td}>{entry.qty}</td>
                    <td style={styles.td}>{entry.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  title: {
    margin: 0,
    fontSize: '30px',
  },
  subtitle: {
    marginTop: '8px',
    marginBottom: 0,
    color: '#6b7280',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  searchForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
  },
  input: {
    height: '44px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    padding: '0 12px',
    fontSize: '14px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  button: {
    height: '44px',
    padding: '0 18px',
    border: 'none',
    borderRadius: '10px',
    background: '#111827',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  error: {
    margin: 0,
    color: '#dc2626',
  },
  loading: {
    color: '#6b7280',
  },
  emptyState: {
    border: '1px dashed #d1d5db',
    borderRadius: '12px',
    padding: '24px',
    color: '#6b7280',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px 14px',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '13px',
  },
  td: {
    padding: '12px 14px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '14px',
    verticalAlign: 'top',
  },
}
