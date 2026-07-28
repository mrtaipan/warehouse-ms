'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'
import { ADMIN_EMAIL, resolveRole } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import ProductDirectoryClient from '../daftar-barang/product-directory-client'

const supabase = createClient()
const BATCH_SIZE = 1000
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

  return [entry.item_name, entry.sku_id]
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
    new Set(rows.map((row) => String(row.source_variant_code || '').trim()).filter(Boolean))
  )
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

async function fetchAllRackLocations() {
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
}

async function fetchAllWarehouseStorage() {
  const allRows = []
  let from = 0

  while (true) {
    const to = from + BATCH_SIZE - 1
    const { data, error } = await supabase
      .from('warehouse_storage')
      .select('id, rack_location_id, sku_id, item_name, size, qty, notes, created_at')
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
      .select('id, inbound_id, pl_size_breakdown_id, packing_group_key, storing_type, package_type, brand_code, source_variant_code, pl_name, model_name, variant_name, size_label, koli_sequence, qty, packed_by, storage_status, created_at')
      .eq('storage_status', 'queued')
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

async function fetchInboundSummaries() {
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
}

async function fetchUserProfilesByEmail() {
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
}

async function fetchCurrentUserRole() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const emailAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL
  const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, 'role')

  return resolveRole(profile?.role, emailAdmin)
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
  const initialListMode = ['history', 'queue', 'product-directory', 'photo-list'].includes(initialMode) ? initialMode : 'stock'
  const initialRegisterOpen = searchParams.get('register') === '1'
  const initialProductSearch = String(searchParams.get('q') || searchParams.get('search') || '').trim().toUpperCase()
  const [rackLocations, setRackLocations] = useState([])
  const [storageEntries, setStorageEntries] = useState([])
  const [restockHistoryRows, setRestockHistoryRows] = useState([])
  const [storageQueueRows, setStorageQueueRows] = useState([])
  const [inboundRows, setInboundRows] = useState([])
  const [userProfilesByEmail, setUserProfilesByEmail] = useState({})
  const [loading, setLoading] = useState(true)
  const [taking, setTaking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [storingQueue, setStoringQueue] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [takeModalError, setTakeModalError] = useState('')
  const [queueModalError, setQueueModalError] = useState('')
  const [currentRole, setCurrentRole] = useState('')
  const [takeModalEntry, setTakeModalEntry] = useState(null)
  const [editModalEntry, setEditModalEntry] = useState(null)
  const [queueModalEntry, setQueueModalEntry] = useState(null)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(initialRegisterOpen)
  const [activeListMode, setActiveListMode] = useState(initialListMode)
  const [productSearch, setProductSearch] = useState(initialProductSearch)
  const [historyPickerFilter, setHistoryPickerFilter] = useState('')
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
    locationId: '',
    locationCode: '',
    locationName: '',
    subLocation: '',
    size: '',
  })

  const refreshInventoryData = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) {
      setLoading(true)
    }

    try {
      const [rackData, storageData, restockRows, queueRows, inboundData, profileRows, userRole] = await Promise.all([
        fetchAllRackLocations(),
        fetchAllWarehouseStorage(),
        fetchAllRestockHistory(),
        fetchAllStorageQueueRows(),
        fetchInboundSummaries(),
        fetchUserProfilesByEmail(),
        fetchCurrentUserRole(),
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

      setRackLocations(normalizedRackLocations)
      setStorageEntries(storageData || [])
      setRestockHistoryRows(restockRows || [])
      setStorageQueueRows(queueRows || [])
      setInboundRows(inboundData || [])
      setUserProfilesByEmail(profileRows || {})
      setCurrentRole(userRole || '')
      setLoading(false)
    } catch (loadError) {
      if (showLoading) {
        setError(loadError.message || 'Failed to load storage overview.')
      }
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialRefreshId = window.setTimeout(() => {
      refreshInventoryData({ showLoading: true })
    }, 0)

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshInventoryData()
      }
    }, 7000)

    return () => {
      window.clearTimeout(initialRefreshId)
      window.clearInterval(intervalId)
    }
  }, [refreshInventoryData])

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
  const canShowTakeAction = currentRole !== 'storage_staff'

  const productScopedStorageRows = useMemo(() => {
    const normalizedProductSearch = normalizeFilterValue(productSearch)

    if (!normalizedProductSearch) {
      return storageRows
    }

    return storageRows.filter((entry) => storageEntryMatchesProductSearch(entry, normalizedProductSearch))
  }, [productSearch, storageRows])

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

  const registerSubLocationOptions = rackLocations
    .filter(
      (item) =>
        item.location_type === registerForm.locationType &&
        String(item.location_id) === registerForm.locationId &&
        item.location_code === registerForm.locationCode
    )
    .sort((left, right) => naturalSort.compare(String(left.sub_location), String(right.sub_location)))

  const selectedRegisterLocation = registerSubLocationOptions.find(
    (item) => item.sub_location === registerForm.subLocation
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
          items: [],
          totalQty: 0,
        }

      current.items.push(row)
      current.totalQty += Number(row.qty || 0)

      if (!current.created_at || new Date(row.created_at || 0) < new Date(current.created_at || 0)) {
        current.created_at = row.created_at
      }

      groups.set(key, current)
    })

    return Array.from(groups.values()).sort((left, right) => {
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
  const filteredQueueRows = queueGroups.filter((entry) => {
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
  const visibleStockRows = filteredRows.slice(0, 25)
  const visibleHistoryRows = filteredHistoryRows.slice(0, 25)
  const visibleQueueRows = filteredQueueRows.slice(0, 25)
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

  function clearFilters() {
    setFilters({
      locationType: '',
      locationId: '',
      locationCode: '',
      locationName: '',
      subLocation: '',
      size: '',
    })
    setProductSearch('')
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
    setIsRegisterModalOpen(true)
    setError('')
    setSuccess('')
  }

  function closeRegisterModal() {
    setIsRegisterModalOpen(false)
  }

  function openQueueModal(entry) {
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
      return
    }

    if (name === 'locationCode') {
      setRegisterForm((prev) => ({
        ...prev,
        locationCode: value,
        subLocation: '',
      }))
      return
    }

    setRegisterForm((prev) => ({
      ...prev,
      [name]: value,
    }))
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

    const nextQty = Number(registerForm.qty || 0)

    if (nextQty <= 0) {
      setError('Quantity must be greater than 0.')
      setRegistering(false)
      return
    }

    const payload = {
      rack_location_id: selectedRegisterLocation.id,
      item_name: registerForm.itemName.trim(),
      size: normalizeSizeValue(registerForm.size) || null,
      qty: nextQty,
      notes: registerForm.notes.trim() || null,
      updated_by: await getCurrentUserEmail(),
    }

    const { error: insertError } = await supabase.from('warehouse_storage').insert([payload])

    if (insertError) {
      setError(insertError.message)
      setRegistering(false)
      return
    }

    const refreshedStorage = await fetchAllWarehouseStorage()
    setStorageEntries(refreshedStorage || [])
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
    const storagePayload = queueItems.map((item) => ({
      rack_location_id: selectedQueueLocation.id,
      sku_id: String(item.source_variant_code || '').trim() || null,
      item_name: formatStoredQueueItemName(getQueueItemName(item), grnNumber),
      size: normalizeSizeValue(item.size_label) || null,
      qty: Number(item.qty || 0),
      notes:
        queueForm.notes.trim() ||
        `Stored from ${getQueueKoliLabel(queueModalEntry)}${item.source_variant_code ? ` / SKU ${item.source_variant_code}` : ''}`,
      updated_by: storedBy,
    }))

    const { data: insertedRows, error: insertError } = await supabase
      .from('warehouse_storage')
      .insert(storagePayload)
      .select('id')

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

    const [refreshedStorage, refreshedQueue] = await Promise.all([
      fetchAllWarehouseStorage(),
      fetchAllStorageQueueRows(),
    ])

    setStorageEntries(refreshedStorage || [])
    setStorageQueueRows(refreshedQueue || [])
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

    if (!canShowTakeAction) {
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

    const refreshedStorage = await fetchAllWarehouseStorage()
    setStorageEntries(refreshedStorage || [])
    setSuccess('Storage quantity updated successfully.')
    setTaking(false)
    closeTakeModal()
  }

  async function handleEditSubmit(event) {
    event.preventDefault()

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

    const refreshedStorage = await fetchAllWarehouseStorage()
    setStorageEntries(refreshedStorage || [])
    setSuccess('Storage item updated successfully.')
    setEditing(false)
    closeEditModal()
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
            {[
              ['stock', 'Storage Location'],
              ['queue', 'Storage Queue'],
              ['history', 'Pick History'],
              ['product-directory', 'Product Directory'],
              ['photo-list', 'Photo List'],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setActiveListMode(mode)}
                style={{
                  ...styles.storageTabButton,
                  ...(activeListMode === mode ? styles.storageTabButtonActive : {}),
                }}
              >
                <span style={styles.storageTabLabel}>{label}</span>
                {activeListMode === mode ? <span style={styles.storageTabUnderline} /> : null}
              </button>
            ))}
          </div>

          <div style={styles.storageTabPanel}>
        {activeListMode === 'product-directory' || activeListMode === 'photo-list' ? (
          <ProductDirectoryClient
            embedded
            activeSection={activeListMode === 'photo-list' ? 'photo' : 'directory'}
          />
        ) : (
          <>
        <div style={styles.searchToolbar}>
          <div style={styles.field}>
            <label style={styles.label}>Product Search</label>
            <input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value.toUpperCase())}
              style={styles.input}
              placeholder="Search product, GRN, or SKU"
            />
          </div>
          {activeListMode === 'stock' ? (
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
          {activeListMode === 'stock' ? (
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
          {activeListMode === 'history' ? (
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

        {activeListMode === 'stock' ? (
          <>
        <div
          style={{
            ...styles.filtersGrid,
            ...(filters.locationType === 'PALLET'
              ? styles.palletFiltersGrid
              : filters.locationType === 'SHELVING'
                ? styles.shelvingFiltersGrid
                : styles.allStorageFiltersGrid),
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

          <div style={styles.filteredQtyField}>
            <span style={styles.filteredQtyCard}>
              <span style={styles.filteredQtyLabel}>Qty of filtered</span>
              <strong style={styles.filteredQtyValue}>{filteredQty}</strong>
            </span>
          </div>
        </div>

            <div style={styles.filterFooter}>
              <p style={styles.summary}>
                Showing {visibleStockRows.length} most recent of {filteredRows.length} item record(s)
              </p>
            </div>
          </>
        ) : activeListMode === 'queue' ? (
          <div style={styles.historyToolbar}>
            <p style={styles.summary}>
              Showing {visibleQueueRows.length} of {filteredQueueRows.length} storage queue koli
            </p>
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

        {activeListMode === 'stock' ? filteredRows.length === 0 ? (
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
                  <th style={{ ...styles.th, ...styles.actionTh }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleStockRows.map((entry) => (
                  <tr key={entry.id}>
                    <td style={styles.td}>{getLocationLabel(entry.location)}</td>
                    <td style={styles.td}>{entry.item_name}</td>
                    <td style={styles.td}>{entry.size || '-'}</td>
                    <td style={styles.td}>{entry.qty}</td>
                    <td style={{ ...styles.td, ...styles.actionTd }}>
                      <div style={styles.actionGroup}>
                        <button
                          type="button"
                          onClick={() => openEditModal(entry)}
                          style={styles.editButton}
                        >
                          Edit
                        </button>
                        {canShowTakeAction ? (
                          <button
                            type="button"
                            onClick={() => openTakeModal(entry)}
                            style={styles.takeButton}
                          >
                            Take
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {activeListMode === 'queue' ? filteredQueueRows.length === 0 ? (
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
                  <th style={{ ...styles.th, ...styles.actionTh }}>Action</th>
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
                      <td style={{ ...styles.td, ...styles.actionTd }}>
                        <button
                          type="button"
                          onClick={() => openQueueModal(entry)}
                          style={styles.queueStoreButton}
                        >
                          Store
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {activeListMode === 'history' ? filteredHistoryRows.length === 0 ? (
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
        {activeListMode === 'history' ? renderHistoryRankingPanel() : null}
          </>
        )}
          </div>
        </div>
      </div>

      {isRegisterModalOpen ? (
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
                  <select
                    name="locationCode"
                    value={registerForm.locationCode}
                    onChange={handleRegisterSelectChange}
                    style={!registerForm.locationId ? { ...styles.select, ...styles.controlDisabled } : styles.select}
                    disabled={!registerForm.locationId}
                    required
                  >
                    <option value="">Select location code</option>
                    {registerLocationCodeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Carton Number</label>
                  <select
                    name="subLocation"
                    value={registerForm.subLocation}
                    onChange={handleRegisterSelectChange}
                    style={!registerForm.locationCode ? { ...styles.select, ...styles.controlDisabled } : styles.select}
                    disabled={!registerForm.locationCode}
                    required
                  >
                    <option value="">Select sub location</option>
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
                <label style={styles.label}>Item Name</label>
                <input
                  name="itemName"
                  value={registerForm.itemName}
                  onChange={handleRegisterInputChange}
                  style={styles.input}
                  placeholder="ITEM NAME"
                  required
                />
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

      {queueModalEntry ? (
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
                    <span style={styles.queueSkuText}>{item.source_variant_code || '-'}</span>
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

      {takeModalEntry ? (
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

      {editModalEntry ? (
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))',
    gap: '10px',
    alignItems: 'end',
    minWidth: 0,
    maxWidth: '100%',
  },
  palletFiltersGrid: {
    gridTemplateColumns: 'minmax(210px, 1.05fr) minmax(132px, 0.9fr) minmax(118px, 0.8fr) minmax(118px, 0.8fr) minmax(112px, 0.7fr) minmax(112px, 0.6fr)',
  },
  shelvingFiltersGrid: {
    gridTemplateColumns: 'minmax(210px, 0.9fr) minmax(180px, 1.2fr) minmax(112px, 0.7fr) minmax(112px, 0.6fr)',
    justifyContent: 'flex-start',
    alignItems: 'end',
  },
  allStorageFiltersGrid: {
    gridTemplateColumns: '210px 112px 112px',
    justifyContent: 'flex-start',
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
    gridTemplateColumns: 'minmax(240px, 1fr) minmax(160px, auto) minmax(44px, auto)',
    gap: '12px',
    alignItems: 'flex-end',
  },
  toolbarActionField: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minHeight: '44px',
    minWidth: 0,
  },
  toolbarIconField: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
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
    justifyContent: 'flex-start',
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
  },
  td: {
    padding: '12px 14px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '14px',
    verticalAlign: 'top',
  },
  actionTd: {
    textAlign: 'center',
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
    minWidth: '116px',
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
    maxWidth: '760px',
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
