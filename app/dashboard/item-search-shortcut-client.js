'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/utils/supabase/browser'
import styles from './dashboard.module.css'

const supabase = createClient()
const LOCATION_CACHE_TTL_MS = 5 * 60 * 1000
const STORAGE_GROUP_FILTERS = ['MOB', 'ARKLINE', 'OI']
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

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase()
}

function normalizeGroup(value) {
  const group = normalizeUpper(value)
  return STORAGE_GROUP_FILTERS.includes(group) ? group : 'MOB'
}

function getStorageRowGroup(row = {}) {
  return normalizeUpper(row.location?.group_code || row.group_code || '')
}

function matchesGroupFilter(row, groupFilter) {
  const group = normalizeGroup(groupFilter)
  return getStorageRowGroup(row) === group
}

function getSearchQuery(value) {
  return normalizeText(value)
    .replace(/[%,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getArklineProductLabel(product) {
  return [product.sku, product.name].filter(Boolean).join(' ')
}

async function fetchArklineProducts() {
  const pageSize = 500
  const products = []

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('arkline_dir_products')
      .select('sku_induk, nama_produk, is_active')
      .order('nama_produk', { ascending: true })
      .order('sku_induk', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    products.push(...(data || []))
    if ((data || []).length < pageSize) break
  }

  const uniqueProducts = new Map()
  products.forEach((row) => {
    const sku = normalizeUpper(row.sku_induk)
    const name = normalizeText(row.nama_produk)
    if (row.is_active === false || (!sku && !name)) return
    const key = sku || name.toUpperCase()
    if (!uniqueProducts.has(key)) uniqueProducts.set(key, { sku, name })
  })

  return [...uniqueProducts.values()]
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
    .select('id, location_type, location_id, location_code, sub_location, location_name, group_code')
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

async function fetchStorageRowsByQuery(query, limit = 80, exactSku = false) {
  const normalizedQuery = getSearchQuery(query)

  if (!normalizedQuery) {
    return { rows: [], error: null }
  }

  let storageQuery = supabase
    .from('warehouse_storage')
    .select('id, rack_location_id, sku_id, item_name, size, qty')

  storageQuery = exactSku
    ? storageQuery.ilike('sku_id', normalizedQuery)
    : storageQuery.or(`item_name.ilike.%${normalizedQuery}%,sku_id.ilike.%${normalizedQuery}%`)

  const { data: storageRows, error: storageError } = await storageQuery
    .order('item_name', { ascending: true })
    .limit(limit)

  if (storageError) {
    return { rows: [], error: storageError }
  }

  const rackIds = [...new Set((storageRows || []).map((row) => row.rack_location_id).filter(Boolean))]
  let locationMap = new Map()

  if (rackIds.length) {
    const { data: nextLocationMap, error: locationError } = await fetchLocationMapByIds(rackIds)

    if (locationError) {
      return { rows: [], error: locationError }
    }

    locationMap = nextLocationMap
  }

  return {
    rows: (storageRows || []).map((row) => ({
      ...row,
      location: locationMap.get(row.rack_location_id) || null,
    })),
    error: null,
  }
}

export default function ItemSearchShortcutButton() {
  const portalRoot = typeof document === 'undefined' ? null : document.body
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sizeFilter, setSizeFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('MOB')
  const [results, setResults] = useState([])
  const [arklineProducts, setArklineProducts] = useState([])
  const [arklineProductsLoaded, setArklineProductsLoaded] = useState(false)
  const [arklineProductsLoading, setArklineProductsLoading] = useState(false)
  const [arklineProductsError, setArklineProductsError] = useState('')
  const [isArklineDropdownOpen, setIsArklineDropdownOpen] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState('')

  const groupFilteredResults = useMemo(
    () => results.filter((row) => matchesGroupFilter(row, groupFilter)),
    [groupFilter, results]
  )

  const sizeOptions = useMemo(() => {
    return Array.from(new Set(groupFilteredResults.map((row) => normalizeUpper(row.size)).filter(Boolean)))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
  }, [groupFilteredResults])

  const activeSizeFilter = sizeOptions.includes(normalizeUpper(sizeFilter)) ? normalizeUpper(sizeFilter) : ''

  const visibleResults = useMemo(() => {
    return groupFilteredResults.filter((row) => !activeSizeFilter || normalizeUpper(row.size) === activeSizeFilter)
  }, [activeSizeFilter, groupFilteredResults])

  const filteredArklineProducts = useMemo(() => {
    const query = normalizeUpper(searchTerm)
    return arklineProducts.filter((product) => !query || normalizeUpper(getArklineProductLabel(product)).includes(query))
  }, [arklineProducts, searchTerm])
  const shouldShowArklineDropdown = isOpen && groupFilter === 'ARKLINE' && isArklineDropdownOpen

  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  async function loadArklineProducts() {
    if (arklineProductsLoaded || arklineProductsLoading) return

    setArklineProductsLoading(true)
    setArklineProductsError('')

    try {
      const products = await fetchArklineProducts()
      setArklineProducts(products)
      setArklineProductsLoaded(true)
    } catch (productError) {
      setArklineProductsError(productError.message || 'Failed to load Arkline products.')
    } finally {
      setArklineProductsLoading(false)
    }
  }

  function resetSearchState() {
    setSearchTerm('')
    setSizeFilter('')
    setGroupFilter('MOB')
    setResults([])
    setIsArklineDropdownOpen(false)
    setHasSearched(false)
    setError('')
  }

  function closeModal() {
    if (isSearching) return
    setIsOpen(false)
    resetSearchState()
  }

  async function executeSearch(queryValue = searchTerm, exactSku = false) {
    const query = getSearchQuery(queryValue)
    setError('')
    setResults([])
    setIsArklineDropdownOpen(false)
    setHasSearched(true)

    if (!query) {
      setError('Type item name or SKU first.')
      return
    }

    setIsSearching(true)

    const { rows, error: storageError } = await fetchStorageRowsByQuery(query, 80, exactSku)

    if (storageError) {
      setError(storageError.message || 'Failed to search warehouse item.')
      setIsSearching(false)
      return
    }

    setResults(rows)
    setIsSearching(false)
  }

  async function handleSearch(event) {
    event.preventDefault()
    const selectedProduct = groupFilter === 'ARKLINE'
      ? arklineProducts.find((product) => getArklineProductLabel(product) === searchTerm)
      : null
    await executeSearch(selectedProduct?.sku || selectedProduct?.name || searchTerm, Boolean(selectedProduct?.sku))
  }

  function handleSearchTermChange(event) {
    const nextSearchTerm = event.target.value.toUpperCase()
    setSearchTerm(nextSearchTerm)
    if (groupFilter === 'ARKLINE') setIsArklineDropdownOpen(true)
    setError('')

    if (hasSearched) {
      setResults([])
      setSizeFilter('')
      setHasSearched(false)
    }
  }

  function handleGroupFilterChange(nextGroup) {
    const group = normalizeGroup(nextGroup)
    setGroupFilter(group)
    setSearchTerm('')
    setResults([])
    setSizeFilter('')
    setHasSearched(false)
    setIsArklineDropdownOpen(false)
    setError('')
    if (group === 'ARKLINE') void loadArklineProducts()
  }

  async function handleArklineProductSelect(product) {
    setSearchTerm(getArklineProductLabel(product))
    setIsArklineDropdownOpen(false)
    await executeSearch(product.sku || product.name, Boolean(product.sku))
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
                <div className={styles.itemSearchTitleRow}>
                  <h2 id="warehouse-item-search-title">Item Search</h2>
                  <div className={styles.itemSearchGroupToggle} aria-label="Warehouse group filter">
                    {STORAGE_GROUP_FILTERS.map((group) => (
                      <button
                        key={group}
                        type="button"
                        className={groupFilter === group ? styles.itemSearchGroupButtonActive : styles.itemSearchGroupButton}
                        onClick={() => handleGroupFilterChange(group)}
                        disabled={isSearching}
                      >
                        {group === 'ARKLINE' ? 'Arkline' : group}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="button" onClick={closeModal} className={styles.restockModalClose} disabled={isSearching}>
                Close
              </button>
            </div>

            <form onSubmit={handleSearch} className={styles.itemSearchModalForm}>
              <div className={styles.itemSearchCombobox}>
                <input
                  value={searchTerm}
                  onChange={handleSearchTermChange}
                  onFocus={() => {
                    if (groupFilter === 'ARKLINE') setIsArklineDropdownOpen(true)
                  }}
                  onBlur={() => window.setTimeout(() => setIsArklineDropdownOpen(false), 120)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setIsArklineDropdownOpen(false)
                  }}
                  className={styles.itemSearchInput}
                  placeholder={groupFilter === 'ARKLINE' ? 'TYPE OR CHOOSE AN ARKLINE PRODUCT' : 'TYPE SKU OR PRODUCT'}
                  autoComplete="off"
                  role={groupFilter === 'ARKLINE' ? 'combobox' : undefined}
                  aria-autocomplete={groupFilter === 'ARKLINE' ? 'list' : undefined}
                  aria-expanded={groupFilter === 'ARKLINE' ? shouldShowArklineDropdown : undefined}
                  aria-controls={groupFilter === 'ARKLINE' ? 'item-search-arkline-options' : undefined}
                />
                {shouldShowArklineDropdown ? (
                  <div id="item-search-arkline-options" className={styles.itemSearchDropdown} role="listbox">
                    {arklineProductsLoading ? (
                      <p>Loading Arkline products...</p>
                    ) : arklineProductsError ? (
                      <p>{arklineProductsError}</p>
                    ) : filteredArklineProducts.length ? (
                      filteredArklineProducts.map((product) => (
                        <button
                          key={product.sku || product.name}
                          type="button"
                          className={styles.itemSearchSuggestion}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleArklineProductSelect(product)}
                          role="option"
                          aria-selected="false"
                        >
                          <strong>{product.sku || '-'}</strong>
                          <span>{product.name || '-'}</span>
                        </button>
                      ))
                    ) : (
                      <p>No matching Arkline product found.</p>
                    )}
                  </div>
                ) : null}
              </div>
              <button type="submit" className={styles.itemSearchButton} disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className={styles.itemSearchFilterBar}>
              <label className={styles.itemSearchSizeFilter}>
                <span>Size</span>
                <select
                  value={activeSizeFilter}
                  onChange={(event) => setSizeFilter(event.target.value)}
                  disabled={!sizeOptions.length || isSearching}
                >
                  <option value="">All sizes</option>
                  {sizeOptions.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
            </div>

            {error ? <p className={styles.itemSearchError}>{error}</p> : null}

            {hasSearched && !error ? (
              visibleResults.length ? (
                <div className={styles.itemSearchResultList}>
                  {visibleResults.map((row) => (
                    <article key={row.id} className={styles.itemSearchResultCard}>
                      <div>
                        <strong>{row.item_name || '-'}</strong>
                        <span>{row.sku_id || 'NO SKU'} / Size {row.size || '-'} / Qty {row.qty || 0}</span>
                      </div>
                      <div className={styles.itemSearchLocationBlock}>
                        <span>{getStorageRowGroup(row) || '-'}</span>
                        <p>{getLocationLabel(row.location || {})}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.itemSearchEmpty}>Item is not found in the selected warehouse filter.</p>
              )
            ) : null}
          </div>
        </div>,
        portalRoot
      ) : null}
    </>
  )
}
