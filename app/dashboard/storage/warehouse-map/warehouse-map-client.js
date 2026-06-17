'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

import { createClient } from '@/utils/supabase/browser'
import styles from './warehouse-map.module.css'

const supabase = createClient()
const BATCH_SIZE = 1000

const RACK_SLOTS = [
  { key: 'A', suffix: 'A', level: 'Level 3' },
  { key: 'B', suffix: 'B', level: 'Level 3' },
  { key: 'C', suffix: 'C', level: 'Level 2' },
  { key: 'D', suffix: 'D', level: 'Level 2' },
  { key: 'E', suffix: 'E', level: 'Level 1' },
  { key: 'F', suffix: 'F', level: 'Level 1' },
]
const RACK_SLOT_SUFFIXES = new Set(RACK_SLOTS.map((slot) => slot.suffix))
const SUBLOCATION_ALL_KEY = 'ALL'
const UNASSIGNED_SUBLOCATION_KEY = 'UNASSIGNED'
const SUBLOCATION_KEYS = Array.from({ length: 12 }, (_, index) => `K${index + 1}`)
const SUBLOCATION_KEY_SET = new Set(SUBLOCATION_KEYS)
const SUBLOCATION_LAYOUT_ROWS = [
  ['K11', 'K12'],
  ['K9', 'K10'],
  ['K7', 'K8'],
  ['K5', 'K6'],
  ['K3', 'K4'],
  ['K1', 'K2'],
]
const SUBLOCATION_LAYOUT_KEYS = SUBLOCATION_LAYOUT_ROWS.flat()

const WAREHOUSES = {
  LV87: {
    key: 'LV87',
    title: 'Warehouse LV87',
    mapRatio: '420 / 680',
    zones: [
      { code: '6', x: 1.5, y: 17, w: 8, h: 12, variant: 'standard' },
      { code: '5', x: 1.5, y: 29, w: 8, h: 12, variant: 'standard' },
      { code: '4', x: 1.5, y: 41, w: 8, h: 12, variant: 'standard' },
      { code: '3', x: 1.5, y: 53, w: 8, h: 12, variant: 'standard' },
      { code: '2', x: 1.5, y: 65, w: 8, h: 12, variant: 'standard' },
      { code: '1', x: 1.5, y: 77, w: 8, h: 12, variant: 'standard' },
      { code: '37', x: 31.7, y: 65, w: 8, h: 12, variant: 'standard' },
      { code: '38', x: 31.7, y: 77, w: 8, h: 12, variant: 'standard' },
    ],
    walls: [
      { x: 0, y: 0, w: 1.3, h: 8 },
      { x: 0, y: 15, w: 1.3, h: 81 },
      { x: 40, y: 70, w: 2, h: 26 },
      { x: 40, y: 70, w: 55, h: 1.3 },
      { x: 40, y: 95, w: 55, h: 1.3 },
      { x: 95, y: 70, w: 1.4, h: 25 },
    ],
    areas: [
      { label: 'Office Area', x: 54, y: 77.5, w: 24, h: 10, tone: 'room' },
    ],
    arrows: [
      { label: 'To Warehouse LV85', targetWarehouseKey: 'LV85', x: 1.8, y: 9, w: 27, h: 3.5, direction: 'left' },
    ],
  },
  LV85: {
    key: 'LV85',
    title: 'Warehouse LV85',
    mapRatio: '420 / 680',
    zones: [
      { code: '21', x: 11, y: 6, w: 8, h: 13, variant: 'standard' },
      { code: '20', x: 11, y: 19, w: 8, h: 13, variant: 'standard' },
      { code: '19', x: 11, y: 32, w: 8, h: 13, variant: 'standard' },
      { code: '18', x: 11, y: 45, w: 8, h: 13, variant: 'standard' },
      { code: '17', x: 11, y: 58, w: 8, h: 13, variant: 'standard' },
      { code: '12', x: 39, y: 6, w: 8, h: 13, variant: 'standard' },
      { code: '13', x: 39, y: 19, w: 8, h: 13, variant: 'standard' },
      { code: '14', x: 39, y: 32, w: 8, h: 13, variant: 'standard' },
      { code: '15', x: 39, y: 45, w: 8, h: 13, variant: 'standard' },
      { code: '16', x: 39, y: 58, w: 8, h: 13, variant: 'standard' },
      { code: '7', x: 47, y: 6, w: 8, h: 13, variant: 'standard' },
      { code: '8', x: 47, y: 19, w: 8, h: 13, variant: 'standard' },
      { code: '9', x: 47, y: 32, w: 8, h: 13, variant: 'standard' },
      { code: '10', x: 47, y: 45, w: 8, h: 13, variant: 'standard' },
      { code: '11', x: 47, y: 58, w: 8, h: 13, variant: 'standard' },
    ],
    walls: [
      { x: 8, y: 5, w: 1.5, h: 66 },
      { x: 8, y: 71, w: 50, h: 1.3 },
      { x: 8, y: 71, w: 1.5, h: 25 },
      { x: 58, y: 71, w: 1.5, h: 25 },
      { x: 8, y: 95, w: 50, h: 1.3 },
      { x: 96, y: 6, w: 1.5, h: 89 },
      { x: 8, y: 0, w: 82, h: 1.2 },
    ],
    areas: [
      { label: 'Inbound Area', x: 21, y: 78, w: 24, h: 10, tone: 'room' },
      { label: 'QC Area', x: 78, y: 6, w: 12, h: 65, tone: 'room' },
    ],
    arrows: [
      { label: 'To Warehouse LV83', targetWarehouseKey: 'LV83', x: 4, y: 1.4, w: 24, h: 3.5, direction: 'left' },
      { label: 'To Warehouse LV87', targetWarehouseKey: 'LV87', x: 77, y: 1.4, w: 20, h: 3.5, direction: 'right' },
    ],
  },
  LV83: {
    key: 'LV83',
    title: 'Warehouse LV83',
    mapRatio: '420 / 680',
    zones: [
      { code: '7', x: 1.5, y: 5, w: 8, h: 12, variant: 'standard' },
      { code: '6', x: 1.5, y: 17, w: 8, h: 12, variant: 'standard' },
      { code: '5', x: 1.5, y: 29, w: 8, h: 12, variant: 'standard' },
      { code: '4', x: 1.5, y: 41, w: 8, h: 12, variant: 'standard' },
      { code: '3', x: 1.5, y: 53, w: 8, h: 12, variant: 'standard' },
      { code: '2', x: 1.5, y: 65, w: 8, h: 12, variant: 'standard' },
      { code: '1', x: 1.5, y: 77, w: 8, h: 12, variant: 'standard' },
      { code: '36', x: 47, y: 5, w: 8, h: 12, variant: 'standard' },
      { code: '35', x: 47, y: 17, w: 8, h: 12, variant: 'standard' },
      { code: '34', x: 47, y: 29, w: 8, h: 12, variant: 'standard' },
      { code: '33', x: 47, y: 41, w: 8, h: 12, variant: 'standard' },
      { code: '32', x: 47, y: 53, w: 8, h: 12, variant: 'standard' },
      { code: '31', x: 55, y: 5, w: 8, h: 12, variant: 'standard' },
      { code: '30', x: 55, y: 17, w: 8, h: 12, variant: 'standard' },
      { code: '29', x: 55, y: 29, w: 8, h: 12, variant: 'standard' },
      { code: '28', x: 55, y: 41, w: 8, h: 12, variant: 'standard' },
      { code: '27', x: 55, y: 53, w: 8, h: 12, variant: 'standard' },
      { code: '26', x: 83.5, y: 5, w: 8, h: 12, variant: 'standard' },
      { code: '25', x: 83.5, y: 17, w: 8, h: 12, variant: 'standard' },
      { code: '24', x: 83.5, y: 29, w: 8, h: 12, variant: 'standard' },
      { code: '23', x: 83.5, y: 41, w: 8, h: 12, variant: 'standard' },
      { code: '22', x: 83.5, y: 53, w: 8, h: 12, variant: 'standard' },
    ],
    walls: [
      { x: 0, y: 0, w: 1.3, h: 96 },
      { x: 91.8, y: 5, w: 1.5, h: 61 },
      { x: 39, y: 66, w: 53, h: 1.3 },
      { x: 39, y: 66, w: 1.5, h: 30 },
      { x: 92, y: 66, w: 1.5, h: 30 },
      { x: 39, y: 95, w: 53, h: 1.3 },
    ],
    areas: [
      { label: 'Arkline Picker Area', x: 54, y: 77.5, w: 24, h: 10, tone: 'room' },
    ],
    arrows: [
      { label: 'To Warehouse LV85', targetWarehouseKey: 'LV85', x: 68, y: 1.4, w: 25, h: 3.5, direction: 'right' },
    ],
  },
}

