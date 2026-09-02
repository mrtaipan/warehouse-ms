'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'
import { ADMIN_EMAIL, getStorageFeatureAccess, resolveRole } from '@/utils/permissions'
import { getRolePermissionCodes } from '@/utils/role-permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import { useRealtimeRefresh } from '@/utils/supabase/use-realtime-refresh'
import ProductDirectoryClient from '../daftar-barang/product-directory-client'

const supabase = createClient()
const BATCH_SIZE = 1000
const STOCK_PAGE_SIZE = 25
const QUEUE_PAGE_SIZE = 25
const STORAGE_DATA_CACHE_TTL_MS = 15 * 1000
const STORAGE_STATIC_CACHE_TTL_MS = 5 * 60 * 1000
const STORAGE_GROUP_FILTERS = ['ARKLINE', 'MOB', 'OI']
const WAREHOUSE_STORAGE_SELECT_COLUMNS = 'id, rack_location_id, sku_id, item_name, size, qty, notes, created_at, updated_at'
const warehouseStorageCache = { rows: null, expiresAt: 0 }
const staticStorageCache = new Map()
const naturalSort = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})
const letterSizeRanks = new Map(
  ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL'].map((size, index) => [size, index])
)

function normalizeFilterValue(value) {
  return String(value || '').trim().toUpperCase()
}

function sortStorageEntries(rows = []) {
  return [...rows].sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))
}

function setWarehouseStorageCache(rows = []) {
  warehouseStorageCache.rows = sortStorageEntries(rows)
  warehouseStorageCache.expiresAt = Date.now() + STORAGE_DATA_CACHE_TTL_MS
  return warehouseStorageCache.rows
}

function mergeWarehouseStorageRows(currentRows = [], nextRows = []) {
  const rowsById = new Map(currentRows.map((row) => [String(row.id), row]))

  nextRows.forEach((row) => {
    if (!row?.id) return
    rowsById.set(String(row.id), row)
  })

  return setWarehouseStorageCache(Array.from(rowsById.values()))
}

async function readStaticStorageCache(key, loader) {
  const cached = staticStorageCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const value = await loader()
  staticStorageCache.set(key, {
    value,
    expiresAt: Date.now() + STORAGE_STATIC_CACHE_TTL_MS,
  })
  return value
}

function normalizeSizeValue(value) {
  return normalizeFilterValue(value).replace(/\s+/g, '')
}

function getSizeSortRank(value) {
  const normalizedSize = normalizeSizeValue(value)
  const numericSize = Number(normalizedSize)

  if (normalizedSize && Number.isFinite(numericSize) && String(numericSize) === normalizedSize) {
    return { group: 0, value: numericSize, label: normalizedSize }
  }

  if (letterSizeRanks.has(normalizedSize)) {
    return { group: 1, value: letterSizeRanks.get(normalizedSize), label: normalizedSize }
  }

  const repeatedXlMatch = normalizedSize.match(/^X{2,}L$/)

  if (repeatedXlMatch) {
    return { group: 1, value: 4 + normalizedSize.length - 2, label: normalizedSize }
  }

  const numberedXlMatch = normalizedSize.match(/^(\d+)XL$/)

  if (numberedXlMatch) {
    return { group: 1, value: 4 + Number(numberedXlMatch[1] || 0), label: normalizedSize }
  }

  return { group: 2, value: Number.MAX_SAFE_INTEGER, label: normalizedSize }
}

function compareSizeValues(left, right) {
  const leftRank = getSizeSortRank(left)
  const rightRank = getSizeSortRank(right)

  if (leftRank.group !== rightRank.group) {
    return leftRank.group - rightRank.group
  }

  if (leftRank.value !== rightRank.value) {
    return leftRank.value - rightRank.value
  }

  return naturalSort.compare(leftRank.label, rightRank.label)
}

function storageEntryMatchesProductSearch(entry = {}, normalizedProductSearch = '') {
  if (!normalizedProductSearch) {
    return true
  }

  const location = entry.location || {}

  return [
    entry.item_name,
    entry.sku_id,
    location.location_type,
    location.location_id,
    location.location_code,
    location.sub_location,
    location.location_name,
    location.group_code,
  ]
    .map((value) => normalizeFilterValue(value))
    .some((value) => value.includes(normalizedProductSearch))
}

function formatTakeFromLabel(value) {
  const label = String(value || '').trim()

  if (!label) {
    return 'Location is not found'
  }

  const registeredLocationMatch = label.match(/^(\d+)\s+lokasi\s+(tercatat|terdata)(.*)$/i)

  if (registeredLocationMatch) {
    const count = Number(registeredLocationMatch[1] || 0)
    const suffix = registeredLocationMatch[3] || ''

    return `${count} Registered Location${count === 1 ? '' : 's'}${suffix}`
  }

  if (/^lokasi\s+(belum|tidak)\s+terdata$/i.test(label) || /^location\s+(is\s+)?(not\s+recorded|not\s+found)$/i.test(label)) {
    return 'Location is not found'
  }

  return label
}

function getQueueItemName(row = {}) {
  const modelParts = [row.model_name, row.variant_name].map((part) => String(part || '').trim()).filter(Boolean)
  return String(row.pl_name || '').trim() || modelParts.join(' ') || 'Unknown item'
}

function getQueueKoliLabel(row = {}) {
  if (row.package_type === 'PHOTO') {
    return 'Photo'
  }

  return `Koli ${row.koli_sequence || '-'}`
}

function getQueueGroupKey(row = {}) {
  return (
    String(row.packing_group_key || '').trim() ||
    [
      row.inbound_id,
      row.storing_type,
      row.package_type,
      row.brand_code,
      row.koli_sequence || 'photo',
    ]
      .map((part) => String(part || '').trim())
      .join('::')
  )
}

function getSkuList(rows = []) {
  return Array.from(
    new Set(rows.map((row) => getQueueItemSku(row)).filter(Boolean))
  )
}

function getQueueItemSku(row = {}) {
  return String(
    row.resolved_sku ||
    row.source_variant_code ||
    row.breakdown_source_variant_code ||
    row.variant_code ||
    row.variant_label ||
    ''
  ).trim()
}

function getQueueGroupItemsLabel(rows = []) {
  const names = Array.from(new Set(rows.map((row) => getQueueItemName(row)).filter(Boolean)))

  if (names.length <= 2) {
    return names.join(', ') || 'Unknown item'
  }

  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
}

function getQueueGroupSizeLabel(rows = []) {
  return Array.from(new Set(rows.map((row) => String(row.size_label || '').trim()).filter(Boolean))).join(', ') || '-'
}

function getLocationStorageGroup(location = {}) {
  return normalizeFilterValue(location.group_code || '')
}

function formatStoredQueueItemName(value = '', grnNumber = '') {
  const itemName = String(value || '').trim().toUpperCase()
  const normalizedGrn = String(grnNumber || '').trim().toUpperCase()

  if (!itemName) {
    return normalizedGrn ? `${normalizedGrn} UNKNOWN ITEM` : 'UNKNOWN ITEM'
  }

  if (!normalizedGrn || itemName.startsWith(`${normalizedGrn} `)) {
    return itemName
  }

  return `${normalizedGrn} ${itemName}`
}

function normalizeArklineProduct(row) {
  const sku = String(row?.sku_induk || '').trim().toUpperCase()
  const productName = String(row?.nama_produk || '').trim().toUpperCase()

  return {
    sku,
    productName,
    label: sku && productName ? `${sku} | ${productName}` : sku || productName,
    isActive: row?.is_active !== false,
  }
}

async function fetchActiveArklineProducts() {
  return readStaticStorageCache('arkline-products', async () => {
    const { data, error } = await supabase
      .from('arkline_dir_products')
      .select('sku_induk, nama_produk, is_active')
      .eq('is_active', true)
      .order('nama_produk', { ascending: true })

    if (error) {
      throw error
    }

    return (data || [])
      .map(normalizeArklineProduct)
      .filter((item) => item.isActive && item.sku && item.productName)
  })
}

async function fetchAllRackLocations() {
  return readStaticStorageCache('rack-locations', async () => {
    const allRows = []
    let from = 0

    while (true) {
      const to = from + BATCH_SIZE - 1
      const { data, error } = await supabase
        .from('dir_rack_locations')
        .select('id, location_type, location_id, location_code, sub_location, location_name, group_code')
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

      if (data.length < BATCH_SIZE) {
        break
      }

      from += BATCH_SIZE
    }

    return allRows
  })
}

async function fetchAllWarehouseStorage({ force = false } = {}) {
  if (!force && warehouseStorageCache.rows && warehouseStorageCache.expiresAt > Date.now()) {
    return warehouseStorageCache.rows
  }

  const allRows = []
  let from = 0

  while (true) {
    const to = from + BATCH_SIZE - 1
    const { data, error } = await supabase
      .from('warehouse_storage')
      .select(WAREHOUSE_STORAGE_SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      break
    }

    allRows.push(...data)

    if (data.length < BATCH_SIZE) {
      break
    }

    from += BATCH_SIZE
  }

  return setWarehouseStorageCache(allRows)
}

async function fetchAllRestockHistory() {
  const { data, error } = await supabase
    .from('restock_request')
    .select('id, requester_name, item_name, size, qty, take_from, search_term, request_status, completed_by, created_at, completed_at')
    .order('completed_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    throw error
  }

  return data || []
}

async function fetchAllStorageQueueRows() {
  const allRows = []
  let from = 0

  while (true) {
    const to = from + BATCH_SIZE - 1
    const { data, error } = await supabase
      .from('pl_packing_items')
      .select('id, inbound_id, pl_size_breakdown_id, product_model_variant_id, packing_group_key, storing_type, package_type, brand_code, source_variant_code, pl_name, model_name, variant_name, size_label, koli_sequence, qty, packed_by, storage_status, created_at')
      .eq('storage_status', 'queued')
      .eq('package_type', 'REGULAR')
      .order('created_at', { ascending: false })
      .order('koli_sequence', { ascending: true })
      .range(from, to)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      break
    }

    allRows.push(...data)

    if (data.length < BATCH_SIZE) {
      break
    }

    from += BATCH_SIZE
  }

  return allRows
}

async function fetchAllPlSizeBreakdownRows() {
  return readStaticStorageCache('pl-size-breakdown-identities', async () => {
    const allRows = []
    let from = 0

    while (true) {
      const to = from + BATCH_SIZE - 1
      const { data, error } = await supabase
        .from('pl_size_breakdown')
        .select('id, product_model_variant_id, source_variant_code')
        .order('id', { ascending: true })
        .range(from, to)

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        break
      }

      allRows.push(...data)

      if (data.length < BATCH_SIZE) {
        break
      }

      from += BATCH_SIZE
    }

    return allRows
  })
}

async function fetchAllProductVariantRows() {
  return readStaticStorageCache('product-variants-storage-lookup', async () => {
    const allRows = []
    let from = 0

    while (true) {
      const to = from + BATCH_SIZE - 1
      const { data, error } = await supabase
        .from('dir_product_model_variants')
        .select('id, variant_code, variant_name, selling_name')
        .order('id', { ascending: true })
        .range(from, to)

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        break
      }

      allRows.push(...data)

      if (data.length < BATCH_SIZE) {
        break
      }

      from += BATCH_SIZE
    }

    return allRows
  })
}

async function fetchInboundSummaries() {
  return readStaticStorageCache('inbound-summaries', async () => {
    const allRows = []
    let from = 0

    while (true) {
      const to = from + BATCH_SIZE - 1
      const { data, error } = await supabase
        .from('inbound')
        .select('id, grn_number, item_name, inbound_date')
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        break
      }

      allRows.push(...data)

      if (data.length < BATCH_SIZE) {
        break
      }

      from += BATCH_SIZE
    }

    return allRows
  })
}

async function fetchBrandDirectory() {
  return readStaticStorageCache('brand-directory', async () => {
    const { data, error } = await supabase
      .from('dir_brands')
      .select('id, brand_code, brand_name, is_active')
      .order('brand_name', { ascending: true })

    if (error) {
      throw error
    }

    return data || []
  })
}

async function fetchUserProfilesByEmail() {
  return readStaticStorageCache('user-profiles-by-email', async () => {
    const { data, error } = await supabase
      .from('dir_user_profiles')
      .select('email, display_name')

    if (error) {
      throw error
    }

    return (data || []).reduce((result, row) => {
      const email = String(row.email || '').trim().toLowerCase()

      if (email) {
        result[email] = String(row.display_name || '').trim()
      }

      return result
    }, {})
  })
}

const EMPTY_STORAGE_ACCESS = {
  menu: false,
  location: false,
  locationAdd: false,
  locationEdit: false,
  queue: false,
  queueEdit: false,
  pickHistory: false,
  productDirectory: false,
  productDirectoryAdd: false,
  productDirectoryEdit: false,
  warehouseMap: false,
  brandLookup: false,
}

async function fetchCurrentStorageAccess() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return EMPTY_STORAGE_ACCESS
  }

  const emailAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL
  const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, 'role')
  const role = resolveRole(profile?.role, emailAdmin)
  const isAdmin = emailAdmin || role === 'admin'
  const { data: rolePermissions } = isAdmin
    ? { data: [] }
    : await getRolePermissionCodes(supabase, role)

  return getStorageFeatureAccess(role, rolePermissions || [], isAdmin)
}

async function getCurrentUserEmail() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.email || null
}

