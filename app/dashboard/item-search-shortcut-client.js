'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/utils/supabase/browser'
import styles from './dashboard.module.css'

const supabase = createClient()
const LOCATION_CACHE_TTL_MS = 5 * 60 * 1000
const locationCache = new Map()

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function getLocationLabel(location = {}) {
  return [
    location.location_type,
    location.location_id,
    location.location_code,
    location.sub_location,
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(' / ') || 'Location is not found'
}

async function fetchLocationMapByIds(rackIds = []) {
  const uniqueIds = [...new Set(rackIds.filter(Boolean))]
  const locationMap = new Map()
  const missingIds = []
  const now = Date.now()

  uniqueIds.forEach((rackId) => {
    const cached = locationCache.get(rackId)

    if (cached && cached.expiresAt > now) {
      locationMap.set(rackId, cached.value)
      return
    }

    missingIds.push(rackId)
  })

  if (!missingIds.length) {
    return { data: locationMap, error: null }
  }

  const { data, error } = await supabase
    .from('dir_rack_locations')
    .select('id, location_type, location_id, location_code, sub_location, location_name')
    .in('id', missingIds)

  if (error) {
    return { data: locationMap, error }
  }

  ;(data || []).forEach((row) => {
    locationCache.set(row.id, {
      value: row,
      expiresAt: now + LOCATION_CACHE_TTL_MS,
    })
    locationMap.set(row.id, row)
  })

  return { data: locationMap, error: null }
}

export default function ItemSearchShortcutButton() {
  const portalRoot = typeof document === 'undefined' ? null : document.body
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
  const [hasSearched, setHasSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  function closeModal() {
    if (isSearching) return
    setIsOpen(false)
  }

  async function handleSearch(event) {
    event.preventDefault()
    const query = String(searchTerm || '').trim()

    setError('')
    setResults([])
    setHasSearched(true)

    if (!query) {
      setError('Type item name first.')
      return
    }

    setIsSearching(true)

    const { data: storageRows, error: storageError } = await supabase
      .from('warehouse_storage')
      .select('id, rack_location_id, item_name, size, qty')
      .ilike('item_name', `%${query}%`)
      .order('item_name', { ascending: true })
      .limit(25)

    if (storageError) {
      setError(storageError.message || 'Failed to search warehouse item.')
      setIsSearching(false)
      return
    }

    const rackIds = [...new Set((storageRows || []).map((row) => row.rack_location_id).filter(Boolean))]
    let locationMap = new Map()

    if (rackIds.length) {
      const { data: nextLocationMap, error: locationError } = await fetchLocationMapByIds(rackIds)

      if (locationError) {
        setError(locationError.message || 'Failed to load item locations.')
        setIsSearching(false)
        return
      }

      locationMap = nextLocationMap
    }

    setResults(
      (storageRows || []).map((row) => ({
        ...row,
        location: locationMap.get(row.rack_location_id) || null,
      }))
    )
    setIsSearching(false)
  }

  return (
    <>
      <button
        type="button"
        className={styles.heroProfileLink}
        onClick={() => setIsOpen(true)}
        aria-label="Open Item Search"
        title="Item Search"
      >
        <SearchIcon />
      </button>

      {isOpen && portalRoot ? createPortal(
        <div className={styles.itemSearchModalOverlay} role="presentation" onClick={closeModal}>
          <div
            className={styles.itemSearchModalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="warehouse-item-search-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.restockModalHeader}>
              <div>
                <p className={styles.restockModalEyebrow}>Warehouse</p>
                <h2 id="warehouse-item-search-title">Item Search</h2>
              </div>
              <button type="button" onClick={closeModal} className={styles.restockModalClose} disabled={isSearching}>
                Close
              </button>
            </div>

            <form onSubmit={handleSearch} className={styles.itemSearchModalForm}>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value.toUpperCase())}
                className={styles.itemSearchInput}
                placeholder="SEARCH ITEM NAME"
                autoComplete="off"
              />
              <button type="submit" className={styles.itemSearchButton} disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            {error ? <p className={styles.itemSearchError}>{error}</p> : null}

            {hasSearched && !error ? (
              results.length ? (
                <div className={styles.itemSearchResultList}>
                  {results.map((row) => (
                    <article key={row.id} className={styles.itemSearchResultCard}>
                      <div>
                        <strong>{row.item_name || '-'}</strong>
                        <span>Size {row.size || '-'} / Qty {row.qty || 0}</span>
                      </div>
                      <p>{getLocationLabel(row.location || {})}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.itemSearchEmpty}>Item is not found in warehouse storage.</p>
              )
            ) : null}
          </div>
        </div>,
        portalRoot
      ) : null}
    </>
  )
}
