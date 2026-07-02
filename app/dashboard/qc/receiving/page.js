'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import { ADMIN_EMAIL } from '@/utils/permissions'
import { readFileAsDataUrl } from '../shared'

const supabase = createClient()
const ARKLINE_PO_TABLE_CANDIDATES = ['arkline_pos', 'dir_arkline_purchase_orders', 'dir_arkline_po', 'dir_arkline_pos']
const ARKLINE_PO_ITEM_TABLE_CANDIDATES = ['arkline_po_items', 'dir_arkline_purchase_order_items', 'dir_arkline_po_items', 'dir_arkline_pos_items']

function getTodayLocalDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function getDateOnly(value) {
  const rawValue = String(value || '').trim()
  if (!rawValue) {
    return ''
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return rawValue
  }

  const parsedDate = new Date(rawValue)
  if (Number.isNaN(parsedDate.getTime())) {
    return rawValue.slice(0, 10)
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsedDate)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function formatVariantValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).join(', ')
  }

  if (value && typeof value === 'object') {
    return Object.values(value).map((item) => String(item || '').trim()).filter(Boolean).join(', ')
  }

  return String(value || '').trim()
}

function getRegularVariantLabel(row = {}) {
  return (
    formatVariantValue(row.variant_names) ||
    formatVariantValue(row.variant_name) ||
    formatVariantValue(row.variant_label) ||
    formatVariantValue(row.variant_code) ||
    formatVariantValue(row.model_color) ||
    ''
  )
}

function getCatalogVariantLabel(variant = {}) {
  return (
    formatVariantValue(variant.variant_name) ||
    formatVariantValue(variant.variant_label) ||
    formatVariantValue(variant.variant_code) ||
    'VARIANT'
  )
}

function getRegularBrandLabel(row = {}) {
  return String(row.brand_name || row.brands?.brand_name || row.brand || '').trim().toUpperCase()
}

function getRegularCategoryLabel(row = {}) {
  return String(
    row.item_type_sub_category ||
      row.sub_category_name ||
      row.category_name ||
      row.categories?.full_name ||
      row.categories?.category_name ||
      row.category ||
      ''
  )
    .trim()
    .toUpperCase()
}

function getRegularModelVariantLabel(row = {}) {
  const modelName = String(row.model_name || '').trim().toUpperCase()
  const variantName = String(row.model_color || getRegularVariantLabel(row) || '').trim().toUpperCase()
  if (!modelName && !variantName) return 'Choose model'
  if (!variantName) return modelName
  if (!modelName) return variantName
  return `${modelName} - ${variantName}`
}

function getRegularModelName(row = {}) {
  return String(row.model_name || '').trim().toUpperCase() || 'CHOOSE MODEL'
}

function getRegularVariantName(row = {}) {
  return String(row.model_color || getRegularVariantLabel(row) || '').trim().toUpperCase() || 'NO VARIANT'
}

function getCategoryPath(categoryId, categoryMap) {
  const path = []
  let current = categoryMap.get(Number(categoryId))

  while (current) {
    path.unshift(current)
    current = current.parent_id ? categoryMap.get(Number(current.parent_id)) : null
  }

  return path
}

function getItemTypeSubcategoryLabel(categoryId, categoryMap, fallback = '') {
  const path = getCategoryPath(categoryId, categoryMap)
  const itemType = path[path.length - 1] || null
  const subCategory = path.length > 1 ? path[path.length - 2] : null

  if (itemType && subCategory) {
    return `${itemType.category_name || ''} ${subCategory.category_name || ''}`.trim().toUpperCase()
  }

  return String(itemType?.category_name || fallback || '').trim().toUpperCase()
}

function getRegularProductIdentityLabel(row = {}) {
  return [row.brand_name, row.category_name].map((item) => String(item || '').trim()).filter(Boolean).join(' ') || 'NO PRODUCT IDENTITY'
}

function normalizeInboundUnloadRow(row = {}) {
  return {
    ...row,
    brand_name: getRegularBrandLabel(row),
    category_name: getRegularCategoryLabel(row),
    model_color: getRegularVariantLabel(row).trim().toUpperCase(),
  }
}

function normalizeQcItemRow(row = {}) {
  return {
    ...row,
    model_color: String(row.variant_name || row.model_color || '').trim().toUpperCase(),
    original_model_color: String(row.original_variant_name || row.original_model_color || '').trim().toUpperCase(),
  }
}

function getExpectedRowKey(row = {}) {
  const baseKey = getModelKey(row.model_name, row.model_color)
  return row.model_color ? baseKey : `${baseKey}::SOURCE:${row.id || row.source_id || ''}`
}

