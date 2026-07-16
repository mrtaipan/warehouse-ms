'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import { ADMIN_EMAIL, resolveRole } from '@/utils/permissions'

const supabase = createClient()
const PRODUCT_PHOTOS_BUCKET = 'product-photos'

function formatDateDisplay(value) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function buildCategoryMaps(categories) {
  const byId = new Map(categories.map((item) => [item.id, item]))
  const rootOptions = []
  const childMap = new Map()

  for (const category of categories) {
    if (!category.parent_id) {
      rootOptions.push(category)
      continue
    }

    if (!childMap.has(category.parent_id)) {
      childMap.set(category.parent_id, [])
    }

    childMap.get(category.parent_id).push(category)
  }

  const sortByCode = (items) =>
    [...items].sort((a, b) =>
      (a.full_code || a.category_code || '').localeCompare(b.full_code || b.category_code || '')
    )

  return {
    byId,
    roots: sortByCode(rootOptions),
    getChildren(parentId) {
      return sortByCode(childMap.get(parentId) || [])
    },
  }
}

function getVariantProductId(variant) {
  return String(variant?.variant_code || variant?.variant_label || '').trim()
}

function getVariantDisplayName(variant) {
  return String(variant?.variant_name || variant?.variant_label || variant?.variant_code || 'Variant').trim()
}

function normalizeVariantLookupValue(value) {
  return String(value ?? '').trim().toLowerCase()
}

function getVariantLookupValues(variant) {
  return [variant?.variant_code, variant?.variant_label, variant?.variant_name]
    .map((value) => normalizeVariantLookupValue(value))
    .filter(Boolean)
}

function getRowVariantIdentifier(row) {
  return row?.variant_code || row?.variant_label || row?.variant_name || ''
}