export default function StorageOverviewPage() {
  const searchParams = useSearchParams()
  const initialMode = String(searchParams.get('mode') || '').trim().toLowerCase()
  const initialListMode = ['history', 'queue', 'product-directory'].includes(initialMode) ? initialMode : 'stock'
  const initialRegisterOpen = searchParams.get('register') === '1'
  const initialProductSearch = String(searchParams.get('q') || searchParams.get('search') || '').trim().toUpperCase()
  const [rackLocations, setRackLocations] = useState([])
  const [storageEntries, setStorageEntries] = useState([])
  const [restockHistoryRows, setRestockHistoryRows] = useState([])
  const [storageQueueRows, setStorageQueueRows] = useState([])
  const [inboundRows, setInboundRows] = useState([])
  const [arklineProducts, setArklineProducts] = useState([])
  const [brandRows, setBrandRows] = useState([])
  const [userProfilesByEmail, setUserProfilesByEmail] = useState({})
  const [loading, setLoading] = useState(true)
  const [taking, setTaking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [moving, setMoving] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [storingQueue, setStoringQueue] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [takeModalError, setTakeModalError] = useState('')
  const [moveModalError, setMoveModalError] = useState('')
  const [queueModalError, setQueueModalError] = useState('')
  const [storageAccess, setStorageAccess] = useState(EMPTY_STORAGE_ACCESS)
  const [takeModalEntry, setTakeModalEntry] = useState(null)
  const [editModalEntry, setEditModalEntry] = useState(null)
  const [moveModalEntry, setMoveModalEntry] = useState(null)
  const [queueModalEntry, setQueueModalEntry] = useState(null)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(initialRegisterOpen)
  const [isRegisterLocationCodeMenuOpen, setIsRegisterLocationCodeMenuOpen] = useState(false)
  const [isMoveLocationCodeMenuOpen, setIsMoveLocationCodeMenuOpen] = useState(false)
  const [isRegisterArklineProductMenuOpen, setIsRegisterArklineProductMenuOpen] = useState(false)
  const [isBrandLookupOpen, setIsBrandLookupOpen] = useState(false)
  const [isCompactLayout, setIsCompactLayout] = useState(false)
  const [activeListMode, setActiveListMode] = useState(initialListMode)
  const [stockPage, setStockPage] = useState(1)
  const [queuePage, setQueuePage] = useState(1)
  const [productSearch, setProductSearch] = useState(initialProductSearch)
  const [brandLookupSearch, setBrandLookupSearch] = useState('')
  const [historyPickerFilter, setHistoryPickerFilter] = useState('')
  const [queueFilters, setQueueFilters] = useState({
    group: '',
    grn: '',
  })
  const [takeForm, setTakeForm] = useState({
    takeOutAll: false,
    qty: '',
  })
  const [editForm, setEditForm] = useState({
    itemName: '',
    size: '',
    qty: '',
    notes: '',
  })
  const [moveForm, setMoveForm] = useState({
    locationType: '',
    locationId: '',
    locationCode: '',
    subLocation: '',
  })
  const [registerForm, setRegisterForm] = useState({
    locationType: '',
    locationId: '',
    locationCode: '',
    subLocation: '',
    itemName: '',
    size: '',
    qty: '',
    notes: '',
  })
  const [queueForm, setQueueForm] = useState({
    locationType: 'PALLET',
    locationId: '',
    locationCode: '',
    subLocation: '',
    notes: '',
  })
  const [filters, setFilters] = useState({
    locationType: 'PALLET',
    groupCode: '',
    locationId: '',
    locationCode: '',
    locationName: '',
    subLocation: '',
    size: '',
  })

  const refreshInventoryData = useCallback(async ({ showLoading = false, forceStorage = false } = {}) => {
    if (showLoading) {
      setLoading(true)
    }

    try {
      const [rackData, storageData, restockRows, queueRows, breakdownRows, variantRows, inboundData, arklineProductRows, brandData, profileRows] = await Promise.all([
        fetchAllRackLocations(),
        fetchAllWarehouseStorage({ force: forceStorage }),
        fetchAllRestockHistory(),
        fetchAllStorageQueueRows(),
        fetchAllPlSizeBreakdownRows(),
        fetchAllProductVariantRows(),
        fetchInboundSummaries(),
        fetchActiveArklineProducts(),
        fetchBrandDirectory(),
        fetchUserProfilesByEmail(),
      ])

      const normalizedRackLocations = (rackData || []).map((item) => ({
        ...item,
        location_type: typeof item.location_type === 'string' ? item.location_type.trim() : item.location_type,
        location_id: typeof item.location_id === 'string' ? item.location_id.trim() : item.location_id,
        location_code: typeof item.location_code === 'string' ? item.location_code.trim() : item.location_code,
        sub_location: typeof item.sub_location === 'string' ? item.sub_location.trim() : item.sub_location,
        location_name: typeof item.location_name === 'string' ? item.location_name.trim() : item.location_name,
        group_code: typeof item.group_code === 'string' ? item.group_code.trim() : item.group_code,
      }))
      const breakdownById = new Map((breakdownRows || []).map((item) => [Number(item.id), item]))
      const variantById = new Map((variantRows || []).map((item) => [Number(item.id), item]))
      const normalizedQueueRows = (queueRows || []).map((row) => {
        const breakdown = breakdownById.get(Number(row.pl_size_breakdown_id || 0)) || {}
        const variant = variantById.get(Number(row.product_model_variant_id || breakdown.product_model_variant_id || 0)) || {}
        const resolvedSku = String(
          row.source_variant_code ||
          breakdown.source_variant_code ||
          variant.variant_code ||
          variant.variant_name ||
          variant.selling_name ||
          ''
        ).trim()

        return {
          ...row,
          product_model_variant_id: row.product_model_variant_id || breakdown.product_model_variant_id || null,
          breakdown_source_variant_code: breakdown.source_variant_code || '',
          variant_code: variant.variant_code || '',
          variant_name: variant.variant_name || '',
          resolved_sku: resolvedSku,
        }
      })

      setRackLocations(normalizedRackLocations)
      setStorageEntries(storageData || [])
      setRestockHistoryRows(restockRows || [])
      setStorageQueueRows(normalizedQueueRows)
      setInboundRows(inboundData || [])
      setArklineProducts(arklineProductRows || [])
      setBrandRows(brandData || [])
      setUserProfilesByEmail(profileRows || {})
      setLoading(false)
    } catch (loadError) {
      if (showLoading) {
        setError(loadError.message || 'Failed to load storage overview.')
      }
      setLoading(false)
    }
  }, [])

  const refreshStorageAccess = useCallback(async () => {
    try {
      const access = await fetchCurrentStorageAccess()
      setStorageAccess(access || EMPTY_STORAGE_ACCESS)
    } catch {
      setStorageAccess(EMPTY_STORAGE_ACCESS)
    }
  }, [])

  useEffect(() => {
    const initialRefreshId = window.setTimeout(() => {
      refreshStorageAccess()
      refreshInventoryData({ showLoading: true })
    }, 0)

    return () => window.clearTimeout(initialRefreshId)
  }, [refreshInventoryData, refreshStorageAccess])

  useEffect(() => {
    function updateLayoutMode() {
      setIsCompactLayout(window.innerWidth < 1180)
    }

    updateLayoutMode()
    window.addEventListener('resize', updateLayoutMode)

    return () => window.removeEventListener('resize', updateLayoutMode)
  }, [])

  useRealtimeRefresh({
    supabase,
    topic: 'warehouse:storage',
    onRefresh: () => refreshInventoryData({ forceStorage: true }),
    debounceMs: 3000,
  })

  const locationById = useMemo(
    () => new Map(rackLocations.map((item) => [item.id, item])),
    [rackLocations]
  )

  const storageRows = useMemo(
    () =>
      storageEntries
        .map((entry) => ({
          ...entry,
          location: locationById.get(entry.rack_location_id) || null,
        }))
        .filter((entry) => entry.location),
    [locationById, storageEntries]
  )
  const canRegisterStorageItem = Boolean(storageAccess.locationAdd)
  const canEditStorageItem = Boolean(storageAccess.locationEdit)
  const canTakeStorageItem = Boolean(storageAccess.locationEdit)
  const canMoveStorageItem = Boolean(storageAccess.locationEdit)
  const canStoreQueueItem = Boolean(storageAccess.queueEdit)
  const canManageProductDirectory = Boolean(storageAccess.productDirectoryAdd || storageAccess.productDirectoryEdit)
  const canShowStorageLocationActions = canEditStorageItem || canTakeStorageItem || canMoveStorageItem
  const storageTabItems = useMemo(
    () => [
      storageAccess.location ? ['stock', 'Storage Location'] : null,
      storageAccess.queue ? ['queue', 'Storage Queue'] : null,
      storageAccess.pickHistory ? ['history', 'Pick History'] : null,
      storageAccess.productDirectory ? ['product-directory', 'Product Directory'] : null,
    ].filter(Boolean),
    [storageAccess.location, storageAccess.pickHistory, storageAccess.productDirectory, storageAccess.queue]
  )

  const visibleListMode = storageTabItems.some(([mode]) => mode === activeListMode)
    ? activeListMode
    : storageTabItems[0]?.[0] || activeListMode

  const productScopedStorageRows = useMemo(() => {
    const normalizedProductSearch = normalizeFilterValue(productSearch)
    const normalizedGroupCode = normalizeFilterValue(filters.groupCode)

    return storageRows.filter((entry) => {
      if (normalizedGroupCode && getLocationStorageGroup(entry.location) !== normalizedGroupCode) {
        return false
      }

      return storageEntryMatchesProductSearch(entry, normalizedProductSearch)
    })
  }, [filters.groupCode, productSearch, storageRows])

  const warehouseLocationOptions = Array.from(
    new Set(
      productScopedStorageRows
        .filter((entry) => normalizeFilterValue(entry.location?.location_type) === 'PALLET')
        .map((entry) => entry.location?.location_id)
        .filter(Boolean)
    )
  ).sort((left, right) => naturalSort.compare(String(left), String(right)))

  const locationCodeOptions = Array.from(
    new Set(
      productScopedStorageRows
        .filter(
          (entry) =>
            normalizeFilterValue(entry.location?.location_type) === 'PALLET' &&
            (!filters.locationId || String(entry.location?.location_id) === String(filters.locationId)) &&
            (!filters.subLocation || entry.location?.sub_location === filters.subLocation) &&
            (!filters.size || normalizeSizeValue(entry.size) === normalizeSizeValue(filters.size))
        )
        .map((entry) => entry.location?.location_code)
        .filter(Boolean)
    )
  ).sort((left, right) => naturalSort.compare(String(left), String(right)))

  const locationNameOptions = Array.from(
    new Set(
      productScopedStorageRows
        .filter(
          (entry) =>
            normalizeFilterValue(entry.location?.location_type) === 'SHELVING' &&
            (!filters.size || normalizeSizeValue(entry.size) === normalizeSizeValue(filters.size))
        )
        .map((entry) => entry.location?.location_name)
        .filter(Boolean)
    )
  ).sort((left, right) => naturalSort.compare(String(left), String(right)))

  const subLocationOptions = Array.from(
    new Set(
      productScopedStorageRows
        .filter(
          (entry) =>
            normalizeFilterValue(entry.location?.location_type) === 'PALLET' &&
            (!filters.locationId || String(entry.location?.location_id) === String(filters.locationId)) &&
            (!filters.locationCode || entry.location?.location_code === filters.locationCode) &&
            (!filters.size || normalizeSizeValue(entry.size) === normalizeSizeValue(filters.size))
        )
        .map((entry) => entry.location?.sub_location)
        .filter(Boolean)
    )
  ).sort((left, right) => naturalSort.compare(String(left), String(right)))

  const sizeOptions = Array.from(
    new Set(
      productScopedStorageRows
        .filter((entry) => {
          const location = entry.location || {}
          const normalizedLocationType = normalizeFilterValue(location.location_type)

          if (filters.locationType && normalizedLocationType !== normalizeFilterValue(filters.locationType)) {
            return false
          }

          if (filters.locationName && !normalizeFilterValue(location.location_name).includes(normalizeFilterValue(filters.locationName))) {
            return false
          }

          if (filters.locationId && normalizeFilterValue(location.location_id) !== normalizeFilterValue(filters.locationId)) {
            return false
          }

          if (filters.locationCode && normalizeFilterValue(location.location_code) !== normalizeFilterValue(filters.locationCode)) {
            return false
          }

          if (filters.subLocation && normalizeFilterValue(location.sub_location) !== normalizeFilterValue(filters.subLocation)) {
            return false
          }

          return true
        })
        .map((entry) => normalizeSizeValue(entry.size))
        .filter(Boolean)
    )
  ).sort(compareSizeValues)
  const visibleBrandRows = useMemo(() => {
    const query = normalizeFilterValue(brandLookupSearch)

    return (brandRows || [])
      .filter((brand) => {
        if (!query) {
          return true
        }

        return [brand.brand_code, brand.brand_name]
          .map((value) => normalizeFilterValue(value))
          .some((value) => value.includes(query))
      })
      .slice(0, 100)
  }, [brandLookupSearch, brandRows])

  const registerLocationTypeOptions = Array.from(
    new Set(rackLocations.map((item) => item.location_type).filter(Boolean))
  ).sort((left, right) => naturalSort.compare(String(left), String(right)))

  const registerLocationIdOptions = Array.from(
    new Set(
      rackLocations
        .filter((item) => item.location_type === registerForm.locationType)
        .map((item) => item.location_id)
        .filter(Boolean)
    )
  ).sort((left, right) => naturalSort.compare(String(left), String(right)))

  const registerLocationCodeOptions = Array.from(
    new Set(
      rackLocations
        .filter(
          (item) =>
            item.location_type === registerForm.locationType &&
            String(item.location_id) === registerForm.locationId
        )
        .map((item) => item.location_code)
        .filter(Boolean)
    )
  ).sort((left, right) => naturalSort.compare(String(left), String(right)))
  const filteredRegisterLocationCodeOptions = registerLocationCodeOptions
    .filter((option) => normalizeFilterValue(option).includes(normalizeFilterValue(registerForm.locationCode)))
    .slice(0, 80)

  const registerSubLocationOptions = rackLocations
    .filter(
      (item) =>
        item.location_type === registerForm.locationType &&
        String(item.location_id) === registerForm.locationId &&
        item.location_code === registerForm.locationCode
    )
    .sort((left, right) => naturalSort.compare(String(left.sub_location), String(right.sub_location)))

  const selectedRegisterLocation =
    registerSubLocationOptions.find((item) => item.sub_location === registerForm.subLocation) ||
    (!registerForm.subLocation && registerSubLocationOptions.length === 1 ? registerSubLocationOptions[0] : null)
  const registerLocationGroup = selectedRegisterLocation?.group_code || registerSubLocationOptions[0]?.group_code || ''
  const isRegisterArklineLocation = normalizeFilterValue(registerLocationGroup) === 'ARKLINE'
  const filteredArklineProducts = useMemo(() => {
    const query = normalizeFilterValue(registerForm.itemName)

    return arklineProducts
      .filter((product) => !query || normalizeFilterValue(product.label).includes(query))
      .slice(0, 80)
  }, [arklineProducts, registerForm.itemName])
  const selectedRegisterArklineProduct = useMemo(() => {
    if (!isRegisterArklineLocation) {
      return null
    }

    const selectedLabel = String(registerForm.itemName || '').trim().toUpperCase()

    return arklineProducts.find((product) => product.label === selectedLabel) || null
  }, [arklineProducts, isRegisterArklineLocation, registerForm.itemName])

  const moveLocationTypeOptions = Array.from(
    new Set(rackLocations.map((item) => item.location_type).filter(Boolean))
  ).sort((left, right) => naturalSort.compare(String(left), String(right)))

  const moveLocationIdOptions = Array.from(
    new Set(
      rackLocations
        .filter((item) => item.location_type === moveForm.locationType)
        .map((item) => item.location_id)
        .filter(Boolean)
    )
  ).sort((left, right) => naturalSort.compare(String(left), String(right)))

  const moveLocationCodeOptions = Array.from(
    new Set(
      rackLocations
        .filter(
          (item) =>
            item.location_type === moveForm.locationType &&
            String(item.location_id) === moveForm.locationId
        )
        .map((item) => item.location_code)
        .filter(Boolean)
    )
  ).sort((left, right) => naturalSort.compare(String(left), String(right)))

  const filteredMoveLocationCodeOptions = moveLocationCodeOptions
    .filter((option) => normalizeFilterValue(option).includes(normalizeFilterValue(moveForm.locationCode)))
    .slice(0, 80)

  const moveSubLocationOptions = rackLocations
    .filter(
      (item) =>
        item.location_type === moveForm.locationType &&
        String(item.location_id) === moveForm.locationId &&
        item.location_code === moveForm.locationCode
    )
    .sort((left, right) => naturalSort.compare(String(left.sub_location), String(right.sub_location)))

  const selectedMoveLocation = moveSubLocationOptions.find(
    (item) => item.sub_location === moveForm.subLocation
  )

  const queueStorageGroup = normalizeFilterValue(queueModalEntry?.storing_type)
  const queueEligibleRackLocations = rackLocations.filter((item) => {
    if (item.location_type !== 'PALLET') {
      return false
    }

    if (!queueStorageGroup) {
      return true
    }

    return getLocationStorageGroup(item) === queueStorageGroup
  })

  const queueLocationIdOptions = Array.from(
    new Set(
      queueEligibleRackLocations
        .map((item) => item.location_id)
        .filter(Boolean)
    )
  ).sort((left, right) => naturalSort.compare(String(left), String(right)))

  const queueLocationCodeOptions = Array.from(
    new Set(
      queueEligibleRackLocations
        .filter(
          (item) =>
            String(item.location_id) === queueForm.locationId
        )
        .map((item) => item.location_code)
        .filter(Boolean)
    )
  ).sort((left, right) => naturalSort.compare(String(left), String(right)))

  const queueSubLocationOptions = queueEligibleRackLocations
    .filter(
      (item) =>
        String(item.location_id) === queueForm.locationId &&
        item.location_code === queueForm.locationCode
    )
    .sort((left, right) => naturalSort.compare(String(left.sub_location), String(right.sub_location)))

  const selectedQueueLocation = queueSubLocationOptions.find(
    (item) => item.sub_location === queueForm.subLocation
  )

  const inboundById = useMemo(
    () => new Map(inboundRows.map((row) => [Number(row.id), row])),
    [inboundRows]
  )

  const queueGroups = useMemo(() => {
    const groups = new Map()

    storageQueueRows.forEach((row) => {
      const key = getQueueGroupKey(row)
      const current =
        groups.get(key) || {
          key,
          inbound_id: row.inbound_id,
          packing_group_key: row.packing_group_key,
          storing_type: row.storing_type,
          package_type: row.package_type,
          brand_code: row.brand_code,
          koli_sequence: row.koli_sequence,
          created_at: row.created_at,
          packed_by: row.packed_by,
          storage_status: row.storage_status,
          storageStatuses: new Set(),
          items: [],
          totalQty: 0,
        }

      current.items.push(row)
      current.totalQty += Number(row.qty || 0)
      current.storageStatuses.add(normalizeFilterValue(row.storage_status || 'queued'))

      if (!current.created_at || new Date(row.created_at || 0) < new Date(current.created_at || 0)) {
        current.created_at = row.created_at
      }

      groups.set(key, current)
    })

    return Array.from(groups.values()).map((entry) => {
      const statuses = Array.from(entry.storageStatuses || []).filter(Boolean)

      return {
        ...entry,
        storage_status: statuses.length === 1 ? statuses[0].toLowerCase() : 'mixed',
      }
    }).sort((left, right) => {
      const leftDate = new Date(left.created_at || 0).getTime()
      const rightDate = new Date(right.created_at || 0).getTime()

      return rightDate - leftDate || naturalSort.compare(getQueueKoliLabel(left), getQueueKoliLabel(right))
    })
  }, [storageQueueRows])

  const filteredRows = storageRows.filter((entry) => {
    const location = entry.location
    const normalizedProductSearch = normalizeFilterValue(productSearch)
    const normalizedLocationType = normalizeFilterValue(location.location_type)
    const normalizedLocationId = normalizeFilterValue(location.location_id)
    const normalizedLocationName = normalizeFilterValue(location.location_name)
    const normalizedLocationCode = normalizeFilterValue(location.location_code)
    const normalizedSubLocation = normalizeFilterValue(location.sub_location)
    const normalizedGroupCode = getLocationStorageGroup(location)
    const normalizedSize = normalizeSizeValue(entry.size)

    if (!storageEntryMatchesProductSearch(entry, normalizedProductSearch)) {
      return false
    }

    if (
      filters.locationType &&
      normalizedLocationType !== normalizeFilterValue(filters.locationType)
    ) {
      return false
    }

    if (
      filters.groupCode &&
      normalizedGroupCode !== normalizeFilterValue(filters.groupCode)
    ) {
      return false
    }

    if (
      filters.locationName &&
      !normalizedLocationName.includes(normalizeFilterValue(filters.locationName))
    ) {
      return false
    }

    if (
      filters.locationId &&
      normalizedLocationId !== normalizeFilterValue(filters.locationId)
    ) {
      return false
    }

    if (
      filters.locationCode &&
      normalizedLocationCode !== normalizeFilterValue(filters.locationCode)
    ) {
      return false
    }

    if (
      filters.subLocation &&
      normalizedSubLocation !== normalizeFilterValue(filters.subLocation)
    ) {
      return false
    }

    if (
      filters.size &&
      normalizedSize !== normalizeSizeValue(filters.size)
    ) {
      return false
    }

    return true
  })

  const filteredHistoryRows = restockHistoryRows.filter((entry) => {
    const normalizedProductSearch = normalizeFilterValue(productSearch)
    const normalizedPickerFilter = normalizeFilterValue(historyPickerFilter)
    const normalizedPicker = normalizeFilterValue(getDisplayNameByEmail(entry.completed_by))

    if (normalizedPickerFilter && normalizedPicker !== normalizedPickerFilter) {
      return false
    }

    if (normalizedProductSearch) {
      return [entry.item_name, entry.search_term]
        .map((value) => normalizeFilterValue(value))
        .some((value) => value.includes(normalizedProductSearch))
    }

    return true
  })
  const searchFilteredQueueRows = queueGroups.filter((entry) => {
    const normalizedProductSearch = normalizeFilterValue(productSearch)

    if (!normalizedProductSearch) {
      return true
    }

    const inbound = inboundById.get(Number(entry.inbound_id))
    const skus = getSkuList(entry.items)

    return [
      getQueueGroupItemsLabel(entry.items),
      getQueueGroupSizeLabel(entry.items),
      entry.brand_code,
      entry.storing_type,
      getQueueKoliLabel(entry),
      inbound?.grn_number,
      ...skus,
    ]
      .map((value) => normalizeFilterValue(value))
      .some((value) => value.includes(normalizedProductSearch))
  })
  const queueGroupFilteredRows = searchFilteredQueueRows.filter((entry) => {
    const normalizedGroupFilter = normalizeFilterValue(queueFilters.group)

    return !normalizedGroupFilter || normalizeFilterValue(entry.storing_type) === normalizedGroupFilter
  })
  const queueGrnFilteredRows = searchFilteredQueueRows.filter((entry) => {
    const normalizedGrnFilter = normalizeFilterValue(queueFilters.grn)

    if (!normalizedGrnFilter) {
      return true
    }

    const inbound = inboundById.get(Number(entry.inbound_id))

    return normalizeFilterValue(inbound?.grn_number) === normalizedGrnFilter
  })
  const filteredQueueRows = searchFilteredQueueRows.filter((entry) => {
    const normalizedGroupFilter = normalizeFilterValue(queueFilters.group)
    const normalizedGrnFilter = normalizeFilterValue(queueFilters.grn)
    const inbound = inboundById.get(Number(entry.inbound_id))

    if (normalizedGroupFilter && normalizeFilterValue(entry.storing_type) !== normalizedGroupFilter) {
      return false
    }

    if (normalizedGrnFilter && normalizeFilterValue(inbound?.grn_number) !== normalizedGrnFilter) {
      return false
    }

    return true
  })
  const queueGroupOptions = Array.from(
    new Set(queueGrnFilteredRows.map((entry) => normalizeFilterValue(entry.storing_type)).filter(Boolean))
  ).sort((left, right) => naturalSort.compare(left, right))
  const queueGrnOptions = Array.from(
    new Set(
      queueGroupFilteredRows
        .map((entry) => inboundById.get(Number(entry.inbound_id))?.grn_number)
        .filter(Boolean)
    )
  ).sort((left, right) => naturalSort.compare(String(left), String(right)))
  const totalStockPages = Math.max(1, Math.ceil(filteredRows.length / STOCK_PAGE_SIZE))
  const safeStockPage = Math.min(stockPage, totalStockPages)
  const stockPageStartIndex = (safeStockPage - 1) * STOCK_PAGE_SIZE
  const stockPageEndIndex = Math.min(stockPageStartIndex + STOCK_PAGE_SIZE, filteredRows.length)
  const visibleStockRows = filteredRows.slice(stockPageStartIndex, stockPageStartIndex + STOCK_PAGE_SIZE)
  const totalQueuePages = Math.max(1, Math.ceil(filteredQueueRows.length / QUEUE_PAGE_SIZE))
  const safeQueuePage = Math.min(queuePage, totalQueuePages)
  const queuePageStartIndex = (safeQueuePage - 1) * QUEUE_PAGE_SIZE
  const queuePageEndIndex = Math.min(queuePageStartIndex + QUEUE_PAGE_SIZE, filteredQueueRows.length)
  const visibleQueueRows = filteredQueueRows.slice(queuePageStartIndex, queuePageStartIndex + QUEUE_PAGE_SIZE)
  const visibleHistoryRows = filteredHistoryRows.slice(0, 25)
  const filteredQty = filteredRows.reduce((sum, entry) => sum + Number(entry.qty || 0), 0)

  const topTakenItems = Array.from(
    filteredHistoryRows
      .reduce((byItem, entry) => {
        const itemName = String(entry.item_name || 'Unknown item').trim() || 'Unknown item'
        const qty = Number(entry.qty || 0)
        const next = byItem.get(itemName) || { itemName, qty: 0, count: 0 }
        next.qty += qty
        next.count += 1
        byItem.set(itemName, next)

        return byItem
      }, new Map())
      .values()
  )
    .sort((left, right) => right.qty - left.qty || right.count - left.count || naturalSort.compare(left.itemName, right.itemName))
    .slice(0, 5)

  const topPickers = Array.from(
    filteredHistoryRows
      .reduce((byPicker, entry) => {
        const picker = getDisplayNameByEmail(entry.completed_by)

        if (picker === '-') {
          return byPicker
        }

        const qty = Number(entry.qty || 0)
        const next = byPicker.get(picker) || { picker, qty: 0, count: 0 }
        next.qty += qty
        next.count += 1
        byPicker.set(picker, next)

        return byPicker
      }, new Map())
      .values()
  )
    .sort((left, right) => right.count - left.count || right.qty - left.qty || naturalSort.compare(left.picker, right.picker))
    .slice(0, 5)

  const totalQty = storageRows.reduce((sum, entry) => sum + Number(entry.qty || 0), 0)

  const palletQty = storageRows
    .filter((entry) => String(entry.location?.location_type || '').toUpperCase() === 'PALLET')
    .reduce((sum, entry) => sum + Number(entry.qty || 0), 0)

  const shelvingQty = storageRows
    .filter((entry) => String(entry.location?.location_type || '').toUpperCase() === 'SHELVING')
    .reduce((sum, entry) => sum + Number(entry.qty || 0), 0)

  function handleFilterChange(event) {
    const { name, value, type, checked } = event.target
    setStockPage(1)
    setQueuePage(1)

    if (type === 'checkbox') {
      setFilters((prev) => ({
        ...prev,
        [name]: checked,
      }))
      return
    }

    if (name === 'locationType') {
      setFilters((prev) => ({
        ...prev,
        locationType: value.toUpperCase(),
        locationId: '',
        locationCode: '',
        locationName: '',
        subLocation: '',
        size: prev.size,
      }))
      return
    }

    if (name === 'groupCode') {
      setFilters((prev) => ({
        ...prev,
        groupCode: normalizeFilterValue(prev.groupCode) === normalizeFilterValue(value) ? '' : value.toUpperCase(),
        locationId: '',
        locationCode: '',
        locationName: '',
        subLocation: '',
      }))
      return
    }

    if (name === 'locationId') {
      setFilters((prev) => ({
        ...prev,
        locationId: value,
        locationCode: '',
        subLocation: '',
      }))
      return
    }

    setFilters((prev) => ({
      ...prev,
      [name]: value.toUpperCase(),
    }))
  }

  function clearFilterOnFilledClick(name) {
    setStockPage(1)
    setQueuePage(1)
    setFilters((prev) => {
      if (!prev[name]) {
        return prev
      }

      return {
        ...prev,
        [name]: '',
      }
    })
  }

  function handleQueueFilterChange(name, value, options = {}) {
    setQueuePage(1)
    setQueueFilters((prev) => {
      const normalizedCurrent = normalizeFilterValue(prev[name])
      const normalizedNext = normalizeFilterValue(value)

      return {
        ...prev,
        [name]: options.toggle && normalizedCurrent === normalizedNext ? '' : normalizedNext,
      }
    })
  }

  function clearQueueFilters() {
    setProductSearch('')
    setQueueFilters({
      group: '',
      grn: '',
    })
    setQueuePage(1)
  }

  function clearFilters() {
    setFilters({
      locationType: '',
      groupCode: '',
      locationId: '',
      locationCode: '',
      locationName: '',
      subLocation: '',
      size: '',
    })
    setProductSearch('')
    setQueueFilters({
      group: '',
      grn: '',
    })
    setStockPage(1)
    setQueuePage(1)
  }

  function getDisplayNameByEmail(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase()

    if (!normalizedEmail) {
      return '-'
    }

    return userProfilesByEmail[normalizedEmail] || normalizedEmail
  }

  function formatDateTime(value) {
    if (!value) {
      return '-'
    }

    return new Date(value).toLocaleString()
  }

  function updateWithoutScrollJump(callback) {
    const scrollX = window.scrollX
    const scrollY = window.scrollY

    callback()
    window.requestAnimationFrame(() => window.scrollTo(scrollX, scrollY))
  }

  function handleTakenItemRankingClick(itemName) {
    const nextSearch = String(itemName || '').toUpperCase()

    updateWithoutScrollJump(() => {
      setProductSearch((currentSearch) =>
        normalizeFilterValue(currentSearch) === normalizeFilterValue(nextSearch) ? '' : nextSearch
      )
    })
  }

  function handlePickerRankingClick(pickerName) {
    const nextPicker = String(pickerName || '')

    updateWithoutScrollJump(() => {
      setHistoryPickerFilter((currentPicker) =>
        normalizeFilterValue(currentPicker) === normalizeFilterValue(nextPicker) ? '' : nextPicker
      )
    })
  }

  function renderHistoryRankingPanel() {
    return (
      <div style={styles.historyRankingGrid}>
        <div style={{ ...styles.rankingCard, ...styles.itemRankingCard }}>
          <div style={styles.rankingHeader}>
            <span style={styles.kpiValueLabel}>Most Taken Item</span>
            <strong style={styles.rankingBadgeText}>Top 5</strong>
          </div>
          <div style={styles.rankingList}>
            {topTakenItems.length > 0 ? topTakenItems.map((item, index) => (
              <button
                key={item.itemName}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleTakenItemRankingClick(item.itemName)}
                style={{
                  ...styles.rankingRow,
                  ...(normalizeFilterValue(productSearch) === normalizeFilterValue(item.itemName) ? styles.rankingRowActive : {}),
                }}
              >
                <span style={styles.rankNumber}>{index + 1}</span>
                <span style={styles.rankingCopy}>
                  <strong style={styles.rankingName}>{item.itemName}</strong>
                  <small style={styles.rankingMeta}>{item.qty} qty across {item.count} pick(s)</small>
                </span>
              </button>
            )) : (
              <p style={styles.rankingEmpty}>No pick data yet.</p>
            )}
          </div>
        </div>

        <div style={{ ...styles.rankingCard, ...styles.pickerRankingCard }}>
          <div style={styles.rankingHeader}>
            <span style={styles.kpiValueLabel}>Top Picker</span>
            <strong style={styles.rankingBadgeText}>Top 5</strong>
          </div>
          <div style={styles.rankingList}>
            {topPickers.length > 0 ? topPickers.map((picker, index) => (
              <button
                key={picker.picker}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handlePickerRankingClick(picker.picker)}
                style={{
                  ...styles.rankingRow,
                  ...(normalizeFilterValue(historyPickerFilter) === normalizeFilterValue(picker.picker) ? styles.rankingRowActive : {}),
                }}
              >
                <span style={styles.rankNumber}>{index + 1}</span>
                <span style={styles.rankingCopy}>
                  <strong style={styles.rankingName}>{picker.picker}</strong>
                  <small style={styles.rankingMeta}>{picker.count} pick(s), {picker.qty} qty</small>
                </span>
              </button>
            )) : (
              <p style={styles.rankingEmpty}>No picker data yet.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  function openRegisterModal() {
    if (!canRegisterStorageItem) return
    setIsRegisterModalOpen(true)
    setError('')
    setSuccess('')
  }

  function closeRegisterModal() {
    setIsRegisterModalOpen(false)
  }

  function openQueueModal(entry) {
    if (!canStoreQueueItem) return
    setQueueModalEntry(entry)
    setQueueForm({
      locationType: 'PALLET',
      locationId: '',
      locationCode: '',
      subLocation: '',
      notes: '',
    })
    setQueueModalError('')
    setError('')
    setSuccess('')
  }

  function closeQueueModal() {
    setQueueModalEntry(null)
    setQueueModalError('')
    setQueueForm({
      locationType: 'PALLET',
      locationId: '',
      locationCode: '',
      subLocation: '',
      notes: '',
    })
  }

  function openTakeModal(entry) {
    if (!canTakeStorageItem) return
    setTakeModalEntry(entry)
    setTakeForm({
      takeOutAll: false,
      qty: '',
    })
    setTakeModalError('')
    setError('')
    setSuccess('')
  }

  function openEditModal(entry) {
    if (!canEditStorageItem) return
    setEditModalEntry(entry)
    setEditForm({
      itemName: entry.item_name || '',
      size: entry.size || '',
      qty: String(entry.qty || ''),
      notes: entry.notes || '',
    })
    setError('')
    setSuccess('')
  }

  function openMoveModal(entry) {
    if (!canMoveStorageItem) return
    const location = entry.location || {}
    setMoveModalEntry(entry)
    setMoveForm({
      locationType: location.location_type || '',
      locationId: location.location_id ? String(location.location_id) : '',
      locationCode: location.location_code || '',
      subLocation: location.sub_location || '',
    })
    setMoveModalError('')
    setIsMoveLocationCodeMenuOpen(false)
    setError('')
    setSuccess('')
  }

  function closeTakeModal() {
    setTakeModalEntry(null)
    setTakeModalError('')
    setTakeForm({
      takeOutAll: false,
      qty: '',
    })
  }

  function closeEditModal() {
    setEditModalEntry(null)
    setEditForm({
      itemName: '',
      size: '',
      qty: '',
      notes: '',
    })
  }

  function closeMoveModal() {
    setMoveModalEntry(null)
    setMoveModalError('')
    setMoveForm({
      locationType: '',
      locationId: '',
      locationCode: '',
      subLocation: '',
    })
    setIsMoveLocationCodeMenuOpen(false)
  }

  function handleTakeFormChange(event) {
    const { name, value, type, checked } = event.target

    setTakeModalError('')

    if (type === 'checkbox') {
      setTakeForm((prev) => ({
        ...prev,
        [name]: checked,
      }))
      return
    }

    const numericValue = value.replace(/\D/g, '')
    const availableQty = Number(takeModalEntry?.qty || 0)
    const nextQty = Number(numericValue || 0)
    const clampedValue = availableQty > 0 && nextQty > availableQty ? String(availableQty) : numericValue

    setTakeForm((prev) => ({
      ...prev,
      [name]: clampedValue,
    }))
  }

  function handleEditFormChange(event) {
    const { name, value } = event.target

    if (name === 'qty') {
      const numericValue = value.replace(/\D/g, '')
      setEditForm((prev) => ({
        ...prev,
        qty: numericValue && Number(numericValue) < 1 ? '1' : numericValue,
      }))
      return
    }

    setEditForm((prev) => ({
      ...prev,
      [name]: name === 'itemName' ? value.toUpperCase() : value,
    }))
  }

  function handleMoveSelectChange(event) {
    const { name, value } = event.target
    setMoveModalError('')

    if (name === 'locationType') {
      setMoveForm((prev) => ({
        ...prev,
        locationType: value,
        locationId: '',
        locationCode: '',
        subLocation: '',
      }))
      setIsMoveLocationCodeMenuOpen(false)
      return
    }

    if (name === 'locationId') {
      setMoveForm((prev) => ({
        ...prev,
        locationId: value,
        locationCode: '',
        subLocation: '',
      }))
      setIsMoveLocationCodeMenuOpen(false)
      return
    }

    if (name === 'subLocation') {
      setMoveForm((prev) => ({
        ...prev,
        subLocation: value,
      }))
    }
  }

  function handleMoveLocationCodeFocus() {
    if (moveForm.locationCode) {
      setMoveForm((prev) => ({
        ...prev,
        locationCode: '',
        subLocation: '',
      }))
    }

    setMoveModalError('')
    setIsMoveLocationCodeMenuOpen(Boolean(moveForm.locationId))
  }

  function handleMoveLocationCodeInputChange(event) {
    const value = event.target.value.toUpperCase()

    setMoveForm((prev) => ({
      ...prev,
      locationCode: value,
      subLocation: '',
    }))
    setMoveModalError('')
    setIsMoveLocationCodeMenuOpen(true)
  }

  function handleMoveLocationCodeSelect(value) {
    setMoveForm((prev) => ({
      ...prev,
      locationCode: value,
      subLocation: '',
    }))
    setMoveModalError('')
    setIsMoveLocationCodeMenuOpen(false)
  }

  function handleMoveLocationCodeBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsMoveLocationCodeMenuOpen(false)
    }
  }

  function handleRegisterSelectChange(event) {
    const { name, value } = event.target

    if (name === 'locationType') {
      setRegisterForm((prev) => ({
        ...prev,
        locationType: value,
        locationId: '',
        locationCode: '',
        subLocation: '',
      }))
      return
    }

    if (name === 'locationId') {
      setRegisterForm((prev) => ({
        ...prev,
        locationId: value,
        locationCode: '',
        subLocation: '',
      }))
      setIsRegisterLocationCodeMenuOpen(false)
      return
    }

    if (name === 'locationCode') {
      setRegisterForm((prev) => ({
        ...prev,
        locationCode: value,
        subLocation: '',
      }))
      setIsRegisterLocationCodeMenuOpen(false)
      return
    }

    setRegisterForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  function handleRegisterLocationCodeFocus() {
    if (registerForm.locationCode) {
      setRegisterForm((prev) => ({
        ...prev,
        locationCode: '',
        subLocation: '',
      }))
    }

    setIsRegisterLocationCodeMenuOpen(Boolean(registerForm.locationId))
  }

  function handleRegisterLocationCodeInputChange(event) {
    const value = event.target.value.toUpperCase()

    setRegisterForm((prev) => ({
      ...prev,
      locationCode: value,
      subLocation: '',
    }))
    setIsRegisterLocationCodeMenuOpen(true)
  }

  function handleRegisterLocationCodeSelect(value) {
    setRegisterForm((prev) => ({
      ...prev,
      locationCode: value,
      subLocation: '',
    }))
    setIsRegisterLocationCodeMenuOpen(false)
  }

  function handleRegisterLocationCodeBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsRegisterLocationCodeMenuOpen(false)
    }
  }

  function handleRegisterInputChange(event) {
    const { name, value } = event.target

    if (name === 'qty') {
      const numericValue = value.replace(/\D/g, '')
      setRegisterForm((prev) => ({
        ...prev,
        qty: numericValue || '',
      }))
      return
    }

    if (name === 'itemName' && isRegisterArklineLocation) {
      setIsRegisterArklineProductMenuOpen(true)
    }

    setRegisterForm((prev) => ({
      ...prev,
      [name]:
        name === 'itemName'
          ? value.toUpperCase()
          : name === 'size'
            ? normalizeSizeValue(value)
            : value,
    }))
  }

  function handleRegisterArklineProductFocus() {
    if (isRegisterArklineLocation) {
      setIsRegisterArklineProductMenuOpen(true)
    }
  }

  function handleRegisterArklineProductSelect(product) {
    setRegisterForm((prev) => ({
      ...prev,
      itemName: product.label,
    }))
    setIsRegisterArklineProductMenuOpen(false)
  }

  function handleRegisterArklineProductBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsRegisterArklineProductMenuOpen(false)
    }
  }

  function handleQueueSelectChange(event) {
    const { name, value } = event.target

    if (name === 'locationId') {
      setQueueForm((prev) => ({
        ...prev,
        locationId: value,
        locationCode: '',
        subLocation: '',
      }))
      return
    }

    if (name === 'locationCode') {
      setQueueForm((prev) => ({
        ...prev,
        locationCode: value,
        subLocation: '',
      }))
      return
    }

    setQueueForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  function handleQueueInputChange(event) {
    const { name, value } = event.target

    setQueueForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault()

    if (!canRegisterStorageItem) return

    setRegistering(true)
    setError('')
    setSuccess('')

    if (!selectedRegisterLocation) {
      setError('Please complete the location selection first.')
      setRegistering(false)
      return
    }

    if (!registerForm.itemName.trim()) {
      setError('Item name is required.')
      setRegistering(false)
      return
    }

    if (isRegisterArklineLocation && !selectedRegisterArklineProduct) {
      setError('Please choose an active ARKLINE product from the list.')
      setRegistering(false)
      return
    }

    const nextQty = Number(registerForm.qty || 0)

    if (nextQty <= 0) {
      setError('Quantity must be greater than 0.')
      setRegistering(false)
      return
    }

    const payload = {
      rack_location_id: selectedRegisterLocation.id,
      item_name: isRegisterArklineLocation ? selectedRegisterArklineProduct.label : registerForm.itemName.trim(),
      size: normalizeSizeValue(registerForm.size) || null,
      qty: nextQty,
      notes: registerForm.notes.trim() || null,
      updated_by: await getCurrentUserEmail(),
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from('warehouse_storage')
      .insert([payload])
      .select(WAREHOUSE_STORAGE_SELECT_COLUMNS)

    if (insertError) {
      setError(insertError.message)
      setRegistering(false)
      return
    }

    setStorageEntries((currentRows) => mergeWarehouseStorageRows(currentRows, insertedRows || []))
    setRegisterForm((prev) => ({
      ...prev,
      itemName: '',
      size: '',
      qty: '',
      notes: '',
    }))
    setSuccess('Item stored successfully.')
    setRegistering(false)
    closeRegisterModal()
  }

  async function handleQueueStoreSubmit(event) {
    event.preventDefault()

    if (!canStoreQueueItem) return

    if (!queueModalEntry) {
      return
    }

    setStoringQueue(true)
    setError('')
    setQueueModalError('')
    setSuccess('')

    if (!selectedQueueLocation) {
      setQueueModalError('Please complete the location selection first.')
      setStoringQueue(false)
      return
    }

    const queueItems = (queueModalEntry.items || []).filter((item) => Number(item.qty || 0) > 0)
    const queueQty = Number(queueModalEntry.totalQty || 0)

    if (!queueItems.length || queueQty <= 0) {
      setQueueModalError('Queue item quantity must be greater than 0.')
      setStoringQueue(false)
      return
    }

    const storedBy = await getCurrentUserEmail()
    const inbound = inboundById.get(Number(queueModalEntry.inbound_id))
    const grnNumber = inbound?.grn_number || ''
    const storagePayload = queueItems.map((item) => {
      const itemSku = getQueueItemSku(item)
      const sourceNote = `Stored from ${getQueueKoliLabel(queueModalEntry)}${itemSku ? ` / SKU ${itemSku}` : ''}`
      const userNote = queueForm.notes.trim()

      return {
        rack_location_id: selectedQueueLocation.id,
        sku_id: itemSku || null,
        item_name: formatStoredQueueItemName(getQueueItemName(item), grnNumber),
        size: normalizeSizeValue(item.size_label) || null,
        qty: Number(item.qty || 0),
        notes: userNote ? `${sourceNote} | ${userNote}` : sourceNote,
        updated_by: storedBy,
      }
    })

    const { data: insertedRows, error: insertError } = await supabase
      .from('warehouse_storage')
      .insert(storagePayload)
      .select(WAREHOUSE_STORAGE_SELECT_COLUMNS)

    if (insertError) {
      setQueueModalError(insertError.message)
      setStoringQueue(false)
      return
    }

    const insertedStorageIds = (insertedRows || []).map((row) => row.id).filter(Boolean)
    const { error: statusError } = await supabase
      .from('pl_packing_items')
      .update({
        storage_status: 'stored',
        updated_at: new Date().toISOString(),
      })
      .in('id', queueItems.map((item) => item.id))

    if (statusError) {
      if (insertedStorageIds.length) {
        await supabase.from('warehouse_storage').delete().in('id', insertedStorageIds)
      }

      setQueueModalError(statusError.message)
      setStoringQueue(false)
      return
    }

    const storedQueueIds = new Set(queueItems.map((item) => String(item.id)))
    setStorageEntries((currentRows) => mergeWarehouseStorageRows(currentRows, insertedRows || []))
    setStorageQueueRows((currentRows) => currentRows.filter((row) => !storedQueueIds.has(String(row.id))))
    setSuccess(`${getQueueKoliLabel(queueModalEntry)} stored successfully.`)
    setStoringQueue(false)
    closeQueueModal()
  }

  async function handleTakeOut(event) {
    event.preventDefault()

    if (!takeModalEntry) {
      return
    }

    setTaking(true)
    setError('')
    setTakeModalError('')
    setSuccess('')

    const currentQty = Number(takeModalEntry.qty || 0)
    const takeQty = takeForm.takeOutAll ? currentQty : Number(takeForm.qty || 0)

    if (!canTakeStorageItem) {
      setTakeModalError('Take out is not available for this role.')
      setTaking(false)
      return
    }

    if (!takeForm.takeOutAll && takeQty <= 0) {
      setTakeModalError('Take out quantity must be greater than 0.')
      setTaking(false)
      return
    }

    if (takeQty > currentQty) {
      setTakeModalError('Take out quantity cannot be greater than available quantity.')
      setTaking(false)
      return
    }

    if (takeQty === currentQty) {
      const { data: deletedRows, error: deleteError } = await supabase
        .from('warehouse_storage')
        .delete()
        .eq('id', takeModalEntry.id)
        .select('id')

      if (deleteError) {
        setTakeModalError(deleteError.message)
        setTaking(false)
        return
      }

      if (!deletedRows || deletedRows.length === 0) {
        setTakeModalError(
          'Take out all could not remove the item. Please check the DELETE policy for warehouse_storage.'
        )
        setTaking(false)
        return
      }
    } else {
      const updatedBy = await getCurrentUserEmail()

      const { error: updateError } = await supabase
        .from('warehouse_storage')
        .update({
          qty: currentQty - takeQty,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        })
        .eq('id', takeModalEntry.id)

      if (updateError) {
        setTakeModalError(updateError.message)
        setTaking(false)
        return
      }
    }

    setStorageEntries((currentRows) => {
      const nextRows =
        takeQty === currentQty
          ? currentRows.filter((row) => String(row.id) !== String(takeModalEntry.id))
          : currentRows.map((row) => (
              String(row.id) === String(takeModalEntry.id)
                ? { ...row, qty: currentQty - takeQty, updated_at: new Date().toISOString() }
                : row
            ))

      return setWarehouseStorageCache(nextRows)
    })
    setSuccess('Storage quantity updated successfully.')
    setTaking(false)
    closeTakeModal()
  }

  async function handleEditSubmit(event) {
    event.preventDefault()

    if (!canEditStorageItem) return

    if (!editModalEntry) {
      return
    }

    setEditing(true)
    setError('')
    setSuccess('')

    if (!editForm.itemName.trim()) {
      setError('Item name is required.')
      setEditing(false)
      return
    }

    const nextQty = Number(editForm.qty || 0)

    if (nextQty <= 0) {
      setError('Quantity must be greater than 0.')
      setEditing(false)
      return
    }

    const updatedBy = await getCurrentUserEmail()

    const { error: updateError } = await supabase
      .from('warehouse_storage')
      .update({
        item_name: editForm.itemName.trim(),
        size: editForm.size.trim() || null,
        qty: nextQty,
        notes: editForm.notes.trim() || null,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editModalEntry.id)

    if (updateError) {
      setError(updateError.message)
      setEditing(false)
      return
    }

    setStorageEntries((currentRows) => {
      const nextRows = currentRows.map((row) => (
        String(row.id) === String(editModalEntry.id)
          ? {
              ...row,
              item_name: editForm.itemName.trim(),
              size: editForm.size.trim() || null,
              qty: nextQty,
              notes: editForm.notes.trim() || null,
              updated_at: new Date().toISOString(),
            }
          : row
      ))

      return setWarehouseStorageCache(nextRows)
    })
    setSuccess('Storage item updated successfully.')
    setEditing(false)
    closeEditModal()
  }

  async function handleMoveSubmit(event) {
    event.preventDefault()

    if (!canMoveStorageItem) return

    if (!moveModalEntry) {
      return
    }

    setMoving(true)
    setMoveModalError('')
    setError('')
    setSuccess('')

    if (!selectedMoveLocation) {
      setMoveModalError('Please complete the destination location first.')
      setMoving(false)
      return
    }

    if (String(selectedMoveLocation.id) === String(moveModalEntry.rack_location_id)) {
      setMoveModalError('Destination location is the same as the current location.')
      setMoving(false)
      return
    }

    const updatedAt = new Date().toISOString()
    const updatedBy = await getCurrentUserEmail()
    const payload = {
      rack_location_id: selectedMoveLocation.id,
      updated_by: updatedBy,
      updated_at: updatedAt,
    }

    const { error: updateError } = await supabase
      .from('warehouse_storage')
      .update(payload)
      .eq('id', moveModalEntry.id)

    if (updateError) {
      setMoveModalError(updateError.message)
      setMoving(false)
      return
    }

    setStorageEntries((currentRows) => {
      const nextRows = currentRows.map((row) => (
        String(row.id) === String(moveModalEntry.id)
          ? {
              ...row,
              rack_location_id: selectedMoveLocation.id,
              updated_at: updatedAt,
            }
          : row
      ))

      return setWarehouseStorageCache(nextRows)
    })
    setSuccess('Storage item moved successfully.')
    setMoving(false)
    closeMoveModal()
  }

  function getLocationLabel(location) {
    return `${location.location_type} / ${location.location_id} / ${location.location_code} / ${location.sub_location}`
  }

  if (loading) {
    return <p style={styles.loading}>Loading inventory storage...</p>
  }

  return (
    <section style={styles.panel}>
      <div style={styles.pageHeader}>
        <div style={styles.headerCopy}>
          <p style={styles.eyebrow}>Warehouse</p>
          <div style={styles.titleRow}>
            <h1 style={styles.title}>Inventory Storage</h1>
            {storageAccess.warehouseMap ? (
              <Link
                href="/dashboard/storage/warehouse-map"
                style={styles.iconActionButton}
                title="Warehouse Map"
                aria-label="Warehouse Map"
              >
                <svg viewBox="0 0 24 24" style={styles.actionIcon} aria-hidden="true">
                  <path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z" />
                  <path d="M9 3v15" />
                  <path d="M15 6v15" />
                </svg>
              </Link>
            ) : null}
            {storageAccess.brandLookup ? (
              <button
                type="button"
                onClick={() => {
                  setIsBrandLookupOpen(true)
                  setBrandLookupSearch('')
                }}
                style={styles.iconActionButton}
                title="Brand Lookup"
                aria-label="Brand Lookup"
              >
                <svg viewBox="0 0 24 24" style={styles.actionIcon} aria-hidden="true">
                  <path d="M7 7h10" />
                  <path d="M7 12h7" />
                  <path d="M7 17h4" />
                  <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                </svg>
              </button>
            ) : null}
          </div>
          <p style={styles.subtitle}>Track stored items, inspect recent stock activity, and register new warehouse entries.</p>
        </div>

        <div style={styles.metricsGrid}>
          <div style={styles.compactMetricCard}>
            <span style={styles.kpiValueLabel}>Pallet Qty</span>
            <strong style={{ ...styles.kpiValue, ...styles.compactMetricValue }}>{palletQty}</strong>
          </div>
          <div style={styles.compactMetricCard}>
            <span style={styles.kpiValueLabel}>Shelving Qty</span>
            <strong style={{ ...styles.kpiValue, ...styles.compactMetricValue }}>{shelvingQty}</strong>
          </div>
          <div style={{ ...styles.compactMetricCard, ...styles.totalMetricCard }}>
            <span style={styles.totalMetricLabel}>Total Qty</span>
            <strong style={{ ...styles.kpiValue, ...styles.totalMetricValue }}>{totalQty}</strong>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.storageTabs}>
          <div style={styles.storageTabList}>
            {storageTabItems.map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setActiveListMode(mode)
                  setStockPage(1)
                  setQueuePage(1)
                }}
                style={{
                  ...styles.storageTabButton,
                  ...(visibleListMode === mode ? styles.storageTabButtonActive : {}),
                }}
              >
                <span style={styles.storageTabLabel}>{label}</span>
                {visibleListMode === mode ? <span style={styles.storageTabUnderline} /> : null}
              </button>
            ))}
          </div>

          <div style={styles.storageTabPanel}>
        {visibleListMode === 'product-directory' ? (
          <ProductDirectoryClient
            embedded
            activeSection="directory"
            canManage={canManageProductDirectory}
          />
        ) : (
          <>
        <div
          style={{
            ...styles.searchToolbar,
            ...(visibleListMode === 'queue' ? styles.queueSearchToolbar : {}),
            ...(isCompactLayout ? styles.searchToolbarCompact : {}),
          }}
        >
          <div style={styles.field}>
            <label style={styles.label}>Product Search</label>
            <input
              value={productSearch}
              onChange={(event) => {
                setProductSearch(event.target.value.toUpperCase())
                setStockPage(1)
                setQueuePage(1)
              }}
              style={styles.input}
              placeholder="Search product, GRN, or SKU"
            />
          </div>
          {visibleListMode === 'queue' ? (
            <div style={styles.queueGroupField}>
              <label style={styles.label}>Group</label>
              <div style={styles.queueGroupToggle} aria-label="Storage queue group filter">
                {queueGroupOptions.map((groupOption) => {
                  const isActive = normalizeFilterValue(queueFilters.group) === normalizeFilterValue(groupOption)

                  return (
                    <button
                      key={groupOption}
                      type="button"
                      onClick={() => handleQueueFilterChange('group', groupOption, { toggle: true })}
                      style={{
                        ...styles.queueGroupButton,
                        ...(isActive ? styles.queueGroupButtonActive : {}),
                      }}
                      aria-pressed={isActive}
                    >
                      {groupOption}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
          {visibleListMode === 'queue' ? (
            <div style={styles.field}>
              <label style={styles.label}>GRN</label>
              <input
                value={queueFilters.grn}
                onChange={(event) => handleQueueFilterChange('grn', event.target.value)}
                onClick={() => {
                  if (queueFilters.grn) {
                    handleQueueFilterChange('grn', '')
                  }
                }}
                style={styles.input}
                list="queue-grn-options"
                placeholder="Type or select a GRN"
              />
              <datalist id="queue-grn-options">
                {queueGrnOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
          ) : null}
          {visibleListMode === 'queue' ? (
            <div style={styles.toolbarIconField}>
              <button type="button" onClick={clearQueueFilters} style={styles.iconResetButton} title="Clear Queue Filters" aria-label="Clear Queue Filters">
                <svg viewBox="0 0 24 24" style={styles.resetIcon} aria-hidden="true">
                  <path d="M3 12a9 9 0 0 1 15.4-6.4L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
              </button>
            </div>
          ) : null}
          {visibleListMode === 'stock' && canRegisterStorageItem ? (
            <div style={styles.toolbarActionField}>
              <button
                type="button"
                onClick={openRegisterModal}
                style={styles.registerInlineButton}
              >
                Item Registration
              </button>
            </div>
          ) : null}
          {visibleListMode === 'stock' ? (
            <div style={styles.toolbarIconField}>
              <button type="button" onClick={clearFilters} style={styles.iconResetButton} title="Clear Filters" aria-label="Clear Filters">
                <svg viewBox="0 0 24 24" style={styles.resetIcon} aria-hidden="true">
                  <path d="M3 12a9 9 0 0 1 15.4-6.4L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
              </button>
            </div>
          ) : null}
          {visibleListMode === 'stock' ? (
            <div style={styles.toolbarGroupField}>
              <label style={styles.groupFilterLabel}>Group</label>
              <div style={styles.storageGroupToggleGrid} aria-label="Storage group filter">
                {STORAGE_GROUP_FILTERS.map((groupCode) => {
                  const isActive = normalizeFilterValue(filters.groupCode) === groupCode

                  return (
                    <button
                      key={groupCode}
                      type="button"
                      onClick={() =>
                        handleFilterChange({
                          target: { name: 'groupCode', value: groupCode, type: 'button' },
                        })
                      }
                      style={{
                        ...styles.storageGroupToggleButton,
                        ...(isActive ? styles.storageGroupToggleButtonActive : {}),
                      }}
                      aria-pressed={isActive}
                    >
                      {groupCode}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
          {visibleListMode === 'stock' ? (
            <div style={styles.toolbarQtyField}>
              <span style={styles.filteredQtyCard}>
                <span style={styles.filteredQtyLabel}>Qty of filtered</span>
                <strong style={styles.filteredQtyValue}>{filteredQty}</strong>
              </span>
            </div>
          ) : null}
          {visibleListMode === 'history' ? (
            <div style={styles.toolbarIconField}>
              <button
                type="button"
                onClick={() => {
                  setProductSearch('')
                  setHistoryPickerFilter('')
                }}
                style={styles.iconResetButton}
                title="Clear Search"
                aria-label="Clear Search"
              >
                <svg viewBox="0 0 24 24" style={styles.resetIcon} aria-hidden="true">
                  <path d="M3 12a9 9 0 0 1 15.4-6.4L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
              </button>
            </div>
          ) : null}
        </div>

        {visibleListMode === 'stock' ? (
          <>
        <div
          style={{
            ...styles.filtersGrid,
            ...styles.palletFiltersGrid,
            ...(isCompactLayout ? styles.filtersGridCompact : {}),
          }}
        >
          <div style={{ ...styles.field, ...styles.typeField }}>
            <label style={styles.label}>Storage Type</label>
            <div style={styles.typeToggleGroup}>
              {[
                ['', 'All'],
                ['PALLET', 'Pallet'],
                ['SHELVING', 'Shelving'],
              ].map(([option, label]) => (
                <button
                  key={option || 'ALL'}
                  type="button"
                  onClick={() =>
                    handleFilterChange({
                      target: { name: 'locationType', value: option, type: 'button' },
                    })
                  }
                  style={{
                    ...styles.typeToggleButton,
                    ...(filters.locationType === option ? styles.typeToggleButtonActive : {}),
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filters.locationType === 'PALLET' ? (
            <div style={styles.field}>
              <label style={styles.label}>Warehouse Location</label>
              <select
                name="locationId"
                value={filters.locationId}
                onChange={handleFilterChange}
                style={styles.select}
              >
                <option value="">All Warehouses</option>
                {warehouseLocationOptions.map((option) => (
                  <option key={option} value={String(option)}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {filters.locationType === 'PALLET' ? (
            <div style={styles.field}>
              <label style={styles.label}>Pallet Number</label>
              <input
                name="locationCode"
                value={filters.locationCode}
                onChange={handleFilterChange}
                onClick={() => clearFilterOnFilledClick('locationCode')}
                style={styles.input}
                list="location-code-options"
                placeholder="Type or select a pallet number"
              />
              <datalist id="location-code-options">
                {locationCodeOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
          ) : filters.locationType === 'SHELVING' ? (
            <div style={styles.field}>
              <label style={styles.label}>Shelving Location Name</label>
              <input
                name="locationName"
                value={filters.locationName}
                onChange={handleFilterChange}
                style={styles.input}
                list="location-name-options"
                placeholder="Type or select a shelving location name"
              />
              <datalist id="location-name-options">
                {locationNameOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
          ) : null}

          {filters.locationType === 'PALLET' ? (
            <div style={styles.field}>
              <label style={styles.label}>Carton Number</label>
              <input
                name="subLocation"
                value={filters.subLocation}
                onChange={handleFilterChange}
                onClick={() => clearFilterOnFilledClick('subLocation')}
                style={styles.input}
                list="sub-location-options"
                placeholder="Type or select a carton number"
              />
              <datalist id="sub-location-options">
                {subLocationOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
          ) : null}

          <div style={styles.field}>
            <label style={styles.label}>Size</label>
            <input
              name="size"
              value={filters.size}
              onChange={handleFilterChange}
              onClick={() => clearFilterOnFilledClick('size')}
              style={styles.input}
              list="size-filter-options"
              placeholder="Type or select a size"
            />
            <datalist id="size-filter-options">
              {sizeOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>

        </div>

            <div style={styles.filterFooter}>
              <p style={styles.summary}>
                Showing {filteredRows.length ? stockPageStartIndex + 1 : 0}-{stockPageEndIndex} of {filteredRows.length} item record(s)
              </p>
              <div style={styles.paginationControls}>
                <button
                  type="button"
                  onClick={() => setStockPage((prev) => Math.max(1, Math.min(prev, totalStockPages) - 1))}
                  style={safeStockPage <= 1 ? { ...styles.paginationButton, ...styles.paginationButtonDisabled } : styles.paginationButton}
                  disabled={safeStockPage <= 1}
                >
                  Previous
                </button>
                <span style={styles.pageIndicator}>
                  Page {safeStockPage} of {totalStockPages}
                </span>
                <button
                  type="button"
                  onClick={() => setStockPage((prev) => Math.min(totalStockPages, Math.min(prev, totalStockPages) + 1))}
                  style={safeStockPage >= totalStockPages ? { ...styles.paginationButton, ...styles.paginationButtonDisabled } : styles.paginationButton}
                  disabled={safeStockPage >= totalStockPages}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : visibleListMode === 'queue' ? (
          <div style={styles.historyToolbar}>
            <p style={styles.summary}>
              Showing {filteredQueueRows.length ? queuePageStartIndex + 1 : 0}-{queuePageEndIndex} of {filteredQueueRows.length} storage queue koli
            </p>
            <div style={styles.paginationControls}>
              <button
                type="button"
                onClick={() => setQueuePage((prev) => Math.max(1, Math.min(prev, totalQueuePages) - 1))}
                style={safeQueuePage <= 1 ? { ...styles.paginationButton, ...styles.paginationButtonDisabled } : styles.paginationButton}
                disabled={safeQueuePage <= 1}
              >
                Previous
              </button>
              <span style={styles.pageIndicator}>
                Page {safeQueuePage} of {totalQueuePages}
              </span>
              <button
                type="button"
                onClick={() => setQueuePage((prev) => Math.min(totalQueuePages, Math.min(prev, totalQueuePages) + 1))}
                style={safeQueuePage >= totalQueuePages ? { ...styles.paginationButton, ...styles.paginationButtonDisabled } : styles.paginationButton}
                disabled={safeQueuePage >= totalQueuePages}
              >
                Next
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.historyToolbar}>
            <p style={styles.summary}>
              Showing {visibleHistoryRows.length} most recent of {filteredHistoryRows.length} pick history record(s)
            </p>
          </div>
        )}

        {error ? <p style={styles.error}>{error}</p> : null}
        {success ? <p style={styles.success}>{success}</p> : null}

        {visibleListMode === 'stock' ? filteredRows.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{ margin: 0 }}>No stored items found for the selected filters.</p>
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Location</th>
                  <th style={styles.th}>Item</th>
                  <th style={styles.th}>Size</th>
                  <th style={styles.th}>Qty</th>
                  {canShowStorageLocationActions ? <th style={{ ...styles.th, ...styles.actionTh }}>Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {visibleStockRows.map((entry) => (
                  <tr key={entry.id}>
                    <td style={styles.td}>{getLocationLabel(entry.location)}</td>
                    <td style={styles.td}>{entry.item_name}</td>
                    <td style={styles.td}>{entry.size || '-'}</td>
                    <td style={styles.td}>{entry.qty}</td>
                    {canShowStorageLocationActions ? (
                      <td style={{ ...styles.td, ...styles.actionTd }}>
                        <div style={styles.actionGroup}>
                          {canEditStorageItem ? (
                            <button
                              type="button"
                              onClick={() => openEditModal(entry)}
                              style={styles.tableIconButton}
                              title="Edit item detail"
                              aria-label="Edit item detail"
                            >
                              <svg viewBox="0 0 24 24" style={styles.tableActionIcon} aria-hidden="true">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                              </svg>
                            </button>
                          ) : null}
                          {canMoveStorageItem ? (
                            <button
                              type="button"
                              onClick={() => openMoveModal(entry)}
                              style={styles.tableIconButton}
                              title="Move to another location"
                              aria-label="Move to another location"
                            >
                              <svg viewBox="0 0 24 24" style={styles.tableActionIcon} aria-hidden="true">
                                <path d="M5 9V5h4" />
                                <path d="M19 15v4h-4" />
                                <path d="M5 5l14 14" />
                                <path d="M19 5v4h-4" />
                                <path d="M5 19v-4h4" />
                                <path d="M19 5 5 19" />
                              </svg>
                            </button>
                          ) : null}
                          {canTakeStorageItem ? (
                          <button
                            type="button"
                            onClick={() => openTakeModal(entry)}
                            style={{ ...styles.tableIconButton, ...styles.tableIconButtonDark }}
                            title="Take out item"
                            aria-label="Take out item"
                          >
                            <svg viewBox="0 0 24 24" style={styles.tableActionIcon} aria-hidden="true">
                              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                              <path d="M16 17l5-5-5-5" />
                              <path d="M21 12H9" />
                            </svg>
                          </button>
                        ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {visibleListMode === 'queue' ? filteredQueueRows.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{ margin: 0 }}>No storage queue koli found.</p>
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>GRN</th>
                  <th style={styles.th}>Koli</th>
                  <th style={styles.th}>SKU</th>
                  <th style={styles.th}>Item</th>
                  <th style={styles.th}>Size</th>
                  <th style={styles.th}>Total Qty</th>
                  <th style={styles.th}>Type</th>
                  {canStoreQueueItem ? <th style={{ ...styles.th, ...styles.actionTh }}>Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {visibleQueueRows.map((entry) => {
                  const inbound = inboundById.get(Number(entry.inbound_id))

                  return (
                    <tr key={entry.key}>
                      <td style={styles.td}>{inbound?.grn_number || '-'}</td>
                      <td style={styles.td}>{getQueueKoliLabel(entry)}</td>
                      <td style={styles.td}>{getSkuList(entry.items).join(', ') || '-'}</td>
                      <td style={styles.td}>{getQueueGroupItemsLabel(entry.items)}</td>
                      <td style={styles.td}>{getQueueGroupSizeLabel(entry.items)}</td>
                      <td style={styles.td}>{entry.totalQty}</td>
                      <td style={styles.td}>{entry.storing_type || '-'}</td>
                      {canStoreQueueItem ? (
                        <td style={{ ...styles.td, ...styles.actionTd }}>
                          <button
                            type="button"
                            onClick={() => openQueueModal(entry)}
                            style={styles.queueStoreButton}
                          >
                            Store
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {visibleListMode === 'history' ? filteredHistoryRows.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{ margin: 0 }}>No pick history found for that product.</p>
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Item</th>
                  <th style={styles.th}>Requester</th>
                  <th style={styles.th}>Size</th>
                  <th style={styles.th}>Qty</th>
                  <th style={styles.th}>Taken From</th>
                  <th style={styles.th}>Picked By</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleHistoryRows.map((entry) => (
                  <tr key={entry.id}>
                    <td style={styles.td}>{entry.item_name}</td>
                    <td style={styles.td}>{entry.requester_name || '-'}</td>
                    <td style={styles.td}>{entry.size || '-'}</td>
                    <td style={styles.td}>{entry.qty}</td>
                    <td style={styles.td}>{formatTakeFromLabel(entry.take_from)}</td>
                    <td style={styles.td}>{getDisplayNameByEmail(entry.completed_by)}</td>
                    <td style={styles.td}>
                      <div style={styles.cellStack}>
                        <strong>{entry.request_status || '-'}</strong>
                        <span style={styles.cellMeta}>{formatDateTime(entry.completed_at || entry.created_at)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {visibleListMode === 'history' ? renderHistoryRankingPanel() : null}
          </>
        )}
          </div>
        </div>
      </div>

      {isRegisterModalOpen && canRegisterStorageItem ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCardWide}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleGroup}>
                <p style={styles.modalEyebrow}>Warehouse</p>
                <h2 style={styles.modalTitle}>Item Registration</h2>
              </div>
              <div style={styles.modalHeaderActions}>
                <button type="button" onClick={closeRegisterModal} style={styles.modalCancelButton}>
                  Cancel
                </button>
                <button type="submit" form="item-registration-form" style={styles.registerButton} disabled={registering}>
                  {registering ? 'Saving...' : 'Save to Storage'}
                </button>
              </div>
            </div>

            <form id="item-registration-form" onSubmit={handleRegisterSubmit} style={styles.modalForm}>
              <div style={styles.filtersGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Storage Type</label>
                  <select
                    name="locationType"
                    value={registerForm.locationType}
                    onChange={handleRegisterSelectChange}
                    style={styles.select}
                    required
                  >
                    <option value="">Select location type</option>
                    {registerLocationTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Warehouse Location</label>
                  <select
                    name="locationId"
                    value={registerForm.locationId}
                    onChange={handleRegisterSelectChange}
                    style={!registerForm.locationType ? { ...styles.select, ...styles.controlDisabled } : styles.select}
                    disabled={!registerForm.locationType}
                    required
                  >
                    <option value="">Select location id</option>
                    {registerLocationIdOptions.map((option) => (
                      <option key={option} value={String(option)}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Pallet/Shelving Number</label>
                  <div style={styles.typeaheadWrap} onBlur={handleRegisterLocationCodeBlur}>
                    <input
                      name="locationCode"
                      value={registerForm.locationCode}
                      onChange={handleRegisterLocationCodeInputChange}
                      onFocus={handleRegisterLocationCodeFocus}
                      onClick={handleRegisterLocationCodeFocus}
                      style={!registerForm.locationId ? { ...styles.input, ...styles.controlDisabled } : styles.input}
                      disabled={!registerForm.locationId}
                      placeholder="Type or select location"
                      autoComplete="off"
                      required
                    />
                    {isRegisterLocationCodeMenuOpen && registerForm.locationId ? (
                      <div style={styles.typeaheadMenu}>
                        {filteredRegisterLocationCodeOptions.length > 0 ? filteredRegisterLocationCodeOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            style={styles.typeaheadOption}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleRegisterLocationCodeSelect(option)}
                          >
                            {option}
                          </button>
                        )) : (
                          <div style={styles.typeaheadEmpty}>No location found.</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>{isRegisterArklineLocation ? 'ARKLINE Level' : 'Carton Number'}</label>
                  <select
                    name="subLocation"
                    value={isRegisterArklineLocation ? '' : registerForm.subLocation}
                    onChange={handleRegisterSelectChange}
                    style={isRegisterArklineLocation || !registerForm.locationCode ? { ...styles.select, ...styles.controlDisabled } : styles.select}
                    disabled={isRegisterArklineLocation || !registerForm.locationCode}
                    required={!isRegisterArklineLocation}
                  >
                    <option value="">{isRegisterArklineLocation ? 'Select ARKLINE level' : 'Select sub location'}</option>
                    {registerSubLocationOptions.map((option) => (
                      <option key={option.id} value={option.sub_location}>
                        {option.sub_location}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.selectedLocationBox}>
                <span style={styles.selectedLocationLabel}>Selected Slot</span>
                <strong style={styles.selectedLocationValue}>
                  {selectedRegisterLocation ? getLocationLabel(selectedRegisterLocation) : 'Choose a full location first'}
                </strong>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>{isRegisterArklineLocation ? 'ARKLINE Product' : 'Item Name'}</label>
                <div style={styles.typeaheadWrap} onBlur={handleRegisterArklineProductBlur}>
                  <input
                    name="itemName"
                    value={registerForm.itemName}
                    onChange={handleRegisterInputChange}
                    onFocus={handleRegisterArklineProductFocus}
                    style={styles.input}
                    placeholder={isRegisterArklineLocation ? 'Type or select ARKLINE product' : 'ITEM NAME'}
                    autoComplete="off"
                    required
                  />
                  {isRegisterArklineLocation && isRegisterArklineProductMenuOpen ? (
                    <div style={styles.typeaheadMenuWide}>
                      {filteredArklineProducts.length > 0 ? filteredArklineProducts.map((product) => (
                        <button
                          key={product.label}
                          type="button"
                          style={styles.typeaheadOption}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleRegisterArklineProductSelect(product)}
                        >
                          {product.label}
                        </button>
                      )) : (
                        <div style={styles.typeaheadEmpty}>No active ARKLINE product found.</div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={styles.filtersGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Size</label>
                  <input
                    name="size"
                    value={registerForm.size}
                    onChange={handleRegisterInputChange}
                    style={styles.input}
                    placeholder="SIZE"
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Qty</label>
                  <input
                    name="qty"
                    value={registerForm.qty}
                    onChange={handleRegisterInputChange}
                    style={styles.input}
                    inputMode="numeric"
                    placeholder="Enter qty"
                    required
                  />
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Notes</label>
                <textarea
                  name="notes"
                  value={registerForm.notes}
                  onChange={handleRegisterInputChange}
                  style={styles.textarea}
                  placeholder="Optional notes"
                />
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isBrandLookupOpen ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleGroup}>
                <p style={styles.modalEyebrow}>Warehouse</p>
                <h2 style={styles.modalTitle}>Brand Lookup</h2>
              </div>
              <div style={styles.modalHeaderActions}>
                <button
                  type="button"
                  onClick={() => setIsBrandLookupOpen(false)}
                  style={styles.modalCancelButton}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Search Brand</label>
              <input
                value={brandLookupSearch}
                onChange={(event) => setBrandLookupSearch(event.target.value.toUpperCase())}
                style={styles.input}
                placeholder="Search brand name or code"
                autoComplete="off"
              />
            </div>

            <div style={styles.brandLookupTableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Brand Code</th>
                    <th style={styles.th}>Brand Name</th>
                    <th style={{ ...styles.th, ...styles.centerCell }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBrandRows.length > 0 ? visibleBrandRows.map((brand) => (
                    <tr key={brand.id}>
                      <td style={styles.td}>{brand.brand_code || '-'}</td>
                      <td style={styles.td}>{brand.brand_name || '-'}</td>
                      <td style={{ ...styles.td, ...styles.centerCell }}>
                        {brand.is_active === false ? 'Inactive' : 'Active'}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td style={styles.td} colSpan={3}>No brand found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {queueModalEntry && canStoreQueueItem ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCardWide}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleGroup}>
                <p style={styles.modalEyebrow}>Warehouse</p>
                <h2 style={styles.modalTitle}>Store Queue Item</h2>
              </div>
              <div style={styles.modalHeaderActions}>
                <button type="button" onClick={closeQueueModal} style={styles.modalCancelButton}>
                  Cancel
                </button>
                <button type="submit" form="storage-queue-form" style={styles.registerButton} disabled={storingQueue}>
                  {storingQueue ? 'Saving...' : 'Save to Storage'}
                </button>
              </div>
            </div>

            <div style={styles.selectedLocationBox}>
              <span style={styles.selectedLocationLabel}>
                {inboundById.get(Number(queueModalEntry.inbound_id))?.grn_number || 'PL Item'} / {getQueueKoliLabel(queueModalEntry)}
              </span>
              <strong style={styles.selectedLocationValue}>{getQueueGroupItemsLabel(queueModalEntry.items)}</strong>
              <span style={styles.cellMeta}>
                SKU {getSkuList(queueModalEntry.items).join(', ') || '-'} / Size {getQueueGroupSizeLabel(queueModalEntry.items)} / Total Qty {queueModalEntry.totalQty} / {queueModalEntry.storing_type || '-'}
              </span>
            </div>

            {queueModalError ? <p style={styles.modalInlineError}>{queueModalError}</p> : null}

            <div style={styles.queueConfirmBox}>
              <div style={styles.rankingHeader}>
                <span style={styles.selectedLocationLabel}>Confirm Koli Content</span>
                <strong style={styles.rankingBadgeText}>{queueModalEntry.items.length} row(s)</strong>
              </div>
              <div style={styles.queueConfirmList}>
                {queueModalEntry.items.map((item) => (
                  <div key={item.id} style={styles.queueConfirmRow}>
                    <span style={styles.queueSkuText}>{getQueueItemSku(item) || '-'}</span>
                    <strong style={styles.queueItemText}>{getQueueItemName(item)}</strong>
                    <span style={styles.queueMetaText}>Size {item.size_label || '-'} / Qty {item.qty}</span>
                  </div>
                ))}
              </div>
            </div>

            <form id="storage-queue-form" onSubmit={handleQueueStoreSubmit} style={styles.modalForm}>
              <div style={styles.filtersGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Warehouse Location</label>
                  <select
                    name="locationId"
                    value={queueForm.locationId}
                    onChange={handleQueueSelectChange}
                    style={styles.select}
                    required
                  >
                    <option value="">Select location id</option>
                    {queueLocationIdOptions.map((option) => (
                      <option key={option} value={String(option)}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Pallet Number</label>
                  <input
                    name="locationCode"
                    value={queueForm.locationCode}
                    onChange={handleQueueSelectChange}
                    style={!queueForm.locationId ? { ...styles.input, ...styles.controlDisabled } : styles.input}
                    disabled={!queueForm.locationId}
                    list="queue-location-code-options"
                    placeholder="Type or select a pallet number"
                    required
                  />
                  <datalist id="queue-location-code-options">
                    {queueLocationCodeOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Carton Number</label>
                  <select
                    name="subLocation"
                    value={queueForm.subLocation}
                    onChange={handleQueueSelectChange}
                    style={!queueForm.locationCode ? { ...styles.select, ...styles.controlDisabled } : styles.select}
                    disabled={!queueForm.locationCode}
                    required
                  >
                    <option value="">Select sub location</option>
                    {queueSubLocationOptions.map((option) => (
                      <option key={option.id} value={option.sub_location}>
                        {option.sub_location}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.selectedLocationBox}>
                <span style={styles.selectedLocationLabel}>Selected Slot</span>
                <strong style={styles.selectedLocationValue}>
                  {selectedQueueLocation ? getLocationLabel(selectedQueueLocation) : 'Choose a full location first'}
                </strong>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Notes</label>
                <textarea
                  name="notes"
                  value={queueForm.notes}
                  onChange={handleQueueInputChange}
                  style={styles.textarea}
                  placeholder="Optional notes"
                />
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {takeModalEntry && canTakeStorageItem ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleGroup}>
                <p style={styles.modalEyebrow}>Warehouse</p>
                <h2 style={styles.modalTitle}>Item Take Out</h2>
              </div>
              <div style={styles.modalHeaderActions}>
                <button type="button" onClick={closeTakeModal} style={styles.modalCancelButton}>
                  Cancel
                </button>
                <button type="submit" form="item-take-out-form" style={styles.takeButton} disabled={taking}>
                  {taking ? 'Processing...' : 'Take Out'}
                </button>
              </div>
            </div>

            <div style={styles.takeModalSummaryGrid}>
              <div style={styles.takeModalItemCard}>
                <span style={styles.selectedLocationLabel}>Item</span>
                <strong style={styles.takeModalItemName}>{takeModalEntry.item_name}</strong>
                <div style={styles.takeModalSizeBlock}>
                  <span style={styles.takeModalSizeLabel}>Size</span>
                  <strong style={styles.takeModalSizeValue}>{takeModalEntry.size || '-'}</strong>
                </div>
              </div>
              <div style={styles.takeModalInfoCard}>
                <span style={styles.selectedLocationLabel}>Location</span>
                <strong style={styles.takeModalLocation}>{getLocationLabel(takeModalEntry.location)}</strong>
              </div>
              <div style={styles.takeModalInfoCard}>
                <span style={styles.selectedLocationLabel}>Available Qty</span>
                <strong style={styles.takeModalQty}>{takeModalEntry.qty}</strong>
              </div>
            </div>

            <form id="item-take-out-form" onSubmit={handleTakeOut} style={styles.modalForm}>
              <div style={styles.takeControlPanel}>
                <div style={{ ...styles.field, ...styles.takeQtyField }}>
                  <label style={styles.label}>Take Out Qty</label>
                  <input
                    name="qty"
                    value={takeForm.qty}
                    onChange={handleTakeFormChange}
                    style={styles.input}
                    inputMode="numeric"
                    placeholder="Enter qty"
                    min="1"
                    max={Number(takeModalEntry.qty || 0)}
                    disabled={takeForm.takeOutAll}
                    required={!takeForm.takeOutAll}
                  />
                </div>

                <label style={styles.takeAllToggle}>
                  <input
                    type="checkbox"
                    name="takeOutAll"
                    checked={takeForm.takeOutAll}
                    onChange={handleTakeFormChange}
                  />
                  Take out all
                </label>

                {takeModalError ? <p style={styles.modalInlineError}>{takeModalError}</p> : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {moveModalEntry && canMoveStorageItem ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCardWide}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleGroup}>
                <p style={styles.modalEyebrow}>Warehouse</p>
                <h2 style={styles.modalTitle}>Move Item Location</h2>
              </div>
              <div style={styles.modalHeaderActions}>
                <button type="button" onClick={closeMoveModal} style={styles.modalCancelButton}>
                  Cancel
                </button>
                <button type="submit" form="move-item-location-form" style={styles.takeButton} disabled={moving}>
                  {moving ? 'Moving...' : 'Move To'}
                </button>
              </div>
            </div>

            <div style={styles.moveSummaryGrid}>
              <div style={styles.takeModalItemCard}>
                <span style={styles.selectedLocationLabel}>Item</span>
                <strong style={styles.takeModalItemName}>{moveModalEntry.item_name}</strong>
                <div style={styles.moveMetaRow}>
                  <span style={styles.moveMetaPill}>Size {moveModalEntry.size || '-'}</span>
                  <span style={styles.moveMetaPill}>Qty {moveModalEntry.qty || 0}</span>
                </div>
              </div>
              <div style={styles.takeModalInfoCard}>
                <span style={styles.selectedLocationLabel}>Current Location</span>
                <strong style={styles.takeModalLocation}>{getLocationLabel(moveModalEntry.location)}</strong>
              </div>
            </div>

            <form id="move-item-location-form" onSubmit={handleMoveSubmit} style={styles.modalForm}>
              <div style={styles.filtersGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Storage Type</label>
                  <select
                    name="locationType"
                    value={moveForm.locationType}
                    onChange={handleMoveSelectChange}
                    style={styles.select}
                    required
                  >
                    <option value="">Select location type</option>
                    {moveLocationTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Warehouse Location</label>
                  <select
                    name="locationId"
                    value={moveForm.locationId}
                    onChange={handleMoveSelectChange}
                    style={!moveForm.locationType ? { ...styles.select, ...styles.controlDisabled } : styles.select}
                    disabled={!moveForm.locationType}
                    required
                  >
                    <option value="">Select location id</option>
                    {moveLocationIdOptions.map((option) => (
                      <option key={option} value={String(option)}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Pallet/Shelving Number</label>
                  <div style={styles.typeaheadWrap} onBlur={handleMoveLocationCodeBlur}>
                    <input
                      name="locationCode"
                      value={moveForm.locationCode}
                      onChange={handleMoveLocationCodeInputChange}
                      onFocus={handleMoveLocationCodeFocus}
                      onClick={handleMoveLocationCodeFocus}
                      style={!moveForm.locationId ? { ...styles.input, ...styles.controlDisabled } : styles.input}
                      disabled={!moveForm.locationId}
                      placeholder="Type or select location"
                      autoComplete="off"
                      required
                    />
                    {isMoveLocationCodeMenuOpen && moveForm.locationId ? (
                      <div style={styles.typeaheadMenu}>
                        {filteredMoveLocationCodeOptions.length > 0 ? filteredMoveLocationCodeOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            style={styles.typeaheadOption}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleMoveLocationCodeSelect(option)}
                          >
                            {option}
                          </button>
                        )) : (
                          <div style={styles.typeaheadEmpty}>No location found.</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Carton / Level</label>
                  <select
                    name="subLocation"
                    value={moveForm.subLocation}
                    onChange={handleMoveSelectChange}
                    style={!moveForm.locationCode ? { ...styles.select, ...styles.controlDisabled } : styles.select}
                    disabled={!moveForm.locationCode}
                    required
                  >
                    <option value="">Select sub location</option>
                    {moveSubLocationOptions.map((option) => (
                      <option key={option.id} value={option.sub_location}>
                        {option.sub_location}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.selectedLocationBox}>
                <span style={styles.selectedLocationLabel}>Destination Slot</span>
                <strong style={styles.selectedLocationValue}>
                  {selectedMoveLocation ? getLocationLabel(selectedMoveLocation) : 'Choose a destination location first'}
                </strong>
              </div>

              {moveModalError ? <p style={styles.modalInlineError}>{moveModalError}</p> : null}
            </form>
          </div>
        </div>
      ) : null}

      {editModalEntry && canEditStorageItem ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleGroup}>
                <p style={styles.modalEyebrow}>Warehouse</p>
                <h2 style={styles.modalTitle}>Edit Item Detail</h2>
              </div>
              <div style={styles.modalHeaderActions}>
                <button type="button" onClick={closeEditModal} style={styles.modalCancelButton}>
                  Cancel
                </button>
                <button type="submit" form="edit-item-detail-form" style={styles.editButton} disabled={editing}>
                  {editing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            <p style={styles.modalText}>
              <strong>Location:</strong> {getLocationLabel(editModalEntry.location)}
            </p>

            <form id="edit-item-detail-form" onSubmit={handleEditSubmit} style={styles.modalForm}>
              <div style={styles.field}>
                <label style={styles.label}>Item Name</label>
                <input
                  name="itemName"
                  value={editForm.itemName}
                  onChange={handleEditFormChange}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Size</label>
                <input
                  name="size"
                  value={editForm.size}
                  onChange={handleEditFormChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Qty</label>
                <input
                  name="qty"
                  value={editForm.qty}
                  onChange={handleEditFormChange}
                  style={styles.input}
                  inputMode="numeric"
                  min="1"
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Notes</label>
                <textarea
                  name="notes"
                  value={editForm.notes}
                  onChange={handleEditFormChange}
                  style={styles.textarea}
                />
              </div>

            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    padding: '18px',
    border: '1px solid #dbe4f0',
    borderRadius: '22px',
    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(241, 246, 252, 0.98) 100%)',
    boxShadow: '0 24px 54px rgba(15, 23, 42, 0.08)',
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  mapButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '40px',
    padding: '0 16px',
    borderRadius: '10px',
    background: '#111827',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '700',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '6px',
  },
  headerCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: '1 1 280px',
    maxWidth: '720px',
  },
  eyebrow: {
    margin: 0,
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 1,
    textTransform: 'uppercase',
  },
  iconActionButton: {
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    border: '1px solid #dbe4ef',
    background: '#fff',
    color: '#0f172a',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    textDecoration: 'none',
    boxShadow: '0 10px 22px rgba(15, 23, 42, 0.06)',
    padding: 0,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  actionIcon: {
    width: '20px',
    height: '20px',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  registerButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '40px',
    padding: '0 16px',
    border: 'none',
    borderRadius: '10px',
    background: '#2563eb',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  queueStoreButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '30px',
    padding: '0 12px',
    border: 'none',
    borderRadius: '8px',
    background: '#111827',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  title: {
    margin: 0,
    width: 'auto',
    fontSize: '30px',
    fontWeight: '900',
    lineHeight: 1,
    color: '#0f172a',
  },
  subtitle: {
    margin: '8px 0 0',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  card: {
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  kpiCard: {
    background: 'rgba(255, 255, 255, 0.98)',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  kpiTopRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '10px',
    alignItems: 'stretch',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))',
    gap: '10px',
    alignItems: 'stretch',
    flex: '1 1 320px',
    maxWidth: '560px',
    marginLeft: 'auto',
    minWidth: 0,
  },
  kpiHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: '16px',
    flexWrap: 'wrap',
  },
  kpiTitle: {
    margin: 0,
    fontSize: '20px',
  },
  kpiText: {
    marginTop: '8px',
    marginBottom: 0,
    color: '#6b7280',
    fontSize: '14px',
  },
  kpiDateField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: 0,
  },
  summaryMetricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '10px',
  },
  compactMetricCard: {
    minWidth: 0,
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    overflow: 'hidden',
  },
  palletMetricCard: {
    background: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  shelvingMetricCard: {
    background: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  totalMetricCard: {
    background: '#0f172a',
    borderColor: '#0f172a',
    justifyContent: 'center',
  },
  totalMetricLabel: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#e2e8f0',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  activityStack: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '10px',
  },
  recordedMetricCard: {
    minHeight: '82px',
  },
  kpiValueLabel: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0,
    lineHeight: 1.15,
    overflowWrap: 'anywhere',
  },
  kpiValue: {
    fontSize: 'clamp(20px, 6vw, 28px)',
    lineHeight: 1,
    color: '#0f172a',
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
  compactMetricValue: {
    fontSize: 'clamp(19px, 5.4vw, 22px)',
  },
  totalMetricValue: {
    fontSize: 'clamp(21px, 6vw, 26px)',
    color: '#fff',
  },
  kpiFootnote: {
    fontSize: '12px',
    color: '#476089',
    fontWeight: '600',
  },
  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 136px), 1fr))',
    gap: '10px',
    alignItems: 'end',
    minWidth: 0,
    maxWidth: '100%',
  },
  palletFiltersGrid: {
    gridTemplateColumns: 'minmax(190px, 0.9fr) minmax(200px, 1fr) minmax(186px, 1fr) minmax(144px, 0.68fr) minmax(120px, 0.56fr)',
  },
  shelvingFiltersGrid: {
    gridTemplateColumns: 'minmax(178px, 0.75fr) minmax(320px, 1.3fr) minmax(150px, 0.65fr)',
    justifyContent: 'flex-start',
    alignItems: 'end',
  },
  allStorageFiltersGrid: {
    gridTemplateColumns: 'minmax(178px, 210px) minmax(150px, 170px)',
    justifyContent: 'flex-start',
  },
  filtersGridCompact: {
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 136px), 1fr))',
  },
  storageTabs: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    position: 'relative',
    isolation: 'isolate',
  },
  storageTabList: {
    position: 'relative',
    zIndex: 2,
    display: 'inline-flex',
    alignSelf: 'flex-start',
    alignItems: 'flex-end',
    gap: '2px',
    marginBottom: '-1px',
    maxWidth: '100%',
    overflowX: 'auto',
  },
  storageTabButton: {
    minHeight: '42px',
    minWidth: '138px',
    padding: '0 14px',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRadius: '16px 16px 0 0',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    display: 'flex',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  storageTabButtonActive: {
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderLeftWidth: '1px',
    borderTopColor: '#e2e8f0',
    borderRightColor: '#e2e8f0',
    borderLeftColor: '#e2e8f0',
    background: 'rgba(248, 250, 252, 0.98)',
    color: '#111827',
  },
  storageTabLabel: {
    fontSize: '13px',
    fontWeight: '750',
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
  },
  storageTabUnderline: {
    position: 'absolute',
    right: '16px',
    bottom: '8px',
    left: '16px',
    height: '2px',
    borderRadius: '999px',
    background: '#111827',
  },
  storageTabPanel: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '18px',
    border: '1px solid #e2e8f0',
    borderRadius: '0 22px 22px 22px',
    background: 'rgba(248, 250, 252, 0.98)',
    boxShadow: '0 16px 34px rgba(15, 23, 42, 0.05)',
  },
  searchToolbar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 1fr) auto auto minmax(76px, 84px) minmax(150px, 180px)',
    gap: '12px',
    alignItems: 'flex-end',
  },
  searchToolbarCompact: {
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  },
  queueSearchToolbar: {
    gridTemplateColumns: 'minmax(280px, 1fr) minmax(180px, 240px) minmax(200px, 280px) auto',
  },
  queueGroupField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: 0,
  },
  queueGroupToggle: {
    display: 'inline-grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))',
    gap: '4px',
    padding: '4px',
    border: '1px solid #dbe4ef',
    borderRadius: '12px',
    background: '#fff',
  },
  queueGroupButton: {
    minHeight: '36px',
    padding: '0 10px',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRadius: '9px',
    background: 'transparent',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  queueGroupButtonActive: {
    background: '#111827',
    color: '#fff',
  },
  toolbarActionField: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minHeight: '44px',
    minWidth: 0,
    marginRight: '-4px',
  },
  toolbarIconField: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minHeight: '44px',
    minWidth: 0,
    marginLeft: '-4px',
  },
  toolbarGroupField: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    minHeight: '66px',
    minWidth: 0,
    gap: '6px',
  },
  toolbarQtyField: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    minHeight: '44px',
    minWidth: 0,
  },
  registerInlineButton: {
    height: '44px',
    width: 'auto',
    maxWidth: '220px',
    minWidth: 0,
    padding: '0 16px',
    borderRadius: '10px',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    background: '#111827',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'normal',
    lineHeight: 1.15,
    textAlign: 'center',
  },
  segmentedControl: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px',
    border: '1px solid #dbe4ef',
    borderRadius: '12px',
    background: '#f8fafc',
  },
  segmentedButton: {
    minHeight: '36px',
    padding: '0 12px',
    border: 'none',
    borderRadius: '9px',
    background: 'transparent',
    color: '#475569',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  segmentedButtonActive: {
    background: '#111827',
    color: '#fff',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.12)',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: 0,
  },
  typeaheadWrap: {
    position: 'relative',
    width: '100%',
    minWidth: 0,
  },
  typeaheadMenu: {
    position: 'absolute',
    zIndex: 70,
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    maxHeight: '260px',
    overflowY: 'auto',
    border: '1px solid #dbe4ef',
    borderRadius: '14px',
    background: '#fff',
    boxShadow: '0 18px 42px rgba(15, 23, 42, 0.14)',
    padding: '6px',
  },
  typeaheadMenuWide: {
    position: 'absolute',
    zIndex: 70,
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    maxHeight: '320px',
    overflowY: 'auto',
    border: '1px solid #dbe4ef',
    borderRadius: '14px',
    background: '#fff',
    boxShadow: '0 18px 42px rgba(15, 23, 42, 0.14)',
    padding: '8px',
  },
  typeaheadOption: {
    width: '100%',
    minHeight: '40px',
    padding: '9px 12px',
    border: 'none',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '700',
    lineHeight: 1.3,
    textAlign: 'left',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
  },
  typeaheadEmpty: {
    padding: '12px',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: '700',
  },
  resetField: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minHeight: '66px',
  },
  filteredQtyField: {
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    minHeight: '66px',
    minWidth: 0,
  },
  filteredQtyCard: {
    minHeight: '66px',
    minWidth: 0,
    width: '100%',
    maxWidth: '180px',
    padding: '9px 12px',
    borderRadius: '10px',
    border: '1px solid #dbe4ef',
    background: '#fff',
    color: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '2px',
  },
  filteredQtyLabel: {
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '800',
    lineHeight: 1,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  filteredQtyValue: {
    color: '#0f172a',
    fontSize: '18px',
    lineHeight: 1,
    fontWeight: '900',
    fontVariantNumeric: 'tabular-nums',
  },
  storageGroupToggleGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'repeat(3, 1fr)',
    gap: '3px',
    width: '100%',
    minWidth: 0,
    padding: '3px',
    border: '1px solid #dbe4ef',
    borderRadius: '10px',
    background: '#fff',
  },
  groupFilterLabel: {
    color: '#111827',
    fontSize: '14px',
    fontWeight: '600',
    lineHeight: 1,
  },
  storageGroupToggleButton: {
    minHeight: '20px',
    padding: '0 6px',
    border: 'none',
    borderRadius: '7px',
    background: 'transparent',
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '850',
    lineHeight: 1,
    cursor: 'pointer',
  },
  storageGroupToggleButtonActive: {
    background: '#111827',
    color: '#fff',
  },
  typeField: {
    gap: '10px',
  },
  checkboxFilter: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: '40px',
    padding: '0 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
  },
  filterFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    paddingTop: 0,
    marginBottom: '-4px',
  },
  typeToggleGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: '3px',
    minHeight: '36px',
    width: '100%',
    padding: '3px',
    border: '1px solid #dbe4ef',
    borderRadius: '999px',
    background: '#fff',
  },
  typeToggleButton: {
    minHeight: '30px',
    minWidth: 0,
    flex: '1 1 0',
    padding: '0 8px',
    border: 'none',
    borderRadius: '999px',
    background: 'transparent',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  typeToggleButtonActive: {
    background: '#111827',
    color: '#fff',
  },
  iconResetButton: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  resetIcon: {
    width: '18px',
    height: '18px',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
  },
  select: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    height: '44px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    padding: '0 12px',
    fontSize: '14px',
    background: '#fff',
  },
  input: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    height: '44px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    padding: '0 12px',
    fontSize: '14px',
    background: '#fff',
  },
  textarea: {
    minHeight: '90px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    padding: '12px',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  controlDisabled: {
    color: '#94a3b8',
    background: '#f8fafc',
    cursor: 'not-allowed',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  summary: {
    margin: 0,
    color: '#374151',
    fontSize: '14px',
    fontWeight: '600',
  },
  paginationControls: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  paginationButton: {
    minHeight: '36px',
    padding: '0 12px',
    borderRadius: '9px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  paginationButtonDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
  pageIndicator: {
    color: '#64748b',
    fontSize: '13px',
    fontWeight: '700',
    whiteSpace: 'nowrap',
  },
  historyToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '-4px',
  },
  historyRankingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '10px',
  },
  rankingCard: {
    background: '#fff7ed',
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: '#fed7aa',
    borderRightColor: '#fed7aa',
    borderBottomColor: '#fed7aa',
    borderLeftColor: '#fed7aa',
    borderRadius: '12px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    boxShadow: '0 12px 26px rgba(15, 23, 42, 0.04)',
  },
  itemRankingCard: {
    background: '#fff7ed',
    borderTopColor: '#fed7aa',
    borderRightColor: '#fed7aa',
    borderBottomColor: '#fed7aa',
    borderLeftColor: '#fed7aa',
  },
  pickerRankingCard: {
    background: '#eff6ff',
    borderTopColor: '#bfdbfe',
    borderRightColor: '#bfdbfe',
    borderBottomColor: '#bfdbfe',
    borderLeftColor: '#bfdbfe',
  },
  rankingHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },
  rankingBadgeText: {
    borderRadius: '999px',
    padding: '3px 7px',
    background: 'rgba(255, 255, 255, 0.75)',
    color: '#334155',
    fontSize: '11px',
    fontWeight: '800',
  },
  rankingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  rankingRow: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '26px minmax(0, 1fr)',
    alignItems: 'center',
    gap: '8px',
    padding: '6px',
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: 'rgba(148, 163, 184, 0.25)',
    borderRightColor: 'rgba(148, 163, 184, 0.25)',
    borderBottomColor: 'rgba(148, 163, 184, 0.25)',
    borderLeftColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: '10px',
    background: 'rgba(255, 255, 255, 0.82)',
    color: '#0f172a',
    textAlign: 'left',
    cursor: 'pointer',
  },
  rankingRowActive: {
    borderTopColor: '#111827',
    borderRightColor: '#111827',
    borderBottomColor: '#111827',
    borderLeftColor: '#111827',
    background: '#eef2ff',
    boxShadow: 'inset 0 0 0 1px #111827',
  },
  rankNumber: {
    width: '26px',
    height: '26px',
    borderRadius: '999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111827',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '900',
    fontVariantNumeric: 'tabular-nums',
  },
  rankingCopy: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  rankingName: {
    color: '#0f172a',
    fontSize: '12px',
    lineHeight: 1.35,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rankingMeta: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: '700',
  },
  rankingEmpty: {
    margin: 0,
    color: '#64748b',
    fontSize: '13px',
    fontWeight: '600',
  },
  clearButton: {
    height: '40px',
    padding: '0 14px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  loading: {
    color: '#6b7280',
  },
  error: {
    margin: 0,
    color: '#dc2626',
  },
  success: {
    margin: 0,
    color: '#16a34a',
  },
  emptyState: {
    border: '1px dashed #d1d5db',
    borderRadius: '12px',
    padding: '24px',
    color: '#6b7280',
  },
  tableWrap: {
    overflowX: 'auto',
    overflowY: 'auto',
    maxHeight: '560px',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    background: '#fff',
  },
  brandLookupTableWrap: {
    overflowX: 'auto',
    overflowY: 'auto',
    maxHeight: '420px',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    background: '#fff',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    textAlign: 'left',
    padding: '12px 14px',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '13px',
  },
  actionTh: {
    textAlign: 'center',
    width: '148px',
  },
  td: {
    padding: '12px 14px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '14px',
    verticalAlign: 'top',
  },
  centerCell: {
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  actionTd: {
    textAlign: 'center',
    width: '148px',
  },
  cellStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  cellMeta: {
    color: '#64748b',
    fontSize: '12px',
    lineHeight: 1.4,
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'nowrap',
    minWidth: '128px',
  },
  tableIconButton: {
    width: '34px',
    height: '34px',
    borderRadius: '9px',
    border: '1px solid #dbe4ef',
    background: '#fff',
    color: '#0f172a',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  },
  tableIconButtonDark: {
    border: '1px solid #111827',
    background: '#111827',
    color: '#fff',
  },
  tableActionIcon: {
    width: '17px',
    height: '17px',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  editButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '36px',
    padding: '0 14px',
    border: 'none',
    borderRadius: '8px',
    background: '#2563eb',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  takeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '36px',
    padding: '0 14px',
    border: 'none',
    borderRadius: '8px',
    background: '#111827',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 50,
  },
  modalCard: {
    width: '100%',
    maxWidth: '520px',
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
  },
  modalCardWide: {
    width: '100%',
    maxWidth: '1080px',
    maxHeight: 'calc(100vh - 48px)',
    overflowY: 'auto',
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  modalTitleGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  modalEyebrow: {
    margin: 0,
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '800',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    lineHeight: 1.1,
  },
  modalTitle: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '800',
    lineHeight: 1.15,
  },
  modalHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },
  modalCloseButton: {
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    borderRadius: '8px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  modalCancelButton: {
    height: '36px',
    padding: '0 14px',
    borderRadius: '8px',
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#b91c1c',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  modalText: {
    margin: 0,
    color: '#374151',
    lineHeight: 1.5,
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  selectedLocationBox: {
    border: '1px solid #dbeafe',
    background: '#eff6ff',
    borderRadius: '12px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  selectedLocationLabel: {
    color: '#1d4ed8',
    fontSize: '12px',
    fontWeight: '800',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  selectedLocationValue: {
    color: '#111827',
    fontSize: '15px',
  },
  queueConfirmBox: {
    border: '1px solid #dbeafe',
    background: '#eff6ff',
    borderRadius: '14px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  queueConfirmList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '220px',
    overflowY: 'auto',
  },
  queueConfirmRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(100px, 0.7fr) minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '10px',
    border: '1px solid rgba(147, 197, 253, 0.7)',
    background: '#fff',
    borderRadius: '12px',
    padding: '10px',
  },
  queueSkuText: {
    color: '#1d4ed8',
    fontSize: '12px',
    fontWeight: '900',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  queueItemText: {
    minWidth: 0,
    color: '#0f172a',
    fontSize: '13px',
    lineHeight: 1.35,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  queueMetaText: {
    color: '#475569',
    fontSize: '12px',
    fontWeight: '800',
    whiteSpace: 'nowrap',
  },
  takeModalSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.3fr) minmax(110px, 0.7fr)',
    gap: '10px',
  },
  moveSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(180px, 0.8fr)',
    gap: '10px',
  },
  takeModalItemCard: {
    gridRow: 'span 2',
    minWidth: 0,
    border: '1px solid #dbeafe',
    background: '#eff6ff',
    borderRadius: '14px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  takeModalInfoCard: {
    minWidth: 0,
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    borderRadius: '14px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  takeModalItemName: {
    color: '#0f172a',
    fontSize: '15px',
    lineHeight: 1.35,
  },
  takeModalSizeBlock: {
    alignSelf: 'flex-start',
    minWidth: '88px',
    border: '1px solid #bfdbfe',
    background: '#fff',
    borderRadius: '12px',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  takeModalSizeLabel: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  takeModalSizeValue: {
    color: '#0f172a',
    fontSize: '22px',
    lineHeight: 1,
    fontWeight: '900',
  },
  moveMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  moveMetaPill: {
    minHeight: '28px',
    padding: '0 10px',
    borderRadius: '999px',
    border: '1px solid #bfdbfe',
    background: '#fff',
    color: '#0f172a',
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '12px',
    fontWeight: '850',
  },
  takeModalQty: {
    color: '#0f172a',
    fontSize: '28px',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  takeModalLocation: {
    color: '#0f172a',
    fontSize: '13px',
    lineHeight: 1.35,
  },
  takeControlPanel: {
    border: '1px solid #e2e8f0',
    background: '#fff',
    borderRadius: '14px',
    padding: '12px',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },
  takeQtyField: {
    flex: '1 1 190px',
    minWidth: '160px',
  },
  takeAllToggle: {
    minHeight: '44px',
    padding: '0 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#f8fafc',
    color: '#0f172a',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: '800',
    whiteSpace: 'nowrap',
  },
  modalInlineError: {
    width: '100%',
    margin: 0,
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#b91c1c',
    fontSize: '13px',
    fontWeight: '700',
    lineHeight: 1.45,
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  secondaryButton: {
    height: '36px',
    padding: '0 14px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
}
