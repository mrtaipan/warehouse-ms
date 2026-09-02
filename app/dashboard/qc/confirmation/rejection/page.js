'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import { ADMIN_EMAIL, hasPermission } from '@/utils/permissions'
import { getRolePermissionCodes } from '@/utils/role-permissions'
import { useRealtimeRefresh } from '@/utils/supabase/use-realtime-refresh'

const supabase = createClient()

function formatDateDisplay(value) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

function formatRemainingDisplay(value) {
  const numericValue = Number(value || 0)

  if (numericValue < 0) {
    return `+${formatNumber(Math.abs(numericValue))}`
  }

  return formatNumber(numericValue)
}

function getDisplayName(user, profile) {
  return (
    String(profile?.display_name || '').trim() ||
    String(user?.user_metadata?.display_name || '').trim() ||
    String(user?.user_metadata?.full_name || '').trim() ||
    String(user?.user_metadata?.name || '').trim() ||
    String(user?.email || '').split('@')[0] ||
    'QC Staff'
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function AdjustmentIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h10" />
      <path d="M18 6h2" />
      <path d="M4 12h3" />
      <path d="M11 12h9" />
      <path d="M4 18h12" />
      <path d="M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  )
}

function TakeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  )
}

function ReturnIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-2" />
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

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    padding: '20px',
    border: '1px solid #dbe4f0',
    borderRadius: '12px',
    background: '#ffffff',
    boxShadow: '0 16px 36px rgba(15, 23, 42, 0.06)',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    paddingBottom: '6px',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    flexWrap: 'wrap',
  },
  headerActions: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  headerIconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38px',
    minWidth: '38px',
    height: '38px',
    padding: 0,
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    background: '#fff',
    color: '#334155',
    cursor: 'pointer',
  },
  headerTakeButton: {
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
  },
  headerReturnButton: {
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#b91c1c',
  },
  headerButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  closeIconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38px',
    minWidth: '38px',
    height: '38px',
    padding: 0,
    border: '1px solid #fecaca',
    borderRadius: '10px',
    background: '#fff',
    color: '#dc2626',
    textDecoration: 'none',
  },
  closeIconGlyph: {
    color: '#dc2626',
    fontWeight: '950',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
    gap: '12px',
    alignItems: 'stretch',
  },
  grnCard: {
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '14px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  grnItemBlock: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e2e8f0',
  },
  grnLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '800',
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
  infoValue: {
    display: 'block',
    marginTop: '4px',
    color: '#0f172a',
    fontSize: '14px',
    fontWeight: '800',
    lineHeight: 1.25,
    wordBreak: 'break-word',
  },
  headerInfoColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
    gap: '10px',
  },
  infoBox: {
    minHeight: '52px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '10px 12px',
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '10px',
  },
  metricBox: {
    minWidth: 0,
    minHeight: '52px',
    background: '#eef6ff',
    border: '1px solid #dbeafe',
    borderRadius: '10px',
    padding: '10px 12px',
  },
  metricValue: {
    display: 'block',
    marginTop: '4px',
    color: '#111827',
    fontSize: '16px',
    fontWeight: '900',
    lineHeight: 1.15,
    fontVariantNumeric: 'tabular-nums',
    wordBreak: 'break-word',
  },
  eyebrow: {
    margin: 0,
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
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
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  sectionTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '22px',
    fontWeight: '900',
    letterSpacing: 0,
  },
  basketTitleWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  basketQtyPill: {
    minHeight: '26px',
    padding: '4px 10px',
    border: '1px solid #dbeafe',
    borderRadius: '999px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '12px',
    fontWeight: '850',
    fontVariantNumeric: 'tabular-nums',
  },
  sectionSubtitle: {
    margin: '4px 0 0',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '750',
    color: '#334155',
  },
  input: {
    height: '40px',
    padding: '0 11px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    width: '100%',
    background: '#fff',
    color: '#111827',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
  },
  summaryCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  summaryLabel: {
    fontSize: '10px',
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#64748b',
    letterSpacing: 0,
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#111827',
    fontVariantNumeric: 'tabular-nums',
  },
  note: {
    margin: 0,
    padding: '12px 14px',
    border: '1px solid #fed7aa',
    borderRadius: '10px',
    background: '#fff7ed',
    color: '#9a3412',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  sourceCard: {
    border: '1px solid #dbe4f0',
    borderRadius: '12px',
    padding: '14px',
    display: 'grid',
    gridTemplateColumns: '1.8fr 0.7fr 0.7fr 0.7fr 0.8fr auto auto',
    gap: '12px',
    alignItems: 'center',
  },
  modelMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  modelName: {
    fontWeight: '700',
    color: '#111827',
  },
  modelInfo: {
    margin: 0,
    color: '#64748b',
    fontSize: '13px',
  },
  qtyBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    alignItems: 'center',
  },
  qtyLabel: {
    fontSize: '10px',
    textTransform: 'uppercase',
    color: '#64748b',
    fontWeight: '800',
    letterSpacing: 0,
  },
  qtyValue: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#111827',
    fontVariantNumeric: 'tabular-nums',
  },
  tableModelCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  tableModelName: {
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: '700',
    lineHeight: 1.3,
  },
  tableMutedText: {
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '650',
    lineHeight: 1.3,
  },
  photoButton: {
    width: '44px',
    height: '44px',
    padding: 0,
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    cursor: 'pointer',
    overflow: 'hidden',
  },
  photoThumb: {
    width: '44px',
    height: '44px',
    borderRadius: '8px',
    objectFit: 'cover',
    display: 'block',
  },
  photoEmpty: {
    width: '44px',
    height: '44px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    fontSize: '10px',
    fontWeight: '800',
    background: '#f8fafc',
  },
  photoPreviewOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'rgba(15, 23, 42, 0.72)',
  },
  photoPreviewWrap: {
    position: 'relative',
    maxWidth: 'min(92vw, 920px)',
    maxHeight: '88vh',
  },
  photoPreviewImage: {
    maxWidth: '100%',
    maxHeight: '88vh',
    borderRadius: '10px',
    objectFit: 'contain',
    display: 'block',
  },
  photoPreviewClose: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '34px',
    height: '34px',
    border: '1px solid rgba(255, 255, 255, 0.72)',
    borderRadius: '999px',
    background: 'rgba(15, 23, 42, 0.72)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  centerCell: {
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  actionCell: {
    minWidth: '92px',
  },
  sourceActionGroup: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '3px',
    justifyItems: 'center',
  },
  sourceBatchActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  compactInput: {
    height: '36px',
    padding: '0 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    width: '86px',
    background: '#fff',
    color: '#111827',
    textAlign: 'center',
  },
  compactInputDisabled: {
    border: '1px solid #e2e8f0',
    background: '#f1f5f9',
    color: '#94a3b8',
    cursor: 'not-allowed',
  },
  compactButton: {
    height: '34px',
    padding: '0 10px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '750',
    cursor: 'pointer',
  },
  iconActionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    minWidth: '34px',
    height: '34px',
    padding: 0,
    borderRadius: '8px',
    cursor: 'pointer',
  },
  takeIconButton: {
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
  },
  returnIconButton: {
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#b91c1c',
  },
  breakdownFilters: {
    display: 'grid',
    gridTemplateColumns: 'minmax(150px, 0.9fr) minmax(240px, 1.35fr) minmax(280px, 1.55fr) minmax(170px, 0.8fr) auto',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
  },
  filterSelect: {
    height: '34px',
    width: '100%',
    minWidth: 0,
    padding: '0 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '12px',
    fontWeight: '700',
  },
  qtyFilterGroup: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 0.95fr) 74px',
    alignItems: 'center',
    gap: '6px',
  },
  filterNumberInput: {
    width: '74px',
    height: '34px',
    padding: '0 9px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '12px',
    fontWeight: '700',
  },
  filterNumberInputDisabled: {
    background: '#f8fafc',
    color: '#94a3b8',
    cursor: 'not-allowed',
  },
  resetFilterButton: {
    width: '34px',
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#fff',
    color: '#0f172a',
    cursor: 'pointer',
  },
  resetFilterButtonDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
  filterStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  filterSearchInput: {
    height: '34px',
    width: '100%',
    padding: '0 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '12px',
    fontWeight: '700',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  basketGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
    gap: '16px',
    alignItems: 'start',
  },
  primaryButton: {
    height: '40px',
    padding: '0 15px',
    border: '1px solid #111827',
    borderRadius: '9px',
    background: '#111827',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '750',
    cursor: 'pointer',
  },
  secondaryButton: {
    height: '40px',
    padding: '0 13px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    background: '#fff',
    color: '#334155',
    fontSize: '13px',
    fontWeight: '750',
    cursor: 'pointer',
  },
  redButton: {
    height: '40px',
    padding: '0 15px',
    border: '1px solid #b91c1c',
    borderRadius: '9px',
    background: '#b91c1c',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '750',
    cursor: 'pointer',
  },
  tableWrap: {
    maxHeight: '360px',
    overflow: 'auto',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
  },
  table: {
    width: '100%',
    minWidth: '760px',
    borderCollapse: 'collapse',
  },
  basketTable: {
    width: '100%',
    minWidth: '760px',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: '800',
    color: '#64748b',
    padding: '11px 12px',
    background: '#f8fafc',
    textTransform: 'uppercase',
    letterSpacing: 0,
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: 0,
  },
  td: {
    padding: '12px',
    fontSize: '13px',
    color: '#1e293b',
    borderTop: '1px solid #eef2f7',
  },
  errorText: {
    margin: 0,
    padding: '12px 14px',
    borderRadius: '10px',
    background: '#fef2f2',
    color: '#b91c1c',
    fontSize: '13px',
  },
  successText: {
    margin: 0,
    padding: '12px 14px',
    borderRadius: '10px',
    background: '#f0fdf4',
    color: '#166534',
    fontSize: '13px',
  },
  emptyText: {
    margin: 0,
    color: '#64748b',
    fontSize: '13px',
  },
  removeIconButton: {
    width: '32px',
    minWidth: '32px',
    height: '32px',
    padding: 0,
    border: '1px solid #fecaca',
    borderRadius: '8px',
    background: '#fff',
    color: '#dc2626',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 70,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'rgba(15, 23, 42, 0.48)',
  },
  modalCard: {
    width: 'min(92vw, 520px)',
    maxHeight: '88vh',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '20px',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    background: '#fff',
    boxShadow: '0 24px 64px rgba(15, 23, 42, 0.24)',
  },
  adjustmentFormGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '16px',
  },
  modelPicker: {
    position: 'relative',
  },
  modelPickerButton: {
    minHeight: '44px',
    width: '100%',
    padding: '8px 11px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    background: '#fff',
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  modelPickerPlaceholder: {
    color: '#94a3b8',
    fontSize: '13px',
    fontWeight: '650',
  },
  modelPickerList: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 'calc(100% + 6px)',
    zIndex: 80,
    maxHeight: '280px',
    overflow: 'auto',
    padding: '6px',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    background: '#fff',
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.16)',
  },
  modelPickerOption: {
    width: '100%',
    padding: '8px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    color: '#111827',
    display: 'grid',
    gridTemplateColumns: '42px minmax(0, 1fr)',
    gap: '10px',
    alignItems: 'center',
    cursor: 'pointer',
    textAlign: 'left',
  },
  modelPickerPhoto: {
    width: '42px',
    height: '42px',
    borderRadius: '8px',
    objectFit: 'cover',
    display: 'block',
    background: '#f8fafc',
  },
  modelPickerPhotoEmpty: {
    width: '42px',
    height: '42px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    background: '#f8fafc',
    color: '#94a3b8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    fontWeight: '800',
  },
  modelPickerText: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  modelPickerName: {
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: '800',
    lineHeight: 1.25,
  },
  modelPickerMeta: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: '650',
    lineHeight: 1.25,
  },
}

