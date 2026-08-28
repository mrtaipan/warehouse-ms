'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

const supabase = createClient()
const BATCH_SIZE = 1000
const naturalSort = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})
const PAGE_SIZE_OPTIONS = [25, 50, 100, 250]
const PACKING_ITEM_SELECT_COLUMNS = [
  'id',
  'inbound_id',
  'pl_size_breakdown_id',
  'product_model_id',
  'product_model_variant_id',
  'storing_type',
  'brand_code',
  'source_variant_code',
  'pl_name',
  'model_name',
  'variant_name',
  'qty',
  'storage_status',
  'created_at',
  'release_status',
  'released_at',
  'released_by',
  'release_count',
  'release_history',
  'pl_detail_seq',
  'detail_order',
  'pl_photo_url',
  'photo_url',
  'variant_photo_url',
].join(', ')
const BREAKDOWN_SELECT_COLUMNS = [
  'id',
  'inbound_id',
  'product_model_id',
  'product_model_variant_id',
  'source_variant_code',
  'pl_name',
  'model_name',
  'variant_name',
  'category_id',
  'pl_detail_seq',
  'detail_order',
  'pl_photo_url',
  'photo_url',
  'variant_photo_url',
  'pl_notes',
].join(', ')
const PRODUCT_MODEL_SELECT_COLUMNS = 'id, brand_id, category_id, model_name, model_code, photo_url'
const PRODUCT_VARIANT_SELECT_COLUMNS = [
  'id',
  'product_model_id',
  'variant_code',
  'variant_name',
  'selling_name',
  'merged_into_variant_id',
  'variant_notes',
  'variant_photo_url',
  'photo_url',
].join(', ')
const IDENTITY_EVENT_SELECT_COLUMNS = 'id, event_type, source_variant_ids, target_variant_id, detail_assignments, created_at'
const RELEASE_STATE_SELECT_COLUMNS = [
  'id',
  'product_model_variant_id',
  'storing_type',
  'release_status',
  'released_at',
  'released_by',
  'release_count',
  'release_history',
  'updated_at',
].join(', ')
const BRAND_SELECT_COLUMNS = 'id, brand_code, brand_name, is_active'
const CATEGORY_SELECT_COLUMNS = 'id, parent_id, category_name, name, full_name, full_code'

function normalize(value) {
  return String(value || '').trim()
}

function normalizeUpper(value) {
  return normalize(value).toUpperCase()
}

function normalizeKey(value) {
  return normalizeUpper(value).replace(/\s+/g, ' ')
}

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatDateTime(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getDateValue(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDetailGrnLabel(grnNumber) {
  const normalizedGrn = normalize(grnNumber) || '-'
  return normalizedGrn
}

function getGrnLink(grnNumber, detailLabel = '') {
  const normalizedGrn = normalize(grnNumber)
  const normalizedDetail = normalize(detailLabel)
  const params = new URLSearchParams()

  if (normalizedGrn) {
    params.set('grn', normalizedGrn)
  }

  if (normalizedDetail && normalizedDetail !== normalizedGrn) {
    params.set('detail', normalizedDetail)
  }

  return `/dashboard/packing-list/size-breakdown?${params.toString()}`
}

function getDetailCategoryLabel(categoryParts = {}) {
  return [categoryParts.itemType, categoryParts.subCategory]
    .map((part) => normalize(part))
    .filter((part) => part && part !== '-')
    .join(' ') || '-'
}

function getReleaseState(row = {}) {
  const rawStatus = normalizeUpper(row.release_status || row.product_release_status || row.product_status || '')

  if (rawStatus.includes('RELEASED') || row.released_at) {
    return 'released'
  }

  return 'draft'
}

function getReleaseMeta(row = {}) {
  const history = normalizeReleaseHistory(row.release_history)
  const latestHistory = history
    .filter((item) => item?.released_at)
    .sort((left, right) => new Date(right.released_at || 0) - new Date(left.released_at || 0))[0]

  return {
    releasedAt: latestHistory?.released_at || row.released_at || '',
    releasedBy: latestHistory?.released_by || row.released_by || '',
  }
}

function normalizeReleaseHistory(value) {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return normalizeReleaseHistory(parsed)
    } catch {
      return []
    }
  }

  if (typeof value === 'object') {
    if (Array.isArray(value.events)) {
      return value.events.filter(Boolean)
    }

    return [value]
  }

  return []
}

function getReleaseCount(row = {}) {
  const count = Number(row.release_count || 0)

  if (Number.isFinite(count) && count > 0) {
    return count
  }

  return getReleaseState(row) === 'released' ? 1 : 0
}

function appendVariantReleaseHistory(variant = {}, releaseEvent = {}) {
  return [
    ...normalizeReleaseHistory(variant.release_history),
    releaseEvent,
  ]
}

function normalizeStoringType(value) {
  const storingType = normalizeUpper(value)
  if (storingType === 'MOB' || storingType === 'OI') return storingType
  return ''
}

function getRowStoringType(row = {}) {
  return normalizeStoringType(row.storing_type) || 'MOB'
}

function getVariantReleaseStateKey(variantId, storingType) {
  const normalizedVariantId = Number(variantId || 0)
  const normalizedStoringType = normalizeStoringType(storingType)
  return normalizedVariantId && normalizedStoringType ? `${normalizedVariantId}:${normalizedStoringType}` : ''
}

function getModelTypeReleaseSource(variant = {}, storingType = '', lookup = {}, fallbackRow = null) {
  const variantId = Number(variant?.id || 0)
  const releaseKey = getVariantReleaseStateKey(variantId, storingType)
  if (!releaseKey) return null

  const releaseState = lookup.variantReleaseStateByKey?.get(releaseKey)
  if (releaseState) return releaseState

  if (fallbackRow && getReleaseState(fallbackRow) === 'released') {
    return {
      ...fallbackRow,
      product_model_variant_id: variantId,
      storing_type: normalizeStoringType(storingType),
    }
  }

  return {
    product_model_variant_id: variantId,
    storing_type: normalizeStoringType(storingType),
    release_status: 'draft',
    release_count: 0,
    release_history: [],
  }
}

function getSortedReleaseHistory(value) {
  return normalizeReleaseHistory(value)
    .filter((item) => item && typeof item === 'object')
    .sort((left, right) => new Date(right.released_at || 0) - new Date(left.released_at || 0))
}

function getReleaseEventKey(event = {}, index = 0) {
  const key = [
    event.release_count,
    event.released_at,
    event.released_by,
    event.qty,
    Array.isArray(event.grns) ? event.grns.join(',') : '',
    Array.isArray(event.pl_packing_item_ids) ? event.pl_packing_item_ids.join(',') : '',
  ]
    .map((part) => normalize(part))
    .join('::')

  return key.replace(/:/g, '') ? key : `release-event-${index}`
}

function mergeReleaseHistory(left = [], right = []) {
  const merged = new Map()

  getSortedReleaseHistory([...normalizeReleaseHistory(left), ...normalizeReleaseHistory(right)]).forEach((event, index) => {
    merged.set(getReleaseEventKey(event, index), event)
  })

  return Array.from(merged.values())
}

function getReleaseEventGrns(event = {}) {
  if (Array.isArray(event.grns)) {
    return event.grns.filter(Boolean)
  }

  if (Array.isArray(event.grn_numbers)) {
    return event.grn_numbers.filter(Boolean)
  }

  return []
}

function getReleaseStateFromSet(states) {
  if (!states || states.size === 0) return ''

  if (states.has('partial')) return 'partial'

  return states.has('draft') ? 'draft' : 'released'
}

function getCombinedReleaseState(states) {
  if (!states || states.size === 0) return ''

  if (states.has('draft') && states.has('released')) {
    return 'partial'
  }

  return states.has('released') ? 'released' : 'draft'
}

function numberToAlphabet(value) {
  let number = Math.max(1, Number(value || 1))
  let result = ''

  while (number > 0) {
    number -= 1
    result = String.fromCharCode(65 + (number % 26)) + result
    number = Math.floor(number / 26)
  }

  return result
}

function getMinFinite(values = []) {
  const finiteValues = values.filter((value) => Number.isFinite(value))
  return finiteValues.length ? Math.min(...finiteValues) : 0
}

function isSchemaColumnError(error) {
  const message = normalizeUpper(error?.message || error?.details || '')
  return (
    message.includes('SCHEMA CACHE') ||
    message.includes('COULD NOT FIND') ||
    message.includes('DOES NOT EXIST') ||
    (message.includes('COLUMN') && message.includes('NOT'))
  )
}