async function loadInboundUnloadRows(inboundId) {
  const coreSelect = 'id, inbound_id, brand_id, category_id, model_name, qty, pic_name, is_sample, koli_sequence, photo_url'
  const relationSelect = `${coreSelect}, brands:dir_brands!brand_id(id, brand_name), categories:dir_categories!category_id(id, category_name, full_name)`
  const selectCandidates = [
    `${relationSelect}, variant_name`,
    relationSelect,
    `${coreSelect}, variant_name`,
    coreSelect,
    `${relationSelect}, variant_names, variant_name, variant_label, variant_code`,
    `${relationSelect}, variant_name, variant_label, variant_code`,
    `${relationSelect}, variant_names, variant_name`,
    `${relationSelect}, variant_names`,
    `${relationSelect}, variant_label, variant_code`,
    `${coreSelect}, variant_names, variant_name, variant_label, variant_code`,
    `${coreSelect}, variant_name, variant_label, variant_code`,
    `${coreSelect}, variant_names, variant_name`,
    `${coreSelect}, variant_names`,
    `${coreSelect}, variant_label, variant_code`,
  ]
  let lastError = null

  for (const selectClause of selectCandidates) {
    const result = await supabase
      .from('inbound_unload')
      .select(selectClause)
      .eq('inbound_id', inboundId)
      .order('koli_sequence', { ascending: true })

    if (!result.error) {
      return { data: (result.data || []).map(normalizeInboundUnloadRow), error: null }
    }

    lastError = result.error
  }

  return { data: [], error: lastError }
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '800',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#6b7280',
    fontSize: '13px',
    lineHeight: 1.6,
  },
  sectionTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '800',
  },
  sectionSubtitle: {
    margin: '4px 0 0',
    color: '#6b7280',
    fontSize: '13px',
    lineHeight: 1.6,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px',
  },
  compactGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '16px',
  },
  modeRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  modeButton: {
    minHeight: '40px',
    padding: '0 14px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    borderRadius: '12px',
    background: '#fff',
    color: '#111827',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  modeButtonActive: {
    background: '#111827',
    color: '#fff',
    borderColor: '#111827',
  },
  modeButtonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
  },
  helperText: {
    fontSize: '12px',
    color: '#6b7280',
  },
  comboBox: {
    position: 'relative',
  },
  comboList: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    right: 0,
    zIndex: 30,
    maxHeight: '240px',
    overflowY: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    background: '#fff',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  comboOption: {
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    background: '#fff',
    color: '#111827',
    padding: '10px 12px',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  comboOptionMeta: {
    fontSize: '11px',
    color: '#6b7280',
    fontWeight: '600',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  input: {
    height: '40px',
    padding: '0 12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    borderRadius: '10px',
    fontSize: '13px',
    width: '100%',
  },
  inputDisabled: {
    background: '#f3f4f6',
    borderColor: '#e5e7eb',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
  select: {
    height: '40px',
    padding: '0 12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    borderRadius: '10px',
    fontSize: '13px',
    background: '#fff',
    width: '100%',
  },
  selectDisabled: {
    background: '#f3f4f6',
    borderColor: '#e5e7eb',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
  readonlyBox: {
    minHeight: '40px',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    background: '#f9fafb',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  primaryButton: {
    height: '40px',
    padding: '0 16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: '10px',
    background: '#111827',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryButton: {
    height: '40px',
    padding: '0 16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    borderRadius: '10px',
    background: '#fff',
    color: '#111827',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  buttonDisabled: {
    background: '#e5e7eb',
    borderColor: '#e5e7eb',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
  iconButton: {
    width: '30px',
    height: '30px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    borderRadius: '999px',
    background: '#fff',
    color: '#111827',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  iconButtonDisabled: {
    background: '#f3f4f6',
    borderColor: '#e5e7eb',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
  compactAllocationSelect: {
    height: '32px',
    fontSize: '11px',
    padding: '0 8px',
    width: '100%',
    minWidth: 0,
  },
  compactAllocationInput: {
    height: '32px',
    fontSize: '11px',
    padding: '0 8px',
    width: '100%',
    minWidth: 0,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  },
  summaryCard: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  summaryLabel: {
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#111827',
  },
  sourceList: {
    display: 'flex',
    flexWrap: 'nowrap',
    gap: '14px',
    overflowX: 'auto',
    padding: '0 4px 0 0',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#e5e7eb',
    scrollbarWidth: 'thin',
    WebkitOverflowScrolling: 'touch',
  },
  sourceListWrap: {
    position: 'relative',
  },
  sourceListArrow: {
    position: 'absolute',
    top: 0,
    bottom: '1px',
    width: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    color: '#64748b',
    fontSize: '20px',
    fontWeight: '800',
  },
  sourceListArrowLeft: {
    left: 0,
    background: 'linear-gradient(90deg, #ffffff 42%, rgba(255,255,255,0))',
  },
  sourceListArrowRight: {
    right: 0,
    background: 'linear-gradient(90deg, rgba(255,255,255,0), #ffffff 58%)',
  },
  sourceChip: {
    position: 'relative',
    flex: '0 0 auto',
    minHeight: '34px',
    padding: '0 0 7px',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderLeftWidth: 0,
    borderBottomWidth: '3px',
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    background: 'transparent',
    color: '#8a817a',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  sourceChipActive: {
    borderBottomColor: '#f59e0b',
    color: '#9a3412',
    fontWeight: '800',
  },
  sourceChipDone: {
    background: 'transparent',
    borderBottomColor: 'transparent',
    color: '#64748b',
  },
  sourceChipDoneActive: {
    background: 'transparent',
    borderBottomColor: '#f59e0b',
    color: '#9a3412',
    fontWeight: '800',
  },
  sourceChipDisabled: {
    background: 'transparent',
    borderBottomColor: 'transparent',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
  sourceStatusBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '14px',
    border: '1px solid #86efac',
    background: '#f0fdf4',
    color: '#166534',
    fontSize: '13px',
    fontWeight: '700',
    flexWrap: 'wrap',
  },
  modelRow: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '12px',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    background: '#fff',
  },
  modelRowTop: {
    display: 'grid',
    gridTemplateColumns: '96px 1.4fr 1fr',
    columnGap: '20px',
    rowGap: '12px',
    alignItems: 'center',
    paddingRight: '76px',
  },
  modelRowActions: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  allocationWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingTop: '14px',
    borderTop: '1px solid #e5e7eb',
  },
  thumb: {
    width: '84px',
    height: '84px',
    objectFit: 'cover',
    borderRadius: '14px',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
  thumbEmpty: {
    width: '84px',
    height: '84px',
    borderRadius: '14px',
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
    fontSize: '12px',
    fontWeight: '700',
  },
  thumbButton: {
    width: '84px',
    height: '84px',
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
  },
  modelMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  modelName: {
    fontWeight: '700',
    color: '#111827',
    fontSize: '15px',
  },
  modelVariantLine: {
    margin: 0,
    color: '#111827',
    fontSize: '15px',
    fontWeight: '800',
    lineHeight: 1.4,
  },
  variantBadge: {
    alignSelf: 'flex-start',
    padding: '3px 8px',
    borderRadius: '7px',
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
    color: '#8a817a',
    fontSize: '11px',
    fontWeight: '800',
    letterSpacing: '0.04em',
  },
  qtyPair: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  },
  infoText: {
    margin: 0,
    color: '#6b7280',
    fontSize: '12px',
  },
  allocationCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '14px',
    background: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
  },
  successText: {
    margin: 0,
    color: '#16a34a',
  },
  emptyText: {
    margin: 0,
    color: '#6b7280',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 40,
  },
  modal: {
    width: '100%',
    maxWidth: '720px',
    background: '#fff',
    borderRadius: '18px',
    padding: '18px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '12px',
  },
  modelCardButton: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '12px',
    background: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
  },
  photoPreviewOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    background: 'rgba(17, 24, 39, 0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  photoPreviewWrap: {
    position: 'relative',
    display: 'inline-flex',
  },
  photoPreviewImage: {
    maxWidth: 'calc(100vw - 48px)',
    maxHeight: 'calc(100vh - 48px)',
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
  },
  photoPreviewClose: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '32px',
    height: '32px',
    border: 'none',
    borderRadius: '999px',
    background: 'rgba(17, 24, 39, 0.72)',
    color: '#fff',
    fontSize: '18px',
    fontWeight: '800',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}

function createDefaultModelRow(expectedRow) {
  return {
    id: `expected-${expectedRow.id}`,
    source_id: expectedRow.id,
    model_id: '',
    model_name: expectedRow.model_name || '',
    model_color: expectedRow.model_color || '',
    original_model_name: expectedRow.model_name || '',
    original_model_color: expectedRow.model_color || '',
    brand_name: expectedRow.brand_name || '',
    category_name: expectedRow.category_name || '',
    pic_name: expectedRow.pic_name || '',
    model_replaced: false,
    qty_in: Number(expectedRow.qty || 0),
    qty_qc: String(expectedRow.qty || 0),
    photo_url: expectedRow.photo_url || '',
    allocations: [],
  }
}

function normalizeArklineProduct(row) {
  if (!row || row.is_active === false) {
    return null
  }

  const modelName = row.nama_produk || row.product_name || row.model_name || row.name || row.product_label || ''
  if (!String(modelName).trim()) {
    return null
  }

  return {
    id: String(row.sku_induk || row.id || row.nama_produk || '').trim().toUpperCase(),
    model_name: String(modelName).trim().toUpperCase(),
    model_color: String(row.warna || row.model_color || row.color || row.variant || '').trim().toUpperCase(),
    photo_url: row.foto_url || row.photo_url || row.image_url || row.image || '',
    category_name: String(row.kategori_produk || row.category_name || '').trim().toUpperCase(),
    procurement_category: String(row.kategori_pengadaan || '').trim().toUpperCase(),
    parent_sku: String(row.sku_induk || '').trim().toUpperCase(),
  }
}

function normalizeArklinePo(row) {
  if (!row) {
    return null
  }

  const poNumber = row.po_id || row.po_number || row.po_code || row.code || row.po_name || row.name || ''
  if (!String(poNumber).trim()) {
    return null
  }

  return {
    id: String(row.po_id || row.id || poNumber).trim().toUpperCase(),
    po_number: String(poNumber).trim().toUpperCase(),
  }
}

function normalizeArklinePoItem(row, productsById, poLabel) {
  if (!row) {
    return null
  }

  const linkedProduct =
    productsById[
      String(row.sku_induk || row.product_id || row.arkline_product_id || row.dir_arkline_product_id || '')
        .trim()
        .toUpperCase()
    ] || null
  const modelName =
    row.nama_produk ||
    row.product_name ||
    row.model_name ||
    row.name ||
    linkedProduct?.model_name ||
    linkedProduct?.name ||
    ''

  if (!String(modelName).trim()) {
    return null
  }

  const quantity =
    Number(
      row.qty ??
        row.quantity ??
        row.po_qty ??
        row.ordered_qty ??
        row.total_qty ??
        row.request_qty ??
        0
    ) || 0

  return {
    key: `po-item:${row.id}`,
    id: row.id,
    po_id: String(row.po_id || '').trim().toUpperCase(),
    sku_induk: String(row.sku_induk || linkedProduct?.parent_sku || '').trim().toUpperCase(),
    model_name: String(modelName).trim().toUpperCase(),
    model_color: String(linkedProduct?.model_color || linkedProduct?.warna || row.warna || row.model_color || row.color || `PO ${poLabel}` || '')
      .trim()
      .toUpperCase(),
    photo_url: row.foto_url || row.photo_url || linkedProduct?.foto_url || linkedProduct?.photo_url || '',
    qty_in: quantity,
    po_label: poLabel,
  }
}

function buildModelRowsFromPersisted(baseRows, existingPlanRows) {
  const rowMap = new Map()

  baseRows.forEach((row) => {
    rowMap.set(getModelKey(row.model_name, row.model_color), {
      ...row,
      allocations: row.allocations || [],
      startedAllocations: row.startedAllocations || [],
    })
  })

  existingPlanRows.forEach((planRow) => {
    const key = getModelKey(planRow.model_name, planRow.model_color)
    const existingRow =
      rowMap.get(key) ||
      {
        id: `saved-${planRow.id}`,
        source_id: null,
        model_id: '',
        model_name: planRow.model_name || '',
        model_color: planRow.model_color || '',
        qty_in: Number(planRow.expected_qty || 0),
        photo_url: planRow.photo_url || '',
        allocations: [],
        startedAllocations: [],
      }

    existingRow.photo_url = existingRow.photo_url || planRow.photo_url || ''
    if (planRow.status === 'queued') {
      existingRow.allocations = [
        ...(existingRow.allocations || []),
        {
          id: `alloc-saved-${planRow.id}`,
          task_id: planRow.id,
          member_email: planRow.assigned_to || '',
          qty: String(planRow.allocated_qty || 0),
          existing_status: planRow.status || 'queued',
          locked_qty: Number(planRow.locked_qty || 0),
        },
      ]
    } else {
      existingRow.startedAllocations = [
        ...(existingRow.startedAllocations || []),
        {
          id: `alloc-started-${planRow.id}`,
          task_id: planRow.id,
          member_email: planRow.assigned_to || '',
          qty: String(planRow.allocated_qty || 0),
          existing_status: planRow.status || 'queued',
          locked_qty: Number(planRow.locked_qty || 0),
        },
      ]
    }

    rowMap.set(key, existingRow)
  })

  return Array.from(rowMap.values()).sort((a, b) => getModelKey(a.model_name, a.model_color).localeCompare(getModelKey(b.model_name, b.model_color)))
}

async function loadFirstExistingRows(tableNames) {
  let lastError = null

  for (const tableName of tableNames) {
    const result = await supabase.from(tableName).select('*')

    if (!result.error) {
      return { data: result.data || [], tableName }
    }

    lastError = result.error
  }

  return { data: [], tableName: null, error: lastError }
}

function getModelKey(modelName, modelColor) {
  return `${String(modelName || '').trim().toUpperCase()}::${String(modelColor || '').trim().toUpperCase()}`
}

function getArklineProductLabel(product) {
  if (!product) {
    return ''
  }

  return product.model_name || ''
}

function hydrateArklinePlanRows(rows, fallbackColor) {
  return (rows || []).map((item) => ({
    ...item,
    model_color: String(item.model_color || fallbackColor || '').trim().toUpperCase(),
  }))
}

function buildArklineProductRows(baseRows, existingPlanRows) {
  const rowMap = new Map()

  baseRows.forEach((row) => {
    rowMap.set(getModelKey(row.model_name, row.model_color), {
      ...row,
      allocations: [],
      startedAllocations: [],
    })
  })

  existingPlanRows.forEach((planRow) => {
    const key = getModelKey(planRow.model_name, planRow.model_color)
    const existingRow =
      rowMap.get(key) ||
      {
        id: `saved-${planRow.id}`,
        source_id: null,
        model_id: '',
        model_name: planRow.model_name || '',
        model_color: planRow.model_color || fallbackColor || '',
        qty_in: 0,
        qty_qc: '',
        photo_url: planRow.photo_url || '',
        allocations: [],
        startedAllocations: [],
      }

    existingRow.model_name = existingRow.model_name || planRow.model_name || ''
    existingRow.model_color = existingRow.model_color || planRow.model_color || fallbackColor || ''
    existingRow.photo_url = existingRow.photo_url || planRow.photo_url || ''

    if (planRow.status === 'queued') {
      existingRow.allocations = [
        ...(existingRow.allocations || []),
        {
          id: `alloc-saved-${planRow.id}`,
          task_id: planRow.id,
          member_email: planRow.assigned_to || '',
          qty: String(planRow.allocated_qty || 0),
          existing_status: planRow.status || 'queued',
          locked_qty: Number(planRow.locked_qty || 0),
        },
      ]
    } else {
      existingRow.startedAllocations = [
        ...(existingRow.startedAllocations || []),
        {
          id: `alloc-started-${planRow.id}`,
          task_id: planRow.id,
          member_email: planRow.assigned_to || '',
          qty: String(planRow.allocated_qty || 0),
          existing_status: planRow.status || 'queued',
          locked_qty: Number(planRow.locked_qty || 0),
        },
      ]
    }

    rowMap.set(key, existingRow)
  })

  return Array.from(rowMap.values()).sort((a, b) => getModelKey(a.model_name, a.model_color).localeCompare(getModelKey(b.model_name, b.model_color)))
}

function getSourceTasks(source, qcItems) {
  if (!source?.sourceId) {
    return []
  }

  const sourceRowIds = new Set((source.rows || []).map((row) => Number(row.id)).filter(Boolean))
  sourceRowIds.add(Number(source.sourceId))
  return (qcItems || []).filter((item) => sourceRowIds.has(Number(item.inbound_unload_id)))
}

function getSourceAllocationCoverage(source, qcItems) {
  const sourceTasks = getSourceTasks(source, qcItems)
  const plannedQtyByProduct = new Map()

  sourceTasks.forEach((item) => {
    const identityKey = [
      Number(item.inbound_unload_id || 0),
      getModelKey(item.model_name, item.model_color || item.variant_name),
    ].join('::')
    plannedQtyByProduct.set(identityKey, Math.max(Number(plannedQtyByProduct.get(identityKey) || 0), Number(item.qty_in || 0)))
  })

  return {
    sourceTasks,
    allocatedQty: sourceTasks.reduce((sum, item) => sum + Number(item.allocated_qty || 0), 0),
    plannedQty: Array.from(plannedQtyByProduct.values()).reduce((sum, qty) => sum + Number(qty || 0), 0),
  }
}

function getSourceStatus(source, qcItems) {
  const { sourceTasks, allocatedQty, plannedQty } = getSourceAllocationCoverage(source, qcItems)

  if (!sourceTasks.length) {
    return 'idle'
  }

  const isFullyAllocated = plannedQty > 0 && allocatedQty >= plannedQty

  if (isFullyAllocated && sourceTasks.every((item) => item.status === 'done')) {
    return 'completed'
  }

  if (sourceTasks.some((item) => item.status !== 'queued')) {
    return 'started'
  }

  return 'planned'
}

function buildModelRowsForSource(source, unloadRows, qcItems) {
  if (!source) {
    return []
  }

  const rowMap = new Map()
  const expectedRows = source.rows || []
  const sourceRowIds = new Set(expectedRows.map((row) => Number(row.id)).filter(Boolean))
  sourceRowIds.add(Number(source.sourceId))
  const existingPlanRows = (qcItems || []).filter((item) => sourceRowIds.has(Number(item.inbound_unload_id)))
  const savedSourceRowIds = new Set(existingPlanRows.map((row) => Number(row.inbound_unload_id || 0)).filter(Boolean))

  expectedRows.forEach((row) => {
    if (savedSourceRowIds.has(Number(row.id || 0))) {
      return
    }

    const key = getExpectedRowKey(row)
    const existingRow = rowMap.get(key) || {
      ...createDefaultModelRow(row),
      id: `expected-${source.sourceId}-${key}`,
      qty_in: 0,
      qty_qc: String(row.qty || 0),
      has_saved_qc_in: false,
      allocations: [],
    }

    existingRow.qty_in += Number(row.qty || 0)
    existingRow.qty_qc = String(Math.max(Number(existingRow.qty_qc || 0), Number(row.qty || 0)))
    existingRow.photo_url = existingRow.photo_url || row.photo_url || ''
    rowMap.set(key, existingRow)
  })

  existingPlanRows.forEach((planRow) => {
    const planModelKey = getModelKey(planRow.model_name, planRow.model_color)
    const exactExpectedRow = expectedRows.find((row) => Number(row.id) === Number(planRow.inbound_unload_id)) || null
    const modelExpectedRow = expectedRows.find((row) => getModelKey(row.model_name, row.model_color) === planModelKey) || null
    const isExactSameModel =
      exactExpectedRow && getModelKey(exactExpectedRow.model_name, exactExpectedRow.model_color) === planModelKey
    const matchingExpectedRow =
      isExactSameModel
        ? exactExpectedRow
        : planRow.model_replaced
          ? exactExpectedRow || null
          : modelExpectedRow || exactExpectedRow || null
    const key = isExactSameModel
      ? getExpectedRowKey(exactExpectedRow)
      : `saved:${Number(planRow.inbound_unload_id || 0)}:${planModelKey}`
    const existingRow =
      rowMap.get(key) ||
      {
        id: `saved-${planRow.id}`,
        source_id: matchingExpectedRow?.id || planRow.inbound_unload_id || source.sourceId,
        model_id: planRow.product_model_id ? String(planRow.product_model_id) : '',
        product_model_variant_id: planRow.product_model_variant_id || null,
        model_name: planRow.model_name || '',
        model_color: planRow.model_color || '',
        original_model_name: planRow.original_model_name || matchingExpectedRow?.model_name || planRow.model_name || '',
        original_model_color: planRow.original_model_color || matchingExpectedRow?.model_color || planRow.model_color || '',
        brand_name: matchingExpectedRow?.brand_name || planRow.brand_name || '',
        category_name: matchingExpectedRow?.category_name || planRow.category_name || '',
        pic_name: matchingExpectedRow?.pic_name || planRow.pic_name || '',
        model_replaced: Boolean(planRow.model_replaced),
        qty_in: Number(matchingExpectedRow?.qty || 0),
        qty_qc: String(planRow.qty_in || 0),
        has_saved_qc_in: true,
        photo_url: planRow.photo_url || matchingExpectedRow?.photo_url || '',
        allocations: [],
        startedAllocations: [],
      }

    existingRow.model_id = existingRow.model_id || (planRow.product_model_id ? String(planRow.product_model_id) : '')
    existingRow.product_model_variant_id = existingRow.product_model_variant_id || planRow.product_model_variant_id || null
    existingRow.model_name = planRow.model_name || existingRow.model_name || ''
    existingRow.model_color = planRow.model_color || existingRow.model_color || ''
    existingRow.original_model_name =
      planRow.original_model_name || existingRow.original_model_name || matchingExpectedRow?.model_name || planRow.model_name || ''
    existingRow.original_model_color =
      planRow.original_model_color || existingRow.original_model_color || matchingExpectedRow?.model_color || planRow.model_color || ''
    existingRow.model_replaced = Boolean(existingRow.model_replaced || planRow.model_replaced)
    existingRow.photo_url = planRow.photo_url || existingRow.photo_url || matchingExpectedRow?.photo_url || ''
    existingRow.qty_qc = existingRow.has_saved_qc_in
      ? String(Math.max(Number(existingRow.qty_qc || 0), Number(planRow.qty_in || 0)))
      : String(Number(planRow.qty_in || 0))
    existingRow.has_saved_qc_in = true
    if (planRow.status === 'queued') {
      existingRow.allocations = [
        ...(existingRow.allocations || []),
        {
          id: `alloc-saved-${planRow.id}`,
          task_id: planRow.id,
          member_email: planRow.assigned_to || '',
          qty: String(planRow.allocated_qty || 0),
          existing_status: planRow.status || 'queued',
          locked_qty: Number(planRow.locked_qty || 0),
        },
      ]
    } else {
      existingRow.startedAllocations = [
        ...(existingRow.startedAllocations || []),
        {
          id: `alloc-started-${planRow.id}`,
          task_id: planRow.id,
          member_email: planRow.assigned_to || '',
          qty: String(planRow.allocated_qty || 0),
          existing_status: planRow.status || 'queued',
          locked_qty: Number(planRow.locked_qty || 0),
        },
      ]
    }

    rowMap.set(key, existingRow)
  })

  return Array.from(rowMap.values()).sort((a, b) => getModelKey(a.model_name, a.model_color).localeCompare(getModelKey(b.model_name, b.model_color)))
}

export default function QcReceivingPage() {
  const pathname = usePathname()
  const sourceListRef = useRef(null)
  const [viewportWidth, setViewportWidth] = useState(1280)
  const [inbounds, setInbounds] = useState([])
  const [unloadRows, setUnloadRows] = useState([])
  const [brands, setBrands] = useState([])
  const [categories, setCategories] = useState([])
  const [productModels, setProductModels] = useState([])
  const [productModelVariants, setProductModelVariants] = useState([])
  const [arklineProducts, setArklineProducts] = useState([])
  const [arklinePurchaseOrders, setArklinePurchaseOrders] = useState([])
  const [arklinePoItems, setArklinePoItems] = useState([])
  const [arklineQcItems, setArklineQcItems] = useState([])
  const [arklineReworkReceipts, setArklineReworkReceipts] = useState([])
  const [arklineReturnBatches, setArklineReturnBatches] = useState([])
  const [qcItems, setQcItems] = useState([])
  const [qcMembers, setQcMembers] = useState([])
  const [qcMode, setQcMode] = useState('regular')
  const [arklinePlannerMode, setArklinePlannerMode] = useState('product')
  const [grnSearch, setGrnSearch] = useState('')
  const [selectedInboundId, setSelectedInboundId] = useState('')
  const [selectedSourceKey, setSelectedSourceKey] = useState('')
  const [selectedArklineProductId, setSelectedArklineProductId] = useState('')
  const [selectedArklineCategory, setSelectedArklineCategory] = useState('')
  const [arklineProductSearch, setArklineProductSearch] = useState('')
  const [showArklineProductOptions, setShowArklineProductOptions] = useState(false)
  const [selectedArklinePoId, setSelectedArklinePoId] = useState('')
  const [selectedArklinePoItemKey, setSelectedArklinePoItemKey] = useState('')
  const [selectedArklineReworkSourceId, setSelectedArklineReworkSourceId] = useState('')
  const [modelRows, setModelRows] = useState([])
  const [allocationOpenRows, setAllocationOpenRows] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showChooseModelModal, setShowChooseModelModal] = useState(false)
  const [showModelModal, setShowModelModal] = useState(false)
  const [activeModelRowId, setActiveModelRowId] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [modelModalError, setModelModalError] = useState('')
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceScrollState, setSourceScrollState] = useState({
    hasOverflow: false,
    canScrollLeft: false,
    canScrollRight: false,
  })
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [modelDraft, setModelDraft] = useState({
    model_name: '',
    model_color: '',
    photo_url: '',
  })
  const [modelPhotoFile, setModelPhotoFile] = useState(null)
  const [sourceDetailsExpanded, setSourceDetailsExpanded] = useState(true)

  useEffect(() => {
    function updateViewport() {
      setViewportWidth(window.innerWidth)
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)

    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true)
      setError('')
      const today = getTodayLocalDate()

      const [arklineProductResult, arklinePoResult, arklinePoItemResult] = await Promise.all([
        supabase.from('arkline_dir_products').select('*'),
        loadFirstExistingRows(ARKLINE_PO_TABLE_CANDIDATES),
        loadFirstExistingRows(ARKLINE_PO_ITEM_TABLE_CANDIDATES),
      ])

      const [
        { data: inboundRows, error: inboundError },
        { data: brandRows, error: brandError },
        { data: categoryRows, error: categoryError },
        { data: modelRows, error: modelError },
        { data: productVariantRows },
        { data: qcRows, error: qcError },
        { data: arklineQcRows, error: arklineQcError },
        { data: reworkReceiptRows, error: reworkReceiptError },
        { data: returnBatchRows, error: returnBatchError },
        { data: memberRows, error: memberError },
        { data: rolePermissionRows, error: rolePermissionError },
      ] = await Promise.all([
        supabase
          .from('inbound')
          .select('id, grn_number, inbound_date, item_name, suppliers:dir_suppliers!supplier_id (supplier_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('dir_brands')
          .select('id, brand_name')
          .order('brand_name', { ascending: true }),
        supabase
          .from('dir_categories')
          .select('id, category_name, parent_id, full_name')
          .order('category_name', { ascending: true }),
        supabase
          .from('dir_product_models')
          .select('id, brand_id, category_id, model_name')
          .eq('is_active', true)
          .order('model_name', { ascending: true }),
        supabase
          .from('dir_product_model_variants')
          .select('*')
          .eq('is_active', true)
          .order('variant_code', { ascending: true }),
        supabase
          .from('qc_items')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('arkline_qc')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('arkline_po_item_receipts')
          .select('*')
          .eq('receipt_type', 'REWORK_RETURN')
          .order('receive_date', { ascending: false }),
        supabase
          .from('arkline_qc_return_batches')
          .select('id, return_number, round_number, status'),
        supabase
          .from('dir_user_profiles')
          .select('id, email, display_name, role, is_qc_active, qc_active_date')
          .eq('is_qc_active', true)
          .order('display_name', { ascending: true }),
        supabase.from('dir_user_roles').select('role, permission_code').eq('permission_code', 'qc.grading_task.view'),
      ])

      if (
        inboundError ||
        brandError ||
        categoryError ||
        modelError ||
        qcError ||
        arklineQcError ||
        reworkReceiptError ||
        returnBatchError ||
        memberError ||
        rolePermissionError
      ) {
        setError(
          inboundError?.message ||
            brandError?.message ||
            categoryError?.message ||
            modelError?.message ||
            qcError?.message ||
            arklineQcError?.message ||
            reworkReceiptError?.message ||
            returnBatchError?.message ||
            memberError?.message ||
            rolePermissionError?.message ||
            'Failed to load QC receiving setup.'
        )
        setLoading(false)
        return
      }

      const allowedRoles = new Set((rolePermissionRows || []).map((item) => item.role))
      const eligibleMembers = (memberRows || []).filter(
        (item) =>
          (allowedRoles.has(item.role) || item.role === 'admin' || String(item.email || '').trim().toLowerCase() === ADMIN_EMAIL) &&
          item.is_qc_active === true &&
          getDateOnly(item.qc_active_date) === today
      )

      setInbounds(inboundRows || [])
      setBrands(brandRows || [])
      setCategories(categoryRows || [])
      setProductModels(modelRows || [])
      setProductModelVariants(productVariantRows || [])
      setQcItems((qcRows || []).map(normalizeQcItemRow))
      setArklineQcItems(arklineQcRows || [])
      setArklineReworkReceipts(reworkReceiptRows || [])
      setArklineReturnBatches(returnBatchRows || [])
      setQcMembers(eligibleMembers)
      setArklineProducts((arklineProductResult.data || []).map(normalizeArklineProduct).filter(Boolean))
      setArklinePurchaseOrders((arklinePoResult.data || []).map(normalizeArklinePo).filter(Boolean))
      setArklinePoItems(arklinePoItemResult.data || [])
      setLoading(false)
    }

    loadInitialData()
  }, [])

  useEffect(() => {
    async function loadUnloadRows() {
      if (!selectedInboundId) {
        setSourceLoading(false)
        setUnloadRows([])
        setSelectedSourceKey('')
        return
      }

      setSourceLoading(true)
      const { data, error: unloadError } = await loadInboundUnloadRows(selectedInboundId)

      if (unloadError) {
        setError(unloadError.message)
        setSourceLoading(false)
        return
      }

      const brandMap = new Map((brands || []).map((brand) => [Number(brand.id), String(brand.brand_name || '').trim().toUpperCase()]))
      const categoryMap = new Map(
        (categories || []).map((category) => [
          Number(category.id),
          category,
        ])
      )
      setUnloadRows(
        (data || []).map((row) => ({
          ...row,
          brand_name: row.brand_name || brandMap.get(Number(row.brand_id)) || '',
          category_name: getItemTypeSubcategoryLabel(row.category_id, categoryMap, row.category_name),
        }))
      )
      setSourceLoading(false)
    }

    loadUnloadRows()
  }, [brands, categories, selectedInboundId])

  const isMobileApp = pathname?.startsWith('/mobile/')
  const isMobileLayout = isMobileApp || viewportWidth <= 820
  const isTabletLayout = isMobileApp || viewportWidth <= 1120
  const shellCardStyle = isMobileLayout ? { ...styles.card, padding: '14px', borderRadius: '12px' } : styles.card
  const headerStyle = isMobileLayout
    ? { ...styles.header, flexDirection: 'column', alignItems: 'stretch', gap: '12px' }
    : styles.header
  const plannerGridStyle = isMobileLayout
    ? { display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }
    : isTabletLayout
      ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }
      : { ...styles.grid, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
  const arklineChoiceGridStyle = isMobileLayout
    ? { display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }
    : { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }
  const rowTopGridStyle = isMobileLayout
    ? { ...styles.modelRowTop, gridTemplateColumns: '72px 1fr', alignItems: 'start' }
    : isTabletLayout
      ? { ...styles.modelRowTop, gridTemplateColumns: '84px 1.3fr 1fr' }
      : styles.modelRowTop
  const arklineRowTopGridStyle = isMobileLayout
    ? { ...styles.modelRowTop, gridTemplateColumns: '1fr', alignItems: 'start' }
    : isTabletLayout
      ? { ...styles.modelRowTop, gridTemplateColumns: '1.35fr 1fr' }
      : { ...styles.modelRowTop, gridTemplateColumns: '1.5fr 1fr' }
  const allocationGridStyle = isMobileLayout
    ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 72px 68px', gap: '6px', alignItems: 'center' }
    : { display: 'grid', gridTemplateColumns: '140px 78px 68px', gap: '6px', alignItems: 'center' }
  const arklineSummaryGridStyle = isMobileLayout
    ? { ...styles.summaryGrid, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
    : { ...styles.summaryGrid, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }
  const bottomBarStyle = isMobileLayout
    ? {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        position: 'sticky',
        bottom: '10px',
        padding: '12px',
        border: '1px solid #e5e7eb',
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(10px)',
      }
    : styles.buttonRow

  const selectedInbound = inbounds.find((item) => item.id === Number(selectedInboundId)) || null
  const sourceOptions = useMemo(() => {
    const groupedKoli = new Map()
    const sampleRows = []

    unloadRows.forEach((row) => {
      if (row.is_sample) {
        sampleRows.push(row)
        return
      }

      const key = `koli:${row.koli_sequence}`
      if (!groupedKoli.has(key)) {
        groupedKoli.set(key, {
          key,
          label: `Koli ${row.koli_sequence}`,
          type: 'koli',
          sourceId: row.id,
          rows: [],
        })
      }

      groupedKoli.get(key).rows.push(row)
    })

    const result = []
    if (sampleRows.length) {
      result.push({
        key: 'sample',
        label: 'Sample',
        type: 'sample',
        sourceId: sampleRows[0].id,
        rows: sampleRows,
      })
    }

    result.push(...Array.from(groupedKoli.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })))

    return result
  }, [unloadRows])
  const selectedSource = sourceOptions.find((item) => item.key === selectedSourceKey) || null
  const selectedSourceId = selectedSource?.sourceId || null

  useEffect(() => {
    function updateSourceScrollState() {
      const element = sourceListRef.current

      if (!element) {
        setSourceScrollState({
          hasOverflow: false,
          canScrollLeft: false,
          canScrollRight: false,
        })
        return
      }

      const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth)
      const nextState = {
        hasOverflow: maxScrollLeft > 1,
        canScrollLeft: element.scrollLeft > 1,
        canScrollRight: element.scrollLeft < maxScrollLeft - 1,
      }

      setSourceScrollState((current) =>
        current.hasOverflow === nextState.hasOverflow &&
        current.canScrollLeft === nextState.canScrollLeft &&
        current.canScrollRight === nextState.canScrollRight
          ? current
          : nextState
      )
    }

    const frame = window.requestAnimationFrame(updateSourceScrollState)
    window.addEventListener('resize', updateSourceScrollState)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateSourceScrollState)
    }
  }, [selectedInboundId, selectedSourceKey, sourceOptions.length, viewportWidth])

  const arklineProductsById = useMemo(
    () =>
      arklineProducts.reduce((result, item) => {
        const keys = [item.id, item.parent_sku].filter(Boolean)
        keys.forEach((key) => {
          result[String(key).trim().toUpperCase()] = item
        })
        return result
      }, {}),
    [arklineProducts]
  )
  const arklineProductCategories = useMemo(
    () =>
      Array.from(new Set(arklineProducts.map((item) => item.category_name).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
    [arklineProducts]
  )
  const arklineFilteredProducts = useMemo(() => {
    const keyword = arklineProductSearch.trim().toUpperCase()

    return arklineProducts.filter((item) => {
      const matchesCategory = !selectedArklineCategory || item.category_name === selectedArklineCategory
      if (!matchesCategory) {
        return false
      }

      if (!keyword) {
        return true
      }

      const haystack = [
        item.model_name,
        item.category_name,
        item.procurement_category,
        item.parent_sku,
      ]
        .filter(Boolean)
        .join(' ')
        .toUpperCase()

      return haystack.includes(keyword)
    })
  }, [arklineProductSearch, arklineProducts, selectedArklineCategory])
  const selectedArklineProduct =
    arklineProducts.find((item) => String(item.id) === String(selectedArklineProductId)) || null
  const selectedArklinePo =
    arklinePurchaseOrders.find((item) => String(item.id) === String(selectedArklinePoId)) || null
  const arklinePoOptions = useMemo(
    () => [...arklinePurchaseOrders].sort((a, b) => a.po_number.localeCompare(b.po_number, undefined, { numeric: true })),
    [arklinePurchaseOrders]
  )
  const reworkPoItemIds = useMemo(
    () => new Set(arklineReworkReceipts.map((receipt) => String(receipt.arkline_po_item_id || '')).filter(Boolean)),
    [arklineReworkReceipts]
  )
  const reworkPoIds = useMemo(
    () =>
      new Set(
        arklinePoItems
          .filter((item) => reworkPoItemIds.has(String(item.id || '')))
          .map((item) => String(item.po_id || '').trim().toUpperCase())
          .filter(Boolean)
      ),
    [arklinePoItems, reworkPoItemIds]
  )
  const visibleArklinePoOptions = useMemo(
    () => (qcMode === 're_qc' ? arklinePoOptions.filter((po) => reworkPoIds.has(String(po.id).trim().toUpperCase())) : arklinePoOptions),
    [arklinePoOptions, qcMode, reworkPoIds]
  )
  const arklinePoItemOptions = useMemo(() => {
    if (!selectedArklinePo) {
      return []
    }

    const poId = String(selectedArklinePo.id).trim().toUpperCase()

    return arklinePoItems
      .filter((row) => {
        const candidatePoId = String(
          row.po_id || row.arkline_po_id || row.purchase_order_id || row.dir_arkline_po_id || ''
        )
          .trim()
          .toUpperCase()
        return candidatePoId === poId && (qcMode !== 're_qc' || reworkPoItemIds.has(String(row.id || '')))
      })
      .map((row) => normalizeArklinePoItem(row, arklineProductsById, selectedArklinePo.po_number))
      .filter(Boolean)
      .sort((a, b) => a.model_name.localeCompare(b.model_name))
  }, [arklinePoItems, arklineProductsById, qcMode, reworkPoItemIds, selectedArklinePo])
  const selectedArklinePoItem =
    arklinePoItemOptions.find((item) => item.key === selectedArklinePoItemKey) || null
  const arklineReturnBatchById = useMemo(
    () => new Map(arklineReturnBatches.map((batch) => [String(batch.id), batch])),
    [arklineReturnBatches]
  )
  const arklineReworkSources = useMemo(() => {
    if (!selectedArklinePoItem) return []

    const groups = new Map()
    arklineReworkReceipts
      .filter((receipt) => String(receipt.arkline_po_item_id || '') === String(selectedArklinePoItem.id))
      .forEach((receipt) => {
        const groupId = String(receipt.receipt_group_id || receipt.id || '')
        if (!groupId) return
        const current = groups.get(groupId) || {
          id: groupId,
          returnBatchId: receipt.source_return_batch_id || null,
          roundNumber: Number(receipt.round_number || 2),
          receiveDate: receipt.receive_date,
          totalQty: 0,
        }
        current.totalQty += Number(receipt.received_qty || 0)
        groups.set(groupId, current)
      })

    return Array.from(groups.values())
      .map((source) => {
        const sourceTasks = arklineQcItems.filter(
          (task) => String(task.source_receipt_group_id || '') === source.id
        )
        const allocatedQty = sourceTasks.reduce((sum, task) => sum + Number(task.allocated_qty || 0), 0)
        const queuedQty = sourceTasks
          .filter((task) => task.status === 'queued')
          .reduce((sum, task) => sum + Number(task.allocated_qty || 0), 0)
        const batch = arklineReturnBatchById.get(String(source.returnBatchId || '')) || null
        return {
          ...source,
          returnNumber: batch?.return_number || 'RETURN BATCH',
          pendingQty: Math.max(0, source.totalQty - allocatedQty),
          editableQty: Math.max(0, source.totalQty - allocatedQty + queuedQty),
        }
      })
      .sort((a, b) => Number(a.roundNumber || 0) - Number(b.roundNumber || 0))
  }, [arklineQcItems, arklineReturnBatchById, arklineReworkReceipts, selectedArklinePoItem])
  const selectedArklineReworkSource =
    arklineReworkSources.find((source) => source.id === selectedArklineReworkSourceId) || null
  const isArklineMode = qcMode === 'arkline' || qcMode === 're_qc'
  const isReQcMode = qcMode === 're_qc'
  const selectedArklineProductSku = String(selectedArklineProduct?.parent_sku || selectedArklineProduct?.id || '')
    .trim()
    .toUpperCase()
  const selectedArklinePoCode = String(selectedArklinePo?.id || '').trim().toUpperCase()
  const selectedArklinePoItemId = String(selectedArklinePoItem?.id || '').trim()

  const qcInQty = modelRows.reduce((sum, row) => sum + Number(row.qty_qc || 0), 0)
  const allocationTotal = modelRows.reduce(
    (sum, row) =>
      sum +
      (row.allocations || []).reduce((allocationSum, split) => allocationSum + Number(split.qty || 0), 0),
    0
  )
  const inboundModelLookup = useMemo(() => {
    const lookup = new Map()
    unloadRows.forEach((row) => {
      const modelName = String(row.model_name || '').trim().toUpperCase()
      if (!modelName) return
      const current = lookup.get(modelName) || []
      current.push(row)
      lookup.set(modelName, current)
    })
    return lookup
  }, [unloadRows])
  const catalogBrandNameById = useMemo(
    () => new Map(brands.map((brand) => [Number(brand.id), String(brand.brand_name || '').trim().toUpperCase()])),
    [brands]
  )
  const catalogCategoryById = useMemo(
    () => new Map(categories.map((category) => [Number(category.id), category])),
    [categories]
  )
  const modelOptions = productModels
    .flatMap((model) => {
      const variants = productModelVariants.filter((variant) => Number(variant.product_model_id || 0) === Number(model.id || 0))
      const inboundMatches = inboundModelLookup.get(String(model.model_name || '').trim().toUpperCase()) || []
      const compatibleInboundMatches = inboundMatches.filter((row) => {
        const brandMatches = !row.brand_id || !model.brand_id || Number(row.brand_id) === Number(model.brand_id)
        const categoryMatches = !row.category_id || !model.category_id || Number(row.category_id) === Number(model.category_id)
        return brandMatches && categoryMatches
      })
      if (selectedInboundId && !compatibleInboundMatches.length) {
        return []
      }

      const firstInboundMatch = compatibleInboundMatches[0] || inboundMatches[0] || {}
      const catalogBrandName = catalogBrandNameById.get(Number(model.brand_id)) || firstInboundMatch.brand_name || ''
      const catalogCategoryName = getItemTypeSubcategoryLabel(model.category_id, catalogCategoryById, firstInboundMatch.category_name)

      if (!variants.length) {
        return [
          {
            ...model,
            option_id: `model-${model.id}`,
            model_id: model.id,
            model_color: '',
            photo_url: firstInboundMatch.photo_url || '',
            brand_name: catalogBrandName,
            category_name: catalogCategoryName,
            pic_name: firstInboundMatch.pic_name || '',
          },
        ]
      }

      return variants.map((variant) => ({
        ...model,
        option_id: `variant-${variant.id}`,
        model_id: model.id,
        variant_id: variant.id,
        model_color: getCatalogVariantLabel(variant).toUpperCase(),
        photo_url: variant.variant_photo_url || firstInboundMatch.photo_url || '',
        brand_name: catalogBrandName,
        category_name: catalogCategoryName,
        pic_name: firstInboundMatch.pic_name || '',
      }))
    })
    .filter((item) => {
      if (selectedInboundId && !inboundModelLookup.has(String(item.model_name || '').trim().toUpperCase())) {
        return false
      }
      if (!modelSearch.trim()) return true
      const label = item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name
      const metaLabel = [label, item.brand_name, item.category_name].filter(Boolean).join(' ')
      return metaLabel.toUpperCase().includes(modelSearch.trim().toUpperCase())
    })
  const currentPlanRows = isArklineMode
    ? !isReQcMode && arklinePlannerMode === 'product' && selectedArklineProduct
      ? arklineQcItems.filter(
          (item) =>
            !item.po_id &&
            String(item.qc_type || 'INITIAL').toUpperCase() !== 'RE_QC' &&
            String(item.sku_induk || '').trim().toUpperCase() === selectedArklineProductSku
        )
      : arklinePlannerMode === 'po' && selectedArklinePoItem
        ? arklineQcItems.filter(
          (item) =>
              String(item.po_id || '').trim().toUpperCase() === selectedArklinePoCode &&
              String(item.arkline_po_item_id || '').trim() === selectedArklinePoItemId &&
              (isReQcMode && selectedArklineReworkSourceId
                ? String(item.source_receipt_group_id || '') === selectedArklineReworkSourceId
                : !item.source_receipt_group_id && String(item.qc_type || 'INITIAL').toUpperCase() !== 'RE_QC')
          )
        : []
    : selectedSourceId
      ? qcItems.filter((item) => {
          const sourceRowIds = new Set((selectedSource?.rows || []).map((row) => Number(row.id)).filter(Boolean))
          sourceRowIds.add(Number(selectedSourceId))
          return sourceRowIds.has(Number(item.inbound_unload_id))
        })
      : []
  const selectedSourceStatus = isArklineMode
    ? !isReQcMode && arklinePlannerMode === 'product'
      ? currentPlanRows.some((item) => item.status !== 'queued' && item.status !== 'done')
        ? 'started'
        : 'planned'
      : !currentPlanRows.length
        ? 'idle'
        : currentPlanRows.every((item) => item.status === 'done')
          ? 'completed'
          : currentPlanRows.some((item) => item.status !== 'queued')
            ? 'started'
            : 'planned'
    : selectedSource
      ? getSourceStatus(selectedSource, qcItems)
      : 'idle'
  const isSelectedSourceStarted =
    isArklineMode && !isReQcMode && arklinePlannerMode === 'product'
      ? currentPlanRows.some((item) => item.status !== 'queued' && item.status !== 'done')
      : selectedSourceStatus === 'started' || selectedSourceStatus === 'completed'
  const isSelectedSourceCompleted =
    isArklineMode ? false : selectedSourceStatus === 'completed'
  const canEditSavedPlan = isArklineMode ? true : !isSelectedSourceStarted
  const canAdjustAllocations = isArklineMode ? true : !isSelectedSourceCompleted
  function handleGrnChange(value) {
    setGrnSearch(value)
    const match = inbounds.find((item) => item.grn_number === value)
    setSelectedInboundId(match ? String(match.id) : '')
    setSourceLoading(Boolean(match))
    setSelectedSourceKey('')
    setModelRows([])
    setError('')
    setSuccess('')
  }

  function handleQcModeChange(nextMode) {
    setQcMode(nextMode)
    if (nextMode === 're_qc') setArklinePlannerMode('po')
    setError('')
    setSuccess('')
    setModelRows([])
    setSelectedSourceKey('')
    setSelectedArklineProductId('')
    setSelectedArklineCategory('')
    setArklineProductSearch('')
    setShowArklineProductOptions(false)
    setSelectedArklinePoId('')
    setSelectedArklinePoItemKey('')
    setSelectedArklineReworkSourceId('')
  }

  function handleSourceChange(nextSourceKey) {
    setSelectedSourceKey(nextSourceKey)
    setError('')
    setSuccess('')

    if (!nextSourceKey) {
      setModelRows([])
      return
    }

    const nextSource = sourceOptions.find((item) => item.key === nextSourceKey)

    if (!nextSource) {
      setModelRows([])
      setSourceDetailsExpanded(true)
      return
    }

    setSourceDetailsExpanded(getSourceStatus(nextSource, qcItems) !== 'completed')
    setModelRows(buildModelRowsForSource(nextSource, unloadRows, qcItems))
  }

  function handleArklinePlannerModeChange(nextMode) {
    setArklinePlannerMode(nextMode)
    setError('')
    setSuccess('')
    setModelRows([])
    setSelectedArklineProductId('')
    setSelectedArklineCategory('')
    setArklineProductSearch('')
    setShowArklineProductOptions(false)
    setSelectedArklinePoId('')
    setSelectedArklinePoItemKey('')
  }

  function handleArklineCategoryChange(nextCategory) {
    setSelectedArklineCategory(nextCategory)
    setSelectedArklineProductId('')
    setArklineProductSearch('')
    setShowArklineProductOptions(false)
    setModelRows([])
    setError('')
    setSuccess('')
  }

  function handleArklineProductSearchChange(nextValue) {
    setArklineProductSearch(nextValue)
    setShowArklineProductOptions(true)
    setError('')
    setSuccess('')

    const normalizedValue = nextValue.trim().toUpperCase()
    const exactMatch = arklineFilteredProducts.find((item) => getArklineProductLabel(item) === normalizedValue)

    if (exactMatch) {
      handleArklineProductChange(String(exactMatch.id))
      return
    }

    if (!nextValue.trim()) {
      setSelectedArklineProductId('')
      setModelRows([])
      return
    }

    if (selectedArklineProduct && getArklineProductLabel(selectedArklineProduct) !== normalizedValue) {
      setSelectedArklineProductId('')
      setModelRows([])
    }
  }

  function handleArklineProductFieldClick() {
    if (selectedArklineProductId || arklineProductSearch) {
      setSelectedArklineProductId('')
      setArklineProductSearch('')
      setModelRows([])
    }

    setShowArklineProductOptions(true)
    setError('')
    setSuccess('')
  }

  function handleArklineProductChange(productId) {
    setSelectedArklineProductId(productId)
    const product = arklineProducts.find((item) => String(item.id) === String(productId))
    setArklineProductSearch(product ? getArklineProductLabel(product) : '')
    setShowArklineProductOptions(false)
    setSelectedArklinePoId('')
    setSelectedArklinePoItemKey('')
    setError('')
    setSuccess('')

    if (!product) {
      setModelRows([])
      return
    }

    const productSku = String(product.parent_sku || product.id || '').trim().toUpperCase()
    const matchingPlanRows = arklineQcItems.filter(
      (item) =>
        !item.po_id &&
        String(item.qc_type || 'INITIAL').toUpperCase() !== 'RE_QC' &&
        String(item.sku_induk || '').trim().toUpperCase() === productSku
    )
    const hydratedPlanRows = hydrateArklinePlanRows(matchingPlanRows, product.model_color || 'ARKLINE PRODUCT')

    const baseRows = [
      {
        id: `arkline-product-${product.id}`,
        source_id: null,
        model_id: String(product.id),
        model_name: product.model_name,
        model_color: product.model_color || 'ARKLINE PRODUCT',
        qty_in: 0,
        qty_qc: '',
        photo_url: product.photo_url || '',
        allocations: [],
      },
    ]

    setModelRows(buildArklineProductRows(baseRows, hydratedPlanRows))
  }

  function handleArklinePoChange(poId) {
    setSelectedArklinePoId(poId)
    setSelectedArklinePoItemKey('')
    setSelectedArklineReworkSourceId('')
    setModelRows([])
    setError('')
    setSuccess('')
  }

  function handleArklinePoItemChange(itemKey) {
    setSelectedArklinePoItemKey(itemKey)
    setSelectedArklineReworkSourceId('')
    setError('')
    setSuccess('')

    const item = arklinePoItemOptions.find((entry) => entry.key === itemKey)
    if (!item) {
      setModelRows([])
      return
    }

    if (qcMode === 're_qc') {
      setModelRows([])
      return
    }

    const matchingPlanRows = arklineQcItems.filter(
      (planItem) =>
        String(planItem.po_id || '').trim().toUpperCase() === String(selectedArklinePo?.id || '').trim().toUpperCase() &&
        String(planItem.arkline_po_item_id || '').trim() === String(item.id) &&
        String(planItem.qc_type || 'INITIAL').toUpperCase() !== 'RE_QC' &&
        !planItem.source_receipt_group_id
    )
    const hydratedPlanRows = hydrateArklinePlanRows(matchingPlanRows, item.model_color || `PO ${item.po_label}`)

    const baseRows = [
      {
        id: `arkline-po-${item.id}`,
        source_id: null,
        model_id: '',
        model_name: item.model_name,
        model_color: item.model_color || `PO ${item.po_label}`,
        qty_in: Number(item.qty_in || 0),
        qty_qc: String(item.qty_in || 0),
        photo_url: item.photo_url || '',
        allocations: [],
      },
    ]

    setModelRows(buildModelRowsFromPersisted(baseRows, hydratedPlanRows))
  }

  function handleArklineQcSourceChange(sourceId) {
    setSelectedArklineReworkSourceId(sourceId)
    setError('')
    setSuccess('')

    if (!selectedArklinePoItem) {
      setModelRows([])
      return
    }

    if (!sourceId) {
      if (qcMode === 're_qc') {
        setModelRows([])
      } else {
        handleArklinePoItemChange(selectedArklinePoItemKey)
      }
      return
    }

    const source = arklineReworkSources.find((item) => item.id === sourceId)
    if (!source) {
      setModelRows([])
      return
    }

    const matchingPlanRows = arklineQcItems.filter(
      (task) =>
        String(task.arkline_po_item_id || '') === String(selectedArklinePoItem.id) &&
        String(task.source_receipt_group_id || '') === source.id
    )
    const hydratedPlanRows = hydrateArklinePlanRows(
      matchingPlanRows,
      `RE-QC ROUND ${source.roundNumber}`
    )
    const baseRows = [
      {
        id: `arkline-rework-${source.id}`,
        source_id: selectedArklinePoItem.id,
        source_receipt_group_id: source.id,
        source_return_batch_id: source.returnBatchId,
        qc_round_number: source.roundNumber,
        model_id: '',
        model_name: selectedArklinePoItem.model_name,
        model_color: `RE-QC ROUND ${source.roundNumber}`,
        qty_in: source.totalQty,
        qty_qc: String(source.editableQty),
        photo_url: selectedArklinePoItem.photo_url || '',
        allocations: [],
      },
    ]

    setModelRows(buildModelRowsFromPersisted(baseRows, hydratedPlanRows))
  }

  function addModelRow() {
    if (!canEditSavedPlan) {
      return
    }

    const rowId = `new-${Date.now()}-${modelRows.length}`
    const sourceRow = selectedSource?.rows?.[0] || null
    setModelRows((prev) => [
      ...prev,
      {
        id: rowId,
        source_id: sourceRow?.id || selectedSourceId || '',
        model_id: '',
        product_model_variant_id: null,
        model_name: '',
        model_color: '',
        original_model_name: sourceRow?.model_name || '',
        original_model_color: sourceRow?.model_color || '',
        brand_name: sourceRow?.brand_name || '',
        category_name: sourceRow?.category_name || '',
        pic_name: sourceRow?.pic_name || '',
        model_replaced: false,
        qty_in: 0,
        qty_qc: '',
        photo_url: '',
        allocations: [],
      },
    ])
    setActiveModelRowId(rowId)
    setModelSearch('')
    setShowChooseModelModal(true)
  }

  function handleCloseChooseModelModal() {
    if (activeModelRowId) {
      setModelRows((prev) =>
        prev.filter((row) => {
          if (row.id !== activeModelRowId || !String(row.id || '').startsWith('new-')) {
            return true
          }

          return Boolean(
            row.model_id ||
              row.model_name ||
              row.model_color ||
              row.photo_url ||
              Number(row.qty_in || 0) > 0 ||
              Number(row.qty_qc || 0) > 0 ||
              (row.allocations || []).length
          )
        })
      )
    }

    setShowChooseModelModal(false)
    setActiveModelRowId('')
    setModelSearch('')
  }

  function updateModelRow(rowId, updates) {
    setModelRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row)))
  }

  function handleChooseModel(item) {
    if (!activeModelRowId) return

    setModelRows((prev) =>
      prev.map((row) => {
        if (row.id !== activeModelRowId) return row

        const nextModelName = String(item.model_name || '').trim().toUpperCase()
        const nextModelColor = String(item.model_color || '').trim().toUpperCase()
        const originalModelName = row.original_model_name || row.model_name || nextModelName
        const originalModelColor = row.original_model_color || row.model_color || nextModelColor
        const isReplacement =
          Boolean(originalModelName || originalModelColor) &&
          (String(originalModelName || '').trim().toUpperCase() !== nextModelName ||
            String(originalModelColor || '').trim().toUpperCase() !== nextModelColor)

        return {
          ...row,
          model_id: String(item.model_id || item.id),
          product_model_variant_id: item.variant_id || null,
          model_name: nextModelName,
          model_color: nextModelColor,
          original_model_name: originalModelName,
          original_model_color: originalModelColor,
          brand_name: item.brand_name || row.brand_name || '',
          category_name: item.category_name || row.category_name || '',
          pic_name: item.pic_name || row.pic_name || '',
          model_replaced: row.model_replaced || isReplacement,
          photo_url: item.photo_url || row.photo_url || '',
        }
      })
    )
    setShowChooseModelModal(false)
    setActiveModelRowId('')
  }

  function isAllocationRowOpen(row) {
    if (Object.prototype.hasOwnProperty.call(allocationOpenRows, row.id)) {
      return allocationOpenRows[row.id]
    }
    return Boolean((row.allocations || []).length)
  }

  function toggleAllocationRow(rowId) {
  const row = modelRows.find((item) => item.id === rowId)
  const currentOpen = row ? isAllocationRowOpen(row) : false
  const nextOpen = !currentOpen

  setAllocationOpenRows((prev) => ({
    ...prev,
    [rowId]: nextOpen,
  }))

  if (nextOpen && row && !(row.allocations || []).length) {
    if (!canAdjustAllocations) {
      setError('Allocation is locked because QC for this source has already finished.')
      return
    }

    if (!qcMembers.length) {
      setError('No active QC user found')
      return
    }

    setError('')
    setModelRows((prev) =>
      prev.map((item) =>
        item.id === rowId
          ? {
              ...item,
              allocations: [
                {
                  id: `alloc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  task_id: null,
                  member_email: '',
                  qty: '',
                  existing_status: 'queued',
                  locked_qty: 0,
                },
              ],
            }
          : item
      )
    )
  }
}

  function addAllocationSplit(rowId) {
    if (!canAdjustAllocations) {
      setError('Allocation is locked because QC for this source has already finished.')
      return
    }

    if (!qcMembers.length) {
      setError('No active QC user found')
      return
    }

    setError('')
    setAllocationOpenRows((prev) => ({
      ...prev,
      [rowId]: true,
    }))
    setModelRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              allocations: [
                ...(row.allocations || []),
                {
                  id: `alloc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  task_id: null,
                  member_email: '',
                  qty: '',
                  existing_status: 'queued',
                  locked_qty: 0,
                },
              ],
            }
          : row
      )
    )
  }

  function updateAllocationSplit(rowId, splitId, updates) {
    setModelRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              allocations: (row.allocations || []).map((split) => (split.id === splitId ? { ...split, ...updates } : split)),
            }
          : row
      )
    )
  }

  function removeAllocationSplit(rowId, splitId) {
    setModelRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              allocations: (row.allocations || []).filter((split) => split.id !== splitId),
            }
          : row
      )
    )
  }

  function canEditAllocationMember(split) {
    return canAdjustAllocations && (!split.existing_status || split.existing_status === 'queued')
  }

  function canEditAllocationQty(split) {
    return canAdjustAllocations && (!split.existing_status || split.existing_status === 'queued')
  }

  function canRemoveAllocationSplit(split) {
    return canAdjustAllocations && Number(split.locked_qty || 0) <= 0 && (!split.existing_status || split.existing_status === 'queued')
  }

  function isDoneAllocation(split) {
    return String(split?.existing_status || '').trim().toLowerCase() === 'done'
  }

  function getVisibleAllocations(row) {
    return (row.allocations || []).filter((split) => !isDoneAllocation(split))
  }

  function getVisibleStartedAllocations(row) {
    return (row.startedAllocations || []).filter((split) => !isDoneAllocation(split))
  }

  function getEditableAllocationTotal(row) {
    return (row.allocations || []).reduce((sum, split) => sum + Number(split.qty || 0), 0)
  }

  function getStartedAllocationTotal(row) {
    return (row.startedAllocations || []).reduce((sum, split) => sum + Number(split.qty || 0), 0)
  }

  function getAllocationTotalForRow(row) {
    return getEditableAllocationTotal(row) + getStartedAllocationTotal(row)
  }

  function removeModelRow(rowId) {
    const rowIndex = modelRows.findIndex((row) => row.id === rowId)
    if (rowIndex <= 0 || modelRows.length <= 1) {
      return
    }

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Remove this model row?')
      if (!confirmed) return
    }
    setModelRows((prev) => prev.filter((row) => row.id !== rowId))
  }

  async function handleModelPhotoChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setModelPhotoFile(file)
      const dataUrl = await readFileAsDataUrl(file)
      setModelDraft((prev) => ({
        ...prev,
        photo_url: dataUrl,
      }))
    } catch (photoError) {
      setModelModalError(photoError.message)
    }
  }

  async function handleSaveModel() {
    setModelModalError('')

    if (!modelDraft.model_name.trim()) {
      setModelModalError('Model name is required.')
      return
    }

    let photoUrl = modelDraft.photo_url || ''

    if (modelPhotoFile) {
      const fileExt = modelPhotoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`
      const filePath = `qc-models/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('product-photos')
        .upload(filePath, modelPhotoFile, { upsert: false })

      if (uploadError) {
        setModelModalError(uploadError.message)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-photos')
        .getPublicUrl(filePath)

      photoUrl = publicUrlData.publicUrl || ''
    }

    const { data: insertedModel, error: insertError } = await supabase
      .from('dir_product_models')
      .insert([
        {
          model_name: modelDraft.model_name.trim().toUpperCase(),
          is_active: true,
        },
      ])
      .select('id, model_name')
      .single()

    if (insertError) {
      setModelModalError(insertError.message)
      return
    }

    setProductModels((prev) => [...prev, insertedModel])

    if (activeModelRowId) {
      updateModelRow(activeModelRowId, {
        model_id: String(insertedModel.id),
        model_name: insertedModel.model_name,
        model_color: modelDraft.model_color.trim().toUpperCase() || '',
        photo_url: photoUrl || '',
      })
    }

    setShowModelModal(false)
    setShowChooseModelModal(false)
    setModelDraft({
      model_name: '',
      model_color: '',
      photo_url: '',
    })
    setModelPhotoFile(null)
    setSuccess('Model added successfully.')
  }

  function resetRegularPlanner() {
    setGrnSearch('')
    setSelectedInboundId('')
    setSelectedSourceKey('')
    setUnloadRows([])
    setModelRows([])
  }

  function resetArklinePlanner() {
    setSelectedArklineProductId('')
    setSelectedArklineCategory('')
    setArklineProductSearch('')
    setShowArklineProductOptions(false)
    setSelectedArklinePoId('')
    setSelectedArklinePoItemKey('')
    setSelectedArklineReworkSourceId('')
    setModelRows([])
  }

  async function handleSavePlan() {
    setError('')
    setSuccess('')

    if (qcMode === 'arkline' || qcMode === 're_qc') {
      if (!modelRows.length) {
        setError(qcMode === 're_qc' ? 'Choose a returned-goods source first.' : 'Choose Arkline product or PO item first.')
        return
      }

      if (qcMode === 're_qc' && !selectedArklineReworkSource) {
        setError('Choose a Re-QC returned-goods source first.')
        return
      }

      const invalidRow = modelRows.find((row) => {
        const rowQcIn = Number(row.qty_qc || 0)
        const hasInvalidSplit = (row.allocations || []).some(
          (split) => !String(split.member_email || '').trim() || Number(split.qty || 0) <= 0
        )
        const exceedsQcIn = rowQcIn > 0 && getAllocationTotalForRow(row) > rowQcIn

        if (!row.model_name.trim() || hasInvalidSplit || exceedsQcIn) {
          return true
        }

        return false
      })

      if (invalidRow) {
        setError('Every allocation must have a product, inspector, and qty. Allocated qty cannot be greater than QC In.')
        return
      }

      if (selectedArklineReworkSource) {
        const committedQty = arklineQcItems
          .filter(
            (task) =>
              String(task.source_receipt_group_id || '') === selectedArklineReworkSource.id &&
              task.status !== 'queued'
          )
          .reduce((sum, task) => sum + Number(task.allocated_qty || 0), 0)
        const editableCapacity = Math.max(0, selectedArklineReworkSource.totalQty - committedQty)
        if (allocationTotal > editableCapacity) {
          setError(`Re-QC allocation cannot exceed the editable returned qty (${editableCapacity}).`)
          return
        }
      }

      if (!qcMembers.length) {
        setError('No active QC user found')
        return
      }

      setSaving(true)

      const qcCycleId = currentPlanRows.find((task) => task.qc_cycle_id)?.qc_cycle_id || crypto.randomUUID()
      const referencedPersistedTaskIds = new Set()
      const insertPayload = []
      const updatesForPersistedRows = []
      let blockingError = ''

      modelRows.forEach((row) => {
        ;(row.allocations || []).forEach((split) => {
          if (blockingError) return
          if (!split.member_email || Number(split.qty || 0) <= 0) return

          const persistedRow = split.task_id ? currentPlanRows.find((item) => item.id === split.task_id) || null : null
          if (persistedRow?.id) {
            referencedPersistedTaskIds.add(persistedRow.id)
          }
          const lockedQty = Number(persistedRow?.locked_qty ?? split.locked_qty ?? 0)
          const allocatedQty = Number(split.qty || 0)

          if (allocatedQty < lockedQty) {
            blockingError = `Allocated qty for ${split.member_email} on ${row.model_name} cannot be less than the committed qty (${lockedQty}).`
            return
          }

          const basePayload = {
            po_id: arklinePlannerMode === 'po' ? String(selectedArklinePo?.id || '').trim().toUpperCase() || null : null,
            arkline_po_item_id: arklinePlannerMode === 'po' ? row.source_id || selectedArklinePoItem?.id || null : null,
            sku_induk:
              arklinePlannerMode === 'po'
                ? String(selectedArklinePoItem?.sku_induk || '').trim().toUpperCase() || null
                : String(selectedArklineProduct?.parent_sku || selectedArklineProduct?.id || '').trim().toUpperCase() || null,
            assigned_to: String(split.member_email || '').trim().toLowerCase(),
            allocated_qty: allocatedQty,
            model_name: row.model_name.trim(),
            photo_url: row.photo_url || null,
            locked_qty: lockedQty,
            source_receipt_group_id: selectedArklineReworkSource?.id || null,
            source_return_batch_id: selectedArklineReworkSource?.returnBatchId || null,
            qc_round_number: Number(selectedArklineReworkSource?.roundNumber || 1),
            qc_type: selectedArklineReworkSource ? 'RE_QC' : 'INITIAL',
            qc_cycle_id: qcCycleId,
          }

          if (persistedRow) {
            updatesForPersistedRows.push({
              id: persistedRow.id,
              ...basePayload,
              status: persistedRow.status,
              finished_at: persistedRow.finished_at,
            })
          } else {
            insertPayload.push({
              ...basePayload,
              status: 'queued',
              qty_a: 0,
              qty_b: 0,
              qty_c: 0,
              stopwatch_seconds: 0,
            })
          }
        })
      })

      if (blockingError) {
        setError(blockingError)
        setSaving(false)
        return
      }

      for (const updateRow of updatesForPersistedRows) {
        const { error: updateError } = await supabase
          .from('arkline_qc')
          .update(updateRow)
          .eq('id', updateRow.id)

        if (updateError) {
          setError(updateError.message)
          setSaving(false)
          return
        }
      }

      if (insertPayload.length) {
        const { error: insertError } = await supabase.from('arkline_qc').insert(insertPayload)

        if (insertError) {
          setError(insertError.message)
          setSaving(false)
          return
        }
      }

      const { data: nextQcItems, error: refreshError } = await supabase
        .from('arkline_qc')
          .select('*')
          .order('created_at', { ascending: false })

      if (refreshError) {
        setError(refreshError.message)
        setSaving(false)
        return
      }

      setArklineQcItems(nextQcItems || [])

      if (qcMode === 'arkline' && arklinePlannerMode === 'product' && selectedArklineProduct) {
        const matchingPlanRows = hydrateArklinePlanRows(
          (nextQcItems || []).filter(
          (item) =>
            !item.po_id &&
              String(item.qc_type || 'INITIAL').toUpperCase() !== 'RE_QC' &&
              String(item.sku_induk || '').trim().toUpperCase() === selectedArklineProductSku
          ),
          selectedArklineProduct.model_color || 'ARKLINE PRODUCT'
        )

        setModelRows(
          buildModelRowsFromPersisted(
            [
              {
                id: `arkline-product-${selectedArklineProduct.id}`,
                source_id: null,
                model_id: String(selectedArklineProduct.id),
                model_name: selectedArklineProduct.model_name,
                model_color: selectedArklineProduct.model_color || 'ARKLINE PRODUCT',
                qty_in: 0,
                qty_qc: modelRows[0]?.qty_qc || '',
                photo_url: selectedArklineProduct.photo_url || '',
                allocations: [],
              },
            ],
            matchingPlanRows
          )
        )
      }

      if (arklinePlannerMode === 'po' && selectedArklinePoItem) {
        const matchingPlanRows = hydrateArklinePlanRows(
          (nextQcItems || []).filter(
            (item) =>
              String(item.po_id || '').trim().toUpperCase() === String(selectedArklinePo?.id || '').trim().toUpperCase() &&
              String(item.arkline_po_item_id || '').trim() === String(selectedArklinePoItem.id) &&
              (selectedArklineReworkSource
                ? String(item.source_receipt_group_id || '') === selectedArklineReworkSource.id
                : !item.source_receipt_group_id && String(item.qc_type || 'INITIAL').toUpperCase() !== 'RE_QC')
          ),
          selectedArklinePoItem.model_color || `PO ${selectedArklinePoItem.po_label}`
        )

        setModelRows(
          buildModelRowsFromPersisted(
            [
              {
                id: `arkline-po-${selectedArklinePoItem.id}`,
                source_id: selectedArklinePoItem.id,
                model_id: '',
                model_name: selectedArklinePoItem.model_name,
                model_color: selectedArklinePoItem.model_color,
                qty_in: Number(selectedArklinePoItem.qty_in || 0),
                photo_url: selectedArklinePoItem.photo_url || '',
                allocations: [],
                startedAllocations: [],
              },
            ],
            matchingPlanRows
          )
        )
      }

      resetArklinePlanner()
      setSuccess(qcMode === 're_qc' ? 'Re-QC plan saved.' : 'Arkline QC plan saved.')
      setSaving(false)
      return
    }

    if (!selectedInbound || !selectedSourceId) {
      setError('Choose GRN and Koli/Sample first.')
      return
    }

    const invalidRow = modelRows.find((row) => {
      const splitTotal = getAllocationTotalForRow(row)
      const hasInvalidSplit = (row.allocations || []).some(
        (split) => !String(split.member_email || '').trim() || Number(split.qty || 0) <= 0
      )

      return !row.model_name.trim() || Number(row.qty_qc || 0) <= 0 || hasInvalidSplit || splitTotal > Number(row.qty_qc || 0)
    })
    if (invalidRow) {
      setError('Every model row must have a model and QC qty. Allocated qty cannot be greater than QC In.')
      return
    }

    if (qcInQty <= 0) {
      setError('QC In must be greater than 0.')
      return
    }

    if (!qcMembers.length) {
      setError('No active QC user found')
      return
    }

    setSaving(true)

    const insertPayload = []
    const updatesForPersistedRows = []
    let blockingError = ''
    modelRows.forEach((row) => {
      ;(row.allocations || []).forEach((split) => {
        if (blockingError) {
          return
        }
        if (!split.member_email || Number(split.qty || 0) <= 0) {
          return
        }

        const persistedRow = split.task_id ? currentPlanRows.find((item) => item.id === split.task_id) || null : null
        const lockedQty = Number(persistedRow?.locked_qty ?? split.locked_qty ?? 0)
        const allocatedQty = Number(split.qty || 0)

        if (persistedRow && persistedRow.status !== 'queued') {
          blockingError = `Allocation for ${split.member_email} on ${row.model_name} has already started and cannot be changed.`
          return
        }

        if (allocatedQty < lockedQty) {
          blockingError = `Allocated qty for ${split.member_email} on ${row.model_name} cannot be less than the committed qty (${lockedQty}).`
          return
        }

        const basePayload = {
          inbound_id: selectedInbound.id,
          inbound_unload_id: row.source_id || selectedSourceId,
          assigned_to: String(split.member_email || '').trim().toLowerCase(),
          allocated_qty: allocatedQty,
          expected_qty: Number(row.qty_in || 0),
          qty_in: Number(row.qty_qc || 0),
          model_name: row.model_name.trim(),
          variant_name: row.model_color.trim() || null,
          product_model_id: Number(row.model_id || 0) || null,
          product_model_variant_id: Number(row.product_model_variant_id || 0) || null,
          original_model_name: row.model_replaced ? row.original_model_name || null : null,
          original_variant_name: row.model_replaced ? row.original_model_color || null : null,
          model_replaced: Boolean(row.model_replaced),
          photo_url: row.photo_url || null,
          locked_qty: lockedQty,
        }

        if (persistedRow) {
          updatesForPersistedRows.push({
            id: persistedRow.id,
            ...basePayload,
            status: persistedRow.status,
            finished_at: persistedRow.finished_at,
            started_at: persistedRow.started_at,
            paused_at: persistedRow.paused_at,
            pause_reason: persistedRow.pause_reason,
          })
          return
        }

        insertPayload.push({
          ...basePayload,
          is_confirmed: true,
          status: 'queued',
        })
      })
    })

    if (blockingError) {
      setError(blockingError)
      setSaving(false)
      return
    }

    let insertedRows = []
    if (insertPayload.length) {
      const insertResponse = await supabase
        .from('qc_items')
        .insert(insertPayload)
        .select('*')

      if (insertResponse.error) {
        setError(insertResponse.error.message)
        setSaving(false)
        return
      }

      insertedRows = (insertResponse.data || []).map(normalizeQcItemRow)
    }

    const updatedRows = []
    for (const row of updatesForPersistedRows) {
      const { data: updatedRow, error: updateError } = await supabase
        .from('qc_items')
        .update({
          inbound_id: row.inbound_id,
          inbound_unload_id: row.inbound_unload_id,
          assigned_to: row.assigned_to,
          allocated_qty: row.allocated_qty,
          expected_qty: row.expected_qty,
          qty_in: row.qty_in,
          model_name: row.model_name,
          variant_name: row.variant_name,
          product_model_id: row.product_model_id,
          product_model_variant_id: row.product_model_variant_id,
          original_model_name: row.original_model_name,
          original_variant_name: row.original_variant_name,
          model_replaced: row.model_replaced,
          photo_url: row.photo_url,
          locked_qty: row.locked_qty,
          status: row.status,
          finished_at: row.finished_at,
          started_at: row.started_at,
          paused_at: row.paused_at,
          pause_reason: row.pause_reason,
        })
        .eq('id', row.id)
        .select('*')
        .single()

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      updatedRows.push(normalizeQcItemRow(updatedRow))
    }

    const nextQcItems = [
      ...qcItems.filter((item) => !updatedRows.some((updated) => updated.id === item.id)),
      ...updatedRows,
      ...insertedRows,
    ]

    setQcItems(nextQcItems)
    resetRegularPlanner()
    setSuccess('QC plan saved.')
    setSaving(false)
  }

  if (loading) {
    return <p style={styles.emptyText}>Loading QC receiving setup...</p>
  }

  return (
    <div style={{ ...styles.wrapper, paddingBottom: isMobileLayout ? '20px' : 0 }}>
      <div style={shellCardStyle}>
        <div>
          <h2 style={styles.sectionTitle}>QC Receiving & Allocation</h2>
        </div>

        <div style={{ ...styles.modeRow, width: isMobileLayout ? '100%' : 'auto' }}>
          <button
            type="button"
            onClick={() => handleQcModeChange('regular')}
            style={{
              ...styles.modeButton,
              ...(qcMode === 'regular' ? styles.modeButtonActive : {}),
              ...(isMobileLayout ? { flex: 1 } : {}),
            }}
          >
            QC Reguler
          </button>
          <button
            type="button"
            onClick={() => handleQcModeChange('arkline')}
            style={{
              ...styles.modeButton,
              ...(qcMode === 'arkline' ? styles.modeButtonActive : {}),
              ...(isMobileLayout ? { flex: 1 } : {}),
            }}
          >
            QC Arkline
          </button>
          <button
            type="button"
            onClick={() => handleQcModeChange('re_qc')}
            style={{
              ...styles.modeButton,
              ...(qcMode === 're_qc' ? styles.modeButtonActive : {}),
              ...(isMobileLayout ? { flex: 1 } : {}),
            }}
          >
            Re-QC
          </button>
        </div>

        {qcMode === 'arkline' || qcMode === 're_qc' ? (
          <>
            {qcMode === 'arkline' ? (
              <>
                <div style={styles.field}>
                  <label style={styles.label}>QC Mode</label>
                </div>
                <div style={{ ...styles.modeRow, width: isMobileLayout ? '100%' : 'auto' }}>
                  <button
                    type="button"
                    onClick={() => handleArklinePlannerModeChange('product')}
                    style={{
                      ...styles.modeButton,
                      ...(arklinePlannerMode === 'product' ? styles.modeButtonActive : {}),
                      ...(isMobileLayout ? { flex: 1 } : {}),
                    }}
                  >
                    QC Product Based
                  </button>

                  <button
                    type="button"
                    onClick={() => handleArklinePlannerModeChange('po')}
                    style={{
                      ...styles.modeButton,
                      ...(arklinePlannerMode === 'po' ? styles.modeButtonActive : {}),
                      ...(isMobileLayout ? { flex: 1 } : {}),
                    }}
                  >
                    QC PO Based
                  </button>
                </div>
              </>
            ) : (
              <p style={styles.infoText}>Allocate only returned repair goods that are ready for another QC round.</p>
            )}

            {qcMode === 'arkline' && arklinePlannerMode === 'product' ? (
              <div style={arklineChoiceGridStyle}>
                <div style={styles.field}>
                  <label style={styles.label}>Product Category</label>
                  <select
                    value={selectedArklineCategory}
                    onChange={(event) => handleArklineCategoryChange(event.target.value)}
                    style={styles.select}
                  >
                    <option value="">{arklineProductCategories.length ? 'All categories' : 'No category found'}</option>
                    {arklineProductCategories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Product</label>
                  <div style={styles.comboBox}>
                    <input
                      value={arklineProductSearch}
                      onChange={(event) => handleArklineProductSearchChange(event.target.value)}
                      onFocus={() => setShowArklineProductOptions(true)}
                      onClick={handleArklineProductFieldClick}
                      style={styles.input}
                      placeholder={
                        arklineFilteredProducts.length
                          ? 'Type product name'
                          : arklineProducts.length
                            ? 'No product in this category'
                            : 'No Arkline product found'
                      }
                    />
                    {showArklineProductOptions && arklineFilteredProducts.length ? (
                      <div style={styles.comboList}>
                        {arklineFilteredProducts.map((item) => (
                          <button
                            key={`${item.id}-${getArklineProductLabel(item)}`}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault()
                              handleArklineProductChange(String(item.id))
                            }}
                            style={styles.comboOption}
                          >
                            <strong>{getArklineProductLabel(item)}</strong>
                            <span style={styles.comboOptionMeta}>
                              {item.category_name || 'NO CATEGORY'}
                              {item.parent_sku ? ` · ${item.parent_sku}` : ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span style={styles.helperText}>
                    {selectedArklineCategory ? `Filtered by ${selectedArklineCategory}` : 'Type nama_produk untuk memilih produk.'}
                  </span>
                </div>
              </div>
            ) : (
              <div style={arklineChoiceGridStyle}>
                <div style={styles.field}>
                  <label style={styles.label}>PO</label>
                  <select value={selectedArklinePoId} onChange={(event) => handleArklinePoChange(event.target.value)} style={styles.select}>
                    <option value="">
                      {visibleArklinePoOptions.length
                        ? 'Choose PO'
                        : qcMode === 're_qc'
                          ? 'No returned goods ready for Re-QC'
                          : 'No Arkline PO found'}
                    </option>
                    {visibleArklinePoOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.po_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Product in PO</label>
                  <select
                    value={selectedArklinePoItemKey}
                    onChange={(event) => handleArklinePoItemChange(event.target.value)}
                    style={{ ...styles.select, ...(!selectedArklinePoId ? styles.selectDisabled : {}) }}
                    disabled={!selectedArklinePoId}
                  >
                    <option value="">{selectedArklinePoId ? 'Choose product in PO' : 'Choose PO first'}</option>
                    {arklinePoItemOptions.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name}
                      </option>
                    ))}
                  </select>
                </div>

                {qcMode === 're_qc' && selectedArklinePoItem ? (
                  <div style={styles.field}>
                    <label style={styles.label}>Returned Goods Source</label>
                    <select
                      value={selectedArklineReworkSourceId}
                      onChange={(event) => handleArklineQcSourceChange(event.target.value)}
                      style={styles.select}
                    >
                      <option value="">Choose returned-goods receipt</option>
                      {arklineReworkSources.map((source) => (
                        <option key={source.id} value={source.id} disabled={source.editableQty <= 0}>
                          Re-QC Round {source.roundNumber} - {source.returnNumber} - {source.editableQty} qty available
                        </option>
                      ))}
                    </select>
                    <span style={styles.helperText}>
                      Each receipt remains linked to its return batch and Re-QC round.
                    </span>
                  </div>
                ) : null}
              </div>
            )}

            {qcMode === 're_qc' && selectedArklineReworkSource ? (
              <div style={arklineSummaryGridStyle}>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Returned Qty</span>
                  <strong style={styles.summaryValue}>{selectedArklineReworkSource.totalQty}</strong>
                </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Allocated</span>
                  <strong style={styles.summaryValue}>
                    {selectedArklineReworkSource.totalQty - selectedArklineReworkSource.pendingQty}
                  </strong>
                </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Remaining</span>
                  <strong style={styles.summaryValue}>{selectedArklineReworkSource.pendingQty}</strong>
                </div>
              </div>
            ) : null}

            {modelRows.length ? (
              <>
                {modelRows.map((row) => (
                  <div key={row.id} style={styles.modelRow}>
                    <div style={arklineRowTopGridStyle}>
                      <div style={styles.modelMeta}>
                        <div style={styles.modelName}>{row.model_name || 'Choose product'}</div>
                        <p style={styles.infoText}>{row.model_color || 'ARKLINE PRODUCT'}</p>
                      </div>

                    </div>

                    {canAdjustAllocations ? (
                    <div style={{ ...styles.field, ...styles.allocationWrap }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <label style={styles.label}>Allocation</label>
                        <button
                          type="button"
                          onClick={() => toggleAllocationRow(row.id)}
                          style={styles.secondaryButton}
                        >
                          {isAllocationRowOpen(row) ? 'Hide Allocation' : 'Allocate'}
                        </button>
                      </div>
                      {isAllocationRowOpen(row) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {getVisibleStartedAllocations(row).length ? (
                          <>
                            <span style={{ ...styles.helperText, fontWeight: '700', color: '#6b7280' }}>Started Batch</span>
                            <div style={{ ...allocationGridStyle, gap: '8px' }}>
                              <span style={{ ...styles.helperText, fontWeight: '700', color: '#111827' }}>Inspector</span>
                              <span style={{ ...styles.helperText, fontWeight: '700', color: '#111827' }}>Qty</span>
                              <span style={{ ...styles.helperText, fontWeight: '700', color: '#111827' }}>Status</span>
                            </div>
                            {getVisibleStartedAllocations(row).map((split) => (
                              <div key={split.id} style={allocationGridStyle}>
                                <div style={{ ...styles.readonlyBox, minHeight: '32px', fontSize: '11px', padding: '0 8px' }}>
                                  {qcMembers.find((member) => member.email === split.member_email)?.display_name || split.member_email || '-'}
                                </div>
                                <div style={{ ...styles.readonlyBox, minHeight: '32px', fontSize: '11px', padding: '0 8px' }}>{split.qty || 0}</div>
                                <div style={{ ...styles.readonlyBox, minHeight: '32px', fontSize: '11px', padding: '0 8px' }}>{split.existing_status || '-'}</div>
                              </div>
                            ))}
                          </>
                        ) : null}

                        <span style={{ ...styles.helperText, fontWeight: '700', color: '#6b7280' }}>New / Queued Batch</span>
                        {getVisibleAllocations(row).length ? (
                          <div style={{ ...allocationGridStyle, gap: '8px' }}>
                            <span style={{ ...styles.helperText, fontWeight: '700', color: '#111827' }}>Inspector</span>
                            <span style={{ ...styles.helperText, fontWeight: '700', color: '#111827' }}>Qty</span>
                            <span style={{ ...styles.helperText, fontWeight: '700', color: '#111827' }}>Action</span>
                          </div>
                        ) : null}
                        {getVisibleAllocations(row).map((split) => (
                          <div key={split.id} style={allocationGridStyle}>
                            <select
                              value={split.member_email || ''}
                              onChange={(event) => updateAllocationSplit(row.id, split.id, { member_email: event.target.value })}
                              style={{
                                ...styles.select,
                                ...styles.compactAllocationSelect,
                                ...(!canEditAllocationMember(split) ? styles.selectDisabled : {}),
                              }}
                              disabled={!canEditAllocationMember(split)}
                            >
                              <option value="">Choose inspector</option>
                              {qcMembers.map((member) => (
                                <option key={member.id} value={member.email}>
                                  {member.display_name || member.email}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min="0"
                              value={split.qty || ''}
                              onFocus={(event) => {
                                event.target.select()
                              }}
                              onChange={(event) => updateAllocationSplit(row.id, split.id, { qty: event.target.value })}
                              onBlur={(event) => {
                                const otherTotal = (row.allocations || [])
                                  .filter((item) => item.id !== split.id)
                                  .reduce((sum, item) => sum + Number(item.qty || 0), 0)
                                const startedTotal = getStartedAllocationTotal(row)
                                const minAllowed = Number(split.locked_qty || 0)
                                const rowQcIn = Number(row.qty_qc || 0)
                                const maxAllowed = rowQcIn > 0 ? Math.max(minAllowed, rowQcIn - startedTotal - otherTotal) : null
                                const rawValue = event.target.value

                                if (rawValue === '') {
                                  updateAllocationSplit(row.id, split.id, {
                                    qty: minAllowed > 0 ? String(minAllowed) : '',
                                  })
                                  return
                                }

                                const nextValue = Number(rawValue || 0)
                                updateAllocationSplit(row.id, split.id, {
                                  qty: String(Math.max(minAllowed, maxAllowed === null ? nextValue : Math.min(nextValue, maxAllowed))),
                                })
                              }}
                              style={{
                                ...styles.input,
                                ...styles.compactAllocationInput,
                                ...(!canEditAllocationQty(split) ? styles.inputDisabled : {}),
                              }}
                              disabled={!canEditAllocationQty(split)}
                              placeholder="Qty"
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: isMobileLayout ? 'flex-start' : 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => addAllocationSplit(row.id)}
                                style={{ ...styles.iconButton, ...(!canAdjustAllocations ? styles.iconButtonDisabled : {}) }}
                                disabled={!canAdjustAllocations}
                                title="Add allocation row"
                                aria-label="Add allocation row"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                onClick={() => removeAllocationSplit(row.id, split.id)}
                                style={{
                                  ...styles.iconButton,
                                  ...(!canRemoveAllocationSplit(split) ? styles.iconButtonDisabled : {}),
                                }}
                                disabled={!canRemoveAllocationSplit(split)}
                                title="Remove allocation row"
                                aria-label="Remove allocation row"
                              >
                                X
                              </button>
                            </div>
                          </div>
                        ))}

                        <span style={styles.helperText}>
                          {`Allocated: ${getAllocationTotalForRow(row)}${Number(row.qty_qc || 0) > 0 ? ` / ${Number(row.qty_qc || 0)}` : ''}`}
                        </span>
                      </div>
                      ) : null}
                    </div>
                    ) : null}
                  </div>
                ))}

              </>
            ) : (
              <p style={styles.emptyText}>
                {arklinePlannerMode === 'product'
                  ? 'Choose Arkline product first to start QC planning.'
                  : 'Choose PO and product in that PO first to start QC planning.'}
              </p>
            )}
          </>
        ) : (
        <>
        <div style={plannerGridStyle}>
          <div style={styles.field}>
            <label style={styles.label}>GRN Number</label>
            <input
              list="qc-receiving-grn-options"
              value={grnSearch}
              onChange={(event) => handleGrnChange(event.target.value)}
              style={styles.input}
              placeholder="Type or choose GRN Number"
            />
            <datalist id="qc-receiving-grn-options">
              {inbounds.map((item) => (
                <option key={item.id} value={item.grn_number} />
              ))}
            </datalist>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Koli / Sample</label>
              <select
                value={selectedSourceKey}
                onChange={(event) => handleSourceChange(event.target.value)}
                style={{ ...styles.select, ...(!selectedInboundId ? styles.selectDisabled : {}) }}
                disabled={!selectedInboundId}
              >
                <option value="">
                  {sourceLoading ? 'Loading Koli / Sample...' : selectedInboundId ? 'Choose Koli / Sample' : 'Choose GRN first'}
                </option>
                {sourceOptions.map((row) => (
                  <option
                    key={row.key}
                    value={row.key}
                    style={
                      getSourceStatus(row, qcItems) === 'completed'
                        ? { color: '#166534', backgroundColor: '#f0fdf4', fontWeight: '700' }
                        : undefined
                    }
                  >
                    {getSourceStatus(row, qcItems) === 'completed' ? `DONE - ${row.label}` : row.label}
                  </option>
                ))}
              </select>
          </div>

        </div>

        {selectedInboundId && sourceLoading ? (
          <p style={styles.helperText}>Loading Koli / Sample...</p>
        ) : null}

        {selectedInboundId && sourceOptions.length ? (
            <div style={styles.sourceListWrap}>
              <div
                ref={sourceListRef}
                style={styles.sourceList}
                onScroll={(event) => {
                  const element = event.currentTarget
                  const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth)
                  const nextState = {
                    hasOverflow: maxScrollLeft > 1,
                    canScrollLeft: element.scrollLeft > 1,
                    canScrollRight: element.scrollLeft < maxScrollLeft - 1,
                  }
                  setSourceScrollState((current) =>
                    current.hasOverflow === nextState.hasOverflow &&
                    current.canScrollLeft === nextState.canScrollLeft &&
                    current.canScrollRight === nextState.canScrollRight
                      ? current
                      : nextState
                  )
                }}
              >
                {sourceOptions.map((row) => {
                  const rowStatus = getSourceStatus(row, qcItems)
                  const isActive = row.key === selectedSourceKey

                  return (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => handleSourceChange(row.key)}
                      style={{
                        ...styles.sourceChip,
                        ...(!selectedInboundId ? styles.sourceChipDisabled : {}),
                        ...(rowStatus === 'completed' ? styles.sourceChipDone : {}),
                        ...(isActive ? (rowStatus === 'completed' ? styles.sourceChipDoneActive : styles.sourceChipActive) : {}),
                      }}
                      disabled={!selectedInboundId}
                    >
                      {row.label}
                    </button>
                  )
                })}
              </div>
              {sourceScrollState.hasOverflow && sourceScrollState.canScrollLeft ? (
                <span style={{ ...styles.sourceListArrow, ...styles.sourceListArrowLeft }}>‹</span>
              ) : null}
              {sourceScrollState.hasOverflow && sourceScrollState.canScrollRight ? (
                <span style={{ ...styles.sourceListArrow, ...styles.sourceListArrowRight }}>›</span>
              ) : null}
            </div>
        ) : null}

        {selectedSource ? (
          <>
            {isSelectedSourceCompleted ? (
              <div style={styles.sourceStatusBanner}>
                <span>KOLI SUDAH SELESAI DIQC</span>
                <button
                  type="button"
                  onClick={() => setSourceDetailsExpanded((prev) => !prev)}
                  style={styles.secondaryButton}
                >
                  {sourceDetailsExpanded ? 'Collapse Detail' : 'Expand Detail'}
                </button>
              </div>
            ) : null}

            {sourceDetailsExpanded ? modelRows.map((row, rowIndex) => {
              const canRemoveThisRow =
                rowIndex > 0 &&
                canEditSavedPlan &&
                !(row.allocations || []).some((split) => Number(split.locked_qty || 0) > 0)

              return (
              <div key={row.id} style={styles.modelRow}>
                <div style={styles.modelRowActions}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModelRowId(row.id)
                      setModelSearch('')
                      setShowChooseModelModal(true)
                    }}
                    style={{ ...styles.iconButton, ...(!canEditSavedPlan ? styles.iconButtonDisabled : {}) }}
                    disabled={!canEditSavedPlan}
                    title="Replace model"
                    aria-label="Replace model"
                  >
                    ↔
                  </button>
                  {rowIndex > 0 ? (
                    <button
                      type="button"
                      onClick={() => removeModelRow(row.id)}
                      style={{
                        ...styles.iconButton,
                        ...(!canRemoveThisRow ? styles.iconButtonDisabled : {}),
                      }}
                      disabled={!canRemoveThisRow}
                      title="Remove row"
                      aria-label="Remove row"
                    >
                      x
                    </button>
                  ) : null}
                </div>
                <div style={rowTopGridStyle}>
                {row.photo_url ? (
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto({ src: row.photo_url, alt: row.model_name || 'QC model' })}
                    style={styles.thumbButton}
                    title="Preview photo"
                    aria-label="Preview photo"
                  >
                    <Image
                      src={row.photo_url}
                      alt={row.model_name || 'QC model'}
                      width={84}
                      height={84}
                      unoptimized
                      style={styles.thumb}
                    />
                  </button>
                ) : (
                  <div style={styles.thumbEmpty}>NO PHOTO</div>
                )}

                <div style={{ ...styles.modelMeta, ...(isMobileLayout ? { gridColumn: '2 / -1' } : {}) }}>
                  <div style={styles.modelName}>{getRegularProductIdentityLabel(row)}</div>
                  <div style={styles.modelVariantLine}>{getRegularModelName(row)}</div>
                  <span style={styles.variantBadge}>{getRegularVariantName(row)}</span>
                  {row.model_replaced ? (
                    <p style={styles.infoText}>This one is replacement goods.</p>
                  ) : null}
                </div>

                <div style={{ ...styles.qtyPair, ...(isMobileLayout ? { gridColumn: '1 / -1' } : {}) }}>
                  <div style={styles.field}>
                    <label style={styles.label}>Inbound Qty</label>
                    <div style={styles.readonlyBox}>{row.qty_in || 0}</div>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>QC In</label>
                    <input
                      type="number"
                      min="0"
                      value={row.qty_qc}
                      onChange={(event) =>
                        updateModelRow(row.id, {
                          qty_qc: event.target.value,
                        })
                      }
                      style={{ ...styles.input, ...(!canEditSavedPlan ? styles.inputDisabled : {}) }}
                      disabled={!canEditSavedPlan}
                    />
                  </div>
                </div>

                </div>

                {canAdjustAllocations ? (
                <div style={{ ...styles.field, ...styles.allocationWrap }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <label style={styles.label}>Allocation</label>
                    <button
                      type="button"
                      onClick={() => toggleAllocationRow(row.id)}
                      style={styles.secondaryButton}
                    >
                      {isAllocationRowOpen(row) ? 'Hide Allocation' : 'Allocate'}
                    </button>
                  </div>
                  {isAllocationRowOpen(row) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {getVisibleStartedAllocations(row).length ? (
                      <>
                        <span style={{ ...styles.helperText, fontWeight: '700', color: '#6b7280' }}>Started Batch</span>
                        <div style={{ ...allocationGridStyle, gap: '8px' }}>
                          <span style={{ ...styles.helperText, fontWeight: '700', color: '#111827' }}>Inspector</span>
                          <span style={{ ...styles.helperText, fontWeight: '700', color: '#111827' }}>Qty</span>
                          <span style={{ ...styles.helperText, fontWeight: '700', color: '#111827' }}>Status</span>
                        </div>
                        {getVisibleStartedAllocations(row).map((split) => (
                          <div key={split.id} style={allocationGridStyle}>
                            <div style={{ ...styles.readonlyBox, minHeight: '32px', fontSize: '11px', padding: '0 8px' }}>
                              {qcMembers.find((member) => member.email === split.member_email)?.display_name || split.member_email || '-'}
                            </div>
                            <div style={{ ...styles.readonlyBox, minHeight: '32px', fontSize: '11px', padding: '0 8px' }}>{split.qty || 0}</div>
                            <div style={{ ...styles.readonlyBox, minHeight: '32px', fontSize: '11px', padding: '0 8px' }}>{split.existing_status || '-'}</div>
                          </div>
                        ))}
                      </>
                    ) : null}

                    <span style={{ ...styles.helperText, fontWeight: '700', color: '#6b7280' }}>New / Queued Batch</span>
                    {getVisibleAllocations(row).length ? (
                      <div style={{ ...allocationGridStyle, gap: '8px' }}>
                        <span style={{ ...styles.helperText, fontWeight: '700', color: '#111827' }}>Inspector</span>
                        <span style={{ ...styles.helperText, fontWeight: '700', color: '#111827' }}>Qty</span>
                        <span style={{ ...styles.helperText, fontWeight: '700', color: '#111827' }}>Action</span>
                      </div>
                    ) : null}
                    {getVisibleAllocations(row).map((split) => (
                      <div key={split.id} style={allocationGridStyle}>
                        <select
                          value={split.member_email || ''}
                          onChange={(event) => updateAllocationSplit(row.id, split.id, { member_email: event.target.value })}
                          style={{
                            ...styles.select,
                            ...(!canEditAllocationMember(split) ? styles.selectDisabled : {}),
                          }}
                          disabled={!canEditAllocationMember(split)}
                        >
                          <option value="">Choose inspector</option>
                          {qcMembers
                            .map((member) => (
                              <option key={member.id} value={member.email}>
                                {member.display_name || member.email}
                              </option>
                            ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          value={split.qty || ''}
                          onFocus={(event) => {
                            event.target.select()
                          }}
                          onChange={(event) =>
                            updateAllocationSplit(row.id, split.id, {
                              qty: event.target.value,
                            })
                          }
                          onBlur={(event) => {
                            const otherTotal = (row.allocations || [])
                              .filter((item) => item.id !== split.id)
                              .reduce((sum, item) => sum + Number(item.qty || 0), 0)
                            const startedTotal = getStartedAllocationTotal(row)
                            const minAllowed = Number(split.locked_qty || 0)
                            const maxAllowed = Math.max(minAllowed, Number(row.qty_qc || 0) - startedTotal - otherTotal)
                            const rawValue = event.target.value

                            if (rawValue === '') {
                              updateAllocationSplit(row.id, split.id, {
                                qty: minAllowed > 0 ? String(minAllowed) : '',
                              })
                              return
                            }

                            const nextValue = Number(rawValue || 0)
                            updateAllocationSplit(row.id, split.id, {
                              qty: String(Math.max(minAllowed, Math.min(nextValue, maxAllowed))),
                            })
                          }}
                          style={{
                            ...styles.input,
                            ...(!canEditAllocationQty(split) ? styles.inputDisabled : {}),
                          }}
                          disabled={!canEditAllocationQty(split)}
                          placeholder="Qty"
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: isMobileLayout ? 'flex-start' : 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => addAllocationSplit(row.id)}
                            style={{ ...styles.iconButton, ...(!canAdjustAllocations ? styles.iconButtonDisabled : {}) }}
                            disabled={!canAdjustAllocations}
                            title="Add allocation row"
                            aria-label="Add allocation row"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAllocationSplit(row.id, split.id)}
                            style={{
                              ...styles.iconButton,
                              ...(!canRemoveAllocationSplit(split) ? styles.iconButtonDisabled : {}),
                            }}
                            disabled={!canRemoveAllocationSplit(split)}
                            title="Remove allocation row"
                            aria-label="Remove allocation row"
                          >
                            X
                          </button>
                        </div>
                      </div>
                    ))}
                    {!getVisibleAllocations(row).length ? (
                      <button
                        type="button"
                        onClick={() => addAllocationSplit(row.id)}
                        style={{ ...styles.secondaryButton, ...(!canAdjustAllocations ? styles.buttonDisabled : {}) }}
                        disabled={!canAdjustAllocations}
                      >
                        +
                      </button>
                    ) : null}
                    <span style={styles.helperText}>
                      Allocated: {getAllocationTotalForRow(row)} / {Number(row.qty_qc || 0)}
                    </span>
                  </div>
                  ) : null}
                </div>
                ) : null}
              </div>
              )
            }) : null}

            {sourceDetailsExpanded && !isSelectedSourceCompleted ? (
              <div style={styles.buttonRow}>
                <button
                  type="button"
                  onClick={addModelRow}
                  style={{ ...styles.secondaryButton, ...(!canEditSavedPlan ? styles.buttonDisabled : {}) }}
                  disabled={!canEditSavedPlan}
                >
                  +
                </button>
              </div>
            ) : null}

            </>
          ) : (
            <p style={styles.emptyText}>Choose GRN and Koli/Sample first to start QC planning.</p>
          )}
        </>
        )}

        <div style={bottomBarStyle}>
          {error ? <p style={styles.errorText}>{error}</p> : null}
          {success ? <p style={styles.successText}>{success}</p> : null}
          {!isSelectedSourceCompleted ? (
            <button
              type="button"
              onClick={handleSavePlan}
              disabled={saving || (qcMode !== 'regular' ? !modelRows.length : !selectedSource)}
              style={{
                ...styles.primaryButton,
                ...(isMobileLayout ? { width: '100%' } : {}),
                ...(saving || (qcMode !== 'regular' ? !modelRows.length : !selectedSource) ? styles.buttonDisabled : {}),
              }}
            >
              {saving ? 'Saving...' : 'Save QC Plan'}
            </button>
          ) : null}
        </div>
      </div>

      {showChooseModelModal ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div>
              <h2 style={styles.sectionTitle}>Choose Model</h2>
              <p style={styles.sectionSubtitle}>Select a model listed under the same GRN number.</p>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Search Model</label>
              <input
                value={modelSearch}
                onChange={(event) => setModelSearch(event.target.value)}
                style={styles.input}
                placeholder="Type model name"
              />
            </div>

            <div style={styles.modalGrid}>
              {modelOptions.length ? modelOptions.map((item) => {
                const label = item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name

                return (
                  <div
                    key={item.option_id || item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleChooseModel(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleChooseModel(item)
                      }
                    }}
                    style={styles.modelCardButton}
                  >
                    {item.photo_url ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation()
                          setPreviewPhoto({ src: item.photo_url, alt: label })
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            event.stopPropagation()
                            setPreviewPhoto({ src: item.photo_url, alt: label })
                          }
                        }}
                        style={{ display: 'block', width: '100%', cursor: 'zoom-in' }}
                      >
                        <Image
                          src={item.photo_url}
                          alt={label}
                          width={150}
                          height={76}
                          unoptimized
                          style={{ ...styles.thumb, width: '100%', height: '76px', borderRadius: '10px' }}
                        />
                      </span>
                    ) : (
                      <div style={{ ...styles.thumbEmpty, width: '100%', height: '76px', borderRadius: '10px' }}>NO PHOTO</div>
                    )}
                    <strong>{getRegularProductIdentityLabel(item)}</strong>
                    <span>{label}</span>
                  </div>
                )
              }) : (
                <p style={styles.emptyText}>No matching model found for this GRN.</p>
              )}
            </div>

            <div style={styles.buttonRow}>
              <button type="button" onClick={handleCloseChooseModelModal} style={styles.secondaryButton}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewPhoto ? (
        <div
          style={styles.photoPreviewOverlay}
          onClick={() => setPreviewPhoto(null)}
          role="presentation"
        >
          <div style={styles.photoPreviewWrap} onClick={(event) => event.stopPropagation()} role="presentation">
            <Image
              src={previewPhoto.src}
              alt={previewPhoto.alt || 'Product photo'}
              width={1000}
              height={1000}
              unoptimized
              style={styles.photoPreviewImage}
            />
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              style={styles.photoPreviewClose}
              aria-label="Close preview"
              title="Close preview"
            >
              x
            </button>
          </div>
        </div>
      ) : null}

      {showModelModal ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div>
              <h2 style={styles.sectionTitle}>Add New Model</h2>
              <p style={styles.sectionSubtitle}>Save a missing model from QC.</p>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Nama Model</label>
              <input
                value={modelDraft.model_name}
                onChange={(event) =>
                  setModelDraft((prev) => ({
                    ...prev,
                    model_name: event.target.value.toUpperCase(),
                  }))
                }
                style={styles.input}
                placeholder="MODEL NAME"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Variant</label>
              <input
                value={modelDraft.model_color}
                onChange={(event) =>
                  setModelDraft((prev) => ({
                    ...prev,
                    model_color: event.target.value.toUpperCase(),
                  }))
                }
                style={styles.input}
                placeholder="VARIANT"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Foto Produk</label>
              <input type="file" accept="image/*" capture="environment" onChange={handleModelPhotoChange} style={styles.input} />
            </div>

            {modelModalError ? <p style={styles.errorText}>{modelModalError}</p> : null}

            <div style={styles.buttonRow}>
              <button type="button" onClick={() => setShowModelModal(false)} style={styles.secondaryButton}>
                Cancel
              </button>
              <button type="button" onClick={handleSaveModel} style={styles.primaryButton}>
                Save Model
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