function getSourceKey(item) {
  const variantName = item.variant_name || item.model_color || ''

  return `${Number(item.brand_id || 0)}::${Number(item.category_id || 0)}::${String(item.model_name || '').trim().toUpperCase()}::${String(
    variantName
  )
    .trim()
    .toUpperCase()}::${String(item.grade || '').trim().toUpperCase()}`
}

function getSourceFamilyKey(item) {
  const variantName = item.variant_name || item.model_color || ''

  return `${Number(item.brand_id || 0)}::${Number(item.category_id || 0)}::${String(item.model_name || '').trim().toUpperCase()}::${String(
    variantName
  )
    .trim()
    .toUpperCase()}`
}

function getModelLabel(item) {
  const variantName = item.variant_name || item.model_color || ''
  return variantName ? `${item.model_name} - ${variantName}` : item.model_name
}

function getModelNameLabel(item) {
  return String(item?.model_name || '').trim() || 'UNKNOWN MODEL'
}

function getAdjustmentLabel(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'REJECTION_MANUAL') return 'Manual Adjustment'
  if (normalized === 'SURPLUS') return 'Surplus'
  if (normalized === 'SHORTAGE') return 'Shortage'
  if (normalized === 'TRANSFER') return 'Transfer'
  return 'Adjustment'
}

function isTransferAdjustment(item) {
  return Boolean(item?.is_adjustment) && String(item?.adjustment_type || '').toUpperCase() === 'TRANSFER'
}

function normalizeFilterValue(value) {
  return String(value || '').trim().toUpperCase()
}

function matchesResultFilterValues(row, qty, filters, ignoredFilter = '') {
  if (ignoredFilter !== 'brandId' && filters.brandId && String(row.brand_id || '') !== filters.brandId) {
    return false
  }

  if (ignoredFilter !== 'categoryId' && filters.categoryId && String(row.category_id || '') !== filters.categoryId) {
    return false
  }

  if (ignoredFilter !== 'modelName' && filters.modelName && normalizeFilterValue(getModelNameLabel(row)) !== normalizeFilterValue(filters.modelName)) {
    return false
  }

  if (ignoredFilter !== 'search' && filters.search && !normalizeFilterValue(getModelLabel(row)).includes(normalizeFilterValue(filters.search))) {
    return false
  }

  if (ignoredFilter !== 'grade' && filters.grade && String(row.grade || '').toUpperCase() !== filters.grade) {
    return false
  }

  return true
}

function normalizeReturnRow(item) {
  return {
    ...item,
    model_color: item.variant_name || '',
  }
}

function normalizeConfirmRow(item) {
  return {
    ...item,
    model_color: item.variant_name || item.model_color || '',
  }
}

function normalizeQcItemRow(item) {
  return {
    ...item,
    model_color: item.variant_name || item.model_color || '',
  }
}

function getQcItemBrandId(item) {
  return item.product_model?.brand_id || item.inbound_unload?.brand_id || null
}

function getQcItemCategoryId(item) {
  return item.product_model?.category_id || item.inbound_unload?.category_id || null
}

function getQcItemBrandLabel(item) {
  return item.product_model?.brands?.brand_name || item.inbound_unload?.brands?.brand_name || 'UNBRANDED'
}

function getQcItemCategoryLabel(item) {
  return (
    item.product_model?.categories?.full_name ||
    item.product_model?.categories?.category_name ||
    item.inbound_unload?.categories?.full_name ||
    item.inbound_unload?.categories?.category_name ||
    'UNCATEGORIZED'
  )
}

function isRegularSampleTask(item) {
  return Boolean(item?.inbound_unload?.is_sample)
}

function hasProductIdentityForSampleTask(item) {
  const modelName = String(item?.model_name || item?.inbound_unload?.model_name || '').trim().toUpperCase()
  const variantName = String(item?.variant_name || item?.model_color || item?.inbound_unload?.variant_name || '').trim().toUpperCase()
  const temporaryModelNames = new Set(['', 'SAMPLE', 'TEMPORARY', 'TEMPORARY SAMPLE'])
  const temporaryVariantNames = new Set(['', 'SAMPLE', 'TEMPORARY'])

  return !temporaryModelNames.has(modelName) && !temporaryVariantNames.has(variantName)
}

function isTemporarySampleTask(item) {
  if (!isRegularSampleTask(item)) return false
  if (item?.inbound_unload?.is_product_temporary) return true

  return !hasProductIdentityForSampleTask(item)
}

function getSampleBreakdownBrandLabel(item) {
  return item.sample_breakdown?.brands?.brand_name || 'UNBRANDED'
}

function getSampleBreakdownCategoryLabel(item) {
  return (
    item.sample_breakdown?.categories?.full_name ||
    item.sample_breakdown?.categories?.category_name ||
    'UNCATEGORIZED'
  )
}

function getSourceVariantCode(item) {
  return (
    item?.product_model_variant?.variant_code ||
    item?.product_model_variant?.variant_name ||
    item?.source_variant_code ||
    item?.variant_code ||
    item?.variant_name ||
    item?.model_color ||
    null
  )
}