async function fetchAllRows(tableName, selectColumns = '*', orderColumn = 'id') {
  const allRows = []
  let from = 0

  while (true) {
    const to = from + BATCH_SIZE - 1
    let query = supabase.from(tableName).select(selectColumns).range(from, to)

    if (orderColumn) {
      query = query.order(orderColumn, { ascending: true })
    }

    const { data, error } = await query

    if (error) {
      if (selectColumns !== '*' && isSchemaColumnError(error)) {
        return fetchAllRows(tableName, '*', orderColumn)
      }

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

async function fetchOptionalRows(tableName, selectColumns = '*', orderColumn = 'id') {
  try {
    return await fetchAllRows(tableName, selectColumns, orderColumn)
  } catch (fetchError) {
    const message = normalizeUpper(fetchError?.message || '')
    if (
      message.includes('DOES NOT EXIST') ||
      message.includes('SCHEMA CACHE') ||
      message.includes('RELATION') ||
      message.includes('404')
    ) {
      return []
    }

    throw fetchError
  }
}

function getMapById(rows) {
  return new Map((rows || []).map((row) => [Number(row.id), row]))
}

function getBrandLabel(row, model, brandById, brandByCode) {
  const brandFromModel = brandById.get(Number(model?.brand_id))
  if (brandFromModel) {
    return normalize(brandFromModel.brand_name || brandFromModel.brand_code) || 'Unbranded'
  }

  const brandFromCode = brandByCode.get(normalizeUpper(row.brand_code))
  if (brandFromCode) {
    return normalize(brandFromCode.brand_name || brandFromCode.brand_code) || 'Unbranded'
  }

  return normalize(row.brand_code) || 'Unbranded'
}

function getCategoryLabel(categoryId, categoryById) {
  const category = categoryById.get(Number(categoryId))
  if (!category) return 'Uncategorized'

  return (
    normalize(category.full_name) ||
    normalize(category.full_code) ||
    normalize(category.category_name) ||
    `Category ${category.id}`
  )
}

function getCategoryPath(category = {}, categoryById = new Map()) {
  if (!category) return []

  const path = []
  const visited = new Set()
  let current = category

  while (current?.id && !visited.has(Number(current.id))) {
    visited.add(Number(current.id))
    path.unshift(normalize(current.category_name || current.name))
    current = categoryById.get(Number(current.parent_id || 0))
  }

  const cleanPath = path.filter(Boolean)
  if (cleanPath.length > 1) return cleanPath

  const fullName = normalize(category.full_name)
  if (fullName.includes('>')) {
    return fullName.split('>').map((item) => item.trim()).filter(Boolean)
  }

  return cleanPath.length ? cleanPath : fullName ? [fullName] : []
}

function getCategoryParts(categoryId, categoryById) {
  const category = categoryById.get(Number(categoryId))
  const categoryPath = getCategoryPath(category, categoryById)
  const fallbackCategory = getCategoryLabel(categoryId, categoryById)

  return {
    categoryRoot: categoryPath[0] || fallbackCategory || 'Uncategorized',
    subCategory: categoryPath[1] || '-',
    itemType: categoryPath[2] || '-',
    categoryPathLabel: categoryPath.length ? categoryPath.join(' > ') : fallbackCategory,
  }
}

function getProductName(row, breakdown, model, variant) {
  return (
    normalize(variant?.selling_name) ||
    normalizeUpper(row.pl_name) ||
    normalizeUpper(breakdown?.pl_name) ||
    normalizeUpper(row.variant_name) ||
    normalizeUpper(variant?.variant_name || variant?.variant_label || variant?.variant_code) ||
    normalizeUpper(row.model_name) ||
    normalizeUpper(model?.model_name || model?.model_code) ||
    'PL ITEM'
  )
}

function getPlDisplayName(row, breakdown, model, variant) {
  return (
    normalizeUpper(row.pl_name) ||
    normalizeUpper(breakdown?.pl_name) ||
    normalizeUpper(row.variant_name) ||
    normalizeUpper(breakdown?.variant_name) ||
    normalizeUpper(variant?.variant_name || variant?.variant_label || variant?.variant_code) ||
    normalizeUpper(row.model_name) ||
    normalizeUpper(model?.model_name || model?.model_code) ||
    'PL ITEM'
  )
}

function getCanonicalVariant(variant, variantById) {
  if (!variant?.id) return variant || null

  let current = variant
  const visited = new Set()

  while (current?.merged_into_variant_id && !visited.has(Number(current.id))) {
    visited.add(Number(current.id))
    const nextVariant = variantById.get(Number(current.merged_into_variant_id))
    if (!nextVariant) break
    current = nextVariant
  }

  return current || variant
}

function getSelectedSku(sourceSku, selectedVariant) {
  return normalize(selectedVariant?.variant_code || selectedVariant?.variant_label || sourceSku) || '-'
}

function normalizeDetailAssignments(value) {
  if (Array.isArray(value)) return value
  if (!value) return []

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function getSourceDetailSeq(row = {}, breakdown = {}) {
  return Number(
    row.pl_detail_seq ||
    breakdown?.pl_detail_seq ||
    row.detail_order ||
    breakdown?.detail_order ||
    1
  )
}

function getSplitDetailKey(sourceVariantId, inboundId, sourceDetailSeq) {
  return [
    Number(sourceVariantId || 0),
    Number(inboundId || 0),
    Number(sourceDetailSeq || 1),
  ].join(':')
}

function getSplitAssignmentForRow(row = {}, breakdown = {}, lookup = {}) {
  const sourceVariantId = Number(row.product_model_variant_id || breakdown?.product_model_variant_id || 0)
  const inboundId = Number(row.inbound_id || breakdown?.inbound_id || 0)
  if (!sourceVariantId || !inboundId) return null

  const assignmentKey = getSplitDetailKey(
    sourceVariantId,
    inboundId,
    getSourceDetailSeq(row, breakdown)
  )
  return lookup.splitAssignmentByDetailKey?.get(assignmentKey) || null
}

function getAssignedVariantForRow(row = {}, breakdown = {}, lookup = {}, fallbackVariant = null) {
  const assignment = getSplitAssignmentForRow(row, breakdown, lookup)
  const assignedVariantId = Number(assignment?.assigned_variant_id || 0)
  if (!assignedVariantId) return fallbackVariant
  return lookup.variantById?.get(assignedVariantId) || fallbackVariant
}

function getAssignedSkuForRow(row = {}, breakdown = {}, lookup = {}, fallbackSku = '') {
  const assignment = getSplitAssignmentForRow(row, breakdown, lookup)
  const assignedVariant = lookup.variantById?.get(Number(assignment?.assigned_variant_id || 0))
  const canonicalVariant = getCanonicalVariant(assignedVariant, lookup.variantById)
  return normalize(
    canonicalVariant?.variant_code ||
    canonicalVariant?.variant_label ||
    assignment?.assigned_variant_code ||
    fallbackSku
  ) || '-'
}

function getSelectedProductName(row, breakdown, model, sourceVariant, selectedVariant) {
  const sourceVariantId = Number(sourceVariant?.id || 0)
  const selectedVariantId = Number(selectedVariant?.id || 0)
  const selectedVariantName =
    normalize(selectedVariant?.selling_name) ||
    normalizeUpper(selectedVariant?.variant_name || selectedVariant?.variant_label || selectedVariant?.variant_code)

  if (sourceVariantId && selectedVariantId && sourceVariantId !== selectedVariantId && selectedVariantName) {
    return selectedVariantName
  }

  return getProductName(row, breakdown, model, selectedVariant || sourceVariant)
}

function getProductPhotoUrl(row, breakdown, model, variant) {
  return (
    normalize(row.pl_photo_url) ||
    normalize(row.photo_url) ||
    normalize(row.variant_photo_url) ||
    normalize(breakdown?.pl_photo_url) ||
    normalize(breakdown?.photo_url) ||
    normalize(breakdown?.variant_photo_url) ||
    normalize(variant?.variant_photo_url) ||
    normalize(variant?.photo_url) ||
    normalize(model?.photo_url) ||
    ''
  )
}

function getResolvedProductPhotoUrl(row, breakdown, model, sourceVariant, selectedVariant) {
  const sourceVariantId = Number(sourceVariant?.id || 0)
  const selectedVariantId = Number(selectedVariant?.id || 0)
  const usesResolvedIdentity = sourceVariantId && selectedVariantId && sourceVariantId !== selectedVariantId

  if (usesResolvedIdentity) {
    return (
      normalize(selectedVariant?.variant_photo_url) ||
      normalize(selectedVariant?.photo_url) ||
      normalize(model?.photo_url) ||
      ''
    )
  }

  return getProductPhotoUrl(row, breakdown, model, selectedVariant || sourceVariant)
}

function getResolvedVariantNotes(breakdown, sourceVariant, selectedVariant) {
  const sourceVariantId = Number(sourceVariant?.id || 0)
  const selectedVariantId = Number(selectedVariant?.id || 0)
  if (sourceVariantId && selectedVariantId && sourceVariantId !== selectedVariantId) {
    return normalize(selectedVariant?.variant_notes)
  }

  return normalize(breakdown?.pl_notes || selectedVariant?.variant_notes || sourceVariant?.variant_notes)
}

function buildProductKey(row, breakdown, model, variant, brand, productName) {
  const variantId = Number(row.product_model_variant_id || breakdown?.product_model_variant_id || variant?.id || 0)

  if (variantId) {
    return `variant:${variantId}`
  }

  const modelName = normalizeKey(row.model_name || breakdown?.model_name || model?.model_name)
  const variantName = normalizeKey(row.variant_name || breakdown?.variant_name || variant?.variant_name)
  return `fallback:${normalizeKey(brand)}:${normalizeKey(productName)}:${modelName}:${variantName}`
}

export default function ProductDirectoryClient({ embedded = false, activeSection = 'directory', canManage = true }) {
  const [packingRows, setPackingRows] = useState([])
  const [inboundRows, setInboundRows] = useState([])
  const [breakdownRows, setBreakdownRows] = useState([])
  const [warehouseStorageRows, setWarehouseStorageRows] = useState([])
  const [identityEvents, setIdentityEvents] = useState([])
  const [productModels, setProductModels] = useState([])
  const [productVariants, setProductVariants] = useState([])
  const [productVariantReleaseStates, setProductVariantReleaseStates] = useState([])
  const [brands, setBrands] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    type: 'all',
    viewMode: 'grn',
    grn: '',
    brand: '',
    category: '',
    subCategory: '',
    itemType: '',
    search: '',
    releaseStatus: 'all',
  })
  const [sortConfig, setSortConfig] = useState({
    key: 'brand',
    direction: 'asc',
  })
  const [selectedProductKeys, setSelectedProductKeys] = useState([])
  const [bulkWorking, setBulkWorking] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [openFilterMenu, setOpenFilterMenu] = useState('')
  const [filterSearches, setFilterSearches] = useState({})
  const [pageSize, setPageSize] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)
  const [sellingNameEditor, setSellingNameEditor] = useState(null)
  const [sellingNameDraft, setSellingNameDraft] = useState('')
  const [mergeEditor, setMergeEditor] = useState(null)
  const [mergeTargetVariantId, setMergeTargetVariantId] = useState('')
  const [confirmDialog, setConfirmDialog] = useState(null)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      try {
        const [
          nextPackingRows,
          nextInboundRows,
          nextBreakdownRows,
          nextWarehouseStorageRows,
          nextIdentityEvents,
          nextProductModels,
          nextProductVariants,
          nextProductVariantReleaseStates,
          nextBrands,
          nextCategories,
        ] = await Promise.all([
          fetchAllRows('pl_packing_items', PACKING_ITEM_SELECT_COLUMNS, 'created_at'),
          fetchAllRows('inbound', 'id, grn_number, inbound_date, item_name, created_at', 'created_at'),
          fetchAllRows('pl_size_breakdown', BREAKDOWN_SELECT_COLUMNS, 'id'),
          fetchAllRows('warehouse_storage', 'sku_id, qty', 'created_at'),
          fetchOptionalRows('product_variant_identity_events', IDENTITY_EVENT_SELECT_COLUMNS, 'created_at'),
          fetchAllRows('dir_product_models', PRODUCT_MODEL_SELECT_COLUMNS, 'id'),
          fetchAllRows('dir_product_model_variants', PRODUCT_VARIANT_SELECT_COLUMNS, 'id'),
          fetchOptionalRows('dir_product_model_variant_release_states', RELEASE_STATE_SELECT_COLUMNS, 'id'),
          fetchAllRows('dir_brands', BRAND_SELECT_COLUMNS, 'id'),
          fetchAllRows('dir_categories', CATEGORY_SELECT_COLUMNS, 'id'),
        ])

        setPackingRows(nextPackingRows)
        setInboundRows(nextInboundRows)
        setBreakdownRows(nextBreakdownRows)
        setWarehouseStorageRows(nextWarehouseStorageRows)
        setIdentityEvents(nextIdentityEvents)
        setProductModels(nextProductModels)
        setProductVariants(nextProductVariants)
        setProductVariantReleaseStates(nextProductVariantReleaseStates)
        setBrands(nextBrands)
        setCategories(nextCategories)
      } catch (loadError) {
        setError(loadError.message || 'Failed to load Product List.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const lookup = useMemo(() => {
    const splitAssignmentByDetailKey = new Map()
    const splitSourceVariantIds = new Set()
    const storageQtyBySku = new Map()
    const variantReleaseStateByKey = new Map()

    ;(warehouseStorageRows || []).forEach((entry) => {
      const sku = normalizeUpper(entry.sku_id)
      if (!sku) return

      storageQtyBySku.set(sku, Number(storageQtyBySku.get(sku) || 0) + Number(entry.qty || 0))
    })

    ;(productVariantReleaseStates || []).forEach((state) => {
      const releaseKey = getVariantReleaseStateKey(state.product_model_variant_id, state.storing_type)
      if (!releaseKey) return

      variantReleaseStateByKey.set(releaseKey, state)
    })

    ;(identityEvents || []).forEach((event) => {
      if (normalizeUpper(event.event_type) !== 'SPLIT') return

      const eventSourceVariantIds = (event.source_variant_ids || []).map(Number).filter(Boolean)
      eventSourceVariantIds.forEach((variantId) => splitSourceVariantIds.add(variantId))

      normalizeDetailAssignments(event.detail_assignments).forEach((assignment) => {
        const sourceVariantId = Number(assignment.source_variant_id || eventSourceVariantIds[0] || 0)
        const inboundId = Number(assignment.inbound_id || 0)
        const sourceDetailSeq = Number(assignment.source_detail_seq || 1)
        const assignedVariantId = Number(assignment.assigned_variant_id || 0)
        if (!sourceVariantId || !inboundId || !assignedVariantId) return

        splitAssignmentByDetailKey.set(
          getSplitDetailKey(sourceVariantId, inboundId, sourceDetailSeq),
          {
            ...assignment,
            id: Number(event.id || 0),
            event_id: Number(event.id || 0),
            source_variant_id: sourceVariantId,
            inbound_id: inboundId,
            source_detail_seq: sourceDetailSeq,
            assigned_variant_id: assignedVariantId,
          }
        )
      })
    })

    return {
      inboundById: getMapById(inboundRows),
      breakdownById: getMapById(breakdownRows),
      modelById: getMapById(productModels),
      variantById: getMapById(productVariants),
      splitAssignmentByDetailKey,
      splitSourceVariantIds,
      brandById: getMapById(brands),
      brandByCode: new Map((brands || []).map((brand) => [normalizeUpper(brand.brand_code), brand])),
      categoryById: getMapById(categories),
      storageQtyBySku,
      variantReleaseStateByKey,
    }
  }, [brands, breakdownRows, categories, identityEvents, inboundRows, productModels, productVariantReleaseStates, productVariants, warehouseStorageRows])

  const groupedProducts = useMemo(() => {
    const groups = new Map()

    packingRows.forEach((row) => {
      const storingType = getRowStoringType(row)

      if (filters.type !== 'all' && storingType !== normalizeUpper(filters.type)) {
        return
      }

      const breakdown = lookup.breakdownById.get(Number(row.pl_size_breakdown_id))
      const modelId = Number(row.product_model_id || breakdown?.product_model_id || 0)
      const variantId = Number(row.product_model_variant_id || breakdown?.product_model_variant_id || 0)
      const model = lookup.modelById.get(modelId)
      const variant = lookup.variantById.get(variantId)
      const assignedVariant = getAssignedVariantForRow(row, breakdown, lookup, variant)
      const selectedVariant = getCanonicalVariant(assignedVariant, lookup.variantById)
      const selectedVariantId = Number(selectedVariant?.id || variantId || 0)
      const releaseVariant = selectedVariant || variant || (selectedVariantId ? { id: selectedVariantId } : null)
      const brand = getBrandLabel(row, model, lookup.brandById, lookup.brandByCode)
      const categoryParts = getCategoryParts(model?.category_id || breakdown?.category_id, lookup.categoryById)
      const detailCategoryLabel = getDetailCategoryLabel(categoryParts)
      const sourceSku = normalize(row.source_variant_code || breakdown?.source_variant_code || variant?.variant_code || variant?.variant_label) || '-'
      const selectedSku = getAssignedSkuForRow(row, breakdown, lookup, getSelectedSku(sourceSku, selectedVariant))
      const sourceProductName = getProductName(row, breakdown, model, variant)
      const selectedProductName = getSelectedProductName(row, breakdown, model, variant, selectedVariant)
      const productName = selectedProductName
      const plDisplayName = getPlDisplayName(row, breakdown, model, variant)
      const productKey = buildProductKey(row, breakdown, model, selectedVariant, brand, productName)
      const inbound = lookup.inboundById.get(Number(row.inbound_id))
      const grnNumber = normalize(inbound?.grn_number) || '-'
      const detailGrn = getDetailGrnLabel(grnNumber)
      const photoUrl = getResolvedProductPhotoUrl(row, breakdown, model, variant, selectedVariant)
      const batchReleaseState = getReleaseState(row)
      const modelReleaseSource = filters.viewMode === 'model'
        ? getModelTypeReleaseSource(releaseVariant, storingType, lookup, row)
        : null
      const releaseSource = filters.viewMode === 'grn' ? row : modelReleaseSource
      const releaseState = releaseSource ? getReleaseState(releaseSource) : ''
      const releaseCount = releaseSource ? getReleaseCount(releaseSource) : 0
      const releaseMeta = releaseSource ? getReleaseMeta(releaseSource) : { releasedAt: '', releasedBy: '' }
      const releaseHistory = filters.viewMode === 'model' && releaseSource
        ? getSortedReleaseHistory(releaseSource.release_history)
        : []

      const shouldApplyReleaseStatus = filters.viewMode === 'grn' || filters.type !== 'all'
      if (shouldApplyReleaseStatus && filters.releaseStatus !== 'all' && releaseState !== filters.releaseStatus) {
        return
      }

      if (filters.grn && grnNumber !== filters.grn) return
      if (filters.brand && brand !== filters.brand) return
      if (filters.category && categoryParts.categoryRoot !== filters.category) return
      if (filters.subCategory && categoryParts.subCategory !== filters.subCategory) return
      if (filters.itemType && categoryParts.itemType !== filters.itemType) return

      if (normalizeUpper(filters.search)) {
        const searchable = [
          productName,
          brand,
          categoryParts.categoryRoot,
          categoryParts.subCategory,
          categoryParts.itemType,
          detailCategoryLabel,
          selectedProductName,
          sourceProductName,
          selectedSku,
          sourceSku,
          grnNumber,
        ]
          .map(normalizeUpper)
          .join(' ')

        if (!searchable.includes(normalizeUpper(filters.search))) return
      }

      const normalizedSku = normalizeUpper(selectedSku)
      const groupKey = filters.viewMode === 'grn'
        ? `grn:${grnNumber}`
        : selectedVariantId ? `variant:${selectedVariantId}` : normalizedSku && normalizedSku !== '-' ? `sku:${normalizedSku}` : productKey
      const group =
        groups.get(groupKey) || {
          key: groupKey,
          productName: filters.viewMode === 'grn' ? 'Multiple products' : productName,
          productModelId: filters.viewMode === 'grn' ? 0 : modelId,
          productModelVariantId: filters.viewMode === 'grn' ? 0 : selectedVariantId,
          sku: selectedSku,
          sourceVariantCode: selectedSku,
          sellingName: filters.viewMode === 'grn' ? '' : normalize(selectedVariant?.selling_name),
          variantName: normalize(selectedVariant?.variant_name || selectedVariant?.variant_label || selectedVariant?.variant_code || row.variant_name || breakdown?.variant_name) || productName,
          brand: filters.viewMode === 'grn' ? 'Multiple brands' : brand,
          category: filters.viewMode === 'grn' ? 'Multiple categories' : categoryParts.categoryRoot,
          subCategory: filters.viewMode === 'grn' ? '-' : categoryParts.subCategory,
          itemType: filters.viewMode === 'grn' ? '-' : categoryParts.itemType,
          categoryPathLabel: filters.viewMode === 'grn' ? 'Multiple categories' : categoryParts.categoryPathLabel,
          primaryGrn: grnNumber,
          totalQty: 0,
          mobQty: 0,
          oiQty: 0,
          grns: new Set(),
          plDates: new Set(),
          products: new Set(),
          brands: new Set(),
          categories: new Set(),
          categoryRoots: new Set(),
          subCategories: new Set(),
          itemTypes: new Set(),
          detailItems: new Map(),
          releaseStates: new Set(),
          releaseCount: 0,
          releaseHistory: [],
          latestReleasedAt: '',
          latestReleasedBy: '',
          storageQty: filters.viewMode === 'model' ? Number(lookup.storageQtyBySku.get(normalizedSku) || 0) : 0,
          unreleasedQueuedQty: 0,
          earliestDate: '',
          latestDate: '',
        }

      if (filters.viewMode === 'model' && selectedVariantId) {
        group.productName = productName
        group.sku = selectedSku
        group.sellingName = normalize(selectedVariant?.selling_name)
        group.variantName = normalize(selectedVariant?.variant_name || selectedVariant?.variant_label || selectedVariant?.variant_code || group.variantName) || group.variantName
      }

      const qty = Number(row.qty || 0)
      group.totalQty += qty
      if (
        filters.viewMode === 'model' &&
        releaseState === 'released' &&
        batchReleaseState !== 'released' &&
        normalizeUpper(row.storage_status) !== 'STORED'
      ) {
        group.unreleasedQueuedQty += qty
      }

      if (storingType === 'OI') {
        group.oiQty += qty
      } else {
        group.mobQty += qty
      }

      group.grns.add(grnNumber)
      group.products.add(productName)
      group.brands.add(brand)
      group.categories.add(detailCategoryLabel)
      group.categoryRoots.add(categoryParts.categoryRoot)
      if (categoryParts.subCategory && categoryParts.subCategory !== '-') {
        group.subCategories.add(categoryParts.subCategory)
      }
      if (categoryParts.itemType && categoryParts.itemType !== '-') {
        group.itemTypes.add(categoryParts.itemType)
      }
      if (releaseState) {
        group.releaseStates.add(releaseState)
      }
      group.releaseCount = Math.max(Number(group.releaseCount || 0), releaseCount)
      if (releaseHistory.length) {
        group.releaseHistory = mergeReleaseHistory(group.releaseHistory, releaseHistory)
      }
      if (releaseMeta.releasedAt && (!group.latestReleasedAt || new Date(releaseMeta.releasedAt) > new Date(group.latestReleasedAt))) {
        group.latestReleasedAt = releaseMeta.releasedAt
        group.latestReleasedBy = releaseMeta.releasedBy
      }

      const detailKeyProductName = productName
      const detailKeySku = selectedSku
      const detailKeyParts = filters.type === 'all'
        ? [detailGrn, detailKeySku, brand, detailKeyProductName, detailCategoryLabel]
        : [detailGrn, detailKeySku, brand, detailKeyProductName, detailCategoryLabel, storingType]
      const detailKey = detailKeyParts.map(normalizeUpper).join('::')
      const detailItem =
        group.detailItems.get(detailKey) || {
          key: detailKey,
          grn: detailGrn,
          baseGrn: grnNumber,
          sku: selectedSku,
          brand,
          productName,
          categoryLabel: detailCategoryLabel,
          photoUrl,
          type: storingType,
          productModelId: modelId,
          productModelVariantId: selectedVariantId,
          sourceProductModelVariantId: variantId,
          sourceMergedIntoVariantId: Number(variant?.merged_into_variant_id || 0),
          sourceVariantCode: selectedSku,
          sellingName: normalize(selectedVariant?.selling_name),
          variantName: normalize(selectedVariant?.variant_name || selectedVariant?.variant_label || selectedVariant?.variant_code || row.variant_name || breakdown?.variant_name) || productName,
          variantNotes: getResolvedVariantNotes(breakdown, variant, selectedVariant),
          variantPhotoUrl: photoUrl,
          qty: 0,
          mobQty: 0,
          oiQty: 0,
          rowIds: [],
          breakdownIds: [],
          draftRowIds: [],
          splitAssignmentIds: [],
          plDetailSeqs: [],
          detailOrders: [],
          plNames: new Set(),
          releaseStates: new Set(),
          releaseCount: 0,
          latestReleasedAt: '',
          latestReleasedBy: '',
          earliestDate: '',
          latestDate: '',
          plDates: new Set(),
        }

      detailItem.qty += qty
      if (storingType === 'OI') {
        detailItem.oiQty += qty
      } else {
        detailItem.mobQty += qty
      }
      detailItem.photoUrl = detailItem.photoUrl || photoUrl
      detailItem.plNames.add(plDisplayName)
      if (row.id) {
        detailItem.rowIds.push(Number(row.id))
        const splitAssignment = getSplitAssignmentForRow(row, breakdown, lookup)
        if (splitAssignment?.id) {
          detailItem.splitAssignmentIds.push(Number(splitAssignment.id))
        }
        if (batchReleaseState !== 'released') {
          detailItem.draftRowIds.push(Number(row.id))
        }
      }
      if (row.pl_size_breakdown_id) {
        detailItem.breakdownIds.push(Number(row.pl_size_breakdown_id))
      }
      if (row.pl_detail_seq || breakdown?.pl_detail_seq) {
        detailItem.plDetailSeqs.push(Number(row.pl_detail_seq || breakdown?.pl_detail_seq))
      }
      if (row.detail_order || breakdown?.detail_order) {
        detailItem.detailOrders.push(Number(row.detail_order || breakdown?.detail_order))
      }
      if (releaseState) {
        detailItem.releaseStates.add(releaseState)
      }
      detailItem.releaseCount = Math.max(Number(detailItem.releaseCount || 0), releaseCount)
      if (releaseMeta.releasedAt && (!detailItem.latestReleasedAt || new Date(releaseMeta.releasedAt) > new Date(detailItem.latestReleasedAt))) {
        detailItem.latestReleasedAt = releaseMeta.releasedAt
        detailItem.latestReleasedBy = releaseMeta.releasedBy
      }
      if (!detailItem.latestDate || new Date(row.created_at || 0) > new Date(detailItem.latestDate || 0)) {
        detailItem.latestDate = row.created_at
      }
      if (!detailItem.earliestDate || new Date(row.created_at || 0) < new Date(detailItem.earliestDate || 0)) {
        detailItem.earliestDate = row.created_at
      }
      const detailPlDate = getDateValue(row.created_at)
      if (detailPlDate) {
        detailItem.plDates.add(detailPlDate)
      }
      group.detailItems.set(detailKey, detailItem)

      if (!group.latestDate || new Date(row.created_at || 0) > new Date(group.latestDate || 0)) {
        group.latestDate = row.created_at
      }

      if (!group.earliestDate || new Date(row.created_at || 0) < new Date(group.earliestDate || 0)) {
        group.earliestDate = row.created_at
      }

      const plDate = getDateValue(row.created_at)
      if (plDate) {
        group.plDates.add(plDate)
      }

      groups.set(groupKey, group)
    })

    return Array.from(groups.values())
      .map((group) => {
        const groupReleaseState = filters.viewMode === 'model' && filters.type === 'all'
          ? getCombinedReleaseState(group.releaseStates)
          : getReleaseStateFromSet(group.releaseStates)
        const modelCurrentQty = Number(group.storageQty || 0) + Number(group.unreleasedQueuedQty || 0)
        const shouldUseCurrentQty = filters.viewMode === 'model' && groupReleaseState === 'released'
        const nextTotalQty = shouldUseCurrentQty ? modelCurrentQty : group.totalQty
        const nextMobQty = shouldUseCurrentQty && filters.type === 'MOB' ? modelCurrentQty : group.mobQty
        const nextOiQty = shouldUseCurrentQty && filters.type === 'OI' ? modelCurrentQty : group.oiQty

        return {
        ...group,
        totalQty: nextTotalQty,
        mobQty: nextMobQty,
        oiQty: nextOiQty,
        releaseState: groupReleaseState,
        productList: Array.from(group.products).filter(Boolean).sort((left, right) => naturalSort.compare(left, right)),
        brandList: Array.from(group.brands).filter(Boolean).sort((left, right) => naturalSort.compare(left, right)),
        categoryList: Array.from(group.categories).filter(Boolean).sort((left, right) => naturalSort.compare(left, right)),
        categoryRootList: Array.from(group.categoryRoots).filter(Boolean).sort((left, right) => naturalSort.compare(left, right)),
        subCategoryList: Array.from(group.subCategories).filter(Boolean).sort((left, right) => naturalSort.compare(left, right)),
        itemTypeList: Array.from(group.itemTypes).filter(Boolean).sort((left, right) => naturalSort.compare(left, right)),
        detailItemList: Array.from(group.detailItems.values())
          .map((item) => ({
            ...item,
            rowIds: Array.from(new Set(item.rowIds)).filter(Boolean),
            breakdownIds: Array.from(new Set(item.breakdownIds)).filter(Boolean),
            draftRowIds: Array.from(new Set(item.draftRowIds)).filter(Boolean),
            plNameList: Array.from(item.plNames || []).filter(Boolean).sort((left, right) => naturalSort.compare(left, right)),
            plDetailSeq: getMinFinite(item.plDetailSeqs),
            detailOrder: getMinFinite(item.detailOrders),
            releaseState: filters.type === 'all' ? getCombinedReleaseState(item.releaseStates) : getReleaseStateFromSet(item.releaseStates),
            plDateList: Array.from(item.plDates || []).sort((left, right) => naturalSort.compare(left, right)),
          }))
          .sort((left, right) =>
            naturalSort.compare(left.grn, right.grn) ||
            naturalSort.compare(left.sku, right.sku) ||
            naturalSort.compare(left.productName, right.productName)
          ),
        grnList: Array.from(group.grns).filter((grn) => grn !== '-').sort((left, right) => naturalSort.compare(left, right)),
        plDateList: Array.from(group.plDates).sort((left, right) => naturalSort.compare(left, right)),
        }
      })
      .sort((left, right) => {
        const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1
        let result = 0

        if (sortConfig.key === 'qty') {
          result = left.totalQty - right.totalQty
        } else if (sortConfig.key === 'date') {
          result = new Date(left.latestDate || 0).getTime() - new Date(right.latestDate || 0).getTime()
        } else if (sortConfig.key === 'grn') {
          result = naturalSort.compare(left.primaryGrn || left.grnList[0] || '', right.primaryGrn || right.grnList[0] || '')
        } else if (sortConfig.key === 'category') {
          result =
            naturalSort.compare(left.categoryList[0] || left.category, right.categoryList[0] || right.category) ||
            naturalSort.compare(left.subCategory, right.subCategory)
        } else if (sortConfig.key === 'product') {
          result = naturalSort.compare(left.productList[0] || left.productName, right.productList[0] || right.productName)
        } else {
          result = naturalSort.compare(left.brandList[0] || left.brand, right.brandList[0] || right.brand)
        }

        return (result * directionMultiplier) || naturalSort.compare(left.primaryGrn || left.productName, right.primaryGrn || right.productName)
      })
  }, [filters, lookup, packingRows, sortConfig])

  const filterOptions = useMemo(() => {
    const optionSetsByIgnoredFilter = {
      grn: new Set(),
      brand: new Set(),
      category: new Set(),
      subCategory: new Set(),
      itemType: new Set(),
    }
    const normalizedSearch = normalizeUpper(filters.search)

    function rowMatchesFilters(facet, ignoreFilterName = '') {
      if (filters.type !== 'all' && facet.storingType !== normalizeUpper(filters.type)) return false

      if (facet.shouldApplyReleaseStatus && filters.releaseStatus !== 'all' && facet.releaseState !== filters.releaseStatus) {
        return false
      }

      if (ignoreFilterName !== 'grn' && filters.grn && facet.grnNumber !== filters.grn) return false
      if (ignoreFilterName !== 'brand' && filters.brand && facet.brand !== filters.brand) return false
      if (ignoreFilterName !== 'category' && filters.category && facet.categoryRoot !== filters.category) return false
      if (ignoreFilterName !== 'subCategory' && filters.subCategory && facet.subCategory !== filters.subCategory) return false
      if (ignoreFilterName !== 'itemType' && filters.itemType && facet.itemType !== filters.itemType) return false

      return !normalizedSearch || facet.searchable.includes(normalizedSearch)
    }

    function addFacetOptions(facet, ignoredFilterName) {
      if (!rowMatchesFilters(facet, ignoredFilterName)) return

      if (ignoredFilterName === 'grn' && facet.grnNumber && facet.grnNumber !== '-') {
        optionSetsByIgnoredFilter.grn.add(facet.grnNumber)
      }

      if (ignoredFilterName === 'brand' && facet.brand && !facet.brand.startsWith('Multiple')) {
        optionSetsByIgnoredFilter.brand.add(facet.brand)
      }

      if (ignoredFilterName === 'category' && facet.categoryRoot && !facet.categoryRoot.startsWith('Multiple')) {
        optionSetsByIgnoredFilter.category.add(facet.categoryRoot)
      }

      if (ignoredFilterName === 'subCategory' && facet.subCategory && facet.subCategory !== '-') {
        optionSetsByIgnoredFilter.subCategory.add(facet.subCategory)
      }

      if (ignoredFilterName === 'itemType' && facet.itemType && facet.itemType !== '-') {
        optionSetsByIgnoredFilter.itemType.add(facet.itemType)
      }
    }

    packingRows.forEach((row) => {
      const storingType = getRowStoringType(row)
      const breakdown = lookup.breakdownById.get(Number(row.pl_size_breakdown_id))
      const modelId = Number(row.product_model_id || breakdown?.product_model_id || 0)
      const variantId = Number(row.product_model_variant_id || breakdown?.product_model_variant_id || 0)
      const model = lookup.modelById.get(modelId)
      const variant = lookup.variantById.get(variantId)
      const assignedVariant = getAssignedVariantForRow(row, breakdown, lookup, variant)
      const selectedVariant = getCanonicalVariant(assignedVariant, lookup.variantById)
      const selectedVariantId = Number(selectedVariant?.id || variantId || 0)
      const releaseVariant = selectedVariant || variant || (selectedVariantId ? { id: selectedVariantId } : null)
      const brand = getBrandLabel(row, model, lookup.brandById, lookup.brandByCode)
      const categoryParts = getCategoryParts(model?.category_id || breakdown?.category_id, lookup.categoryById)
      const detailCategoryLabel = getDetailCategoryLabel(categoryParts)
      const sourceSku = normalize(row.source_variant_code || breakdown?.source_variant_code || variant?.variant_code || variant?.variant_label) || '-'
      const selectedSku = getAssignedSkuForRow(row, breakdown, lookup, getSelectedSku(sourceSku, selectedVariant))
      const sourceProductName = getProductName(row, breakdown, model, variant)
      const selectedProductName = getSelectedProductName(row, breakdown, model, variant, selectedVariant)
      const productName = selectedProductName
      const inbound = lookup.inboundById.get(Number(row.inbound_id))
      const grnNumber = normalize(inbound?.grn_number) || '-'
      const modelReleaseSource = filters.viewMode === 'model'
        ? getModelTypeReleaseSource(releaseVariant, storingType, lookup, row)
        : null
      const releaseSource = filters.viewMode === 'grn' ? row : modelReleaseSource
      const releaseState = releaseSource ? getReleaseState(releaseSource) : ''
      const shouldApplyReleaseStatus = filters.viewMode === 'grn' || filters.type !== 'all'
      const facet = {
        storingType,
        releaseState,
        shouldApplyReleaseStatus,
        grnNumber,
        brand,
        categoryRoot: categoryParts.categoryRoot,
        subCategory: categoryParts.subCategory,
        itemType: categoryParts.itemType,
        searchable: [
          productName,
          brand,
          categoryParts.categoryRoot,
          categoryParts.subCategory,
          categoryParts.itemType,
          detailCategoryLabel,
          selectedProductName,
          sourceProductName,
          selectedSku,
          sourceSku,
          grnNumber,
        ]
          .map(normalizeUpper)
          .join(' '),
      }

      addFacetOptions(facet, 'grn')
      addFacetOptions(facet, 'brand')
      addFacetOptions(facet, 'category')
      addFacetOptions(facet, 'subCategory')
      addFacetOptions(facet, 'itemType')
    })

    const sortOptions = (items) => Array.from(items).sort((left, right) => naturalSort.compare(left, right))

    return {
      grns: sortOptions(optionSetsByIgnoredFilter.grn),
      brands: sortOptions(optionSetsByIgnoredFilter.brand),
      categories: sortOptions(optionSetsByIgnoredFilter.category),
      subCategories: sortOptions(optionSetsByIgnoredFilter.subCategory),
      itemTypes: sortOptions(optionSetsByIgnoredFilter.itemType),
    }
  }, [filters, lookup, packingRows])

  const totalQty = groupedProducts.reduce((sum, row) => sum + row.totalQty, 0)
  const mobQty = groupedProducts.reduce((sum, row) => sum + row.mobQty, 0)
  const oiQty = groupedProducts.reduce((sum, row) => sum + row.oiQty, 0)
  const activeQtyLabel = filters.type === 'MOB' ? 'MOB Qty' : filters.type === 'OI' ? 'OI Qty' : 'Total Qty'
  const activeQtyValue = filters.type === 'MOB' ? mobQty : filters.type === 'OI' ? oiQty : totalQty
  const showReleaseStatusControls = filters.viewMode === 'grn' || filters.type !== 'all'
  const totalPages = Math.max(1, Math.ceil(groupedProducts.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageStartIndex = (safeCurrentPage - 1) * pageSize
  const visibleProducts = groupedProducts.slice(pageStartIndex, pageStartIndex + pageSize)
  const selectableDetailItems = useMemo(() => {
    if (filters.type === 'all') {
      return []
    }

    const items = new Map()
    const selectedType = normalizeUpper(filters.type)

    packingRows.forEach((row) => {
      const storingType = getRowStoringType(row)
      if (storingType !== selectedType) return

      const breakdown = lookup.breakdownById.get(Number(row.pl_size_breakdown_id))
      const modelId = Number(row.product_model_id || breakdown?.product_model_id || 0)
      const variantId = Number(row.product_model_variant_id || breakdown?.product_model_variant_id || 0)
      const model = lookup.modelById.get(modelId)
      const variant = lookup.variantById.get(variantId)
      const assignedVariant = getAssignedVariantForRow(row, breakdown, lookup, variant)
      const selectedVariant = getCanonicalVariant(assignedVariant, lookup.variantById)
      const selectedVariantId = Number(selectedVariant?.id || variantId || 0)
      const brand = getBrandLabel(row, model, lookup.brandById, lookup.brandByCode)
      const categoryParts = getCategoryParts(model?.category_id || breakdown?.category_id, lookup.categoryById)
      const detailCategoryLabel = getDetailCategoryLabel(categoryParts)
      const sourceSku = normalize(row.source_variant_code || breakdown?.source_variant_code || variant?.variant_code || variant?.variant_label) || '-'
      const selectedSku = getAssignedSkuForRow(row, breakdown, lookup, getSelectedSku(sourceSku, selectedVariant))
      const productName = getSelectedProductName(row, breakdown, model, variant, selectedVariant)
      const plDisplayName = getPlDisplayName(row, breakdown, model, variant)
      const inbound = lookup.inboundById.get(Number(row.inbound_id))
      const grnNumber = normalize(inbound?.grn_number) || '-'
      const detailGrn = getDetailGrnLabel(grnNumber)
      const photoUrl = getResolvedProductPhotoUrl(row, breakdown, model, variant, selectedVariant)
      const releaseSource = row
      const releaseState = getReleaseState(releaseSource)
      const releaseCount = getReleaseCount(releaseSource)
      const batchReleaseState = getReleaseState(row)
      const releaseMeta = getReleaseMeta(releaseSource)
      const detailKey = [detailGrn, selectedSku, brand, productName, detailCategoryLabel, storingType].map(normalizeUpper).join('::')
      const detailItem =
        items.get(detailKey) || {
          key: detailKey,
          grn: detailGrn,
          baseGrn: grnNumber,
          sku: selectedSku,
          brand,
          productName,
          categoryLabel: detailCategoryLabel,
          photoUrl,
          type: storingType,
          productModelId: modelId,
          productModelVariantId: selectedVariantId,
          sourceProductModelVariantId: variantId,
          sourceMergedIntoVariantId: Number(variant?.merged_into_variant_id || 0),
          sourceVariantCode: selectedSku,
          sellingName: normalize(selectedVariant?.selling_name),
          variantName: normalize(selectedVariant?.variant_name || selectedVariant?.variant_label || selectedVariant?.variant_code || row.variant_name || breakdown?.variant_name) || productName,
          variantNotes: getResolvedVariantNotes(breakdown, variant, selectedVariant),
          variantPhotoUrl: photoUrl,
          qty: 0,
          rowIds: [],
          breakdownIds: [],
          draftRowIds: [],
          splitAssignmentIds: [],
          plDetailSeqs: [],
          detailOrders: [],
          plNames: new Set(),
          releaseStates: new Set(),
          releaseCount: 0,
          latestReleasedAt: '',
          latestReleasedBy: '',
        }

      detailItem.qty += Number(row.qty || 0)
      detailItem.photoUrl = detailItem.photoUrl || photoUrl
      detailItem.plNames.add(plDisplayName)
      if (row.id) {
        detailItem.rowIds.push(Number(row.id))
        const splitAssignment = getSplitAssignmentForRow(row, breakdown, lookup)
        if (splitAssignment?.id) {
          detailItem.splitAssignmentIds.push(Number(splitAssignment.id))
        }
        if (batchReleaseState !== 'released') {
          detailItem.draftRowIds.push(Number(row.id))
        }
      }
      if (row.pl_size_breakdown_id) {
        detailItem.breakdownIds.push(Number(row.pl_size_breakdown_id))
      }
      if (row.pl_detail_seq || breakdown?.pl_detail_seq) {
        detailItem.plDetailSeqs.push(Number(row.pl_detail_seq || breakdown?.pl_detail_seq))
      }
      if (row.detail_order || breakdown?.detail_order) {
        detailItem.detailOrders.push(Number(row.detail_order || breakdown?.detail_order))
      }
      if (releaseState) {
        detailItem.releaseStates.add(releaseState)
      }
      detailItem.releaseCount = Math.max(Number(detailItem.releaseCount || 0), releaseCount)
      if (releaseMeta.releasedAt && (!detailItem.latestReleasedAt || new Date(releaseMeta.releasedAt) > new Date(detailItem.latestReleasedAt))) {
        detailItem.latestReleasedAt = releaseMeta.releasedAt
        detailItem.latestReleasedBy = releaseMeta.releasedBy
      }
      items.set(detailKey, detailItem)
    })

    return Array.from(items.values()).map((item) => ({
      ...item,
      rowIds: Array.from(new Set(item.rowIds)).filter(Boolean),
      breakdownIds: Array.from(new Set(item.breakdownIds)).filter(Boolean),
      draftRowIds: Array.from(new Set(item.draftRowIds)).filter(Boolean),
      splitAssignmentIds: Array.from(new Set(item.splitAssignmentIds)).filter(Boolean),
      plNameList: Array.from(item.plNames || []).filter(Boolean).sort((left, right) => naturalSort.compare(left, right)),
      plDetailSeq: getMinFinite(item.plDetailSeqs),
      detailOrder: getMinFinite(item.detailOrders),
      releaseState: getReleaseStateFromSet(item.releaseStates),
    }))
  }, [filters.type, lookup, packingRows])
  const selectableDetailItemByKey = useMemo(
    () => new Map(selectableDetailItems.map((item) => [item.key, item])),
    [selectableDetailItems]
  )
  const selectedDetailItems = useMemo(
    () => selectedProductKeys.map((key) => selectableDetailItemByKey.get(key)).filter(Boolean),
    [selectableDetailItemByKey, selectedProductKeys]
  )
  const selectedRowIds = useMemo(
    () => Array.from(new Set(selectedDetailItems.flatMap((item) => item.rowIds || []))).filter(Boolean),
    [selectedDetailItems]
  )
  const selectedReleaseRowIds = selectedRowIds
  const canSelectSkuRows = canManage && filters.viewMode === 'grn' && filters.type !== 'all'
  const selectedNameItem = selectedDetailItems.length === 1 ? selectedDetailItems[0] : null
  const editNameButtonDisabled = !canSelectSkuRows || selectedDetailItems.length !== 1 || bulkWorking || !Number(selectedNameItem?.productModelVariantId || 0)
  const splitEligibility = useMemo(() => {
    if (!canSelectSkuRows) {
      return { canSplit: false, reason: 'Choose MOB or OI before splitting a variant.' }
    }

    if (selectedDetailItems.length < 2) {
      return { canSplit: false, reason: 'Select at least 2 SKU rows with the same SKU.' }
    }

    if (selectedDetailItems.some((item) => (item.splitAssignmentIds || []).length)) {
      return { canSplit: false, reason: 'One selected row is already split. Choose original SKU rows only.' }
    }

    const selectedSkus = Array.from(new Set(selectedDetailItems.map((item) => normalizeUpper(item.sku)).filter(Boolean)))
    if (selectedSkus.length !== 1) {
      return { canSplit: false, reason: 'Split is only available when every selected row has the same SKU.' }
    }

    const productModelIds = Array.from(new Set(selectedDetailItems.map((item) => Number(item.productModelId || 0)).filter(Boolean)))
    if (productModelIds.length !== 1) {
      return { canSplit: false, reason: 'Selected rows must belong to the same product model.' }
    }

    const sourceVariantCodes = Array.from(new Set(selectedDetailItems.map((item) => normalizeUpper(item.sourceVariantCode || item.sku)).filter(Boolean)))
    if (sourceVariantCodes.length !== 1) {
      return { canSplit: false, reason: 'Selected rows must come from the same source variant code.' }
    }

    const productModelVariantIds = Array.from(new Set(selectedDetailItems.map((item) => Number(item.productModelVariantId || 0)).filter(Boolean)))
    if (productModelVariantIds.length === 0) {
      return { canSplit: false, reason: 'The selected SKU is not connected to a registered product variant.' }
    }

    if (productModelVariantIds.length > 1) {
      return { canSplit: false, reason: 'Selected rows must come from the same source variant.' }
    }

    if (productModelVariantIds.some((variantId) => lookup.splitSourceVariantIds.has(variantId))) {
      return { canSplit: false, reason: 'This source SKU has already been split.' }
    }

    const sourceVariantId = productModelVariantIds[0]
    const hasMergedSources = productVariants.some(
      (variant) => Number(variant.merged_into_variant_id || 0) === Number(sourceVariantId)
    )
    if (hasMergedSources) {
      return { canSplit: false, reason: 'A merged target SKU cannot be split.' }
    }

    if (
      selectedDetailItems.some(
        (item) => Number(item.sourceProductModelVariantId || 0) !== Number(sourceVariantId)
      )
    ) {
      return { canSplit: false, reason: 'Merged source rows cannot be used for a split.' }
    }

    return {
      canSplit: true,
      reason: `Split ${selectedDetailItems.length} selected rows from ${sourceVariantCodes[0]}.`,
      productModelId: productModelIds[0],
      productModelVariantId: productModelVariantIds[0] || 0,
      sourceVariantCode: sourceVariantCodes[0],
      sku: selectedSkus[0],
    }
  }, [canSelectSkuRows, lookup.splitSourceVariantIds, productVariants, selectedDetailItems])
  const mergeOptions = useMemo(() => {
    const optionsByVariantId = new Map()

    selectedDetailItems.forEach((item) => {
      const variantId = Number(item.productModelVariantId || 0)
      if (!variantId) return

      const variant = lookup.variantById.get(variantId) || {}
      const option =
        optionsByVariantId.get(variantId) || {
          variantId,
          sku: normalize(variant.variant_code || item.sourceVariantCode || item.sku) || '-',
          productName: normalize(variant.selling_name || item.productName || variant.variant_name || variant.variant_label || variant.variant_code) || 'PL ITEM',
          productModelId: Number(item.productModelId || variant.product_model_id || 0),
          mergedIntoVariantId: Number(variant.merged_into_variant_id || 0),
          qty: 0,
          rowIds: [],
          breakdownIds: [],
          plNames: new Set(),
        }

      option.qty += Number(item.qty || 0)
      option.rowIds.push(...(item.rowIds || []))
      option.breakdownIds.push(...(item.breakdownIds || []))
      ;(item.plNameList || []).forEach((plName) => option.plNames.add(plName))
      optionsByVariantId.set(variantId, option)
    })

    return Array.from(optionsByVariantId.values())
      .map((option) => ({
        ...option,
        rowIds: Array.from(new Set(option.rowIds)).filter(Boolean),
        breakdownIds: Array.from(new Set(option.breakdownIds)).filter(Boolean),
        plNameList: Array.from(option.plNames).filter(Boolean).sort((left, right) => naturalSort.compare(left, right)),
      }))
      .sort((left, right) => naturalSort.compare(left.sku, right.sku))
  }, [lookup.variantById, selectedDetailItems])
  const mergeEligibility = useMemo(() => {
    if (!canSelectSkuRows) {
      return { canMerge: false, reason: 'Choose MOB or OI before merging SKU.' }
    }

    if (selectedDetailItems.length < 2) {
      return { canMerge: false, reason: 'Select at least 2 SKU rows to merge.' }
    }

    if (mergeOptions.length < 2) {
      return { canMerge: false, reason: 'Select at least 2 different SKU variants to merge.' }
    }

    const productModelIds = Array.from(new Set(mergeOptions.map((item) => Number(item.productModelId || 0)).filter(Boolean)))
    if (productModelIds.length !== 1) {
      return { canMerge: false, reason: 'Merged SKU rows must belong to the same product model.' }
    }

    if (mergeOptions.some((item) => item.mergedIntoVariantId)) {
      return { canMerge: false, reason: 'One selected SKU is already merged. Choose active SKU rows only.' }
    }

    return {
      canMerge: true,
      reason: `Merge ${mergeOptions.length} selected SKU variants.`,
      productModelId: productModelIds[0],
      variantIds: mergeOptions.map((item) => item.variantId),
    }
  }, [canSelectSkuRows, mergeOptions, selectedDetailItems.length])
  const releaseButtonDisabled = !canSelectSkuRows || selectedRowIds.length === 0 || bulkWorking
  const splitButtonDisabled = !splitEligibility.canSplit || bulkWorking
  const mergeButtonDisabled = !mergeEligibility.canMerge || bulkWorking
  const selectedProductSection = embedded ? activeSection : 'directory'

  function handleFilterChange(event) {
    const { name, value, type, checked } = event.target

    setFilters((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    setSelectedProductKeys([])
    setCurrentPage(1)
  }

  function setTypeFilter(type) {
    setFilters((prev) => {
      const nextType = prev.type === type && type !== 'all' ? 'all' : type
      return {
        ...prev,
        type: nextType,
        releaseStatus: prev.viewMode === 'model' && nextType === 'all' ? 'all' : prev.releaseStatus,
      }
    })
    setSelectedProductKeys([])
    setCurrentPage(1)
  }

  function setReleaseStatusFilter(releaseStatus) {
    setFilters((prev) => {
      const nextReleaseStatus = prev.releaseStatus === releaseStatus && releaseStatus !== 'all' ? 'all' : releaseStatus
      return {
        ...prev,
        releaseStatus: nextReleaseStatus,
      }
    })
    setSelectedProductKeys([])
    setCurrentPage(1)
  }

  function setOptionFilter(name, value) {
    setFilters((prev) => {
      const nextValue = prev[name] === value ? '' : value
      return {
        ...prev,
        [name]: nextValue,
      }
    })
    setFilterSearches((prev) => ({ ...prev, [name]: '' }))
    setOpenFilterMenu('')
    setSelectedProductKeys([])
    setCurrentPage(1)
  }

  function handleFilterButtonClick(name) {
    if (filters[name]) {
      setFilters((prev) => ({
        ...prev,
        [name]: '',
      }))
      setFilterSearches((prev) => ({ ...prev, [name]: '' }))
      setOpenFilterMenu(name)
      setSelectedProductKeys([])
      setCurrentPage(1)
      return
    }

    setOpenFilterMenu((prev) => (prev === name ? '' : name))
  }

  function setViewMode(viewMode) {
    setFilters((prev) => ({
      ...prev,
      viewMode,
      releaseStatus: viewMode === 'model' && prev.type === 'all' ? 'all' : prev.releaseStatus,
    }))
    setSelectedProductKeys([])
    setCurrentPage(1)
  }

  function toggleSelectedProduct(productKey) {
    if (!canManage) return
    setSelectedProductKeys((prev) =>
      prev.includes(productKey)
        ? prev.filter((key) => key !== productKey)
        : [...prev, productKey]
    )
    setActionError('')
    setActionMessage('')
  }

  function openSelectedSellingNameEditor() {
    if (!canManage) return
    if (editNameButtonDisabled || !selectedNameItem) return

    openSellingNameEditor(selectedNameItem)
  }

  function openMergeEditor() {
    if (!canManage) return
    if (mergeButtonDisabled) {
      setActionError(mergeEligibility.reason || 'Choose SKU rows to merge.')
      return
    }

    const targetOption = mergeOptions[0]
    setMergeEditor({
      options: mergeOptions,
      rowIds: Array.from(new Set(selectedDetailItems.flatMap((item) => item.rowIds || []))).filter(Boolean),
      breakdownIds: Array.from(new Set(selectedDetailItems.flatMap((item) => item.breakdownIds || []))).filter(Boolean),
      sourceVariantIds: mergeOptions.map((item) => item.variantId),
    })
    setMergeTargetVariantId(targetOption ? String(targetOption.variantId) : '')
    setActionError('')
    setActionMessage('')
  }

  function closeMergeEditor() {
    if (bulkWorking) return

    setMergeEditor(null)
    setMergeTargetVariantId('')
  }

  function closeConfirmDialog() {
    if (bulkWorking) return

    setConfirmDialog(null)
  }

  function requestSplitConfirmation() {
    if (!canManage) return
    if (splitButtonDisabled) {
      setActionError(splitEligibility.reason || 'Choose SKU rows to split.')
      return
    }

    setConfirmDialog({
      action: 'split',
      title: 'Confirm Split SKU',
      message: `Split ${selectedDetailItems.length} selected SKU row(s) into new SKU variants?`,
      confirmLabel: 'OK, Split SKU',
      tone: 'dark',
    })
  }

  function requestMergeConfirmation() {
    if (!canManage) return
    if (!mergeEditor || bulkWorking) return

    const targetVariantId = Number(mergeTargetVariantId || 0)
    const targetOption = mergeEditor.options.find((option) => Number(option.variantId) === targetVariantId)
    const variantsToMerge = mergeEditor.sourceVariantIds.filter((variantId) => Number(variantId) !== targetVariantId)

    if (!targetVariantId || !targetOption || variantsToMerge.length === 0) {
      setActionError('Choose the target SKU for this merge.')
      return
    }

    setConfirmDialog({
      action: 'merge',
      title: 'Confirm Merge SKU',
      message: `Merge ${variantsToMerge.length} SKU variant(s) into ${targetOption.sku}?`,
      confirmLabel: 'OK, Merge SKU',
      tone: 'dark',
    })
  }

  function requestReleaseConfirmation() {
    if (!canManage) return
    if (releaseButtonDisabled) return

    const variantCount = new Set(selectedDetailItems.map((item) => Number(item.productModelVariantId || 0)).filter(Boolean)).size

    setConfirmDialog({
      action: 'release',
      title: 'Confirm Set Released',
      message: `Mark ${selectedReleaseRowIds.length} PL row(s) and ${variantCount} SKU variant(s) as Released?`,
      confirmLabel: 'OK, Set Released',
      tone: 'danger',
    })
  }

  async function confirmPendingAction() {
    const action = confirmDialog?.action
    if (!action || bulkWorking) return

    setConfirmDialog(null)

    if (action === 'split') {
      await splitSelectedToNewVariants()
      return
    }

    if (action === 'merge') {
      await saveMergeSku()
      return
    }

    if (action === 'release') {
      await markSelectedReleased()
    }
  }

  async function saveMergeSku() {
    if (!canManage) return
    if (!mergeEditor || bulkWorking) return

    const targetVariantId = Number(mergeTargetVariantId || 0)
    const targetOption = mergeEditor.options.find((option) => Number(option.variantId) === targetVariantId)
    const variantsToMerge = mergeEditor.sourceVariantIds.filter((variantId) => Number(variantId) !== targetVariantId)

    if (!targetVariantId || !targetOption || variantsToMerge.length === 0) {
      setActionError('Choose the target SKU for this merge.')
      return
    }

    setBulkWorking(true)
    setActionError('')
    setActionMessage('')

    let updatedVariants = []

    try {
      const actor = await getActorLabel()
      const mergedAt = new Date().toISOString()
      const payload = {
        is_active: false,
        merged_into_variant_id: targetVariantId,
        merged_at: mergedAt,
        merged_by: actor,
        updated_at: mergedAt,
      }
      const { data: nextUpdatedVariants, error: updateError } = await supabase
        .from('dir_product_model_variants')
        .update(payload)
        .in('id', variantsToMerge)
        .select('*')

      if (updateError) throw updateError
      updatedVariants = nextUpdatedVariants || []

      const { data: nextIdentityEvent, error: auditError } = await supabase
        .from('product_variant_identity_events')
        .insert([{
          event_type: 'merge',
          source_variant_ids: variantsToMerge,
          target_variant_id: targetVariantId,
          created_variant_ids: [],
          affected_pl_packing_item_ids: mergeEditor.rowIds,
          affected_pl_size_breakdown_ids: mergeEditor.breakdownIds,
          detail_assignments: [],
          created_by: actor,
        }])
        .select('*')
        .single()

      if (auditError) throw auditError

      const updatedById = new Map(updatedVariants.map((variant) => [Number(variant.id), variant]))
      setProductVariants((prev) =>
        prev.map((variant) => updatedById.get(Number(variant.id)) || variant)
      )
      if (nextIdentityEvent) {
        setIdentityEvents((prev) => [...prev, nextIdentityEvent])
      }
      setMergeEditor(null)
      setMergeTargetVariantId('')
      setSelectedProductKeys([])
      setActionMessage(`${variantsToMerge.length} SKU variant(s) merged into ${targetOption.sku}.`)
    } catch (mergeError) {
      const updatedIds = updatedVariants.map((variant) => Number(variant.id)).filter(Boolean)
      if (updatedIds.length) {
        try {
          await supabase
            .from('dir_product_model_variants')
            .update({
              is_active: true,
              merged_into_variant_id: null,
              merged_at: null,
              merged_by: null,
              updated_at: new Date().toISOString(),
            })
            .in('id', updatedIds)
        } catch {
          // Keep the original merge error visible; manual cleanup can clear merged_into_variant_id if rollback fails.
        }
      }

      setActionError(getActionErrorMessage(mergeError))
    } finally {
      setBulkWorking(false)
    }
  }

  async function getActorLabel() {
    const { data } = await supabase.auth.getUser()
    const user = data?.user
    if (!user) return 'System'

    const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, 'display_name, email')
    return (
      String(profile?.display_name || '').trim() ||
      String(user.user_metadata?.display_name || '').trim() ||
      String(user.user_metadata?.full_name || '').trim() ||
      String(user.user_metadata?.name || '').trim() ||
      String(user.email || '').trim() ||
      'System'
    )
  }

  function getActionErrorMessage(actionErrorValue) {
    const message = actionErrorValue?.message || 'Action failed.'
    const normalized = message.toLowerCase()
    if (normalized.includes('selling_name')) {
      return `${message} Run supabase/product_variant_selling_name.sql in Supabase first.`
    }

    if (normalized.includes('dir_product_model_variant_release_states')) {
      return `${message} Run supabase/product_variant_release_type_states.sql in Supabase first.`
    }

    if (normalized.includes('row-level security') && normalized.includes('product_variant_identity_events')) {
      return `${message} Run the latest supabase/product_variant_merge_workflow.sql in Supabase so merge/split audit logs can be saved.`
    }

    if (
      normalized.includes('merged_into_variant_id') ||
      normalized.includes('product_variant_identity_events') ||
      normalized.includes('detail_assignments') ||
      normalized.includes('split_at') ||
      normalized.includes('split_by')
    ) {
      return `${message} Run supabase/product_variant_merge_workflow.sql in Supabase first.`
    }

    return normalized.includes('release_status')
      ? `${message} Run supabase/product_variant_release_workflow.sql in Supabase first.`
      : message
  }

  function openSellingNameEditor(item = {}) {
    if (!canManage) return
    const variantId = Number(item.productModelVariantId || 0)

    if (!variantId) {
      setActionError('Selling name can only be edited after the product is connected to a catalog variant.')
      return
    }

    const variant = lookup.variantById.get(variantId) || {}
    const sellingName = normalize(variant.selling_name || item.sellingName)
    const fallbackName = normalize(item.productName || variant.variant_name || variant.variant_label || variant.variant_code)
    const plNames = Array.isArray(item.plNameList) && item.plNameList.length
      ? item.plNameList.join(', ')
      : normalize(item.variantName || variant.variant_name || fallbackName || 'PL ITEM')

    setSellingNameEditor({
      variantId,
      sku: normalize(item.sku || item.sourceVariantCode || variant.variant_code || variant.variant_label) || '-',
      plNames,
      variantName: normalize(variant.variant_name || item.variantName || fallbackName) || '-',
      sellingName,
    })
    setSellingNameDraft(normalizeUpper(sellingName || fallbackName || ''))
    setActionError('')
    setActionMessage('')
  }

  function closeSellingNameEditor() {
    if (bulkWorking) return

    setSellingNameEditor(null)
    setSellingNameDraft('')
  }

  async function saveSellingName() {
    if (!canManage) return
    if (!sellingNameEditor?.variantId || bulkWorking) return

    setBulkWorking(true)
    setActionError('')
    setActionMessage('')

    try {
      const nextSellingName = normalizeUpper(sellingNameDraft)
      const payload = {
        selling_name: nextSellingName || null,
        updated_at: new Date().toISOString(),
      }
      const { data: updatedVariant, error: updateError } = await supabase
        .from('dir_product_model_variants')
        .update(payload)
        .eq('id', sellingNameEditor.variantId)
        .select('*')
        .single()

      if (updateError) throw updateError

      setProductVariants((prev) =>
        prev.map((variant) => (Number(variant.id) === Number(sellingNameEditor.variantId) ? updatedVariant : variant))
      )
      setSellingNameEditor(null)
      setSellingNameDraft('')
      setActionMessage(nextSellingName ? 'Selling name updated.' : 'Selling name cleared.')
    } catch (updateError) {
      setActionError(getActionErrorMessage(updateError))
    } finally {
      setBulkWorking(false)
    }
  }

  async function markSelectedReleased() {
    if (!canManage) return
    if (selectedReleaseRowIds.length === 0 || bulkWorking) return

    setBulkWorking(true)
    setActionError('')
    setActionMessage('')

    try {
      const actor = await getActorLabel()
      const releasedAt = new Date().toISOString()
      const selectedIdSet = new Set(selectedReleaseRowIds.map(Number))
      const rowsToRelease = packingRows.filter((row) => selectedIdSet.has(Number(row.id)))
      const detailsByVariantType = new Map()
      selectedDetailItems.forEach((item) => {
        const variantId = Number(item.productModelVariantId || 0)
        const storingType = normalizeStoringType(item.type || filters.type)
        if (!variantId) return
        if (!storingType) return

        const releaseStateKey = getVariantReleaseStateKey(variantId, storingType)
        const detail =
          detailsByVariantType.get(releaseStateKey) || {
            variantId,
            storingType,
            releaseStateKey,
            sku: item.sku,
            qty: 0,
            rowIds: [],
            grns: new Set(),
          }

        detail.qty += Number(item.qty || 0)
        detail.rowIds.push(...(item.rowIds || []))
        if (item.grn) {
          detail.grns.add(item.grn)
        }
        detailsByVariantType.set(releaseStateKey, detail)
      })
      const releaseDetails = Array.from(detailsByVariantType.values())
      const payloadById = new Map()
      const releaseStatePayloadByKey = new Map()
      const batchPayload = {
        release_status: 'released',
        released_at: releasedAt,
        released_by: actor,
        updated_at: releasedAt,
      }

      if (releaseDetails.length) {
        const { error: releaseStateCheckError } = await supabase
          .from('dir_product_model_variant_release_states')
          .select('id')
          .limit(1)

        if (releaseStateCheckError) throw releaseStateCheckError
      }

      await Promise.all(rowsToRelease.map(async (row) => {
        const { error: updateError } = await supabase
          .from('pl_packing_items')
          .update(batchPayload)
          .eq('id', row.id)

        if (updateError) throw updateError

        payloadById.set(Number(row.id), batchPayload)
      }))

      if (releaseDetails.length) {
        const releaseStatePayloads = releaseDetails.map((detail) => {
          const currentState = lookup.variantReleaseStateByKey.get(detail.releaseStateKey) || {}
          const currentVariant = lookup.variantById.get(Number(detail.variantId)) || {}
          const nextReleaseCount = getReleaseCount(currentState) + 1
          const releaseEvent = {
            release_count: nextReleaseCount,
            released_at: releasedAt,
            released_by: actor,
            storing_type: detail.storingType,
            sku: detail.sku || currentVariant.variant_code || '',
            qty: Number(detail.qty || 0),
            grns: Array.from(detail.grns).filter(Boolean),
            pl_packing_item_ids: Array.from(new Set(detail.rowIds)).filter(Boolean),
          }
          return {
            product_model_variant_id: detail.variantId,
            storing_type: detail.storingType,
            release_status: 'released',
            released_at: releasedAt,
            released_by: actor,
            release_count: nextReleaseCount,
            release_history: appendVariantReleaseHistory(currentState, releaseEvent),
            updated_at: releasedAt,
          }
        })

        const { data: nextReleaseStates, error: releaseStateUpsertError } = await supabase
          .from('dir_product_model_variant_release_states')
          .upsert(releaseStatePayloads, { onConflict: 'product_model_variant_id,storing_type' })
          .select('*')

        if (releaseStateUpsertError) throw releaseStateUpsertError

        ;(nextReleaseStates || releaseStatePayloads).forEach((state) => {
          const releaseStateKey = getVariantReleaseStateKey(state.product_model_variant_id, state.storing_type)
          if (releaseStateKey) {
            releaseStatePayloadByKey.set(releaseStateKey, state)
          }
        })

        setProductVariantReleaseStates((prev) => {
          const nextByKey = new Map((prev || []).map((state) => [
            getVariantReleaseStateKey(state.product_model_variant_id, state.storing_type),
            state,
          ]))

          releaseStatePayloadByKey.forEach((state, key) => {
            nextByKey.set(key, state)
          })

          return Array.from(nextByKey.values()).filter((state) => getVariantReleaseStateKey(state.product_model_variant_id, state.storing_type))
        })
      }

      setPackingRows((prev) =>
        prev.map((row) => (payloadById.has(Number(row.id)) ? { ...row, ...payloadById.get(Number(row.id)) } : row))
      )
      setSelectedProductKeys([])
      setActionMessage(`${selectedReleaseRowIds.length} PL row(s) and ${releaseDetails.length} ${filters.type} SKU release state(s) marked as Released.`)
    } catch (updateError) {
      setActionError(getActionErrorMessage(updateError))
    } finally {
      setBulkWorking(false)
    }
  }

  async function splitSelectedToNewVariants() {
    if (!canManage) return
    if (!splitEligibility.canSplit || bulkWorking) return

    setBulkWorking(true)
    setActionError('')
    setActionMessage('')

    let insertedVariants = []
    let updatedSourceVariant = null
    let baseVariantSnapshot = null

    try {
      const now = new Date().toISOString()
      const actor = await getActorLabel()
      const sourceVariantId = Number(splitEligibility.productModelVariantId || 0)
      const baseVariantCode = splitEligibility.sourceVariantCode
      const baseVariant =
        (sourceVariantId ? lookup.variantById.get(sourceVariantId) : null) ||
        productVariants.find((variant) => normalizeUpper(variant.variant_code) === baseVariantCode)
      if (!baseVariant?.id) {
        throw new Error('The source product variant could not be found.')
      }

      const existingCodes = new Set(productVariants.map((variant) => normalizeUpper(variant.variant_code)).filter(Boolean))
      const sortedItems = [...selectedDetailItems].sort((left, right) =>
        naturalSort.compare(left.grn, right.grn) ||
        (left.plDetailSeq || left.detailOrder || 9999) - (right.plDetailSeq || right.detailOrder || 9999) ||
        naturalSort.compare(left.productName, right.productName)
      )
      const assignments = sortedItems.map((item, index) => {
        const nextCode = `${baseVariantCode}${numberToAlphabet(index + 1)}`
        const plName = (item.plNameList || []).find(Boolean)

        return {
          item,
          variantCode: nextCode,
          payload: {
            product_model_id: splitEligibility.productModelId,
            variant_code: nextCode,
            variant_name: plName || item.productName || item.variantName || baseVariant?.variant_name || nextCode,
            variant_notes: item.variantNotes || baseVariant?.variant_notes || null,
            variant_photo_url: item.variantPhotoUrl || baseVariant?.variant_photo_url || null,
            is_active: true,
          },
        }
      })

      const conflictingCodes = assignments
        .map((assignment) => normalizeUpper(assignment.variantCode))
        .filter((variantCode) => existingCodes.has(variantCode))
      if (conflictingCodes.length) {
        throw new Error(
          `Split result code already exists: ${conflictingCodes.join(', ')}. Reset the previous split result before trying again.`
        )
      }

      const { data: nextVariants, error: insertError } = await supabase
        .from('dir_product_model_variants')
        .insert(assignments.map((assignment) => assignment.payload))
        .select('*')

      if (insertError) throw insertError
      insertedVariants = nextVariants || []
      if (insertedVariants.length !== assignments.length) {
        throw new Error('Split failed because the new variant count did not match the selected rows.')
      }

      const insertedByCode = new Map(insertedVariants.map((variant) => [normalizeUpper(variant.variant_code), variant]))
      const detailAssignmentByKey = new Map()

      for (const assignment of assignments) {
        const insertedVariant = insertedByCode.get(normalizeUpper(assignment.variantCode))
        if (!insertedVariant?.id) {
          throw new Error(`New variant ${assignment.variantCode} was not returned after creation.`)
        }

        assignment.item.rowIds.forEach((rowId) => {
          const packingRow = packingRows.find((row) => Number(row.id || 0) === Number(rowId || 0)) || {}
          const breakdown = lookup.breakdownById.get(Number(packingRow.pl_size_breakdown_id || 0)) || {}
          const rowSourceVariantId = Number(
            packingRow.product_model_variant_id ||
            breakdown.product_model_variant_id ||
            0
          )
          const inboundId = Number(packingRow.inbound_id || breakdown.inbound_id || 0)
          if (rowSourceVariantId !== sourceVariantId || !inboundId) return

          const sourceDetailSeq = getSourceDetailSeq(packingRow, breakdown)
          const detailKey = getSplitDetailKey(sourceVariantId, inboundId, sourceDetailSeq)
          const existingAssignment = detailAssignmentByKey.get(detailKey)
          if (
            existingAssignment &&
            Number(existingAssignment.assigned_variant_id) !== Number(insertedVariant.id)
          ) {
            throw new Error('One PL detail was assigned to more than one split result.')
          }

          detailAssignmentByKey.set(detailKey, {
            source_variant_id: sourceVariantId,
            assigned_variant_id: insertedVariant.id,
            inbound_id: inboundId,
            source_detail_seq: sourceDetailSeq,
            source_variant_code: baseVariantCode,
            assigned_variant_code: insertedVariant.variant_code,
            pl_name: (assignment.item.plNameList || []).find(Boolean) || assignment.item.productName || null,
          })
        })
      }

      const requiredDetailKeys = new Set()
      const affectedPackingItemIds = new Set()
      const affectedBreakdownIds = new Set()
      packingRows.forEach((row) => {
        const breakdown = lookup.breakdownById.get(Number(row.pl_size_breakdown_id || 0)) || {}
        const rowSourceVariantId = Number(
          row.product_model_variant_id ||
          breakdown.product_model_variant_id ||
          0
        )
        if (rowSourceVariantId !== sourceVariantId || Number(row.qty || 0) <= 0) return

        const inboundId = Number(row.inbound_id || breakdown.inbound_id || 0)
        if (!inboundId) return
        if (row.id) affectedPackingItemIds.add(Number(row.id))
        if (row.pl_size_breakdown_id) {
          affectedBreakdownIds.add(Number(row.pl_size_breakdown_id))
        }
        requiredDetailKeys.add(
          getSplitDetailKey(sourceVariantId, inboundId, getSourceDetailSeq(row, breakdown))
        )
      })

      const missingDetailCount = Array.from(requiredDetailKeys).filter(
        (detailKey) => !detailAssignmentByKey.has(detailKey)
      ).length
      if (missingDetailCount) {
        throw new Error(
          `Select every PL detail for this source SKU before splitting. ${missingDetailCount} detail(s) are still unassigned.`
        )
      }

      baseVariantSnapshot = { ...baseVariant }
      const { data: nextSourceVariant, error: sourceUpdateError } = await supabase
        .from('dir_product_model_variants')
        .update({
          is_active: false,
          split_at: now,
          split_by: actor,
          merged_into_variant_id: null,
          merged_at: null,
          merged_by: null,
          updated_at: now,
        })
        .eq('id', Number(baseVariant.id))
        .select('*')
        .single()

      if (sourceUpdateError) throw sourceUpdateError
      updatedSourceVariant = nextSourceVariant

      const detailAssignments = Array.from(detailAssignmentByKey.values())
      const { data: nextIdentityEvent, error: auditError } = await supabase
        .from('product_variant_identity_events')
        .insert([{
          event_type: 'split',
          source_variant_ids: [sourceVariantId],
          target_variant_id: null,
          created_variant_ids: insertedVariants.map((variant) => Number(variant.id)).filter(Boolean),
          affected_pl_packing_item_ids: Array.from(affectedPackingItemIds),
          affected_pl_size_breakdown_ids: Array.from(affectedBreakdownIds),
          detail_assignments: detailAssignments,
          created_by: actor,
        }])
        .select('*')
        .single()

      if (auditError) throw auditError

      setProductVariants((prev) => [
        ...prev.map((variant) => (
          Number(variant.id) === Number(updatedSourceVariant.id) ? updatedSourceVariant : variant
        )),
        ...insertedVariants,
      ])
      if (nextIdentityEvent) {
        setIdentityEvents((prev) => [...prev, nextIdentityEvent])
      }
      setSelectedProductKeys([])
      setActionMessage(`${assignments.length} selected SKU row(s) split into new variants.`)
    } catch (splitError) {
      const insertedIds = insertedVariants.map((variant) => Number(variant.id)).filter(Boolean)
      if (insertedIds.length || updatedSourceVariant) {
        try {
          if (insertedIds.length) {
            await supabase.from('dir_product_model_variants').delete().in('id', insertedIds)
          }
          if (updatedSourceVariant && baseVariantSnapshot?.id) {
            await supabase
              .from('dir_product_model_variants')
              .update({
                is_active: baseVariantSnapshot.is_active,
                split_at: baseVariantSnapshot.split_at,
                split_by: baseVariantSnapshot.split_by,
                merged_into_variant_id: baseVariantSnapshot.merged_into_variant_id,
                merged_at: baseVariantSnapshot.merged_at,
                merged_by: baseVariantSnapshot.merged_by,
                updated_at: baseVariantSnapshot.updated_at,
              })
              .eq('id', Number(baseVariantSnapshot.id))
          }
        } catch {
          // Keep the original split error visible; the created variant IDs can be used for manual cleanup.
        }
      }

      setActionError(getActionErrorMessage(splitError))
    } finally {
      setBulkWorking(false)
    }
  }

  function handleSort(key) {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
    setCurrentPage(1)
  }

  function renderSortHeader(label, key, align = 'left') {
    const isActive = sortConfig.key === key

    return (
      <button
        type="button"
        onClick={() => handleSort(key)}
        style={{
          ...styles.sortHeaderButton,
          ...(align === 'right' ? styles.sortHeaderButtonRight : {}),
          ...(align === 'center' ? styles.sortHeaderButtonCenter : {}),
        }}
        aria-label={`Sort by ${label}`}
      >
        <span>{label}</span>
        <span style={isActive ? styles.sortIconActive : styles.sortIcon}>
          {isActive ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    )
  }

  function renderPhotoThumb(photoUrl, label) {
    if (!photoUrl) {
      return <span style={styles.photoPlaceholder}>No</span>
    }

    return (
      <button
        type="button"
        onClick={() => setPreviewPhoto({ src: photoUrl, alt: label || 'Product photo' })}
        style={styles.photoThumbButton}
        aria-label={`Preview ${label || 'product photo'}`}
        title="Preview photo"
      >
        <Image src={photoUrl} alt={label || 'Product photo'} width={34} height={34} unoptimized style={styles.photoThumbImage} />
      </button>
    )
  }

  function renderReleasePill(releaseState, releaseCount = 0, releasedAt = '', releasedBy = '', releaseHistory = [], tooltipKey = '') {
    if (!releaseState) {
      return <span style={styles.emptyStatusText}>-</span>
    }
    const releaseHistoryRows = getSortedReleaseHistory(releaseHistory)
    const releaseCountValue = Math.max(Number(releaseCount || 0), releaseHistoryRows.length)
    const releaseMetaLabel = [releasedAt ? formatDateTime(releasedAt) : '', releasedBy].filter(Boolean).join(' • ')
    const releaseCountLabel = releaseCountValue > 1 ? ` x${formatNumber(releaseCountValue)}` : ''
    const hasReleaseTooltip = releaseState === 'released' && Boolean(tooltipKey)
    const releaseTitle = releaseState === 'released'
      ? [
          `Latest Release: ${releasedAt ? formatDateTime(releasedAt) : '-'}`,
          releaseMetaLabel ? `Released By: ${releasedBy || '-'}` : '',
          `Release Count: ${formatNumber(releaseCountValue)}`,
          ...releaseHistoryRows.map((event, index) => {
            const releaseNumber = event.release_count ? `#${formatNumber(event.release_count)}` : `#${formatNumber(releaseHistoryRows.length - index)}`
            const grns = getReleaseEventGrns(event)
            const grnText = grns.length ? ` | GRN ${grns.join(', ')}` : ''
            const qtyText = Number(event.qty || 0) ? ` | Qty ${formatNumber(event.qty)}` : ''
            const actorText = event.released_by ? ` | ${event.released_by}` : ''
            return `${releaseNumber} ${formatDateTime(event.released_at)}${qtyText}${grnText}${actorText}`
          }),
        ].join('\n')
      : ''

    if (releaseState === 'partial') {
      return (
        <span style={styles.releaseStatusStack}>
          <span style={styles.partialPill}>Partial</span>
        </span>
      )
    }

    return (
      <span
        style={hasReleaseTooltip ? styles.releaseTooltipWrap : styles.releaseStatusStack}
        tabIndex={hasReleaseTooltip ? 0 : undefined}
        title={releaseTitle}
      >
        <span style={styles.releaseStatusStack}>
          <span style={releaseState === 'released' ? styles.releasedPill : styles.draftPill}>
            {releaseState === 'released' ? `Released${releaseCountLabel}` : 'Draft'}
          </span>
        </span>
      </span>
    )
  }

  function renderProductName(item = {}) {
    return (
      <div style={styles.productNameCell}>
        <span style={styles.productName}>{item.productName}</span>
      </div>
    )
  }

  function renderFilterDropdown(name, label, allLabel, options) {
    const selectedValue = filters[name]
    const isOpen = openFilterMenu === name
    const searchValue = filterSearches[name] || ''
    const filteredOptions = options.filter((option) => normalizeUpper(option).includes(normalizeUpper(searchValue)))

    return (
      <div style={styles.field}>
        <label style={styles.label}>{label}</label>
        <div style={styles.filterDropdown}>
          <button
            type="button"
            onClick={() => handleFilterButtonClick(name)}
            style={selectedValue ? { ...styles.filterButton, ...styles.filterButtonActive } : styles.filterButton}
          >
            <span style={styles.filterButtonText}>{selectedValue || allLabel}</span>
            <span style={styles.filterCaret}>{isOpen ? '▲' : '▼'}</span>
          </button>
          {isOpen ? (
            <div style={styles.filterMenu}>
              <input
                value={searchValue}
                onChange={(event) => setFilterSearches((prev) => ({ ...prev, [name]: event.target.value }))}
                style={styles.filterSearchInput}
                placeholder={`Search ${label.toLowerCase()}...`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setOptionFilter(name, '')}
                style={!selectedValue ? { ...styles.filterOption, ...styles.filterOptionActive } : styles.filterOption}
              >
                {allLabel}
              </button>
              {filteredOptions.length ? filteredOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setOptionFilter(name, option)}
                  style={selectedValue === option ? { ...styles.filterOption, ...styles.filterOptionActive } : styles.filterOption}
                >
                  {option}
                </button>
              )) : (
                <div style={styles.filterEmptyOption}>No matches</div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  function clearFilters() {
    setFilters({
      type: 'all',
      viewMode: 'grn',
      grn: '',
      brand: '',
      category: '',
      subCategory: '',
      itemType: '',
      search: '',
      releaseStatus: 'all',
    })
    setOpenFilterMenu('')
    setFilterSearches({})
    setSelectedProductKeys([])
    setSortConfig({ key: 'brand', direction: 'asc' })
    setPageSize(25)
    setCurrentPage(1)
  }

  return (
    <section style={embedded ? styles.embeddedPanel : styles.panel}>
      {!embedded ? (
      <div style={styles.header}>
        <div style={styles.headerCopy}>
          <p style={styles.eyebrow}>Warehouse</p>
          <h1 style={styles.title}>Product List</h1>
          <p style={styles.subtitle}>
            Check product models, stock levels (MOB/OI), and readiness status - whether the product has been released
            and finalized or is still in progress.
          </p>
        </div>
        <div style={styles.kpiGrid}>
          <div style={{ ...styles.kpiCard, ...styles.totalKpiCard }}>
            <span style={{ ...styles.kpiLabel, ...styles.totalKpiLabel }}>{activeQtyLabel}</span>
            <strong style={{ ...styles.kpiValue, ...styles.totalKpiValue }}>{formatNumber(activeQtyValue)}</strong>
          </div>
        </div>
      </div>
      ) : null}

      {selectedProductSection === 'directory' ? (
        <>
      <div style={styles.filterBlock}>
        <div style={styles.filterTopRow}>
          <div style={styles.searchField}>
            <div style={styles.searchLabelRow}>
              <div style={styles.searchLabelContent}>
                <label style={styles.label}>Product Search</label>
                <div style={styles.smallToggleStack}>
                  <div style={styles.smallSegmentedControl} role="tablist" aria-label="Product type filter">
                    {[
                      ['all', 'All'],
                      ['MOB', 'MOB'],
                      ['OI', 'OI'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTypeFilter(value)}
                        style={{
                          ...styles.smallSegmentedButton,
                          ...(filters.type === value ? styles.segmentedButtonActive : {}),
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={styles.smallSegmentedControl} role="tablist" aria-label="Product list view mode">
                    {[
                      ['grn', 'GRN'],
                      ['model', 'Model'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setViewMode(value)}
                        style={{
                          ...styles.smallSegmentedButton,
                          ...(filters.viewMode === value ? styles.segmentedButtonActive : {}),
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {showReleaseStatusControls ? (
                  <div style={styles.smallSegmentedControl} role="tablist" aria-label="Readiness status filter">
                    {[
                      ['all', 'All'],
                      ['draft', 'Draft'],
                      ['released', 'Released'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setReleaseStatusFilter(value)}
                        style={{
                          ...styles.smallSegmentedButton,
                          ...(filters.releaseStatus === value ? styles.segmentedButtonActive : {}),
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  ) : null}
                </div>
              </div>
              <span style={styles.searchLabelSpacer} aria-hidden="true" />
            </div>
            <div style={styles.searchInputRow}>
              <input
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                style={styles.input}
                placeholder="Search product, GRN, SKU, or brand..."
              />
              <button type="button" onClick={clearFilters} style={styles.clearIconButton} title="Clear Filters" aria-label="Clear Filters">
                <svg viewBox="0 0 24 24" style={styles.clearIcon} aria-hidden="true">
                  <path d="M3 12a9 9 0 0 1 15.4-6.4L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div style={styles.filtersGrid}>
          {renderFilterDropdown('grn', 'GRN', 'All GRN', filterOptions.grns)}
          {renderFilterDropdown('brand', 'Brand', 'All brands', filterOptions.brands)}
          {renderFilterDropdown('category', 'Category', 'All categories', filterOptions.categories)}
          {renderFilterDropdown('subCategory', 'Sub-Category', 'All sub-categories', filterOptions.subCategories)}
          {renderFilterDropdown('itemType', 'Item Type', 'All item types', filterOptions.itemTypes)}
        </div>
      </div>

      <div style={styles.tableBlock}>
        {loading ? (
          <p style={styles.statusText}>Loading products...</p>
        ) : error ? (
          <p style={styles.error}>{error}</p>
        ) : groupedProducts.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{ margin: 0 }}>No finished PL products match the current filters.</p>
          </div>
        ) : (
          <>
            {filters.viewMode === 'grn' ? (
              <div style={styles.bulkActionBar}>
                <div style={styles.bulkButtonRow}>
                  <div style={{ ...styles.inlineKpiCard, ...styles.inlineTotalKpiCard }}>
                    <span style={{ ...styles.inlineKpiLabel, ...styles.inlineTotalKpiLabel }}>{activeQtyLabel}</span>
                    <strong style={{ ...styles.inlineKpiValue, ...styles.inlineTotalKpiValue }}>{formatNumber(activeQtyValue)}</strong>
                  </div>
                  {canManage ? (
                  <div style={styles.bulkActionCluster}>
                    {canSelectSkuRows ? (
                      <>
                    <button
                      type="button"
                      onClick={openSelectedSellingNameEditor}
                      disabled={editNameButtonDisabled}
                      style={editNameButtonDisabled ? { ...styles.secondaryBulkButton, ...styles.bulkButtonDisabled } : styles.secondaryBulkButton}
                      title="Edit the selling name for the selected SKU row."
                    >
                      Edit Name
                    </button>
                    <button
                      type="button"
                      onClick={requestSplitConfirmation}
                      disabled={splitButtonDisabled}
                      style={splitButtonDisabled ? { ...styles.secondaryBulkButton, ...styles.bulkButtonDisabled } : styles.secondaryBulkButton}
                      title={splitEligibility.reason}
                    >
                      Split SKU
                    </button>
                    <button
                      type="button"
                      onClick={openMergeEditor}
                      disabled={mergeButtonDisabled}
                      style={mergeButtonDisabled ? { ...styles.secondaryBulkButton, ...styles.bulkButtonDisabled } : styles.secondaryBulkButton}
                      title={mergeEligibility.reason}
                    >
                      Merge SKU
                    </button>
                      </>
                    ) : null}
                    {canSelectSkuRows ? (
                      <button
                        type="button"
                        onClick={requestReleaseConfirmation}
                        disabled={releaseButtonDisabled}
                        style={releaseButtonDisabled ? { ...styles.finalBulkButton, ...styles.bulkButtonDisabled } : styles.finalBulkButton}
                        title="Mark selected SKU rows as released or release again."
                      >
                        Set Released
                      </button>
                    ) : null}
                  </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {actionMessage ? <p style={styles.actionMessage}>{actionMessage}</p> : null}
            {actionError ? <p style={styles.actionError}>{actionError}</p> : null}

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  {filters.viewMode === 'grn' ? (
                    <tr>
                      <th style={{ ...styles.th, ...styles.thCenter }}>{renderSortHeader('GRN', 'grn', 'center')}</th>
                      <th style={{ ...styles.th, ...styles.thCenter, ...styles.photoTh }}>Photo</th>
                      <th style={{ ...styles.th, ...styles.thCenter, ...styles.skuTh }}>SKU</th>
                      <th style={styles.th}>{renderSortHeader('Brand', 'brand')}</th>
                      <th style={styles.th}>{renderSortHeader('Item Type', 'category')}</th>
                      <th style={styles.th}>{renderSortHeader('Product', 'product')}</th>
                      <th style={{ ...styles.th, ...styles.thCenter }}>{renderSortHeader('Tanggal', 'date', 'center')}</th>
                      <th style={{ ...styles.th, ...styles.thCenter }}>Status</th>
                      <th style={styles.thNumber}>Qty</th>
                      <th style={styles.thNumber}>{renderSortHeader('GRN Total Qty', 'qty', 'right')}</th>
                    </tr>
                  ) : (
                    <tr>
                      <th style={styles.th}>{renderSortHeader('Brand', 'brand')}</th>
                      <th style={{ ...styles.th, ...styles.thCenter, ...styles.photoTh }}>Photo</th>
                      <th style={{ ...styles.th, ...styles.thCenter, ...styles.skuTh }}>SKU</th>
                      <th style={styles.th}>{renderSortHeader('Item Type', 'category')}</th>
                      <th style={styles.th}>{renderSortHeader('Product', 'product')}</th>
                      <th style={{ ...styles.th, ...styles.thCenter }}>{renderSortHeader('Tanggal', 'date', 'center')}</th>
                      <th style={{ ...styles.th, ...styles.thCenter }}>Status</th>
                      <th style={styles.thNumber}>{renderSortHeader('Total Qty', 'qty', 'right')}</th>
                      <th style={{ ...styles.th, ...styles.thCenter }}>{renderSortHeader('GRN Numbers', 'grn', 'center')}</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {visibleProducts.map((row) => {
                    const grnValue = row.primaryGrn || row.grnList[0] || '-'
                    const detailGrnList = Array.from(
                      new Map((row.detailItemList || []).map((item) => [item.grn, item])).values()
                    )
                    const skuList = Array.from(new Set(row.detailItemList.map((item) => item.sku).filter(Boolean)))
                    const rowPhotoUrl = row.detailItemList.find((item) => item.photoUrl)?.photoUrl || ''

                    const detailRows = row.detailItemList.length ? row.detailItemList : [{
                        key: `${row.key}-empty`,
                        grn: grnValue,
                        baseGrn: grnValue,
                        sku: '-',
                        brand: row.brand,
                        categoryLabel: getDetailCategoryLabel({ itemType: row.itemType, subCategory: row.subCategory }),
                        photoUrl: rowPhotoUrl,
                        productName: row.productName,
                        latestDate: row.latestDate,
                        qty: row.totalQty,
                      }]

                    return filters.viewMode === 'grn' ? (
                      detailRows.map((item, index) => (
                        <tr key={`${row.key}-${item.key}`}>
                          {index === 0 ? (
                            <td rowSpan={detailRows.length} style={{ ...styles.td, ...styles.tdCenter, ...styles.middleCell }}>
                              <Link href={getGrnLink(item.baseGrn, item.grn)} style={styles.grnLink}>
                                {item.grn || grnValue}
                              </Link>
                            </td>
                          ) : null}
                          <td style={{ ...styles.td, ...styles.tdCenter }}>
                            {renderPhotoThumb(item.photoUrl, item.productName)}
                          </td>
                          <td style={{ ...styles.td, ...styles.skuTd }}>
                            {canSelectSkuRows ? (
                              <label style={styles.skuCheckLabel}>
                                <input
                                  type="checkbox"
                                  checked={selectedProductKeys.includes(item.key)}
                                  onChange={() => toggleSelectedProduct(item.key)}
                                  style={styles.rowCheckbox}
                                />
                                <span style={styles.skuText}>{item.sku}</span>
                              </label>
                            ) : (
                              <span style={styles.skuText}>{item.sku}</span>
                            )}
                          </td>
                          <td style={styles.td}>{item.brand}</td>
                          <td style={styles.td}>{item.categoryLabel}</td>
                          <td style={styles.td}>
                            {renderProductName(item)}
                          </td>
                          <td style={{ ...styles.td, ...styles.tdCenter }}>{formatDate(item.latestDate)}</td>
                          <td style={{ ...styles.td, ...styles.tdCenter }}>
                            {renderReleasePill(item.releaseState, item.releaseCount, item.latestReleasedAt, item.latestReleasedBy)}
                          </td>
                          <td style={styles.tdNumber}>{formatNumber(item.qty)}</td>
                          {index === 0 ? (
                            <td rowSpan={detailRows.length} style={{ ...styles.tdNumber, ...styles.middleCell }}>
                              {formatNumber(row.totalQty)}
                            </td>
                          ) : null}
                        </tr>
                      ))
                    ) : (
                      <tr key={row.key}>
                        <td style={styles.td}>{row.brand}</td>
                        <td style={{ ...styles.td, ...styles.tdCenter }}>
                          {renderPhotoThumb(rowPhotoUrl, row.productList[0] || row.productName)}
                        </td>
                        <td style={{ ...styles.td, ...styles.skuTd }}>
                          <div style={styles.compactList}>
                            {skuList.slice(0, 4).map((sku) => (
                              <span key={sku} style={styles.skuText}>{sku}</span>
                            ))}
                            {skuList.length > 4 ? (
                              <span style={styles.categoryMeta}>+{skuList.length - 4} more</span>
                            ) : null}
                          </div>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.categoryStack}>
                            <span>{getDetailCategoryLabel({ itemType: row.itemType, subCategory: row.subCategory })}</span>
                          </div>
                        </td>
                        <td style={styles.td}>
                          {renderProductName(row)}
                        </td>
                        <td style={{ ...styles.td, ...styles.tdCenter }}>{formatDate(row.latestDate)}</td>
                        <td style={{ ...styles.td, ...styles.tdCenter }}>
                          {renderReleasePill(
                            row.releaseState,
                            row.releaseCount,
                            row.latestReleasedAt,
                            row.latestReleasedBy,
                            row.releaseHistory,
                            `model-release-${row.key}`
                          )}
                        </td>
                        <td style={styles.tdNumber}>{formatNumber(row.totalQty)}</td>
                        <td style={styles.td}>
                          <div style={styles.grnList}>
                            {detailGrnList.length
                              ? detailGrnList.map((item) => (
                                  <Link
                                    key={item.grn}
                                    href={getGrnLink(item.baseGrn, item.grn)}
                                    style={styles.grnLink}
                                  >
                                    {item.grn}
                                  </Link>
                                ))
                              : '-'}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={styles.tableToolbar}>
              <p style={styles.summary}>
                Showing {visibleProducts.length} of {groupedProducts.length} item record(s)
              </p>
              <div style={styles.paginationControls}>
                <label style={styles.pageSizeLabel}>
                  Per page
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value))
                      setCurrentPage(1)
                    }}
                    style={styles.pageSizeSelect}
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  style={safeCurrentPage <= 1 ? { ...styles.pageButton, ...styles.pageButtonDisabled } : styles.pageButton}
                  disabled={safeCurrentPage <= 1}
                >
                  Prev
                </button>
                <span style={styles.pageText}>Page {safeCurrentPage} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  style={safeCurrentPage >= totalPages ? { ...styles.pageButton, ...styles.pageButtonDisabled } : styles.pageButton}
                  disabled={safeCurrentPage >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
        </>
      ) : null}

      {sellingNameEditor && canManage ? (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Edit Selling Name">
          <div style={styles.nameModal}>
            <div style={styles.modalHeader}>
              <div>
                <p style={styles.modalEyebrow}>Warehouse</p>
                <h2 style={styles.modalTitle}>Edit Selling Name</h2>
              </div>
              <div style={styles.modalActionRow}>
                <button
                  type="button"
                  onClick={saveSellingName}
                  disabled={bulkWorking}
                  style={bulkWorking ? { ...styles.bulkButton, ...styles.bulkButtonDisabled } : styles.bulkButton}
                >
                  Save Name
                </button>
                <button type="button" onClick={closeSellingNameEditor} style={styles.modalCloseButton}>
                  Cancel
                </button>
              </div>
            </div>
            <p style={styles.modalHelperText}>
              This name is used as the sales/display name. Historical PL names remain unchanged.
            </p>
            <div style={styles.nameMetaGrid}>
              <div style={styles.nameMetaCard}>
                <span>SKU</span>
                <strong>{sellingNameEditor.sku}</strong>
              </div>
              <div style={styles.nameMetaCard}>
                <span>PL Names</span>
                <strong>{sellingNameEditor.plNames}</strong>
              </div>
              <div style={styles.nameMetaCard}>
                <span>Variant Name</span>
                <strong>{sellingNameEditor.variantName}</strong>
              </div>
            </div>
            <label style={styles.nameField}>
              <span>Selling Name</span>
              <input
                value={sellingNameDraft}
                onChange={(event) => setSellingNameDraft(event.target.value.toUpperCase())}
                style={styles.nameInput}
                placeholder="Enter selling/display name"
                autoFocus
              />
            </label>
          </div>
        </div>
      ) : null}

      {mergeEditor && canManage ? (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Merge SKU">
          <div style={styles.mergeModal}>
            <div style={styles.modalHeader}>
              <div>
                <p style={styles.modalEyebrow}>Warehouse</p>
                <h2 style={styles.modalTitle}>Merge SKU</h2>
              </div>
              <div style={styles.modalActionRow}>
                <button
                  type="button"
                  onClick={requestMergeConfirmation}
                  disabled={bulkWorking || !mergeTargetVariantId}
                  style={bulkWorking || !mergeTargetVariantId ? { ...styles.bulkButton, ...styles.bulkButtonDisabled } : styles.bulkButton}
                >
                  Save Merge
                </button>
                <button type="button" onClick={closeMergeEditor} style={styles.modalCloseButton}>
                  Cancel
                </button>
              </div>
            </div>
            <p style={styles.modalHelperText}>
              Choose the SKU that will be used as the selected SKU.
            </p>
            <div style={styles.mergeOptionList}>
              {mergeEditor.options.map((option) => (
                <label
                  key={option.variantId}
                  style={
                    Number(mergeTargetVariantId) === Number(option.variantId)
                      ? { ...styles.mergeOptionCard, ...styles.mergeOptionCardActive }
                      : styles.mergeOptionCard
                  }
                >
                  <input
                    type="radio"
                    name="mergeTargetVariantId"
                    value={option.variantId}
                    checked={Number(mergeTargetVariantId) === Number(option.variantId)}
                    onChange={(event) => setMergeTargetVariantId(event.target.value)}
                    style={styles.rowCheckbox}
                  />
                  <div style={styles.mergeOptionCopy}>
                    <div style={styles.mergeOptionTopLine}>
                      <strong>{option.sku}</strong>
                      <span>{formatNumber(option.qty)} qty</span>
                    </div>
                    <span style={styles.mergeOptionName}>{option.productName}</span>
                    <span style={styles.mergeOptionMeta}>
                      {option.plNameList.length ? option.plNameList.join(', ') : 'No PL name snapshot'}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {confirmDialog && canManage ? (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true" aria-label={confirmDialog.title}>
          <div style={styles.confirmModal}>
            <div style={styles.confirmIconWrap}>
              <svg viewBox="0 0 24 24" style={styles.confirmIcon} aria-hidden="true">
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.2 4.5 2.8 17.3A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.7L13.8 4.5a2 2 0 0 0-3.6 0Z" />
              </svg>
            </div>
            <div style={styles.confirmCopy}>
              <h2 style={styles.confirmTitle}>{confirmDialog.title}</h2>
              <p style={styles.confirmText}>{confirmDialog.message}</p>
            </div>
            <div style={styles.confirmButtonRow}>
              <button
                type="button"
                onClick={closeConfirmDialog}
                disabled={bulkWorking}
                style={bulkWorking ? { ...styles.confirmCancelButton, ...styles.bulkButtonDisabled } : styles.confirmCancelButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPendingAction}
                disabled={bulkWorking}
                style={
                  bulkWorking
                    ? { ...styles.confirmExecuteButton, ...styles.bulkButtonDisabled }
                    : confirmDialog.tone === 'danger'
                      ? { ...styles.confirmExecuteButton, ...styles.confirmDangerButton }
                      : styles.confirmExecuteButton
                }
              >
                {bulkWorking ? 'Working...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewPhoto ? (
        <div style={styles.previewOverlay} role="dialog" aria-modal="true" aria-label="Photo preview" onClick={() => setPreviewPhoto(null)}>
          <div style={styles.previewWrap} onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setPreviewPhoto(null)} style={styles.previewCloseButton}>
              X
            </button>
            <Image
              src={previewPhoto.src}
              alt={previewPhoto.alt || 'Photo preview'}
              width={900}
              height={900}
              unoptimized
              style={styles.previewImage}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}

const styles = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    padding: '18px',
    border: '1px solid #dbe4f0',
    borderRadius: '22px',
    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(245, 248, 252, 0.97) 100%)',
    boxShadow: '0 24px 54px rgba(15, 23, 42, 0.08)',
  },
  embeddedPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    minWidth: 0,
  },
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  headerCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: '1 1 420px',
    minWidth: 0,
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
  title: {
    margin: 0,
    fontSize: '30px',
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.5,
    maxWidth: '760px',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(140px, 180px)',
    gap: '8px',
    flex: '0 0 auto',
    minWidth: 0,
  },
  kpiCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: '4px',
  },
  totalKpiCard: {
    background: '#0f172a',
    border: '1px solid #0f172a',
    alignItems: 'center',
    textAlign: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  totalKpiLabel: {
    color: '#fff',
  },
  kpiValue: {
    color: '#111827',
    fontSize: '20px',
    lineHeight: 1,
  },
  totalKpiValue: {
    color: '#fff',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  filterBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: 0,
    borderRadius: 0,
    border: 'none',
    background: 'transparent',
  },
  tableBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '18px',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    background: 'rgba(255, 255, 255, 0.98)',
  },
  productTabRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '22px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#e2e8f0',
    overflowX: 'auto',
  },
  productTabButton: {
    minHeight: '38px',
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    padding: '0 0 10px',
    fontSize: '14px',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: 'inset 0 -2px 0 transparent',
    fontFamily: 'inherit',
  },
  productTabButtonActive: {
    color: '#111827',
    boxShadow: 'inset 0 -2px 0 #111827',
  },
  photoTabHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  photoTabTitle: {
    margin: 0,
    color: '#111827',
    fontSize: '18px',
    fontWeight: '900',
  },
  photoTabText: {
    margin: '4px 0 0',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: '600',
    lineHeight: 1.45,
  },
  photoTabCount: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '30px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#f1f5f9',
    color: '#334155',
    fontSize: '12px',
    fontWeight: '800',
  },
  filterTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  searchField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: '1 1 280px',
    minWidth: '220px',
  },
  searchInputRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 40px',
    gap: '10px',
    alignItems: 'center',
  },
  searchLabelRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 40px',
    alignItems: 'center',
    gap: '10px',
  },
  searchLabelContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    minWidth: 0,
    flexWrap: 'wrap',
  },
  searchLabelSpacer: {
    width: '40px',
    height: '1px',
  },
  smallToggleStack: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  smallSegmentedControl: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '3px',
    border: '1px solid #dbe4ef',
    borderRadius: '10px',
    background: '#f8fafc',
  },
  smallSegmentedButton: {
    minHeight: '28px',
    padding: '0 10px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    color: '#475569',
    fontSize: '12px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  segmentedControl: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '3px',
    border: '1px solid #dbe4ef',
    borderRadius: '10px',
    background: '#f8fafc',
  },
  segmentedButton: {
    minHeight: '28px',
    padding: '0 10px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    color: '#475569',
    fontSize: '12px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  segmentedButtonActive: {
    background: '#111827',
    color: '#fff',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.12)',
  },
  clearButton: {
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: '10px',
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#be123c',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  clearIconButton: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#be123c',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  clearIcon: {
    width: '18px',
    height: '18px',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '12px',
  },
  viewByInline: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: '56px',
  },
  inlineLabel: {
    color: '#475569',
    fontSize: '13px',
    fontWeight: '800',
    whiteSpace: 'nowrap',
  },
  dateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#111827',
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
  select: {
    height: '44px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    padding: '0 12px',
    fontSize: '14px',
    background: '#fff',
  },
  filterDropdown: {
    position: 'relative',
  },
  filterButton: {
    width: '100%',
    height: '44px',
    borderRadius: '10px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    background: '#fff',
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '0 12px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  filterButtonActive: {
    borderColor: '#111827',
    background: '#f8fafc',
  },
  filterButtonText: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  filterCaret: {
    color: '#64748b',
    fontSize: '10px',
    flex: '0 0 auto',
  },
  filterMenu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    zIndex: 20,
    maxHeight: '240px',
    overflowY: 'auto',
    padding: '6px',
    borderRadius: '12px',
    border: '1px solid #dbe4ef',
    background: '#fff',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.14)',
  },
  filterSearchInput: {
    width: '100%',
    boxSizing: 'border-box',
    height: '34px',
    marginBottom: '6px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    padding: '0 10px',
    fontSize: '13px',
    fontWeight: '600',
    outline: 'none',
  },
  filterOption: {
    width: '100%',
    minHeight: '34px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    color: '#334155',
    display: 'block',
    padding: '8px 10px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  filterOptionActive: {
    background: '#111827',
    color: '#fff',
  },
  filterEmptyOption: {
    minHeight: '34px',
    display: 'flex',
    alignItems: 'center',
    padding: '8px 10px',
    color: '#94a3b8',
    fontSize: '13px',
    fontWeight: '600',
  },
  checkboxLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '700',
  },
  statusText: {
    margin: 0,
    color: '#64748b',
  },
  error: {
    margin: 0,
    color: '#dc2626',
  },
  emptyState: {
    border: '1px dashed #d1d5db',
    borderRadius: '12px',
    padding: '24px',
    color: '#64748b',
  },
  bulkActionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap',
    padding: '10px',
    border: '1px solid #dbe4ef',
    borderRadius: '12px',
    background: '#f8fafc',
  },
  bulkActionCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  inlineKpiCard: {
    minWidth: '116px',
    minHeight: '34px',
    padding: '5px 10px',
    borderRadius: '9px',
    border: '1px solid #dbe4ef',
    background: '#fff',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    textAlign: 'center',
    flex: '0 0 auto',
  },
  inlineTotalKpiCard: {
    border: '1px solid #111827',
    background: '#111827',
  },
  inlineKpiLabel: {
    color: '#64748b',
    fontSize: '9px',
    lineHeight: 1,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  inlineTotalKpiLabel: {
    color: '#fff',
  },
  inlineKpiValue: {
    color: '#111827',
    fontSize: '14px',
    lineHeight: 1,
    fontWeight: '900',
    fontVariantNumeric: 'tabular-nums',
  },
  inlineTotalKpiValue: {
    color: '#fff',
  },
  bulkActionTitle: {
    color: '#111827',
    fontSize: '12px',
    fontWeight: '800',
  },
  bulkActionText: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: '600',
  },
  bulkButtonRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    flexWrap: 'nowrap',
    width: '100%',
    paddingBottom: '2px',
  },
  bulkActionCluster: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    flexWrap: 'nowrap',
    marginLeft: 'auto',
  },
  bulkButton: {
    minHeight: '34px',
    padding: '0 12px',
    borderRadius: '9px',
    border: '1px solid #111827',
    background: '#111827',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  finalBulkButton: {
    minHeight: '34px',
    padding: '0 12px',
    borderRadius: '9px',
    border: '1px solid #111827',
    background: '#111827',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '800',
    cursor: 'pointer',
    flex: '0 0 auto',
    whiteSpace: 'nowrap',
  },
  secondaryBulkButton: {
    minHeight: '34px',
    padding: '0 12px',
    borderRadius: '9px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
    fontSize: '12px',
    fontWeight: '800',
    cursor: 'pointer',
    flex: '0 0 auto',
    whiteSpace: 'nowrap',
  },
  photoListComboWrap: {
    position: 'relative',
    display: 'inline-flex',
    flex: '0 0 auto',
  },
  photoListAddButton: {
    minHeight: '34px',
    padding: '0 11px',
    borderRadius: '9px 0 0 9px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
    fontSize: '12px',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  photoListCountButton: {
    minWidth: '38px',
    minHeight: '34px',
    padding: '0 9px',
    borderRadius: '0 9px 9px 0',
    border: '1px solid #111827',
    marginLeft: '-1px',
    background: '#111827',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '900',
    fontVariantNumeric: 'tabular-nums',
    cursor: 'pointer',
  },
  photoListCountButtonActive: {
    border: '1px solid #111827',
    background: '#0f172a',
    boxShadow: '0 10px 22px rgba(15, 23, 42, 0.10)',
  },
  photoListPopover: {
    position: 'absolute',
    right: 0,
    bottom: 'calc(100% + 8px)',
    zIndex: 20,
    width: '190px',
    padding: '10px',
    borderRadius: '12px',
    border: '1px solid #dbe4ef',
    background: '#fff',
    boxShadow: '0 18px 38px rgba(15, 23, 42, 0.16)',
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  photoListPopoverEyebrow: {
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  photoListPopoverCount: {
    color: '#111827',
    fontSize: '16px',
    fontWeight: '900',
    fontVariantNumeric: 'tabular-nums',
  },
  photoListPopoverButton: {
    minHeight: '30px',
    padding: '0 10px',
    borderRadius: '8px',
    border: '1px solid #111827',
    background: '#111827',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  bulkButtonDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
  actionMessage: {
    margin: 0,
    color: '#047857',
    fontSize: '12px',
    fontWeight: '700',
  },
  actionError: {
    margin: 0,
    color: '#be123c',
    fontSize: '12px',
    fontWeight: '700',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
  },
  tableToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '-2px',
  },
  summary: {
    margin: 0,
    color: '#334155',
    fontSize: '14px',
    fontWeight: '500',
  },
  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  pageSizeLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#475569',
    fontSize: '13px',
    fontWeight: '500',
  },
  pageSizeSelect: {
    height: '36px',
    borderRadius: '9px',
    border: '1px solid #d1d5db',
    background: '#fff',
    padding: '0 10px',
    fontSize: '13px',
    fontWeight: '500',
  },
  pageButton: {
    height: '36px',
    padding: '0 12px',
    borderRadius: '9px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  pageButtonDisabled: {
    color: '#94a3b8',
    background: '#f8fafc',
    cursor: 'not-allowed',
  },
  pageText: {
    color: '#475569',
    fontSize: '13px',
    fontWeight: '500',
  },
  table: {
    width: '100%',
    minWidth: '960px',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: 0,
    background: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
    color: '#334155',
    fontSize: '11px',
    fontWeight: '800',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  thNumber: {
    textAlign: 'center',
    padding: 0,
    background: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
    color: '#334155',
    fontSize: '11px',
    fontWeight: '800',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  thCenter: {
    textAlign: 'center',
  },
  photoTh: {
    minWidth: '56px',
    width: '56px',
  },
  skuTh: {
    minWidth: '150px',
    width: '150px',
    textAlign: 'center',
  },
  sortHeaderButton: {
    width: '100%',
    minHeight: '44px',
    padding: '9px 10px',
    border: 'none',
    background: 'transparent',
    color: '#334155',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '6px',
    fontSize: '11px',
    fontWeight: '800',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  sortHeaderButtonRight: {
    justifyContent: 'center',
  },
  sortHeaderButtonCenter: {
    justifyContent: 'center',
  },
  sortIcon: {
    color: '#94a3b8',
    fontSize: '13px',
    lineHeight: 1,
  },
  sortIconActive: {
    color: '#111827',
    fontSize: '13px',
    lineHeight: 1,
  },
  td: {
    padding: '9px 10px',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
    fontSize: '11px',
    fontWeight: '600',
    lineHeight: 1.4,
    verticalAlign: 'middle',
  },
  middleCell: {
    verticalAlign: 'middle',
  },
  skuTd: {
    minWidth: '150px',
    width: '150px',
    whiteSpace: 'nowrap',
  },
  skuCheckLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    maxWidth: '100%',
    whiteSpace: 'nowrap',
  },
  rowCheckbox: {
    width: '16px',
    height: '16px',
    flex: '0 0 auto',
    accentColor: '#111827',
  },
  skuText: {
    display: 'inline-block',
    color: '#111827',
    fontSize: '11px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  tdNumber: {
    padding: '9px 10px',
    borderBottom: '1px solid #f1f5f9',
    color: '#111827',
    fontSize: '11px',
    fontWeight: '600',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontVariantNumeric: 'tabular-nums',
  },
  tdCenter: {
    textAlign: 'center',
  },
  productName: {
    color: '#111827',
    fontWeight: '600',
  },
  productNameCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    minWidth: 0,
  },
  editNameButton: {
    minHeight: '26px',
    padding: '0 8px',
    borderRadius: '8px',
    border: '1px solid #dbe4ef',
    background: '#fff',
    color: '#475569',
    fontSize: '10px',
    fontWeight: '800',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  photoThumbButton: {
    width: '36px',
    height: '36px',
    padding: 0,
    border: '1px solid #dbe4ef',
    borderRadius: '8px',
    background: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    cursor: 'pointer',
    boxShadow: '0 6px 14px rgba(15, 23, 42, 0.08)',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  photoPlaceholder: {
    width: '36px',
    height: '36px',
    border: '1px dashed #cbd5e1',
    borderRadius: '8px',
    background: '#f8fafc',
    color: '#94a3b8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  draftPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '22px',
    minWidth: '62px',
    padding: '0 8px',
    borderRadius: '999px',
    background: '#f1f5f9',
    color: '#475569',
    fontSize: '10px',
    fontWeight: '800',
  },
  releasedPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '22px',
    minWidth: '72px',
    padding: '0 8px',
    borderRadius: '999px',
    background: '#dcfce7',
    color: '#166534',
    fontSize: '10px',
    fontWeight: '800',
  },
  partialPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '22px',
    minWidth: '68px',
    padding: '0 8px',
    borderRadius: '999px',
    background: '#fef3c7',
    color: '#92400e',
    fontSize: '10px',
    fontWeight: '800',
  },
  releaseStatusStack: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    maxWidth: '150px',
  },
  releaseMeta: {
    color: '#64748b',
    fontSize: '9px',
    fontWeight: '700',
    lineHeight: 1.25,
    overflowWrap: 'anywhere',
  },
  releaseTooltipWrap: {
    position: 'relative',
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    outline: 'none',
  },
  emptyStatusText: {
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: '800',
  },
  categoryStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  categoryMeta: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: '600',
  },
  compactList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },
  compactListItem: {
    color: '#334155',
    fontSize: '11px',
    fontWeight: '600',
    lineHeight: 1.35,
  },
  qtyLine: {
    color: '#111827',
    fontSize: '13px',
    fontWeight: '900',
    lineHeight: 1.35,
    fontVariantNumeric: 'tabular-nums',
  },
  pillRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  typePill: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '28px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#eef2ff',
    color: '#3730a3',
    fontSize: '12px',
    fontWeight: '800',
  },
  sizePill: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '28px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#f1f5f9',
    color: '#334155',
    fontSize: '12px',
    fontWeight: '700',
  },
  grnList: {
    maxWidth: '280px',
    color: '#334155',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '6px',
  },
  grnLink: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '24px',
    padding: '0 8px',
    borderRadius: '999px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '11px',
    fontWeight: '600',
    textDecoration: 'none',
  },
  grnPlainText: {
    color: '#334155',
    fontSize: '11px',
    fontWeight: '600',
  },
  grnTextPill: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '24px',
    padding: '0 8px',
    borderRadius: '999px',
    background: '#f1f5f9',
    color: '#334155',
    fontSize: '11px',
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: 'rgba(15, 23, 42, 0.42)',
  },
  photoModal: {
    width: 'min(920px, 100%)',
    maxHeight: '82vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    borderRadius: '18px',
    border: '1px solid #dbe4ef',
    background: '#fff',
    boxShadow: '0 28px 70px rgba(15, 23, 42, 0.24)',
    padding: '18px',
  },
  nameModal: {
    width: 'min(620px, 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    borderRadius: '18px',
    border: '1px solid #dbe4ef',
    background: '#fff',
    boxShadow: '0 28px 70px rgba(15, 23, 42, 0.24)',
    padding: '18px',
  },
  mergeModal: {
    width: 'min(720px, 100%)',
    maxHeight: '82vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    borderRadius: '18px',
    border: '1px solid #dbe4ef',
    background: '#fff',
    boxShadow: '0 28px 70px rgba(15, 23, 42, 0.24)',
    padding: '18px',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
  },
  modalActionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    flexWrap: 'wrap',
  },
  modalEyebrow: {
    margin: 0,
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  modalTitle: {
    margin: '2px 0 0',
    color: '#0f172a',
    fontSize: '24px',
    fontWeight: '900',
  },
  modalHelperText: {
    margin: 0,
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.45,
    fontWeight: '600',
  },
  nameMetaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '8px',
  },
  nameMetaCard: {
    minWidth: 0,
    padding: '10px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  nameField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
    color: '#111827',
    fontSize: '12px',
    fontWeight: '800',
  },
  nameInput: {
    width: '100%',
    minHeight: '46px',
    padding: '0 14px',
    borderRadius: '12px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '700',
    outline: 'none',
  },
  mergeOptionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflow: 'auto',
    paddingRight: '2px',
  },
  mergeOptionCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #dbe4ef',
    background: '#fff',
    cursor: 'pointer',
  },
  mergeOptionCardActive: {
    border: '1px solid #111827',
    background: '#f8fafc',
  },
  mergeOptionCopy: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  mergeOptionTopLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    color: '#111827',
    fontSize: '13px',
    fontWeight: '800',
  },
  mergeOptionName: {
    color: '#111827',
    fontSize: '12px',
    fontWeight: '700',
  },
  mergeOptionMeta: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: '600',
    lineHeight: 1.35,
  },
  modalCloseButton: {
    minHeight: '34px',
    padding: '0 12px',
    borderRadius: '9px',
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#be123c',
    fontSize: '12px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  confirmModal: {
    width: 'min(420px, 100%)',
    padding: '22px',
    borderRadius: '18px',
    border: '1px solid #e2e8f0',
    background: '#fff',
    boxShadow: '0 28px 70px rgba(15, 23, 42, 0.22)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
    textAlign: 'center',
  },
  confirmIconWrap: {
    width: '48px',
    height: '48px',
    borderRadius: '999px',
    background: '#f8fafc',
    border: '1px solid #dbe4ef',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmIcon: {
    width: '24px',
    height: '24px',
    fill: 'none',
    stroke: '#0f172a',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  confirmCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  confirmTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '19px',
    fontWeight: '900',
    letterSpacing: '-0.02em',
  },
  confirmText: {
    margin: 0,
    color: '#475569',
    fontSize: '13px',
    fontWeight: '600',
    lineHeight: 1.5,
  },
  confirmButtonRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    width: '100%',
    marginTop: '4px',
  },
  confirmCancelButton: {
    minHeight: '38px',
    padding: '0 16px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
    fontSize: '12px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  confirmExecuteButton: {
    minHeight: '38px',
    padding: '0 16px',
    borderRadius: '10px',
    border: '1px solid #111827',
    background: '#111827',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  confirmDangerButton: {
    border: '1px solid #9f1239',
    background: '#9f1239',
  },
  photoListTableWrap: {
    overflow: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
  },
  photoListTable: {
    width: '100%',
    minWidth: '1080px',
    borderCollapse: 'collapse',
  },
  removeDraftButton: {
    width: '28px',
    height: '28px',
    padding: 0,
    borderRadius: '999px',
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#be123c',
    fontSize: '12px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  previewOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: 'rgba(15, 23, 42, 0.72)',
  },
  previewWrap: {
    position: 'relative',
    width: 'fit-content',
    maxWidth: 'min(760px, 100%)',
    maxHeight: '86vh',
    borderRadius: 0,
    background: 'transparent',
    boxShadow: 'none',
    overflow: 'visible',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: 'auto',
    maxHeight: '86vh',
    objectFit: 'contain',
    display: 'block',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.28)',
  },
  previewCloseButton: {
    position: 'absolute',
    top: '-14px',
    right: '-14px',
    zIndex: 1,
    width: '32px',
    height: '32px',
    padding: 0,
    borderRadius: '999px',
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#be123c',
    fontSize: '15px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  dateList: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '6px',
  },
  datePill: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '28px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#f8fafc',
    color: '#334155',
    fontSize: '12px',
    fontWeight: '800',
  },
}