function getNextVariantCode(model, variants) {
  const prefix = `${model?.model_code || `MODEL${model?.id || ''}`}`
  const nextNumber =
    variants.reduce((max, variant) => {
      const code = String(variant.variant_code || variant.variant_label || '')
      const match = code.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`, 'i'))
      return match ? Math.max(max, Number(match[1] || 0)) : max
    }, 0) + 1

  if (nextNumber > 999) {
    throw new Error(`Variant code sequence for ${prefix} already reached 999. Please review the variant registry before adding more variants.`)
  }

  return `${prefix}-${String(nextNumber).padStart(3, '0')}`
}

function getBrandDisplayLabel(brand) {
  if (!brand) return ''
  return `${brand.brand_name || '-'}${brand.brand_code ? ` (${brand.brand_code})` : ''}`
}

function getCategoryDisplayLabel(category) {
  return category?.full_name || category?.category_name || '-'
}

function getSafeStorageSegment(value, fallback = 'item') {
  return (
    String(value || fallback)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  )
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.readAsDataURL(file)
  })
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image for compression.'))
    image.src = url
  })
}

async function compressImageFile(file) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImageFromUrl(objectUrl)
    const maxSize = 1280
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Image compression is not available in this browser.')
    }

    context.drawImage(image, 0, 0, width, height)

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.78)
    })

    if (!blob) {
      throw new Error('Failed to compress image.')
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'variant-photo'
    const compressedFile = new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
    const dataUrl = await readFileAsDataUrl(compressedFile)

    return { file: compressedFile, dataUrl }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function createModelDraft() {
  return {
    model_id: '',
    model_name: '',
    model_notes: '',
    is_new_model: false,
    variant_name: '',
    variant_notes: '',
    variant_photo_url: '',
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

function getDisplayName(user, profile) {
  return (
    String(profile?.display_name || '').trim() ||
    String(user?.user_metadata?.display_name || '').trim() ||
    String(user?.user_metadata?.full_name || '').trim() ||
    String(user?.user_metadata?.name || '').trim() ||
    String(user?.email || '').split('@')[0] ||
    'Inbound Staff'
  )
}

function getFirstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '-'
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  )
}

function BuilderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 4h8" />
      <path d="M9 2h6l1 3H8z" />
      <path d="M6 5h12a2 2 0 0 1 2 2v13H4V7a2 2 0 0 1 2-2z" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  )
}

function PerformanceIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="m7 15 3-4 4 3 4-7" />
      <path d="M18 7h-4" />
      <path d="M18 7v4" />
    </svg>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  mobileWrapper: {
    minHeight: '100dvh',
    width: '100%',
    maxWidth: '520px',
    margin: '0 auto',
    background: '#fff',
    color: '#111827',
    colorScheme: 'light',
    borderLeft: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  mobileTopBar: {
    minHeight: '80px',
    display: 'grid',
    gridTemplateColumns: '48px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 24px',
    borderBottom: '1px solid #e5e7eb',
    background: '#fff',
  },
  mobileInfoBand: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 0.85fr) minmax(0, 0.85fr) minmax(0, 1fr)',
    gap: '8px',
    padding: '14px 16px',
    background: '#fafafa',
    borderBottom: '1px solid #e5e7eb',
  },
  mobileDetailBand: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
    gap: '10px',
    padding: '14px 24px',
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
  },
  mobileInfoBox: {
    minWidth: 0,
  },
  mobileInfoRight: {
    minWidth: 0,
    textAlign: 'right',
  },
  mobileInfoMetric: {
    minWidth: 0,
    textAlign: 'left',
  },
  mobileInfoLabel: {
    display: 'block',
    color: '#71717a',
    fontSize: '12px',
    fontWeight: '850',
    letterSpacing: 0,
  },
  mobileInfoValue: {
    display: 'block',
    marginTop: '4px',
    color: '#18181b',
    fontSize: '15px',
    fontWeight: '900',
    lineHeight: 1.25,
    wordBreak: 'break-word',
    fontVariantNumeric: 'tabular-nums',
  },
  mobileInfoLabelTight: {
    fontSize: '10px',
    whiteSpace: 'nowrap',
  },
  mobileInfoValueTight: {
    fontSize: '13px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    wordBreak: 'normal',
  },
  mobileRemainingNegative: {
    color: '#dc2626',
  },
  mobileRemainingZero: {
    color: '#16a34a',
  },
  mobileRemainingPositive: {
    color: '#f97316',
  },
  mobileInlineMessage: {
    margin: '0 24px',
  },
  backButton: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#111827',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
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
    color: '#0f172a',
    fontSize: '28px',
    fontWeight: '900',
    lineHeight: 1.05,
    letterSpacing: 0,
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#6b7280',
  },
  overviewPanel: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  eyebrow: {
    margin: 0,
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  formTopBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  overviewActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '16px',
    alignItems: 'start',
  },
  headerColumn: {
    minWidth: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
    gap: '12px',
    alignItems: 'stretch',
  },
  breakdownColumn: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  grnCard: {
    border: '1px solid #cbd5e1',
    borderRadius: '14px',
    padding: '14px 16px',
    background: '#f8fafc',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.9)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  grnLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: '6px',
  },
  grnValue: {
    display: 'block',
    color: '#0f172a',
    fontSize: '28px',
    fontWeight: '900',
    lineHeight: 1.05,
    fontVariantNumeric: 'tabular-nums',
    wordBreak: 'break-word',
  },
  grnItemBlock: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e2e8f0',
  },
  headerInfoColumn: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
    gap: '10px',
  },
  grnChip: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '34px',
    padding: '0 12px',
    borderRadius: '999px',
    background: '#eef6ff',
    color: '#1e3a8a',
    fontSize: '14px',
    fontWeight: '900',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  infoBox: {
    minHeight: '52px',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#f8fafc',
  },
  infoLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  infoValue: {
    display: 'block',
    marginTop: '4px',
    color: '#0f172a',
    fontSize: '14px',
    fontWeight: '800',
    lineHeight: 1.25,
    wordBreak: 'break-word',
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '10px',
  },
  metricBox: {
    minWidth: 0,
    minHeight: '52px',
    padding: '10px 12px',
    border: '1px solid #dbeafe',
    borderRadius: '10px',
    background: '#eff6ff',
  },
  metricValue: {
    display: 'block',
    marginTop: '4px',
    color: '#0f172a',
    fontSize: '16px',
    fontWeight: '900',
    lineHeight: 1.15,
    fontVariantNumeric: 'tabular-nums',
    wordBreak: 'break-word',
  },
  segmentWrap: {
    display: 'inline-flex',
    alignSelf: 'flex-start',
    padding: '4px',
    gap: '4px',
    borderRadius: '12px',
    background: '#f1f5f9',
    border: '1px solid #e2e8f0',
  },
  segmentButton: {
    height: '32px',
    padding: '0 14px',
    border: 'none',
    borderRadius: '9px',
    background: 'transparent',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '850',
    cursor: 'pointer',
  },
  segmentButtonActive: {
    background: '#fff',
    color: '#0f172a',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
  },
  breakdownToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  breakdownFilters: {
    display: 'grid',
    gridTemplateColumns: 'minmax(150px, 1.2fr) minmax(260px, 1.55fr) minmax(170px, 1.3fr) minmax(190px, 1fr) 34px',
    gap: '8px',
    alignItems: 'center',
    flex: '1 1 720px',
    minWidth: 0,
  },
  filterSelect: {
    width: '100%',
    minWidth: 0,
    height: '34px',
    padding: '0 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '12px',
    fontWeight: '750',
    outline: 'none',
  },
  qtyFilterGroup: {
    display: 'grid',
    gridTemplateColumns: 'minmax(126px, 1fr) 56px',
    gap: '6px',
    minWidth: 0,
  },
  filterNumberInput: {
    width: '100%',
    minWidth: 0,
    height: '34px',
    padding: '0 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '12px',
    fontWeight: '800',
    fontVariantNumeric: 'tabular-nums',
    outline: 'none',
  },
  filterNumberInputDisabled: {
    background: '#f8fafc',
    color: '#94a3b8',
    cursor: 'not-allowed',
  },
  resetFilterButton: {
    width: '34px',
    height: '34px',
    padding: 0,
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    background: '#fff',
    color: '#475569',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  resetFilterButtonDisabled: {
    opacity: 0.42,
    cursor: 'not-allowed',
  },
  modeSegmentWrap: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '6px',
    padding: '4px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    background: '#f1f5f9',
  },
  modeSegmentButton: {
    minWidth: 0,
    height: '38px',
    border: '1px solid transparent',
    borderRadius: '9px',
    background: 'transparent',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '850',
    cursor: 'pointer',
  },
  modeSegmentRegularActive: {
    border: '1px solid #99f6e4',
    background: '#ccfbf1',
    color: '#115e59',
  },
  modeSegmentSampleActive: {
    border: '1px solid #fed7aa',
    background: '#fff7ed',
    color: '#9a3412',
  },
  modeSegmentReturnActive: {
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#991b1b',
  },
  itemStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  itemLine: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: '10px',
    alignItems: 'center',
  },
  tableLineStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  tablePhotoLine: {
    minHeight: '48px',
    display: 'flex',
    alignItems: 'center',
  },
  tableDetailLine: {
    minHeight: '48px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '3px',
  },
  tableQtyLine: {
    minHeight: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemMeta: {
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '650',
    lineHeight: 1.35,
  },
  qtyPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '44px',
    height: '28px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#eef2ff',
    color: '#3730a3',
    fontSize: '12px',
    fontWeight: '900',
    fontVariantNumeric: 'tabular-nums',
  },
  qtyPillQcShort: {
    background: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #fecaca',
  },
  qtyPillQcOver: {
    background: '#ffedd5',
    color: '#9a3412',
    border: '1px solid #fed7aa',
  },
  performanceButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    minHeight: '40px',
    padding: '0 14px',
    border: '1px solid #bfdbfe',
    borderRadius: '10px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'pointer',
  },
  builderButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    minHeight: '40px',
    padding: '0 14px',
    border: 'none',
    borderRadius: '10px',
    background: '#0f766e',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(15, 118, 110, 0.16)',
  },
  iconOnlyButton: {
    width: '40px',
    minWidth: '40px',
    height: '40px',
    padding: 0,
    borderRadius: '10px',
  },
  closeIconButton: {
    width: '40px',
    minWidth: '40px',
    height: '40px',
    padding: 0,
    border: '1px solid #fecaca',
    borderRadius: '10px',
    background: '#fff',
    color: '#dc2626',
    fontSize: '15px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  closeIconGlyph: {
    color: '#dc2626',
    fontWeight: '950',
    lineHeight: 1,
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  helperBox: {
    padding: '14px 16px',
    borderRadius: '12px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    color: '#6b7280',
    fontSize: '14px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '20px',
  },
  sectionSubtitle: {
    margin: '4px 0 0',
    color: '#6b7280',
    fontSize: '14px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
    gap: '16px',
  },
  unloadWorkspace: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
    gap: '16px',
    alignItems: 'start',
  },
  workPanel: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    flexWrap: 'wrap',
  },
  panelEyebrow: {
    margin: 0,
    fontSize: '11px',
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  panelTitle: {
    margin: '4px 0 0',
    color: '#0f172a',
    fontSize: '18px',
    fontWeight: '800',
  },
  compactGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
    gap: '12px',
  },
  mobileSingleGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
  },
  addPanel: {
    background: '#fff',
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  addActionButton: {
    width: '100%',
    minHeight: '44px',
  },
  currentKoliPanel: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  modelActionRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inlineRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  modelPickerCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    background: '#f9fafb',
  },
  modelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '12px',
  },
  modelGroupList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  modelGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  modelGroupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '10px',
    padding: '0 2px',
  },
  modelGroupTitle: {
    color: '#0f172a',
    fontSize: '14px',
    fontWeight: '900',
  },
  modelGroupMeta: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: '750',
    textAlign: 'right',
    lineHeight: 1.3,
  },
  modelOptionCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #d1d5db',
    background: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
  },
  modelOptionActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginTop: '2px',
  },
  variantEditButton: {
    height: '30px',
    padding: '0 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '12px',
    fontWeight: '850',
    cursor: 'pointer',
  },
  selectedVariantBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    height: '24px',
    padding: '0 8px',
    borderRadius: '999px',
    background: '#dcfce7',
    color: '#166534',
    fontSize: '10px',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  tapHint: {
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: '750',
  },
  modelOptionTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#111827',
  },
  modelOptionMeta: {
    fontSize: '12px',
    color: '#6b7280',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
  },
  requiredMark: {
    color: '#dc2626',
    fontWeight: '900',
  },
  helperText: {
    fontSize: '12px',
    color: '#6b7280',
  },
  input: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    WebkitTextFillColor: '#111827',
    caretColor: '#111827',
    colorScheme: 'light',
    fontSize: '14px',
    width: '100%',
  },
  readOnlyInput: {
    background: '#f8fafc',
    color: '#64748b',
    WebkitTextFillColor: '#64748b',
    cursor: 'default',
  },
  qtyInput: {
    border: '1px solid #94a3b8',
    background: '#fff',
    color: '#0f172a',
    WebkitTextFillColor: '#0f172a',
    fontWeight: '800',
  },
  searchPicker: {
    position: 'relative',
  },
  searchResults: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    zIndex: 30,
    maxHeight: '220px',
    overflowY: 'auto',
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    background: '#fff',
    boxShadow: '0 16px 36px rgba(15, 23, 42, 0.14)',
    padding: '6px',
  },
  searchOption: {
    width: '100%',
    minHeight: '38px',
    padding: '8px 10px',
    border: 'none',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    textAlign: 'left',
  },
  searchOptionActive: {
    background: '#f1f5f9',
  },
  searchEmpty: {
    margin: 0,
    padding: '10px',
    color: '#64748b',
    fontSize: '13px',
  },
  select: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    background: '#fff',
    color: '#111827',
    WebkitTextFillColor: '#111827',
    colorScheme: 'light',
    width: '100%',
  },
  textarea: {
    minHeight: '96px',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    background: '#fff',
    color: '#111827',
    WebkitTextFillColor: '#111827',
    caretColor: '#111827',
    colorScheme: 'light',
    resize: 'vertical',
  },
  readonlyBox: {
    minHeight: '42px',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    background: '#f9fafb',
    fontSize: '14px',
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '42px',
    minWidth: '42px',
    height: '42px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  compactButton: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  photoChoiceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '8px',
  },
  photoChoiceButton: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  hiddenFileInput: {
    display: 'none',
  },
  registryFormGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
    gap: '16px',
    alignItems: 'start',
  },
  registryPhotoColumn: {
    position: 'relative',
    minWidth: 0,
  },
  registryPhotoFrame: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1 / 1',
    border: '1px dashed #94a3b8',
    borderRadius: '16px',
    background: '#f8fafc',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  },
  registryPhotoFrameError: {
    border: '1px dashed #dc2626',
    background: '#fff7f7',
  },
  registryPhotoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  registryPhotoEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    color: '#64748b',
    textAlign: 'center',
    padding: '18px',
  },
  registryPhotoEmptyTitle: {
    color: '#0f172a',
    fontSize: '15px',
    fontWeight: '900',
  },
  registryPhotoEmptySub: {
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '700',
  },
  registryPhotoRemove: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '34px',
    height: '34px',
    borderRadius: '999px',
    border: '1px solid #fecaca',
    background: '#fff',
    color: '#dc2626',
    fontSize: '16px',
    fontWeight: '950',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.12)',
  },
  registryPhotoActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 'calc(100% + 8px)',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '8px',
    padding: '8px',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    background: '#fff',
    boxShadow: '0 18px 34px rgba(15, 23, 42, 0.18)',
    zIndex: 6,
  },
  registryPhotoAction: {
    minHeight: '40px',
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: '900',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registryFieldsStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    minWidth: 0,
  },
  newModelAction: {
    width: '100%',
    minHeight: '38px',
    border: '1px solid #0f766e',
    borderRadius: '10px',
    background: '#ecfdf5',
    color: '#0f766e',
    fontSize: '13px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  shortcutBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  shortcutHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  shortcutTitle: {
    color: '#475569',
    fontSize: '12px',
    fontWeight: '800',
  },
  shortcutGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
  },
  shortcutCard: {
    minWidth: 0,
    padding: '8px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
  },
  shortcutImage: {
    width: '100%',
    aspectRatio: '1 / 1',
    objectFit: 'cover',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    background: '#f8fafc',
  },
  shortcutPlaceholder: {
    width: '100%',
    aspectRatio: '1 / 1',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    background: '#f8fafc',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: '800',
  },
  shortcutName: {
    display: 'block',
    marginTop: '7px',
    color: '#0f172a',
    fontSize: '11px',
    fontWeight: '850',
    lineHeight: 1.25,
    wordBreak: 'break-word',
  },
  shortcutMeta: {
    display: 'block',
    marginTop: '3px',
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '700',
    lineHeight: 1.25,
  },
  modelLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
  },
  modalTitleRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  registryModalTitle: {
    minWidth: 0,
    fontSize: '18px',
    lineHeight: 1.18,
  },
  modalTitleActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    flexWrap: 'nowrap',
  },
  modalTitleButton: {
    height: '38px',
    padding: '0 12px',
    fontSize: '13px',
  },
  categoryHint: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: '700',
    lineHeight: 1.25,
    textAlign: 'right',
  },
  selectedModelCard: {
    position: 'relative',
    width: '112px',
    minWidth: '112px',
    height: '112px',
    padding: 0,
    border: '1px solid #cbd5e1',
    borderRadius: '14px',
    background: '#fff',
    cursor: 'pointer',
    overflow: 'hidden',
    flex: '0 0 112px',
  },
  selectedModelThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    background: '#f8fafc',
  },
  selectedModelPlaceholder: {
    width: '100%',
    height: '100%',
    background: '#f8fafc',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '10px',
    fontSize: '11px',
    fontWeight: '800',
  },
  selectedModelBadge: {
    position: 'absolute',
    left: '8px',
    right: '8px',
    bottom: '8px',
    minHeight: '24px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.92)',
    color: '#0f172a',
    fontSize: '10px',
    fontWeight: '900',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 8px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  koliImage: {
    width: '48px',
    height: '48px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    objectFit: 'cover',
    background: '#f8fafc',
  },
  koliImageButton: {
    width: '48px',
    height: '48px',
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'inline-flex',
  },
  koliImagePlaceholder: {
    width: '48px',
    height: '48px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    fontWeight: '800',
  },
  koliActionRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
  },
  koliIconButton: {
    width: '34px',
    height: '34px',
    padding: 0,
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#fff',
    color: '#0f172a',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  koliDeleteButton: {
    border: '1px solid #fecaca',
    color: '#dc2626',
  },
  koliModelStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  koliVariantText: {
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '750',
    lineHeight: 1.25,
  },
  disabledSegment: {
    opacity: 0.48,
    cursor: 'not-allowed',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: '16px',
  },
  headerSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '16px',
  },
  summaryCard: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  summaryLabel: {
    fontSize: '13px',
    color: '#6b7280',
    fontWeight: '600',
  },
  summaryLabelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  tooltipWrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  },
  tooltipButton: {
    width: '18px',
    height: '18px',
    borderRadius: '999px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#475569',
    fontSize: '11px',
    fontWeight: '700',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'help',
    padding: 0,
  },
  tooltipBox: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    minWidth: '240px',
    maxWidth: '280px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: '#111827',
    color: '#fff',
    fontSize: '12px',
    lineHeight: 1.5,
    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.18)',
    zIndex: 10,
    opacity: 0,
    visibility: 'hidden',
    transform: 'translateY(-4px)',
    transition: 'opacity 0.18s ease, transform 0.18s ease, visibility 0.18s ease',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
  },
  checkboxWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
  },
  toggleWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
  },
  toggleButton: {
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
  },
  toggleTrack: {
    width: '48px',
    height: '28px',
    borderRadius: '999px',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    transition: 'background-color 0.2s ease',
  },
  toggleThumb: {
    width: '20px',
    height: '20px',
    borderRadius: '999px',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
    transition: 'transform 0.2s ease',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
  },
  primaryButton: {
    height: '42px',
    padding: '0 16px',
    border: 'none',
    borderRadius: '8px',
    background: '#111827',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryButton: {
    height: '42px',
    padding: '0 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
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
    padding: '12px 14px',
    textAlign: 'left',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '13px',
    fontWeight: '700',
    color: '#374151',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 14px',
    borderTop: '1px solid #f1f5f9',
    fontSize: '14px',
    color: '#111827',
    verticalAlign: 'top',
  },
  koliGroupTd: {
    borderTop: '2px solid #cbd5e1',
  },
  centerHeader: {
    textAlign: 'center',
  },
  middleCenterCell: {
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  sampleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '78px',
    height: '28px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#fef3c7',
    color: '#92400e',
    fontSize: '12px',
    fontWeight: '700',
  },
  returnBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '78px',
    height: '28px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#fee2e2',
    color: '#b91c1c',
    fontSize: '12px',
    fontWeight: '700',
  },
  koliCell: {
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  koliHeader: {
    textAlign: 'center',
  },
  emptyText: {
    margin: 0,
    color: '#6b7280',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
  },
  successText: {
    margin: 0,
    color: '#16a34a',
  },
  middleCell: {
    verticalAlign: 'middle',
  },
  summaryImageButton: {
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'inline-flex',
  },
  actionInline: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  printButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '32px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  performanceSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
    gap: '10px',
  },
  performanceMetric: {
    minWidth: 0,
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#f8fafc',
  },
  performanceMetricValue: {
    display: 'block',
    marginTop: '4px',
    color: '#0f172a',
    fontSize: '20px',
    fontWeight: '900',
    fontVariantNumeric: 'tabular-nums',
  },
  performanceMetricDanger: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
  },
  performanceMetricWarning: {
    background: '#fff7ed',
    border: '1px solid #fed7aa',
  },
  performanceMetricSuccess: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
  },
  performanceBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '56px',
    height: '28px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#ecfdf5',
    color: '#166534',
    fontSize: '12px',
    fontWeight: '900',
    fontVariantNumeric: 'tabular-nums',
  },
  performanceBadgeDanger: {
    background: '#fee2e2',
    color: '#991b1b',
  },
  performanceBadgeWarning: {
    background: '#ffedd5',
    color: '#9a3412',
  },
  performanceModal: {
    maxWidth: '720px',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.4)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 40,
    overflowY: 'auto',
  },
  mobileOverlay: {
    alignItems: 'flex-end',
    padding: 0,
    background: 'rgba(15, 23, 42, 0.46)',
    overflow: 'hidden',
  },
  centeredOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredMobileOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    background: 'rgba(15, 23, 42, 0.46)',
    overflowY: 'auto',
  },
  modal: {
    width: '100%',
    maxWidth: '560px',
    maxHeight: 'calc(100dvh - 48px)',
    overflowY: 'auto',
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  mobileModal: {
    width: '100%',
    maxWidth: '520px',
    height: 'auto',
    maxHeight: 'calc(100dvh - 12px)',
    minHeight: 0,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    borderRadius: '22px 22px 0 0',
    padding: '20px 20px max(24px, env(safe-area-inset-bottom))',
    gap: '16px',
  },
  chooseModal: {
    maxWidth: '640px',
    maxHeight: 'calc(100dvh - 48px)',
  },
  centeredMobileModal: {
    width: '100%',
    maxWidth: '520px',
    maxHeight: 'calc(100dvh - 32px)',
    minHeight: 0,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    borderRadius: '20px',
    padding: '20px',
    gap: '16px',
  },
  registryCenteredModal: {
    width: '100%',
    maxWidth: '760px',
    maxHeight: 'calc(100dvh - 32px)',
    minHeight: 0,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    borderRadius: '20px',
    padding: '20px',
    gap: '16px',
  },
  modalFooter: {
    position: 'sticky',
    bottom: 0,
    margin: '4px -20px calc(-1 * max(24px, env(safe-area-inset-bottom)))',
    padding: '12px 20px max(16px, env(safe-area-inset-bottom))',
    background: '#fff',
    borderTop: '1px solid #e5e7eb',
    zIndex: 2,
  },
  modalHandle: {
    width: '44px',
    height: '5px',
    borderRadius: '999px',
    background: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: '2px',
  },
  imagePreview: {
    width: '96px',
    height: '96px',
    borderRadius: '12px',
    objectFit: 'cover',
    border: '1px solid #e5e7eb',
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
  modelThumb: {
    width: '100%',
    height: '120px',
    borderRadius: '10px',
    objectFit: 'cover',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
  summaryThumb: {
    width: '72px',
    height: '72px',
    borderRadius: '10px',
    objectFit: 'cover',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
  summaryThumbEmpty: {
    width: '72px',
    height: '72px',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
    fontSize: '11px',
    fontWeight: '700',
  },
}

export default function UnloadPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const grnParam = searchParams.get('grn') || ''
  const isBuilderMode = pathname.startsWith('/mobile/inbound/unload')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [inbounds, setInbounds] = useState([])
  const [brands, setBrands] = useState([])
  const [categories, setCategories] = useState([])
  const [productModels, setProductModels] = useState([])
  const [productModelVariants, setProductModelVariants] = useState([])
  const [selectedInboundId, setSelectedInboundId] = useState('')
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [brandSearch, setBrandSearch] = useState('')
  const [showBrandResults, setShowBrandResults] = useState(false)
  const [level0Id, setLevel0Id] = useState('')
  const [level1Id, setLevel1Id] = useState('')
  const [level2Id, setLevel2Id] = useState('')
  const [selectedModel, setSelectedModel] = useState(null)
  const [selectedVariantLabel, setSelectedVariantLabel] = useState('')
  const [qty, setQty] = useState('')
  const [isSample, setIsSample] = useState(false)
  const [isReturn, setIsReturn] = useState(false)
  const [currentKoliItems, setCurrentKoliItems] = useState([])
  const [unloadRows, setUnloadRows] = useState([])
  const [qcItemRows, setQcItemRows] = useState([])
  const [returnRows, setReturnRows] = useState([])
  const [showChooseModelModal, setShowChooseModelModal] = useState(false)
  const [showModelModal, setShowModelModal] = useState(false)
  const [showPerformanceModal, setShowPerformanceModal] = useState(false)
  const [modelDraft, setModelDraft] = useState(createModelDraft)
  const [editingVariantContext, setEditingVariantContext] = useState(null)
  const [variantPhotoFile, setVariantPhotoFile] = useState(null)
  const [showVariantPhotoOptions, setShowVariantPhotoOptions] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modelModalError, setModelModalError] = useState('')
  const [previewImage, setPreviewImage] = useState(null)
  const [supportsUnloadVariant, setSupportsUnloadVariant] = useState(false)
  const [supportsUnloadVariantCode, setSupportsUnloadVariantCode] = useState(false)
  const [supportsUnloadVariantName, setSupportsUnloadVariantName] = useState(false)
  const [supportsReturnVariant, setSupportsReturnVariant] = useState(false)
  const [supportsReturnVariantCode, setSupportsReturnVariantCode] = useState(false)
  const [supportsReturnVariantName, setSupportsReturnVariantName] = useState(false)
  const [breakdownMode, setBreakdownMode] = useState('koli')
  const [breakdownFilters, setBreakdownFilters] = useState({
    brandId: '',
    categoryId: '',
    modelName: '',
    qtyMode: '',
    qtyValue: '',
  })
  const displayName = user ? getDisplayName(user, profile) : 'Loading...'
  const userRole = resolveRole(profile?.role, user?.email?.toLowerCase() === ADMIN_EMAIL)
  const canRegistryModelVariant = userRole === 'admin' || userRole === 'inbound_coordinator'
  const addMode = isReturn ? 'return' : isSample ? 'sample' : 'regular'

  const loadQcItemsForUnloadRows = useCallback(async (rows) => {
    const unloadIds = (rows || []).map((row) => row.id).filter(Boolean)

    if (!unloadIds.length) {
      return []
    }

    const { data, error: qcError } = await supabase
      .from('qc_items')
      .select('id, inbound_unload_id, qty_in, allocated_qty, model_replaced')
      .in('inbound_unload_id', unloadIds)

    if (qcError) {
      throw new Error(qcError.message || 'Failed to load QC in rows.')
    }

    return data || []
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadAuthenticatedUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!isMounted) return

      if (!authUser) {
        router.push('/login')
        return
      }

      const profileResult = await getProfileByAuthenticatedUser(supabase, authUser, 'id, email, display_name, role')

      if (!isMounted) return

      setUser(authUser)
      setProfile(profileResult.data || null)
    }

    loadAuthenticatedUser()

    return () => {
      isMounted = false
    }
  }, [router])

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true)
      setError('')

      const [
        { data: inboundRows, error: inboundError },
        { data: brandRows, error: brandError },
        { data: categoryRows, error: categoryError },
        { data: modelRows, error: modelError },
        { data: productVariantRows, error: productVariantError },
      ] = await Promise.all([
        supabase
          .from('inbound')
          .select('id, grn_number, total_claimed_qty, total_received_qty, inbound_date, item_name, suppliers:dir_suppliers!supplier_id (supplier_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('dir_brands')
          .select('id, brand_code, brand_name')
          .eq('is_active', true)
          .order('brand_name', { ascending: true }),
        supabase
          .from('dir_categories')
          .select('id, category_code, category_name, parent_id, level, full_code, full_name')
          .eq('is_active', true)
          .order('full_code', { ascending: true }),
        supabase
          .from('dir_product_models')
          .select('id, brand_id, category_id, model_code, model_name, model_notes')
          .eq('is_active', true)
          .order('model_name', { ascending: true }),
        supabase
          .from('dir_product_model_variants')
          .select('*')
          .eq('is_active', true)
          .order('variant_code', { ascending: true }),
      ])

      if (inboundError || brandError || categoryError || modelError || productVariantError) {
        setError(
          inboundError?.message ||
            brandError?.message ||
            categoryError?.message ||
            modelError?.message ||
            productVariantError?.message ||
            'Failed to load unload setup.'
        )
        setLoading(false)
        return
      }

      setInbounds(inboundRows || [])
      setBrands(brandRows || [])
      setCategories(categoryRows || [])
      setProductModels(modelRows || [])
      setProductModelVariants(productVariantRows || [])

      if (grnParam) {
        const selectedInbound = (inboundRows || []).find((item) => item.grn_number === grnParam)
        setSelectedInboundId(selectedInbound ? String(selectedInbound.id) : '')
      }

      const [
        { error: unloadVariantError },
        { error: unloadVariantCodeError },
        { error: unloadVariantNameError },
        { error: returnVariantError },
        { error: returnVariantCodeError },
        { error: returnVariantNameError },
      ] = await Promise.all([
        supabase.from('inbound_unload').select('variant_label').limit(1),
        supabase.from('inbound_unload').select('variant_code').limit(1),
        supabase.from('inbound_unload').select('variant_name').limit(1),
        supabase.from('warehouse_returns').select('variant_label').limit(1),
        supabase.from('warehouse_returns').select('variant_code').limit(1),
        supabase.from('warehouse_returns').select('variant_name').limit(1),
      ])

      setSupportsUnloadVariant(!unloadVariantError)
      setSupportsUnloadVariantCode(!unloadVariantCodeError)
      setSupportsUnloadVariantName(!unloadVariantNameError)
      setSupportsReturnVariant(!returnVariantError)
      setSupportsReturnVariantCode(!returnVariantCodeError)
      setSupportsReturnVariantName(!returnVariantNameError)
      setLoading(false)
    }

    loadInitialData()
  }, [grnParam])

  useEffect(() => {
    async function loadUnloadRows() {
      if (!selectedInboundId) {
        setUnloadRows([])
        setQcItemRows([])
        setReturnRows([])
        setCurrentKoliItems([])
        return
      }

      const [
        { data: unloadData, error: unloadError },
        { data: returnsData, error: returnsError },
      ] = await Promise.all([
        supabase
          .from('inbound_unload')
          .select([
            'id',
            'inbound_id',
            'brand_id',
            'category_id',
            'model_name',
            'qty',
            'pic_name',
            'is_sample',
            'koli_sequence',
            'photo_url',
            supportsUnloadVariant ? 'variant_label' : null,
            supportsUnloadVariantCode ? 'variant_code' : null,
            supportsUnloadVariantName ? 'variant_name' : null,
          ].filter(Boolean).join(', '))
          .eq('inbound_id', selectedInboundId)
          .order('is_sample', { ascending: true })
          .order('koli_sequence', { ascending: true })
          .order('id', { ascending: true }),
        supabase
          .from('warehouse_returns')
          .select([
            'id',
            'inbound_id',
            'source_phase',
            'brand_id',
            'category_id',
            'model_name',
            'qty',
            'pic_name',
            'koli_sequence',
            'created_at',
            supportsReturnVariant ? 'variant_label' : null,
            supportsReturnVariantCode ? 'variant_code' : null,
            supportsReturnVariantName ? 'variant_name' : null,
          ].filter(Boolean).join(', '))
          .eq('inbound_id', selectedInboundId)
          .eq('source_phase', 'inbound')
          .order('koli_sequence', { ascending: true })
          .order('created_at', { ascending: true }),
      ])

      if (unloadError || returnsError) {
        setError(unloadError?.message || returnsError?.message || 'Failed to load unload rows.')
        return
      }

      let qcRows = []

      try {
        qcRows = await loadQcItemsForUnloadRows(unloadData || [])
      } catch (qcLoadError) {
        setError(qcLoadError.message || 'Failed to load QC in rows.')
      }

      setUnloadRows(unloadData || [])
      setQcItemRows(qcRows)
      setReturnRows(returnsData || [])
    }

    loadUnloadRows()
  }, [
    loadQcItemsForUnloadRows,
    selectedInboundId,
    supportsReturnVariant,
    supportsReturnVariantCode,
    supportsReturnVariantName,
    supportsUnloadVariant,
    supportsUnloadVariantCode,
    supportsUnloadVariantName,
  ])

  const categoryMaps = buildCategoryMaps(categories)
  const level0Options = categoryMaps.roots
  const level1Options = level0Id ? categoryMaps.getChildren(Number(level0Id)) : []
  const level2Options = level1Id ? categoryMaps.getChildren(Number(level1Id)) : []
  const requiresLevel1 = level1Options.length > 0
  const requiresLevel2 = level2Options.length > 0

  const selectedInbound =
    inbounds.find((item) => item.id === Number(selectedInboundId)) || null
  const builderGridStyle = isBuilderMode ? styles.mobileSingleGrid : styles.compactGrid
  const registryOverlayStyle = isBuilderMode
    ? { ...styles.overlay, ...styles.centeredMobileOverlay }
    : { ...styles.overlay, ...styles.centeredOverlay }
  const registryModalStyle = { ...styles.modal, ...styles.registryCenteredModal }
  const chooseOverlayStyle = isBuilderMode
    ? { ...styles.overlay, ...styles.centeredMobileOverlay }
    : { ...styles.overlay, ...styles.centeredOverlay }
  const chooseModalStyle = isBuilderMode
    ? { ...styles.modal, ...styles.centeredMobileModal }
    : { ...styles.modal, ...styles.chooseModal }

  const selectedCategoryId =
    requiresLevel1 && !level1Id
      ? ''
      : requiresLevel2 && !level2Id
        ? ''
        : level2Id || level1Id || level0Id || ''
  const selectedCategory = selectedCategoryId
    ? categoryMaps.byId.get(Number(selectedCategoryId)) || null
    : null

  const selectedBrand = selectedBrandId
    ? brands.find((brand) => Number(brand.id) === Number(selectedBrandId)) || null
    : null

  const filteredBrandOptions = useMemo(() => {
    const query = brandSearch.trim().toLowerCase()
    const normalizedBrands = [...brands].sort((a, b) =>
      getBrandDisplayLabel(a).localeCompare(getBrandDisplayLabel(b))
    )

    if (!query) {
      return normalizedBrands.slice(0, 12)
    }

    return normalizedBrands
      .filter((brand) => {
        const label = getBrandDisplayLabel(brand).toLowerCase()
        const code = String(brand.brand_code || '').toLowerCase()
        return label.includes(query) || code.includes(query)
      })
      .slice(0, 12)
  }, [brandSearch, brands])

  const filteredModelOptions = productModels
    .filter((item) => {
      if (!selectedBrandId || !selectedCategory) return false

      return (
        Number(item.brand_id || 0) === Number(selectedBrandId) &&
        Number(item.category_id || 0) === Number(selectedCategory.id)
      )
    })
    .sort((a, b) => {
      return String(a.model_name || '').localeCompare(String(b.model_name || ''))
    })
  const isEditingVariant = Boolean(editingVariantContext?.variant?.id)
  const registryUsesNewModel = !isEditingVariant && (modelDraft.is_new_model || filteredModelOptions.length === 0)
  const registrySelectedModel = modelDraft.model_id
    ? editingVariantContext?.model ||
      filteredModelOptions.find((item) => String(item.id) === String(modelDraft.model_id)) ||
      null
    : null
  const filteredVariantOptions = useMemo(
    () =>
      filteredModelOptions
        .flatMap((model) =>
          productModelVariants
            .filter((variant) => Number(variant.product_model_id || 0) === Number(model.id || 0))
            .map((variant) => ({
              model,
              variant,
              photoUrl: variant.variant_photo_url || '',
              label: `${model.model_name || '-'} / ${getVariantDisplayName(variant)}`,
            }))
        )
        .sort((a, b) => {
          const modelCompare = String(a.model.model_name || '').localeCompare(String(b.model.model_name || ''))
          const variantCompare = String(getVariantProductId(a.variant) || getVariantDisplayName(a.variant)).localeCompare(
            String(getVariantProductId(b.variant) || getVariantDisplayName(b.variant))
          )

          if (modelCompare !== 0) return modelCompare
          return variantCompare
        }),
    [filteredModelOptions, productModelVariants]
  )
  const filteredVariantGroups = useMemo(() => {
    const variantsByModelId = new Map()

    filteredVariantOptions.forEach((option) => {
      const modelId = String(option.model.id)
      const currentItems = variantsByModelId.get(modelId) || []
      currentItems.push(option)
      variantsByModelId.set(modelId, currentItems)
    })

    return filteredModelOptions
      .map((model) => ({
        model,
        variants: variantsByModelId.get(String(model.id)) || [],
      }))
      .filter((group) => group.variants.length > 0)
  }, [filteredModelOptions, filteredVariantOptions])

  const selectedModelVariants = useMemo(
    () =>
      productModelVariants
        .filter((item) => Number(item.product_model_id || 0) === Number(selectedModel?.id || 0))
        .sort((a, b) =>
          String(getVariantProductId(a) || getVariantDisplayName(a)).localeCompare(
            String(getVariantProductId(b) || getVariantDisplayName(b))
          )
        ),
    [productModelVariants, selectedModel]
  )
  const exactSelectedVariant = selectedModel
    ? findVariantForModel(selectedModel, selectedVariantLabel, '')
    : null
  const selectedVariant =
    exactSelectedVariant ||
    (!selectedVariantLabel ? selectedModelVariants[0] || null : null)
  const selectedModelPhoto = selectedVariant?.variant_photo_url || selectedModel?.photo_url || ''
  const selectedVariantDisplayName = selectedVariant
    ? getVariantDisplayName(selectedVariant)
    : selectedVariantLabel || ''
  const selectedCategoryLabel = selectedCategory ? getCategoryDisplayLabel(selectedCategory) : ''

  const totalReturnQty = returnRows
    .reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const totalInboundQty =
    unloadRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const hasSelectedSjQty = selectedInbound?.total_claimed_qty != null
  const sjQty = hasSelectedSjQty ? Number(selectedInbound.total_claimed_qty || 0) : null
  const remainingQty = hasSelectedSjQty ? totalInboundQty - sjQty : null
  const remainingQtyStyle =
    !hasSelectedSjQty
      ? { color: '#64748b' }
      : remainingQty < 0
      ? styles.mobileRemainingNegative
      : remainingQty > 0
        ? styles.mobileRemainingPositive
        : styles.mobileRemainingZero
  const qcQtyByUnloadId = useMemo(() => {
    const qtyMap = new Map()

    qcItemRows.forEach((row) => {
      const unloadId = Number(row.inbound_unload_id || 0)
      if (!unloadId) return

      qtyMap.set(unloadId, Number(qtyMap.get(unloadId) || 0) + Number(row.qty_in || 0))
    })

    return qtyMap
  }, [qcItemRows])
  const modelErrorQtyByUnloadId = useMemo(() => {
    const qtyMap = new Map()

    qcItemRows
      .filter((row) => row.model_replaced)
      .forEach((row) => {
        const unloadId = Number(row.inbound_unload_id || 0)
        if (!unloadId) return

        const modelErrorQty = Number(row.allocated_qty ?? row.qty_in ?? 0)
        qtyMap.set(unloadId, Number(qtyMap.get(unloadId) || 0) + modelErrorQty)
      })

    return qtyMap
  }, [qcItemRows])
  const performanceRows = useMemo(() => {
    const grouped = new Map()

    unloadRows
      .filter((row) => row.is_sample || row.koli_sequence != null)
      .forEach((row) => {
        if (!qcQtyByUnloadId.has(Number(row.id || 0))) {
          return
        }

        const picName = getFirstName(row.pic_name) || 'Unknown'
        const current = grouped.get(picName) || {
          picName,
          statedQty: 0,
          qcQty: 0,
          modelErrorQty: 0,
          rowCount: 0,
        }
        const statedQty = Number(row.qty || 0)
        const qcQty = Number(qcQtyByUnloadId.get(Number(row.id || 0)) || 0)
        const modelErrorQty = Number(modelErrorQtyByUnloadId.get(Number(row.id || 0)) || 0)

        current.statedQty += statedQty
        current.qcQty += qcQty
        current.modelErrorQty += modelErrorQty
        current.rowCount += 1
        grouped.set(picName, current)
      })

    return Array.from(grouped.values())
      .map((row) => ({
        ...row,
        variance: row.qcQty - row.statedQty,
      }))
      .sort((a, b) => b.modelErrorQty - a.modelErrorQty || Math.abs(b.variance) - Math.abs(a.variance) || a.picName.localeCompare(b.picName))
  }, [modelErrorQtyByUnloadId, qcQtyByUnloadId, unloadRows])
  const performanceTotals = useMemo(() => {
    return performanceRows.reduce(
      (total, row) => ({
        statedQty: total.statedQty + row.statedQty,
        qcQty: total.qcQty + row.qcQty,
        modelErrorQty: total.modelErrorQty + row.modelErrorQty,
        variance: total.variance + row.variance,
      }),
      { statedQty: 0, qcQty: 0, modelErrorQty: 0, variance: 0 }
    )
  }, [performanceRows])
  const displayFirstName = getFirstName(displayName)
  const currentKoliQty = currentKoliItems.reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const isModeLocked = currentKoliItems.length > 0
  const hasUnloadDraft = isBuilderMode && Boolean(
    selectedBrandId ||
    selectedModel ||
    qty ||
    currentKoliItems.length ||
    isSample ||
    isReturn
  )
  const recentProductOptions = (() => {
    function getRecentProductKey(row) {
      const matchingVariant = getVariantForRow(row)

      if (matchingVariant?.id) {
        return `variant:${matchingVariant.id}`
      }

      const variantIdentity = normalizeVariantLookupValue(getRowVariantIdentifier(row))
      const fallbackIdentity = variantIdentity || normalizeVariantLookupValue(row.photo_url)

      return [
        row.brand_id || '',
        row.category_id || '',
        normalizeVariantLookupValue(row.model_name),
        fallbackIdentity,
      ].join('|')
    }

    const sourceRows = [
      ...currentKoliItems.map((row, index) => ({ ...row, sortKey: 1000000 + index })),
      ...unloadRows.map((row) => ({ ...row, sortKey: Number(row.id || 0) })),
      ...returnRows.map((row) => ({ ...row, sortKey: Number(row.id || 0) })),
    ]
      .filter((row) => row.brand_id && row.category_id && row.model_name)
      .sort((a, b) => b.sortKey - a.sortKey)

    const seen = new Set()
    const options = []

    for (const row of sourceRows) {
      const key = getRecentProductKey(row)

      if (seen.has(key)) continue

      seen.add(key)
      options.push({ ...row, recentProductKey: key })

      if (options.length >= 3) break
    }

    return options.slice(0, 3)
  })()
  const koliGroups = useMemo(() => {
    const grouped = new Map()

    unloadRows
      .filter((row) => !row.is_sample && row.koli_sequence != null)
      .forEach((row) => {
        const key = Number(row.koli_sequence)
        const current = grouped.get(key) || {
          koli_sequence: key,
          items: [],
          total_qty: 0,
          pic_names: new Set(),
        }

        current.items.push(row)
        current.total_qty += Number(row.qty || 0)
        if (row.pic_name) {
          current.pic_names.add(row.pic_name)
        }
        grouped.set(key, current)
      })

    return Array.from(grouped.values())
      .sort((a, b) => a.koli_sequence - b.koli_sequence)
      .map((group) => ({
        ...group,
        pic_list: Array.from(group.pic_names),
      }))
  }, [unloadRows])
  const modelGroups = (() => {
    const grouped = new Map()

    unloadRows.forEach((row) => {
      const matchingVariant = getVariantForRow(row)
      const resolvedVariantName = matchingVariant ? getVariantDisplayName(matchingVariant) : row.variant_name || row.variant_label || row.variant_code || ''
      const resolvedVariantKey = matchingVariant?.id
        ? `variant:${matchingVariant.id}`
        : `fallback:${getRowVariantIdentifier(row)}|${row.photo_url || ''}`
      const key = [
        row.brand_id || '',
        row.category_id || '',
        row.model_name || '',
        resolvedVariantKey,
      ].join('|')
      const current = grouped.get(key) || {
        key,
        brand_id: row.brand_id,
        category_id: row.category_id,
        model_name: row.model_name,
        variant_code: matchingVariant ? getVariantProductId(matchingVariant) : row.variant_code || row.variant_label || '',
        variant_label: matchingVariant ? getVariantProductId(matchingVariant) : row.variant_label,
        variant_name: resolvedVariantName,
        photo_url: getVariantPhotoForRow(row),
        total_qty: 0,
        sample_qty: 0,
        koli_sequences: new Set(),
        pic_names: new Set(),
      }

      current.total_qty += Number(row.qty || 0)
      if (row.is_sample) {
        current.sample_qty += Number(row.qty || 0)
      }
      if (!row.is_sample && row.koli_sequence != null) {
        current.koli_sequences.add(Number(row.koli_sequence))
      }
      if (row.pic_name) {
        current.pic_names.add(row.pic_name)
      }
      const resolvedPhotoUrl = getVariantPhotoForRow(row)
      if (!current.photo_url && resolvedPhotoUrl) {
        current.photo_url = resolvedPhotoUrl
      }
      grouped.set(key, current)
    })

    return Array.from(grouped.values())
      .sort((a, b) => getModelVariantLabelForRow(a).localeCompare(getModelVariantLabelForRow(b)))
      .map((group) => ({
        ...group,
        koli_list: Array.from(group.koli_sequences).sort((a, b) => a - b),
        pic_list: Array.from(group.pic_names),
      }))
  })()

  const sampleRows = unloadRows.filter((row) => row.is_sample)
  const sampleBreakdownGroup = sampleRows.length
    ? {
        label: 'Sample',
        items: sampleRows,
        total_qty: sampleRows.reduce((sum, row) => sum + Number(row.qty || 0), 0),
        pic_list: [...new Set(sampleRows.map((row) => row.pic_name).filter(Boolean))],
        rowType: 'sample',
      }
    : null
  const returnBreakdownGroup = returnRows.length
    ? {
        label: 'Retur',
        items: returnRows,
        total_qty: returnRows.reduce((sum, row) => sum + Number(row.qty || 0), 0),
        pic_list: [...new Set(returnRows.map((row) => row.pic_name).filter(Boolean))],
        rowType: 'return',
      }
    : null
  const nonKoliGroups = [sampleBreakdownGroup, returnBreakdownGroup].filter(Boolean)
  const sortedBrandFilterOptions = [...new Map(
    modelGroups
      .filter((group) => matchesBreakdownFilters(group, group.total_qty, 'brandId'))
      .map((group) => [String(group.brand_id || ''), brands.find((item) => Number(item.id) === Number(group.brand_id))])
      .filter(([id, brand]) => id && brand)
  ).values()]
    .sort((a, b) => String(a.brand_name || '').localeCompare(String(b.brand_name || '')))
  const sortedCategoryFilterOptions = [...new Map(
    modelGroups
      .filter((group) => matchesBreakdownFilters(group, group.total_qty, 'categoryId'))
      .map((group) => {
        const category = categoryMaps.byId.get(Number(group.category_id))
        return [String(group.category_id || ''), category]
      })
      .filter(([id, category]) => id && category)
  ).values()]
    .sort((a, b) =>
      String(a.full_name || a.category_name || '').localeCompare(String(b.full_name || b.category_name || ''))
    )
  const sortedModelFilterOptions = [...new Set(
    modelGroups
      .filter((group) => matchesBreakdownFilters(group, group.total_qty, 'modelName'))
      .map((group) => String(group.model_name || '').trim())
      .filter(Boolean)
  )]
    .sort((a, b) => a.localeCompare(b))
  const filteredModelGroups = modelGroups.filter((group) => matchesBreakdownFilters(group, group.total_qty))
  const filteredKoliGroups = koliGroups
    .map((group) => {
      const items = group.items.filter((row) => matchesBreakdownFilters(row, Number(row.qty || 0)))
      const picNames = new Set(items.map((row) => row.pic_name).filter(Boolean))

      return {
        ...group,
        items,
        total_qty: items.reduce((sum, row) => sum + Number(row.qty || 0), 0),
        pic_list: Array.from(picNames),
      }
    })
    .filter((group) => group.items.length > 0)
  const filteredNonKoliGroups = nonKoliGroups
    .map((group) => {
      const items = group.items.filter((row) => matchesBreakdownFilters(row, Number(row.qty || 0)))
      const picNames = new Set(items.map((row) => row.pic_name).filter(Boolean))

      return {
        ...group,
        items,
        total_qty: items.reduce((sum, row) => sum + Number(row.qty || 0), 0),
        pic_list: Array.from(picNames),
      }
    })
    .filter((group) => group.items.length > 0)
  const filteredSummaryRows = filteredModelGroups.map((group) => {
    const brand = brands.find((item) => Number(item.id) === Number(group.brand_id))
    const category = categoryMaps.byId.get(Number(group.category_id))

    return {
      brandName: brand?.brand_name || '-',
      categoryLabel: category?.full_name || category?.category_name || '-',
      modelLabel: getModelVariantLabelForRow(group),
      modelQty: group.total_qty || 0,
      photoUrl: getVariantPhotoForRow(group),
    }
  })
  const filteredPrintTotalQty = filteredSummaryRows.reduce((sum, row) => sum + Number(row.modelQty || 0), 0)
  const hasBreakdownFilters = Boolean(
    breakdownFilters.brandId ||
    breakdownFilters.categoryId ||
    breakdownFilters.modelName ||
    breakdownFilters.qtyMode ||
    breakdownFilters.qtyValue
  )

  function updateBreakdownFilter(name, value) {
    setBreakdownFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === 'brandId' ? { categoryId: '', modelName: '' } : {}),
      ...(name === 'categoryId' ? { modelName: '' } : {}),
    }))
  }

  function resetBreakdownFilters() {
    setBreakdownFilters({
      brandId: '',
      categoryId: '',
      modelName: '',
      qtyMode: '',
      qtyValue: '',
    })
  }

  function matchesQtyFilter(qty) {
    const filterQty = Number(breakdownFilters.qtyValue)

    if (!breakdownFilters.qtyMode || breakdownFilters.qtyValue === '' || !Number.isFinite(filterQty)) {
      return true
    }

    const currentQty = Number(qty || 0)

    if (breakdownFilters.qtyMode === 'lt') return currentQty < filterQty
    if (breakdownFilters.qtyMode === 'eq') return currentQty === filterQty
    if (breakdownFilters.qtyMode === 'gt') return currentQty > filterQty

    return true
  }

  function matchesBreakdownFilters(row, qty, ignoredFilter = '') {
    if (ignoredFilter !== 'brandId' && breakdownFilters.brandId && String(row.brand_id || '') !== breakdownFilters.brandId) {
      return false
    }

    if (ignoredFilter !== 'categoryId' && breakdownFilters.categoryId && String(row.category_id || '') !== breakdownFilters.categoryId) {
      return false
    }

    if (
      ignoredFilter !== 'modelName' &&
      breakdownFilters.modelName &&
      normalizeVariantLookupValue(row.model_name) !== normalizeVariantLookupValue(breakdownFilters.modelName)
    ) {
      return false
    }

    if (ignoredFilter === 'qty') {
      return true
    }

    return matchesQtyFilter(qty)
  }

  function getMatchingModelForRow(row) {
    const rowModelName = normalizeVariantLookupValue(row.model_name)

    return productModels.find((model) =>
      Number(model.brand_id || 0) === Number(row.brand_id || 0) &&
      Number(model.category_id || 0) === Number(row.category_id || 0) &&
      normalizeVariantLookupValue(model.model_name) === rowModelName
    )
  }

  function findVariantForModel(model, variantValue, photoUrl = '') {
    if (!model?.id) return null

    const variantRows = productModelVariants.filter(
      (variant) => Number(variant.product_model_id || 0) === Number(model.id || 0)
    )
    const normalizedVariantValue = normalizeVariantLookupValue(variantValue)

    if (normalizedVariantValue) {
      const matchedVariant = variantRows.find((variant) =>
        getVariantLookupValues(variant).includes(normalizedVariantValue)
      )

      if (matchedVariant) return matchedVariant
    }

    const normalizedPhotoUrl = String(photoUrl || '').trim()

    if (normalizedPhotoUrl) {
      const matchedPhotoVariant = variantRows.find(
        (variant) => String(variant.variant_photo_url || '').trim() === normalizedPhotoUrl
      )

      if (matchedPhotoVariant) return matchedPhotoVariant
    }

    return !normalizedVariantValue && variantRows.length === 1 ? variantRows[0] : null
  }

  function getVariantForRow(row) {
    const matchingModel = getMatchingModelForRow(row)
    return findVariantForModel(matchingModel, getRowVariantIdentifier(row), row.photo_url)
  }

  function getProductAggregationKey(row) {
    const matchingVariant = getVariantForRow(row)

    if (matchingVariant?.id) {
      return `variant:${matchingVariant.id}`
    }

    const variantIdentity = normalizeVariantLookupValue(getRowVariantIdentifier(row))
    const fallbackIdentity = variantIdentity || normalizeVariantLookupValue(row.photo_url)

    return [
      row.brand_id || '',
      row.category_id || '',
      normalizeVariantLookupValue(row.model_name),
      fallbackIdentity,
    ].join('|')
  }

  function getVariantNameForRow(row) {
    const matchingVariant = getVariantForRow(row)

    return matchingVariant ? getVariantDisplayName(matchingVariant) : row.variant_name || row.variant_label || row.variant_code || ''
  }

  function getVariantPhotoForRow(row) {
    const matchingVariant = getVariantForRow(row)
    return matchingVariant?.variant_photo_url || row.photo_url || ''
  }

  function getModelVariantLabelForRow(row) {
    const variantName = getVariantNameForRow(row)
    return variantName ? `${row.model_name || '-'} - ${variantName}` : row.model_name || '-'
  }

  function formatPicFirstNames(picList) {
    const firstNames = [...new Set((picList || []).map((name) => getFirstName(name)).filter(Boolean))]
    return firstNames.length ? firstNames.join(', ') : '-'
  }

  function formatSignedQty(value) {
    const numericValue = Number(value || 0)

    return numericValue > 0 ? `+${formatNumber(numericValue)}` : formatNumber(numericValue)
  }

  function getQcQtyForUnloadRow(row) {
    return Number(qcQtyByUnloadId.get(Number(row.id || 0)) || 0)
  }

  function getQcVarianceForUnloadRow(row) {
    return getQcQtyForUnloadRow(row) - Number(row.qty || 0)
  }

  function getQtyPillQcStyle(row) {
    if (!qcQtyByUnloadId.has(Number(row.id || 0))) {
      return {}
    }

    const variance = getQcVarianceForUnloadRow(row)

    if (variance < 0) return styles.qtyPillQcShort
    if (variance > 0) return styles.qtyPillQcOver

    return {}
  }

  function getQcVarianceTitle(row) {
    if (!qcQtyByUnloadId.has(Number(row.id || 0))) {
      return 'Belum masuk QC In, jadi belum dihitung sebagai performance inbound.'
    }

    const statedQty = Number(row.qty || 0)
    const qcQty = getQcQtyForUnloadRow(row)
    const variance = qcQty - statedQty

    if (variance < 0) {
      return `QC In kurang ${formatNumber(Math.abs(variance))} dari stated intake qty (${formatNumber(qcQty)} / ${formatNumber(statedQty)}).`
    }

    if (variance > 0) {
      return `QC In lebih ${formatSignedQty(variance)} dari stated intake qty (${formatNumber(qcQty)} / ${formatNumber(statedQty)}).`
    }

    return `QC In sesuai stated intake qty (${formatNumber(qcQty)} / ${formatNumber(statedQty)}).`
  }

  function getVarianceBadgeStyle(value) {
    const numericValue = Number(value || 0)

    if (numericValue < 0) return { ...styles.performanceBadge, ...styles.performanceBadgeDanger }
    if (numericValue > 0) return { ...styles.performanceBadge, ...styles.performanceBadgeWarning }

    return styles.performanceBadge
  }

  function getPerformanceMetricStyle(value) {
    const numericValue = Number(value || 0)

    if (numericValue < 0) return { ...styles.performanceMetric, ...styles.performanceMetricDanger }
    if (numericValue > 0) return { ...styles.performanceMetric, ...styles.performanceMetricWarning }

    return { ...styles.performanceMetric, ...styles.performanceMetricSuccess }
  }

  useEffect(() => {
    if (!hasUnloadDraft || saving) return undefined

    function handleBeforeUnload(event) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnloadDraft, saving])

  function getCategoryPathIds(categoryId) {
    const path = []
    let current = categoryMaps.byId.get(Number(categoryId))

    while (current) {
      path.unshift(String(current.id))
      current = current.parent_id ? categoryMaps.byId.get(Number(current.parent_id)) : null
    }

    return path
  }

  function getItemTypeSubcategoryLabel(categoryId) {
    const pathIds = getCategoryPathIds(categoryId)
    const itemType = categoryMaps.byId.get(Number(pathIds[pathIds.length - 1]))
    const subCategory = pathIds.length > 1
      ? categoryMaps.byId.get(Number(pathIds[pathIds.length - 2]))
      : null

    if (itemType && subCategory) {
      return `${itemType.category_name || '-'} ${subCategory.category_name || '-'}`.trim()
    }

    return itemType?.category_name || '-'
  }

  function selectProductShortcut(row) {
    const nextBrand = brands.find((brand) => Number(brand.id) === Number(row.brand_id)) || null
    const [rootId = '', levelOneId = '', levelTwoId = ''] = getCategoryPathIds(row.category_id)
    const matchingModel =
      getMatchingModelForRow(row) ||
      {
        brand_id: row.brand_id,
        category_id: row.category_id,
        model_name: row.model_name,
        photo_url: row.photo_url || '',
      }
    const matchingVariant = findVariantForModel(matchingModel, getRowVariantIdentifier(row), row.photo_url)
    const variantIdentifier = getVariantProductId(matchingVariant) || getRowVariantIdentifier(row)

    setSelectedBrandId(row.brand_id ? String(row.brand_id) : '')
    setBrandSearch(nextBrand ? getBrandDisplayLabel(nextBrand) : '')
    setShowBrandResults(false)
    setLevel0Id(rootId)
    setLevel1Id(levelOneId)
    setLevel2Id(levelTwoId)
    setSelectedModel({
      ...matchingModel,
      photo_url: matchingVariant?.variant_photo_url || row.photo_url || matchingModel.photo_url || '',
    })
    setSelectedVariantLabel(variantIdentifier)
    setError('')
    setSuccess('')
  }

  function handleOpenBuilder() {
    const query = selectedInbound?.grn_number || grnParam
    router.push(query ? `/mobile/inbound/unload?grn=${encodeURIComponent(query)}` : '/mobile/inbound/unload')
  }

  function handleBackToSorting() {
    if (hasUnloadDraft && !window.confirm('Are you sure you want to discard this unload input?')) {
      return
    }

    const query = selectedInbound?.grn_number || grnParam
    router.push(query ? `/dashboard/inbound/unload?grn=${encodeURIComponent(query)}` : '/dashboard/inbound/unload')
  }

  function handleCloseSorting() {
    router.push('/dashboard/inbound/receiving')
  }

  function handleModeChange(mode) {
    if (isModeLocked) {
      setError('Post or remove the current Koli items before changing mode.')
      return
    }

    setIsReturn(mode === 'return')
    setIsSample(mode === 'sample')
    setSelectedModel(null)
    setSelectedVariantLabel('')
    setQty('')

    if (mode === 'return') {
      setLevel0Id('')
      setLevel1Id('')
      setLevel2Id('')
    }

    setError('')
    setSuccess('')
  }

  function handleBrandSelectChange(value) {
    const nextBrand = brands.find((brand) => String(brand.id) === String(value)) || null
    setSelectedBrandId(value)
    setBrandSearch(nextBrand ? getBrandDisplayLabel(nextBrand) : '')
    setShowBrandResults(false)
    setLevel0Id('')
    setLevel1Id('')
    setLevel2Id('')
    setSelectedModel(null)
    setSelectedVariantLabel('')
  }

  function resetEntryForm({ keepPath = true, keepBrandOnly = false } = {}) {
    if (!keepPath && !keepBrandOnly) {
      setSelectedBrandId('')
      setBrandSearch('')
    }

    if (!keepPath || keepBrandOnly) {
      setLevel0Id('')
      setLevel1Id('')
      setLevel2Id('')
    }

    setShowBrandResults(false)
    setSelectedModel(null)
    setSelectedVariantLabel('')
    setQty('')
  }

  async function handleVariantPhotoChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setModelModalError('')
      const compressed = await compressImageFile(file)
      setVariantPhotoFile(compressed.file)
      setModelDraft((prev) => ({
        ...prev,
        variant_photo_url: compressed.dataUrl,
      }))
      setShowVariantPhotoOptions(false)
    } catch (photoError) {
      setModelModalError(photoError.message)
    } finally {
      event.target.value = ''
    }
  }

  function handleRemoveVariantPhoto() {
    setVariantPhotoFile(null)
    setModelDraft((prev) => ({
      ...prev,
      variant_photo_url: '',
    }))
    setShowVariantPhotoOptions(false)
  }

  function resetRegistryModal(nextDraft = createModelDraft()) {
    setModelDraft(nextDraft)
    setEditingVariantContext(null)
    setVariantPhotoFile(null)
    setModelModalError('')
    setShowVariantPhotoOptions(false)
  }

  function selectVariantOption(model, variant, photoUrl) {
    setSelectedModel({
      ...model,
      photo_url: photoUrl,
    })
    setSelectedVariantLabel(getVariantProductId(variant))
    setShowChooseModelModal(false)
  }

  function openVariantEditor(model, variant) {
    if (!canRegistryModelVariant) {
      setModelModalError('This role can choose existing variants, but cannot register or edit model variants.')
      return
    }

    const variantProductId = getVariantProductId(variant)

    setEditingVariantContext({ model, variant })
    setModelDraft({
      ...createModelDraft(),
      model_id: String(model.id || ''),
      model_name: model.model_name || '',
      model_notes: model.model_notes || '',
      is_new_model: false,
      variant_name: String(variant.variant_name || variantProductId || '').toUpperCase(),
      variant_notes: variant.variant_notes || '',
      variant_photo_url: variant.variant_photo_url || '',
    })
    setVariantPhotoFile(null)
    setModelModalError('')
    setShowVariantPhotoOptions(false)
    setShowChooseModelModal(false)
    setShowModelModal(true)
  }

  const refreshUnloadData = useCallback(async (inboundId) => {
    const [
      { data: refreshedUnloadRows, error: refreshUnloadError },
      { data: refreshedReturnRows, error: refreshReturnError },
    ] = await Promise.all([
      supabase
        .from('inbound_unload')
        .select([
          'id',
          'inbound_id',
          'brand_id',
          'category_id',
          'model_name',
          'qty',
          'pic_name',
          'is_sample',
          'koli_sequence',
          'photo_url',
          supportsUnloadVariant ? 'variant_label' : null,
          supportsUnloadVariantCode ? 'variant_code' : null,
          supportsUnloadVariantName ? 'variant_name' : null,
        ].filter(Boolean).join(', '))
        .eq('inbound_id', inboundId)
        .order('is_sample', { ascending: true })
        .order('koli_sequence', { ascending: true })
        .order('id', { ascending: true }),
      supabase
        .from('warehouse_returns')
        .select([
          'id',
          'inbound_id',
          'source_phase',
          'brand_id',
          'category_id',
          'model_name',
            'qty',
            'pic_name',
            'koli_sequence',
            'created_at',
            supportsReturnVariant ? 'variant_label' : null,
            supportsReturnVariantCode ? 'variant_code' : null,
            supportsReturnVariantName ? 'variant_name' : null,
          ].filter(Boolean).join(', '))
          .eq('inbound_id', inboundId)
          .eq('source_phase', 'inbound')
          .order('koli_sequence', { ascending: true })
          .order('created_at', { ascending: true }),
    ])

    if (refreshUnloadError || refreshReturnError) {
      throw new Error(refreshUnloadError?.message || refreshReturnError?.message || 'Failed to refresh unload rows.')
    }

    const refreshedQcRows = await loadQcItemsForUnloadRows(refreshedUnloadRows || [])

    setUnloadRows(refreshedUnloadRows || [])
    setQcItemRows(refreshedQcRows)
    setReturnRows(refreshedReturnRows || [])
  }, [
    loadQcItemsForUnloadRows,
    supportsReturnVariant,
    supportsReturnVariantCode,
    supportsReturnVariantName,
    supportsUnloadVariant,
    supportsUnloadVariantCode,
    supportsUnloadVariantName,
  ])

  useEffect(() => {
    if (!selectedInboundId || isBuilderMode || saving) return undefined

    let isActive = true

    async function silentlyRefreshUnloadRows() {
      if (!isActive || document.visibilityState === 'hidden') return

      try {
        await refreshUnloadData(selectedInboundId)
      } catch {
        // Keep the overview stable; manual actions still surface errors.
      }
    }

    const refreshTimer = window.setInterval(silentlyRefreshUnloadRows, 15000)
    window.addEventListener('focus', silentlyRefreshUnloadRows)

    return () => {
      isActive = false
      window.clearInterval(refreshTimer)
      window.removeEventListener('focus', silentlyRefreshUnloadRows)
    }
  }, [isBuilderMode, refreshUnloadData, saving, selectedInboundId])

  function openImagePreview({ src, title }) {
    if (!src) return
    setPreviewImage({ src, title })
  }

  function renderProductPhotoFrame(row) {
    const photoUrl = getVariantPhotoForRow(row)
    const title = getModelVariantLabelForRow(row)

    return photoUrl ? (
      <button
        type="button"
        onClick={() => openImagePreview({ src: photoUrl, title })}
        style={styles.koliImageButton}
        aria-label={`Preview ${title}`}
        title={`Preview ${title}`}
      >
        <Image
          src={photoUrl}
          alt={title}
          width={48}
          height={48}
          unoptimized
          style={styles.koliImage}
        />
      </button>
    ) : (
      <span style={styles.koliImagePlaceholder}>NO PHOTO</span>
    )
  }

  function closeImagePreview() {
    setPreviewImage(null)
  }

  function handlePrintKoli(koliGroup) {
    if (!selectedInbound || !koliGroup) {
      return
    }

    const printWindow = window.open('', '_blank', 'width=720,height=820')

    if (!printWindow) {
      setError('Print window was blocked by the browser.')
      return
    }

    const rowsHtml = koliGroup.items
      .map((row) => {
        const brand = brands.find((item) => item.id === row.brand_id)
        const modelLabel = getModelVariantLabelForRow(row)

        return `
          <tr>
            <td>${brand?.brand_name || '-'}</td>
            <td>${modelLabel || '-'}</td>
            <td class="qty">${row.qty || 0}</td>
          </tr>
        `
      })
      .join('')

    const printHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Inbound Card</title>
    <style>
      @page { size: A6 portrait; margin: 8mm; }
      :root { --inbound-navy: #0b1f3a; }
      body { font-family: Arial, sans-serif; color: var(--inbound-navy); margin: 0; }
      .card { border: 2px solid var(--inbound-navy); border-radius: 16px; padding: 18px; width: 100%; box-sizing: border-box; }
      h1 { margin: 0 0 16px; font-size: 26px; text-align: center; }
      .row { display: grid; grid-template-columns: 88px 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid #e5e7eb; align-items: start; }
      .row:last-child { border-bottom: none; }
      .label { font-weight: 700; font-size: 12px; }
      .value { font-weight: 500; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin: 18px 0; }
      th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; vertical-align: middle; }
      th { background: #f9fafb; text-align: left; }
      .qty { text-align: center; font-weight: 800; }
      .qtyBox {
        margin: 18px 0;
        padding: 16px;
        border-radius: 16px;
        border: 2px solid var(--inbound-navy);
        text-align: center;
      }
      .qtyLabel {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .qtyValue {
        margin-top: 6px;
        font-size: 54px;
        line-height: 1;
        font-weight: 800;
      }
      .picRow .label, .picRow .value {
        font-size: 11px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Inbound Card</h1>
      <div class="row"><div class="label">No GRN</div><div class="value">${selectedInbound.grn_number || '-'}</div></div>
      <div class="row"><div class="label">No Koli</div><div class="value">Koli ${koliGroup.koli_sequence || '-'}</div></div>
      <table>
        <thead>
          <tr>
            <th>Brand</th>
            <th>Model - Variant</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div class="qtyBox">
        <div class="qtyLabel">Total Qty</div>
        <div class="qtyValue">${koliGroup.total_qty || 0}</div>
      </div>
      <div class="row picRow"><div class="label">PIC</div><div class="value">${koliGroup.pic_list.join(', ') || '-'}</div></div>
    </div>
    <script>window.onload = function () { window.print(); };</script>
  </body>
</html>`

    printWindow.document.open()
    printWindow.document.write(printHtml)
    printWindow.document.close()
  }

  function handlePrintUnloadDocument() {
    if (!selectedInbound) {
      setError('Please choose a GRN number first.')
      return
    }

    if (filteredSummaryRows.length === 0) {
      setError('No model rows match the selected filters.')
      return
    }

    const printWindow = window.open('', '_blank', 'width=900,height=1200')

    if (!printWindow) {
      setError('Print window was blocked by the browser.')
      return
    }

    const supplierName = selectedInbound.suppliers?.supplier_name || '-'

    const summaryRowsHtml = filteredSummaryRows
      .map(
        (row) => `
          <tr>
            <td class="photoCell">
              ${row.photoUrl ? `<img src="${row.photoUrl}" alt="${row.modelLabel}" class="modelPhoto" />` : '<div class="photoPlaceholder">NO PHOTO</div>'}
            </td>
            <td>${row.brandName || '-'}</td>
            <td>${row.categoryLabel || '-'}</td>
            <td>${row.modelLabel}</td>
            <td class="qty">${row.modelQty}</td>
          </tr>`
      )
      .join('')

    const printHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Inbound Report</title>
    <style>
      @page { size: A4 portrait; margin: 12mm; }
      body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
      .sheet { width: 100%; box-sizing: border-box; }
      h1 { margin: 0 0 20px; font-size: 28px; }
      .meta {
        display: grid;
        grid-template-columns: 180px 1fr;
        gap: 8px 14px;
        margin-bottom: 24px;
        align-items: center;
      }
      .label {
        font-weight: 700;
        font-size: 13px;
      }
      .value {
        font-size: 13px;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin: 24px 0;
        align-items: stretch;
      }
      .summaryCard {
        border: 1px solid #d1d5db;
        border-radius: 12px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .summaryLabel {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        color: #6b7280;
      }
      .summaryValue {
        margin-top: 6px;
        font-size: 28px;
        font-weight: 800;
      }
      h2 {
        margin: 28px 0 12px;
        font-size: 20px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border: 1px solid #d1d5db;
        padding: 10px 12px;
        text-align: left;
        font-size: 13px;
        vertical-align: middle;
      }
      th {
        background: #f9fafb;
        font-weight: 700;
      }
      .qty {
        width: 120px;
        text-align: center;
        font-weight: 700;
      }
      .photoCell {
        width: 90px;
        text-align: center;
      }
      .modelPhoto {
        width: 64px;
        height: 64px;
        object-fit: cover;
        border-radius: 8px;
        border: 1px solid #d1d5db;
        display: block;
      }
      .photoPlaceholder {
        width: 64px;
        height: 64px;
        border-radius: 8px;
        border: 1px solid #d1d5db;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
        color: #9ca3af;
        background: #f9fafb;
      }
      .totalRow td {
        background: #f8fafc;
        border-top: 2px solid #111827;
      }
      .totalLabel {
        font-size: 16px;
      }
      .totalQty strong {
        font-size: 22px;
        line-height: 1;
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <h1>Inbound Report</h1>

      <div class="meta">
        <div class="label">No GRN</div><div class="value">${selectedInbound.grn_number || '-'}</div>
        <div class="label">Supplier</div><div class="value">${supplierName}</div>
        <div class="label">Item Name</div><div class="value">${selectedInbound.item_name || '-'}</div>
      </div>

      <div class="summary">
        <div class="summaryCard">
          <div class="summaryLabel">Total SJ Qty</div>
          <div class="summaryValue">${selectedInbound.total_claimed_qty ?? 'No data'}</div>
        </div>
        <div class="summaryCard">
          <div class="summaryLabel">Total Receiving Qty</div>
          <div class="summaryValue">${selectedInbound.total_received_qty || 0}</div>
        </div>
        <div class="summaryCard">
          <div class="summaryLabel">Total Intake Qty</div>
          <div class="summaryValue">${totalInboundQty}</div>
        </div>
      </div>

      <h2>Model Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Photo</th>
            <th>Brand Name</th>
            <th>Categories</th>
            <th>Model - Variant</th>
            <th class="qty">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRowsHtml}
          <tr class="totalRow">
            <td colspan="4"><strong class="totalLabel">Shown Qty</strong></td>
            <td class="qty totalQty"><strong>${filteredPrintTotalQty}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
    <script>window.onload = function () { window.print(); };</script>
  </body>
</html>`

    printWindow.document.open()
    printWindow.document.write(printHtml)
    printWindow.document.close()
  }

  function handleSaveModel() {
    setModelModalError('')

    if (!canRegistryModelVariant) {
      setModelModalError('This role can choose existing variants, but cannot register or edit model variants.')
      return
    }

    const chosenExistingModel = registryUsesNewModel ? null : registrySelectedModel
    const normalizedModelName = registryUsesNewModel
      ? modelDraft.model_name.trim().toUpperCase()
      : String(chosenExistingModel?.model_name || '').trim().toUpperCase()
    const normalizedVariantName = modelDraft.variant_name.trim().toUpperCase()

    if (!selectedBrandId || !selectedCategory) {
      setModelModalError('Choose brand and category first before registering a variant.')
      return
    }

    if (!isEditingVariant && !modelDraft.variant_photo_url) {
      setModelModalError('Variant photo is required.')
      return
    }

    if (!isEditingVariant && !registryUsesNewModel && !chosenExistingModel) {
      setModelModalError('Choose a model from the list, or add a new model.')
      return
    }

    if (!isEditingVariant && !normalizedModelName) {
      setModelModalError('Model name is required.')
      return
    }

    if (!normalizedVariantName) {
      setModelModalError('Variant name is required.')
      return
    }

    const saveModel = async () => {
      setSaving(true)

      let savedModel = chosenExistingModel

      if (!savedModel) {
        savedModel = productModels.find(
          (model) =>
            Number(model.brand_id || 0) === Number(selectedBrandId) &&
            Number(model.category_id || 0) === Number(selectedCategory.id) &&
            String(model.model_name || '').trim().toUpperCase() === normalizedModelName
        )
      }

      if (!savedModel) {
        const nextModel = {
          brand_id: Number(selectedBrandId),
          category_id: selectedCategory.id,
          model_name: normalizedModelName,
          model_notes: modelDraft.model_notes.trim() || null,
          is_active: true,
        }

        const { data: insertedModel, error: insertError } = await supabase
          .from('dir_product_models')
          .insert([nextModel])
          .select('id, brand_id, category_id, model_code, model_name, model_notes')
          .single()

        if (insertError) {
          setModelModalError(insertError.message)
          setSaving(false)
          return
        }

        savedModel = insertedModel
        setProductModels((prev) => [...prev, insertedModel])
      }

      const siblingVariants = productModelVariants.filter(
        (variant) => Number(variant.product_model_id || 0) === Number(savedModel.id || 0)
      )
      let resolvedVariantStorageCode = ''

      try {
        resolvedVariantStorageCode = isEditingVariant
          ? getVariantProductId(editingVariantContext?.variant) || normalizedVariantName
          : getNextVariantCode(savedModel, siblingVariants)
      } catch (variantCodeError) {
        setModelModalError(variantCodeError.message || 'Failed to generate variant code.')
        setSaving(false)
        return
      }

      let variantPhotoUrl = ''

      if (variantPhotoFile) {
        const fileExt = variantPhotoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`
        const filePath = [
          getSafeStorageSegment(selectedBrand?.brand_code || selectedBrand?.brand_name || selectedBrandId, 'brand'),
          getSafeStorageSegment(selectedCategory.full_code || selectedCategory.category_code || selectedCategory.category_name || selectedCategory.id, 'category'),
          getSafeStorageSegment(savedModel.model_code || savedModel.id || normalizedModelName, 'model'),
          'variants',
          getSafeStorageSegment(resolvedVariantStorageCode || normalizedVariantName, 'variant'),
          fileName,
        ].join('/')

        const { error: uploadError } = await supabase.storage
          .from(PRODUCT_PHOTOS_BUCKET)
          .upload(filePath, variantPhotoFile, { upsert: false })

        if (uploadError) {
          setModelModalError(uploadError.message)
          setSaving(false)
          return
        }

        const { data: publicUrlData } = supabase.storage
          .from(PRODUCT_PHOTOS_BUCKET)
          .getPublicUrl(filePath)

        variantPhotoUrl = publicUrlData.publicUrl || ''
      } else if (modelDraft.variant_photo_url) {
        variantPhotoUrl = modelDraft.variant_photo_url
      }

      if (isEditingVariant) {
        const variantPayload = {
          variant_name: normalizedVariantName,
          variant_notes: modelDraft.variant_notes.trim() || null,
          variant_photo_url: variantPhotoUrl || null,
          updated_at: new Date().toISOString(),
        }

        const { data: updatedVariant, error: updateVariantError } = await supabase
          .from('dir_product_model_variants')
          .update(variantPayload)
          .eq('id', editingVariantContext.variant.id)
          .select('*')
          .single()

        if (updateVariantError) {
          setModelModalError(updateVariantError.message)
          setSaving(false)
          return
        }

        const editedModel = editingVariantContext.model
        const editedVariantProductId = getVariantProductId(updatedVariant)

        setProductModelVariants((prev) =>
          prev.map((variant) => (Number(variant.id) === Number(updatedVariant.id) ? updatedVariant : variant))
        )
        setSelectedModel({
          ...editedModel,
          photo_url: updatedVariant.variant_photo_url || '',
        })
        setSelectedVariantLabel(editedVariantProductId)
        setModelDraft(createModelDraft())
        setEditingVariantContext(null)
        setVariantPhotoFile(null)
        setShowModelModal(false)
        setShowChooseModelModal(false)
        setModelModalError('')
        setError('')
        setSuccess('Variant updated successfully.')
        setSaving(false)
        return
      }

      const automaticVariantCode = resolvedVariantStorageCode
      const nextVariant = {
        product_model_id: savedModel.id,
        variant_code: automaticVariantCode,
        variant_name: normalizedVariantName,
        variant_notes: modelDraft.variant_notes.trim() || null,
        variant_photo_url: variantPhotoUrl || null,
        is_active: true,
      }

      const { data: insertedVariant, error: variantError } = await supabase
        .from('dir_product_model_variants')
        .insert([nextVariant])
        .select('*')
        .single()

      if (variantError) {
        setModelModalError(variantError.message)
        setSaving(false)
        return
      }

      setProductModelVariants((prev) => [...prev, insertedVariant])
      const insertedVariantProductId = getVariantProductId(insertedVariant) || automaticVariantCode
      setSelectedModel({
        ...savedModel,
        photo_url: insertedVariant.variant_photo_url || savedModel.photo_url || '',
      })
      setSelectedVariantLabel(insertedVariantProductId)
      setModelDraft(createModelDraft())
      setVariantPhotoFile(null)
      setShowModelModal(false)
      setShowChooseModelModal(false)
      setModelModalError('')
      setError('')
      setSuccess('Variant saved successfully.')
      setSaving(false)
    }

    saveModel()
  }

  async function handleAddToUnload() {
    setError('')
    setSuccess('')

    if (!selectedInbound) {
      setError('Please choose GRN Number first.')
      return
    }

    if (!user) {
      setError('Loading user profile. Please wait a moment.')
      return
    }

    if (!selectedBrandId) {
      setError('Please choose a brand.')
      return
    }

    if (!isReturn && !selectedCategory) {
      setError('Please choose the category levels first.')
      return
    }

    if (!isReturn && !selectedModel?.model_name) {
      setError('Please choose or add a model first.')
      return
    }

    if (!qty || Number(qty) <= 0) {
      setError('Qty must be greater than 0.')
      return
    }

    setSaving(true)

    const payload = {
      inbound_id: selectedInbound.id,
      brand_id: selectedBrandId ? Number(selectedBrandId) : null,
      category_id: selectedCategory?.id || null,
      model_name: selectedModel?.model_name || null,
      variant_code: selectedVariant ? getVariantProductId(selectedVariant) || selectedVariantLabel || null : selectedVariantLabel || null,
      variant_label: selectedVariant ? getVariantProductId(selectedVariant) || selectedVariantLabel || null : selectedVariantLabel || null,
      variant_name: selectedVariant ? getVariantDisplayName(selectedVariant) : selectedVariantDisplayName || null,
      qty: Number(qty),
      pic_name: displayName,
      photo_url: selectedModelPhoto || selectedModel?.photo_url || null,
    }

    if (!isReturn && !isSample) {
      const payloadProductKey = getProductAggregationKey(payload)
      const existingItem = currentKoliItems.find((item) => getProductAggregationKey(item) === payloadProductKey)

      if (existingItem) {
        const shouldAggregate = window.confirm('Product yang sama sudah ada di Koli ini. Mau digabungkan qty-nya?')

        if (!shouldAggregate) {
          setSaving(false)
          return
        }

        setCurrentKoliItems((prev) =>
          prev.map((item) =>
            item.tempId === existingItem.tempId
              ? { ...item, qty: Number(item.qty || 0) + Number(payload.qty || 0) }
              : item
          )
        )
        resetEntryForm({ keepPath: true })
        setSuccess('Qty aggregated with the existing item.')
        setSaving(false)
        return
      }

      setCurrentKoliItems((prev) => [
        ...prev,
        {
          tempId: `${Date.now()}-${prev.length}`,
          ...payload,
        },
      ])
      resetEntryForm({ keepPath: true })
      setSuccess('Item added to this Koli.')
      setSaving(false)
      return
    }

    let insertResult = null

    if (isReturn) {
      const { data: latestReturnRows, error: sequenceError } = await supabase
        .from('warehouse_returns')
        .select('koli_sequence')
        .eq('inbound_id', selectedInbound.id)
        .eq('source_phase', 'inbound')

      if (sequenceError) {
        setError(sequenceError.message)
        setSaving(false)
        return
      }

      const assignedReturnSequence =
        (latestReturnRows || []).reduce(
          (max, row) => Math.max(max, Number(row.koli_sequence || 0)),
          0
        ) + 1

      insertResult = await supabase.from('warehouse_returns').insert([
        {
          inbound_id: payload.inbound_id,
          brand_id: payload.brand_id,
          category_id: payload.category_id,
          model_name: payload.model_name,
          ...(supportsReturnVariant ? { variant_label: payload.variant_label } : {}),
          ...(supportsReturnVariantCode ? { variant_code: payload.variant_code } : {}),
          ...(supportsReturnVariantName ? { variant_name: payload.variant_name } : {}),
          qty: payload.qty,
          pic_name: payload.pic_name,
          source_phase: 'inbound',
          koli_sequence: assignedReturnSequence,
        },
      ])
    } else {
      insertResult = await supabase.from('inbound_unload').insert([
        {
          inbound_id: payload.inbound_id,
          brand_id: payload.brand_id,
          category_id: payload.category_id,
          model_name: payload.model_name,
          ...(supportsUnloadVariant ? { variant_label: payload.variant_label } : {}),
          ...(supportsUnloadVariantCode ? { variant_code: payload.variant_code } : {}),
          ...(supportsUnloadVariantName ? { variant_name: payload.variant_name } : {}),
          qty: payload.qty,
          pic_name: payload.pic_name,
          photo_url: payload.photo_url,
          is_sample: true,
          koli_sequence: null,
        },
      ])
    }

    const insertError = insertResult?.error

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    try {
      await refreshUnloadData(selectedInbound.id)
    } catch (refreshError) {
      setError(refreshError.message)
      setSaving(false)
      return
    }

    resetEntryForm({ keepPath: !isReturn, keepBrandOnly: isReturn })
    setSuccess(isReturn ? 'Return row added successfully.' : 'Sample row added successfully.')
    setSaving(false)
  }

  async function handlePostCurrentKoli() {
    setError('')
    setSuccess('')

    if (!selectedInbound) {
      setError('Please choose GRN Number first.')
      return
    }

    if (!currentKoliItems.length) {
      setError('Current Koli does not have any item yet.')
      return
    }

    const shouldPost = window.confirm(
      `Post this Koli with ${currentKoliItems.length} item${currentKoliItems.length > 1 ? 's' : ''}, total qty ${currentKoliQty}?`
    )

    if (!shouldPost) {
      return
    }

    setSaving(true)

    const { data: latestKoliRows, error: sequenceError } = await supabase
      .from('inbound_unload')
      .select('koli_sequence')
      .eq('inbound_id', selectedInbound.id)
      .eq('is_sample', false)

    if (sequenceError) {
      setError(sequenceError.message)
      setSaving(false)
      return
    }

    const assignedKoliSequence =
      (latestKoliRows || []).reduce(
        (max, row) => Math.max(max, Number(row.koli_sequence || 0)),
        0
      ) + 1

    const payload = currentKoliItems.map((item) => ({
      inbound_id: item.inbound_id,
      brand_id: item.brand_id,
      category_id: item.category_id,
      model_name: item.model_name,
      ...(supportsUnloadVariant ? { variant_label: item.variant_label || null } : {}),
      ...(supportsUnloadVariantCode ? { variant_code: item.variant_code || item.variant_label || null } : {}),
      ...(supportsUnloadVariantName ? { variant_name: item.variant_name || null } : {}),
      qty: item.qty,
      pic_name: item.pic_name,
      photo_url: item.photo_url,
      is_sample: false,
      koli_sequence: assignedKoliSequence,
    }))

    const { error: insertError } = await supabase.from('inbound_unload').insert(payload)

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    try {
      await refreshUnloadData(selectedInbound.id)
    } catch (refreshError) {
      setError(refreshError.message)
      setSaving(false)
      return
    }

    setCurrentKoliItems([])
    resetEntryForm({ keepPath: true })
    setSuccess('Koli posted successfully.')
    setSaving(false)
  }

  function handleRemoveCurrentKoliItem(tempId) {
    setCurrentKoliItems((prev) => prev.filter((item) => item.tempId !== tempId))
  }

  function handleEditCurrentKoliItem(row) {
    selectProductShortcut(row)
    setQty(row.qty ? String(row.qty) : '')
    setIsReturn(false)
    setIsSample(false)
    setCurrentKoliItems((prev) => prev.filter((item) => item.tempId !== row.tempId))
    setSuccess('Item moved back to input for editing.')
  }

  function handleAddShortcut(event) {
    if (event.key !== 'Enter') return

    event.preventDefault()
    handleAddToUnload()
  }

  return (
    <div style={isBuilderMode ? styles.mobileWrapper : styles.wrapper}>
      {isBuilderMode ? (
        <header style={styles.mobileTopBar}>
          <button type="button" onClick={handleBackToSorting} style={styles.backButton} aria-label="Back to sorting">
            <ArrowLeftIcon />
          </button>
          <div>
            <p style={styles.eyebrow}>Inbound</p>
            <h1 style={{ ...styles.title, fontSize: '22px' }}>Intake Input</h1>
          </div>
          <span style={styles.grnChip}>{selectedInbound?.grn_number || grnParam || '-'}</span>
        </header>
      ) : null}

      {isBuilderMode ? (
      <>
        {loading ? <p style={{ ...styles.emptyText, ...styles.mobileInlineMessage }}>Loading unload setup...</p> : null}
        {error && !selectedInbound ? <p style={{ ...styles.errorText, ...styles.mobileInlineMessage }}>{error}</p> : null}

        {selectedInbound ? (
          <>
            <section style={styles.mobileInfoBand}>
              <div style={styles.mobileInfoBox}>
                <span style={{ ...styles.mobileInfoLabel, ...styles.mobileInfoLabelTight }}>Supplier</span>
                <strong style={{ ...styles.mobileInfoValue, ...styles.mobileInfoValueTight }}>{selectedInbound.suppliers?.supplier_name || '-'}</strong>
              </div>
              <div style={styles.mobileInfoBox}>
                <span style={{ ...styles.mobileInfoLabel, ...styles.mobileInfoLabelTight }}>Input As</span>
                <strong style={{ ...styles.mobileInfoValue, ...styles.mobileInfoValueTight }}>{displayFirstName}</strong>
              </div>
              <div style={styles.mobileInfoMetric}>
                <span style={{ ...styles.mobileInfoLabel, ...styles.mobileInfoLabelTight }}>Intake Qty</span>
                <strong style={{ ...styles.mobileInfoValue, ...styles.mobileInfoValueTight }}>{formatNumber(totalInboundQty)}</strong>
              </div>
              <div style={styles.mobileInfoMetric}>
                <span style={{ ...styles.mobileInfoLabel, ...styles.mobileInfoLabelTight }}>Remaining Qty</span>
                <strong style={{ ...styles.mobileInfoValue, ...styles.mobileInfoValueTight, ...remainingQtyStyle }}>
                  {hasSelectedSjQty ? formatNumber(remainingQty) : 'No data'}
                </strong>
              </div>
            </section>
          </>
        ) : !loading ? (
          <section style={styles.mobileDetailBand}>
            <div style={{ ...styles.mobileInfoBox, gridColumn: '1 / -1' }}>
              <span style={styles.mobileInfoLabel}>GRN Number</span>
              <strong style={styles.mobileInfoValue}>{grnParam || '-'}</strong>
              <p style={styles.emptyText}>Selected GRN is not available.</p>
            </div>
          </section>
        ) : null}
      </>
      ) : (
      <div style={styles.overviewPanel}>
        <div style={styles.formTopBar}>
          <div>
            <p style={styles.eyebrow}>Inbound</p>
            <h1 style={styles.title}>Sorting & Breakdown</h1>
          </div>
          <div style={styles.overviewActions}>
            <button
              type="button"
              onClick={() => setShowPerformanceModal(true)}
              style={styles.performanceButton}
              aria-label="Show inbound performance"
              title="Inbound performance"
            >
              <PerformanceIcon />
              Performance
            </button>
            {breakdownMode === 'model' ? (
              <button type="button" onClick={handlePrintUnloadDocument} style={styles.secondaryButton}>
                Print
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleOpenBuilder}
              style={{ ...styles.builderButton, ...styles.iconOnlyButton }}
              aria-label="Open unload builder"
              title="Builder"
            >
              <BuilderIcon />
            </button>
            <button
              type="button"
              onClick={handleCloseSorting}
              style={styles.closeIconButton}
              aria-label="Close sorting"
              title="Close"
            >
              <span style={styles.closeIconGlyph}>X</span>
            </button>
          </div>
        </div>

        {loading ? <p style={styles.emptyText}>Loading sorting setup...</p> : null}
        {error ? <p style={styles.errorText}>{error}</p> : null}

        <div style={styles.contentGrid}>
          <section style={styles.headerColumn}>
            <div style={styles.grnCard}>
              <span style={styles.grnLabel}>GRN Number</span>
              <strong style={styles.grnValue}>{selectedInbound?.grn_number || '-'}</strong>
              <div style={styles.grnItemBlock}>
                <span style={styles.grnLabel}>Item Name</span>
                <strong style={styles.infoValue}>{selectedInbound?.item_name || '-'}</strong>
              </div>
            </div>

            <div style={styles.headerInfoColumn}>
              <div style={styles.infoGrid}>
                <div style={styles.infoBox}>
                  <span style={styles.infoLabel}>Inbound Date</span>
                  <strong style={styles.infoValue}>{formatDateDisplay(selectedInbound?.inbound_date)}</strong>
                </div>
                <div style={styles.infoBox}>
                  <span style={styles.infoLabel}>Supplier</span>
                  <strong style={styles.infoValue}>{selectedInbound?.suppliers?.supplier_name || '-'}</strong>
                </div>
              </div>

              <div style={styles.metricGrid}>
                <div style={styles.metricBox}>
                  <span style={styles.infoLabel}>SJ Qty</span>
                  <strong style={styles.metricValue}>{selectedInbound?.total_claimed_qty ?? 'No data'}</strong>
                </div>
                <div style={styles.metricBox}>
                  <span style={styles.infoLabel}>Received Qty</span>
                  <strong style={styles.metricValue}>{selectedInbound?.total_received_qty || 0}</strong>
                </div>
                <div style={styles.metricBox}>
                  <span style={styles.infoLabel}>Intake Qty</span>
                  <strong style={styles.metricValue}>{totalInboundQty}</strong>
                </div>
                <div style={styles.metricBox}>
                  <span style={styles.infoLabel}>Retur Qty</span>
                  <strong style={styles.metricValue}>{totalReturnQty}</strong>
                </div>
              </div>
            </div>
          </section>

          <section style={styles.breakdownColumn}>
            <div style={styles.breakdownToolbar}>
              <div style={styles.segmentWrap} aria-label="Breakdown view">
                <button
                  type="button"
                  onClick={() => setBreakdownMode('koli')}
                  style={{
                    ...styles.segmentButton,
                    ...(breakdownMode === 'koli' ? styles.segmentButtonActive : {}),
                  }}
                >
                  Koli
                </button>
                <button
                  type="button"
                  onClick={() => setBreakdownMode('model')}
                  style={{
                    ...styles.segmentButton,
                    ...(breakdownMode === 'model' ? styles.segmentButtonActive : {}),
                  }}
                >
                  Model
                </button>
              </div>

              <div style={styles.breakdownFilters}>
                <select
                  value={breakdownFilters.brandId}
                  onChange={(event) => updateBreakdownFilter('brandId', event.target.value)}
                  style={styles.filterSelect}
                  aria-label="Filter by brand"
                >
                  <option value="">All Brands</option>
                  {sortedBrandFilterOptions.map((brand) => (
                    <option key={brand.id} value={String(brand.id)}>
                      {brand.brand_name || '-'}
                    </option>
                  ))}
                </select>
                <select
                  value={breakdownFilters.categoryId}
                  onChange={(event) => updateBreakdownFilter('categoryId', event.target.value)}
                  style={styles.filterSelect}
                  aria-label="Filter by category"
                >
                  <option value="">All Categories</option>
                  {sortedCategoryFilterOptions.map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {category.full_name || category.category_name || '-'}
                    </option>
                  ))}
                </select>
                <select
                  value={breakdownFilters.modelName}
                  onChange={(event) => updateBreakdownFilter('modelName', event.target.value)}
                  style={styles.filterSelect}
                  aria-label="Filter by model"
                >
                  <option value="">All Models</option>
                  {sortedModelFilterOptions.map((modelName) => (
                    <option key={modelName} value={modelName}>
                      {modelName}
                    </option>
                  ))}
                </select>
                <div style={styles.qtyFilterGroup}>
                  <select
                    value={breakdownFilters.qtyMode}
                    onChange={(event) => {
                      updateBreakdownFilter('qtyMode', event.target.value)
                      if (!event.target.value) {
                        updateBreakdownFilter('qtyValue', '')
                      }
                    }}
                    style={styles.filterSelect}
                    aria-label="Filter quantity comparison"
                  >
                    <option value="">Qty</option>
                    <option value="lt">Less than</option>
                    <option value="eq">Equal</option>
                    <option value="gt">Greater than</option>
                  </select>
                  <input
                    value={breakdownFilters.qtyValue}
                    onChange={(event) => updateBreakdownFilter('qtyValue', event.target.value.replace(/[^\d]/g, ''))}
                    disabled={!breakdownFilters.qtyMode}
                    style={{
                      ...styles.filterNumberInput,
                      ...(!breakdownFilters.qtyMode ? styles.filterNumberInputDisabled : {}),
                    }}
                    inputMode="numeric"
                    placeholder="0"
                    aria-label="Filter quantity number"
                  />
                </div>
                <button
                  type="button"
                  onClick={resetBreakdownFilters}
                  disabled={!hasBreakdownFilters}
                  style={{
                    ...styles.resetFilterButton,
                    ...(!hasBreakdownFilters ? styles.resetFilterButtonDisabled : {}),
                  }}
                  aria-label="Reset filters"
                  title="Reset filters"
                >
                  <ResetIcon />
                </button>
              </div>
            </div>

            {!selectedInbound ? (
              <div style={styles.helperBox}>
                <p style={styles.emptyText}>Choose a GRN number to see sorting data.</p>
              </div>
            ) : breakdownMode === 'koli' ? (
              filteredKoliGroups.length || filteredNonKoliGroups.length ? (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, ...styles.koliHeader }}>Koli</th>
                        <th style={styles.th}>Picture</th>
                        <th style={styles.th}>Inside</th>
                        <th style={{ ...styles.th, ...styles.centerHeader }}>Qty</th>
                        <th style={{ ...styles.th, ...styles.centerHeader }}>PIC</th>
                        <th style={{ ...styles.th, ...styles.centerHeader }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredKoliGroups.map((group) => (
                        <tr key={`koli-${group.koli_sequence}`}>
                          <td style={{ ...styles.td, ...styles.koliGroupTd, ...styles.koliCell }}>Koli {group.koli_sequence}</td>
                          <td style={{ ...styles.td, ...styles.koliGroupTd }}>
                            <div style={styles.tableLineStack}>
                              {group.items.map((row) => (
                                <div key={`photo-${row.id}`} style={styles.tablePhotoLine}>
                                  {renderProductPhotoFrame(row)}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td style={{ ...styles.td, ...styles.koliGroupTd }}>
                            <div style={styles.tableLineStack}>
                              {group.items.map((row) => {
                                const brand = brands.find((item) => item.id === row.brand_id)

                                return (
                                  <div key={row.id} style={styles.tableDetailLine}>
                                    <strong>{brand?.brand_name || '-'}</strong>
                                    <span style={styles.itemMeta}>{getItemTypeSubcategoryLabel(row.category_id)}</span>
                                    <span style={styles.itemMeta}>{getModelVariantLabelForRow(row)}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          <td style={{ ...styles.td, ...styles.koliGroupTd, ...styles.middleCenterCell }}>
                            <div style={styles.tableLineStack}>
                              {group.items.map((row) => (
                                <div key={`qty-${row.id}`} style={styles.tableQtyLine}>
                                  <span
                                    style={{ ...styles.qtyPill, ...getQtyPillQcStyle(row) }}
                                    title={getQcVarianceTitle(row)}
                                  >
                                    {row.qty || 0}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td style={{ ...styles.td, ...styles.koliGroupTd, ...styles.middleCenterCell }}>{formatPicFirstNames(group.pic_list)}</td>
                          <td style={{ ...styles.td, ...styles.koliGroupTd, ...styles.middleCenterCell }}>
                            <button type="button" onClick={() => handlePrintKoli(group)} style={styles.printButton}>
                              Print
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredNonKoliGroups.map((group) => (
                        <tr key={group.rowType}>
                          <td style={{ ...styles.td, ...styles.koliGroupTd, ...styles.koliCell }}>
                            {group.rowType === 'sample' ? <span style={styles.sampleBadge}>Sample</span> : <span style={styles.returnBadge}>Retur</span>}
                          </td>
                          <td style={{ ...styles.td, ...styles.koliGroupTd }}>
                            <div style={styles.tableLineStack}>
                              {group.items.map((row) => (
                                <div key={`${group.rowType}-photo-${row.id}`} style={styles.tablePhotoLine}>
                                  {renderProductPhotoFrame(row)}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td style={{ ...styles.td, ...styles.koliGroupTd }}>
                            <div style={styles.tableLineStack}>
                              {group.items.map((row) => {
                                const brand = brands.find((item) => item.id === row.brand_id)

                                return (
                                  <div key={`${group.rowType}-${row.id}`} style={styles.tableDetailLine}>
                                    <strong>{brand?.brand_name || '-'}</strong>
                                    <span style={styles.itemMeta}>{getItemTypeSubcategoryLabel(row.category_id)}</span>
                                    <span style={styles.itemMeta}>{getModelVariantLabelForRow(row)}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          <td style={{ ...styles.td, ...styles.koliGroupTd, ...styles.middleCenterCell }}>
                            <div style={styles.tableLineStack}>
                              {group.items.map((row) => (
                                <div key={`${group.rowType}-qty-${row.id}`} style={styles.tableQtyLine}>
                                  <span
                                    style={{
                                      ...styles.qtyPill,
                                      ...(group.rowType === 'sample' ? getQtyPillQcStyle(row) : {}),
                                    }}
                                    title={group.rowType === 'sample' ? getQcVarianceTitle(row) : undefined}
                                  >
                                    {row.qty || 0}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td style={{ ...styles.td, ...styles.koliGroupTd, ...styles.middleCenterCell }}>{formatPicFirstNames(group.pic_list)}</td>
                          <td style={{ ...styles.td, ...styles.koliGroupTd, ...styles.middleCenterCell }}>-</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={styles.helperBox}>
                  <p style={styles.emptyText}>No sorting rows match the selected filters.</p>
                </div>
              )
            ) : filteredModelGroups.length ? (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Brand</th>
                      <th style={styles.th}>Picture</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Model</th>
                      <th style={styles.th}>Variant</th>
                      <th style={styles.th}>Total Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModelGroups.map((group) => {
                      const brand = brands.find((item) => item.id === group.brand_id)
                      const category = categoryMaps.byId.get(group.category_id)
                      const variantName = getVariantNameForRow(group)

                      return (
                        <tr key={group.key}>
                          <td style={{ ...styles.td, ...styles.koliGroupTd }}>{brand?.brand_name || '-'}</td>
                          <td style={{ ...styles.td, ...styles.koliGroupTd }}>{renderProductPhotoFrame(group)}</td>
                          <td style={{ ...styles.td, ...styles.koliGroupTd }}>{category?.full_name || category?.category_name || '-'}</td>
                          <td style={{ ...styles.td, ...styles.koliGroupTd }}>
                            <strong>{group.model_name || '-'}</strong>
                          </td>
                          <td style={{ ...styles.td, ...styles.koliGroupTd }}>{variantName || '-'}</td>
                          <td style={{ ...styles.td, ...styles.koliGroupTd }}>{group.total_qty || 0}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={styles.helperBox}>
                <p style={styles.emptyText}>No model rows match the selected filters.</p>
              </div>
            )}
          </section>
        </div>
      </div>
      )}

      {isBuilderMode && selectedInbound ? (
      <div style={styles.card}>
        <div style={styles.unloadWorkspace}>
          <div style={styles.workPanel}>
        <div style={styles.field}>
          <label style={styles.label}>Mode</label>
          <div style={styles.modeSegmentWrap} role="tablist" aria-label="Unload mode">
            <button
              type="button"
              onClick={() => handleModeChange('regular')}
              disabled={isModeLocked}
              style={{
                ...styles.modeSegmentButton,
                ...(addMode === 'regular' ? styles.modeSegmentRegularActive : {}),
                ...(isModeLocked ? styles.disabledSegment : {}),
              }}
              aria-selected={addMode === 'regular'}
              role="tab"
            >
              Regular
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('sample')}
              disabled={isModeLocked}
              style={{
                ...styles.modeSegmentButton,
                ...(addMode === 'sample' ? styles.modeSegmentSampleActive : {}),
                ...(isModeLocked ? styles.disabledSegment : {}),
              }}
              aria-selected={addMode === 'sample'}
              role="tab"
            >
              Sample
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('return')}
              disabled={isModeLocked}
              style={{
                ...styles.modeSegmentButton,
                ...(addMode === 'return' ? styles.modeSegmentReturnActive : {}),
                ...(isModeLocked ? styles.disabledSegment : {}),
              }}
              aria-selected={addMode === 'return'}
              role="tab"
            >
              Retur
            </button>
          </div>
        </div>

        {!isReturn && recentProductOptions.length ? (
          <div style={styles.shortcutBlock}>
            <div style={styles.shortcutHeader}>
              <span style={styles.shortcutTitle}>Recent Chosen Product</span>
            </div>
            <div style={styles.shortcutGrid}>
              {recentProductOptions.slice(0, 3).map((row) => {
                const category = categoryMaps.byId.get(Number(row.category_id))
                const modelLabel = getModelVariantLabelForRow(row)
                const photoUrl = getVariantPhotoForRow(row)

                return (
                  <button
                    key={row.recentProductKey || `${row.brand_id}-${row.category_id}-${row.model_name}-${getRowVariantIdentifier(row)}`}
                    type="button"
                    onClick={() => selectProductShortcut(row)}
                    style={styles.shortcutCard}
                  >
                    {photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt={modelLabel}
                        width={96}
                        height={96}
                        unoptimized
                        style={styles.shortcutImage}
                      />
                    ) : (
                      <span style={styles.shortcutPlaceholder}>NO PHOTO</span>
                    )}
                    <span style={styles.shortcutName}>{modelLabel}</span>
                    <span style={styles.shortcutMeta}>{getCategoryDisplayLabel(category)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div style={builderGridStyle}>
          <div style={styles.field}>
            <label style={styles.label}>Brand</label>
            <div style={styles.searchPicker}>
              <input
                value={brandSearch}
                onChange={(event) => {
                  setBrandSearch(event.target.value)
                  setSelectedBrandId('')
                  setLevel0Id('')
                  setLevel1Id('')
                  setLevel2Id('')
                  setSelectedModel(null)
                  setSelectedVariantLabel('')
                  setShowBrandResults(true)
                }}
                onFocus={() => {
                  setBrandSearch('')
                  setSelectedBrandId('')
                  setLevel0Id('')
                  setLevel1Id('')
                  setLevel2Id('')
                  setSelectedModel(null)
                  setSelectedVariantLabel('')
                  setShowBrandResults(true)
                }}
                onBlur={() => {
                  window.setTimeout(() => setShowBrandResults(false), 120)
                }}
                style={styles.input}
                placeholder="Search brand"
                autoComplete="off"
              />
              {showBrandResults ? (
                <div style={styles.searchResults}>
                  {filteredBrandOptions.length ? (
                    filteredBrandOptions.map((brand) => {
                      const isSelected = Number(brand.id) === Number(selectedBrand?.id || 0)

                      return (
                        <button
                          key={brand.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleBrandSelectChange(String(brand.id))}
                          style={{
                            ...styles.searchOption,
                            ...(isSelected ? styles.searchOptionActive : {}),
                          }}
                        >
                          {getBrandDisplayLabel(brand)}
                        </button>
                      )
                    })
                  ) : (
                    <p style={styles.searchEmpty}>No brand found.</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {!isReturn && selectedBrandId ? (
            <div style={styles.field}>
              <label style={styles.label}>Category</label>
              <select
                value={level0Id}
                onChange={(event) => {
                  setLevel0Id(event.target.value)
                  setLevel1Id('')
                  setLevel2Id('')
                  setSelectedModel(null)
                  setSelectedVariantLabel('')
                }}
                style={styles.select}
              >
                <option value="">Choose category</option>
                {level0Options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.category_name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {!isReturn && level0Id && level1Options.length ? (
            <div style={styles.field}>
              <label style={styles.label}>Subcategory</label>
              <select
                value={level1Id}
                onChange={(event) => {
                  setLevel1Id(event.target.value)
                  setLevel2Id('')
                  setSelectedModel(null)
                  setSelectedVariantLabel('')
                }}
                style={styles.select}
              >
                <option value="">Choose subcategory</option>
                {level1Options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.category_name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div style={builderGridStyle}>
          {!isReturn && level1Id && level2Options.length ? (
            <div style={styles.field}>
              <label style={styles.label}>Item Type</label>
              <select
                value={level2Id}
                onChange={(event) => {
                  setLevel2Id(event.target.value)
                  setSelectedModel(null)
                  setSelectedVariantLabel('')
                }}
                style={styles.select}
              >
                <option value="">Choose item type</option>
                {level2Options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.category_name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {!isReturn && selectedCategory ? (
          <div style={styles.field}>
            <div style={styles.modelLabelRow}>
              <label style={styles.label}>Model</label>
              <span style={styles.categoryHint}>{selectedCategoryLabel}</span>
            </div>
            <div style={styles.modelActionRow}>
              {selectedModel ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowChooseModelModal(true)
                    setError('')
                  }}
                  style={styles.selectedModelCard}
                  aria-label="Change selected variant"
                  title="Change selected variant"
                >
                  {selectedModelPhoto ? (
                    <Image
                      src={selectedModelPhoto}
                      alt={selectedVariantDisplayName ? `${selectedModel.model_name || 'Model'} / ${selectedVariantDisplayName}` : selectedModel.model_name || 'Selected variant'}
                      width={64}
                      height={64}
                      unoptimized
                      style={styles.selectedModelThumb}
                    />
                  ) : (
                    <span style={styles.selectedModelPlaceholder}>NO PHOTO</span>
                  )}
                  {selectedVariantDisplayName ? <span style={styles.selectedModelBadge}>{selectedVariantDisplayName}</span> : null}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedBrandId || !selectedCategory) {
                      setError('Choose brand and category first before selecting a model.')
                      return
                    }

                    setShowChooseModelModal(true)
                    setError('')
                  }}
                  style={styles.selectedModelCard}
                  aria-label="Choose variant"
                  title="Choose variant"
                >
                  <span style={styles.selectedModelPlaceholder}>Choose Variant</span>
                </button>
              )}
            </div>
          </div>
          ) : null}

        </div>
          </div>

          <div style={styles.addPanel}>
        <div style={builderGridStyle}>
          <div style={styles.field}>
            <label style={styles.label}>Qty</label>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              onWheel={(event) => event.currentTarget.blur()}
              onKeyDown={(event) => {
                if (['-', '+', 'e', 'E'].includes(event.key)) {
                  event.preventDefault()
                  return
                }

                handleAddShortcut(event)
              }}
              style={{ ...styles.input, ...styles.qtyInput }}
              placeholder="0"
            />
          </div>
        </div>

        <div style={styles.buttonRow}>
          {error ? <p style={styles.errorText}>{error}</p> : null}
            {success ? <p style={styles.successText}>{success}</p> : null}
            <button
              type="button"
              onClick={handleAddToUnload}
              disabled={saving || loading}
              style={{
                ...styles.primaryButton,
                ...styles.addActionButton,
                ...(saving || loading ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
              }}
            >
              {saving ? 'Adding...' : isReturn ? 'Add Retur' : isSample ? 'Add Sample' : 'Add Item to Koli'}
            </button>
          </div>
        </div>
        </div>

        {!isReturn && !isSample ? (
          <div style={styles.currentKoliPanel}>
            <div style={styles.header}>
              <div>
                <h2 style={styles.sectionTitle}>Koli Basket</h2>
              </div>
              <button
                type="button"
                onClick={handlePostCurrentKoli}
                disabled={saving || !currentKoliItems.length}
                style={{
                  ...styles.primaryButton,
                  ...(saving || !currentKoliItems.length ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                }}
              >
                {saving ? 'Posting...' : 'Post'}
              </button>
            </div>

            {currentKoliItems.length === 0 ? (
              <p style={styles.emptyText}>No item in the Koli basket yet.</p>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Photo</th>
                      <th style={styles.th}>Model Name</th>
                      <th style={styles.th}>Qty</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentKoliItems.map((row) => {
                      const variantName = getVariantNameForRow(row)
                      const photoUrl = getVariantPhotoForRow(row)
                      const previewTitle = variantName ? `${row.model_name || 'Product'} / ${variantName}` : row.model_name || 'Product photo'

                      return (
                        <tr key={row.tempId}>
                          <td style={styles.td}>
                            {photoUrl ? (
                              <button
                                type="button"
                                onClick={() => openImagePreview({ src: photoUrl, title: previewTitle })}
                                style={styles.koliImageButton}
                                aria-label="Preview product photo"
                                title="Preview product photo"
                              >
                                <Image
                                  src={photoUrl}
                                  alt={previewTitle}
                                  width={48}
                                  height={48}
                                  unoptimized
                                  style={styles.koliImage}
                                />
                              </button>
                            ) : (
                              <span style={styles.koliImagePlaceholder}>NO PHOTO</span>
                            )}
                          </td>
                          <td style={styles.td}>
                            <span style={styles.koliModelStack}>
                              <strong>{row.model_name || '-'}</strong>
                              {variantName ? <span style={styles.koliVariantText}>{variantName}</span> : null}
                            </span>
                          </td>
                          <td style={styles.td}>{row.qty || 0}</td>
                          <td style={styles.td}>
                            <span style={styles.koliActionRow}>
                              <button
                                type="button"
                                onClick={() => handleEditCurrentKoliItem(row)}
                                style={styles.koliIconButton}
                                aria-label="Edit item"
                                title="Edit item"
                              >
                                <PencilIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveCurrentKoliItem(row.tempId)}
                                style={{ ...styles.koliIconButton, ...styles.koliDeleteButton }}
                                aria-label="Remove item"
                                title="Remove item"
                              >
                                <XIcon />
                              </button>
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </div>
      ) : null}


      {showModelModal ? (
        <div style={registryOverlayStyle}>
          <div style={registryModalStyle}>
            <div style={styles.modalTitleRow}>
              <h2 style={{ ...styles.sectionTitle, ...styles.registryModalTitle }}>
                {isEditingVariant ? 'Edit Variant' : 'Registry New Model-Variant'}
              </h2>
              <div style={styles.modalTitleActions}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModelModal(false)
                    resetRegistryModal()
                  }}
                  style={{ ...styles.secondaryButton, ...styles.modalTitleButton }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModel}
                  disabled={saving}
                  style={{
                    ...styles.primaryButton,
                    ...styles.modalTitleButton,
                    ...(saving ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                >
                  {saving ? 'Saving...' : 'Save Variant'}
                </button>
              </div>
            </div>

            <div style={styles.registryFormGrid}>
              <div style={styles.registryPhotoColumn}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowVariantPhotoOptions((prev) => !prev)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setShowVariantPhotoOptions((prev) => !prev)
                    }
                  }}
                  style={{
                    ...styles.registryPhotoFrame,
                    ...(modelModalError === 'Variant photo is required.' ? styles.registryPhotoFrameError : {}),
                  }}
                  aria-label="Choose variant photo"
                  title="Choose variant photo"
                >
                  {modelDraft.variant_photo_url ? (
                    <Image
                      src={modelDraft.variant_photo_url}
                      alt="Variant preview"
                      width={320}
                      height={320}
                      unoptimized
                      style={styles.registryPhotoImage}
                    />
                  ) : (
                    <div style={styles.registryPhotoEmpty}>
                      <span style={styles.registryPhotoEmptyTitle}>
                        Variant Photo {!isEditingVariant ? <span style={styles.requiredMark}>*</span> : null}
                      </span>
                      <span style={styles.registryPhotoEmptySub}>Tap to choose</span>
                    </div>
                  )}

                  {modelDraft.variant_photo_url ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleRemoveVariantPhoto()
                      }}
                      style={styles.registryPhotoRemove}
                      aria-label="Remove variant photo"
                      title="Remove variant photo"
                    >
                      X
                    </button>
                  ) : null}
                </div>

                {showVariantPhotoOptions ? (
                  <div style={styles.registryPhotoActions}>
                    <label style={styles.registryPhotoAction}>
                      Camera
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleVariantPhotoChange}
                        style={styles.hiddenFileInput}
                      />
                    </label>
                    <label style={styles.registryPhotoAction}>
                      Gallery / File
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleVariantPhotoChange}
                        style={styles.hiddenFileInput}
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <div style={styles.registryFieldsStack}>
                <div style={styles.field}>
                  <div style={styles.modelLabelRow}>
                    <label style={styles.label}>
                      Model Name {!isEditingVariant ? <span style={styles.requiredMark}>*</span> : null}
                    </label>
                    {!isEditingVariant && registryUsesNewModel && filteredModelOptions.length ? (
                      <button
                        type="button"
                        onClick={() =>
                          setModelDraft((prev) => ({
                            ...prev,
                            model_id: '',
                            model_name: '',
                            model_notes: '',
                            is_new_model: false,
                          }))
                        }
                        style={{ ...styles.secondaryButton, minHeight: '32px', padding: '0 10px' }}
                      >
                        Use Existing
                      </button>
                    ) : null}
                  </div>

                  {isEditingVariant ? (
                    <input
                      value={modelDraft.model_name}
                      readOnly
                      style={{ ...styles.input, ...styles.readOnlyInput }}
                      placeholder="MODEL NAME"
                    />
                  ) : registryUsesNewModel ? (
                    <>
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
                      <textarea
                        value={modelDraft.model_notes}
                        onChange={(event) =>
                          setModelDraft((prev) => ({
                            ...prev,
                            model_notes: event.target.value,
                          }))
                        }
                        style={{ ...styles.textarea, minHeight: '74px' }}
                        placeholder="Model notes"
                      />
                    </>
                  ) : (
                    <>
                      <select
                        value={modelDraft.model_id}
                        onChange={(event) => {
                          const nextModel = filteredModelOptions.find((item) => String(item.id) === String(event.target.value))
                          setModelDraft((prev) => ({
                            ...prev,
                            model_id: event.target.value,
                            model_name: nextModel?.model_name || '',
                            model_notes: nextModel?.model_notes || '',
                          }))
                        }}
                        style={styles.select}
                      >
                        <option value="">Choose model</option>
                        {filteredModelOptions.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.model_code ? `${model.model_code} - ` : ''}{model.model_name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setModelDraft((prev) => ({
                            ...prev,
                            model_id: '',
                            model_name: '',
                            model_notes: '',
                            is_new_model: true,
                          }))
                        }
                        style={styles.newModelAction}
                      >
                        + Add New Model
                      </button>
                    </>
                  )}
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>
                    Variant Name <span style={styles.requiredMark}>*</span>
                  </label>
                  <input
                    value={modelDraft.variant_name}
                    onChange={(event) =>
                      setModelDraft((prev) => ({
                        ...prev,
                        variant_name: event.target.value.toUpperCase(),
                      }))
                    }
                    style={styles.input}
                    placeholder="e.g. COLOR"
                  />
                </div>

                <textarea
                  value={modelDraft.variant_notes}
                  onChange={(event) =>
                    setModelDraft((prev) => ({
                      ...prev,
                      variant_notes: event.target.value,
                    }))
                  }
                  style={styles.textarea}
                  placeholder="Variant notes"
                />
              </div>
            </div>

            {modelModalError ? <p style={styles.errorText}>{modelModalError}</p> : null}
          </div>
        </div>
      ) : null}

      {showChooseModelModal ? (
        <div style={chooseOverlayStyle}>
          <div style={chooseModalStyle}>
            <div>
              <h2 style={styles.sectionTitle}>Choose Variant</h2>
              <p style={styles.sectionSubtitle}>
                Showing variants filtered by the selected brand and category only.
              </p>
            </div>

            <div style={styles.modelPickerCard}>
              {!selectedBrandId || !selectedCategory ? (
                <p style={styles.emptyText}>Choose brand and category first to see matching variants.</p>
              ) : filteredVariantOptions.length === 0 ? (
                <p style={styles.emptyText}>No existing variant found for this brand and category yet.</p>
              ) : (
                <div style={styles.modelGroupList}>
                  {filteredVariantGroups.map((group, groupIndex) => (
                    <section key={group.model.id} style={styles.modelGroup}>
                      <div style={styles.modelGroupHeader}>
                        <span style={styles.modelGroupTitle}>Model {groupIndex + 1}</span>
                        <span style={styles.modelGroupMeta}>
                          {group.model.model_code ? `${group.model.model_code} / ` : ''}{group.model.model_name}
                        </span>
                      </div>

                      <div style={styles.modelGrid}>
                        {group.variants.map(({ model, variant, photoUrl, label }) => {
                          const variantProductId = getVariantProductId(variant)
                          const variantName = getVariantDisplayName(variant)
                          const isSelected =
                            Number(selectedModel?.id || 0) === Number(model.id || 0) &&
                            getVariantLookupValues(variant).includes(normalizeVariantLookupValue(selectedVariantLabel))

                          return (
                            <div
                              key={variant.id || `${model.id}-${variantProductId || variantName}`}
                              role="button"
                              tabIndex={0}
                              aria-label={`Select ${label}`}
                              onClick={() => selectVariantOption(model, variant, photoUrl)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  selectVariantOption(model, variant, photoUrl)
                                }
                              }}
                              style={{
                                ...styles.modelOptionCard,
                                border: `1px solid ${isSelected ? '#111827' : '#d1d5db'}`,
                                boxShadow: isSelected ? '0 0 0 2px rgba(17, 24, 39, 0.08)' : 'none',
                              }}
                            >
                              {photoUrl ? (
                                <Image
                                  src={photoUrl}
                                  alt={label}
                                  width={180}
                                  height={120}
                                  unoptimized
                                  style={styles.modelThumb}
                                />
                              ) : (
                                <div
                                  style={{
                                    ...styles.modelThumb,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#9ca3af',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                  }}
                                >
                                  NO PHOTO
                                </div>
                              )}
                              <span style={styles.modelOptionTitle}>{variantName}</span>
                              <span style={styles.modelOptionMeta}>
                                {variantProductId ? `Product ID ${variantProductId}` : 'No Product ID'}
                              </span>
                              {variant.variant_notes ? (
                                <span style={styles.modelOptionMeta}>{variant.variant_notes}</span>
                              ) : null}
                              <div style={styles.modelOptionActions}>
                                {canRegistryModelVariant ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      openVariantEditor(model, variant)
                                    }}
                                    onKeyDown={(event) => event.stopPropagation()}
                                    style={styles.variantEditButton}
                                  >
                                    Edit
                                  </button>
                                ) : null}
                                {isSelected ? (
                                  <span style={styles.selectedVariantBadge}>Selected</span>
                                ) : (
                                  <span style={styles.tapHint}>Tap to choose</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.buttonRow}>
              {canRegistryModelVariant ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowChooseModelModal(false)
                    setShowModelModal(true)
                    resetRegistryModal({
                      ...createModelDraft(),
                      is_new_model: filteredModelOptions.length === 0,
                    })
                    setModelModalError('')
                  }}
                  style={styles.secondaryButton}
                >
                  Registry New Model
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setShowChooseModelModal(false)}
                style={styles.secondaryButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPerformanceModal ? (
        <div style={{ ...styles.overlay, ...styles.centeredOverlay }}>
          <div style={{ ...styles.modal, ...styles.performanceModal }}>
            <div style={styles.modalTitleRow}>
              <div>
                <h2 style={styles.sectionTitle}>Inbound Performance</h2>
                <p style={styles.sectionSubtitle}>
                  QC In variance by PIC against the stated intake qty.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPerformanceModal(false)}
                style={styles.secondaryButton}
              >
                Close
              </button>
            </div>

            <div style={styles.performanceSummaryGrid}>
              <div style={styles.performanceMetric}>
                <span style={styles.infoLabel}>Stated Intake Qty</span>
                <strong style={styles.performanceMetricValue}>{formatNumber(performanceTotals.statedQty)}</strong>
              </div>
              <div style={styles.performanceMetric}>
                <span style={styles.infoLabel}>QC In Qty</span>
                <strong style={styles.performanceMetricValue}>{formatNumber(performanceTotals.qcQty)}</strong>
              </div>
              <div style={getPerformanceMetricStyle(performanceTotals.modelErrorQty)}>
                <span style={styles.infoLabel}>Model Error</span>
                <strong style={styles.performanceMetricValue}>{formatNumber(performanceTotals.modelErrorQty)}</strong>
              </div>
              <div style={getPerformanceMetricStyle(performanceTotals.variance)}>
                <span style={styles.infoLabel}>Total Error</span>
                <strong style={styles.performanceMetricValue}>{formatSignedQty(performanceTotals.variance)}</strong>
              </div>
            </div>

            {performanceRows.length ? (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>PIC</th>
                      <th style={{ ...styles.th, ...styles.centerHeader }}>Stated Qty</th>
                      <th style={{ ...styles.th, ...styles.centerHeader }}>QC In Qty</th>
                      <th style={{ ...styles.th, ...styles.centerHeader }}>Model Error</th>
                      <th style={{ ...styles.th, ...styles.centerHeader }}>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceRows.map((row) => (
                      <tr key={row.picName}>
                        <td style={styles.td}>
                          <strong>{row.picName}</strong>
                        </td>
                        <td style={{ ...styles.td, ...styles.middleCenterCell }}>{formatNumber(row.statedQty)}</td>
                        <td style={{ ...styles.td, ...styles.middleCenterCell }}>{formatNumber(row.qcQty)}</td>
                        <td style={{ ...styles.td, ...styles.middleCenterCell }}>
                          <span style={row.modelErrorQty > 0 ? getVarianceBadgeStyle(row.modelErrorQty) : styles.performanceBadge}>
                            {formatNumber(row.modelErrorQty)}
                          </span>
                        </td>
                        <td style={{ ...styles.td, ...styles.middleCenterCell }}>
                          <span style={getVarianceBadgeStyle(row.variance)}>{formatSignedQty(row.variance)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={styles.helperBox}>
                <p style={styles.emptyText}>No posted Koli rows yet.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {previewImage ? (
        <div style={styles.photoPreviewOverlay}>
          <div style={styles.photoPreviewWrap}>
            <Image
              src={previewImage.src}
              alt={previewImage.title}
              width={1000}
              height={1000}
              unoptimized
              style={styles.photoPreviewImage}
            />
            <button
              type="button"
              onClick={closeImagePreview}
              style={styles.photoPreviewClose}
              aria-label="Close preview"
              title="Close preview"
            >
              x
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
