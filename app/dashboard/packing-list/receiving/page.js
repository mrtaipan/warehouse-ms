'use client'

import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  buildCatalogIdentityLookup,
  getProductCatalogIdentityKey,
  resolveProductCatalogIdentity,
} from '@/utils/catalog-identity'
import { createClient } from '@/utils/supabase/browser'
import { ADMIN_EMAIL, hasPermission, resolveRole } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

const supabase = createClient()

function sanitizeQuantityInput(value) {
  return String(value || '').replace(/\D/g, '')
}

function preventNumberWheel(event) {
  event.currentTarget.blur()
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  )
}

function SwitchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7h11l-3-3" />
      <path d="m18 7-3 3" />
      <path d="M17 17H6l3 3" />
      <path d="m6 17 3-3" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m6 6 1 14h10l1-14" />
    </svg>
  )
}

function getUniqueOptions(items = []) {
  return Array.from(new Set(items.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

function matchesReceivingModelFilter(row = {}, filters = {}, excludeKey = '') {
  if (excludeKey !== 'brand' && filters.brand && row.brand_name !== filters.brand) return false
  if (excludeKey !== 'category' && filters.category && row.category_name !== filters.category) return false
  if (excludeKey !== 'model' && filters.model && getModelLabel(row) !== filters.model) return false
  return true
}

const styles = {
  overviewPanel: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '22px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  overviewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  eyebrow: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#64748b',
  },
  overviewTitle: {
    margin: '4px 0 0',
    fontSize: '28px',
    lineHeight: 1.05,
    fontWeight: 900,
    color: '#0f172a',
  },
  titleLine: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
    flexWrap: 'wrap',
  },
  grnHeaderChip: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '30px',
    padding: '0 12px',
    borderRadius: '999px',
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    color: '#334155',
    fontSize: '14px',
    fontWeight: 900,
    letterSpacing: '-0.01em',
  },
  overviewSubtitle: {
    margin: '6px 0 0',
    color: '#475569',
    fontSize: '13px',
    lineHeight: 1.45,
    maxWidth: '640px',
  },
  topIconGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  topIconButton: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 900,
  },
  tableToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px',
    borderRadius: '999px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    width: 'max-content',
  },
  tableToggleButton: {
    minHeight: '30px',
    padding: '0 12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: '999px',
    background: 'transparent',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  tableToggleButtonActive: {
    background: '#fff',
    color: '#0f172a',
    borderColor: '#cbd5e1',
    boxShadow: '0 6px 14px rgba(15, 23, 42, 0.08)',
  },
  inputIconButton: {
    background: '#0f766e',
    borderColor: '#99f6e4',
    color: '#fff',
    boxShadow: '0 8px 18px rgba(15, 118, 110, 0.16)',
  },
  closeIconButton: {
    background: '#fff',
    color: '#dc2626',
    borderColor: '#fecaca',
  },
  pageShell: {
    minHeight: '100dvh',
    background: '#f6f7f9',
    display: 'flex',
    justifyContent: 'center',
    padding: 0,
  },
  mobileFrame: {
    width: '100%',
    maxWidth: '520px',
    minHeight: '100dvh',
    background: '#fff',
    borderLeft: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
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
  mobileTitle: {
    margin: '3px 0 0',
    color: '#111827',
    fontSize: '22px',
    fontWeight: 900,
    lineHeight: 1.1,
  },
  mobileGrnChip: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '34px',
    padding: '0 12px',
    borderRadius: '999px',
    background: '#eef6ff',
    color: '#1e3a8a',
    fontSize: '14px',
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  mobileFormCard: {
    padding: '18px 24px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  mobileProgressCard: {
    padding: '18px 24px 4px',
  },
  mobileProgressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '12px',
  },
  mobileProgressEyebrow: {
    margin: 0,
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 850,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  mobileProgressTitle: {
    margin: '5px 0 0',
    color: '#111827',
    fontSize: '24px',
    lineHeight: 1.1,
    fontWeight: 900,
  },
  mobileProgressMeta: {
    color: '#3f3f46',
    fontSize: '13px',
    fontWeight: 850,
    whiteSpace: 'nowrap',
  },
  mobileProgressTrack: {
    marginTop: '14px',
    height: '8px',
    borderRadius: '999px',
    background: '#e5e7eb',
    overflow: 'hidden',
  },
  mobileProgressFill: {
    display: 'block',
    height: '100%',
    borderRadius: '999px',
    background: '#0f766e',
    transition: 'width 180ms ease',
  },
  mobileField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  koliControlRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
    gap: '8px',
    alignItems: 'end',
  },
  koliSelectCell: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  mobileLabel: {
    color: '#3f3f46',
    fontSize: '13px',
    fontWeight: 900,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  mobileInput: {
    width: '100%',
    boxSizing: 'border-box',
    height: '52px',
    border: '1px solid #d4d4d8',
    borderRadius: '10px',
    padding: '0 12px',
    fontSize: '18px',
    fontWeight: 750,
    color: '#18181b',
    WebkitTextFillColor: '#18181b',
    caretColor: '#18181b',
    colorScheme: 'light',
    background: '#fff',
    textAlign: 'center',
  },
  mobileInputDisabled: {
    background: '#f8fafc',
    borderColor: '#e2e8f0',
    color: '#94a3b8',
    WebkitTextFillColor: '#94a3b8',
    cursor: 'not-allowed',
  },
  mobileTableWrap: {
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    overflowX: 'auto',
    background: '#fff',
  },
  mobileTable: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
  },
  mobileTh: {
    padding: '10px 8px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    color: '#475569',
    fontSize: '11px',
    fontWeight: 900,
    textAlign: 'center',
    verticalAlign: 'middle',
    textTransform: 'uppercase',
    whiteSpace: 'normal',
  },
  mobileTd: {
    padding: '10px 8px',
    borderTop: '1px solid #f1f5f9',
    color: '#0f172a',
    fontSize: '14px',
    fontWeight: 850,
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  pictureCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    minWidth: 0,
  },
  pictureButton: {
    width: '64px',
    height: '64px',
    border: 'none',
    borderRadius: '12px',
    background: 'transparent',
    color: '#64748b',
    padding: 0,
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  pictureThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  tablePhotoButton: {
    width: '48px',
    height: '48px',
    border: 'none',
    borderRadius: '10px',
    background: 'transparent',
    padding: 0,
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  tablePhotoThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  tablePhotoPlaceholder: {
    width: '48px',
    height: '48px',
    borderRadius: '10px',
    background: '#f1f5f9',
    color: '#94a3b8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 900,
  },
  picturePlaceholder: {
    width: '64px',
    height: '64px',
    border: '1px dashed #cbd5e1',
    borderRadius: '12px',
    background: '#f8fafc',
    color: '#94a3b8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 900,
  },
  pictureLabel: {
    maxWidth: '110px',
    color: '#475569',
    fontSize: '11px',
    fontWeight: 800,
    lineHeight: 1.25,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  modelActionRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    minWidth: 0,
  },
  modelNameText: {
    maxWidth: '116px',
    color: '#334155',
    fontSize: '11px',
    fontWeight: 850,
    lineHeight: 1.25,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  modelControlRow: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  switchButton: {
    width: '28px',
    height: '28px',
    padding: 0,
    borderRadius: '999px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#0f172a',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  deleteRowButton: {
    width: '28px',
    height: '28px',
    padding: 0,
    borderRadius: '999px',
    border: '1px solid #fecaca',
    background: '#fff',
    color: '#dc2626',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  addModelPanel: {
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '10px',
    display: 'flex',
    justifyContent: 'center',
    background: '#f8fafc',
  },
  addModelButton: {
    width: '42px',
    height: '42px',
    padding: 0,
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    background: '#fff',
    color: '#111827',
    fontSize: '22px',
    lineHeight: 1,
    fontWeight: 900,
    cursor: 'pointer',
  },
  resetButton: {
    minHeight: '42px',
    padding: '0 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    background: '#fff',
    color: '#334155',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  varianceBox: {
    minHeight: '76px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '14px',
    padding: '12px',
    backgroundColor: '#f8fafc',
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'center',
    gap: '12px',
  },
  varianceLabelText: {
    display: 'block',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  varianceFormula: {
    display: 'block',
    marginTop: '4px',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 750,
  },
  varianceValueText: {
    color: '#0f172a',
    fontSize: '24px',
    fontWeight: 950,
    fontVariantNumeric: 'tabular-nums',
  },
  varianceDanger: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  varianceWarning: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  varianceSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  saveButton: {
    width: '100%',
    height: '52px',
    border: 'none',
    borderRadius: '12px',
    background: '#0f766e',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 14px 24px rgba(15, 118, 110, 0.18)',
  },
  saveButtonDisabled: {
    opacity: 0.62,
    cursor: 'not-allowed',
  },
  overviewTableWrap: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '18px',
    overflowX: 'auto',
  },
  modelFilterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  modelFilterSelect: {
    flex: '1 1 180px',
    minWidth: '150px',
    height: '40px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    padding: '0 12px',
    fontSize: '13px',
    fontWeight: 700,
  },
  modelFilterReset: {
    width: '40px',
    height: '40px',
    flex: '0 0 40px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '999px',
    background: '#fff',
    color: '#475569',
    fontSize: '17px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  overviewTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  overviewHeadRow: {
    background: '#f8fafc',
  },
  overviewBodyRow: {
    borderTop: '1px solid #f1f5f9',
  },
  overviewTh: {
    padding: '12px 14px',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: '12px',
    fontWeight: 800,
    color: '#475569',
    whiteSpace: 'nowrap',
  },
  overviewTd: {
    padding: '12px 14px',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: '13px',
    color: '#0f172a',
    whiteSpace: 'nowrap',
  },
  koliLabelWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  samplePill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '18px',
    padding: '2px 7px',
    borderRadius: '999px',
    border: '1px solid #fed7aa',
    background: '#fff7ed',
    color: '#c2410c',
    fontSize: '9px',
    fontWeight: 900,
    lineHeight: 1,
    textTransform: 'uppercase',
  },
  dropdownLabelWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: 0,
    gap: '6px',
  },
  variancePill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '72px',
    minHeight: '32px',
    padding: '0 12px',
    borderRadius: '999px',
    fontSize: '13px',
    fontWeight: 900,
  },
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    width: '100%',
    maxWidth: '560px',
    margin: '0 auto',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  title: {
    margin: 0,
    fontSize: '24px',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#6b7280',
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
    gridTemplateColumns: '1fr',
    gap: '12px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '8px',
  },
  summaryCard: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
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
  input: {
    minHeight: '44px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
    background: '#fff',
  },
  select: {
    minHeight: '44px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
    background: '#fff',
  },
  dropdownWrap: {
    position: 'relative',
  },
  dropdownButton: {
    minHeight: '44px',
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    fontSize: '14px',
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  dropdownButtonText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#111827',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    background: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    boxShadow: '0 16px 32px rgba(15, 23, 42, 0.12)',
    maxHeight: '260px',
    overflowY: 'auto',
    zIndex: 10,
    padding: '6px',
  },
  dropdownItem: {
    width: '100%',
    border: 'none',
    background: '#fff',
    borderRadius: '8px',
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: '14px',
    color: '#111827',
    cursor: 'pointer',
  },
  dropdownItemValidated: {
    color: '#15803d',
    fontWeight: '700',
  },
  dropdownItemActive: {
    background: '#f3f4f6',
  },
  dropdownButtonDisabled: {
    background: '#f8fafc',
    color: '#94a3b8',
    WebkitTextFillColor: '#94a3b8',
    cursor: 'not-allowed',
    opacity: 0.78,
  },
  companionPicker: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  companionButtonText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#111827',
    fontWeight: 750,
  },
  companionOption: {
    width: '100%',
    minHeight: '38px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  companionOptionActive: {
    background: '#ecfdf5',
    borderColor: '#99f6e4',
    color: '#047857',
  },
  companionCheck: {
    width: '17px',
    height: '17px',
    borderRadius: '999px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    color: 'transparent',
    fontSize: '11px',
    fontWeight: 950,
  },
  companionCheckActive: {
    borderColor: '#0f766e',
    background: '#0f766e',
    color: '#fff',
  },
  previewButton: {
    width: '36px',
    height: '36px',
    border: '1px solid #d1d5db',
    borderRadius: '999px',
    background: '#fff',
    color: '#111827',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readonlyBox: {
    minHeight: '44px',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    background: '#f9fafb',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
  },
  modelRow: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '14px',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
    alignItems: 'end',
  },
  qtyStatus: {
    fontSize: '13px',
    fontWeight: '700',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-start',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  primaryButton: {
    minHeight: '44px',
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
    minHeight: '44px',
    padding: '0 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  successText: {
    margin: 0,
    color: '#16a34a',
    fontWeight: '600',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
    fontWeight: '600',
  },
  emptyText: {
    margin: 0,
    color: '#6b7280',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px',
    zIndex: 40,
  },
  modal: {
    position: 'relative',
    display: 'inline-flex',
    maxWidth: 'min(92vw, 860px)',
    maxHeight: '86vh',
  },
  modelPickerModal: {
    width: 'min(92vw, 460px)',
    maxHeight: '82vh',
    overflow: 'hidden',
    borderRadius: '18px',
    border: '1px solid #e2e8f0',
    background: '#fff',
    boxShadow: '0 24px 70px rgba(15, 23, 42, 0.22)',
    display: 'flex',
    flexDirection: 'column',
  },
  modelPickerHeader: {
    padding: '18px 18px 12px',
    borderBottom: '1px solid #e5e7eb',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: '12px',
    alignItems: 'start',
  },
  modelPickerTitle: {
    margin: 0,
    color: '#111827',
    fontSize: '18px',
    lineHeight: 1.2,
    fontWeight: 950,
  },
  modelPickerSubtitle: {
    margin: '4px 0 0',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 750,
    lineHeight: 1.35,
  },
  modelPickerClose: {
    width: '32px',
    height: '32px',
    borderRadius: '999px',
    border: '1px solid #fecaca',
    background: '#fff',
    color: '#dc2626',
    fontSize: '16px',
    fontWeight: 950,
    cursor: 'pointer',
  },
  modelPickerList: {
    padding: '10px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  modelPickerItem: {
    width: '100%',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    background: '#fff',
    padding: '10px',
    display: 'grid',
    gridTemplateColumns: '58px minmax(0, 1fr)',
    gap: '10px',
    alignItems: 'center',
    textAlign: 'left',
    cursor: 'pointer',
  },
  modelPickerThumb: {
    width: '58px',
    height: '58px',
    borderRadius: '12px',
    objectFit: 'cover',
    background: '#f1f5f9',
  },
  modelPickerNoPhoto: {
    width: '58px',
    height: '58px',
    borderRadius: '12px',
    background: '#f1f5f9',
    color: '#94a3b8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 900,
  },
  modelPickerName: {
    display: 'block',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: 900,
    lineHeight: 1.25,
  },
  modelPickerMeta: {
    display: 'block',
    marginTop: '4px',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 800,
  },
  previewImage: {
    display: 'block',
    width: 'auto',
    height: 'auto',
    maxWidth: 'min(92vw, 860px)',
    maxHeight: '86vh',
    objectFit: 'contain',
  },
  photoPreviewClose: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '34px',
    height: '34px',
    borderRadius: '999px',
    border: '1px solid #fecaca',
    background: 'rgba(255, 255, 255, 0.94)',
    color: '#dc2626',
    fontSize: '18px',
    fontWeight: 950,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.18)',
  },
  overviewList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  overviewRow: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '14px',
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '12px',
    alignItems: 'center',
  },
  overviewMeta: {
    margin: '6px 0 0',
    color: '#6b7280',
    fontSize: '13px',
  },
}