const WAREHOUSE_ORDER = ['LV83', 'LV85', 'LV87']
const MAP_BUILDER_STORAGE_KEY = 'warehouse-map-builder-layout-v1'
const SNAP_STEP = 1
const MIN_ELEMENT_SIZE = 2
const EDITOR_TOOLS = [
  { type: 'pallet', label: 'Pallet Rack' },
  { type: 'box', label: 'Decorative Box' },
  { type: 'line', label: 'Line' },
  { type: 'arrow', label: 'Arrow' },
  { type: 'text', label: 'Text Box' },
]
const TOOL_DEFAULTS = {
  pallet: { w: 8, h: 12 },
  box: { w: 18, h: 8 },
  line: { w: 24, h: 1.2 },
  arrow: { w: 22, h: 4 },
  text: { w: 18, h: 5 },
}

function createElementId(type) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function snapValue(value) {
  return Math.round(value / SNAP_STEP) * SNAP_STEP
}

function normalizeSavedElement(element) {
  return {
    ...element,
    x: Number(element.x || 0),
    y: Number(element.y || 0),
    w: Number(element.w || 8),
    h: Number(element.h || 8),
    rotation: Number(element.rotation || 0),
  }
}

function createDefaultMapElements(warehouse) {
  return [
    ...warehouse.walls.map((wall, index) => ({
      id: `wall-${warehouse.key}-${index}`,
      type: 'wall',
      ...wall,
      rotation: 0,
    })),
    ...warehouse.areas.map((area, index) => ({
      id: `box-${warehouse.key}-${index}`,
      type: 'box',
      label: area.label,
      tone: area.tone,
      x: area.x,
      y: area.y,
      w: area.w,
      h: area.h,
      rotation: 0,
    })),
    ...(warehouse.arrows || []).map((arrow, index) => ({
      id: `nav-arrow-${warehouse.key}-${index}`,
      type: 'nav-arrow',
      label: arrow.label,
      targetWarehouseKey: arrow.targetWarehouseKey,
      direction: arrow.direction,
      x: arrow.x,
      y: arrow.y,
      w: arrow.w,
      h: arrow.h,
      rotation: 0,
    })),
    ...warehouse.zones.map((zone) => ({
      id: `pallet-${warehouse.key}-${zone.code}`,
      type: 'pallet',
      code: zone.code,
      variant: zone.variant || 'standard',
      x: zone.x,
      y: zone.y,
      w: zone.w,
      h: zone.h,
      rotation: 0,
    })),
  ]
}

function createDefaultLayouts() {
  return Object.fromEntries(
    Object.values(WAREHOUSES).map((warehouse) => [
      warehouse.key,
      { elements: createDefaultMapElements(warehouse) },
    ])
  )
}

function createDroppedElement(type, x, y, assignedCode = '') {
  const defaults = TOOL_DEFAULTS[type] || TOOL_DEFAULTS.box
  const baseElement = {
    id: createElementId(type),
    type,
    x: clampNumber(snapValue(x), 0, 98),
    y: clampNumber(snapValue(y), 0, 98),
    w: defaults.w,
    h: defaults.h,
    rotation: 0,
  }

  if (type === 'pallet') {
    return {
      ...baseElement,
      code: assignedCode,
      variant: 'standard',
    }
  }

  if (type === 'box') {
    return {
      ...baseElement,
      label: 'Label',
      tone: 'room',
    }
  }

  if (type === 'text') {
    return {
      ...baseElement,
      label: 'Text',
    }
  }

  if (type === 'arrow') {
    return {
      ...baseElement,
      label: 'Flow',
      direction: 'right',
    }
  }

  return baseElement
}