function getSampleSourceVariantCode(item) {
  return (
    item?.sample_breakdown?.product_model_variant?.variant_code ||
    item?.sample_breakdown?.product_model_variant?.variant_name ||
    item?.sample_breakdown?.source_variant_code ||
    item?.sample_breakdown?.variant_code ||
    item?.sample_breakdown?.variant_name ||
    null
  )
}

function buildExistingKoliTargetOptions(rows = [], inboundId) {
  const grouped = new Map()
  const targetInboundId = Number(inboundId || 0)

  rows
    .filter((item) => Number(item.inbound_id || 0) === targetInboundId)
    .forEach((item) => {
      const sequence = Number(item.koli_sequence || 0)
      if (!sequence) return

      const key = String(sequence)
      const current = grouped.get(key) || {
        value: key,
        sequence,
        totalQty: 0,
        lineCount: 0,
        grades: new Set(),
      }

      current.totalQty += Number(item.qty || 0)
      current.lineCount += 1
      if (item.grade) current.grades.add(String(item.grade || '').trim().toUpperCase())
      grouped.set(key, current)
    })

  return Array.from(grouped.values())
    .sort((a, b) => a.sequence - b.sequence)
    .map((item) => ({
      ...item,
      gradeLabel: Array.from(item.grades).filter(Boolean).sort().join(', '),
    }))
}