function getModelKey(modelName, modelColor) {
  return `${String(modelName || '').trim().toUpperCase()}::${String(modelColor || '').trim().toUpperCase()}`
}

function getModelLabel(item) {
  return item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name
}

function getVariantDisplayName(variant) {
  return variant?.variant_name || variant?.variant_label || variant?.variant_code || ''
}

function getPicLabel(value, userNameMap) {
  const normalized = String(value || '').trim()
  const key = normalized.toLowerCase()

  if (!key) return '-'

  return userNameMap.get(key) || String(normalized.split('@')[0] || normalized).replace(/[._-]+/g, ' ').toUpperCase()
}

function normalizeNameList(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean)))
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return normalizeNameList(parsed)
    } catch {
      return normalizeNameList(trimmed.split(','))
    }
  }

  return []
}

function getReceivingPicLabel(row = {}, userNameMap = new Map()) {
  const mainPic = getPicLabel(row.validated_by, userNameMap)
  const receivedWith = normalizeNameList(row.received_with_names)
  const names = [mainPic, ...receivedWith].filter((name) => name && name !== '-')
  return Array.from(new Set(names)).join(', ') || '-'
}

function buildPackingRows(confirmRows, catalogLookup = null) {
  const grouped = new Map()

  ;(confirmRows || []).forEach((item) => {
    const catalogIdentity = resolveProductCatalogIdentity(item, catalogLookup)
    const key = getProductCatalogIdentityKey(item, catalogIdentity)
    const current = grouped.get(key) || {
      id: `source-${key}`,
      source_key: key,
      model_name: item.model_name || '',
      model_color: item.model_color || '',
      brand_id: item.brand_id || catalogIdentity.model?.brand_id || null,
      category_id: item.category_id || catalogIdentity.model?.category_id || null,
      brand_name: item.brands?.brand_name || '',
      photo_url: item.photo_url || '',
      product_model_id: catalogIdentity.product_model_id,
      product_model_variant_id: catalogIdentity.product_model_variant_id,
      source_variant_code: catalogIdentity.source_variant_code,
      qty: 0,
      qcConfirmIds: [],
    }

    current.qty += Number(item.qty || 0)
    current.photo_url = current.photo_url || item.photo_url || ''
    current.product_model_id = current.product_model_id || catalogIdentity.product_model_id
    current.product_model_variant_id = current.product_model_variant_id || catalogIdentity.product_model_variant_id
    current.source_variant_code = current.source_variant_code || catalogIdentity.source_variant_code
    if (item.id) {
      current.qcConfirmIds.push(item.id)
    }
    grouped.set(key, current)
  })

  return Array.from(grouped.values()).sort((a, b) => getModelLabel(a).localeCompare(getModelLabel(b)))
}

function createDraftRows(sourceRows) {
  return sourceRows.map((row) => ({
    id: `draft-${row.source_key}`,
    source_key: row.source_key,
    source_qc_confirm_id: row.qcConfirmIds?.[0] || null,
    model_name: row.model_name,
    model_color: row.model_color,
    brand_id: row.brand_id || null,
    category_id: row.category_id || null,
    brand_name: row.brand_name || '',
    photo_url: row.photo_url || '',
    product_model_id: row.product_model_id || null,
    product_model_variant_id: row.product_model_variant_id || null,
    source_variant_code: row.source_variant_code || null,
    qty: String(row.qty || 0),
  }))
}

