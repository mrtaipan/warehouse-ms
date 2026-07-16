'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

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

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
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
  overviewActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  builderButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38px',
    height: '38px',
    padding: 0,
    border: 'none',
    borderRadius: '10px',
    background: '#0f766e',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(15, 118, 110, 0.16)',
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
  tabList: {
    display: 'inline-flex',
    alignSelf: 'flex-start',
    gap: '6px',
    padding: '4px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#f8fafc',
  },
  tabButton: {
    minHeight: '32px',
    padding: '0 12px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  tabButtonActive: {
    background: '#111827',
    color: '#fff',
  },
  flatSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    paddingBottom: '20px',
  },
  flatSectionLast: {
    borderBottom: 'none',
    paddingBottom: 0,
  },
  resultToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'nowrap',
  },
  breakdownFilters: {
    display: 'grid',
    gridTemplateColumns: 'minmax(150px, 0.9fr) minmax(240px, 1.35fr) minmax(280px, 1.55fr) minmax(170px, 0.8fr) auto',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    flex: 1,
    minWidth: 0,
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
  verificationForm: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
    alignItems: 'start',
  },
  mobileFormShell: {
    width: '100%',
    maxWidth: '460px',
    minHeight: '100dvh',
    margin: '0 auto',
    alignSelf: 'center',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    borderLeft: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
  },
  mobileTopBar: {
    minHeight: '76px',
    display: 'grid',
    gridTemplateColumns: '40px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    borderBottom: '1px solid #e5e7eb',
    background: '#fff',
  },
  mobileIconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    border: '1px solid #dbe4f0',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  mobileGrnChip: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '34px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#eef6ff',
    color: '#1e3a8a',
    fontSize: '12px',
    fontWeight: '900',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  mobileInlineContent: {
    marginLeft: '16px',
    marginRight: '16px',
  },
  mobileFormCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    background: '#fff',
    margin: '0 16px',
  },
  koliTypeToggle: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '6px',
    padding: '4px',
    border: '1px solid #dbe4f0',
    borderRadius: '12px',
    background: '#f8fafc',
  },
  koliTypeButton: {
    minHeight: '38px',
    border: 'none',
    borderRadius: '9px',
    background: 'transparent',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: '850',
    cursor: 'pointer',
  },
  koliTypeButtonActive: {
    background: '#111827',
    color: '#fff',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.12)',
  },
  adjustmentCardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
  },
  adjustmentCard: {
    minWidth: 0,
    minHeight: '66px',
    padding: '10px 6px',
    border: '1px solid #dbe4f0',
    borderRadius: '10px',
    background: '#fff',
    color: '#64748b',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    cursor: 'pointer',
    textAlign: 'center',
  },
  adjustmentCardActive: {
    border: '1px solid #111827',
    background: '#111827',
    color: '#fff',
  },
  adjustmentCardDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
    background: '#f8fafc',
  },
  adjustmentCardTitle: {
    fontSize: '12px',
    fontWeight: '850',
    lineHeight: 1.1,
  },
  adjustmentCardHint: {
    fontSize: '10px',
    fontWeight: '700',
    lineHeight: 1.2,
    opacity: 0.78,
    whiteSpace: 'normal',
  },
  mobileModelList: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  mobileDropdownTrigger: {
    width: '100%',
    minHeight: '48px',
    padding: '12px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    background: '#fff',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: '10px',
    alignItems: 'center',
    textAlign: 'left',
    cursor: 'pointer',
  },
  mobileDropdownTriggerDisabled: {
    background: '#f8fafc',
    color: '#94a3b8',
    cursor: 'not-allowed',
  },
  mobileDropdownText: {
    minWidth: 0,
    color: '#0f172a',
    fontSize: '14px',
    fontWeight: '750',
    lineHeight: 1.35,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  mobileDropdownPlaceholder: {
    color: '#94a3b8',
    fontWeight: '700',
  },
  mobileDropdownChevron: {
    color: '#64748b',
    fontSize: '14px',
    fontWeight: '900',
  },
  mobileDropdownPanel: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    zIndex: 5,
    maxHeight: '260px',
    overflowY: 'auto',
    padding: '6px',
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    background: '#fff',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.14)',
  },
  mobileModelOption: {
    width: '100%',
    padding: '10px',
    border: '1px solid transparent',
    borderRadius: '10px',
    background: '#fff',
    display: 'grid',
    gridTemplateColumns: '52px minmax(0, 1fr) auto',
    gap: '10px',
    alignItems: 'center',
    textAlign: 'left',
    cursor: 'pointer',
  },
  mobileModelOptionActive: {
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
  },
  mobileModelPhoto: {
    width: '52px',
    height: '52px',
    borderRadius: '8px',
    objectFit: 'cover',
    background: '#f8fafc',
  },
  mobileModelPhotoEmpty: {
    width: '52px',
    height: '52px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    background: '#f8fafc',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: '800',
  },
  mobileModelSummary: {
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#f8fafc',
    display: 'grid',
    gridTemplateColumns: '72px minmax(0, 1fr) auto',
    alignItems: 'flex-start',
    gap: '12px',
  },
  mobileRemainingPill: {
    minWidth: '72px',
    padding: '8px 10px',
    borderRadius: '10px',
    background: '#eff6ff',
    color: '#0f172a',
    textAlign: 'center',
    fontWeight: '900',
    fontVariantNumeric: 'tabular-nums',
  },
  mobilePrimaryButton: {
    width: '100%',
    minHeight: '44px',
    border: '1px solid #111827',
    borderRadius: '10px',
    background: '#111827',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '850',
    cursor: 'pointer',
  },
  mobileDraftRow: {
    display: 'grid',
    gridTemplateColumns: '48px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 0',
    borderTop: '1px solid #e2e8f0',
  },
  mobileFormStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  formCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    background: '#fff',
  },
  formCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '10px',
  },
  draftLine: {
    padding: '10px 0',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  qtyInlineGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
  },
  adjustmentBadge: {
    display: 'inline-flex',
    alignSelf: 'flex-start',
    padding: '3px 8px',
    borderRadius: '999px',
    background: '#fff7ed',
    color: '#9a3412',
    border: '1px solid #fed7aa',
    fontSize: '10px',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '22px',
    fontWeight: '900',
    letterSpacing: 0,
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
  select: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    background: '#fff',
    width: '100%',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
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
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
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
  printButton: {
    height: '34px',
    padding: '0 13px',
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    background: '#fff',
    color: '#334155',
    fontSize: '12px',
    fontWeight: '750',
    cursor: 'pointer',
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
    objectFit: 'cover',
    borderRadius: '8px',
    display: 'block',
  },
  photoEmpty: {
    width: '44px',
    height: '44px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    background: '#f8fafc',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: '800',
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
  tableWrap: {
    maxHeight: '420px',
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
  koliTable: {
    width: '100%',
    minWidth: '980px',
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
    borderBottom: '2px solid #dbe4f0',
    position: 'sticky',
    top: 0,
  },
  koliTh: {
    color: '#020617',
    fontSize: '13px',
    fontWeight: '700',
    textTransform: 'none',
  },
  koliCenterCell: {
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  td: {
    padding: '12px',
    fontSize: '13px',
    color: '#1e293b',
    borderTop: '2px solid #e2e8f0',
    verticalAlign: 'middle',
  },
  koliTd: {
    padding: '16px 18px',
    fontSize: '13px',
    color: '#020617',
    borderTop: '3px solid #cbd5e1',
    verticalAlign: 'middle',
  },
  koliPictureStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  koliInsideStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  koliInsideItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  koliBrandText: {
    color: '#020617',
    fontSize: '13px',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  koliMetaText: {
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  transferAdjustmentPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'fit-content',
    minHeight: '18px',
    padding: '2px 7px',
    border: '1px solid #bfdbfe',
    borderRadius: '999px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '9px',
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  samplePill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'fit-content',
    minHeight: '18px',
    padding: '2px 7px',
    border: '1px solid #fed7aa',
    borderRadius: '999px',
    background: '#fff7ed',
    color: '#c2410c',
    fontSize: '9px',
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  koliCellStack: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  koliQtyStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    alignItems: 'center',
  },
  koliQtyBadge: {
    minWidth: '54px',
    minHeight: '30px',
    padding: '5px 12px',
    borderRadius: '999px',
    background: '#eef2ff',
    color: '#3730a3',
    border: '1px solid #e0e7ff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '900',
    fontVariantNumeric: 'tabular-nums',
  },
  koliQtyBadgeWarm: {
    background: '#ffedd5',
    color: '#9a3412',
    border: '1px solid #fed7aa',
  },
  koliQtyBadgeDanger: {
    background: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #fecaca',
  },
}

function getSourceKey(item) {
  return `${Number(item.brand_id || 0)}::${Number(item.category_id || 0)}::${String(item.model_name || '').trim().toUpperCase()}::${String(
    item.model_color || ''
  )
    .trim()
    .toUpperCase()}`
}

function getModelOnlyKey(item) {
  return `${String(item.model_name || '').trim().toUpperCase()}::${String(item.model_color || '').trim().toUpperCase()}`
}

function getModelLabel(item) {
  return item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name
}

function getModelDashLabel(item) {
  return item.model_color ? `${item.model_name} - ${item.model_color}` : item.model_name
}

function getModelPlainLabel(item) {
  return [item.model_name, item.model_color].filter(Boolean).join(' ')
}

function formatDisplayCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (match) => match.toUpperCase())
}

function normalizeQcItemRow(item) {
  return {
    ...item,
    model_color: item.variant_name || item.model_color || '',
  }
}

function normalizeConfirmRow(item) {
  return {
    ...item,
    is_sample: Boolean(item.is_sample),
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

function formatItemTypeSubcategoryLabel(value) {
  const parts = String(value || '')
    .split(/\s*(?:>|\/)\s*/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[parts.length - 1]} ${parts[parts.length - 2]}`
  }

  return String(value || '-').trim() || '-'
}

function getVerificationModelDropdownLabel(item) {
  if (!item) return 'Choose the Model'

  const itemLabel = [item.brand_name, formatItemTypeSubcategoryLabel(item.category_name)]
    .map((value) => String(value || '').trim())
    .filter((value) => value && value !== '-')
    .map(formatDisplayCase)
    .join(' ')
  const modelLabel = formatDisplayCase(getModelPlainLabel(item))

  return [itemLabel, modelLabel].filter(Boolean).join(' - ') || 'Choose the Model'
}

function getBrandItemLabel(item) {
  return [item.brand_name, formatItemTypeSubcategoryLabel(item.category_name)]
    .map((value) => String(value || '').trim())
    .filter((value) => value && value !== '-')
    .join(' ') || '-'
}

function getAdjustmentLabel(value) {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'NORMAL') return 'Normal'
  if (normalized === 'SURPLUS') return 'Surplus'
  if (normalized === 'SHORTAGE') return 'Shortage'
  if (normalized === 'REJECTION_MANUAL') return 'Manual Adjustment'
  if (normalized === 'TRANSFER') return 'Transfer'
  return ''
}

function getGradeTypeLabel(item) {
  const gradeLabel = `Grade ${item?.grade || 'A'}`
  const adjustmentLabel = getAdjustmentLabel(item?.adjustment_type)

  return adjustmentLabel ? `${gradeLabel} - ${adjustmentLabel}` : gradeLabel
}

function isTransferAdjustment(item) {
  return Boolean(item?.is_adjustment) && String(item?.adjustment_type || '').toUpperCase() === 'TRANSFER'
}

function isShortageType(item) {
  return String(item?.adjustment_type || '').toUpperCase() === 'SHORTAGE'
}

function isSurplusAdjustment(item) {
  return String(item?.adjustment_type || '').toUpperCase() === 'SURPLUS'
}

function getSourcePendingQty(item) {
  return Math.max(
    0,
    Number(item?.source_qty || 0) -
      Number(item?.confirmed_qty || 0) -
      Number(item?.shortage_qty || 0)
  )
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
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

  if (ignoredFilter !== 'modelName' && filters.modelName && normalizeFilterValue(getModelDashLabel(row)) !== normalizeFilterValue(filters.modelName)) {
    return false
  }

  if (ignoredFilter === 'qty') {
    return true
  }

  const filterQty = Number(filters.qtyValue)
  const currentQty = Number(qty || 0)

  if (!filters.qtyMode || filters.qtyValue === '' || !Number.isFinite(filterQty)) {
    return true
  }

  if (filters.qtyMode === 'lt') return currentQty < filterQty
  if (filters.qtyMode === 'eq') return currentQty === filterQty
  if (filters.qtyMode === 'gt') return currentQty > filterQty
  return true
}

function getFirstName(value) {
  return String(value || '').trim().split(/\s+/)[0] || ''
}

function getKoliDisplayLabel(koli) {
  if (!koli) return 'Koli -'
  if (koli.display_label) return koli.display_label
  return `Koli ${koli.koli_sequence || '-'}`
}

export default function QcConfirmationNextProcessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const draftIdRef = useRef(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [picName, setPicName] = useState('')
  const [qcItems, setQcItems] = useState([])
  const [confirmRows, setConfirmRows] = useState([])
  const [displayNameByEmail, setDisplayNameByEmail] = useState({})
  const [currentKoliItems, setCurrentKoliItems] = useState([])
  const [isSampleKoli, setIsSampleKoli] = useState(false)
  const [resultTab, setResultTab] = useState('koli')
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState('')
  const [selectedSourceKey, setSelectedSourceKey] = useState('')
  const [verificationQty, setVerificationQty] = useState('')
  const [adjustmentType, setAdjustmentType] = useState('')
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [resultFilters, setResultFilters] = useState({
    brandId: '',
    categoryId: '',
    modelName: '',
    qtyMode: '',
    qtyValue: '',
  })
  const grnFilter = searchParams.get('grn') || ''
  const isFormMode = searchParams.get('form') === '1'

  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError('')
    }

    const [
      { data: authData, error: authError },
      { data: qcData, error: qcError },
      { data: confirmData, error: confirmError },
      { data: profileData, error: profileError },
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
            )
          `)
        .eq('status', 'done')
        .order('created_at', { ascending: false }),
      supabase
        .from('qc_confirm')
        .select('id, inbound_id, brand_id, category_id, model_name, variant_name, photo_url, qty, koli_sequence, is_sample, grade, is_adjustment, adjustment_type, pic_name')
        .order('koli_sequence', { ascending: true }),
      supabase
        .from('dir_user_profiles')
        .select('email, display_name'),
    ])

    if (authError || qcError || confirmError || profileError) {
      if (!silent) {
        setError(authError?.message || qcError?.message || confirmError?.message || profileError?.message || 'Failed to load confirmation next process.')
        setLoading(false)
      }
      return
    }

    let nextPicName = ''
    if (authData?.user) {
      const { data: profileRow } = await getProfileByAuthenticatedUser(supabase, authData.user, 'display_name')
      nextPicName = getDisplayName(authData.user, profileRow)
    }

    const profileMap = {}
    ;(profileData || []).forEach((item) => {
      const email = normalizeEmail(item.email)
      if (email) {
        profileMap[email] = item.display_name || item.email || ''
      }
    })

    setQcItems((qcData || []).map(normalizeQcItemRow))
    setConfirmRows((confirmData || []).map(normalizeConfirmRow))
    setDisplayNameByEmail(profileMap)
    setPicName(nextPicName)
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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (saving || modelDropdownOpen || previewPhotoUrl || currentKoliItems.length || selectedSourceKey || verificationQty) {
        return
      }

      loadData(true)
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [currentKoliItems.length, loadData, modelDropdownOpen, previewPhotoUrl, saving, selectedSourceKey, verificationQty])

  const selectedInbound = useMemo(
    () => qcItems.find((item) => item.inbound?.grn_number === grnFilter)?.inbound || null,
    [grnFilter, qcItems]
  )

  const sourceRows = useMemo(() => {
    const grouped = new Map()

    qcItems
      .filter((item) => item.inbound?.grn_number === grnFilter && Number(item.qty_a || 0) > 0)
      .forEach((item) => {
        const key = getSourceKey({
          brand_id: getQcItemBrandId(item),
          category_id: getQcItemCategoryId(item),
          model_name: item.model_name,
          model_color: item.model_color,
        })
        const current = grouped.get(key) || {
          key,
          inbound_id: item.inbound_id,
          brand_id: getQcItemBrandId(item),
          category_id: getQcItemCategoryId(item),
          brand_name: getQcItemBrandLabel(item),
          category_name: getQcItemCategoryLabel(item),
          model_name: item.model_name || 'UNKNOWN MODEL',
          model_color: item.model_color || '',
          photo_url: item.photo_url || '',
          source_qty: 0,
          confirmed_qty: 0,
          shortage_qty: 0,
          pic_names: new Set(),
        }

        current.source_qty += Number(item.qty_a || 0)
        const assignedEmail = normalizeEmail(item.assigned_to)
        const picName = getFirstName(displayNameByEmail[assignedEmail] || item.pic_name || item.assigned_to)
        if (picName) {
          current.pic_names.add(picName)
        }
        grouped.set(key, current)
      })

    const sourceKeyByModelOnlyKey = new Map()
    grouped.forEach((value, key) => {
      const modelOnlyKey = getModelOnlyKey(value)
      if (modelOnlyKey && !sourceKeyByModelOnlyKey.has(modelOnlyKey)) {
        sourceKeyByModelOnlyKey.set(modelOnlyKey, key)
      }
    })

    confirmRows
      .filter((item) => (
        Number(item.inbound_id) === Number(selectedInbound?.id) &&
        String(item.grade || 'A').toUpperCase() === 'A'
      ))
      .forEach((item) => {
        const key = getSourceKey(item)
        const fallbackKey = sourceKeyByModelOnlyKey.get(getModelOnlyKey(item))
        const exactCurrent = grouped.get(key)
        const current = exactCurrent || grouped.get(fallbackKey)
        const targetKey = exactCurrent ? key : fallbackKey

        if (!current) {
          return
        }

        if (isShortageType(item)) {
          const verifiedQty = Number(item.qty || 0)
          const shortageQty = Math.max(0, Number(current.source_qty || 0) - Number(current.confirmed_qty || 0) - Number(current.shortage_qty || 0) - verifiedQty)
          current.confirmed_qty += verifiedQty
          current.shortage_qty += shortageQty
        } else {
          current.confirmed_qty += Number(item.qty || 0)
        }
        current.photo_url = current.photo_url || item.photo_url || ''
        grouped.set(targetKey, current)
      })

    return Array.from(grouped.values())
      .filter((item) => Number(item.source_qty || 0) > 0)
      .map((item) => ({
        ...item,
        pic_names: Array.from(item.pic_names || []),
      }))
      .sort((a, b) => {
        if (a.brand_name !== b.brand_name) return a.brand_name.localeCompare(b.brand_name)
        if (a.category_name !== b.category_name) return a.category_name.localeCompare(b.category_name)
        return getModelLabel(a).localeCompare(getModelLabel(b))
      })
  }, [confirmRows, displayNameByEmail, grnFilter, qcItems, selectedInbound?.id])

  const sourceRowByKey = useMemo(() => new Map(sourceRows.map((item) => [item.key, item])), [sourceRows])
  const sourceRowByModelOnlyKey = useMemo(() => {
    const result = new Map()
    sourceRows.forEach((item) => {
      const key = getModelOnlyKey(item)
      if (key && !result.has(key)) {
        result.set(key, item)
      }
    })
    return result
  }, [sourceRows])

  const effectiveSelectedSourceKey = sourceRows.some((item) => item.key === selectedSourceKey) ? selectedSourceKey : ''
  const selectedSourceRow = sourceRows.find((item) => item.key === effectiveSelectedSourceKey) || null

  const sourceTotals = useMemo(
    () => sourceRows.reduce(
      (result, item) => {
        result.source += Number(item.source_qty || 0)
        result.confirmed += Number(item.confirmed_qty || 0)
        result.shortage += Number(item.shortage_qty || 0)
        return result
      },
      { source: 0, confirmed: 0, shortage: 0 }
    ),
    [sourceRows]
  )

  const currentKoliQty = currentKoliItems.reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const postedKoliRows = useMemo(() => {
    const grouped = new Map()

    confirmRows
      .filter((item) => Number(item.inbound_id) === Number(selectedInbound?.id))
      .forEach((item) => {
        const isSample = Boolean(item.is_sample)
        const sequence = Number(item.koli_sequence || 0)
        const key = `${isSample ? 'sample' : 'regular'}::${sequence}`
        const current = grouped.get(key) || {
          key,
          koli_sequence: sequence,
          is_sample: isSample,
          total_qty: 0,
          has_transfer_adjustment: false,
          items: [],
        }

        current.total_qty += Number(item.qty || 0)
        current.has_transfer_adjustment = current.has_transfer_adjustment || isTransferAdjustment(item)
        const sourceRow = sourceRowByKey.get(getSourceKey(item)) || sourceRowByModelOnlyKey.get(getModelOnlyKey(item))
        current.items.push({
          ...item,
          brand_id: sourceRow?.brand_id || item.brand_id || null,
          category_id: sourceRow?.category_id || item.category_id || null,
          brand_name: sourceRow?.brand_name || 'UNBRANDED',
          category_name: sourceRow?.category_name || 'UNCATEGORIZED',
          model_name: sourceRow?.model_name || item.model_name,
          model_color: sourceRow?.model_color || item.model_color,
          pic_names: item.pic_name ? [getFirstName(item.pic_name)] : sourceRow?.pic_names || [],
          photo_url: item.photo_url || sourceRow?.photo_url || '',
        })
        grouped.set(key, current)
      })

    return Array.from(grouped.values())
      .sort((a, b) => a.koli_sequence - b.koli_sequence)
      .map((row) => {
        return {
          ...row,
          display_label: `Koli ${row.koli_sequence}`,
        }
      })
  }, [confirmRows, selectedInbound?.id, sourceRowByKey, sourceRowByModelOnlyKey])

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
            .map((row) => getModelDashLabel(row))
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [resultFilters, sourceRows]
  )

  const hasResultFilters = Boolean(
    resultFilters.brandId ||
    resultFilters.categoryId ||
    resultFilters.modelName ||
    resultFilters.qtyMode ||
    resultFilters.qtyValue
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
      qtyMode: '',
      qtyValue: '',
    })
  }

  const matchesResultFilters = useCallback((row, qty) => {
    return matchesResultFilterValues(row, qty, resultFilters)
  }, [resultFilters])

  const filteredSourceRows = useMemo(
    () => sourceRows.filter((row) => matchesResultFilters(row, Number(row.source_qty || 0))),
    [matchesResultFilters, sourceRows]
  )

  const filteredPostedKoliRows = useMemo(
    () =>
      postedKoliRows
        .map((koli) => ({
          ...koli,
          items: koli.items.filter((item) => matchesResultFilters(item, Number(item.qty || 0))),
        }))
        .filter((koli) => koli.items.length > 0)
        .map((koli) => ({
          ...koli,
          total_qty: koli.items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
        })),
    [matchesResultFilters, postedKoliRows]
  )

  function getDraftQtyForSource(sourceKey) {
    const draftItems = currentKoliItems.filter((item) => item.source_key === sourceKey)

    if (draftItems.some((item) => item.closes_remaining)) {
      return Number.MAX_SAFE_INTEGER
    }

    return draftItems.reduce((sum, item) => sum + Number(item.qty || 0), 0)
  }

  const selectedSourceRemainingQty = selectedSourceRow
    ? Math.max(0, getSourcePendingQty(selectedSourceRow) - getDraftQtyForSource(selectedSourceRow.key))
    : 0
  const remainingSourceOptions = sourceRows
    .map((row) => ({
      row,
      remainingQty: Math.max(0, getSourcePendingQty(row) - getDraftQtyForSource(row.key)),
    }))
    .filter((item) => item.remainingQty > 0)
  const onlySurplusAvailable = sourceRows.length > 0 && remainingSourceOptions.length === 0
  const effectiveAdjustmentType = onlySurplusAvailable ? 'SURPLUS' : adjustmentType
  const isAdjustmentMode = Boolean(effectiveAdjustmentType)
  const modelDropdownOptions = isAdjustmentMode
    ? sourceRows.map((row) => ({
      row,
      remainingQty: Math.max(0, getSourcePendingQty(row) - getDraftQtyForSource(row.key)),
    }))
    : remainingSourceOptions
  const canAddSelectedSourceItem = Boolean(selectedSourceRow) && (
    effectiveAdjustmentType === 'SURPLUS' || selectedSourceRemainingQty > 0
  )

  function handleAddSelectedSourceItem() {
    setError('')
    setSuccess('')

    if (!selectedSourceRow) {
      setError('Choose a model first.')
      return
    }

    const nextQty = Number(verificationQty || 0)

    if (effectiveAdjustmentType === 'SHORTAGE' && verificationQty === '') {
      setError('Input the physical Grade A qty first.')
      return
    }

    if (effectiveAdjustmentType !== 'SHORTAGE' && nextQty <= 0) {
      setError('Qty must be greater than 0.')
      return
    }

    if (!isAdjustmentMode && nextQty > selectedSourceRemainingQty) {
      setError(`Qty for ${selectedSourceRow.model_name} cannot be greater than the remaining source qty (${selectedSourceRemainingQty}).`)
      return
    }

    if (effectiveAdjustmentType === 'SHORTAGE' && nextQty > selectedSourceRemainingQty) {
      setError(`Grade A qty for ${selectedSourceRow.model_name} cannot be greater than the remaining source qty (${selectedSourceRemainingQty}).`)
      return
    }

    if (effectiveAdjustmentType === 'SHORTAGE' && selectedSourceRemainingQty - nextQty <= 0) {
      setError('Shortage needs the physical Grade A qty to be less than the remaining qty.')
      return
    }

    const createDraftItem = ({ qty, isAdjustment = false, type = null, closesRemaining = false }) => ({
      id: `draft-${draftIdRef.current++}`,
      source_key: selectedSourceRow.key,
      inbound_id: selectedSourceRow.inbound_id,
      brand_id: selectedSourceRow.brand_id,
      brand_name: selectedSourceRow.brand_name,
      category_id: selectedSourceRow.category_id,
      category_name: selectedSourceRow.category_name,
      model_name: selectedSourceRow.model_name,
      model_color: selectedSourceRow.model_color,
      photo_url: selectedSourceRow.photo_url,
      qty,
      grade: 'A',
      is_adjustment: isAdjustment,
      adjustment_type: type,
      closes_remaining: closesRemaining,
    })

    const nextItems = effectiveAdjustmentType === 'SHORTAGE'
      ? [
        createDraftItem({ qty: nextQty, isAdjustment: true, type: 'SHORTAGE', closesRemaining: true }),
      ]
      : [
        createDraftItem({
          qty: nextQty,
          isAdjustment: isAdjustmentMode,
          type: effectiveAdjustmentType || null,
        }),
      ]

    setCurrentKoliItems((prev) => [...prev, ...nextItems])
    setVerificationQty('')
    if (effectiveAdjustmentType === 'SHORTAGE' || (!isSurplusAdjustment({ adjustment_type: effectiveAdjustmentType }) && nextQty >= selectedSourceRemainingQty)) {
      setSelectedSourceKey('')
    }
  }

  function removeDraftItem(draftId) {
    setCurrentKoliItems((prev) => prev.filter((item) => item.id !== draftId))
  }

  function handleViewModeChange(nextIsFormMode) {
    const params = new URLSearchParams(searchParams.toString())
    if (grnFilter) {
      params.set('grn', grnFilter)
    }
    if (nextIsFormMode) {
      params.set('form', '1')
    } else {
      params.delete('form')
    }

    const nextQuery = params.toString()
    router.replace(`/dashboard/qc/confirmation/next-process${nextQuery ? `?${nextQuery}` : ''}`, { scroll: false })
  }

  function handlePrintPostedKoli(koli) {
    if (!selectedInbound) {
      return
    }

    const rowsHtml = koli.items
      .map(
        (item) => `
          <tr>
            <td><strong>${item.brand_name || '-'}</strong><br />${item.category_name || '-'}</td>
            <td>${getModelDashLabel(item)}</td>
            <td>${getGradeTypeLabel(item)}</td>
            <td class="qty">${Number(item.qty || 0)}</td>
          </tr>
        `
      )
      .join('')

    const printWindow = window.open('', '_blank', 'width=800,height=900')

    if (!printWindow) {
      setError('Print window was blocked by the browser.')
      return
    }

    const printHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>QC Verified: Grade A</title>
    <style>
      @page { size: A6 portrait; margin: 8mm; }
      body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
      .card { border: 2px solid #111827; border-radius: 16px; padding: 18px; width: 100%; box-sizing: border-box; }
      h1 { margin: 0 0 16px; font-size: 26px; text-align: center; }
      .row { display: grid; grid-template-columns: 88px 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid #e5e7eb; align-items: start; }
      .row:last-child { border-bottom: none; }
      .label { font-weight: 700; font-size: 12px; }
      .value { font-weight: 500; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin-top: 18px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; vertical-align: middle; }
      th { background: #f9fafb; text-align: left; }
      .qty { text-align: center; font-weight: 800; }
      .total { margin-top: 16px; padding: 14px; border: 2px solid #111827; border-radius: 14px; text-align: center; }
      .totalLabel { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
      .totalValue { margin-top: 6px; font-size: 42px; line-height: 1; font-weight: 800; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>QC Verified: Grade A</h1>
      <div class="row"><div class="label">No GRN</div><div class="value">${selectedInbound.grn_number || '-'}</div></div>
      <div class="row"><div class="label">No Koli</div><div class="value">${getKoliDisplayLabel(koli)}</div></div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Model</th>
            <th>Type</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div class="total">
        <div class="totalLabel">Total Qty</div>
        <div class="totalValue">${koli.total_qty}</div>
      </div>
    </div>
    <script>window.onload = function () { window.print(); };</script>
  </body>
</html>`

    printWindow.document.open()
    printWindow.document.write(printHtml)
    printWindow.document.close()
  }

  async function handlePostCurrentKoli() {
    setError('')
    setSuccess('')

    if (!selectedInbound) {
      setError('Choose a GRN first.')
      return
    }

    if (!currentKoliItems.length) {
      setError('Current koli is still empty.')
      return
    }

    setSaving(true)
    const { data: latestConfirmRows, error: sequenceError } = await supabase
      .from('qc_confirm')
      .select('koli_sequence, is_sample')
      .eq('inbound_id', selectedInbound.id)

    if (sequenceError) {
      setError(sequenceError.message)
      setSaving(false)
      return
    }

    const nextKoliSequence =
      (latestConfirmRows || []).reduce((maxValue, item) => Math.max(maxValue, Number(item.koli_sequence || 0)), 0) + 1
    const nextDisplayLabel = `Koli ${nextKoliSequence}`

    const payload = currentKoliItems.map((item) => ({
      inbound_id: item.inbound_id,
      brand_id: item.brand_id,
      category_id: item.category_id,
      model_name: item.model_name,
      variant_name: item.model_color || null,
      photo_url: item.photo_url || null,
      qty: Number(item.qty || 0),
      koli_sequence: nextKoliSequence,
      is_sample: isSampleKoli,
      grade: 'A',
      pic_name: picName || 'QC Staff',
      is_adjustment: Boolean(item.is_adjustment),
      adjustment_type: item.adjustment_type || null,
    }))

    const { data, error: insertError } = await supabase
      .from('qc_confirm')
      .insert(payload)
      .select('id, inbound_id, brand_id, category_id, model_name, variant_name, photo_url, qty, koli_sequence, is_sample, grade, is_adjustment, adjustment_type, pic_name')

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setConfirmRows((prev) => [...prev, ...(data || []).map(normalizeConfirmRow)])
    setCurrentKoliItems([])
    setSelectedSourceKey('')
    setVerificationQty('')
    setAdjustmentType('')
    setSuccess(`${nextDisplayLabel} posted to next process.`)
    setSaving(false)
  }

  if (loading) {
    return <p style={styles.emptyText}>Loading confirmation next process...</p>
  }

  if (isFormMode) {
    return (
      <div style={styles.mobileFormShell}>
        <header style={styles.mobileTopBar}>
          <button
            type="button"
            onClick={() => handleViewModeChange(false)}
            style={styles.mobileIconButton}
            aria-label="Back to passing grade results"
            title="Passing Grade"
          >
            <BackIcon />
          </button>
          <div>
            <p style={styles.eyebrow}>Grading Verification</p>
            <h1 style={{ ...styles.title, fontSize: '22px' }}>Grade A</h1>
          </div>
          <span style={styles.mobileGrnChip}>{selectedInbound?.grn_number || grnFilter || '-'}</span>
        </header>

        {error ? <p style={{ ...styles.errorText, ...styles.mobileInlineContent }}>{error}</p> : null}
        {success ? <p style={{ ...styles.successText, ...styles.mobileInlineContent }}>{success}</p> : null}
        {!grnFilter ? <p style={{ ...styles.emptyText, ...styles.mobileInlineContent }}>Open this page from Grading Verification first.</p> : null}

        <section style={styles.mobileFormCard}>
          <div style={styles.field}>
            <label style={styles.label}>Koli Type</label>
            <div style={styles.koliTypeToggle}>
              {[
                { value: false, label: 'Reguler' },
                { value: true, label: 'Sample' },
              ].map((option) => {
                const isActive = isSampleKoli === option.value

                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setIsSampleKoli(option.value)}
                    style={{
                      ...styles.koliTypeButton,
                      ...(isActive ? styles.koliTypeButtonActive : {}),
                    }}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Adjustment</label>
            <div style={styles.adjustmentCardGrid}>
              {[
                { value: '', title: 'Normal', hint: 'Based on remaining' },
                { value: 'SURPLUS', title: 'Surplus', hint: 'Physically Extra Qty' },
                { value: 'SHORTAGE', title: 'Shortage', hint: 'Physically Less Qty' },
              ].map((option) => {
                const isActive = effectiveAdjustmentType === option.value
                const isDisabled = onlySurplusAvailable && option.value !== 'SURPLUS'

                return (
                  <button
                    key={option.title}
                    type="button"
                    onClick={() => {
                      if (isDisabled) return
                      setAdjustmentType(option.value)
                      setSelectedSourceKey('')
                      setVerificationQty('')
                      setModelDropdownOpen(false)
                      setError('')
                      setSuccess('')
                    }}
                    style={{
                      ...styles.adjustmentCard,
                      ...(isActive ? styles.adjustmentCardActive : {}),
                      ...(isDisabled ? styles.adjustmentCardDisabled : {}),
                    }}
                    disabled={isDisabled}
                  >
                    <span style={styles.adjustmentCardTitle}>{option.title}</span>
                    <span style={styles.adjustmentCardHint}>{option.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={styles.mobileModelList}>
            <label style={styles.label}>Model</label>
            {!sourceRows.length ? <p style={styles.emptyText}>No model available.</p> : null}
            {!isAdjustmentMode && sourceRows.length && !remainingSourceOptions.length ? <p style={styles.emptyText}>No remaining model available.</p> : null}
            <button
              type="button"
              onClick={() => modelDropdownOptions.length && setModelDropdownOpen((prev) => !prev)}
              style={{
                ...styles.mobileDropdownTrigger,
                ...(!modelDropdownOptions.length ? styles.mobileDropdownTriggerDisabled : {}),
              }}
              aria-expanded={modelDropdownOpen}
              disabled={!modelDropdownOptions.length}
            >
              <span style={{ ...styles.mobileDropdownText, ...(!selectedSourceRow ? styles.mobileDropdownPlaceholder : {}) }}>
                {getVerificationModelDropdownLabel(selectedSourceRow)}
              </span>
              <span style={styles.mobileDropdownChevron}>v</span>
            </button>
            {modelDropdownOpen ? (
              <div style={styles.mobileDropdownPanel}>
              {modelDropdownOptions.map(({ row, remainingQty }) => {
                const isSelected = row.key === effectiveSelectedSourceKey

                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => {
                      setSelectedSourceKey(row.key)
                      setVerificationQty('')
                      setError('')
                      setSuccess('')
                      setModelDropdownOpen(false)
                    }}
                    style={{
                      ...styles.mobileModelOption,
                      ...(isSelected ? styles.mobileModelOptionActive : {}),
                    }}
                  >
                    {row.photo_url ? (
                      <img src={row.photo_url} alt={getModelDashLabel(row)} style={styles.mobileModelPhoto} />
                    ) : (
                      <span style={styles.mobileModelPhotoEmpty}>NO</span>
                    )}
                    <span style={styles.modelMeta}>
                      <strong style={styles.modelName}>{getModelDashLabel(row)}</strong>
                      <span style={styles.modelInfo}>{row.brand_name}</span>
                    </span>
                    <span style={styles.mobileRemainingPill}>{formatNumber(remainingQty)}</span>
                  </button>
                )
              })}
              </div>
            ) : null}
          </div>

          {selectedSourceRow ? (
            <div style={styles.mobileModelSummary}>
              {selectedSourceRow.photo_url ? (
                <button
                  type="button"
                  onClick={() => setPreviewPhotoUrl(selectedSourceRow.photo_url)}
                  style={{ ...styles.photoButton, width: '72px', height: '72px' }}
                  aria-label={`Preview ${getModelDashLabel(selectedSourceRow)} photo`}
                  title="Preview photo"
                >
                  <img src={selectedSourceRow.photo_url} alt={getModelDashLabel(selectedSourceRow)} style={{ ...styles.photoThumb, width: '72px', height: '72px' }} />
                </button>
              ) : (
                <span style={{ ...styles.mobileModelPhotoEmpty, width: '72px', height: '72px' }}>NO</span>
              )}
              <div style={styles.modelMeta}>
                <strong style={styles.modelName}>{getModelDashLabel(selectedSourceRow)}</strong>
                <p style={styles.modelInfo}>{selectedSourceRow.brand_name}</p>
                <p style={styles.modelInfo}>{selectedSourceRow.category_name}</p>
                {isAdjustmentMode ? <span style={styles.adjustmentBadge}>{getAdjustmentLabel(effectiveAdjustmentType)}</span> : null}
              </div>
              <div>
                <span style={styles.qtyLabel}>Remaining</span>
                <div style={styles.mobileRemainingPill}>{formatNumber(selectedSourceRemainingQty)}</div>
              </div>
            </div>
          ) : null}

          <div style={styles.field}>
            <label style={styles.label}>Qty</label>
            <input
              type="number"
              min="0"
              max={effectiveAdjustmentType === 'SURPLUS' ? undefined : selectedSourceRemainingQty}
              value={verificationQty}
              onChange={(event) => {
                const nextValue = event.target.value

                if (effectiveAdjustmentType === 'SURPLUS') {
                  setVerificationQty(nextValue)
                  return
                }

                if (nextValue === '') {
                  setVerificationQty('')
                  return
                }

                const cappedValue = Math.min(Number(nextValue || 0), selectedSourceRemainingQty)
                setVerificationQty(String(Math.max(0, cappedValue)))
              }}
              style={styles.input}
              placeholder={effectiveAdjustmentType === 'SHORTAGE' ? 'Input physical Grade A qty' : 'Input qty'}
            />
          </div>

          <button
            type="button"
            onClick={handleAddSelectedSourceItem}
            disabled={!canAddSelectedSourceItem}
            style={{
              ...styles.mobilePrimaryButton,
              ...(!canAddSelectedSourceItem ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
            }}
          >
            Add Item to Koli
          </button>
        </section>

        <section style={styles.mobileFormCard}>
          <div style={styles.formCardHeader}>
            <strong style={styles.modelName}>Grade A Koli</strong>
            <strong style={styles.metricValue}>{formatNumber(currentKoliQty)}</strong>
          </div>

          {!currentKoliItems.length ? <p style={styles.emptyText}>No item in the Grade A koli yet.</p> : null}
          {currentKoliItems.map((item, index) => {
            const sourceRow = sourceRowByKey.get(item.source_key)
            const displayItem = {
              ...item,
              brand_name: item.brand_name || sourceRow?.brand_name,
              category_name: item.category_name || sourceRow?.category_name,
            }

            return (
              <div key={`${item.id}-${index}`} style={styles.mobileDraftRow}>
                {item.photo_url ? (
                  <button
                    type="button"
                    onClick={() => setPreviewPhotoUrl(item.photo_url)}
                    style={{ ...styles.photoButton, width: '48px', height: '48px' }}
                    aria-label={`Preview ${getModelDashLabel(item)} photo`}
                    title="Preview photo"
                  >
                    <img src={item.photo_url} alt={getModelDashLabel(item)} style={{ ...styles.photoThumb, width: '48px', height: '48px' }} />
                  </button>
                ) : (
                  <span style={{ ...styles.mobileModelPhotoEmpty, width: '48px', height: '48px' }}>NO</span>
                )}
                <div style={styles.modelMeta}>
                  <strong style={styles.modelName}>{getModelDashLabel(item)}</strong>
                  <p style={styles.modelInfo}>{getBrandItemLabel(displayItem)}</p>
                  {item.adjustment_type ? <span style={styles.adjustmentBadge}>{getAdjustmentLabel(item.adjustment_type)}</span> : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={styles.infoValue}>{formatNumber(item.qty)}</strong>
                  <button type="button" onClick={() => removeDraftItem(item.id)} style={styles.secondaryButton}>
                    Remove
                  </button>
                </div>
              </div>
            )
          })}

          <button
            type="button"
            onClick={handlePostCurrentKoli}
            disabled={saving || !currentKoliItems.length}
            style={{
              ...styles.mobilePrimaryButton,
              ...(saving || !currentKoliItems.length ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
            }}
          >
            {saving ? 'Posting...' : 'Post'}
          </button>
        </section>
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

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.topBar}>
          <div>
            <p style={styles.eyebrow}>Grading Verification</p>
            <h1 style={styles.title}>Passing Grade</h1>
          </div>
          <div style={styles.overviewActions}>
            <button
              type="button"
              onClick={() => handleViewModeChange(true)}
              style={styles.builderButton}
              aria-label="Open Grade A form"
              title="Grade A"
            >
              <BuilderIcon />
            </button>
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
                <strong style={styles.metricValue}>{sourceTotals.source}</strong>
              </div>
              <div style={styles.metricBox}>
                <span style={styles.grnLabel}>Verified</span>
                <strong style={styles.metricValue}>{sourceTotals.confirmed}</strong>
              </div>
              <div style={styles.metricBox}>
                <span style={styles.grnLabel}>Pending</span>
                <strong style={styles.metricValue}>{Math.max(0, sourceTotals.source - sourceTotals.confirmed - sourceTotals.shortage)}</strong>
              </div>
              <div style={styles.metricBox}>
                <span style={styles.grnLabel}>Total Koli</span>
                <strong style={styles.metricValue}>{postedKoliRows.length}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section style={{ ...styles.flatSection, ...styles.flatSectionLast }}>
        <div style={styles.resultToolbar}>
          <div style={styles.tabList}>
            <button
              type="button"
              onClick={() => setResultTab('koli')}
              style={{ ...styles.tabButton, ...(resultTab === 'koli' ? styles.tabButtonActive : {}) }}
            >
              Koli
            </button>
            <button
              type="button"
              onClick={() => setResultTab('model')}
              style={{ ...styles.tabButton, ...(resultTab === 'model' ? styles.tabButtonActive : {}) }}
            >
              Model
            </button>
          </div>
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
            <div style={styles.qtyFilterGroup}>
              <select
                value={resultFilters.qtyMode}
                onChange={(event) => {
                  updateResultFilter('qtyMode', event.target.value)
                  if (!event.target.value) {
                    updateResultFilter('qtyValue', '')
                  }
                }}
                style={styles.filterSelect}
                aria-label="Filter quantity comparison"
              >
                <option value="">Qty</option>
                <option value="lt">&lt;</option>
                <option value="eq">=</option>
                <option value="gt">&gt;</option>
              </select>
              <input
                type="text"
                inputMode="numeric"
                value={resultFilters.qtyValue}
                onChange={(event) => updateResultFilter('qtyValue', event.target.value.replace(/[^\d]/g, ''))}
                disabled={!resultFilters.qtyMode}
                style={{
                  ...styles.filterNumberInput,
                  ...(!resultFilters.qtyMode ? styles.filterNumberInputDisabled : {}),
                }}
                placeholder="Qty"
                aria-label="Filter quantity number"
              />
            </div>
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
        </div>

        {!grnFilter ? <p style={styles.emptyText}>Open this page from Grading Verification first.</p> : null}

        {resultTab === 'koli' ? (
          <>
            {grnFilter && !filteredPostedKoliRows.length ? <p style={styles.emptyText}>No posted Grade A koli matches this view.</p> : null}
            {grnFilter && filteredPostedKoliRows.length ? (
              <div style={styles.tableWrap}>
                <table style={styles.koliTable}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, ...styles.koliTh, ...styles.koliCenterCell }}>Koli</th>
                      <th style={{ ...styles.th, ...styles.koliTh }}>Picture</th>
                      <th style={{ ...styles.th, ...styles.koliTh }}>Inside</th>
                      <th style={{ ...styles.th, ...styles.koliTh, ...styles.koliCenterCell }}>Qty</th>
                      <th style={{ ...styles.th, ...styles.koliTh, ...styles.koliCenterCell }}>PIC</th>
                      <th style={{ ...styles.th, ...styles.koliTh, ...styles.koliCenterCell }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPostedKoliRows.map((koli) => {
                      const picNames = Array.from(new Set(koli.items.flatMap((item) => item.pic_names || []).filter(Boolean)))

                      return (
                        <tr key={koli.key || koli.koli_sequence}>
                          <td style={{ ...styles.koliTd, ...styles.koliCenterCell }}>
                            <span style={styles.koliCellStack}>
                              <span>{getKoliDisplayLabel(koli)}</span>
                              {koli.has_transfer_adjustment ? <span style={styles.transferAdjustmentPill}>ADJ</span> : null}
                              {koli.is_sample ? <span style={styles.samplePill}>Sample</span> : null}
                            </span>
                          </td>
                          <td style={styles.koliTd}>
                            <div style={styles.koliPictureStack}>
                              {koli.items.map((item, index) => (
                                item.photo_url ? (
                                  <button
                                    key={`${item.id}-${koli.koli_sequence}-${index}`}
                                    type="button"
                                    onClick={() => setPreviewPhotoUrl(item.photo_url)}
                                    style={{ ...styles.photoButton, width: '44px', height: '44px' }}
                                    aria-label={`Preview ${getModelLabel(item)} photo`}
                                    title="Preview photo"
                                  >
                                    <img src={item.photo_url} alt={getModelLabel(item)} style={{ ...styles.photoThumb, width: '44px', height: '44px' }} />
                                  </button>
                                ) : (
                                  <span key={`${item.id}-${koli.koli_sequence}-${index}`} style={{ ...styles.photoEmpty, width: '44px', height: '44px' }}>NO</span>
                                )
                              ))}
                            </div>
                          </td>
                          <td style={styles.koliTd}>
                            <div style={styles.koliInsideStack}>
                              {koli.items.map((item, index) => (
                                <div key={`${item.id}-${koli.koli_sequence}-inside-${index}`} style={styles.koliInsideItem}>
                                  <span style={styles.koliBrandText}>{item.brand_name || 'UNBRANDED'}</span>
                                  <span style={styles.koliMetaText}>{formatItemTypeSubcategoryLabel(item.category_name)}</span>
                                  <span style={styles.koliMetaText}>{getModelDashLabel(item)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td style={{ ...styles.koliTd, ...styles.koliCenterCell }}>
                            <div style={styles.koliQtyStack}>
                              {koli.items.map((item, index) => (
                                <span
                                  key={`${item.id}-${koli.koli_sequence}-qty-${index}`}
                                  style={styles.koliQtyBadge}
                                >
                                  {formatNumber(item.qty)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ ...styles.koliTd, ...styles.koliCenterCell }}>{picNames.length ? picNames.join(', ') : '-'}</td>
                          <td style={{ ...styles.koliTd, ...styles.koliCenterCell }}>
                            <button type="button" onClick={() => handlePrintPostedKoli(koli)} style={styles.printButton}>
                              Print
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : null}

        {resultTab === 'model' ? (
          <>
            {grnFilter && !filteredSourceRows.length ? <p style={styles.emptyText}>No Grade A model source matches this view.</p> : null}
            {grnFilter && filteredSourceRows.length ? (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, ...styles.koliTh }}>Brand</th>
                      <th style={{ ...styles.th, ...styles.koliTh }}>Picture</th>
                      <th style={{ ...styles.th, ...styles.koliTh }}>Category</th>
                      <th style={{ ...styles.th, ...styles.koliTh }}>Model</th>
                      <th style={{ ...styles.th, ...styles.koliTh, ...styles.koliCenterCell }}>Initial</th>
                      <th style={{ ...styles.th, ...styles.koliTh, ...styles.koliCenterCell }}>Verified</th>
                      <th style={{ ...styles.th, ...styles.koliTh, ...styles.koliCenterCell }}>Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSourceRows.map((row) => (
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
                            <div style={styles.photoEmpty}>NO</div>
                          )}
                        </td>
                        <td style={styles.td}>{row.category_name}</td>
                        <td style={styles.td}>{getModelDashLabel(row)}</td>
                        <td style={{ ...styles.td, ...styles.koliCenterCell }}>{formatNumber(row.source_qty)}</td>
                        <td style={{ ...styles.td, ...styles.koliCenterCell }}>{formatNumber(row.confirmed_qty)}</td>
                        <td style={{ ...styles.td, ...styles.koliCenterCell }}>{formatNumber(getSourcePendingQty(row))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
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