export default function QcConfirmationRejectionPage() {
  const searchParams = useSearchParams()
  const draftIdRef = useRef(1)
  const [loading, setLoading] = useState(true)
  const [canEditConfirmation, setCanEditConfirmation] = useState(false)
  const [savingTake, setSavingTake] = useState(false)
  const [savingReturn, setSavingReturn] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [picName, setPicName] = useState('')
  const grnFilter = searchParams.get('grn') || ''
  const [qcItems, setQcItems] = useState([])
  const [qcSampleBreakdownRows, setQcSampleBreakdownRows] = useState([])
  const [confirmRows, setConfirmRows] = useState([])
  const [returnRows, setReturnRows] = useState([])
  const [qtyInputs, setQtyInputs] = useState({})
  const [currentTakeKoliItems, setCurrentTakeKoliItems] = useState([])
  const [currentReturnKoliItems, setCurrentReturnKoliItems] = useState([])
  const [adjustmentModelLabel, setAdjustmentModelLabel] = useState('')
  const [adjustmentModelMenuOpen, setAdjustmentModelMenuOpen] = useState(false)
  const [adjustmentGrade, setAdjustmentGrade] = useState('B')
  const [adjustmentQty, setAdjustmentQty] = useState('')
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false)
  const [takeGradeModalOpen, setTakeGradeModalOpen] = useState(false)
  const [takeGradeSelection, setTakeGradeSelection] = useState('')
  const [pendingTakeRows, setPendingTakeRows] = useState([])
  const [postTargetModalOpen, setPostTargetModalOpen] = useState(false)
  const [postTargetSelection, setPostTargetSelection] = useState('new')
  const [supportsConfirmSourceGrade, setSupportsConfirmSourceGrade] = useState(false)
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState('')
  const [resultFilters, setResultFilters] = useState({
    brandId: '',
    categoryId: '',
    modelName: '',
    grade: '',
    search: '',
  })

  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError('')
    }

    const [
      { data: authData, error: authError },
      { data: qcData, error: qcError },
      { error: sourceGradeSupportError },
      { data: qcSampleData, error: qcSampleError },
      { data: confirmData, error: confirmError },
      { data: returnsData, error: returnsError },
    ] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from('qc_items')
        .select(`
            *,
            inbound:inbound_id (
              id,
              grn_number,
              item_name,
              inbound_date,
              suppliers:dir_suppliers!supplier_id (
                supplier_name
              )
            ),
            inbound_unload:inbound_unload_id (
              id,
              brand_id,
              category_id,
              model_name,
              variant_name,
              is_sample,
              is_product_temporary,
              brands:dir_brands!brand_id (
                id,
                brand_name
              ),
              categories:dir_categories!category_id (
                id,
                category_name,
                full_name
              )
            ),
            product_model:product_model_id (
              id,
              brand_id,
              category_id,
              brands:dir_brands!brand_id (
                id,
                brand_name
              ),
              categories:dir_categories!category_id (
                id,
                category_name,
                full_name
              )
            ),
            product_model_variant:product_model_variant_id (
              id,
              product_model_id,
              variant_code,
              variant_name,
              selling_name
            )
          `)
        .eq('status', 'done')
        .order('created_at', { ascending: false }),
      supabase
        .from('qc_confirm')
        .select('source_grade')
        .limit(1),
      supabase
        .from('qc_sample_breakdowns')
        .select(`
          id,
          qc_item_id,
          sample_breakdown_id,
          qty_a,
          qty_b,
          qty_c,
          qc_item:qc_item_id (
            id,
            inbound_id,
            assigned_to,
            status,
            inbound:inbound_id (
              id,
              grn_number,
              item_name,
              inbound_date,
              suppliers:dir_suppliers!supplier_id (
                supplier_name
              )
            ),
            inbound_unload:inbound_unload_id (
              id,
              is_sample,
              is_product_temporary
            )
          ),
          sample_breakdown:sample_breakdown_id (
            id,
            inbound_unload_id,
            inbound_id,
            brand_id,
            category_id,
            product_model_id,
            product_model_variant_id,
            model_name,
            variant_name,
            photo_url,
            qty,
            brands:dir_brands!brand_id (
              id,
              brand_name
            ),
            categories:dir_categories!category_id (
              id,
              category_name,
              full_name
            ),
            product_model_variant:product_model_variant_id (
              id,
              product_model_id,
              variant_code,
              variant_name,
              selling_name
            )
          )
        `)
        .order('created_at', { ascending: true }),
      supabase
        .from('qc_confirm')
        .select('*')
        .order('koli_sequence', { ascending: true }),
      supabase
        .from('warehouse_returns')
        .select('id, inbound_id, source_phase, brand_id, category_id, model_name, variant_name, qty, koli_sequence, grade, is_adjustment, adjustment_type, pic_name')
        .eq('source_phase', 'qc')
        .order('koli_sequence', { ascending: true }),
    ])

    if (authError || qcError || qcSampleError || confirmError || returnsError) {
      if (!silent) {
        setError(authError?.message || qcError?.message || qcSampleError?.message || confirmError?.message || returnsError?.message || 'Failed to load confirmation rejection.')
        setLoading(false)
      }
      return
    }

    let nextPicName = ''
    if (authData?.user) {
      const { data: profileRow } = await getProfileByAuthenticatedUser(supabase, authData.user, 'display_name, role')
      const isAdminUser = authData.user.email?.toLowerCase() === ADMIN_EMAIL || profileRow?.role === 'admin'
      const { data: rolePermissions } = isAdminUser
        ? { data: [] }
        : await getRolePermissionCodes(supabase, profileRow?.role || '')
      setCanEditConfirmation(hasPermission(rolePermissions, 'qc.confirmation.edit', isAdminUser))
      nextPicName = getDisplayName(authData.user, profileRow)
    }

    setQcItems((qcData || []).map(normalizeQcItemRow))
    setQcSampleBreakdownRows(qcSampleData || [])
    setConfirmRows((confirmData || []).map(normalizeConfirmRow))
    setReturnRows((returnsData || []).map(normalizeReturnRow))
    setPicName(nextPicName)
    setSupportsConfirmSourceGrade(!sourceGradeSupportError)
    if (!silent) {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadData()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  useRealtimeRefresh({
    supabase,
    topic: 'qc:confirmation',
    onRefresh: () => loadData(true),
    paused: Boolean(
      savingTake ||
        savingReturn ||
        previewPhotoUrl ||
        currentTakeKoliItems.length ||
        currentReturnKoliItems.length ||
        adjustmentModalOpen ||
        adjustmentModelLabel ||
        adjustmentModelMenuOpen ||
        adjustmentQty ||
        takeGradeModalOpen ||
        postTargetModalOpen
    ),
  })

  const selectedInbound = useMemo(
    () => qcItems.find((item) => item.inbound?.grn_number === grnFilter)?.inbound || null,
    [grnFilter, qcItems]
  )

  const sourceRows = useMemo(() => {
    const grouped = new Map()
    const familyLookup = new Map()

    function rememberFamily(row) {
      const familyKey = getSourceFamilyKey(row)
      if (!familyLookup.has(familyKey)) {
        familyLookup.set(familyKey, row)
      }
    }

    function getOrCreateAdjustmentRow(item) {
      const sourceGrade = String(item.grade || '').trim().toUpperCase()
      if (!['B', 'C'].includes(sourceGrade)) {
        return null
      }

      const key = getSourceKey(item)
      const existing = grouped.get(key)
      if (existing) return existing

      if (!item.is_adjustment) return null

      const familyRow = familyLookup.get(getSourceFamilyKey(item))
      const nextRow = {
        key,
        inbound_id: item.inbound_id,
        brand_id: item.brand_id || familyRow?.brand_id || null,
        category_id: item.category_id || familyRow?.category_id || null,
        brand_name: familyRow?.brand_name || 'UNBRANDED',
        category_name: familyRow?.category_name || 'UNCATEGORIZED',
        model_name: item.model_name || familyRow?.model_name || 'UNKNOWN MODEL',
        model_color: item.model_color || item.variant_name || familyRow?.model_color || '',
        photo_url: item.photo_url || familyRow?.photo_url || '',
        product_model_id: item.product_model_id || familyRow?.product_model_id || null,
        product_model_variant_id: item.product_model_variant_id || familyRow?.product_model_variant_id || null,
        source_variant_code: item.source_variant_code || familyRow?.source_variant_code || null,
        grade: sourceGrade,
        source_qty: 0,
        taken_qty: 0,
        returned_qty: 0,
        is_adjustment_only: true,
      }

      grouped.set(key, nextRow)
      rememberFamily(nextRow)
      return nextRow
    }

    function addSourceGrade({
      inboundId,
      brandId,
      categoryId,
      brandName,
      categoryName,
      modelName,
      modelColor,
      photoUrl,
      productModelId,
      productModelVariantId,
      sourceVariantCode,
      grade,
      qty,
    }) {
      if (Number(qty || 0) <= 0) {
        return
      }

      const key = getSourceKey({
        brand_id: brandId,
        category_id: categoryId,
        model_name: modelName,
        model_color: modelColor,
        grade,
      })

      const current = grouped.get(key) || {
        key,
        inbound_id: inboundId,
        brand_id: brandId,
        category_id: categoryId,
        brand_name: brandName || 'UNBRANDED',
        category_name: categoryName || 'UNCATEGORIZED',
        model_name: modelName || 'UNKNOWN MODEL',
        model_color: modelColor || '',
        photo_url: photoUrl || '',
        product_model_id: productModelId || null,
        product_model_variant_id: productModelVariantId || null,
        source_variant_code: sourceVariantCode || null,
        grade,
        source_qty: 0,
        taken_qty: 0,
        returned_qty: 0,
      }

      if (!current.photo_url && photoUrl) {
        current.photo_url = photoUrl
      }
      current.product_model_id = current.product_model_id || productModelId || null
      current.product_model_variant_id = current.product_model_variant_id || productModelVariantId || null
      current.source_variant_code = current.source_variant_code || sourceVariantCode || null
      current.source_qty += Number(qty || 0)
      grouped.set(key, current)
      rememberFamily(current)
    }

    qcItems
      .filter((item) => item.inbound?.grn_number === grnFilter && !isTemporarySampleTask(item))
      .forEach((item) => {
        ;[
          { grade: 'B', qty: Number(item.qty_b || 0) },
          { grade: 'C', qty: Number(item.qty_c || 0) },
        ]
          .filter((gradeRow) => gradeRow.qty > 0)
          .forEach((gradeRow) => {
            addSourceGrade({
              inboundId: item.inbound_id,
              brandId: getQcItemBrandId(item),
              categoryId: getQcItemCategoryId(item),
              brandName: getQcItemBrandLabel(item),
              categoryName: getQcItemCategoryLabel(item),
              modelName: item.model_name,
              modelColor: item.model_color,
              photoUrl: item.photo_url,
              productModelId: item.product_model_id || null,
              productModelVariantId: item.product_model_variant_id || null,
              sourceVariantCode: getSourceVariantCode(item),
              grade: gradeRow.grade,
              qty: gradeRow.qty,
            })
          })
      })

    qcSampleBreakdownRows
      .filter((item) => item.qc_item?.inbound?.grn_number === grnFilter && item.qc_item?.status === 'done')
      .forEach((item) => {
        ;[
          { grade: 'B', qty: Number(item.qty_b || 0) },
          { grade: 'C', qty: Number(item.qty_c || 0) },
        ]
          .filter((gradeRow) => gradeRow.qty > 0)
          .forEach((gradeRow) => {
            addSourceGrade({
              inboundId: item.sample_breakdown?.inbound_id || item.qc_item?.inbound_id,
              brandId: item.sample_breakdown?.brand_id || null,
              categoryId: item.sample_breakdown?.category_id || null,
              brandName: getSampleBreakdownBrandLabel(item),
              categoryName: getSampleBreakdownCategoryLabel(item),
              modelName: item.sample_breakdown?.model_name,
              modelColor: item.sample_breakdown?.variant_name,
              photoUrl: item.sample_breakdown?.photo_url,
              productModelId: item.sample_breakdown?.product_model_id || null,
              productModelVariantId: item.sample_breakdown?.product_model_variant_id || null,
              sourceVariantCode: getSampleSourceVariantCode(item),
              grade: gradeRow.grade,
              qty: gradeRow.qty,
            })
          })
      })

    confirmRows
      .filter((item) => {
        if (Number(item.inbound_id) !== Number(selectedInbound?.id)) {
          return false
        }

        const grade = String(item.grade || '').toUpperCase()
        return ['B', 'C'].includes(grade) || isTransferAdjustment(item)
      })
      .forEach((item) => {
        const sourceGrade = String(item.source_grade || item.grade || '').toUpperCase()
        const current = getOrCreateAdjustmentRow({ ...item, grade: sourceGrade })
        if (current) {
          current.taken_qty += Number(item.qty || 0)
          grouped.set(current.key, current)
        }
      })

    returnRows
      .filter((item) => Number(item.inbound_id) === Number(selectedInbound?.id))
      .forEach((item) => {
        const current = getOrCreateAdjustmentRow(item)
        if (current) {
          current.returned_qty += Number(item.qty || 0)
          grouped.set(current.key, current)
        }
      })

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.brand_name !== b.brand_name) return a.brand_name.localeCompare(b.brand_name)
      if (a.category_name !== b.category_name) return a.category_name.localeCompare(b.category_name)
      if (a.grade !== b.grade) return a.grade.localeCompare(b.grade)
      return getModelLabel(a).localeCompare(getModelLabel(b))
    })
  }, [confirmRows, grnFilter, qcItems, qcSampleBreakdownRows, returnRows, selectedInbound?.id])

  const totals = useMemo(
    () =>
      sourceRows.reduce(
        (result, item) => {
          result.source += Number(item.source_qty || 0)
          result.taken += Number(item.taken_qty || 0)
          result.returned += Number(item.returned_qty || 0)
          return result
        },
        { source: 0, taken: 0, returned: 0 }
      ),
    [sourceRows]
  )
  const remainingTotal = Number(totals.source || 0) - Number(totals.taken || 0) - Number(totals.returned || 0)
  const currentTakeKoliQty = currentTakeKoliItems.reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const currentReturnKoliQty = currentReturnKoliItems.reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const returnKoliTargetOptions = useMemo(
    () => buildExistingKoliTargetOptions(returnRows, selectedInbound?.id),
    [returnRows, selectedInbound?.id]
  )
  const activePostTargetOptions = returnKoliTargetOptions
  const activePostTargetQty = currentReturnKoliQty
  const brandFilterOptions = useMemo(() => {
    const options = new Map()
    sourceRows.filter((row) => matchesResultFilterValues(row, Number(row.source_qty || 0), resultFilters, 'brandId')).forEach((row) => {
      if (row.brand_id && row.brand_name) {
        options.set(String(row.brand_id), row.brand_name)
      }
    })

    return Array.from(options.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [resultFilters, sourceRows])
  const categoryFilterOptions = useMemo(() => {
    const options = new Map()
    sourceRows.filter((row) => matchesResultFilterValues(row, Number(row.source_qty || 0), resultFilters, 'categoryId')).forEach((row) => {
      if (row.category_id && row.category_name) {
        options.set(String(row.category_id), row.category_name)
      }
    })

    return Array.from(options.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [resultFilters, sourceRows])
  const modelFilterOptions = useMemo(
    () =>
      Array.from(
        new Set(
          sourceRows
            .filter((row) => matchesResultFilterValues(row, Number(row.source_qty || 0), resultFilters, 'modelName'))
            .map((row) => getModelNameLabel(row))
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [resultFilters, sourceRows]
  )
  const gradeFilterOptions = useMemo(
    () =>
      Array.from(
        new Set(
          sourceRows
            .filter((row) => matchesResultFilterValues(row, Number(row.source_qty || 0), resultFilters, 'grade'))
            .map((row) => String(row.grade || '').toUpperCase())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [resultFilters, sourceRows]
  )
  const hasResultFilters = Boolean(
    resultFilters.brandId ||
    resultFilters.categoryId ||
    resultFilters.modelName ||
    resultFilters.grade ||
    resultFilters.search
  )

  function updateResultFilter(name, value) {
    setResultFilters((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function resetResultFilters() {
    setResultFilters({
      brandId: '',
      categoryId: '',
      modelName: '',
      grade: '',
      search: '',
    })
  }

  const matchesResultFilters = useCallback((row, qty) => {
    return matchesResultFilterValues(row, qty, resultFilters)
  }, [resultFilters])
  const filteredSourceRows = useMemo(
    () => sourceRows.filter((row) => matchesResultFilters(row, Number(row.source_qty || 0))),
    [matchesResultFilters, sourceRows]
  )
  const adjustmentModelOptions = useMemo(
    () => {
      const options = new Map()

      sourceRows.forEach((row) => {
        const key = `${Number(row.brand_id || 0)}::${Number(row.category_id || 0)}::${String(row.model_name || '').trim().toUpperCase()}::${String(
          row.model_color || ''
        )
          .trim()
          .toUpperCase()}`

        if (!options.has(key)) {
          options.set(key, {
            ...row,
            id: key,
            label: `${row.brand_name || 'UNBRANDED'} ${row.category_name || 'UNCATEGORIZED'} - ${getModelLabel(row)}`,
          })
        }
      })

      return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label))
    },
    [sourceRows]
  )
  const selectedAdjustmentModel = adjustmentModelOptions.find((item) => item.label === adjustmentModelLabel) || null

  function getDraftQty(sourceKey, type) {
    const target = type === 'take' ? currentTakeKoliItems : currentReturnKoliItems
    return target.filter((item) => item.source_key === sourceKey).reduce((sum, item) => sum + Number(item.qty || 0), 0)
  }

  function getRemainingQty(row) {
    return Math.max(
      0,
      Number(row.source_qty || 0) -
        Number(row.taken_qty || 0) -
        Number(row.returned_qty || 0) -
        getDraftQty(row.key, 'take') -
        getDraftQty(row.key, 'return')
    )
  }

  function handleQtyInputChange(row, value) {
    if (!canEditConfirmation) return

    const remainingQty = getRemainingQty(row)

    if (value === '') {
      setQtyInputs((prev) => ({
        ...prev,
        [row.key]: '',
      }))
      return
    }

    const nextQty = Math.max(0, Math.min(Number(value || 0), remainingQty))
    setQtyInputs((prev) => ({
      ...prev,
      [row.key]: String(nextQty),
    }))
  }

  function createDecisionItem(row, type, qty, targetGrade = '') {
    return {
      id: `${type}-${draftIdRef.current++}`,
      source_key: row.key,
      inbound_id: row.inbound_id,
      brand_id: row.brand_id,
      brand_name: row.brand_name,
      category_id: row.category_id,
      category_name: row.category_name,
      model_name: row.model_name,
      model_color: row.model_color,
      photo_url: row.photo_url || '',
      product_model_id: row.product_model_id || null,
      product_model_variant_id: row.product_model_variant_id || null,
      source_variant_code: row.source_variant_code || null,
      qty,
      grade: type === 'take' ? targetGrade : row.grade,
      source_grade: row.grade,
    }
  }

  function getFilledRowsForDecision() {
    return filteredSourceRows
      .map((row) => ({
        row,
        qty: Number(qtyInputs[row.key] || 0),
        remainingQty: getRemainingQty(row),
      }))
      .filter((item) => item.qty > 0)
  }

  function clearQtyInputsForRows(rowsToAdd) {
    setQtyInputs((prev) => {
      const next = { ...prev }
      rowsToAdd.forEach((item) => {
        next[item.row.key] = ''
      })
      return next
    })
  }

  function handleAddFilledRows(type, targetGrade = '') {
    if (!canEditConfirmation) return

    setError('')
    setSuccess('')

    const rowsToAdd = getFilledRowsForDecision()

    if (!rowsToAdd.length) {
      setError('Input at least one qty first.')
      return
    }

    if (type === 'take' && !targetGrade) {
      setError('Choose Take Grade first.')
      return
    }

    const invalidRow = rowsToAdd.find((item) => item.qty > item.remainingQty)
    if (invalidRow) {
      setError(`Qty for ${invalidRow.row.model_name} grade ${invalidRow.row.grade} cannot be greater than the remaining qty (${invalidRow.remainingQty}).`)
      return
    }

    const nextItems = rowsToAdd.map((item) => createDecisionItem(item.row, type, item.qty, targetGrade))

    if (type === 'take') {
      setCurrentTakeKoliItems((prev) => [...prev, ...nextItems])
    } else {
      setCurrentReturnKoliItems((prev) => [...prev, ...nextItems])
    }

    clearQtyInputsForRows(rowsToAdd)
  }

  function handleOpenTakeGradeModal() {
    setError('')
    setSuccess('')

    const rowsToAdd = getFilledRowsForDecision()

    if (!rowsToAdd.length) {
      setError('Input at least one qty first.')
      return
    }

    const invalidRow = rowsToAdd.find((item) => item.qty > item.remainingQty)
    if (invalidRow) {
      setError(`Qty for ${invalidRow.row.model_name} grade ${invalidRow.row.grade} cannot be greater than the remaining qty (${invalidRow.remainingQty}).`)
      return
    }

    setPendingTakeRows(rowsToAdd)
    setTakeGradeSelection('')
    setTakeGradeModalOpen(true)
  }

  function handleConfirmTakeGrade() {
    setError('')
    setSuccess('')

    if (!takeGradeSelection) {
      setError('Choose Take Grade first.')
      return
    }

    const nextItems = pendingTakeRows.map((item) => createDecisionItem(item.row, 'take', item.qty, takeGradeSelection))
    setCurrentTakeKoliItems((prev) => [...prev, ...nextItems])
    clearQtyInputsForRows(pendingTakeRows)
    setPendingTakeRows([])
    setTakeGradeSelection('')
    setTakeGradeModalOpen(false)
  }

  function handleCloseTakeGradeModal() {
    setPendingTakeRows([])
    setTakeGradeSelection('')
    setTakeGradeModalOpen(false)
  }

  function handleAddAdjustmentItem(type) {
    if (!canEditConfirmation) return

    setError('')
    setSuccess('')

    if (!selectedInbound) {
      setError('Choose a GRN first.')
      return
    }

    if (!selectedAdjustmentModel) {
      setError('Choose an adjustment model first.')
      return
    }

    const nextQty = Number(adjustmentQty || 0)
    if (nextQty <= 0) {
      setError('Adjustment qty must be greater than 0.')
      return
    }

    const nextItem = {
      id: `adjust-${type}-${draftIdRef.current++}`,
      source_key: `adjustment::${type}::${selectedAdjustmentModel.id}::${adjustmentGrade}`,
      inbound_id: selectedInbound.id,
      brand_id: selectedAdjustmentModel.brand_id || null,
      brand_name: selectedAdjustmentModel.brand_name || selectedAdjustmentModel.brands?.brand_name || 'UNBRANDED',
      category_id: selectedAdjustmentModel.category_id || null,
      category_name: selectedAdjustmentModel.category_name || selectedAdjustmentModel.categories?.full_name || selectedAdjustmentModel.categories?.category_name || 'UNCATEGORIZED',
      model_name: selectedAdjustmentModel.model_name,
      model_color: selectedAdjustmentModel.model_color || '',
      photo_url: selectedAdjustmentModel.photo_url || '',
      product_model_id: selectedAdjustmentModel.product_model_id || null,
      product_model_variant_id: selectedAdjustmentModel.product_model_variant_id || null,
      source_variant_code: selectedAdjustmentModel.source_variant_code || null,
      qty: nextQty,
      grade: adjustmentGrade,
      is_adjustment: true,
      adjustment_type: 'REJECTION_MANUAL',
    }

    if (type === 'take') {
      setCurrentTakeKoliItems((prev) => [...prev, nextItem])
    } else {
      setCurrentReturnKoliItems((prev) => [...prev, nextItem])
    }

    setAdjustmentModelLabel('')
    setAdjustmentModelMenuOpen(false)
    setAdjustmentGrade('B')
    setAdjustmentQty('')
    setAdjustmentModalOpen(false)
  }

  function removeDraftItem(type, draftId) {
    if (type === 'take') {
      setCurrentTakeKoliItems((prev) => prev.filter((item) => item.id !== draftId))
      return
    }

    setCurrentReturnKoliItems((prev) => prev.filter((item) => item.id !== draftId))
  }

  function validatePostTargetRequest(type) {
    if (!canEditConfirmation) return

    setError('')
    setSuccess('')

    if (!selectedInbound) {
      setError('Choose a GRN first.')
      return false
    }

    const targetItems = type === 'return' ? currentReturnKoliItems : currentTakeKoliItems

    if (!targetItems.length) {
      setError(type === 'return' ? 'Return koli is still empty.' : 'Take koli is still empty.')
      return false
    }

    if (type !== 'take') {
      return true
    }

    const invalidSourceGradeItem = targetItems.find(
      (item) => !['B', 'C'].includes(String(item.source_grade || '').trim().toUpperCase())
    )
    if (invalidSourceGradeItem) {
      setError('Take items must keep their original rejection grade before posting.')
      return false
    }

    const needsSourceGrade = targetItems.some(
      (item) => item.source_grade && String(item.source_grade || '').toUpperCase() !== String(item.grade || '').toUpperCase()
    )
    if (needsSourceGrade && !supportsConfirmSourceGrade) {
      setError('Run `supabase/qc_confirm_source_grade.sql` first before transferring rejected goods into a different grade.')
      return false
    }

    return true
  }

  function openPostTargetModal(type) {
    if (!validatePostTargetRequest(type)) return

    setPostTargetSelection('new')
    setPostTargetModalOpen(true)
  }

  function closePostTargetModal() {
    setPostTargetModalOpen(false)
    setPostTargetSelection('new')
  }

  async function resolvePostKoliSequence(type, targetSelection) {
    if (targetSelection && targetSelection !== 'new') {
      const selectedSequence = Number(targetSelection || 0)
      if (selectedSequence > 0) return selectedSequence
      throw new Error('Choose a valid target koli.')
    }

    let sequenceQuery = supabase
      .from(type === 'return' ? 'warehouse_returns' : 'qc_confirm')
      .select('koli_sequence')
      .eq('inbound_id', selectedInbound.id)

    if (type === 'return') {
      sequenceQuery = sequenceQuery.eq('source_phase', 'qc')
    }

    const { data, error: sequenceError } = await sequenceQuery

    if (sequenceError) {
      throw new Error(sequenceError.message)
    }

    return (data || []).reduce((maxValue, item) => Math.max(maxValue, Number(item.koli_sequence || 0)), 0) + 1
  }

  async function handlePostTakeKoli(targetSelection = 'new') {
    if (!validatePostTargetRequest('take')) {
      return
    }

    setSavingTake(true)

    let nextKoliSequence = 0
    try {
      nextKoliSequence = await resolvePostKoliSequence('take', targetSelection)
    } catch (sequenceError) {
      setError(sequenceError.message || 'Failed to choose target koli.')
      setSavingTake(false)
      return
    }

    const payload = currentTakeKoliItems.map((item) => {
      const row = {
        inbound_id: item.inbound_id,
        brand_id: item.brand_id,
        category_id: item.category_id,
        product_model_id: item.product_model_id || null,
        product_model_variant_id: item.product_model_variant_id || null,
        source_variant_code: item.source_variant_code || null,
        model_name: item.model_name,
        variant_name: item.model_color || null,
        photo_url: item.photo_url || null,
        qty: Number(item.qty || 0),
        koli_sequence: nextKoliSequence,
        grade: item.grade,
        pic_name: picName || 'QC Staff',
        is_adjustment: true,
        adjustment_type: 'TRANSFER',
      }

      if (supportsConfirmSourceGrade) {
        row.source_grade = item.source_grade || item.grade
      }

      return row
    })

    const { data, error: insertError } = await supabase
      .from('qc_confirm')
      .insert(payload)
      .select('*')

    if (insertError) {
      setError(insertError.message)
      setSavingTake(false)
      return
    }

    setConfirmRows((prev) => [...prev, ...(data || []).map(normalizeConfirmRow)])
    setCurrentTakeKoliItems([])
    closePostTargetModal()
    setSuccess(`Take koli ${nextKoliSequence} posted to next process.`)
    setSavingTake(false)
  }

  async function handlePostReturnKoli(targetSelection = 'new') {
    if (!validatePostTargetRequest('return')) {
      return
    }

    setSavingReturn(true)

    let nextKoliSequence = 0
    try {
      nextKoliSequence = await resolvePostKoliSequence('return', targetSelection)
    } catch (sequenceError) {
      setError(sequenceError.message || 'Failed to choose target koli.')
      setSavingReturn(false)
      return
    }

    const payload = currentReturnKoliItems.map((item) => ({
      inbound_id: item.inbound_id,
      brand_id: item.brand_id,
      category_id: item.category_id,
      model_name: item.model_name,
      variant_name: item.model_color || null,
      qty: Number(item.qty || 0),
      koli_sequence: nextKoliSequence,
      grade: item.grade,
      source_phase: 'qc',
      pic_name: picName || 'QC Staff',
      is_adjustment: Boolean(item.is_adjustment),
      adjustment_type: item.adjustment_type || null,
    }))

    const { data, error: insertError } = await supabase
      .from('warehouse_returns')
      .insert(payload)
      .select('id, inbound_id, source_phase, brand_id, category_id, model_name, variant_name, qty, koli_sequence, grade, is_adjustment, adjustment_type, pic_name')

    if (insertError) {
      setError(insertError.message)
      setSavingReturn(false)
      return
    }

    setReturnRows((prev) => [...prev, ...(data || []).map(normalizeReturnRow)])
    setCurrentReturnKoliItems([])
    closePostTargetModal()
    setSuccess(`Return koli ${nextKoliSequence} posted to returns.`)
    setSavingReturn(false)
  }

  function renderBasketTable(items, type) {
    if (!items.length) return null

    return (
      <div style={styles.tableWrap}>
        <table style={styles.basketTable}>
          <thead>
            <tr>
              <th style={styles.th}>Brand</th>
              <th style={styles.th}>Picture</th>
              <th style={styles.th}>Model-Variant</th>
              <th style={{ ...styles.th, ...styles.centerCell }}>Grade</th>
              <th style={styles.th}>Category</th>
              <th style={{ ...styles.th, ...styles.centerCell }}>Qty</th>
              <th style={{ ...styles.th, ...styles.centerCell }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.id}-${item.grade || type}-${index}`}>
                <td style={styles.td}>{item.brand_name || 'UNBRANDED'}</td>
                <td style={styles.td}>
                  {item.photo_url ? (
                    <button
                      type="button"
                      onClick={() => setPreviewPhotoUrl(item.photo_url)}
                      style={styles.photoButton}
                      aria-label={`Preview ${getModelLabel(item)} photo`}
                      title="Preview photo"
                    >
                      <img src={item.photo_url} alt={getModelLabel(item)} style={styles.photoThumb} />
                    </button>
                  ) : (
                    <span style={styles.photoEmpty}>NO</span>
                  )}
                </td>
                <td style={styles.td}>{getModelLabel(item)}</td>
                <td style={{ ...styles.td, ...styles.centerCell }}>
                  {type === 'take' && item.source_grade
                    ? `${item.source_grade} -> ${item.grade}`
                    : item.grade}
                  {item.is_adjustment ? ` - ${getAdjustmentLabel(item.adjustment_type)}` : ''}
                </td>
                <td style={styles.td}>{item.category_name || 'UNCATEGORIZED'}</td>
                <td style={{ ...styles.td, ...styles.centerCell }}>{formatNumber(item.qty)}</td>
                <td style={{ ...styles.td, ...styles.centerCell }}>
                  <button
                    type="button"
                    onClick={() => removeDraftItem(type, item.id)}
                    style={styles.removeIconButton}
                    aria-label={`Remove ${getModelLabel(item)}`}
                    title="Remove"
                  >
                    <XIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const canUseSourceActions = Boolean(grnFilter && filteredSourceRows.length)
  const isPostingTarget = savingTake || savingReturn

  if (loading) {
    return <p style={styles.emptyText}>Loading confirmation rejection...</p>
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.topBar}>
          <div>
            <p style={styles.eyebrow}>Grading Verification</p>
            <h1 style={styles.title}>Rejection Grade</h1>
          </div>
          <div style={styles.headerActions}>
            {canEditConfirmation ? (
              <>
            <button
              type="button"
              onClick={() => setAdjustmentModalOpen(true)}
              style={styles.headerIconButton}
              aria-label="Adjustment"
              title="Adjustment"
            >
              <AdjustmentIcon />
            </button>
            <button
              type="button"
              onClick={handleOpenTakeGradeModal}
              disabled={!canUseSourceActions}
              style={{
                ...styles.headerIconButton,
                ...styles.headerTakeButton,
                ...(!canUseSourceActions ? styles.headerButtonDisabled : {}),
              }}
              aria-label="Take"
              title="Take"
            >
              <TakeIcon />
            </button>
            <button
              type="button"
              onClick={() => handleAddFilledRows('return')}
              disabled={!canUseSourceActions}
              style={{
                ...styles.headerIconButton,
                ...styles.headerReturnButton,
                ...(!canUseSourceActions ? styles.headerButtonDisabled : {}),
              }}
              aria-label="Return"
              title="Return"
            >
              <ReturnIcon />
            </button>
              </>
            ) : null}
            <Link href="/dashboard/qc/confirmation" style={styles.closeIconButton} aria-label="Back to Grading Verification" title="Back to Grading Verification">
              <span style={styles.closeIconGlyph}>
                <XIcon />
              </span>
            </Link>
          </div>
        </div>

        {error ? <p style={styles.errorText}>{error}</p> : null}
        {success ? <p style={styles.successText}>{success}</p> : null}

        <div style={styles.contentGrid}>
          <div style={styles.grnCard}>
            <span style={styles.grnLabel}>GRN Number</span>
            <strong style={styles.grnValue}>{selectedInbound?.grn_number || grnFilter || '-'}</strong>
            <div style={styles.grnItemBlock}>
              <span style={styles.grnLabel}>Item Name</span>
              <strong style={styles.infoValue}>{selectedInbound?.item_name || '-'}</strong>
            </div>
          </div>

          <div style={styles.headerInfoColumn}>
            <div style={styles.infoGrid}>
              <div style={styles.infoBox}>
                <span style={styles.grnLabel}>Inbound Date</span>
                <strong style={styles.infoValue}>{formatDateDisplay(selectedInbound?.inbound_date)}</strong>
              </div>
              <div style={styles.infoBox}>
                <span style={styles.grnLabel}>Supplier</span>
                <strong style={styles.infoValue}>{selectedInbound?.suppliers?.supplier_name || '-'}</strong>
              </div>
            </div>

            <div style={styles.metricGrid}>
              <div style={styles.metricBox}>
                <span style={styles.grnLabel}>Initial</span>
                <strong style={styles.metricValue}>{formatNumber(totals.source)}</strong>
              </div>
              <div style={styles.metricBox}>
                <span style={styles.grnLabel}>Taken</span>
                <strong style={styles.metricValue}>{formatNumber(totals.taken)}</strong>
              </div>
              <div style={styles.metricBox}>
                <span style={styles.grnLabel}>Returned</span>
                <strong style={styles.metricValue}>{formatNumber(totals.returned)}</strong>
              </div>
              <div style={styles.metricBox}>
                <span style={styles.grnLabel}>Remaining</span>
                <strong style={{ ...styles.metricValue, ...(remainingTotal < 0 ? { color: '#b91c1c' } : {}) }}>
                  {formatRemainingDisplay(remainingTotal)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        {!grnFilter ? <p style={styles.emptyText}>Open this page from Grading Verification first.</p> : null}
        {grnFilter && !sourceRows.length ? <p style={styles.emptyText}>No Grade B / C source found for this GRN.</p> : null}

        {grnFilter && sourceRows.length ? (
          <div style={styles.filterStack}>
            <div style={styles.breakdownFilters}>
              <select
                value={resultFilters.brandId}
                onChange={(event) => updateResultFilter('brandId', event.target.value)}
                style={styles.filterSelect}
                aria-label="Filter by brand"
              >
                <option value="">All brands</option>
                {brandFilterOptions.map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
              <select
                value={resultFilters.categoryId}
                onChange={(event) => updateResultFilter('categoryId', event.target.value)}
                style={styles.filterSelect}
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                {categoryFilterOptions.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <select
                value={resultFilters.modelName}
                onChange={(event) => updateResultFilter('modelName', event.target.value)}
                style={styles.filterSelect}
                aria-label="Filter by model"
              >
                <option value="">All models</option>
                {modelFilterOptions.map((modelName) => (
                  <option key={modelName} value={modelName}>{modelName}</option>
                ))}
              </select>
              <select
                value={resultFilters.grade}
                onChange={(event) => updateResultFilter('grade', event.target.value)}
                style={styles.filterSelect}
                aria-label="Filter by grade"
              >
                <option value="">All grades</option>
                {gradeFilterOptions.map((grade) => (
                  <option key={grade} value={grade}>Grade {grade}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={resetResultFilters}
                disabled={!hasResultFilters}
                style={{
                  ...styles.resetFilterButton,
                  ...(!hasResultFilters ? styles.resetFilterButtonDisabled : {}),
                }}
                aria-label="Reset filters"
                title="Reset filters"
              >
                <ResetIcon />
              </button>
            </div>
            <input
              value={resultFilters.search}
              onChange={(event) => updateResultFilter('search', event.target.value)}
              style={styles.filterSearchInput}
              placeholder="Search model"
              aria-label="Search model"
            />
          </div>
        ) : null}
        {grnFilter && sourceRows.length && !filteredSourceRows.length ? <p style={styles.emptyText}>No Grade B / C source matches this filter.</p> : null}

        {grnFilter && filteredSourceRows.length ? (
          <div style={styles.tableWrap}>
            <table style={{ ...styles.table, minWidth: '860px' }}>
              <thead>
                <tr>
                  <th style={styles.th}>Brand</th>
                  <th style={styles.th}>Picture</th>
                  <th style={styles.th}>Model-Variant</th>
                  <th style={{ ...styles.th, ...styles.centerCell }}>Grade</th>
                  <th style={{ ...styles.th, ...styles.centerCell }}>Initial</th>
                  <th style={{ ...styles.th, ...styles.centerCell }}>Taken</th>
                  <th style={{ ...styles.th, ...styles.centerCell }}>Returned</th>
                  <th style={{ ...styles.th, ...styles.centerCell }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {filteredSourceRows.map((row) => {
                  const remainingQty = getRemainingQty(row)
                  const isActionDisabled = remainingQty <= 0

                  return (
                    <tr key={row.key}>
                      <td style={styles.td}>{row.brand_name}</td>
                      <td style={styles.td}>
                        {row.photo_url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoUrl(row.photo_url)}
                            style={styles.photoButton}
                            aria-label={`Preview ${getModelLabel(row)} photo`}
                            title="Preview photo"
                          >
                            <img src={row.photo_url} alt={getModelLabel(row)} style={styles.photoThumb} />
                          </button>
                        ) : (
                          <span style={styles.photoEmpty}>NO</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={styles.tableModelName}>{getModelLabel(row)}</span>
                      </td>
                      <td style={{ ...styles.td, ...styles.centerCell }}>{row.grade}</td>
                      <td style={{ ...styles.td, ...styles.centerCell }}>{formatNumber(row.source_qty)}</td>
                      <td style={{ ...styles.td, ...styles.centerCell }}>{formatNumber(row.taken_qty)}</td>
                      <td style={{ ...styles.td, ...styles.centerCell }}>{formatNumber(row.returned_qty)}</td>
                      <td style={{ ...styles.td, ...styles.centerCell }}>
                        {canEditConfirmation ? (
                          <input
                            type="number"
                            min="0"
                            max={remainingQty}
                            value={qtyInputs[row.key] || ''}
                            onChange={(event) => handleQtyInputChange(row, event.target.value)}
                            style={{
                              ...styles.compactInput,
                              ...(isActionDisabled ? styles.compactInputDisabled : {}),
                            }}
                            placeholder="Qty"
                            disabled={isActionDisabled}
                          />
                        ) : (
                          formatNumber(remainingQty)
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {canEditConfirmation ? <div style={styles.basketGrid}>
        <div style={styles.card}>
          <div style={styles.sectionHeaderRow}>
            <div style={styles.basketTitleWrap}>
              <h2 style={styles.sectionTitle}>Take Koli</h2>
              <span style={styles.basketQtyPill}>Total Qty {formatNumber(currentTakeKoliQty)}</span>
            </div>
            <button
              type="button"
              onClick={() => handlePostTakeKoli()}
              disabled={savingTake || !currentTakeKoliItems.length}
              style={{
                ...styles.primaryButton,
                ...(savingTake || !currentTakeKoliItems.length ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
              }}
            >
              {savingTake ? 'Posting...' : 'Post'}
            </button>
          </div>

          {!currentTakeKoliItems.length ? <p style={styles.emptyText}>Take koli is still empty.</p> : null}
          {renderBasketTable(currentTakeKoliItems, 'take')}
        </div>

        <div style={styles.card}>
          <div style={styles.sectionHeaderRow}>
            <div style={styles.basketTitleWrap}>
              <h2 style={styles.sectionTitle}>Return Koli</h2>
              <span style={styles.basketQtyPill}>Total Qty {formatNumber(currentReturnKoliQty)}</span>
            </div>
            <button
              type="button"
              onClick={() => openPostTargetModal('return')}
              disabled={savingReturn || !currentReturnKoliItems.length}
              style={{
                ...styles.redButton,
                ...(savingReturn || !currentReturnKoliItems.length ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
              }}
            >
              {savingReturn ? 'Posting...' : 'Post'}
            </button>
          </div>

          {!currentReturnKoliItems.length ? <p style={styles.emptyText}>Return koli is still empty.</p> : null}
          {renderBasketTable(currentReturnKoliItems, 'return')}
        </div>
      </div> : null}
      {postTargetModalOpen ? (
        <div
          style={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!isPostingTarget) closePostTargetModal()
          }}
        >
          <div style={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div style={styles.sectionHeaderRow}>
              <div>
                <h2 style={styles.sectionTitle}>Post Return Koli</h2>
                <p style={styles.sectionSubtitle}>
                  Choose an existing koli to add these items into, or create a new koli number.
                </p>
              </div>
              <button
                type="button"
                onClick={closePostTargetModal}
                style={{
                  ...styles.removeIconButton,
                  ...(isPostingTarget ? { opacity: 0.55, cursor: 'not-allowed' } : {}),
                }}
                aria-label="Close post target"
                title="Close"
                disabled={isPostingTarget}
              >
                <XIcon />
              </button>
            </div>

            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Basket Qty</span>
              <strong style={styles.summaryValue}>{formatNumber(activePostTargetQty)}</strong>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Target Koli</label>
              <select
                value={postTargetSelection}
                onChange={(event) => setPostTargetSelection(event.target.value)}
                style={styles.input}
                disabled={isPostingTarget}
              >
                <option value="new">New Koli</option>
                {activePostTargetOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    Koli {item.sequence} - {formatNumber(item.totalQty)} qty
                    {item.gradeLabel ? ` - Grade ${item.gradeLabel}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {!activePostTargetOptions.length ? (
              <p style={styles.emptyText}>No existing koli found yet. This basket will be posted as a new koli.</p>
            ) : null}

            <div style={styles.buttonRow}>
              <button type="button" onClick={closePostTargetModal} style={styles.secondaryButton} disabled={isPostingTarget}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handlePostReturnKoli(postTargetSelection)
                }
                style={{
                  ...styles.redButton,
                  ...(isPostingTarget ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                }}
                disabled={isPostingTarget}
              >
                {isPostingTarget ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {canEditConfirmation && adjustmentModalOpen ? (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true" onClick={() => setAdjustmentModalOpen(false)}>
          <div style={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div style={styles.sectionHeaderRow}>
              <h2 style={styles.sectionTitle}>Adjustment</h2>
              <button
                type="button"
                onClick={() => setAdjustmentModalOpen(false)}
                style={styles.removeIconButton}
                aria-label="Close adjustment"
                title="Close"
              >
                <XIcon />
              </button>
            </div>

            {!grnFilter ? <p style={styles.emptyText}>Choose a GRN Number first.</p> : null}

            {grnFilter ? (
              <>
                <div style={styles.adjustmentFormGrid}>
                  <div style={{ ...styles.field, ...styles.modelPicker }}>
                    <label style={styles.label}>Adjustment Model</label>
                    <button
                      type="button"
                      style={styles.modelPickerButton}
                      onClick={() => setAdjustmentModelMenuOpen((current) => !current)}
                    >
                      <span style={adjustmentModelLabel ? styles.modelPickerName : styles.modelPickerPlaceholder}>
                        {adjustmentModelLabel || 'Choose model'}
                      </span>
                      <span aria-hidden="true">{adjustmentModelMenuOpen ? '^' : 'v'}</span>
                    </button>
                    {adjustmentModelMenuOpen ? (
                      <div style={styles.modelPickerList}>
                        {!adjustmentModelOptions.length ? <p style={styles.emptyText}>No rejection model found for this GRN.</p> : null}
                        {adjustmentModelOptions.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            style={styles.modelPickerOption}
                            onClick={() => {
                              setAdjustmentModelLabel(item.label)
                              setAdjustmentModelMenuOpen(false)
                            }}
                          >
                            {item.photo_url ? (
                              <img src={item.photo_url} alt={getModelLabel(item)} style={styles.modelPickerPhoto} />
                            ) : (
                              <span style={styles.modelPickerPhotoEmpty}>NO</span>
                            )}
                            <span style={styles.modelPickerText}>
                              <span style={styles.modelPickerName}>{getModelLabel(item)}</span>
                              <span style={styles.modelPickerMeta}>{item.brand_name || 'UNBRANDED'}</span>
                              <span style={styles.modelPickerMeta}>{item.category_name || 'UNCATEGORIZED'}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Adjustment Grade</label>
                    <select value={adjustmentGrade} onChange={(event) => setAdjustmentGrade(event.target.value)} style={styles.input}>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Adjustment Qty</label>
                    <input
                      type="number"
                      min="0"
                      value={adjustmentQty}
                      onChange={(event) => setAdjustmentQty(event.target.value)}
                      style={styles.input}
                      placeholder="Qty"
                    />
                  </div>
                </div>

                <div style={styles.buttonRow}>
                  <button type="button" onClick={() => handleAddAdjustmentItem('take')} style={styles.secondaryButton}>
                    Add to Take Koli
                  </button>
                  <button type="button" onClick={() => handleAddAdjustmentItem('return')} style={styles.redButton}>
                    Add to Return Koli
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {takeGradeModalOpen ? (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true" onClick={handleCloseTakeGradeModal}>
          <div style={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div style={styles.sectionHeaderRow}>
              <h2 style={styles.sectionTitle}>Take Grade</h2>
              <button
                type="button"
                onClick={handleCloseTakeGradeModal}
                style={styles.removeIconButton}
                aria-label="Close take grade"
                title="Close"
              >
                <XIcon />
              </button>
            </div>

            <p style={styles.emptyText}>
              Choose the grade for {formatNumber(pendingTakeRows.reduce((sum, item) => sum + Number(item.qty || 0), 0))} qty before adding to Take Koli.
            </p>

            <select
              value={takeGradeSelection}
              onChange={(event) => setTakeGradeSelection(event.target.value)}
              style={styles.input}
              aria-label="Take Grade"
            >
              <option value="">Choose grade</option>
              <option value="A">Grade A</option>
              <option value="B">Grade B</option>
              <option value="C">Grade C</option>
            </select>

            <div style={styles.buttonRow}>
              <button type="button" onClick={handleCloseTakeGradeModal} style={styles.secondaryButton}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTakeGrade}
                style={{
                  ...styles.primaryButton,
                  ...(!takeGradeSelection ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                }}
                disabled={!takeGradeSelection}
              >
                Add to Take Koli
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {previewPhotoUrl ? (
        <div style={styles.photoPreviewOverlay} role="dialog" aria-modal="true" onClick={() => setPreviewPhotoUrl('')}>
          <div style={styles.photoPreviewWrap} onClick={(event) => event.stopPropagation()}>
            <img src={previewPhotoUrl} alt="Product preview" style={styles.photoPreviewImage} />
            <button type="button" onClick={() => setPreviewPhotoUrl('')} style={styles.photoPreviewClose} aria-label="Close preview">
              X
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