function normalizeWarehouseValue(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function normalizeLocationCode(value) {
  const compact = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')

  const arkMatch = compact.match(/^ARK-?0*(\d+)$/)
  if (arkMatch) {
    return `ARK-${Number(arkMatch[1])}`
  }

  if (/^\d+$/.test(compact)) {
    return String(Number(compact))
  }

  return compact
}

function splitLocationIdentifier(value) {
  const normalized = normalizeLocationCode(value)

  if (!normalized) {
    return { base: '', suffix: '' }
  }

  const arkMatch = normalized.match(/^ARK-?0*(\d+)[-_/]?([A-Z])?$/)
  if (arkMatch) {
    return {
      base: `ARK-${Number(arkMatch[1])}`,
      suffix: arkMatch[2] || '',
    }
  }

  const numericMatch = normalized.match(/^0*(\d+)[-_/]?([A-Z])?$/)
  if (numericMatch) {
    return {
      base: String(Number(numericMatch[1])),
      suffix: numericMatch[2] || '',
    }
  }

  return { base: normalized, suffix: '' }
}

function getLocationBaseCode(value) {
  return splitLocationIdentifier(value).base
}

function getSlotSuffixFromValue(value) {
  const normalized = normalizeLocationCode(value)

  if (RACK_SLOT_SUFFIXES.has(normalized)) {
    return normalized
  }

  const suffix = splitLocationIdentifier(value).suffix
  return RACK_SLOT_SUFFIXES.has(suffix) ? suffix : ''
}

function getLocationSlotSuffix(location) {
  return (
    getSlotSuffixFromValue(location?.location_code) ||
    getSlotSuffixFromValue(location?.location_name) ||
    getSlotSuffixFromValue(location?.sub_location)
  )
}

function getSubLocationKeyFromValue(value) {
  const rawValue = String(value || '').trim().toUpperCase()
  const compactValue = rawValue.replace(/\s+/g, '')
  const directMatch = compactValue.match(/^K[-_]?0*(1[0-2]|[1-9])$/)

  if (directMatch) {
    return `K${Number(directMatch[1])}`
  }

  const compactTrailingMatch = compactValue.match(/K[-_]?0*(1[0-2]|[1-9])$/)

  if (compactTrailingMatch) {
    return `K${Number(compactTrailingMatch[1])}`
  }

  const embeddedMatch = rawValue.match(/(?:^|[^A-Z0-9])K[-_]?0*(1[0-2]|[1-9])(?:$|[^A-Z0-9])/)

  if (embeddedMatch) {
    return `K${Number(embeddedMatch[1])}`
  }

  return ''
}

function getLocationSubLocationKey(location) {
  return (
    getSubLocationKeyFromValue(location?.sub_location) ||
    getSubLocationKeyFromValue(location?.location_name) ||
    getSubLocationKeyFromValue(location?.location_code)
  )
}

function getEntrySubLocationKey(entry) {
  return getLocationSubLocationKey(entry.location) || UNASSIGNED_SUBLOCATION_KEY
}

function getSubLocationLabel(key) {
  return key === UNASSIGNED_SUBLOCATION_KEY ? 'Unassigned' : key
}

function getRackSlotCode(zoneCode, slot) {
  const baseCode = getLocationBaseCode(zoneCode) || normalizeLocationCode(zoneCode)
  return `${baseCode}${slot.suffix}`
}

function matchesWarehouse(location, warehouseKey) {
  const warehouseValue = normalizeWarehouseValue(location.location_id || location.location_name)
  const warehouseCode = normalizeWarehouseValue(warehouseKey)
  const warehouseNumber = warehouseCode.replace('LV', '')

  return (
    warehouseValue.includes(warehouseCode) ||
    warehouseValue === warehouseNumber ||
    warehouseValue.endsWith(warehouseNumber)
  )
}

function matchesZone(location, zoneCode) {
  const targetCode = getLocationBaseCode(zoneCode)
  const locationCode = getLocationBaseCode(location.location_code)
  const locationName = getLocationBaseCode(location.location_name)

  return locationCode === targetCode || locationName === targetCode
}

function getPositionStyle(item) {
  return {
    '--x': `${item.x}%`,
    '--y': `${item.y}%`,
    '--w': `${item.w}%`,
    '--h': `${item.h}%`,
  }
}

function getElementPositionStyle(item) {
  return {
    ...getPositionStyle(item),
    '--rotate': `${Number(item.rotation || 0)}deg`,
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

function normalizeSizeValue(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '')
}

function formatDateTime(value) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

async function fetchAllRackLocations() {
  const allRows = []
  let from = 0

  while (true) {
    const to = from + BATCH_SIZE - 1
    const { data, error } = await supabase
      .from('dir_rack_locations')
      .select('id, location_type, location_id, location_code, sub_location, location_name')
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
      .select('id, rack_location_id, item_name, size, qty, notes, created_at')
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
  const allRows = []
  let from = 0

  while (true) {
    const to = from + BATCH_SIZE - 1
    const { data, error } = await supabase
      .from('restock_request')
      .select('id, requester_name, item_name, size, qty, take_from, storage_id, search_term, request_status, created_at, completed_at, completed_by')
      .eq('request_status', 'completed')
      .order('completed_at', { ascending: false })
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

async function fetchUserProfiles() {
  const { data, error } = await supabase
    .from('dir_user_profiles')
    .select('email, display_name')

  if (error) {
    throw error
  }

  return data || []
}

async function getCurrentUserEmail() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.email || null
}

function normalizeRackLocations(rows) {
  return (rows || []).map((item) => ({
    ...item,
    location_type: typeof item.location_type === 'string' ? item.location_type.trim() : item.location_type,
    location_id: typeof item.location_id === 'string' ? item.location_id.trim() : item.location_id,
    location_code: typeof item.location_code === 'string' ? item.location_code.trim() : item.location_code,
    sub_location: typeof item.sub_location === 'string' ? item.sub_location.trim() : item.sub_location,
    location_name: typeof item.location_name === 'string' ? item.location_name.trim() : item.location_name,
  }))
}

function getZoneClassName(zone, zoneData, selected) {
  const classNames = [styles.mapZone]

  if (zone.variant === 'ark') {
    classNames.push(styles.mapZoneArk)
  } else if (zone.variant === 'cool') {
    classNames.push(styles.mapZoneCool)
  }

  if (zoneData.entries.length > 0) {
    classNames.push(styles.mapZoneOccupied)
  }

  if (selected) {
    classNames.push(styles.mapZoneSelected)
  }

  return classNames.join(' ')
}

function RackSlotSubLocationPreview({ slot, selectedSlotKey, selectedSubLocationKey, onSelect }) {
  const previewRows = buildOccupiedSubLocationRows(buildSubLocationSlots(slot))

  if (previewRows.length === 0) {
    return <span className={styles.emptyPalletLine} />
  }

  return (
    <span className={styles.rackSlotSubLocationPreview}>
      {previewRows.map((row, rowIndex) => (
        <span key={`rack-preview-row-${rowIndex}`} className={styles.rackSlotSubLocationRow}>
          {row.map((item) => {
            const isSelected = selectedSlotKey === slot.key && selectedSubLocationKey === item.key

            return (
              <button
                key={item.key}
                type="button"
                className={`${styles.rackSlotKButton} ${isSelected ? styles.rackSlotKButtonSelected : ''}`.trim()}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelect(slot.key, item.key)
                }}
                aria-pressed={isSelected}
              >
                {item.key}
              </button>
            )
          })}
        </span>
      ))}
    </span>
  )
}

function buildOccupiedSubLocationRows(subLocationSlots) {
  const slotByKey = new Map(subLocationSlots.map((slot) => [slot.key, slot]))

  return SUBLOCATION_LAYOUT_ROWS.map((row) =>
    row
      .map((key) => slotByKey.get(key))
      .filter((slot) => slot && slot.qty > 0)
  ).filter((row) => row.length > 0)
}

function buildRackSlots(zoneData) {
  const mappedSuffixes = new Set(
    zoneData.locations
      .map((location) => getLocationSlotSuffix(location))
      .filter(Boolean)
  )
  const locationsBySuffix = new Map()
  const entriesBySuffix = new Map()

  zoneData.locations.forEach((location) => {
    const key = getLocationSlotSuffix(location)

    if (!key) {
      return
    }

    const existing = locationsBySuffix.get(key) || []
    existing.push(location)
    locationsBySuffix.set(key, existing)
  })

  zoneData.entries.forEach((entry) => {
    const key = getLocationSlotSuffix(entry.location)

    if (!key) {
      return
    }

    const existing = entriesBySuffix.get(key) || []
    existing.push(entry)
    entriesBySuffix.set(key, existing)
  })

  return RACK_SLOTS.map((slot) => {
    const entries = entriesBySuffix.get(slot.suffix) || []
    const locations = locationsBySuffix.get(slot.suffix) || []

    return {
      ...slot,
      isMapped: mappedSuffixes.has(slot.suffix) || entries.length > 0,
      locations,
      entries,
      qty: entries.reduce((sum, entry) => sum + Number(entry.qty || 0), 0),
    }
  })
}

function buildSubLocationSlots(slot) {
  const locations = slot?.locations || []
  const entries = slot?.entries || []
  const mappedKeys = new Set(
    locations
      .map((location) => getLocationSubLocationKey(location))
      .filter(Boolean)
  )
  const entriesByKey = new Map()

  entries.forEach((entry) => {
    const key = getEntrySubLocationKey(entry)
    const existing = entriesByKey.get(key) || []
    existing.push(entry)
    entriesByKey.set(key, existing)
  })

  return SUBLOCATION_LAYOUT_KEYS.map((key) => {
    const keyEntries = entriesByKey.get(key) || []

    return {
      key,
      entries: keyEntries,
      isMapped: mappedKeys.has(key) || keyEntries.length > 0,
      qty: keyEntries.reduce((sum, entry) => sum + Number(entry.qty || 0), 0),
    }
  })
}

function groupEntriesBySubLocation(entries) {
  const groupsByKey = new Map()

  entries.forEach((entry) => {
    const key = getEntrySubLocationKey(entry)
    const existing = groupsByKey.get(key) || []
    existing.push(entry)
    groupsByKey.set(key, existing)
  })

  const orderedGroups = SUBLOCATION_KEYS.map((key) => {
    const groupEntries = groupsByKey.get(key) || []

    return {
      key,
      label: key,
      entries: groupEntries,
      qty: groupEntries.reduce((sum, entry) => sum + Number(entry.qty || 0), 0),
    }
  }).filter((group) => group.entries.length > 0)

  const unassignedEntries = groupsByKey.get(UNASSIGNED_SUBLOCATION_KEY) || []

  if (unassignedEntries.length > 0) {
    orderedGroups.push({
      key: UNASSIGNED_SUBLOCATION_KEY,
      label: getSubLocationLabel(UNASSIGNED_SUBLOCATION_KEY),
      entries: unassignedEntries,
      qty: unassignedEntries.reduce((sum, entry) => sum + Number(entry.qty || 0), 0),
    })
  }

  return orderedGroups
}

function getHistorySubLocationKey(row, storageEntryById) {
  const currentStorageEntry = row.storage_id ? storageEntryById.get(String(row.storage_id)) : null

  if (currentStorageEntry) {
    return getEntrySubLocationKey(currentStorageEntry)
  }

  return getSubLocationKeyFromValue(row.take_from) || UNASSIGNED_SUBLOCATION_KEY
}

function matchesHistoryRow(row, options) {
  const {
    selectedWarehouseKey,
    selectedSlotCode,
    selectedSubLocationKey,
    selectedSlotStorageIds,
    storageEntryById,
  } = options
  const takeFrom = String(row.take_from || '').toUpperCase().replace(/\s+/g, '')
  const normalizedWarehouse = normalizeWarehouseValue(selectedWarehouseKey)
  const normalizedSlotCode = normalizeLocationCode(selectedSlotCode)
  const storageId = row.storage_id ? String(row.storage_id) : ''
  const matchesCurrentStorage = storageId ? selectedSlotStorageIds.has(storageId) : false
  const matchesSlotLabel = takeFrom.includes(normalizedSlotCode)
  const matchesWarehouseLabel = takeFrom.includes(normalizedWarehouse)

  if (!matchesCurrentStorage && !(matchesSlotLabel && matchesWarehouseLabel)) {
    return false
  }

  if (selectedSubLocationKey === SUBLOCATION_ALL_KEY) {
    return true
  }

  return getHistorySubLocationKey(row, storageEntryById) === selectedSubLocationKey
}

function getDisplayNameByEmail(email, userProfilesByEmail) {
  const normalizedEmail = String(email || '').trim().toLowerCase()

  if (!normalizedEmail) {
    return '-'
  }

  return userProfilesByEmail[normalizedEmail] || email
}

export default function WarehouseMapClient() {
  const canvasRef = useRef(null)
  const interactionRef = useRef(null)
  const [selectedWarehouseKey, setSelectedWarehouseKey] = useState(WAREHOUSE_ORDER[0])
  const [selectedZoneCode, setSelectedZoneCode] = useState('')
  const [isRackOpen, setIsRackOpen] = useState(false)
  const [selectedSlotKey, setSelectedSlotKey] = useState('')
  const [selectedSubLocationKey, setSelectedSubLocationKey] = useState(SUBLOCATION_ALL_KEY)
  const [activePanel, setActivePanel] = useState('current')
  const [editMode, setEditMode] = useState(false)
  const [mapLayouts, setMapLayouts] = useState({})
  const [selectedElementId, setSelectedElementId] = useState('')
  const [layoutStatus, setLayoutStatus] = useState('')
  const [rackLocations, setRackLocations] = useState([])
  const [storageEntries, setStorageEntries] = useState([])
  const [restockHistoryRows, setRestockHistoryRows] = useState([])
  const [userProfilesByEmail, setUserProfilesByEmail] = useState({})
  const [registrySaving, setRegistrySaving] = useState(false)
  const [registryError, setRegistryError] = useState('')
  const [registrySuccess, setRegistrySuccess] = useState('')
  const [registryForm, setRegistryForm] = useState({
    subLocationKey: '',
    itemName: '',
    size: '',
    qty: '1',
    notes: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadMapData() {
      setLoading(true)
      setError('')

      try {
        const [locationRows, storageRows, restockRows, profileRows] = await Promise.all([
          fetchAllRackLocations(),
          fetchAllWarehouseStorage(),
          fetchAllRestockHistory(),
          fetchUserProfiles(),
        ])
        const profileMap = {}

        ;(profileRows || []).forEach((profile) => {
          const email = String(profile.email || '').trim().toLowerCase()

          if (!email) {
            return
          }

          profileMap[email] = String(profile.display_name || '').trim() || profile.email
        })

        setRackLocations(normalizeRackLocations(locationRows))
        setStorageEntries(storageRows || [])
        setRestockHistoryRows(restockRows || [])
        setUserProfilesByEmail(profileMap)
      } catch (loadError) {
        setError(loadError.message || 'Failed to load warehouse map data.')
      } finally {
        setLoading(false)
      }
    }

    loadMapData()
  }, [])

  useEffect(() => {
    try {
      const savedLayout = window.localStorage.getItem(MAP_BUILDER_STORAGE_KEY)

      if (!savedLayout) {
        return
      }

      const parsedLayout = JSON.parse(savedLayout)
      const nextLayouts = {}

      Object.entries(parsedLayout || {}).forEach(([warehouseKey, layout]) => {
        if (!WAREHOUSES[warehouseKey] || !Array.isArray(layout?.elements)) {
          return
        }

        nextLayouts[warehouseKey] = {
          elements: layout.elements.map(normalizeSavedElement),
        }
      })

      setMapLayouts(nextLayouts)
    } catch {
      setLayoutStatus('Saved map layout could not be loaded.')
    }
  }, [])

  const locationById = useMemo(
    () => new Map(rackLocations.map((location) => [location.id, location])),
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
  const storageEntryById = useMemo(
    () => new Map(storageRows.map((entry) => [String(entry.id), entry])),
    [storageRows]
  )

  const warehouse = WAREHOUSES[selectedWarehouseKey]
  const defaultMapLayouts = useMemo(() => createDefaultLayouts(), [])
  const activeMapElements = useMemo(
    () => (mapLayouts[warehouse.key]?.elements || defaultMapLayouts[warehouse.key]?.elements || []).map(normalizeSavedElement),
    [defaultMapLayouts, mapLayouts, warehouse.key]
  )
  const wallElements = activeMapElements.filter((element) => element.type === 'wall')
  const boxElements = activeMapElements.filter((element) => element.type === 'box')
  const navArrowElements = activeMapElements.filter((element) => element.type === 'nav-arrow')
  const lineElements = activeMapElements.filter((element) => element.type === 'line')
  const flowArrowElements = activeMapElements.filter((element) => element.type === 'arrow')
  const textElements = activeMapElements.filter((element) => element.type === 'text')
  const palletElements = activeMapElements.filter((element) => element.type === 'pallet')
  const assignedPalletElements = palletElements.filter((element) => element.code)
  const selectedElement = activeMapElements.find((element) => element.id === selectedElementId) || null
  const selectedWarehouseIndex = WAREHOUSE_ORDER.indexOf(selectedWarehouseKey)
  const canGoPreviousWarehouse = selectedWarehouseIndex > 0
  const canGoNextWarehouse = selectedWarehouseIndex < WAREHOUSE_ORDER.length - 1

  const zoneDataByCode = useMemo(() => {
    const dataMap = new Map()

    assignedPalletElements.forEach((zone) => {
      const locations = rackLocations.filter(
        (location) => matchesWarehouse(location, warehouse.key) && matchesZone(location, zone.code)
      )
      const locationIds = new Set(locations.map((location) => location.id))
      const entries = storageRows.filter((entry) => locationIds.has(entry.rack_location_id))
      const totalQty = entries.reduce((sum, entry) => sum + Number(entry.qty || 0), 0)

      dataMap.set(zone.code, {
        locations,
        entries,
        totalQty,
        itemCount: entries.length,
      })
    })

    return dataMap
  }, [assignedPalletElements, rackLocations, storageRows, warehouse.key])

  const selectedZone = useMemo(
    () => assignedPalletElements.find((zone) => zone.code === selectedZoneCode) || null,
    [assignedPalletElements, selectedZoneCode]
  )
  const selectedZoneData = useMemo(() => {
    if (!selectedZone) {
      return null
    }

    return zoneDataByCode.get(selectedZone.code) || { locations: [], entries: [], totalQty: 0, itemCount: 0 }
  }, [selectedZone, zoneDataByCode])
  const rackSlots = useMemo(
    () => buildRackSlots(selectedZoneData || { locations: [], entries: [] }),
    [selectedZoneData]
  )
  const selectedSlot = rackSlots.find((slot) => slot.key === selectedSlotKey) || rackSlots[0]
  const selectedSlotCode = selectedZone && selectedSlot ? getRackSlotCode(selectedZone.code, selectedSlot) : ''
  const subLocationSlots = useMemo(
    () => buildSubLocationSlots(selectedSlot),
    [selectedSlot]
  )
  const registrySubLocationOptions = useMemo(() => {
    const locationsByKey = new Map()

    ;(selectedSlot?.locations || []).forEach((location) => {
      const key = getLocationSubLocationKey(location)

      if (!key || locationsByKey.has(key)) {
        return
      }

      locationsByKey.set(key, location)
    })

    return SUBLOCATION_KEYS
      .map((key) => {
        const location = locationsByKey.get(key)

        return location ? { key, location } : null
      })
      .filter(Boolean)
  }, [selectedSlot])
  const selectedRegistryLocation = registrySubLocationOptions.find(
    (option) => option.key === registryForm.subLocationKey
  )?.location || null
  const selectedSubLocation = subLocationSlots.find((slot) => slot.key === selectedSubLocationKey) || null
  const currentGoodsGroups = useMemo(() => {
    if (!selectedSlot) {
      return []
    }

    if (selectedSubLocationKey === SUBLOCATION_ALL_KEY) {
      return groupEntriesBySubLocation(selectedSlot.entries)
    }

    const entries = selectedSubLocation?.entries || []

    return entries.length > 0
      ? [{
          key: selectedSubLocationKey,
          label: getSubLocationLabel(selectedSubLocationKey),
          entries,
          qty: entries.reduce((sum, entry) => sum + Number(entry.qty || 0), 0),
        }]
      : []
  }, [selectedSlot, selectedSubLocation, selectedSubLocationKey])
  const selectedSlotStorageIds = useMemo(
    () => new Set((selectedSlot?.entries || []).map((entry) => String(entry.id))),
    [selectedSlot]
  )
  const historyRows = useMemo(() => {
    if (!selectedZone || !selectedSlotCode) {
      return []
    }

    return restockHistoryRows.filter((row) =>
      matchesHistoryRow(row, {
        selectedWarehouseKey: warehouse.key,
        selectedSlotCode,
        selectedSubLocationKey,
        selectedSlotStorageIds,
        storageEntryById,
      })
    )
  }, [
    restockHistoryRows,
    selectedSlotCode,
    selectedSlotStorageIds,
    selectedSubLocationKey,
    selectedZone,
    storageEntryById,
    warehouse.key,
  ])
  const warehouseRackCodes = useMemo(() => {
    const codes = new Set()

    rackLocations.forEach((location) => {
      if (!matchesWarehouse(location, warehouse.key)) {
        return
      }

      const code = getLocationBaseCode(location.location_code || location.location_name)

      if (code) {
        codes.add(code)
      }
    })

    if (codes.size === 0) {
      palletElements.forEach((element) => {
        if (element.code) {
          codes.add(normalizeLocationCode(element.code))
        }
      })
    }

    return Array.from(codes).sort((left, right) =>
      new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare(left, right)
    )
  }, [palletElements, rackLocations, warehouse.key])
  const assignedPalletCodes = useMemo(
    () =>
      new Set(
        palletElements
          .filter((element) => element.id !== selectedElementId)
          .map((element) => normalizeLocationCode(element.code))
          .filter(Boolean)
      ),
    [palletElements, selectedElementId]
  )
  const availablePalletCodes = useMemo(
    () => warehouseRackCodes.filter((code) => !assignedPalletCodes.has(normalizeLocationCode(code))),
    [assignedPalletCodes, warehouseRackCodes]
  )

  function getCanvasPoint(event) {
    const rect = canvasRef.current?.getBoundingClientRect()

    if (!rect) {
      return { x: 0, y: 0 }
    }

    return {
      x: clampNumber(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clampNumber(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    }
  }

  function updateWarehouseElements(updater) {
    setLayoutStatus('')
    setMapLayouts((prev) => {
      const currentElements = prev[warehouse.key]?.elements || defaultMapLayouts[warehouse.key]?.elements || []
      const nextElements = typeof updater === 'function' ? updater(currentElements.map(normalizeSavedElement)) : updater

      return {
        ...prev,
        [warehouse.key]: {
          elements: nextElements.map(normalizeSavedElement),
        },
      }
    })
  }

  function updateSelectedElement(patch) {
    if (!selectedElement) {
      return
    }

    updateWarehouseElements((elements) =>
      elements.map((element) =>
        element.id === selectedElement.id
          ? {
              ...element,
              ...patch,
            }
          : element
      )
    )
  }

  function deleteSelectedElement() {
    if (!selectedElementId) {
      return
    }

    updateWarehouseElements((elements) => elements.filter((element) => element.id !== selectedElementId))
    setSelectedElementId('')
  }

  function handleSaveLayout() {
    const nextLayouts = {
      ...defaultMapLayouts,
      ...mapLayouts,
    }

    window.localStorage.setItem(MAP_BUILDER_STORAGE_KEY, JSON.stringify(nextLayouts))
    setLayoutStatus('Layout saved.')
  }

  function handleResetLayout() {
    updateWarehouseElements(defaultMapLayouts[warehouse.key]?.elements || [])
    setSelectedElementId('')
    setLayoutStatus('Layout reset for this warehouse. Save to keep the reset.')
  }

  function handleToolDragStart(event, type) {
    event.dataTransfer.setData('application/warehouse-map-tool', type)
    event.dataTransfer.effectAllowed = 'copy'
  }

  function handleCanvasDrop(event) {
    if (!editMode) {
      return
    }

    event.preventDefault()

    const type = event.dataTransfer.getData('application/warehouse-map-tool')

    if (!type || !TOOL_DEFAULTS[type]) {
      return
    }

    const point = getCanvasPoint(event)
    const assignedCode = type === 'pallet' ? availablePalletCodes[0] || '' : ''
    const nextElement = createDroppedElement(type, point.x, point.y, assignedCode)

    updateWarehouseElements((elements) => [...elements, nextElement])
    setSelectedElementId(nextElement.id)
  }

  function startElementMove(event, element) {
    if (!editMode) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setSelectedElementId(element.id)
    interactionRef.current = {
      mode: 'move',
      id: element.id,
      startX: event.clientX,
      startY: event.clientY,
      original: { ...element },
    }
  }

  function startElementResize(event, element, handle = 'se') {
    if (!editMode) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setSelectedElementId(element.id)
    interactionRef.current = {
      mode: 'resize',
      id: element.id,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      original: { ...element },
    }
  }

  function renderResizeHandles(element) {
    if (!editMode || selectedElementId !== element.id) {
      return null
    }

    return ['nw', 'ne', 'sw', 'se'].map((handle) => (
      <span
        key={handle}
        className={`${styles.resizeHandle} ${styles[`resizeHandle${handle.toUpperCase()}`] || ''}`.trim()}
        onPointerDown={(event) => startElementResize(event, element, handle)}
      />
    ))
  }

  useEffect(() => {
    function handlePointerMove(event) {
      const interaction = interactionRef.current
      const rect = canvasRef.current?.getBoundingClientRect()

      if (!interaction || !rect) {
        return
      }

      const deltaX = ((event.clientX - interaction.startX) / rect.width) * 100
      const deltaY = ((event.clientY - interaction.startY) / rect.height) * 100

      updateWarehouseElements((elements) =>
        elements.map((element) => {
          if (element.id !== interaction.id) {
            return element
          }

          if (interaction.mode === 'move') {
            return {
              ...element,
              x: clampNumber(snapValue(interaction.original.x + deltaX), 0, 100 - element.w),
              y: clampNumber(snapValue(interaction.original.y + deltaY), 0, 100 - element.h),
            }
          }

          const nextElement = { ...element }
          const handle = interaction.handle || 'se'

          if (handle.includes('e')) {
            nextElement.w = clampNumber(
              snapValue(interaction.original.w + deltaX),
              MIN_ELEMENT_SIZE,
              100 - interaction.original.x
            )
          }

          if (handle.includes('s')) {
            nextElement.h = clampNumber(
              snapValue(interaction.original.h + deltaY),
              MIN_ELEMENT_SIZE,
              100 - interaction.original.y
            )
          }

          if (handle.includes('w')) {
            const nextX = clampNumber(
              snapValue(interaction.original.x + deltaX),
              0,
              interaction.original.x + interaction.original.w - MIN_ELEMENT_SIZE
            )

            nextElement.x = nextX
            nextElement.w = clampNumber(
              snapValue(interaction.original.w + (interaction.original.x - nextX)),
              MIN_ELEMENT_SIZE,
              100 - nextX
            )
          }

          if (handle.includes('n')) {
            const nextY = clampNumber(
              snapValue(interaction.original.y + deltaY),
              0,
              interaction.original.y + interaction.original.h - MIN_ELEMENT_SIZE
            )

            nextElement.y = nextY
            nextElement.h = clampNumber(
              snapValue(interaction.original.h + (interaction.original.y - nextY)),
              MIN_ELEMENT_SIZE,
              100 - nextY
            )
          }

          return nextElement
        })
      )
    }

    function handlePointerUp() {
      interactionRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  })

  useEffect(() => {
    function handleKeyDown(event) {
      if (!editMode || event.key !== 'Delete') {
        return
      }

      const activeElement = document.activeElement
      const activeTag = activeElement?.tagName?.toLowerCase()

      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return
      }

      deleteSelectedElement()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  })

  useEffect(() => {
    if (selectedZoneCode && !assignedPalletElements.some((element) => element.code === selectedZoneCode)) {
      setSelectedZoneCode('')
      setIsRackOpen(false)
      setSelectedSlotKey('')
      setSelectedSubLocationKey(SUBLOCATION_ALL_KEY)
    }
  }, [assignedPalletElements, selectedZoneCode])

  useEffect(() => {
    if (!isRackOpen || !selectedZone) {
      return
    }

    if (selectedSlotKey && rackSlots.some((slot) => slot.key === selectedSlotKey)) {
      return
    }

    const firstOccupiedSlot = rackSlots.find((slot) => slot.entries.length > 0)
    setSelectedSlotKey(firstOccupiedSlot?.key || rackSlots[0]?.key || '')
  }, [isRackOpen, rackSlots, selectedSlotKey, selectedZone])

  useEffect(() => {
    setRegistryError('')
    setRegistrySuccess('')
    setRegistryForm({
      subLocationKey: '',
      itemName: '',
      size: '',
      qty: '1',
      notes: '',
    })
  }, [selectedSlotCode])

  function handleWarehouseSelect(warehouseKey) {
    setSelectedWarehouseKey(warehouseKey)
    setSelectedZoneCode('')
    setIsRackOpen(false)
    setSelectedSlotKey('')
    setSelectedSubLocationKey(SUBLOCATION_ALL_KEY)
    setActivePanel('current')
  }

  function handleWarehouseStep(direction) {
    const nextIndex = selectedWarehouseIndex + direction

    if (nextIndex < 0 || nextIndex >= WAREHOUSE_ORDER.length) {
      return
    }

    handleWarehouseSelect(WAREHOUSE_ORDER[nextIndex])
  }

  function handleZoneSelect(zoneCode) {
    const zoneData = zoneDataByCode.get(zoneCode) || { locations: [], entries: [] }
    const nextRackSlots = buildRackSlots(zoneData)
    const firstOccupiedSlot = nextRackSlots.find((slot) => slot.entries.length > 0)

    setSelectedZoneCode(zoneCode)
    setIsRackOpen(true)
    setSelectedSlotKey(firstOccupiedSlot?.key || nextRackSlots[0]?.key || '')
    setSelectedSubLocationKey(SUBLOCATION_ALL_KEY)
    setActivePanel('current')
  }

  function handleSlotSelect(slotKey, subLocationKey = SUBLOCATION_ALL_KEY) {
    setSelectedSlotKey(slotKey)
    setSelectedSubLocationKey(subLocationKey)
    setActivePanel('current')
  }

  function handleRegistryInputChange(event) {
    const { name, value } = event.target

    if (name === 'qty') {
      const numericValue = value.replace(/\D/g, '')
      setRegistryForm((prev) => ({
        ...prev,
        qty: numericValue || '',
      }))
      return
    }

    setRegistryForm((prev) => ({
      ...prev,
      [name]:
        name === 'itemName'
          ? value.toUpperCase()
          : name === 'size'
            ? normalizeSizeValue(value)
            : value,
    }))
  }

  async function handleRegistrySubmit(event) {
    event.preventDefault()
    setRegistrySaving(true)
    setRegistryError('')
    setRegistrySuccess('')

    if (!selectedRegistryLocation) {
      setRegistryError('Please choose a K position first.')
      setRegistrySaving(false)
      return
    }

    if (!registryForm.itemName.trim()) {
      setRegistryError('Item name is required.')
      setRegistrySaving(false)
      return
    }

    const payload = {
      rack_location_id: selectedRegistryLocation.id,
      item_name: registryForm.itemName.trim(),
      size: normalizeSizeValue(registryForm.size) || null,
      qty: Number(registryForm.qty || 0),
      notes: registryForm.notes.trim() || null,
      updated_by: await getCurrentUserEmail(),
    }

    const { error: insertError } = await supabase.from('warehouse_storage').insert([payload])

    if (insertError) {
      setRegistryError(insertError.message)
      setRegistrySaving(false)
      return
    }

    const refreshedStorage = await fetchAllWarehouseStorage()

    setStorageEntries(refreshedStorage || [])
    setRegistrySuccess('Item stored successfully.')
    setRegistryForm((prev) => ({
      ...prev,
      itemName: '',
      size: '',
      qty: '1',
      notes: '',
    }))
    setRegistrySaving(false)
  }

  return (
    <div className={styles.page}>
      {error ? <p className={styles.errorBanner}>{error}</p> : null}

      <section className={styles.workspace}>
        <div className={styles.mapPanel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.warehouseNavigator} aria-label="Choose warehouse">
                <button
                  type="button"
                  className={styles.warehouseArrow}
                  onClick={() => handleWarehouseStep(-1)}
                  disabled={!canGoPreviousWarehouse}
                  aria-label="Previous warehouse"
                >
                  &lt;
                </button>
                <h2 className={styles.sectionTitle}>{warehouse.title}</h2>
                <button
                  type="button"
                  className={styles.warehouseArrow}
                  onClick={() => handleWarehouseStep(1)}
                  disabled={!canGoNextWarehouse}
                  aria-label="Next warehouse"
                >
                  &gt;
                </button>
                </div>
                <p className={styles.sectionSubtitle}>Click the numbered pallet or rack area to inspect it.</p>
              </div>
              <div className={styles.mapPanelActions}>
                <Link href="/dashboard/storage/overview" className={styles.secondaryButton}>
                  Back to Storage Location
                </Link>
                <div className={styles.builderActions}>
                  <button
                    type="button"
                    className={editMode ? styles.primaryBuilderButton : styles.secondaryButton}
                    onClick={() => {
                      setEditMode((current) => !current)
                      setSelectedElementId('')
                    }}
                  >
                    {editMode ? 'View Map' : 'Edit Map'}
                  </button>
                  {editMode ? (
                    <>
                      <button type="button" className={styles.primaryBuilderButton} onClick={handleSaveLayout}>
                        Save Layout
                      </button>
                      <button type="button" className={styles.secondaryButton} onClick={handleResetLayout}>
                        Reset
                      </button>
                    </>
                  ) : null}
                </div>
                <div className={styles.legend} aria-label="Map legend">
                  <span><i className={styles.legendEmpty} /> Empty</span>
                  <span><i className={styles.legendOccupied} /> Occupied</span>
                  <span><i className={styles.legendSelected} /> Selected</span>
                </div>
              </div>
          </div>

          <div className={styles.mapScroll}>
            <div
              ref={canvasRef}
              className={`${styles.mapCanvas} ${warehouse.image ? styles.mapCanvasImage : ''} ${editMode ? styles.mapCanvasEditing : ''}`.trim()}
              style={{
                ...(warehouse.image ? { '--map-image': `url(${warehouse.image})` } : {}),
                aspectRatio: warehouse.mapRatio,
              }}
              onDragOver={(event) => {
                if (editMode) {
                  event.preventDefault()
                }
              }}
              onDrop={handleCanvasDrop}
              onPointerDown={() => {
                if (editMode) {
                  setSelectedElementId('')
                }
              }}
            >
              {!warehouse.image
                ? wallElements.map((wall) => (
                    <span
                      key={wall.id}
                      className={`${styles.mapWall} ${editMode ? styles.mapEditableElement : ''} ${selectedElementId === wall.id ? styles.mapEditableElementSelected : ''}`.trim()}
                      style={getElementPositionStyle(wall)}
                      onPointerDown={(event) => startElementMove(event, wall)}
                    >
                      {renderResizeHandles(wall)}
                    </span>
                  ))
                : null}
              {!warehouse.image
                ? boxElements.map((area) => (
                    <span
                      key={area.id}
                      className={`${styles.mapArea} ${styles[`area${area.tone?.[0]?.toUpperCase()}${area.tone?.slice(1)}`] || ''} ${editMode ? styles.mapEditableElement : ''} ${selectedElementId === area.id ? styles.mapEditableElementSelected : ''}`.trim()}
                      style={getElementPositionStyle(area)}
                      onPointerDown={(event) => startElementMove(event, area)}
                    >
                      {area.label}
                      {renderResizeHandles(area)}
                    </span>
                  ))
                : null}
              {!warehouse.image
                ? navArrowElements.map((arrow) => (
                    <button
                      key={arrow.id}
                      type="button"
                      className={`${styles.mapDirection} ${styles[`mapDirection${arrow.direction[0].toUpperCase()}${arrow.direction.slice(1)}`] || ''} ${editMode ? styles.mapEditableElement : ''} ${selectedElementId === arrow.id ? styles.mapEditableElementSelected : ''}`.trim()}
                      style={getElementPositionStyle(arrow)}
                      onPointerDown={(event) => editMode && startElementMove(event, arrow)}
                      onClick={(event) => {
                        if (editMode) {
                          event.preventDefault()
                          setSelectedElementId(arrow.id)
                          return
                        }

                        handleWarehouseSelect(arrow.targetWarehouseKey)
                      }}
                      aria-label={arrow.label}
                    >
                      {arrow.direction === 'left' ? <span aria-hidden="true">&lt;</span> : null}
                      {arrow.label}
                      {arrow.direction === 'right' ? <span aria-hidden="true">&gt;</span> : null}
                      {renderResizeHandles(arrow)}
                    </button>
                  ))
                : null}
              {lineElements.map((line) => (
                <span
                  key={line.id}
                  className={`${styles.mapEditorLine} ${editMode ? styles.mapEditableElement : ''} ${selectedElementId === line.id ? styles.mapEditableElementSelected : ''}`.trim()}
                  style={getElementPositionStyle(line)}
                  onPointerDown={(event) => startElementMove(event, line)}
                >
                  {renderResizeHandles(line)}
                </span>
              ))}
              {flowArrowElements.map((arrow) => (
                <span
                  key={arrow.id}
                  className={`${styles.mapEditorFlowArrow} ${styles[`mapEditorFlowArrow${arrow.direction?.[0]?.toUpperCase()}${arrow.direction?.slice(1)}`] || ''} ${editMode ? styles.mapEditableElement : ''} ${selectedElementId === arrow.id ? styles.mapEditableElementSelected : ''}`.trim()}
                  style={getElementPositionStyle(arrow)}
                  onPointerDown={(event) => startElementMove(event, arrow)}
                >
                  <span>{arrow.label}</span>
                  {renderResizeHandles(arrow)}
                </span>
              ))}
              {textElements.map((text) => (
                <span
                  key={text.id}
                  className={`${styles.mapEditorText} ${editMode ? styles.mapEditableElement : ''} ${selectedElementId === text.id ? styles.mapEditableElementSelected : ''}`.trim()}
                  style={getElementPositionStyle(text)}
                  onPointerDown={(event) => startElementMove(event, text)}
                >
                  {text.label}
                  {renderResizeHandles(text)}
                </span>
              ))}
              {(editMode ? palletElements : assignedPalletElements).map((zone) => {
                const zoneData = zoneDataByCode.get(zone.code) || {
                  locations: [],
                  entries: [],
                  totalQty: 0,
                  itemCount: 0,
                }
                const isSelected = selectedZoneCode === zone.code
                const isElementSelected = editMode && selectedElementId === zone.id
                const zoneLabel = zone.label || zone.code || 'Unassigned'

                return (
                  <button
                    key={zone.id}
                    type="button"
                    className={`${getZoneClassName(zone, zoneData, isSelected)} ${editMode ? styles.mapEditableElement : ''} ${isElementSelected ? styles.mapEditableElementSelected : ''}`.trim()}
                    style={getElementPositionStyle(zone)}
                    onPointerDown={(event) => editMode && startElementMove(event, zone)}
                    onClick={(event) => {
                      if (editMode) {
                        event.preventDefault()
                        setSelectedElementId(zone.id)
                        return
                      }

                      handleZoneSelect(zone.code)
                    }}
                    aria-pressed={editMode ? isElementSelected : isSelected}
                    aria-label={`${warehouse.title} pallet ${zoneLabel}, ${zoneData.entries.length > 0 ? 'occupied' : 'empty'}`}
                  >
                    <span className={styles.zoneNumber}>{zoneLabel}</span>
                    {zoneData.entries.length > 0 ? (
                      <span className={styles.zoneQty}>{formatNumber(zoneData.totalQty)}</span>
                    ) : null}
                    {renderResizeHandles(zone)}
                  </button>
                )
              })}
            </div>
          </div>

          {loading ? <p className={styles.loadingText}>Loading live storage occupancy...</p> : null}
          {layoutStatus ? <p className={styles.layoutStatus}>{layoutStatus}</p> : null}
        </div>

        <aside className={styles.detailPanel}>
          {editMode ? (
            <div className={styles.editorPanel}>
              <div>
                <p className={styles.eyebrow}>Map Builder</p>
                <h3>Drag symbols onto {warehouse.key}</h3>
              </div>

              <div className={styles.toolGrid} aria-label="Map builder tools">
                {EDITOR_TOOLS.map((tool) => (
                  <button
                    key={tool.type}
                    type="button"
                    draggable
                    className={styles.toolButton}
                    onDragStart={(event) => handleToolDragStart(event, tool.type)}
                  >
                    <span className={`${styles.toolIcon} ${styles[`toolIcon${tool.type[0].toUpperCase()}${tool.type.slice(1)}`] || ''}`} />
                    {tool.label}
                  </button>
                ))}
              </div>

              <div className={styles.editorHint}>
                Drag to place. Select an element to move, resize, assign, or delete it.
              </div>

              <div className={styles.inspectorPanel}>
                <div className={styles.inspectorHeader}>
                  <h3>Selected Element</h3>
                  {selectedElement ? (
                    <button type="button" className={styles.deleteButton} onClick={deleteSelectedElement}>
                      Delete
                    </button>
                  ) : null}
                </div>

                {!selectedElement ? (
                  <p className={styles.inspectorEmpty}>No element selected.</p>
                ) : (
                  <div className={styles.inspectorFields}>
                    <label>
                      <span>Type</span>
                      <input value={selectedElement.type} readOnly />
                    </label>

                    {selectedElement.type === 'pallet' ? (
                      <label>
                        <span>Rack / Pallet Number</span>
                        <select
                          value={selectedElement.code || ''}
                          onChange={(event) => updateSelectedElement({ code: event.target.value })}
                        >
                          <option value="">Unassigned</option>
                          {selectedElement.code ? (
                            <option value={selectedElement.code}>{selectedElement.code}</option>
                          ) : null}
                          {availablePalletCodes
                            .filter((code) => code !== selectedElement.code)
                            .map((code) => (
                              <option key={code} value={code}>
                                {code}
                              </option>
                            ))}
                        </select>
                      </label>
                    ) : null}

                    {['box', 'text', 'arrow', 'nav-arrow'].includes(selectedElement.type) ? (
                      <label>
                        <span>Label</span>
                        <input
                          value={selectedElement.label || ''}
                          onChange={(event) => updateSelectedElement({ label: event.target.value })}
                        />
                      </label>
                    ) : null}

                    {selectedElement.type === 'arrow' ? (
                      <label>
                        <span>Direction</span>
                        <select
                          value={selectedElement.direction || 'right'}
                          onChange={(event) => updateSelectedElement({ direction: event.target.value })}
                        >
                          <option value="right">Right</option>
                          <option value="left">Left</option>
                        </select>
                      </label>
                    ) : null}

                    <div className={styles.inspectorGrid}>
                      <label>
                        <span>X</span>
                        <input
                          type="number"
                          value={selectedElement.x}
                          onChange={(event) => updateSelectedElement({ x: clampNumber(Number(event.target.value || 0), 0, 100) })}
                        />
                      </label>
                      <label>
                        <span>Y</span>
                        <input
                          type="number"
                          value={selectedElement.y}
                          onChange={(event) => updateSelectedElement({ y: clampNumber(Number(event.target.value || 0), 0, 100) })}
                        />
                      </label>
                      <label>
                        <span>W</span>
                        <input
                          type="number"
                          value={selectedElement.w}
                          onChange={(event) => updateSelectedElement({ w: clampNumber(Number(event.target.value || MIN_ELEMENT_SIZE), MIN_ELEMENT_SIZE, 100) })}
                        />
                      </label>
                      <label>
                        <span>H</span>
                        <input
                          type="number"
                          value={selectedElement.h}
                          onChange={(event) => updateSelectedElement({ h: clampNumber(Number(event.target.value || MIN_ELEMENT_SIZE), MIN_ELEMENT_SIZE, 100) })}
                        />
                      </label>
                    </div>

                    <label>
                      <span>Rotation</span>
                      <input
                        type="number"
                        value={selectedElement.rotation || 0}
                        onChange={(event) => updateSelectedElement({ rotation: Number(event.target.value || 0) })}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          ) : !selectedZone || !selectedZoneData ? (
            <div className={styles.emptyInspector}>
              <span className={styles.emptyKicker}>No pallet selected</span>
              <h2>Select a numbered area</h2>
              <p>
                Pick a pallet from the map to see its rack layout, goods state, and recent storage
                activity.
              </p>
            </div>
          ) : (
            <>
                  <div className={styles.rackSection}>
                  <div className={styles.rackHeader}>
                    <div>
                      <p className={styles.eyebrow}>Rack View</p>
                      <h3>{warehouse.key} / {selectedZone.code}</h3>
                      <p>
                        {selectedZoneData.locations.length} registered slot(s), {formatNumber(selectedZoneData.totalQty)} item qty.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`${styles.subLocationAllButton} ${selectedSubLocationKey === SUBLOCATION_ALL_KEY ? styles.subLocationAllButtonActive : ''}`.trim()}
                      onClick={() => handleSlotSelect(selectedSlot.key)}
                      aria-pressed={selectedSubLocationKey === SUBLOCATION_ALL_KEY}
                    >
                      All K
                    </button>
                  </div>

                  <div className={styles.rackFrame} aria-label={`Rack layout for pallet ${selectedZone.code}`}>
                    <span className={styles.rackPostLeft} />
                    <span className={styles.rackPostRight} />
                    {[0, 1, 2].map((levelIndex) => (
                      <span key={levelIndex} className={styles.rackBeam} style={{ '--beam-index': levelIndex }} />
                    ))}

                    <div className={styles.rackGrid}>
                      {rackSlots.map((slot) => {
                        const isSlotSelected = selectedSlotKey === slot.key
                        const slotIsOccupied = slot.entries.length > 0
                        const slotCode = getRackSlotCode(selectedZone.code, slot)

                        return (
                          <div
                            key={slot.key}
                            role="button"
                            tabIndex={0}
                            className={`${styles.rackSlot} ${slotIsOccupied ? styles.rackSlotOccupied : ''} ${isSlotSelected ? styles.rackSlotSelected : ''}`.trim()}
                            onClick={() => handleSlotSelect(slot.key)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                handleSlotSelect(slot.key)
                              }
                            }}
                            aria-pressed={isSlotSelected}
                          >
                            <span className={styles.rackSlotLabel}>{slotCode}</span>
                            <RackSlotSubLocationPreview
                              slot={slot}
                              selectedSlotKey={selectedSlotKey}
                              selectedSubLocationKey={selectedSubLocationKey}
                              onSelect={handleSlotSelect}
                            />
                            <strong>{slotIsOccupied ? `${formatNumber(slot.qty)} qty` : 'Empty'}</strong>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className={styles.segmentedControl} aria-label="Rack detail mode">
                    <button
                      type="button"
                      className={activePanel === 'current' ? styles.segmentActive : ''}
                      onClick={() => setActivePanel('current')}
                    >
                      Current Goods
                    </button>
                    <button
                      type="button"
                      className={activePanel === 'history' ? styles.segmentActive : ''}
                      onClick={() => setActivePanel('history')}
                    >
                      History
                    </button>
                    <button
                      type="button"
                      className={activePanel === 'registry' ? styles.segmentActive : ''}
                      onClick={() => setActivePanel('registry')}
                    >
                      Registry Storage
                    </button>
                  </div>

                  <div className={styles.storageList}>
                    {activePanel === 'current' && currentGoodsGroups.length === 0 ? (
                      <div className={styles.emptyState}>
                        <p>
                          No current goods recorded for {selectedSubLocationKey === SUBLOCATION_ALL_KEY ? selectedSlotCode : selectedSubLocationKey}.
                        </p>
                      </div>
                    ) : activePanel === 'current' ? (
                      currentGoodsGroups.map((group) => (
                        <section key={group.key} className={styles.storageGroup}>
                          <div className={styles.storageGroupHeader}>
                            <span>{group.label}</span>
                            <strong>{formatNumber(group.qty)} qty</strong>
                          </div>
                          <div className={styles.storageGroupRows}>
                            {group.entries.map((entry) => (
                              <article key={entry.id} className={styles.storageRow}>
                                <div>
                                  <h4>{entry.item_name}</h4>
                                  <p>{entry.size || 'No size'} / {entry.notes || 'No notes'}</p>
                                </div>
                                <strong>{formatNumber(entry.qty)}</strong>
                              </article>
                            ))}
                          </div>
                        </section>
                      ))
                    ) : activePanel === 'history' && historyRows.length === 0 ? (
                      <div className={styles.emptyState}>
                        <p>
                          No picker history recorded for {selectedSubLocationKey === SUBLOCATION_ALL_KEY ? selectedSlotCode : selectedSubLocationKey}.
                        </p>
                      </div>
                    ) : activePanel === 'history' ? (
                      historyRows.map((row) => (
                        <article key={row.id} className={styles.historyRow}>
                          <span>{formatDateTime(row.completed_at || row.created_at)}</span>
                          <div>
                            <h4>{row.item_name}</h4>
                            <p>
                              {formatNumber(row.qty)} qty taken from {getSubLocationLabel(getHistorySubLocationKey(row, storageEntryById))}
                              {row.requester_name ? ` for ${row.requester_name}` : ''}
                            </p>
                            <p>Picked by {getDisplayNameByEmail(row.completed_by, userProfilesByEmail)}</p>
                          </div>
                          <strong>{formatNumber(row.qty)}</strong>
                        </article>
                      ))
                    ) : (
                      <form className={styles.registryForm} onSubmit={handleRegistrySubmit}>
                        <div className={styles.registryHeader}>
                          <div>
                            <h3>Registry Storage</h3>
                            <p>{warehouse.key} / {selectedSlotCode}</p>
                          </div>
                          <span>{registrySubLocationOptions.length} K position(s)</span>
                        </div>

                        <div className={styles.registryGrid}>
                          <label className={styles.registryField}>
                            <span>K Position</span>
                            <select
                              name="subLocationKey"
                              value={registryForm.subLocationKey}
                              onChange={handleRegistryInputChange}
                              required
                            >
                              <option value="">Select K</option>
                              {registrySubLocationOptions.map((option) => (
                                <option key={option.key} value={option.key}>
                                  {option.key}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className={styles.registryField}>
                            <span>Qty</span>
                            <input
                              name="qty"
                              value={registryForm.qty}
                              onChange={handleRegistryInputChange}
                              inputMode="numeric"
                              placeholder="1"
                              required
                            />
                          </label>
                        </div>

                        <label className={styles.registryField}>
                          <span>Item Name</span>
                          <input
                            name="itemName"
                            value={registryForm.itemName}
                            onChange={handleRegistryInputChange}
                            placeholder="ITEM NAME"
                            required
                          />
                        </label>

                        <div className={styles.registryGrid}>
                          <label className={styles.registryField}>
                            <span>Size</span>
                            <input
                              name="size"
                              value={registryForm.size}
                              onChange={handleRegistryInputChange}
                              placeholder="SIZE"
                            />
                          </label>

                          <label className={styles.registryField}>
                            <span>Selected Slot</span>
                            <input value={selectedRegistryLocation ? `${selectedSlotCode} / ${registryForm.subLocationKey}` : selectedSlotCode} readOnly />
                          </label>
                        </div>

                        <label className={styles.registryField}>
                          <span>Notes</span>
                          <textarea
                            name="notes"
                            value={registryForm.notes}
                            onChange={handleRegistryInputChange}
                            placeholder="Optional notes"
                          />
                        </label>

                        {registrySubLocationOptions.length === 0 ? (
                          <p className={styles.registryWarning}>No mapped K position found for this rack slot.</p>
                        ) : null}
                        {registryError ? <p className={styles.registryError}>{registryError}</p> : null}
                        {registrySuccess ? <p className={styles.registrySuccess}>{registrySuccess}</p> : null}

                        <button
                          type="submit"
                          className={styles.registrySubmit}
                          disabled={registrySaving || !selectedRegistryLocation}
                        >
                          {registrySaving ? 'Saving...' : 'Save to Storage'}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
            </>
          )}
        </aside>
      </section>
    </div>
  )
}