export default function PackingListReceivingPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isInputRoute = pathname === '/dashboard/packing-list/receiving/input'
  const initialGrn = searchParams.get('grn') || ''
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [koliMenuOpen, setKoliMenuOpen] = useState(false)
  const [receivedWithMenuOpen, setReceivedWithMenuOpen] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmRows, setConfirmRows] = useState([])
  const [validationSummaryRows, setValidationSummaryRows] = useState([])
  const [userProfiles, setUserProfiles] = useState([])
  const [productModels, setProductModels] = useState([])
  const [productModelVariants, setProductModelVariants] = useState([])
  const [grnFilter, setGrnFilter] = useState(initialGrn)
  const [selectedSourceKey, setSelectedSourceKey] = useState('')
  const [draftRows, setDraftRows] = useState([])
  const [receivedWithNames, setReceivedWithNames] = useState([])
  const [modelChooser, setModelChooser] = useState(null)
  const [validationRows, setValidationRows] = useState([])
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [detailTableMode, setDetailTableMode] = useState('koli')
  const [detailModelFilters, setDetailModelFilters] = useState({
    brand: '',
    category: '',
    model: '',
  })
  const [showInputForm, setShowInputForm] = useState(isInputRoute || searchParams.get('form') === '1')
  const [detailGrn, setDetailGrn] = useState(initialGrn)
  const [isPackingStaff, setIsPackingStaff] = useState(false)
  const [canManageReceiving, setCanManageReceiving] = useState(false)
  const [accessReady, setAccessReady] = useState(false)

  useEffect(() => {
    if (!initialGrn) {
      router.replace('/dashboard/packing-list')
    }
  }, [initialGrn, router])

  useEffect(() => {
    async function enforceStaffRoute() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setAccessReady(true)
        return
      }

      const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, 'role')
      const emailAdmin = user.email?.toLowerCase() === ADMIN_EMAIL
      const role = resolveRole(profile?.role, emailAdmin)
      const isAdminUser = emailAdmin || role === 'admin'
      const { data: rolePermissionRows } = isAdminUser
        ? { data: [] }
        : await supabase.from('dir_user_roles').select('permission_code').eq('role', role)
      const rolePermissions = (rolePermissionRows || []).map((item) => item.permission_code).filter(Boolean)
      const nextCanManageReceiving =
        hasPermission(rolePermissions, 'packing.receiving.add', isAdminUser) ||
        hasPermission(rolePermissions, 'packing.receiving.edit', isAdminUser)
      const isStaff = role === 'packing_staff'
      setIsPackingStaff(isStaff)
      setCanManageReceiving(nextCanManageReceiving)

      if (!nextCanManageReceiving && isInputRoute && initialGrn) {
        setShowInputForm(false)
        router.replace(`/dashboard/packing-list/receiving?grn=${encodeURIComponent(initialGrn)}`)
        return
      }

      if (isStaff && nextCanManageReceiving && !isInputRoute && initialGrn) {
        router.replace(`/dashboard/packing-list/receiving/input?grn=${encodeURIComponent(initialGrn)}`)
        return
      }

      setAccessReady(true)
    }

    enforceStaffRoute()
  }, [initialGrn, isInputRoute, router])

  useEffect(() => {
    setGrnFilter(initialGrn)
    setDetailGrn(initialGrn)
  }, [initialGrn])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      const [
        { data: confirmData, error: confirmError },
        { data: validationSummaryData, error: validationSummaryError },
        { data: userProfileData, error: userProfileError },
        { data: productModelData, error: productModelError },
        { data: productModelVariantData, error: productModelVariantError },
      ] = await Promise.all([
        supabase
          .from('qc_confirm')
          .select(`
            id,
            inbound_id,
            brand_id,
            category_id,
            product_model_id,
            product_model_variant_id,
            source_variant_code,
            model_name,
            model_color:variant_name,
            photo_url,
            qty,
            koli_sequence,
            is_sample,
            brands:dir_brands!brand_id (
              brand_name
            ),
            categories:dir_categories!category_id (
              category_name,
              full_name
            ),
            inbound:inbound_id (
              id,
              grn_number,
              inbound_date
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('pl_receiving')
          .select('id, inbound_id, source_koli_sequence, source_qc_confirm_id, product_model_id, product_model_variant_id, source_variant_code, model_name, model_color:variant_name, source_qty, received_qty, qty_diff, validated_by, received_with_names, validated_at')
          .order('validated_at', { ascending: false }),
        supabase
          .from('dir_user_profiles')
          .select('email, display_name, role'),
        supabase
          .from('dir_product_models')
          .select(`
            *,
            brands:dir_brands!brand_id (
              brand_name
            ),
            categories:dir_categories!category_id (
              category_name,
              full_name
            )
          `)
          .order('model_name', { ascending: true }),
        supabase
          .from('dir_product_model_variants')
          .select('*')
          .order('id', { ascending: true }),
      ])

      if (confirmError || validationSummaryError || productModelError || productModelVariantError) {
        setError(
          confirmError?.message ||
            validationSummaryError?.message ||
            productModelError?.message ||
            productModelVariantError?.message ||
            'Failed to load packing list receiving.'
        )
        setLoading(false)
        return
      }

      setConfirmRows(confirmData || [])
      setValidationSummaryRows(validationSummaryData || [])
      setUserProfiles(userProfileError ? [] : userProfileData || [])
      setProductModels(productModelData || [])
      setProductModelVariants(productModelVariantData || [])
      setLoading(false)
    }

    loadData()
  }, [])

  const userNameMap = useMemo(() => {
    const nextMap = new Map()

    userProfiles.forEach((profile) => {
      const email = String(profile.email || '').trim().toLowerCase()
      if (email) {
        nextMap.set(email, profile.display_name || getPicLabel(email, new Map()))
      }
    })

    return nextMap
  }, [userProfiles])

  const packingStaffOptions = useMemo(() => {
    const names = userProfiles
      .filter((profile) => String(profile.role || '').trim() === 'packing_staff')
      .map((profile) => {
        const displayName = String(profile.display_name || '').trim()
        return displayName || getPicLabel(profile.email, new Map())
      })

    return getUniqueOptions(names.map((name) => String(name || '').trim().toUpperCase()).filter(Boolean))
  }, [userProfiles])

  const catalogLookup = useMemo(() => {
    return buildCatalogIdentityLookup(productModels, productModelVariants)
  }, [productModelVariants, productModels])

  const overviewRows = useMemo(() => {
    const validatedMap = new Map()

    validationSummaryRows.forEach((row) => {
      validatedMap.set(`${row.inbound_id}::${Number(row.source_koli_sequence || 0)}`, true)
    })

    const grouped = new Map()

    confirmRows.forEach((item) => {
      const inboundId = item.inbound?.id || item.inbound_id || 0
      const current = grouped.get(inboundId) || {
        inbound_id: inboundId,
        grn_number: item.inbound?.grn_number || '-',
        inbound_date: item.inbound?.inbound_date || null,
        total_qty: 0,
        koliSet: new Set(),
        validatedSet: new Set(),
      }
      const koliSequence = Number(item.koli_sequence || 0)

      current.total_qty += Number(item.qty || 0)
      current.koliSet.add(koliSequence)
      if (validatedMap.has(`${inboundId}::${koliSequence}`)) {
        current.validatedSet.add(koliSequence)
      }
      grouped.set(inboundId, current)
    })

    return Array.from(grouped.values())
      .map((row) => ({
        inbound_id: row.inbound_id,
        grn_number: row.grn_number,
        inbound_date: row.inbound_date,
        total_qty: row.total_qty,
        total_koli: row.koliSet.size,
        validated_koli: row.validatedSet.size,
        pending_koli: Math.max(0, row.koliSet.size - row.validatedSet.size),
      }))
      .sort((a, b) => new Date(b.inbound_date || 0).getTime() - new Date(a.inbound_date || 0).getTime())
  }, [confirmRows, validationSummaryRows])

  const selectedDetail = overviewRows.find((row) => row.grn_number === detailGrn) || null
  const detailKoliRows = useMemo(() => {
    if (!detailGrn) return []

    const validationMap = new Map()
    validationSummaryRows.forEach((row) => {
      const key = `${row.inbound_id}::${Number(row.source_koli_sequence || 0)}`
      const current = validationMap.get(key) || {
        source_qty: 0,
        received_qty: 0,
        qty_diff: 0,
        validated_by: row.validated_by || '',
        received_with_names: [],
        validated_at: row.validated_at || null,
      }

      current.source_qty += Number(row.source_qty || 0)
      current.received_qty += Number(row.received_qty || 0)
      current.qty_diff += Number(row.qty_diff || 0)
      current.received_with_names = Array.from(new Set([
        ...(current.received_with_names || []),
        ...normalizeNameList(row.received_with_names),
      ]))
      if (!current.validated_at || new Date(row.validated_at || 0) > new Date(current.validated_at || 0)) {
        current.validated_at = row.validated_at
        current.validated_by = row.validated_by || current.validated_by
      }
      validationMap.set(key, current)
    })

    const grouped = new Map()
    confirmRows
      .filter((item) => item.inbound?.grn_number === detailGrn)
      .forEach((item) => {
        const inboundId = item.inbound?.id || item.inbound_id || 0
        const koliSequence = Number(item.koli_sequence || 0)
        const key = `${inboundId}::${koliSequence}`
        const validationInfo = validationMap.get(key) || null
        const current = grouped.get(key) || {
          key,
          inbound_id: inboundId,
          koli_sequence: koliSequence,
          qc_confirm_qty: 0,
          received_qty: 0,
          qty_diff: 0,
          validated_by: '',
          received_with_names: [],
          validated_at: null,
          is_validated: false,
          is_sample: false,
        }

        current.qc_confirm_qty += Number(item.qty || 0)
        current.is_sample = current.is_sample || Boolean(item.is_sample)
        current.received_qty = validationInfo ? Number(validationInfo.received_qty || 0) : current.received_qty
        current.qty_diff = validationInfo ? Number(validationInfo.qty_diff || 0) : current.qty_diff
        current.validated_by = validationInfo?.validated_by || current.validated_by
        current.received_with_names = validationInfo?.received_with_names || current.received_with_names
        current.validated_at = validationInfo?.validated_at || null
        current.is_validated = Boolean(validationInfo)
        grouped.set(key, current)
      })

    return Array.from(grouped.values()).sort((a, b) => a.koli_sequence - b.koli_sequence)
  }, [confirmRows, detailGrn, validationSummaryRows])
  const detailTotals = useMemo(
    () =>
      detailKoliRows.reduce(
        (summary, row) => ({
          qcConfirmQty: summary.qcConfirmQty + Number(row.qc_confirm_qty || 0),
          receivedQty: summary.receivedQty + Number(row.received_qty || 0),
          validatedKoli: summary.validatedKoli + (row.is_validated ? 1 : 0),
          pendingKoli: summary.pendingKoli + (row.is_validated ? 0 : 1),
        }),
        { qcConfirmQty: 0, receivedQty: 0, validatedKoli: 0, pendingKoli: 0 }
      ),
    [detailKoliRows]
  )
  const detailVariance = detailTotals.receivedQty - detailTotals.qcConfirmQty
  const detailModelRows = useMemo(() => {
    if (!detailGrn) return []

    const inboundIds = new Set()
    const grouped = new Map()
    const confirmById = new Map(confirmRows.map((row) => [Number(row.id || 0), row]))
    const validationIdentityByConfirmId = new Map()

    validationSummaryRows.forEach((row) => {
      const sourceConfirm = confirmById.get(Number(row.source_qc_confirm_id || 0)) || null
      if (sourceConfirm?.inbound?.grn_number !== detailGrn) return

      const identity = resolveProductCatalogIdentity(row, catalogLookup)
      if (identity.product_model_id) {
        validationIdentityByConfirmId.set(Number(row.source_qc_confirm_id), identity)
      }
    })

    confirmRows
      .filter((item) => item.inbound?.grn_number === detailGrn)
      .forEach((item) => {
        const inboundId = item.inbound?.id || item.inbound_id || 0
        const sourceIdentity = resolveProductCatalogIdentity(item, catalogLookup)
        const identity = validationIdentityByConfirmId.get(Number(item.id || 0)) || sourceIdentity
        const key = getProductCatalogIdentityKey(item, identity)
        const sourceKey = getProductCatalogIdentityKey(item, sourceIdentity)
        const catalogModel = identity.model || catalogLookup.modelById.get(Number(identity.product_model_id || 0)) || null
        const catalogVariant = identity.variant || catalogLookup.variantById.get(Number(identity.product_model_variant_id || 0)) || null
        const brandName = catalogModel?.brands?.brand_name || item.brands?.brand_name || 'UNBRANDED'
        const categoryName =
          catalogModel?.categories?.full_name ||
          catalogModel?.categories?.category_name ||
          item.categories?.full_name ||
          item.categories?.category_name ||
          'UNCATEGORIZED'
        const photoUrl = key === sourceKey
          ? item.photo_url || catalogVariant?.variant_photo_url || ''
          : catalogVariant?.variant_photo_url || item.photo_url || ''
        const modelName = key === sourceKey ? item.model_name || '' : catalogModel?.model_name || item.model_name || ''
        const modelColor = key === sourceKey
          ? item.model_color || ''
          : getVariantDisplayName(catalogVariant) || item.model_color || ''
        const current = grouped.get(key) || {
          key,
          brand_name: brandName,
          category_name: categoryName,
          model_name: modelName,
          model_color: modelColor,
          photo_url: photoUrl,
          qc_confirm_qty: 0,
          received_qty: 0,
          koliSet: new Set(),
          validatedKoliSet: new Set(),
        }

        inboundIds.add(Number(inboundId))
        current.qc_confirm_qty += Number(item.qty || 0)
        current.brand_name = current.brand_name || brandName
        current.category_name = current.category_name || categoryName
        current.photo_url = current.photo_url || photoUrl
        if (item.koli_sequence) {
          current.koliSet.add(Number(item.koli_sequence || 0))
        }
        grouped.set(key, current)
      })

    validationSummaryRows
      .filter((row) => inboundIds.has(Number(row.inbound_id || 0)))
      .forEach((row) => {
        const sourceConfirm = confirmById.get(Number(row.source_qc_confirm_id || 0)) || null
        const sourceIdentity = sourceConfirm
          ? resolveProductCatalogIdentity(sourceConfirm, catalogLookup)
          : null
        const matchesSourceLabel = sourceConfirm
          ? getModelKey(row.model_name, row.model_color) === getModelKey(sourceConfirm.model_name, sourceConfirm.model_color)
          : false
        const rowIdentity = resolveProductCatalogIdentity(row, catalogLookup)
        const identity = !rowIdentity.product_model_id && matchesSourceLabel && sourceIdentity
          ? sourceIdentity
          : rowIdentity
        const key = getProductCatalogIdentityKey(row, identity)
        const sourceKey = sourceConfirm && sourceIdentity
          ? getProductCatalogIdentityKey(sourceConfirm, sourceIdentity)
          : ''
        const sourceMatchesIdentity = sourceKey === key
        const catalogModel = identity.model || catalogLookup.modelById.get(Number(identity.product_model_id || 0)) || null
        const catalogVariant = identity.variant || catalogLookup.variantById.get(Number(identity.product_model_variant_id || 0)) || null
        const brandName =
          catalogModel?.brands?.brand_name ||
          (sourceMatchesIdentity ? sourceConfirm?.brands?.brand_name : '') ||
          'UNBRANDED'
        const categoryName =
          catalogModel?.categories?.full_name ||
          catalogModel?.categories?.category_name ||
          (sourceMatchesIdentity ? sourceConfirm?.categories?.full_name || sourceConfirm?.categories?.category_name : '') ||
          'UNCATEGORIZED'
        const current = grouped.get(key) || {
          key,
          brand_name: brandName,
          category_name: categoryName,
          model_name: row.model_name || '',
          model_color: row.model_color || '',
          photo_url: sourceMatchesIdentity
            ? sourceConfirm?.photo_url || catalogVariant?.variant_photo_url || ''
            : catalogVariant?.variant_photo_url || '',
          qc_confirm_qty: 0,
          received_qty: 0,
          koliSet: new Set(),
          validatedKoliSet: new Set(),
        }

        current.received_qty += Number(row.received_qty || 0)
        current.brand_name = current.brand_name || brandName
        current.category_name = current.category_name || categoryName
        if (row.source_koli_sequence) {
          current.validatedKoliSet.add(Number(row.source_koli_sequence || 0))
        }
        grouped.set(key, current)
      })

    return Array.from(grouped.values())
      .map((row) => {
        const variance = Number(row.received_qty || 0) - Number(row.qc_confirm_qty || 0)
        const validatedKoli = row.validatedKoliSet.size
        const totalKoli = row.koliSet.size

        return {
          ...row,
          variance,
          total_koli: totalKoli,
          validated_koli: validatedKoli,
          status: totalKoli > 0 && validatedKoli >= totalKoli ? 'Validated' : 'Pending',
        }
      })
      .sort((a, b) => getModelLabel(a).localeCompare(getModelLabel(b)))
  }, [catalogLookup, confirmRows, detailGrn, validationSummaryRows])

  const detailModelFilterOptions = useMemo(
    () => ({
      brands: getUniqueOptions(
        detailModelRows
          .filter((row) => matchesReceivingModelFilter(row, detailModelFilters, 'brand'))
          .map((row) => row.brand_name)
      ),
      categories: getUniqueOptions(
        detailModelRows
          .filter((row) => matchesReceivingModelFilter(row, detailModelFilters, 'category'))
          .map((row) => row.category_name)
      ),
      models: getUniqueOptions(
        detailModelRows
          .filter((row) => matchesReceivingModelFilter(row, detailModelFilters, 'model'))
          .map((row) => getModelLabel(row))
      ),
    }),
    [detailModelFilters, detailModelRows]
  )

  const filteredDetailModelRows = useMemo(
    () => detailModelRows.filter((row) => matchesReceivingModelFilter(row, detailModelFilters)),
    [detailModelFilters, detailModelRows]
  )

  const selectedInbound = useMemo(
    () => confirmRows.find((item) => item.inbound?.grn_number === grnFilter)?.inbound || null,
    [confirmRows, grnFilter]
  )

  const sourceOptions = useMemo(() => {
    const validatedMap = new Map()

    validationSummaryRows.forEach((row) => {
      const key = `${row.inbound_id}::${Number(row.source_koli_sequence || 0)}`
      const current = validatedMap.get(key)

      if (!current || new Date(row.validated_at || 0) > new Date(current.validated_at || 0)) {
        validatedMap.set(key, row)
      }
    })

    const grouped = new Map()

    confirmRows
      .filter((item) => item.inbound?.grn_number === grnFilter)
      .forEach((item) => {
        const inboundId = item.inbound?.id || item.inbound_id || 0
        const koliSequence = Number(item.koli_sequence || 0)
        const key = `koli:${Number(item.koli_sequence || 0)}`
        const validationKey = `${inboundId}::${koliSequence}`
        const validationInfo = validatedMap.get(validationKey) || null
        const current = grouped.get(key) || {
          key,
          label: `Koli ${item.koli_sequence || '-'}`,
          koli_sequence: koliSequence,
          isSample: Boolean(item.is_sample),
          isValidated: Boolean(validationInfo),
          validatedAt: validationInfo?.validated_at || null,
          rows: [],
        }

        current.isValidated = Boolean(validationInfo)
        current.isSample = current.isSample || Boolean(item.is_sample)
        current.validatedAt = validationInfo?.validated_at || null
        current.rows.push(item)
        grouped.set(key, current)
      })

    return Array.from(grouped.values()).sort((a, b) => a.koli_sequence - b.koli_sequence)
  }, [confirmRows, grnFilter, validationSummaryRows])

  const selectedSource = sourceOptions.find((item) => item.key === selectedSourceKey) || null
  const sourceRows = useMemo(() => buildPackingRows(selectedSource?.rows || [], catalogLookup), [catalogLookup, selectedSource])
  const modelOptions = useMemo(() => {
    const grnNumber = grnFilter || detailGrn || selectedInbound?.grn_number || ''
    const rowsForGrn = confirmRows.filter((row) => row.inbound?.grn_number === grnNumber)

    return buildPackingRows(rowsForGrn, catalogLookup)
      .map((row) => ({
        key: row.source_key || getProductCatalogIdentityKey(row),
        source_key: row.source_key || '',
        model_name: row.model_name || '',
        model_color: row.model_color || '',
        brand_id: row.brand_id || null,
        category_id: row.category_id || null,
        brand_name: row.brand_name || '',
        photo_url: row.photo_url || '',
        product_model_id: row.product_model_id || null,
        product_model_variant_id: row.product_model_variant_id || null,
        source_variant_code: row.source_variant_code || null,
        label: getModelLabel(row),
        qty: Number(row.qty || 0),
      }))
      .filter((row) => row.key && row.key !== '::')
  }, [catalogLookup, confirmRows, detailGrn, grnFilter, selectedInbound?.grn_number])
  const grnModelMap = useMemo(() => {
    const mapped = new Map()
    modelOptions.forEach((item) => {
      mapped.set(item.key, item)
    })
    return mapped
  }, [modelOptions])
  const sourceRowMap = useMemo(() => {
    const grouped = new Map()

    sourceRows.forEach((item) => {
      const key = item.source_key || getProductCatalogIdentityKey(item)
      grouped.set(key, item)
    })

    return grouped
  }, [sourceRows])

  useEffect(() => {
    async function loadValidationRows() {
      if (!selectedInbound?.id || !selectedSource?.koli_sequence) {
        setValidationRows([])
        setDraftRows([])
        setReceivedWithNames([])
        setReceivedWithMenuOpen(false)
        return
      }

      const { data, error: loadError } = await supabase
        .from('pl_receiving')
        .select(`
          id,
          source_qc_confirm_id,
          product_model_id,
          product_model_variant_id,
          source_variant_code,
          model_name,
          model_color:variant_name,
          source_qty,
          received_qty,
          qty_diff,
          received_with_names,
          validated_at
        `)
        .eq('inbound_id', selectedInbound.id)
        .eq('source_koli_sequence', selectedSource.koli_sequence)
        .order('validated_at', { ascending: false })
        .order('id', { ascending: false })

      if (loadError) {
        setValidationRows([])
        setDraftRows(createDraftRows(sourceRows))
        setReceivedWithNames([])
        setReceivedWithMenuOpen(false)
        setError(loadError.message || 'Failed to load saved packing list validation.')
        return
      }

      const nextRows = data || []
      setValidationRows(nextRows)
      setReceivedWithNames(normalizeNameList(nextRows[0]?.received_with_names))
      setReceivedWithMenuOpen(false)

      if (!nextRows.length) {
        setDraftRows(createDraftRows(sourceRows))
        return
      }

      setDraftRows(
        nextRows.map((row, index) => {
          const sourceByConfirmId = sourceRows.find((sourceRow) =>
            (sourceRow.qcConfirmIds || []).includes(row.source_qc_confirm_id)
          ) || null
          const rowIdentity = resolveProductCatalogIdentity(row, catalogLookup)
          const rowIdentityKey = getProductCatalogIdentityKey(row, rowIdentity)
          const matchedSource = sourceByConfirmId || sourceRowMap.get(rowIdentityKey) || null
          const matchedModel = grnModelMap.get(rowIdentityKey) || null
          const matchesSourceLabel = matchedSource
            ? getModelKey(row.model_name, row.model_color) === getModelKey(matchedSource.model_name, matchedSource.model_color)
            : false
          const effectiveIdentity = !rowIdentity.product_model_id && matchesSourceLabel && matchedSource
            ? {
                product_model_id: matchedSource.product_model_id,
                product_model_variant_id: matchedSource.product_model_variant_id,
                source_variant_code: matchedSource.source_variant_code,
              }
            : rowIdentity

          return {
            id: `saved-${row.id || index}`,
            source_key: matchedSource?.source_key || '',
            source_qc_confirm_id: row.source_qc_confirm_id || matchedSource?.qcConfirmIds?.[0] || null,
            model_name: row.model_name || '',
            model_color: row.model_color || '',
            brand_id: matchedModel?.brand_id || matchedSource?.brand_id || null,
            category_id: matchedModel?.category_id || matchedSource?.category_id || null,
            brand_name: matchedModel?.brand_name || matchedSource?.brand_name || '',
            product_model_id: effectiveIdentity.product_model_id || matchedModel?.product_model_id || null,
            product_model_variant_id: effectiveIdentity.product_model_variant_id || matchedModel?.product_model_variant_id || null,
            source_variant_code: effectiveIdentity.source_variant_code || matchedModel?.source_variant_code || null,
            photo_url: matchedModel?.photo_url || (matchesSourceLabel ? matchedSource?.photo_url : '') || '',
            qty: String(row.received_qty || 0),
          }
        })
      )
    }

    loadValidationRows()
  }, [catalogLookup, grnModelMap, selectedInbound?.id, selectedSource?.koli_sequence, sourceRowMap, sourceRows])

  function openInputForm(nextGrn = detailGrn) {
    if (!canManageReceiving) return
    const targetGrn = nextGrn || detailGrn
    router.push(`/dashboard/packing-list/receiving/input?grn=${encodeURIComponent(targetGrn)}`)
  }

  function backToOverview() {
    router.push('/dashboard/packing-list')
  }

  function backToDetail() {
    if (isPackingStaff) {
      backToOverview()
      return
    }

    setShowInputForm(false)
    setGrnFilter('')
    setSelectedSourceKey('')
    setModelChooser(null)
    setKoliMenuOpen(false)
    setDraftRows([])
    setReceivedWithNames([])
    setReceivedWithMenuOpen(false)
    setValidationRows([])
    setError('')
    setSuccess('')
    router.push(`/dashboard/packing-list/receiving?grn=${encodeURIComponent(detailGrn || initialGrn)}`)
  }

  function handleSourceChange(nextSourceKey) {
    setSelectedSourceKey(nextSourceKey)
    setKoliMenuOpen(false)
    setReceivedWithMenuOpen(false)
    setModelChooser(null)
    setError('')
    setSuccess('')
    setReceivedWithNames([])

    const nextSource = sourceOptions.find((item) => item.key === nextSourceKey) || null
    setDraftRows(nextSource ? createDraftRows(buildPackingRows(nextSource.rows || [], catalogLookup)) : [])
  }

  function updateDraftRow(rowId, updates) {
    setDraftRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row)))
  }

  function openModelChooser(mode, rowId = '') {
    if (!canManageReceiving || isValidated) return
    setModelChooser({ mode, rowId })
  }

  function closeModelChooser() {
    setModelChooser(null)
  }

  function applyDraftModel(rowId, selectedModel) {
    if (!selectedModel) return

    const isAlreadyUsed = draftRows.some(
      (row) => row.id !== rowId && getProductCatalogIdentityKey(row) === selectedModel.key
    )
    if (isAlreadyUsed) {
      setSuccess('')
      setError('Model is already listed in this receiving input.')
      return
    }

    setDraftRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              model_name: selectedModel.model_name,
              model_color: selectedModel.model_color || '',
              brand_id: selectedModel.brand_id || null,
              category_id: selectedModel.category_id || null,
              brand_name: selectedModel.brand_name || '',
              photo_url: selectedModel.photo_url || row.photo_url || '',
              product_model_id: selectedModel.product_model_id || null,
              product_model_variant_id: selectedModel.product_model_variant_id || null,
              source_variant_code: selectedModel.source_variant_code || null,
            }
          : row
      )
    )
    closeModelChooser()
    setError('')
  }

  function addDraftModelRow(selectedModel) {
    if (!selectedModel) {
      setSuccess('')
      setError('Choose model first before adding a row.')
      return
    }

    const isAlreadyAdded = draftRows.some((row) => getProductCatalogIdentityKey(row) === selectedModel.key)
    if (isAlreadyAdded) {
      setSuccess('')
      setError('Model is already listed in this receiving input.')
      return
    }

    setDraftRows((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}-${prev.length}`,
        source_key: '',
        source_qc_confirm_id: null,
        model_name: selectedModel.model_name,
        model_color: selectedModel.model_color || '',
        brand_id: selectedModel.brand_id || null,
        category_id: selectedModel.category_id || null,
        brand_name: selectedModel.brand_name || '',
        photo_url: selectedModel.photo_url || '',
        product_model_id: selectedModel.product_model_id || null,
        product_model_variant_id: selectedModel.product_model_variant_id || null,
        source_variant_code: selectedModel.source_variant_code || null,
        qty: '',
      },
    ])
    closeModelChooser()
    setError('')
  }

  function handleChooseModel(selectedModel) {
    if (!modelChooser) return

    if (modelChooser.mode === 'switch') {
      applyDraftModel(modelChooser.rowId, selectedModel)
      return
    }

    addDraftModelRow(selectedModel)
  }

  function removeDraftRow(rowId) {
    if (!canManageReceiving || isValidated || draftRows.length <= 1) return
    setDraftRows((prev) => prev.filter((row) => row.id !== rowId))
    setError('')
  }

  function resetDraftRows() {
    if (!canManageReceiving || isValidated || !selectedSource) return
    setDraftRows(createDraftRows(sourceRows))
    setReceivedWithNames([])
    setReceivedWithMenuOpen(false)
    setModelChooser(null)
    setError('')
    setSuccess('')
  }

  function toggleReceivedWithName(name) {
    if (!canManageReceiving || isValidated) return
    const normalizedName = String(name || '').trim().toUpperCase()
    if (!normalizedName) return

    setReceivedWithNames((prev) =>
      prev.includes(normalizedName)
        ? prev.filter((item) => item !== normalizedName)
        : [...prev, normalizedName]
    )
  }

  const comparisonRows = useMemo(() => {
    const sourceMap = new Map(
      sourceRows.map((row) => [row.source_key || getProductCatalogIdentityKey(row), row])
    )
    const sourceBySourceKey = new Map(sourceRows.map((row) => [row.source_key, row]))
    const draftMap = new Map()
    const consumedSourceKeys = new Set()

    draftRows.forEach((row) => {
      const key = getProductCatalogIdentityKey(row)

      const sourceForDraft = row.source_key ? sourceBySourceKey.get(row.source_key) : sourceMap.get(key)
      const current = draftMap.get(key) || {
        key,
        model_name: row.model_name,
        model_color: row.model_color,
        brand_id: row.brand_id || null,
        category_id: row.category_id || null,
        product_model_id: row.product_model_id || null,
        product_model_variant_id: row.product_model_variant_id || null,
        source_variant_code: row.source_variant_code || null,
        sourceQty: 0,
        qty: 0,
        sourceQcConfirmIds: [],
      }

      current.qty += Number(row.qty || 0)
      current.brand_id = current.brand_id || row.brand_id || null
      current.category_id = current.category_id || row.category_id || null
      current.product_model_id = current.product_model_id || row.product_model_id || null
      current.product_model_variant_id = current.product_model_variant_id || row.product_model_variant_id || null
      current.source_variant_code = current.source_variant_code || row.source_variant_code || null
      if (sourceForDraft?.source_key && !consumedSourceKeys.has(sourceForDraft.source_key)) {
        current.sourceQty += Number(sourceForDraft.qty || 0)
        ;(sourceForDraft.qcConfirmIds || []).forEach((id) => current.sourceQcConfirmIds.push(id))
        consumedSourceKeys.add(sourceForDraft.source_key)
      }
      if (row.source_qc_confirm_id) {
        current.sourceQcConfirmIds.push(row.source_qc_confirm_id)
      }
      draftMap.set(key, current)
    })

    const draftComparisonRows = Array.from(draftMap.values()).map((row) => {
      const sourceQty = Number(row.sourceQty || 0)
      const receivedQty = Number(row.qty || 0)

      return {
        key: row.key,
        model_name: row.model_name || '',
        model_color: row.model_color || '',
        brand_id: row.brand_id || null,
        category_id: row.category_id || null,
        product_model_id: row.product_model_id || null,
        product_model_variant_id: row.product_model_variant_id || null,
        source_variant_code: row.source_variant_code || null,
        sourceQty,
        receivedQty,
        qtyDiff: receivedQty - sourceQty,
        source_qc_confirm_id: row.sourceQcConfirmIds?.[0] || null,
      }
    })

    const untouchedSourceRows = sourceRows
      .filter((row) => !consumedSourceKeys.has(row.source_key))
      .map((row) => ({
        key: row.source_key || getProductCatalogIdentityKey(row),
        model_name: row.model_name || '',
        model_color: row.model_color || '',
        brand_id: row.brand_id || null,
        category_id: row.category_id || null,
        product_model_id: row.product_model_id || null,
        product_model_variant_id: row.product_model_variant_id || null,
        source_variant_code: row.source_variant_code || null,
        sourceQty: Number(row.qty || 0),
        receivedQty: 0,
        qtyDiff: -Number(row.qty || 0),
        source_qc_confirm_id: row.qcConfirmIds?.[0] || null,
      }))

    return [...draftComparisonRows, ...untouchedSourceRows]
      .sort((a, b) => getModelLabel(a).localeCompare(getModelLabel(b)))
  }, [draftRows, sourceRows])

  const sourceTotalQty = sourceRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const receivedTotalQty = draftRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const totalVariance = receivedTotalQty - sourceTotalQty
  const progressTotalKoli = sourceOptions.length
  const progressValidatedKoli = sourceOptions.filter((item) => item.isValidated).length
  const progressPercent = progressTotalKoli ? Math.round((progressValidatedKoli / progressTotalKoli) * 100) : 0
  const inputRows = useMemo(
    () =>
      draftRows.map((row) => {
        const key = getProductCatalogIdentityKey(row)
        const sourceRow = sourceRows.find((item) => item.source_key === row.source_key) || sourceRowMap.get(key) || null

        return {
          ...row,
          label: getModelLabel(row),
          photo_url: row.photo_url || sourceRow?.photo_url || '',
          source_qty: Number(sourceRow?.qty || 0),
        }
      }),
    [draftRows, sourceRowMap, sourceRows]
  )
  const isValidated = Boolean(selectedSource?.isValidated)

  async function handleValidate() {
    if (!canManageReceiving) return
    setError('')

    const invalidRow = draftRows.find((row) => !String(row.model_name || '').trim() || !String(row.qty ?? '').trim())
    if (invalidRow) {
      setSuccess('')
      setError('Every PL Receiving row must have a model and qty. Use 0 if nothing was received.')
      return
    }

    if (!selectedInbound || !selectedSource) {
      setSuccess('')
      setError('Choose GRN and Koli first.')
      return
    }

    const isConfirmed = window.confirm(
      [
        'Validate this Packing List Receiving?',
        '',
        `GRN: ${selectedInbound.grn_number || '-'}`,
        `Koli: ${selectedSource.label || '-'}`,
        `QC Confirm Qty: ${sourceTotalQty}`,
        `PL Received Qty: ${receivedTotalQty}`,
        `Variance: ${totalVariance > 0 ? '+' : ''}${totalVariance}`,
        `Together With: ${receivedWithNames.length ? receivedWithNames.join(', ') : '-'}`,
        '',
        'Please make sure the entered qty is correct before continuing.',
      ].join('\n')
    )

    if (!isConfirmed) {
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const payload = comparisonRows
      .filter((row) => row.sourceQty > 0 || row.receivedQty > 0)
      .map((row) => {
        const identity = resolveProductCatalogIdentity(row, catalogLookup)
        return {
          inbound_id: selectedInbound.id,
          source_koli_sequence: selectedSource.koli_sequence,
          source_qc_confirm_id: row.source_qc_confirm_id || null,
          product_model_id: identity.product_model_id || null,
          product_model_variant_id: identity.product_model_variant_id || null,
          source_variant_code: identity.source_variant_code || null,
          model_name: row.model_name,
          variant_name: row.model_color || null,
          source_qty: row.sourceQty,
          received_qty: row.receivedQty,
          qty_diff: row.qtyDiff,
          validated_by: user?.email || null,
          received_with_names: receivedWithNames,
        }
      })

    setSaving(true)
    setSuccess('')

    const { error: deleteError } = await supabase
      .from('pl_receiving')
      .delete()
      .eq('inbound_id', selectedInbound.id)
      .eq('source_koli_sequence', selectedSource.koli_sequence)

    if (deleteError) {
      setSaving(false)
      setError(deleteError.message || 'Failed to clear previous packing list validation.')
      return
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from('pl_receiving')
      .insert(payload)
      .select(`
        id,
        inbound_id,
        source_koli_sequence,
        source_qc_confirm_id,
        product_model_id,
        product_model_variant_id,
        source_variant_code,
        model_name,
        model_color:variant_name,
        source_qty,
        received_qty,
        qty_diff,
        validated_by,
        received_with_names,
        validated_at
      `)
      .order('validated_at', { ascending: false })
      .order('id', { ascending: false })

    setSaving(false)

    if (insertError) {
      setError(insertError.message || 'Failed to save packing list validation.')
      return
    }

    setValidationRows(insertedRows || [])
    setValidationSummaryRows((prev) => {
      const nextKey = `${selectedInbound.id}::${selectedSource.koli_sequence}`
      const remaining = prev.filter(
        (row) => `${row.inbound_id}::${Number(row.source_koli_sequence || 0)}` !== nextKey
      )

      return [
        ...((insertedRows || []).map((row) => ({
           id: row.id,
           inbound_id: row.inbound_id,
           source_koli_sequence: row.source_koli_sequence,
           source_qc_confirm_id: row.source_qc_confirm_id,
           product_model_id: row.product_model_id,
          product_model_variant_id: row.product_model_variant_id,
          source_variant_code: row.source_variant_code,
          model_name: row.model_name,
          model_color: row.model_color,
          source_qty: row.source_qty,
          received_qty: row.received_qty,
          qty_diff: row.qty_diff,
          validated_by: row.validated_by,
          received_with_names: row.received_with_names,
          validated_at: row.validated_at,
        }))),
        ...remaining,
      ]
    })

    const mismatchCount = payload.filter((row) => Number(row.qty_diff || 0) !== 0).length
    if (!mismatchCount) {
      setSuccess(`Receiving validated for ${selectedInbound.grn_number} ${selectedSource.label}.`)
      return
    }

    setSuccess(`Receiving validated. ${mismatchCount} row still differs from QC Confirm.`)
  }

  if (loading || !accessReady) {
    return <p style={styles.emptyText}>Loading packing list receiving...</p>
  }

  if (!initialGrn) {
    return <p style={styles.emptyText}>Redirecting to Packing List overview...</p>
  }

  if (!showInputForm && selectedDetail) {
    return (
      <>
        <section style={styles.overviewPanel}>
          <div style={styles.overviewHeader}>
            <div>
              <p style={styles.eyebrow}>Packing List</p>
              <div style={styles.titleLine}>
                <h1 style={styles.overviewTitle}>Receiving</h1>
                <span style={styles.grnHeaderChip}>{selectedDetail.grn_number}</span>
              </div>
              <p style={styles.overviewSubtitle}>Validate QC Confirm data for this GRN before size breakdown.</p>
            </div>

            <div style={styles.topIconGroup}>
              <div style={styles.tableToggle} role="tablist" aria-label="Packing List Receiving table view">
                <button
                  type="button"
                  onClick={() => setDetailTableMode('koli')}
                  style={{
                    ...styles.tableToggleButton,
                    ...(detailTableMode === 'koli' ? styles.tableToggleButtonActive : {}),
                  }}
                >
                  Koli
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTableMode('model')}
                  style={{
                    ...styles.tableToggleButton,
                    ...(detailTableMode === 'model' ? styles.tableToggleButtonActive : {}),
                  }}
                >
                  Model
                </button>
              </div>
              {canManageReceiving ? (
                <button
                  type="button"
                  onClick={() => openInputForm(selectedDetail.grn_number)}
                  style={{ ...styles.topIconButton, ...styles.inputIconButton }}
                  title="Open receiving input"
                  aria-label="Open receiving input"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9 5H7.6C6.16 5 5 6.16 5 7.6V18.4C5 19.84 6.16 21 7.6 21H16.4C17.84 21 19 19.84 19 18.4V7.6C19 6.16 17.84 5 16.4 5H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M9 5C9 3.9 9.9 3 11 3H13C14.1 3 15 3.9 15 5V6.5H9V5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M9 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M9 16H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              ) : null}
              <button
                type="button"
                onClick={backToOverview}
                style={{ ...styles.topIconButton, ...styles.closeIconButton }}
                title="Back to Packing List overview"
                aria-label="Back to Packing List overview"
              >
                X
              </button>
            </div>
          </div>

          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>QC Confirm Qty</span>
              <strong style={styles.summaryValue}>{detailTotals.qcConfirmQty}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>PL Received Qty</span>
              <strong style={styles.summaryValue}>{detailTotals.receivedQty}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Variance</span>
              <strong style={{ ...styles.summaryValue, color: detailVariance === 0 ? '#111827' : detailVariance > 0 ? '#15803d' : '#dc2626' }}>
                {detailVariance > 0 ? '+' : ''}
                {detailVariance}
              </strong>
            </div>
          </div>

          {detailTableMode === 'model' ? (
            <div style={styles.modelFilterBar}>
              <select
                value={detailModelFilters.brand}
                onChange={(event) => setDetailModelFilters((current) => ({ ...current, brand: event.target.value }))}
                style={styles.modelFilterSelect}
                aria-label="Filter by brand"
              >
                <option value="">All Brands</option>
                {detailModelFilterOptions.brands.map((brandName) => (
                  <option key={`brand-${brandName}`} value={brandName}>
                    {brandName}
                  </option>
                ))}
              </select>
              <select
                value={detailModelFilters.category}
                onChange={(event) => setDetailModelFilters((current) => ({ ...current, category: event.target.value }))}
                style={styles.modelFilterSelect}
                aria-label="Filter by category"
              >
                <option value="">All Categories</option>
                {detailModelFilterOptions.categories.map((categoryName) => (
                  <option key={`category-${categoryName}`} value={categoryName}>
                    {categoryName}
                  </option>
                ))}
              </select>
              <select
                value={detailModelFilters.model}
                onChange={(event) => setDetailModelFilters((current) => ({ ...current, model: event.target.value }))}
                style={styles.modelFilterSelect}
                aria-label="Filter by model"
              >
                <option value="">All Models</option>
                {detailModelFilterOptions.models.map((modelName) => (
                  <option key={`model-${modelName}`} value={modelName}>
                    {modelName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setDetailModelFilters({ brand: '', category: '', model: '' })}
                style={styles.modelFilterReset}
                title="Reset filters"
                aria-label="Reset filters"
              >
                &#8634;
              </button>
            </div>
          ) : null}

          <div style={styles.overviewTableWrap}>
            {detailTableMode === 'koli' ? (
              <table style={styles.overviewTable}>
              <thead>
                <tr style={styles.overviewHeadRow}>
                  <th style={styles.overviewTh}>No</th>
                  <th style={styles.overviewTh}>Koli</th>
                  <th style={styles.overviewTh}>QC Confirm Qty</th>
                  <th style={styles.overviewTh}>PL Received Qty</th>
                  <th style={styles.overviewTh}>Variance</th>
                  <th style={styles.overviewTh}>Status</th>
                  <th style={styles.overviewTh}>PIC</th>
                </tr>
              </thead>
              <tbody>
                {detailKoliRows.map((row, index) => {
                  const variance = Number(row.received_qty || 0) - Number(row.qc_confirm_qty || 0)
                  const varianceStyle =
                    variance === 0
                      ? { background: '#ecfdf5', color: '#047857', border: '1px solid #bbf7d0' }
                      : variance > 0
                        ? { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }
                        : { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }

                  return (
                    <tr key={row.key} style={styles.overviewBodyRow}>
                      <td style={styles.overviewTd}>{index + 1}</td>
                      <td style={styles.overviewTd}>
                        <span style={styles.koliLabelWrap}>
                          <span>Koli {row.koli_sequence || '-'}</span>
                          {row.is_sample ? <span style={styles.samplePill}>Sample</span> : null}
                        </span>
                      </td>
                      <td style={styles.overviewTd}>{row.qc_confirm_qty}</td>
                      <td style={styles.overviewTd}>{row.is_validated ? row.received_qty : '-'}</td>
                      <td style={styles.overviewTd}>
                        <span style={{ ...styles.variancePill, ...varianceStyle }}>
                          {variance > 0 ? '+' : ''}
                          {variance}
                        </span>
                      </td>
                      <td style={{ ...styles.overviewTd, color: row.is_validated ? '#15803d' : '#dc2626', fontWeight: 800 }}>
                        {row.is_validated ? 'Validated' : 'Pending'}
                      </td>
                      <td style={styles.overviewTd}>{row.is_validated ? getReceivingPicLabel(row, userNameMap) : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
              </table>
            ) : (
              <table style={styles.overviewTable}>
              <thead>
                <tr style={styles.overviewHeadRow}>
                  <th style={styles.overviewTh}>No</th>
                  <th style={styles.overviewTh}>Photo</th>
                  <th style={styles.overviewTh}>Brand</th>
                  <th style={styles.overviewTh}>Model</th>
                  <th style={styles.overviewTh}>QC Confirm Qty</th>
                  <th style={styles.overviewTh}>PL Received Qty</th>
                  <th style={styles.overviewTh}>Variance</th>
                  <th style={styles.overviewTh}>Koli</th>
                  <th style={styles.overviewTh}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDetailModelRows.map((row, index) => {
                  const varianceStyle =
                    row.variance === 0
                      ? { background: '#ecfdf5', color: '#047857', border: '1px solid #bbf7d0' }
                      : row.variance > 0
                        ? { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }
                        : { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }

                  return (
                    <tr key={row.key} style={styles.overviewBodyRow}>
                      <td style={styles.overviewTd}>{index + 1}</td>
                      <td style={styles.overviewTd}>
                        {row.photo_url ? (
                          <button
                            type="button"
                            style={styles.tablePhotoButton}
                            title="Preview photo"
                            onClick={() => setPreviewPhoto({ url: row.photo_url, label: getModelLabel(row) })}
                          >
                            <Image src={row.photo_url} alt={getModelLabel(row)} width={64} height={64} unoptimized style={styles.tablePhotoThumb} />
                          </button>
                        ) : (
                          <span style={styles.tablePhotoPlaceholder}>NO</span>
                        )}
                      </td>
                      <td style={styles.overviewTd}>{row.brand_name || 'UNBRANDED'}</td>
                      <td style={styles.overviewTd}>{getModelLabel(row) || '-'}</td>
                      <td style={styles.overviewTd}>{row.qc_confirm_qty}</td>
                      <td style={styles.overviewTd}>{row.validated_koli ? row.received_qty : '-'}</td>
                      <td style={styles.overviewTd}>
                        <span style={{ ...styles.variancePill, ...varianceStyle }}>
                          {row.variance > 0 ? '+' : ''}
                          {row.variance}
                        </span>
                      </td>
                      <td style={styles.overviewTd}>{row.validated_koli} / {row.total_koli}</td>
                      <td style={{ ...styles.overviewTd, color: row.status === 'Validated' ? '#15803d' : '#dc2626', fontWeight: 800 }}>
                        {row.status}
                      </td>
                    </tr>
                  )
                })}
                {!filteredDetailModelRows.length ? (
                  <tr>
                    <td colSpan={9} style={styles.overviewTd}>No models match the selected filters.</td>
                  </tr>
                ) : null}
              </tbody>
              </table>
            )}
          </div>
        </section>

        {previewPhoto ? (
          <div style={styles.overlay} role="dialog" aria-modal="true" onClick={() => setPreviewPhoto(null)}>
            <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
              <Image src={previewPhoto.url} alt={previewPhoto.label} width={720} height={720} unoptimized style={styles.previewImage} />
              <button type="button" onClick={() => setPreviewPhoto(null)} style={styles.photoPreviewClose} aria-label="Close preview" title="Close preview">
                X
              </button>
            </div>
          </div>
        ) : null}
      </>
    )
  }

  return (
    <div style={styles.pageShell}>
      <main style={styles.mobileFrame}>
        <header style={styles.mobileTopBar}>
          <button type="button" onClick={backToDetail} style={styles.backButton} aria-label="Back to receiving detail">
            <ArrowLeftIcon />
          </button>
          <div>
            <p style={styles.eyebrow}>Packing List</p>
            <h1 style={styles.mobileTitle}>Receiving Input</h1>
          </div>
          <span style={styles.mobileGrnChip}>{grnFilter || detailGrn || '-'}</span>
        </header>

        <section style={styles.mobileProgressCard}>
          <div style={styles.mobileProgressHeader}>
            <div>
              <p style={styles.mobileProgressEyebrow}>Progress</p>
              <h2 style={styles.mobileProgressTitle}>{progressValidatedKoli} / {progressTotalKoli} Koli</h2>
            </div>
            <span style={styles.mobileProgressMeta}>{progressTotalKoli - progressValidatedKoli} pending</span>
          </div>
          <div style={styles.mobileProgressTrack}>
            <span style={{ ...styles.mobileProgressFill, width: `${progressPercent}%` }} />
          </div>
        </section>

        <section style={styles.mobileFormCard}>
          <div style={styles.koliControlRow}>
            <div style={styles.koliSelectCell}>
              <span style={styles.mobileLabel}>QC Confirm Koli</span>
              {sourceOptions.length ? (
                <div style={styles.dropdownWrap}>
                  <button type="button" style={styles.dropdownButton} onClick={() => setKoliMenuOpen((prev) => !prev)}>
                    <span style={styles.dropdownButtonText}>
                      {selectedSource ? (
                        <span style={styles.dropdownLabelWrap}>
                          <span>{selectedSource.isValidated ? `${selectedSource.label} - Validated` : selectedSource.label}</span>
                          {selectedSource.isSample ? <span style={styles.samplePill}>Sample</span> : null}
                        </span>
                      ) : 'Choose QC Confirm Koli'}
                    </span>
                    <span aria-hidden="true" style={{ color: '#111827' }}>{koliMenuOpen ? '^' : 'v'}</span>
                  </button>
                  {koliMenuOpen ? (
                    <div style={styles.dropdownMenu}>
                      {sourceOptions.map((row) => (
                        <button
                          key={row.key}
                          type="button"
                          onClick={() => handleSourceChange(row.key)}
                          style={{
                            ...styles.dropdownItem,
                            ...(row.isValidated ? styles.dropdownItemValidated : {}),
                            ...(selectedSourceKey === row.key ? styles.dropdownItemActive : {}),
                          }}
                        >
                          <span style={styles.dropdownLabelWrap}>
                            <span>{row.isValidated ? `${row.label} - Validated` : row.label}</span>
                            {row.isSample ? <span style={styles.samplePill}>Sample</span> : null}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={styles.readonlyBox}>No QC Confirm Koli yet.</div>
              )}
            </div>
            {canManageReceiving ? (
              <>
                <button
                  type="button"
                  onClick={() => openModelChooser('add')}
                  style={!selectedSource || isValidated ? { ...styles.addModelButton, ...styles.saveButtonDisabled } : styles.addModelButton}
                  disabled={!selectedSource || isValidated}
                  aria-label="Add model row"
                  title="Add model row"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={resetDraftRows}
                  style={!selectedSource || isValidated ? { ...styles.resetButton, ...styles.saveButtonDisabled } : styles.resetButton}
                  disabled={!selectedSource || isValidated}
                >
                  Reset
                </button>
              </>
            ) : null}
          </div>

          <div style={styles.companionPicker}>
            <span style={styles.mobileLabel}>Received With</span>
            <div style={styles.dropdownWrap}>
              <button
                type="button"
                onClick={() => setReceivedWithMenuOpen((prev) => !prev)}
                disabled={!canManageReceiving || !selectedSource || isValidated}
                style={
                  !canManageReceiving || !selectedSource || isValidated
                    ? { ...styles.dropdownButton, ...styles.dropdownButtonDisabled }
                    : styles.dropdownButton
                }
              >
                <span style={styles.companionButtonText}>
                  {receivedWithNames.length ? receivedWithNames.join(', ') : 'Choose packing staff (optional)'}
                </span>
                <span aria-hidden="true" style={{ color: '#111827' }}>{receivedWithMenuOpen ? '^' : 'v'}</span>
              </button>
              {receivedWithMenuOpen ? (
                <div style={styles.dropdownMenu}>
                  {packingStaffOptions.length ? (
                    packingStaffOptions.map((staffName) => {
                      const isActive = receivedWithNames.includes(staffName)
                      return (
                        <button
                          key={`received-with-${staffName}`}
                          type="button"
                          onClick={() => toggleReceivedWithName(staffName)}
                          style={{
                            ...styles.companionOption,
                            ...(isActive ? styles.companionOptionActive : {}),
                          }}
                        >
                          <span style={{ ...styles.companionCheck, ...(isActive ? styles.companionCheckActive : {}) }}>
                            ✓
                          </span>
                          {staffName}
                        </button>
                      )
                    })
                  ) : (
                    <span style={styles.emptyText}>No packing staff profile.</span>
                  )}
                </div>
              ) : null}
            </div>
          </div>

        {error ? <p style={styles.errorText}>{error}</p> : null}
        {success ? <p style={styles.successText}>{success}</p> : null}

        {selectedSource ? (
          <>
            <div style={styles.mobileTableWrap}>
              <table style={styles.mobileTable}>
                <thead>
                  <tr>
                    <th style={styles.mobileTh}>Model</th>
                    <th style={styles.mobileTh}>QC Confirm Qty</th>
                    <th style={styles.mobileTh}>PL Received Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {inputRows.map((row) => {
                    const disableRemove = isValidated || inputRows.length <= 1

                    return (
                        <tr key={row.id}>
                          <td style={styles.mobileTd}>
                            <div style={styles.pictureCell}>
                              {row.photo_url ? (
                                <button
                                  type="button"
                                  style={styles.pictureButton}
                                  title="Preview photo"
                                  onClick={() => setPreviewPhoto({ url: row.photo_url, label: row.label })}
                                >
                                  <Image src={row.photo_url} alt={row.label} width={96} height={96} unoptimized style={styles.pictureThumb} />
                                </button>
                              ) : (
                                <span style={styles.picturePlaceholder}>NO PHOTO</span>
                              )}
                              <span style={styles.modelNameText}>{row.label || '-'}</span>
                              {canManageReceiving ? (
                                <span style={styles.modelControlRow}>
                                  <button
                                    type="button"
                                    onClick={() => openModelChooser('switch', row.id)}
                                    style={isValidated ? { ...styles.switchButton, ...styles.saveButtonDisabled } : styles.switchButton}
                                    disabled={isValidated}
                                    aria-label="Switch model"
                                    title="Switch model"
                                  >
                                    <SwitchIcon />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeDraftRow(row.id)}
                                    style={disableRemove ? { ...styles.deleteRowButton, ...styles.saveButtonDisabled } : styles.deleteRowButton}
                                    disabled={disableRemove}
                                    aria-label="Remove row"
                                    title="Remove row"
                                  >
                                    <TrashIcon />
                                  </button>
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td style={styles.mobileTd}>{row.source_qty}</td>
                          <td style={styles.mobileTd}>
                            <input
                              value={row.qty}
                              onChange={(event) => updateDraftRow(row.id, { qty: sanitizeQuantityInput(event.target.value) })}
                              onWheel={preventNumberWheel}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              style={!canManageReceiving || isValidated ? { ...styles.mobileInput, ...styles.mobileInputDisabled } : styles.mobileInput}
                              placeholder="0"
                              required
                              disabled={!canManageReceiving || isValidated}
                            />
                          </td>
                        </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div
              style={{
                ...styles.varianceBox,
                ...(totalVariance < 0 ? styles.varianceDanger : totalVariance > 0 ? styles.varianceWarning : styles.varianceSuccess),
              }}
            >
              <div>
                <span style={styles.varianceLabelText}>Total Variance</span>
                <span style={styles.varianceFormula}>PL Received Qty - QC Confirm Qty</span>
              </div>
              <strong style={styles.varianceValueText}>
                {totalVariance > 0 ? '+' : ''}
                {totalVariance}
              </strong>
            </div>

            {canManageReceiving ? (
              <button
                type="button"
                onClick={handleValidate}
                style={isValidated || saving ? { ...styles.saveButton, ...styles.saveButtonDisabled } : styles.saveButton}
                disabled={isValidated || saving}
              >
                {isValidated ? 'Validated' : saving ? 'Saving...' : 'Validate Receiving'}
              </button>
            ) : null}
          </>
        ) : null}
      </section>
      </main>

      {modelChooser ? (
        <div style={styles.overlay} role="dialog" aria-modal="true" onClick={closeModelChooser}>
          <div style={styles.modelPickerModal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modelPickerHeader}>
              <div>
                <h2 style={styles.modelPickerTitle}>{modelChooser.mode === 'switch' ? 'Switch Model' : 'Add Model Row'}</h2>
                <p style={styles.modelPickerSubtitle}>Choose a model-variant from the same GRN.</p>
              </div>
              <button type="button" onClick={closeModelChooser} style={styles.modelPickerClose} aria-label="Close model picker">
                X
              </button>
            </div>
            <div style={styles.modelPickerList}>
              {modelOptions.length ? (
                modelOptions.map((item) => (
                  <button key={item.key} type="button" onClick={() => handleChooseModel(item)} style={styles.modelPickerItem}>
                    {item.photo_url ? (
                      <Image src={item.photo_url} alt={item.label} width={80} height={80} unoptimized style={styles.modelPickerThumb} />
                    ) : (
                      <span style={styles.modelPickerNoPhoto}>NO PHOTO</span>
                    )}
                    <span>
                      <span style={styles.modelPickerName}>{item.label || '-'}</span>
                      <span style={styles.modelPickerMeta}>
                        {item.brand_name || 'UNBRANDED'} | QC Confirm Qty {item.qty || 0}
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <p style={styles.emptyText}>No model found for this GRN.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {previewPhoto ? (
        <div style={styles.overlay} role="dialog" aria-modal="true" onClick={() => setPreviewPhoto(null)}>
          <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <Image src={previewPhoto.url} alt={previewPhoto.label} width={720} height={720} unoptimized style={styles.previewImage} />
            <button type="button" onClick={() => setPreviewPhoto(null)} style={styles.photoPreviewClose} aria-label="Close preview" title="Close preview">
              X
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
