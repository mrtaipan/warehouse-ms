'use client'

import Image from 'next/image'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import { ADMIN_EMAIL } from '@/utils/permissions'
import { useRealtimeRefresh } from '@/utils/supabase/use-realtime-refresh'

const supabase = createClient()
const QC_GRADE_OPTIONS = ['A', 'B', 'C']

function normalizeQcItemRow(item) {
  return {
    ...item,
    model_color: item.variant_name || item.model_color || '',
  }
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    padding: '18px',
    border: '1px solid #dbe4f0',
    borderRadius: '22px',
    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(245, 248, 252, 0.97) 100%)',
    boxShadow: '0 24px 54px rgba(15, 23, 42, 0.08)',
  },
  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  flatSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    padding: '4px 0 18px',
    borderBottom: '1px solid #e2e8f0',
  },
  flatSectionLast: {
    borderBottom: 'none',
    paddingBottom: 0,
  },
  summaryHeaderGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 1fr) minmax(420px, 0.95fr)',
    gap: '24px',
    alignItems: 'start',
  },
  summaryHeaderLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  summaryMetricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))',
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
  },
  compactMetricValue: {
    fontSize: '20px',
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
  titleRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  sectionTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '22px',
    fontWeight: '900',
    letterSpacing: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '16px',
  },
  modeRow: {
    display: 'inline-flex',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: '3px',
    padding: '3px',
    border: '1px solid #dbe4f0',
    borderRadius: '10px',
    background: 'rgba(255, 255, 255, 0.9)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
  },
  modeButton: {
    minHeight: '30px',
    minWidth: '82px',
    padding: '0 12px',
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: '8px',
    background: 'transparent',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  modeButtonActive: {
    background: '#0f172a',
    color: '#fff',
    boxShadow: '0 10px 18px rgba(15, 23, 42, 0.14)',
  },
  summaryTabs: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    position: 'relative',
    isolation: 'isolate',
  },
  summaryTabList: {
    position: 'relative',
    zIndex: 2,
    display: 'inline-flex',
    alignSelf: 'flex-start',
    alignItems: 'flex-end',
    gap: '2px',
    marginBottom: '-1px',
  },
  summaryTabButton: {
    minHeight: '42px',
    minWidth: '150px',
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
  },
  summaryTabLabel: {
    fontSize: '13px',
    fontWeight: '750',
    lineHeight: 1.1,
  },
  summaryTabButtonActive: {
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderLeftWidth: '1px',
    borderTopColor: '#e2e8f0',
    borderRightColor: '#e2e8f0',
    borderLeftColor: '#e2e8f0',
    background: 'rgba(255, 255, 255, 0.98)',
    color: '#111827',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.9)',
  },
  summaryTabUnderline: {
    position: 'absolute',
    right: '16px',
    bottom: '8px',
    left: '16px',
    height: '2px',
    borderRadius: '999px',
    background: '#111827',
  },
  summaryTabPanel: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    padding: '20px 22px 22px',
    border: '1px solid #e2e8f0',
    borderRadius: '0 26px 26px 26px',
    background: 'rgba(255, 255, 255, 0.98)',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.06)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    paddingBottom: '18px',
    borderBottom: '1px solid #eef2f7',
  },
  panelEyebrow: {
    margin: '0 0 3px',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: '850',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
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
  infoIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    marginLeft: '6px',
    borderRadius: '999px',
    border: '1px solid #9ca3af',
    color: '#6b7280',
    fontSize: '11px',
    fontWeight: '700',
    lineHeight: 1,
    cursor: 'help',
    textTransform: 'none',
  },
  infoWrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  },
  infoTooltip: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '380px',
    maxWidth: 'calc(100vw - 32px)',
    padding: '10px 12px',
    borderRadius: '10px',
    background: '#111827',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '500',
    lineHeight: 1.5,
    textTransform: 'none',
    whiteSpace: 'pre-line',
    zIndex: 20,
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.22)',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#111827',
    fontVariantNumeric: 'tabular-nums',
  },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(176px, 1fr))',
    gap: '16px',
    paddingTop: '20px',
    borderTop: '1px solid #eef2f7',
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
    height: '40px',
    padding: '0 11px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    background: '#fff',
    width: '100%',
    color: '#111827',
  },
  tableWrap: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    minWidth: '880px',
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
  },
  td: {
    padding: '12px',
    fontSize: '13px',
    color: '#1e293b',
    borderTop: '1px solid #eef2f7',
    verticalAlign: 'middle',
  },
  thCenter: {
    textAlign: 'center',
  },
  tdCenter: {
    textAlign: 'center',
  },
  emptyText: {
    margin: 0,
    color: '#64748b',
    fontSize: '13px',
  },
  previewButton: {
    width: '46px',
    height: '46px',
    padding: 0,
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#f8fafc',
    color: '#111827',
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 0,
    cursor: 'pointer',
  },
  previewThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  detailButton: {
    height: '34px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '999px',
    background: '#fff',
    color: '#111827',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  inspectorNameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  liveTimerBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    height: '24px',
    padding: '0 8px',
    borderRadius: '999px',
    background: '#111827',
    color: '#fff',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.46)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 80,
    overflowY: 'auto',
  },
  modal: {
    width: '100%',
    maxWidth: '520px',
    maxHeight: 'calc(100vh - 48px)',
    background: '#fff',
    borderRadius: '18px',
    padding: '24px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 24px 64px rgba(15, 23, 42, 0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  },
  wideModal: {
    maxWidth: '1080px',
  },
  rejectDetailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(136px, 1fr))',
    gap: '10px',
  },
  compactSummaryCard: {
    padding: '12px',
    gap: '4px',
  },
  compactSummaryValue: {
    fontSize: '20px',
  },
  inspectorModal: {
    maxWidth: '1160px',
    maxHeight: 'none',
    padding: '14px',
    gap: '12px',
    overflow: 'visible',
  },
  inspectorModalHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flexShrink: 0,
  },
  inspectorModalContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: 'auto',
    overflow: 'visible',
  },
  inspectorModalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
    flexShrink: 0,
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px',
  },
  rejectRowGrid: {
    display: 'grid',
    gridTemplateColumns: '96px minmax(180px, 1.4fr) 96px 96px 86px',
    gap: '10px',
    alignItems: 'end',
  },
  rejectRowHeader: {
    display: 'grid',
    gridTemplateColumns: '96px minmax(180px, 1.4fr) 96px 96px 86px',
    gap: '10px',
    alignItems: 'center',
  },
  iconSmallButton: {
    width: '34px',
    height: '34px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '18px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  rejectSummarySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  rejectRepairabilityCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  },
  rejectRepairabilityCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '800',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  rejectRepairabilityCardRepairable: {
    background: '#166534',
    color: '#ffffff',
    borderColor: '#166534',
  },
  rejectRepairabilityCardUnrepairable: {
    background: '#6f1d2a',
    color: '#ffffff',
    borderColor: '#6f1d2a',
  },
  rejectSummarySectionRow: {
    padding: '10px 14px',
    background: '#f1f5f9',
    color: '#334155',
    fontSize: '12px',
    fontWeight: '900',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  rejectSummarySectionRowRepairable: {
    background: '#166534',
    color: '#ffffff',
  },
  rejectSummarySectionRowUnrepairable: {
    background: '#6f1d2a',
    color: '#ffffff',
  },
  readOnlyRejectSection: {
    border: '1px solid #dbe3ef',
    borderRadius: '10px',
    background: '#ffffff',
    overflow: 'hidden',
  },
  readOnlyRejectSectionHeader: {
    width: '100%',
    minHeight: '48px',
    padding: '0 14px',
    border: 0,
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
    color: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    fontSize: '14px',
    fontWeight: '850',
    cursor: 'pointer',
  },
  readOnlyRejectSectionMeta: {
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '900',
    whiteSpace: 'nowrap',
  },
  readOnlyRejectSectionBody: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  rejectSummaryToggle: {
    width: '34px',
    height: '34px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '17px',
    fontWeight: '800',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  rejectSummaryDetailPanel: {
    padding: '10px 12px',
    background: '#f8fafc',
    borderTop: '1px solid #e2e8f0',
  },
  iconButtonRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    minHeight: '42px',
  },
  adjustmentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
  },
  smallButton: {
    height: '34px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
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
  dangerButton: {
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
  pauseIconButton: {
    width: '34px',
    height: '34px',
    border: '1px solid #b91c1c',
    borderRadius: '10px',
    background: '#b91c1c',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '900',
    lineHeight: 1,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '800',
  },
  disabledInput: {
    background: '#f1f5f9',
    color: '#94a3b8',
    cursor: 'not-allowed',
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
  inspectorCardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },
  inspectorInsightCard: {
    background: '#fff',
    border: '1px solid #eef2f7',
    borderRadius: '12px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  performanceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '24px',
    alignItems: 'start',
  },
  performanceColumn: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  performanceColumnDivider: {
    borderLeft: '2px solid #cbd5e1',
    paddingLeft: '24px',
  },
  performanceSubtitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '16px',
    fontWeight: '850',
    letterSpacing: 0,
  },
  inspectorTitleWrap: {
    minWidth: 0,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  inspectorCardName: {
    margin: 0,
    color: '#111827',
    fontSize: '14px',
    fontWeight: '750',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  idleBadge: {
    alignSelf: 'flex-start',
    padding: '3px 8px',
    border: '1px solid #dbeafe',
    borderRadius: '999px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '11px',
    fontWeight: '700',
  },
  inspectorStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
  },
  inspectorStatBox: {
    minWidth: 0,
    padding: '0',
  },
  inspectorStatLabel: {
    margin: '0 0 5px',
    color: '#94a3b8',
    fontSize: '10px',
    fontWeight: '750',
    lineHeight: 1,
  },
  inspectorStatValue: {
    margin: 0,
    color: '#1e293b',
    fontSize: '14px',
    fontWeight: '800',
    fontVariantNumeric: 'tabular-nums',
  },
  barRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  barLabel: {
    minWidth: 0,
    flex: 1,
    color: '#475569',
    fontSize: '13px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  barTrack: {
    width: '140px',
    height: '8px',
    borderRadius: '999px',
    background: '#f1f5f9',
    overflow: 'hidden',
    flex: '0 0 auto',
  },
  barValue: {
    width: '54px',
    color: '#64748b',
    fontSize: '13px',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    flex: '0 0 auto',
  },
  warningBox: {
    padding: '12px 14px',
    border: '1px solid #f59e0b',
    borderRadius: '10px',
    background: '#fffbeb',
    color: '#92400e',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  smallNote: {
    margin: 0,
    fontSize: '12px',
    lineHeight: 1.6,
    color: '#6b7280',
    whiteSpace: 'pre-line',
  },
  noteGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
  },
  noteCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    background: '#f9fafb',
  },
  previewImage: {
    width: '100%',
    height: 'auto',
    maxHeight: '70vh',
    objectFit: 'contain',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
  photoPreviewOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 90,
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
  modalTableWrap: {
    maxHeight: '360px',
    overflow: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
  },
  inspectorSection: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#fff',
  },
  inspectorSectionHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 14px',
    border: 'none',
    background: '#f9fafb',
    cursor: 'pointer',
    textAlign: 'left',
  },
  inspectorSectionTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '800',
    color: '#111827',
  },
  inspectorSectionMeta: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '600',
  },
  inspectorSectionBody: {
    padding: '10px 12px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inspectorTableWrap: {
    maxHeight: 'none',
    overflow: 'visible',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
  },
  inspectorTh: {
    fontSize: '12px',
    padding: '10px 12px',
  },
  inspectorTd: {
    fontSize: '13px',
    padding: '10px 12px',
  },
}

function isWithinDateRange(dateString, dateFrom, dateTo) {
  if (!dateString) return false

  const dateOnly = String(dateString).slice(0, 10)
  if (dateFrom && dateOnly < dateFrom) return false
  if (dateTo && dateOnly > dateTo) return false
  return true
}

function getQcWorkDateValue(item) {
  return item?.finished_at || item?.updated_at || item?.created_at || ''
}

function getArklineAdjustmentDateValue(item) {
  return item?.effective_date || item?.created_at || item?.updated_at || ''
}

function getTodayLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

function getTaskModelInfo(item) {
  return {
    model: item.model_name || 'UNKNOWN MODEL',
    variant: item.model_color || item.variant_name || '',
    photoUrl: item.photo_url || '',
  }
}

function getRegularModelVariantLabel(item) {
  const taskModel = getTaskModelInfo(item)
  return [taskModel.model, taskModel.variant].map((value) => String(value || '').trim()).filter(Boolean).join(' - ')
}

function matchesModelVariantSearch(label, searchValue) {
  const normalizedSearch = String(searchValue || '').trim().toUpperCase()
  if (!normalizedSearch) return true

  return String(label || '').trim().toUpperCase().includes(normalizedSearch)
}

function getArklinePoLabel(item) {
  return String(item.po_id || 'NO PO').trim().toUpperCase() || 'NO PO'
}

function getArklineCategoryLabel(item) {
  return String(item.sku_induk || 'NO SKU').trim().toUpperCase() || 'NO SKU'
}

function getArklineProductLabel(item) {
  const sku = String(item.sku_induk || 'NO SKU').trim().toUpperCase() || 'NO SKU'
  const model = String(item.model_name || '').trim().toUpperCase()
  return model ? `${sku} - ${model}` : sku
}

function getBrandLabel(item) {
  return item.product_model?.brands?.brand_name || item.inbound_unload?.brands?.brand_name || 'UNBRANDED'
}

function getCategoryLabel(item) {
  return (
    item.product_model?.categories?.full_name ||
    item.product_model?.categories?.category_name ||
    item.inbound_unload?.categories?.full_name ||
    item.inbound_unload?.categories?.category_name ||
    'UNCATEGORIZED'
  )
}

function getConfirmBrandLabel(item) {
  return item.brands?.brand_name || 'UNBRANDED'
}

function getConfirmCategoryLabel(item) {
  return item.categories?.full_name || item.categories?.category_name || 'UNCATEGORIZED'
}

function getReturnBrandLabel(item) {
  return item.brands?.brand_name || 'UNBRANDED'
}

function getReturnCategoryLabel(item) {
  return item.categories?.full_name || item.categories?.category_name || 'UNCATEGORIZED'
}

function getPauseDurationSeconds(item) {
  if (Number(item.duration_seconds || 0) > 0) {
    return Number(item.duration_seconds || 0)
  }

  const pausedAtMs = item.paused_at ? new Date(item.paused_at).getTime() : null
  const resumedAtMs = item.resumed_at ? new Date(item.resumed_at).getTime() : null

  if (!pausedAtMs) {
    return 0
  }

  const endMs = resumedAtMs || Date.now()
  return Math.max(0, Math.floor((endMs - pausedAtMs) / 1000))
}

function getPauseLogAssignedTo(item) {
  return item.qc_item?.assigned_to || item.arkline_qc?.assigned_to || item.paused_by || '-'
}

function getPauseLogArklinePoLabel(item) {
  return String(item.arkline_qc?.po_id || 'NO PO').trim().toUpperCase() || 'NO PO'
}

function getPauseLogArklineCategoryLabel(item) {
  return String(item.arkline_qc?.sku_induk || 'NO SKU').trim().toUpperCase() || 'NO SKU'
}

function getPauseLogArklineProductLabel(item) {
  const sku = getPauseLogArklineCategoryLabel(item)
  const model = String(item.arkline_qc?.model_name || '').trim().toUpperCase()
  return model ? `${sku} - ${model}` : sku
}

function formatMinutes(seconds) {
  return Math.round((Number(seconds || 0) / 60) * 100) / 100
}

function formatCompactTimer(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds || 0)))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

function formatDisplayDate(value) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function formatDisplayDateOnly(value) {
  const dateOnly = getDateOnly(value)
  if (!dateOnly) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${dateOnly}T00:00:00`))
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

function getCheckedQty(item) {
  return Number(item?.qty_a || 0) + Number(item?.qty_b || 0) + Number(item?.qty_c || 0)
}

function getRejectQty(item) {
  return Number(item?.qty_b || 0) + Number(item?.qty_c || 0)
}

function hasQcResult(item) {
  return getCheckedQty(item) > 0 || Number(item?.locked_qty || 0) > 0
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

function getSampleBreakdownLabel(row) {
  const model = String(row?.model_name || 'UNKNOWN MODEL').trim()
  const variant = String(row?.variant_name || '').trim()
  return variant ? `${model} - ${variant}` : model
}

function shouldTrackQcTiming(item, qcMode) {
  return qcMode !== 'regular' || !isRegularSampleTask(item)
}

function shouldIncludePerformanceBreakdownItem(item, qcMode) {
  return qcMode !== 'regular' || !isRegularSampleTask(item)
}

function getArklineTaskLabel(item, memberNameMap = {}) {
  const inspector = memberNameMap[item.assigned_to] || item.assigned_to || 'Unassigned'
  return `${inspector} | B ${Number(item.qty_b || 0)} / C ${Number(item.qty_c || 0)} | ${item.status || '-'}`
}

function getSummaryTaskKeyParts(summary) {
  return {
    brand: String(summary?.brand || '').trim().toUpperCase(),
    category: String(summary?.category || '').trim().toUpperCase(),
    model: String(summary?.model || '').trim().toUpperCase(),
  }
}

function isTaskInSummary(item, summary) {
  const summaryParts = getSummaryTaskKeyParts(summary)
  const itemBrand = getArklinePoLabel(item)
  const itemCategory = getArklineCategoryLabel(item)
  const itemModel = String(getTaskModelInfo(item).model || '').trim().toUpperCase()

  return itemBrand === summaryParts.brand && itemCategory === summaryParts.category && itemModel === summaryParts.model
}

function compareApparelSize(a, b) {
  const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  const normalizedA = String(a || '').trim().toUpperCase()
  const normalizedB = String(b || '').trim().toUpperCase()
  const indexA = order.indexOf(normalizedA)
  const indexB = order.indexOf(normalizedB)

  if (indexA !== -1 && indexB !== -1) return indexA - indexB
  if (indexA !== -1) return -1
  if (indexB !== -1) return 1
  return normalizedA.localeCompare(normalizedB, undefined, { numeric: true })
}

function normalizeQcGrade(value, fallback = '') {
  const grade = String(value || '').trim().toUpperCase()
  return QC_GRADE_OPTIONS.includes(grade) ? grade : fallback
}

function getRegularGradeQty(item, grade) {
  const normalizedGrade = normalizeQcGrade(grade)
  if (normalizedGrade === 'A') return Number(item?.qty_a || 0)
  if (normalizedGrade === 'B') return Number(item?.qty_b || 0)
  if (normalizedGrade === 'C') return Number(item?.qty_c || 0)
  return 0
}

function getSummaryGradeQty(item, grade) {
  const normalizedGrade = normalizeQcGrade(grade)
  if (normalizedGrade === 'A') return Number(item?.qtyA || 0)
  if (normalizedGrade === 'B') return Number(item?.qtyB || 0)
  if (normalizedGrade === 'C') return Number(item?.qtyC || 0)
  return 0
}

function applyArklineAdjustmentsToGradeTotals(qtyA, qtyB, qtyC, adjustmentRows = []) {
  const totals = {
    A: Number(qtyA || 0),
    B: Number(qtyB || 0),
    C: Number(qtyC || 0),
  }

  function moveQty(fromGrade, toGrade, rawQty) {
    const sourceGrade = normalizeQcGrade(fromGrade)
    const targetGrade = normalizeQcGrade(toGrade)
    const qty = Math.max(0, Number(rawQty || 0))
    if (!sourceGrade || !targetGrade || sourceGrade === targetGrade || !qty) return 0

    const appliedQty = Math.min(totals[sourceGrade], qty)
    totals[sourceGrade] -= appliedQty
    totals[targetGrade] += appliedQty
    return appliedQty
  }

  function reduceGrade(grade, rawQty) {
    const targetGrade = normalizeQcGrade(grade)
    const qty = Math.max(0, Number(rawQty || 0))
    if (!targetGrade || !qty) return 0

    const appliedQty = Math.min(totals[targetGrade], qty)
    totals[targetGrade] -= appliedQty
    return appliedQty
  }

  const chronologicalRows = [...adjustmentRows].sort((a, b) => {
    const dateA = new Date(a?.created_at || a?.updated_at || a?.effective_date || 0).getTime()
    const dateB = new Date(b?.created_at || b?.updated_at || b?.effective_date || 0).getTime()
    if (dateA !== dateB) return dateA - dateB
    return String(a?.id || '').localeCompare(String(b?.id || ''), undefined, { numeric: true })
  })

  chronologicalRows.forEach((item) => {
    const type = String(item?.adjustment_type || '').trim().toLowerCase()
    const qty = Number(item?.qty || 0)
    if (!qty) return

    if (type === 'transfer') {
      if (qty > 0) moveQty(item.from_grade, item.to_grade, qty)
      if (qty < 0) moveQty(item.to_grade, item.from_grade, Math.abs(qty))
      return
    }

    if (type === 'bc_to_a') {
      if (qty > 0) {
        const movedFromC = moveQty('C', 'A', qty)
        moveQty('B', 'A', Math.max(0, qty - movedFromC))
      } else {
        moveQty('A', 'C', Math.abs(qty))
      }
      return
    }

    if (type === 'inspector_data_error') {
      const affectedGrade = normalizeQcGrade(item.affected_grade)
      if (affectedGrade) {
        if (qty > 0) reduceGrade(affectedGrade, qty)
        if (qty < 0) totals[affectedGrade] += Math.abs(qty)
        return
      }

      if (qty > 0) {
        const reducedFromC = reduceGrade('C', qty)
        reduceGrade('B', Math.max(0, qty - reducedFromC))
      } else {
        totals.C += Math.abs(qty)
      }
    }
  })

  return {
    qtyA: totals.A,
    qtyB: totals.B,
    qtyC: totals.C,
  }
}

function createRejectDraftRow(overrides = {}) {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    grade: 'B',
    rejectReasonId: '',
    newReasonName: '',
    qty: '',
    size: '',
    ...overrides,
  }
}

function hasResolvableRejectDraftReason(row) {
  const reasonId = String(row?.rejectReasonId || row?.reject_reason_id || '').trim()
  if (!reasonId) return false
  if (reasonId !== '__new__') return true
  return Boolean(String(row?.newReasonName || '').trim())
}

function buildGroupedRejectDraftRows(rows = []) {
  const grouped = new Map()

  rows.forEach((item) => {
    const grade = String(item.grade || 'B').toUpperCase()
    const rejectReasonId = item.reject_reason_id || ''
    const size = String(item.size || '').trim().toUpperCase()
    const key = `${grade}|||${rejectReasonId}|||${size}`
    const current =
      grouped.get(key) ||
      createRejectDraftRow({
        grade,
        rejectReasonId,
        qty: '0',
        size,
      })

    current.qty = String(Number(current.qty || 0) + Number(item.qty || 0))
    grouped.set(key, current)
  })

  return Array.from(grouped.values())
}

function getRejectReasonDisplayName(row, reasonNameById = new Map()) {
  const reasonId = String(row?.rejectReasonId || row?.reject_reason_id || '').trim()
  if (reasonId === '__new__') {
    return String(row?.newReasonName || 'NEW REJECT REASON').trim().toUpperCase() || 'NEW REJECT REASON'
  }

  return (
    String(reasonNameById.get(reasonId) || row?.reason?.reason_name || row?.reasonName || row?.reject_reason_name || 'UNASSIGNED')
      .trim()
      .toUpperCase() || 'UNASSIGNED'
  )
}

function compareRejectDetailRows(a, b, reasonNameById = new Map()) {
  const reasonCompare = getRejectReasonDisplayName(a, reasonNameById).localeCompare(getRejectReasonDisplayName(b, reasonNameById), undefined, {
    numeric: true,
  })
  if (reasonCompare !== 0) return reasonCompare

  const gradeCompare = String(a?.grade || '').localeCompare(String(b?.grade || ''), undefined, { numeric: true })
  if (gradeCompare !== 0) return gradeCompare

  const sizeCompare = compareApparelSize(String(a?.size || ''), String(b?.size || ''))
  if (sizeCompare !== 0) return sizeCompare

  return String(a?.id || '').localeCompare(String(b?.id || ''), undefined, { numeric: true })
}

function getRejectReasonRepairability(row, repairableById = new Map()) {
  const reasonId = String(row?.rejectReasonId || row?.reject_reason_id || '').trim()
  if (reasonId && repairableById.has(reasonId)) {
    return repairableById.get(reasonId) === true
  }

  return row?.reason?.is_repairable === true
}

function getRejectDetailDateValue(row, taskById = new Map()) {
  const sourceTask = taskById.get(String(row?.arkline_qc_id || ''))
  const sourceDate = sourceTask ? getQcWorkDateValue(sourceTask) : ''
  return String(sourceDate || row?.created_at || row?.updated_at || '').slice(0, 10)
}

function getRejectReasonSizeKey(row) {
  const reasonId = String(row?.rejectReasonId || row?.reject_reason_id || '').trim()
  const size = String(row?.size || '').trim().toUpperCase()
  return `${reasonId}|||${size}`
}

function buildReadOnlyRejectReasonSummaryRows(rows = [], reasonNameById = new Map(), repairableById = new Map(), taskById = new Map()) {
  const grouped = new Map()

  rows.forEach((row) => {
    const qty = Number(row?.qty || 0)
    if (qty <= 0) return

    const reasonId = String(row?.rejectReasonId || row?.reject_reason_id || '').trim()
    const reason = getRejectReasonDisplayName(row, reasonNameById)
    const isRepairable = getRejectReasonRepairability(row, repairableById)
    const groupKey = `${isRepairable ? 'repairable' : 'unrepairable'}|||${reasonId || reason}`
    const current = grouped.get(groupKey) || {
      key: groupKey,
      reason,
      isRepairable,
      qtyB: 0,
      qtyC: 0,
      totalQty: 0,
      sizes: new Map(),
    }
    const grade = String(row?.grade || '').trim().toUpperCase()
    if (grade === 'B') current.qtyB += qty
    if (grade === 'C') current.qtyC += qty
    current.totalQty += qty

    const size = String(row?.size || '-').trim().toUpperCase() || '-'
    const sizeRow = current.sizes.get(size) || {
      size,
      qtyB: 0,
      qtyC: 0,
      totalQty: 0,
      dates: new Set(),
    }
    if (grade === 'B') sizeRow.qtyB += qty
    if (grade === 'C') sizeRow.qtyC += qty
    sizeRow.totalQty += qty
    const dateValue = getRejectDetailDateValue(row, taskById)
    if (dateValue) sizeRow.dates.add(dateValue)
    current.sizes.set(size, sizeRow)
    grouped.set(groupKey, current)
  })

  return Array.from(grouped.values())
    .map((row) => ({
      ...row,
      sizes: Array.from(row.sizes.values()).sort((a, b) => compareApparelSize(a.size, b.size)),
    }))
    .sort((a, b) => {
      const totalCompare = Number(b.totalQty || 0) - Number(a.totalQty || 0)
      if (totalCompare !== 0) return totalCompare
      return a.reason.localeCompare(b.reason, undefined, { numeric: true })
    })
}

function getRejectDraftKey(row) {
  const grade = String(row?.grade || 'B').trim().toUpperCase()
  const reasonId = String(row?.rejectReasonId || row?.reject_reason_id || '').trim()
  const size = String(row?.size || '').trim().toUpperCase()
  return `${grade}|||${reasonId}|||${size}`
}

function getSummaryRejectKey(item) {
  const po = String(item?.brand || 'NO PO').trim().toUpperCase() || 'NO PO'
  const sku = String(item?.category || 'NO SKU').trim().toUpperCase() || 'NO SKU'
  const model = String(item?.model || 'UNKNOWN MODEL').trim().toUpperCase() || 'UNKNOWN MODEL'
  return `${po}|||${sku}|||${model}`
}

function getAdjustmentSummaryKey(item) {
  const po = String(item.po_id || 'NO PO').trim().toUpperCase() || 'NO PO'
  const sku = String(item.sku_induk || 'NO SKU').trim().toUpperCase() || 'NO SKU'
  const model = String(item.model_name || 'UNKNOWN MODEL').trim().toUpperCase() || 'UNKNOWN MODEL'
  return `${po}|||${sku}|||${model}`
}

function getRejectDetailSummaryKey(item) {
  const po = String(item?.po_id || 'NO PO').trim().toUpperCase() || 'NO PO'
  const sku = String(item?.sku_induk || 'NO SKU').trim().toUpperCase() || 'NO SKU'
  const model = String(item?.model_name || 'UNKNOWN MODEL').trim().toUpperCase() || 'UNKNOWN MODEL'
  return `${po}|||${sku}|||${model}`
}

function getArklineAdjustmentLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'transfer') return 'Transfer'
  if (normalized === 'bc_to_a') return 'Transfer to A'
  if (normalized === 'inspector_data_error') return 'QC Inspector Error'
  return value || '-'
}

function getArklineAdjustmentGradeLabel(item) {
  const type = String(item?.adjustment_type || '').trim().toLowerCase()
  if (type === 'transfer') {
    return `${normalizeQcGrade(item?.from_grade, '-')} -> ${normalizeQcGrade(item?.to_grade, '-')}`
  }
  if (type === 'bc_to_a') return 'B/C -> A'
  if (type === 'inspector_data_error') return normalizeQcGrade(item?.affected_grade, 'B/C')
  return '-'
}

function getVerificationAdjustmentType(item) {
  return String(item?.adjustment_type || '').trim().toUpperCase()
}

function compareQcPostingRows(a, b) {
  const dateA = a?.created_at ? new Date(a.created_at).getTime() : 0
  const dateB = b?.created_at ? new Date(b.created_at).getTime() : 0
  if (dateA !== dateB) return dateA - dateB

  const sequenceA = Number(a?.koli_sequence || 0)
  const sequenceB = Number(b?.koli_sequence || 0)
  if (sequenceA !== sequenceB) return sequenceA - sequenceB

  return Number(a?.id || 0) - Number(b?.id || 0)
}

function InfoHint({ text }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      style={styles.infoWrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button type="button" style={styles.infoIcon} aria-label={text}>
        i
      </button>
      {open ? <span style={styles.infoTooltip}>{text}</span> : null}
    </span>
  )
}

function getThroughputBarColor(seconds, categoryAverageSeconds) {
  const safeSeconds = Number(seconds || 0)
  const safeAverage = Number(categoryAverageSeconds || 0)
  if (!safeAverage || safeSeconds <= safeAverage) return '#10b981'
  if (safeSeconds <= safeAverage * 1.1) return '#f59e0b'
  return '#f43f5e'
}

export default function QcDashboardPage() {
  const today = getTodayLocalDate()
  const [clockTick, setClockTick] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [rejectDetailError, setRejectDetailError] = useState('')
  const [pausingAll, setPausingAll] = useState(false)
  const [showPauseConfirm, setShowPauseConfirm] = useState(false)
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [qcMode, setQcMode] = useState('regular')
  const [summaryTab, setSummaryTab] = useState('result-summary')
  const [qcItems, setQcItems] = useState([])
  const [arklineQcItems, setArklineQcItems] = useState([])
  const [qcConfirmRows, setQcConfirmRows] = useState([])
  const [returnRows, setReturnRows] = useState([])
  const [qcMembers, setQcMembers] = useState([])
  const [qcProfiles, setQcProfiles] = useState([])
  const [pauseLogs, setPauseLogs] = useState([])
  const [arklineRejectReasons, setArklineRejectReasons] = useState([])
  const [arklineRejectDetails, setArklineRejectDetails] = useState([])
  const [arklineRejectAdjustments, setArklineRejectAdjustments] = useState([])
  const [arklinePoItemSizes, setArklinePoItemSizes] = useState([])
  const [sampleBreakdownRows, setSampleBreakdownRows] = useState([])
  const [qcSampleBreakdownRows, setQcSampleBreakdownRows] = useState([])
  const [supportsSampleSplit, setSupportsSampleSplit] = useState(false)
  const [sampleSplitSummary, setSampleSplitSummary] = useState(null)
  const [sampleSplitDraftRows, setSampleSplitDraftRows] = useState([])
  const [sampleSplitError, setSampleSplitError] = useState('')
  const [savingSampleSplit, setSavingSampleSplit] = useState(false)
  const [grnFilter, setGrnFilter] = useState('')
  const [poFilter, setPoFilter] = useState('')
  const [arklineProductFilter, setArklineProductFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [regularModelVariantFilter, setRegularModelVariantFilter] = useState('')
  const [regularGradeFilter, setRegularGradeFilter] = useState('')
  const [sampleFilter, setSampleFilter] = useState('')
  const [allTime, setAllTime] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [pauseDetailInspector, setPauseDetailInspector] = useState('')
  const [inspectorDetailSections, setInspectorDetailSections] = useState({
    nonProductive: false,
    finished: false,
    active: false,
  })
  const [rejectDetailSummary, setRejectDetailSummary] = useState(null)
  const [rejectDraftRows, setRejectDraftRows] = useState([])
  const [rejectAdjustmentDraft, setRejectAdjustmentDraft] = useState({
    adjustmentType: 'transfer',
    fromGrade: '',
    toGrade: '',
    affectedGrade: '',
    qty: '',
    notes: '',
  })
  const [expandedRejectReasonRows, setExpandedRejectReasonRows] = useState({})
  const [readOnlyRejectSections, setReadOnlyRejectSections] = useState({
    rejectDetail: false,
    adjustment: false,
    timeline: false,
    inspector: false,
  })
  const [savingRejectDetail, setSavingRejectDetail] = useState(false)

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError('')
    }

    const [
      { data: qcRows, error: qcError },
      { data: arklineRows, error: arklineError },
      { data: confirmRows, error: confirmError },
      { data: returnData, error: returnError },
      { data: memberRows, error: memberError },
      { data: rolePermissionRows, error: rolePermissionError },
      { data: pauseLogRows, error: pauseLogError },
      { data: rejectReasonRows, error: rejectReasonError },
      { data: rejectDetailRows, error: rejectDetailError },
      { data: rejectAdjustmentRows, error: rejectAdjustmentError },
      { data: poItemSizeRows, error: poItemSizeError },
      { data: sampleBreakdownData, error: sampleBreakdownError },
      { data: qcSampleBreakdownData, error: qcSampleBreakdownError },
    ] = await Promise.all([
      supabase
        .from('qc_items')
        .select(`
          *,
          inbound:inbound_id (
            id,
            grn_number
          ),
          inbound_unload:inbound_unload_id (
            id,
            brand_id,
            category_id,
            is_sample,
            model_name,
            variant_name,
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
        .order('created_at', { ascending: false }),
      supabase
        .from('arkline_qc')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('qc_confirm')
        .select(`
          id,
          inbound_id,
          model_name,
          variant_name,
          photo_url,
          qty,
          koli_sequence,
          is_sample,
          grade,
          source_grade,
          is_adjustment,
          adjustment_type,
          created_at,
          inbound:inbound_id (
            id,
            grn_number
          ),
          brands:dir_brands!brand_id (
            id,
            brand_name
          ),
          categories:dir_categories!category_id (
            id,
            category_name,
            full_name
          )
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('warehouse_returns')
        .select(`
          id,
          inbound_id,
          model_name,
          variant_name,
          qty,
          grade,
          is_adjustment,
          adjustment_type,
          created_at,
          source_phase,
          inbound:inbound_id (
            id,
            grn_number
          ),
          brands:dir_brands!brand_id (
            id,
            brand_name
          ),
          categories:dir_categories!category_id (
            id,
            category_name,
            full_name
          )
        `)
        .eq('source_phase', 'qc')
        .order('created_at', { ascending: false }),
      supabase
        .from('dir_user_profiles')
        .select('id, email, display_name, role, is_qc_active, qc_active_date')
        .order('display_name', { ascending: true }),
      supabase.from('dir_user_roles').select('role, permission_code').eq('permission_code', 'qc.grading_task.view'),
      supabase
        .from('qc_pause_logs')
        .select(`
          id,
          qc_item_id,
          arkline_qc_id,
          paused_by,
          pause_reason,
          paused_at,
          resumed_at,
          resumed_by,
          duration_seconds,
          qc_item:qc_item_id (
            id,
            assigned_to,
            inbound:inbound_id (
              id,
              grn_number
            ),
            inbound_unload:inbound_unload_id (
              id,
              brand_id,
              category_id,
              is_sample,
              model_name,
              variant_name,
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
          ),
          arkline_qc:arkline_qc_id (
            id,
            assigned_to,
            po_id,
            sku_induk,
            model_name,
            qc_type
          )
        `)
        .order('paused_at', { ascending: false }),
      supabase
        .from('arkline_qc_reject_reasons')
        .select('id, reason_name, is_active, is_repairable')
        .eq('is_active', true)
        .order('reason_name', { ascending: true }),
      supabase
        .from('arkline_qc_reject_details')
        .select(`
          id,
          arkline_qc_id,
          po_id,
          arkline_po_item_id,
          sku_induk,
          model_name,
          grade,
          size,
          reject_reason_id,
          qty,
          created_at,
          updated_at,
          reason:reject_reason_id (
            id,
            reason_name,
            is_repairable
          )
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('arkline_qc_reject_adjustments')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('arkline_po_item_sizes')
        .select('arkline_po_item_id, size, qty')
        .order('size', { ascending: true }),
      supabase
        .from('inbound_sample_model_breakdowns')
        .select(`
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
          qty
        `)
        .order('created_at', { ascending: true }),
      supabase
        .from('qc_sample_breakdowns')
        .select(`
          id,
          qc_item_id,
          sample_breakdown_id,
          qty_a,
          qty_b,
          qty_c,
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
            qty
          )
        `)
        .order('created_at', { ascending: true }),
    ])

    if (
      qcError ||
      arklineError ||
      confirmError ||
      returnError ||
      memberError ||
      pauseLogError ||
      rolePermissionError ||
      rejectReasonError ||
      rejectDetailError ||
      rejectAdjustmentError ||
      poItemSizeError
    ) {
      setError(
        qcError?.message ||
          arklineError?.message ||
          confirmError?.message ||
          returnError?.message ||
          memberError?.message ||
          pauseLogError?.message ||
          rolePermissionError?.message ||
          rejectReasonError?.message ||
          rejectDetailError?.message ||
          rejectAdjustmentError?.message ||
          poItemSizeError?.message ||
          'Failed to load QC dashboard.'
      )
      if (!silent) setLoading(false)
      return
    }

    const allowedRoles = new Set((rolePermissionRows || []).map((item) => item.role))
    const allProfiles = memberRows || []
    const eligibleMembers = allProfiles.filter(
      (item) =>
        (allowedRoles.has(item.role) || item.role === 'admin' || String(item.email || '').trim().toLowerCase() === ADMIN_EMAIL) &&
        item.is_qc_active === true &&
        getDateOnly(item.qc_active_date) === today
    )

    setQcItems((qcRows || []).map(normalizeQcItemRow))
    setArklineQcItems(arklineRows || [])
    setQcConfirmRows((confirmRows || []).map((row) => ({ ...row, model_color: row.variant_name || row.model_color || '' })))
    setReturnRows((returnData || []).map((row) => ({ ...row, model_color: row.variant_name || row.model_color || '' })))
    setQcMembers(eligibleMembers)
    setQcProfiles(allProfiles)
    setPauseLogs(pauseLogRows || [])
    setArklineRejectReasons(rejectReasonRows || [])
    setArklineRejectDetails(rejectDetailRows || [])
    setArklineRejectAdjustments(rejectAdjustmentRows || [])
    setArklinePoItemSizes(poItemSizeRows || [])
    setSupportsSampleSplit(!sampleBreakdownError && !qcSampleBreakdownError)
    setSampleBreakdownRows(sampleBreakdownError ? [] : sampleBreakdownData || [])
    setQcSampleBreakdownRows(qcSampleBreakdownError ? [] : qcSampleBreakdownData || [])
    if (!silent) setLoading(false)
  }, [today])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockTick(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useRealtimeRefresh({
    supabase,
    topic: 'qc:summary',
    onRefresh: () => loadDashboard(true),
    paused: Boolean(showPauseConfirm || previewPhoto || rejectDetailSummary || pauseDetailInspector || savingRejectDetail),
  })

  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo)
  const matchesRegularFilterValues = useCallback((item, ignoredFilter = '') => {
    const matchesDate = hasInvalidDateRange ? true : isWithinDateRange(getQcWorkDateValue(item), dateFrom, dateTo)
    const matchesGrn = ignoredFilter === 'grn' || !grnFilter || item.inbound?.grn_number === grnFilter
    const matchesBrand = ignoredFilter === 'brand' || !brandFilter || getBrandLabel(item) === brandFilter
    const matchesCategory = ignoredFilter === 'category' || !categoryFilter || getCategoryLabel(item) === categoryFilter
    const matchesModelVariant =
      ignoredFilter === 'modelVariant' ||
      !regularModelVariantFilter ||
      matchesModelVariantSearch(getRegularModelVariantLabel(item), regularModelVariantFilter) ||
      (isTemporarySampleTask(item) &&
        qcSampleBreakdownRows.some((split) => {
          const sourceId = Number(item.inbound_unload_id || item.inbound_unload?.id || 0)
          return (
            (Number(split.qc_item_id || 0) === Number(item.id || 0) ||
              Number(split.sample_breakdown?.inbound_unload_id || 0) === sourceId) &&
            matchesModelVariantSearch(getSampleBreakdownLabel(split.sample_breakdown || {}), regularModelVariantFilter)
          )
        }))
    const matchesSample =
      ignoredFilter === 'sample' ||
      !sampleFilter ||
      (sampleFilter === 'yes' ? isRegularSampleTask(item) : !isRegularSampleTask(item))
    const matchesGrade =
      ignoredFilter === 'grade' ||
      !regularGradeFilter ||
      getRegularGradeQty(item, regularGradeFilter) > 0

    return matchesDate && matchesGrn && matchesBrand && matchesCategory && matchesModelVariant && matchesSample && matchesGrade
  }, [brandFilter, categoryFilter, dateFrom, dateTo, grnFilter, hasInvalidDateRange, qcSampleBreakdownRows, regularGradeFilter, regularModelVariantFilter, sampleFilter])

  const matchesArklineFilterValues = useCallback((item, ignoredFilter = '') => {
    const matchesDate = hasInvalidDateRange ? true : isWithinDateRange(getQcWorkDateValue(item), dateFrom, dateTo)
    const matchesPo = ignoredFilter === 'po' || !poFilter || getArklinePoLabel(item) === poFilter
    const matchesProduct = ignoredFilter === 'product' || !arklineProductFilter || getArklineProductLabel(item) === arklineProductFilter

    return matchesDate && matchesPo && matchesProduct
  }, [arklineProductFilter, dateFrom, dateTo, hasInvalidDateRange, poFilter])

  const grnOptions = useMemo(
    () =>
      Array.from(new Set(qcItems.filter((item) => matchesRegularFilterValues(item, 'grn')).map((item) => item.inbound?.grn_number).filter(Boolean))).sort(
        (a, b) => b.localeCompare(a, undefined, { numeric: true })
      ),
    [matchesRegularFilterValues, qcItems]
  )
  const arklineModeItems = useMemo(
    () =>
      arklineQcItems.filter((item) =>
        qcMode === 're_qc'
          ? String(item.qc_type || 'INITIAL').toUpperCase() === 'RE_QC'
          : String(item.qc_type || 'INITIAL').toUpperCase() !== 'RE_QC'
      ),
    [arklineQcItems, qcMode]
  )
  const poOptions = useMemo(
    () =>
      Array.from(new Set(arklineModeItems.filter((item) => matchesArklineFilterValues(item, 'po')).map((item) => getArklinePoLabel(item)).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, undefined, { numeric: true })
      ),
    [arklineModeItems, matchesArklineFilterValues]
  )
  const arklineProductOptions = useMemo(
    () =>
      Array.from(
        new Set(arklineModeItems.filter((item) => matchesArklineFilterValues(item, 'product')).map((item) => getArklineProductLabel(item)).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [arklineModeItems, matchesArklineFilterValues]
  )
  const brandOptions = useMemo(
    () =>
      Array.from(new Set(qcItems.filter((item) => matchesRegularFilterValues(item, 'brand')).map((item) => getBrandLabel(item)).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [matchesRegularFilterValues, qcItems]
  )
  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(qcItems.filter((item) => matchesRegularFilterValues(item, 'category')).map((item) => getCategoryLabel(item)).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [matchesRegularFilterValues, qcItems]
  )
  const regularGradeOptions = useMemo(() => {
    const grades = new Set()

    qcItems
      .filter((item) => matchesRegularFilterValues(item, 'grade'))
      .forEach((item) => {
        QC_GRADE_OPTIONS.forEach((grade) => {
          if (getRegularGradeQty(item, grade) > 0) grades.add(grade)
        })
      })

    return QC_GRADE_OPTIONS.filter((grade) => grades.has(grade))
  }, [matchesRegularFilterValues, qcItems])
  const hasSpecificSingleDate = Boolean(dateFrom && dateTo && dateFrom === dateTo)
  const canEditArklineRejectDetail = !allTime && hasSpecificSingleDate && !hasInvalidDateRange
  const rejectDetailReadOnlyReason = allTime
    ? 'Reject Detail and Adjustment are read-only when All Time is active. Choose a specific Date From and Date To before editing.'
    : !dateFrom || !dateTo
      ? 'Reject Detail and Adjustment are read-only when only one date is selected. Choose both Date From and Date To before editing.'
      : hasInvalidDateRange
        ? 'Reject Detail and Adjustment are read-only until the date range is valid.'
        : dateFrom !== dateTo
          ? 'Reject Detail and Adjustment are read-only when the date range spans more than one day. Date From and Date To must be the same date before editing.'
          : ''

  const filteredItems = useMemo(
    () => qcItems.filter((item) => matchesRegularFilterValues(item)),
    [matchesRegularFilterValues, qcItems]
  )

  const filteredArklineItems = useMemo(
    () => arklineModeItems.filter((item) => matchesArklineFilterValues(item)),
    [arklineModeItems, matchesArklineFilterValues]
  )

  const filteredAdjustmentRows = useMemo(
    () =>
      qcConfirmRows.filter((item) => {
        if (!item.is_adjustment) {
          return false
        }

        const matchesDate = hasInvalidDateRange ? true : isWithinDateRange(item.created_at, dateFrom, dateTo)
        const matchesGrn = !grnFilter || item.inbound?.grn_number === grnFilter
        const matchesBrand = !brandFilter || getConfirmBrandLabel(item) === brandFilter
        const matchesCategory = !categoryFilter || getConfirmCategoryLabel(item) === categoryFilter
        const matchesModelVariant =
          !regularModelVariantFilter ||
          getRegularModelVariantLabel(item).toUpperCase().includes(String(regularModelVariantFilter || '').trim().toUpperCase())
        const matchesSample =
          !sampleFilter ||
          (sampleFilter === 'yes' ? Boolean(item.is_sample) : !Boolean(item.is_sample))
        const rowGrade = normalizeQcGrade(item.grade)
        const sourceGrade = normalizeQcGrade(item.source_grade, rowGrade)
        const matchesGrade = !regularGradeFilter || rowGrade === regularGradeFilter || sourceGrade === regularGradeFilter
        return matchesDate && matchesGrn && matchesBrand && matchesCategory && matchesModelVariant && matchesSample && matchesGrade
      }),
    [brandFilter, categoryFilter, dateFrom, dateTo, grnFilter, hasInvalidDateRange, qcConfirmRows, regularGradeFilter, regularModelVariantFilter, sampleFilter]
  )

  const filteredReturnAdjustmentRows = useMemo(
    () =>
      returnRows.filter((item) => {
        if (!item.is_adjustment) {
          return false
        }

        const matchesDate = hasInvalidDateRange ? true : isWithinDateRange(item.created_at, dateFrom, dateTo)
        const matchesGrn = !grnFilter || item.inbound?.grn_number === grnFilter
        const matchesBrand = !brandFilter || getReturnBrandLabel(item) === brandFilter
        const matchesCategory = !categoryFilter || getReturnCategoryLabel(item) === categoryFilter
        const matchesModelVariant =
          !regularModelVariantFilter ||
          getRegularModelVariantLabel(item).toUpperCase().includes(String(regularModelVariantFilter || '').trim().toUpperCase())
        const matchesSample =
          !sampleFilter ||
          (sampleFilter === 'yes' ? Boolean(item.is_sample) : !Boolean(item.is_sample))
        const rowGrade = normalizeQcGrade(item.grade)
        const sourceGrade = normalizeQcGrade(item.source_grade, rowGrade)
        const matchesGrade = !regularGradeFilter || rowGrade === regularGradeFilter || sourceGrade === regularGradeFilter
        return matchesDate && matchesGrn && matchesBrand && matchesCategory && matchesModelVariant && matchesSample && matchesGrade
      }),
    [brandFilter, categoryFilter, dateFrom, dateTo, grnFilter, hasInvalidDateRange, regularGradeFilter, regularModelVariantFilter, returnRows, sampleFilter]
  )

  const filteredRegularPauseLogs = useMemo(
    () =>
      pauseLogs.filter((item) => {
        const matchesDate = hasInvalidDateRange ? true : isWithinDateRange(item.paused_at, dateFrom, dateTo)
        const matchesGrn = !grnFilter || item.qc_item?.inbound?.grn_number === grnFilter
        const matchesBrand = !brandFilter || getBrandLabel(item.qc_item || {}) === brandFilter
        const matchesCategory = !categoryFilter || getCategoryLabel(item.qc_item || {}) === categoryFilter
        const matchesModelVariant =
          !regularModelVariantFilter ||
          getRegularModelVariantLabel(item.qc_item || {}).toUpperCase().includes(String(regularModelVariantFilter || '').trim().toUpperCase())
        const matchesSample =
          !sampleFilter ||
          (sampleFilter === 'yes' ? isRegularSampleTask(item.qc_item || {}) : !isRegularSampleTask(item.qc_item || {}))
        const matchesGrade = !regularGradeFilter || getRegularGradeQty(item.qc_item || {}, regularGradeFilter) > 0
        return Boolean(item.qc_item_id) && matchesDate && matchesGrn && matchesBrand && matchesCategory && matchesModelVariant && matchesSample && matchesGrade
      }),
    [brandFilter, categoryFilter, dateFrom, dateTo, grnFilter, hasInvalidDateRange, pauseLogs, regularGradeFilter, regularModelVariantFilter, sampleFilter]
  )

  const filteredArklinePauseLogs = useMemo(
    () =>
      pauseLogs.filter((item) => {
        const matchesDate = hasInvalidDateRange ? true : isWithinDateRange(item.paused_at, dateFrom, dateTo)
        const matchesPo = !poFilter || getPauseLogArklinePoLabel(item) === poFilter
        const matchesProduct = !arklineProductFilter || getPauseLogArklineProductLabel(item) === arklineProductFilter
        const matchesQcType =
          qcMode === 're_qc'
            ? String(item.arkline_qc?.qc_type || 'INITIAL').toUpperCase() === 'RE_QC'
            : String(item.arkline_qc?.qc_type || 'INITIAL').toUpperCase() !== 'RE_QC'
        return Boolean(item.arkline_qc_id) && matchesDate && matchesPo && matchesProduct && matchesQcType
      }),
    [arklineProductFilter, dateFrom, dateTo, hasInvalidDateRange, pauseLogs, poFilter, qcMode]
  )

  const activeItems = useMemo(
    () => (qcMode !== 'regular' ? filteredArklineItems : filteredItems),
    [filteredArklineItems, filteredItems, qcMode]
  )
  const activePauseLogs = useMemo(
    () => (qcMode !== 'regular' ? filteredArklinePauseLogs : filteredRegularPauseLogs),
    [filteredArklinePauseLogs, filteredRegularPauseLogs, qcMode]
  )

  const memberNameMap = useMemo(
    () =>
      qcProfiles.reduce((result, item) => {
        result[String(item.email || '').trim().toLowerCase()] = item.display_name || ''
        return result
      }, {}),
    [qcProfiles]
  )
  const sampleBreakdownsByUnloadId = useMemo(() => {
    const grouped = new Map()

    sampleBreakdownRows.forEach((row) => {
      const unloadId = Number(row.inbound_unload_id || 0)
      if (!unloadId) return

      const current = grouped.get(unloadId) || []
      current.push(row)
      grouped.set(unloadId, current)
    })

    return grouped
  }, [sampleBreakdownRows])
  const qcSampleSplitsByQcItemId = useMemo(() => {
    const grouped = new Map()

    qcSampleBreakdownRows.forEach((row) => {
      const qcItemId = Number(row.qc_item_id || 0)
      if (!qcItemId) return

      const current = grouped.get(qcItemId) || []
      current.push(row)
      grouped.set(qcItemId, current)
    })

    return grouped
  }, [qcSampleBreakdownRows])

  const qcResultSummary = useMemo(() => {
    const grouped = new Map()
    const arklineDetailBySummaryKey = new Map()
    const arklineAdjustmentBySummaryKey = new Map()
    const activeArklineTaskIds = new Set(activeItems.map((item) => String(item.id)))
    const activeArklineCycleIds = new Set(activeItems.map((item) => String(item.qc_cycle_id || '')).filter(Boolean))
    const activeArklineTaskById = new Map(activeItems.map((item) => [String(item.id), item]))
    const activeArklineRoundByCycle = new Map(
      activeItems.map((item) => [String(item.qc_cycle_id || ''), Number(item.qc_round_number || 2)])
    )
    const shouldSeparateSampleSummary = qcMode === 'regular' && sampleFilter === 'yes'

    if (qcMode !== 'regular') {
      arklineRejectDetails
        .filter(
          (detail) =>
            activeArklineTaskIds.has(String(detail.arkline_qc_id))
        )
        .forEach((detail) => {
          const baseKey = getRejectDetailSummaryKey(detail)
          const task = activeArklineTaskById.get(String(detail.arkline_qc_id))
          const key = qcMode === 're_qc' ? `${baseKey}|||ROUND:${Number(task?.qc_round_number || 2)}` : baseKey
          const current = arklineDetailBySummaryKey.get(key) || { qtyB: 0, qtyC: 0 }
          const grade = String(detail.grade || '').toUpperCase()
          if (grade === 'B') current.qtyB += Number(detail.qty || 0)
          if (grade === 'C') current.qtyC += Number(detail.qty || 0)
          arklineDetailBySummaryKey.set(key, current)
        })

      arklineRejectAdjustments
        .filter(
          (adjustment) => {
            const adjustmentCycleId = String(adjustment.qc_cycle_id || '')
            const matchesCycle = activeArklineCycleIds.size
              ? !adjustmentCycleId || activeArklineCycleIds.has(adjustmentCycleId)
              : qcMode === 'arkline'
            const matchesDate = hasInvalidDateRange || isWithinDateRange(getArklineAdjustmentDateValue(adjustment), dateFrom, dateTo)
            return matchesCycle && matchesDate
          }
        )
        .forEach((adjustment) => {
          const baseKey = getAdjustmentSummaryKey(adjustment)
          const key =
            qcMode === 're_qc'
              ? `${baseKey}|||ROUND:${activeArklineRoundByCycle.get(String(adjustment.qc_cycle_id || '')) || 2}`
              : baseKey
          const current = arklineAdjustmentBySummaryKey.get(key) || { rows: [] }
          current.rows.push(adjustment)
          arklineAdjustmentBySummaryKey.set(key, current)
        })
    }

    const processedTemporarySampleSourceIds = new Set()

    activeItems.forEach((item) => {
      const brand = qcMode !== 'regular' ? getArklinePoLabel(item) : getBrandLabel(item)
      const category = qcMode !== 'regular' ? getArklineCategoryLabel(item) : getCategoryLabel(item)
      const taskModel = getTaskModelInfo(item)
      const model = taskModel.model
      const variant = qcMode === 'regular' ? taskModel.variant : ''
      const roundNumber = qcMode === 're_qc' ? Number(item.qc_round_number || 2) : null
      const sampleSourceId = Number(item.inbound_unload_id || item.inbound_unload?.id || 0)
      const isSampleTask = qcMode === 'regular' && isRegularSampleTask(item)
      const isTemporarySample = qcMode === 'regular' && isTemporarySampleTask(item)

      if (isTemporarySample) {
        const sourceTaskRows = activeItems.filter(
          (candidate) =>
            isTemporarySampleTask(candidate) &&
            Number(candidate.inbound_unload_id || candidate.inbound_unload?.id || 0) === sampleSourceId
        )
        const sampleSplitRows = sourceTaskRows.flatMap((task) => qcSampleSplitsByQcItemId.get(Number(task.id || 0)) || [])

        if (!sampleSplitRows.length) {
          // Fall through to the normal summary row until this sample has split data.
        } else if (processedTemporarySampleSourceIds.has(sampleSourceId)) {
          return
        } else {
          processedTemporarySampleSourceIds.add(sampleSourceId)

        let splitQtyA = 0
        let splitQtyB = 0
        let splitQtyC = 0
        const visibleSampleSplitRows = regularModelVariantFilter
          ? sampleSplitRows.filter((split) => matchesModelVariantSearch(getSampleBreakdownLabel(split.sample_breakdown || {}), regularModelVariantFilter))
          : sampleSplitRows

        sampleSplitRows.forEach((split) => {
          splitQtyA += Number(split.qty_a || 0)
          splitQtyB += Number(split.qty_b || 0)
          splitQtyC += Number(split.qty_c || 0)
        })

        visibleSampleSplitRows.forEach((split) => {
          const breakdown = split.sample_breakdown || {}
          const splitModel = breakdown.model_name || 'UNKNOWN MODEL'
          const splitVariant = breakdown.variant_name || ''
          const splitKey = shouldSeparateSampleSummary
            ? `${brand}|||${category}|||${sampleSourceId}|||${splitModel}|||${splitVariant}|||split:${breakdown.id || split.sample_breakdown_id}`
            : `${brand}|||${category}|||${splitModel}|||${splitVariant}`
          const current =
            grouped.get(splitKey) || {
              brand,
              category,
              model: splitModel,
              variant: splitVariant,
              roundNumber,
              photoUrl: breakdown.photo_url || '',
              qtyA: 0,
              qtyB: 0,
              qtyC: 0,
              rejectTargetQty: 0,
              checked: 0,
              taskRows: [],
              hasRejectDetails: false,
              isSampleSummary: shouldSeparateSampleSummary,
              isTemporarySampleSummary: shouldSeparateSampleSummary,
              sampleSourceId: shouldSeparateSampleSummary ? sampleSourceId : null,
            }

          current.qtyA += Number(split.qty_a || 0)
          current.qtyB += Number(split.qty_b || 0)
          current.qtyC += Number(split.qty_c || 0)
          current.checked += Number(split.qty_a || 0) + Number(split.qty_b || 0) + Number(split.qty_c || 0)
          current.photoUrl = current.photoUrl || breakdown.photo_url || ''
          current.taskRows.push(...sourceTaskRows)
          grouped.set(splitKey, current)
        })

        const sourceQtyA = sourceTaskRows.reduce((sum, task) => sum + Number(task.qty_a || 0), 0)
        const sourceQtyB = sourceTaskRows.reduce((sum, task) => sum + Number(task.qty_b || 0), 0)
        const sourceQtyC = sourceTaskRows.reduce((sum, task) => sum + Number(task.qty_c || 0), 0)
        const residualQtyA = Math.max(0, sourceQtyA - splitQtyA)
        const residualQtyB = Math.max(0, sourceQtyB - splitQtyB)
        const residualQtyC = Math.max(0, sourceQtyC - splitQtyC)
        const residualMatchesModelVariant = matchesModelVariantSearch('TEMPORARY SAMPLE - TEMPORARY', regularModelVariantFilter)

        if ((residualQtyA || residualQtyB || residualQtyC) && residualMatchesModelVariant) {
          const residualKey = shouldSeparateSampleSummary
            ? `${brand}|||${category}|||${sampleSourceId}|||TEMPORARY SAMPLE|||TEMPORARY`
            : `${brand}|||${category}|||TEMPORARY SAMPLE|||TEMPORARY`
          const current =
            grouped.get(residualKey) || {
              brand,
              category,
              model: 'TEMPORARY SAMPLE',
              variant: 'TEMPORARY',
              roundNumber,
              photoUrl: taskModel.photoUrl,
              qtyA: 0,
              qtyB: 0,
              qtyC: 0,
              rejectTargetQty: 0,
              checked: 0,
              taskRows: [],
              hasRejectDetails: false,
              isSampleSummary: shouldSeparateSampleSummary,
              isTemporarySampleSummary: shouldSeparateSampleSummary,
              sampleSourceId: shouldSeparateSampleSummary ? sampleSourceId : null,
            }

          current.qtyA += residualQtyA
          current.qtyB += residualQtyB
          current.qtyC += residualQtyC
          current.rejectTargetQty += residualQtyB + residualQtyC
          current.checked += residualQtyA + residualQtyB + residualQtyC
          current.taskRows.push(...sourceTaskRows)
          grouped.set(residualKey, current)
        }

        return
        }
      }

      const baseKey = qcMode === 'regular'
        ? isSampleTask && shouldSeparateSampleSummary
          ? `${brand}|||${category}|||${sampleSourceId}|||${model}|||${variant}`
          : `${brand}|||${category}|||${model}|||${variant}`
        : getSummaryRejectKey({ brand, category, model })
      const key = qcMode === 're_qc' ? `${baseKey}|||ROUND:${roundNumber}` : baseKey
      const current =
        grouped.get(key) || {
          brand,
          category,
          model,
          variant,
          roundNumber,
          photoUrl: taskModel.photoUrl,
          qtyA: 0,
          qtyB: 0,
          qtyC: 0,
          rejectTargetQty: 0,
          checked: 0,
          taskRows: [],
          hasRejectDetails: false,
          isSampleSummary: isSampleTask && shouldSeparateSampleSummary,
          isTemporarySampleSummary: isTemporarySample && shouldSeparateSampleSummary,
          sampleSourceId: isSampleTask && shouldSeparateSampleSummary ? sampleSourceId : null,
        }

      current.qtyA += Number(item.qty_a || 0)
      current.qtyB += Number(item.qty_b || 0)
      current.qtyC += Number(item.qty_c || 0)
      current.rejectTargetQty += getRejectQty(item)
      current.checked += getCheckedQty(item)
      current.photoUrl = current.photoUrl || taskModel.photoUrl
      if (qcMode !== 'regular' || isSampleTask) current.taskRows.push(item)
      grouped.set(key, current)
    })

    if (qcMode !== 'regular') {
      grouped.forEach((current, key) => {
        const detailSummary = arklineDetailBySummaryKey.get(key)
        const adjustment = arklineAdjustmentBySummaryKey.get(key)

        if (detailSummary) {
          current.hasRejectDetails = true
        }

        if (adjustment) {
          const adjustedTotals = applyArklineAdjustmentsToGradeTotals(current.qtyA, current.qtyB, current.qtyC, adjustment.rows)

          current.qtyA = adjustedTotals.qtyA
          current.qtyB = adjustedTotals.qtyB
          current.qtyC = adjustedTotals.qtyC
        }

        current.checked = current.qtyA + current.qtyB + current.qtyC
      })
    }

    if (qcMode === 'regular') {
      const regularBaseTotalsByKey = new Map()
      grouped.forEach((current, key) => {
        regularBaseTotalsByKey.set(key, {
          A: Number(current.qtyA || 0),
          B: Number(current.qtyB || 0),
          C: Number(current.qtyC || 0),
        })
      })

      const chronologicalConfirmRows = [...qcConfirmRows].sort(compareQcPostingRows)

      const getRegularSummaryParts = (item, brand, category) => {
        const model = item.model_name || 'UNKNOWN MODEL'
        const variant = item.model_color || item.variant_name || ''
        return {
          brand,
          category,
          model,
          variant,
          key: `${brand}|||${category}|||${model}|||${variant}`,
        }
      }

      const getConfirmSummaryParts = (item) => getRegularSummaryParts(item, getConfirmBrandLabel(item), getConfirmCategoryLabel(item))
      const getReturnSummaryParts = (item) => getRegularSummaryParts(item, getReturnBrandLabel(item), getReturnCategoryLabel(item))

      const getOrCreateRegularSummary = (parts, photoUrl = '') => {
        const current =
          grouped.get(parts.key) || {
            brand: parts.brand,
            category: parts.category,
            model: parts.model,
            variant: parts.variant,
            photoUrl,
            qtyA: 0,
            qtyB: 0,
            qtyC: 0,
            rejectTargetQty: 0,
            checked: 0,
            taskRows: [],
            hasRejectDetails: false,
          }

        current.photoUrl = current.photoUrl || photoUrl || ''
        return current
      }

      const getGradeField = (grade) => {
        if (grade === 'A') return 'qtyA'
        if (grade === 'B') return 'qtyB'
        if (grade === 'C') return 'qtyC'
        return ''
      }

      const addRegularGradeQty = (current, grade, rawQty) => {
        const field = getGradeField(grade)
        const qty = Math.max(0, Number(rawQty || 0))
        if (!field || !qty) return 0

        current[field] += qty
        return qty
      }

      const reduceRegularGradeQty = (current, grade, rawQty) => {
        const field = getGradeField(grade)
        const qty = Math.max(0, Number(rawQty || 0))
        if (!field || !qty) return 0

        const appliedQty = Math.min(Number(current[field] || 0), qty)
        current[field] -= appliedQty
        return appliedQty
      }

      const moveRegularGradeQty = (current, fromGrade, toGrade, rawQty) => {
        const sourceGrade = normalizeQcGrade(fromGrade)
        const targetGrade = normalizeQcGrade(toGrade)
        const qty = Math.max(0, Number(rawQty || 0))
        if (!sourceGrade || !targetGrade || sourceGrade === targetGrade || !qty) return

        const appliedQty = reduceRegularGradeQty(current, sourceGrade, qty)
        addRegularGradeQty(current, targetGrade, appliedQty)
      }

      const getRegularPendingBeforeConfirmRow = (targetItem, targetKey, targetGrade) => {
        const baseTotals = regularBaseTotalsByKey.get(targetKey) || { A: 0, B: 0, C: 0 }
        let sourceQty = Number(baseTotals[targetGrade] || 0)
        let confirmedQty = 0
        let shortageQty = 0
        const targetId = String(targetItem.id || '')
        const targetInboundId = Number(targetItem.inbound_id || 0)
        const targetIsSample = Boolean(targetItem.is_sample)
        const getPendingQty = () => Math.max(0, sourceQty - confirmedQty - shortageQty)

        for (const row of chronologicalConfirmRows) {
          if (targetInboundId && Number(row.inbound_id || 0) !== targetInboundId) continue
          if (sampleFilter && Boolean(row.is_sample) !== targetIsSample) continue

          const rowParts = getConfirmSummaryParts(row)
          if (rowParts.key !== targetKey) continue

          if (targetId && String(row.id || '') === targetId) {
            return getPendingQty()
          }

          if (targetId && String(row.id || '') !== targetId && compareQcPostingRows(row, targetItem) > 0) {
            break
          }

          const rowType = getVerificationAdjustmentType(row)
          const rowGrade = normalizeQcGrade(row.grade, 'A')
          const rowSourceGrade = normalizeQcGrade(row.source_grade, rowGrade)
          const rowQty = Math.max(0, Number(row.qty || 0))

          if (!rowQty) {
            continue
          }

          if (rowType === 'TRANSFER') {
            if (rowGrade === targetGrade) {
              if (rowSourceGrade !== rowGrade) {
                sourceQty += rowQty
              }
              confirmedQty += rowQty
            } else if (rowSourceGrade === targetGrade) {
              confirmedQty += rowQty
            }
          } else if (rowType === 'SHORTAGE') {
            if (rowGrade === targetGrade) {
              const reductionQty = Math.max(0, getPendingQty() - rowQty)
              confirmedQty += rowQty
              shortageQty += reductionQty
            }
          } else if (rowType === 'SURPLUS' || rowType === 'REJECTION_MANUAL') {
            if (rowGrade === targetGrade) {
              sourceQty += rowType === 'SURPLUS' ? Math.max(0, rowQty - getPendingQty()) : rowQty
              confirmedQty += rowQty
            }
          } else if (rowGrade === targetGrade) {
            confirmedQty += rowQty
          }
        }

        return getPendingQty()
      }

      filteredAdjustmentRows.forEach((item) => {
        const parts = getConfirmSummaryParts(item)
        const current = getOrCreateRegularSummary(parts, item.photo_url || '')
        const grade = normalizeQcGrade(item.grade, 'A')
        const type = getVerificationAdjustmentType(item)
        const qty = Math.max(0, Number(item.qty || 0))

        if (!qty) {
          grouped.set(parts.key, current)
          return
        }

        if (type === 'TRANSFER') {
          moveRegularGradeQty(current, normalizeQcGrade(item.source_grade, grade), grade, qty)
        } else if (type === 'SHORTAGE') {
          reduceRegularGradeQty(current, grade, Math.max(0, getRegularPendingBeforeConfirmRow(item, parts.key, grade) - qty))
        } else if (type === 'SURPLUS') {
          addRegularGradeQty(current, grade, Math.max(0, qty - getRegularPendingBeforeConfirmRow(item, parts.key, grade)))
        } else {
          addRegularGradeQty(current, grade, qty)
        }

        grouped.set(parts.key, current)
      })

      filteredReturnAdjustmentRows.forEach((item) => {
        const parts = getReturnSummaryParts(item)
        const current = getOrCreateRegularSummary(parts, '')
        const grade = normalizeQcGrade(item.grade, 'A')
        const qty = Math.max(0, Number(item.qty || 0))

        addRegularGradeQty(current, grade, qty)
        grouped.set(parts.key, current)
      })
    }

    if (qcMode === 'regular') {
      grouped.forEach((current) => {
        current.checked = current.qtyA + current.qtyB + current.qtyC
      })
    }

    return Array.from(grouped.values())
      .filter((item) => qcMode !== 'regular' || !regularGradeFilter || getSummaryGradeQty(item, regularGradeFilter) > 0)
      .sort((a, b) => {
        if (a.brand !== b.brand) return a.brand.localeCompare(b.brand)
        if (a.category !== b.category) return a.category.localeCompare(b.category)
        if (a.model !== b.model) return a.model.localeCompare(b.model)
        return String(a.variant || '').localeCompare(String(b.variant || ''))
      })
  }, [
    activeItems,
    arklineRejectAdjustments,
    arklineRejectDetails,
    dateFrom,
    dateTo,
    filteredAdjustmentRows,
    filteredReturnAdjustmentRows,
    hasInvalidDateRange,
    qcConfirmRows,
    qcMode,
    qcSampleSplitsByQcItemId,
    regularGradeFilter,
    regularModelVariantFilter,
    sampleFilter,
  ])

  const selectedRejectTaskRows = useMemo(
    () =>
      rejectDetailSummary
        ? (rejectDetailSummary.taskRows?.length ? rejectDetailSummary.taskRows : activeItems.filter((item) => isTaskInSummary(item, rejectDetailSummary)))
        : [],
    [activeItems, rejectDetailSummary]
  )
  const selectedRejectTaskIds = useMemo(
    () => new Set(selectedRejectTaskRows.map((item) => String(item.id))),
    [selectedRejectTaskRows]
  )
  const selectedRejectTaskById = useMemo(
    () => new Map(selectedRejectTaskRows.map((item) => [String(item.id), item])),
    [selectedRejectTaskRows]
  )
  const selectedRejectSummaryKey = useMemo(
    () => (rejectDetailSummary ? getSummaryRejectKey(rejectDetailSummary) : ''),
    [rejectDetailSummary]
  )
  const selectedRejectExistingDetails = useMemo(
    () =>
      arklineRejectDetails.filter((item) => {
        const matchesSummary = selectedRejectTaskIds.size
          ? selectedRejectTaskIds.has(String(item.arkline_qc_id))
          : getRejectDetailSummaryKey(item) === selectedRejectSummaryKey
        const matchesDate = selectedRejectTaskIds.size
          ? true
          : hasInvalidDateRange || isWithinDateRange(item.created_at || item.updated_at, dateFrom, dateTo)
        return matchesSummary && matchesDate
      }),
    [arklineRejectDetails, dateFrom, dateTo, hasInvalidDateRange, selectedRejectSummaryKey, selectedRejectTaskIds]
  )
  const selectedRejectExistingAdjustments = useMemo(() => {
    if (!rejectDetailSummary) return []

    const summaryParts = getSummaryTaskKeyParts(rejectDetailSummary)
    const selectedCycleIds = new Set(selectedRejectTaskRows.map((item) => String(item.qc_cycle_id || '')).filter(Boolean))

    return arklineRejectAdjustments
      .filter((item) => {
        const samePo = String(item.po_id || 'NO PO').trim().toUpperCase() === summaryParts.brand
        const sameSku = String(item.sku_induk || 'NO SKU').trim().toUpperCase() === summaryParts.category
        const sameModel = String(item.model_name || '').trim().toUpperCase() === summaryParts.model
        const adjustmentCycleId = String(item.qc_cycle_id || '')
        const sameCycle = selectedCycleIds.size
          ? !adjustmentCycleId || selectedCycleIds.has(adjustmentCycleId)
          : !adjustmentCycleId
        return samePo && sameSku && sameModel && sameCycle
      })
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
  }, [arklineRejectAdjustments, rejectDetailSummary, selectedRejectTaskRows])
  const selectedRejectApplicableAdjustments = useMemo(
    () =>
      selectedRejectExistingAdjustments.filter(
        (item) => allTime || hasInvalidDateRange || isWithinDateRange(getArklineAdjustmentDateValue(item), dateFrom, dateTo)
      ),
    [allTime, dateFrom, dateTo, hasInvalidDateRange, selectedRejectExistingAdjustments]
  )
  const selectedRejectReasonOptions = useMemo(() => {
    const grouped = new Map()

    arklineRejectReasons.forEach((item) => {
      grouped.set(item.id, item)
    })

    selectedRejectExistingDetails.forEach((item) => {
      if (item.reject_reason_id && item.reason?.reason_name) {
        grouped.set(item.reject_reason_id, {
          id: item.reject_reason_id,
          reason_name: item.reason.reason_name,
          is_repairable: item.reason.is_repairable === true,
          is_active: true,
        })
      }
    })

    return Array.from(grouped.values()).sort((a, b) => a.reason_name.localeCompare(b.reason_name))
  }, [arklineRejectReasons, selectedRejectExistingDetails])
  const selectedRejectReasonNameById = useMemo(
    () =>
      new Map(
        selectedRejectReasonOptions.map((item) => [
          String(item.id || ''),
          String(item.reason_name || '').trim().toUpperCase(),
        ])
      ),
    [selectedRejectReasonOptions]
  )
  const selectedRejectReasonRepairableById = useMemo(
    () =>
      new Map(
        selectedRejectReasonOptions.map((item) => [
          String(item.id || ''),
          item.is_repairable === true,
        ])
      ),
    [selectedRejectReasonOptions]
  )
  const displayRejectDraftRows = useMemo(
    () =>
      canEditArklineRejectDetail
        ? rejectDraftRows
        : [...rejectDraftRows].sort((a, b) => compareRejectDetailRows(a, b, selectedRejectReasonNameById)),
    [canEditArklineRejectDetail, rejectDraftRows, selectedRejectReasonNameById]
  )
  const selectedRejectSortedExistingDetails = useMemo(
    () => [...selectedRejectExistingDetails].sort((a, b) => compareRejectDetailRows(a, b, selectedRejectReasonNameById)),
    [selectedRejectExistingDetails, selectedRejectReasonNameById]
  )
  const selectedRejectDetailQty = rejectDraftRows.reduce(
    (sum, item) => sum + (hasResolvableRejectDraftReason(item) ? Number(item.qty || 0) : 0),
    0
  )
  const selectedRejectAdjustedBaseSummary = useMemo(() => {
    const baseQtyA = selectedRejectTaskRows.reduce((sum, item) => sum + Number(item.qty_a || 0), 0)
    const baseQtyB = selectedRejectTaskRows.reduce((sum, item) => sum + Number(item.qty_b || 0), 0)
    const baseQtyC = selectedRejectTaskRows.reduce((sum, item) => sum + Number(item.qty_c || 0), 0)

    return applyArklineAdjustmentsToGradeTotals(baseQtyA, baseQtyB, baseQtyC, selectedRejectApplicableAdjustments)
  }, [selectedRejectApplicableAdjustments, selectedRejectTaskRows])
  const selectedRejectExpectedRejectQty = selectedRejectAdjustedBaseSummary.qtyB + selectedRejectAdjustedBaseSummary.qtyC
  const selectedRejectGap = selectedRejectExpectedRejectQty - selectedRejectDetailQty
  const readOnlyRejectReasonSourceRows = useMemo(() => {
    const detailQtyByTaskGrade = new Map()

    selectedRejectSortedExistingDetails.forEach((item) => {
      const taskId = String(item.arkline_qc_id || '')
      const grade = String(item.grade || '').trim().toUpperCase()
      if (!taskId || (grade !== 'B' && grade !== 'C')) return

      const key = `${taskId}|||${grade}`
      detailQtyByTaskGrade.set(key, Number(detailQtyByTaskGrade.get(key) || 0) + Number(item.qty || 0))
    })

    const detailQtyB = selectedRejectSortedExistingDetails
      .filter((item) => String(item.grade || '').trim().toUpperCase() === 'B')
      .reduce((sum, item) => sum + Number(item.qty || 0), 0)
    const detailQtyC = selectedRejectSortedExistingDetails
      .filter((item) => String(item.grade || '').trim().toUpperCase() === 'C')
      .reduce((sum, item) => sum + Number(item.qty || 0), 0)
    const missingQtyB = Math.max(0, Number(selectedRejectAdjustedBaseSummary.qtyB || 0) - detailQtyB)
    const missingQtyC = Math.max(0, Number(selectedRejectAdjustedBaseSummary.qtyC || 0) - detailQtyC)
    const missingRows = []
    const sourceBuckets = []

    selectedRejectTaskRows.forEach((item) => {
      const taskId = String(item.id || '')
      if (!taskId) return

      const gradeSources = [
        { grade: 'B', qty: Number(item.qty_b || 0) },
        { grade: 'C', qty: Number(item.qty_c || 0) },
      ]

      gradeSources.forEach((source) => {
        const detailQty = Number(detailQtyByTaskGrade.get(`${taskId}|||${source.grade}`) || 0)
        const availableQty = Math.max(0, source.qty - detailQty)
        if (availableQty <= 0) return

        sourceBuckets.push({
          taskId,
          grade: source.grade,
          qty: availableQty,
          dateKey: getDateOnly(getQcWorkDateValue(item)) || '',
        })
      })
    })

    sourceBuckets.sort((a, b) => {
      const dateCompare = String(a.dateKey || '').localeCompare(String(b.dateKey || ''), undefined, { numeric: true })
      if (dateCompare !== 0) return dateCompare
      return String(a.taskId).localeCompare(String(b.taskId), undefined, { numeric: true })
    })

    const addUnassignedRows = (grade, targetQty) => {
      let remainingQty = Number(targetQty || 0)
      if (remainingQty <= 0) return

      sourceBuckets
        .filter((item) => item.grade === grade)
        .forEach((bucket) => {
          if (remainingQty <= 0) return

          const qty = Math.min(bucket.qty, remainingQty)
          missingRows.push({
            id: `unassigned-${grade.toLowerCase()}-${bucket.taskId}`,
            arkline_qc_id: bucket.taskId,
            grade,
            qty,
            size: '-',
            reasonName: 'BELUM DIKATEGORIKAN',
            reason: { reason_name: 'BELUM DIKATEGORIKAN', is_repairable: false },
          })
          remainingQty -= qty
      })

      if (remainingQty > 0) {
        const fallbackTask =
          selectedRejectTaskRows.find((item) => Number(grade === 'B' ? item.qty_b || 0 : item.qty_c || 0) > 0) ||
          selectedRejectTaskRows[0]

        missingRows.push({
          id: `unassigned-${grade.toLowerCase()}-fallback`,
          arkline_qc_id: fallbackTask?.id || null,
          grade,
          qty: remainingQty,
          size: '-',
          reasonName: 'BELUM DIKATEGORIKAN',
          reason: { reason_name: 'BELUM DIKATEGORIKAN', is_repairable: false },
          created_at: fallbackTask ? getQcWorkDateValue(fallbackTask) : null,
        })
      }
    }

    addUnassignedRows('B', missingQtyB)
    addUnassignedRows('C', missingQtyC)

    return [...selectedRejectSortedExistingDetails, ...missingRows]
  }, [selectedRejectAdjustedBaseSummary.qtyB, selectedRejectAdjustedBaseSummary.qtyC, selectedRejectSortedExistingDetails, selectedRejectTaskRows])
  const readOnlyRejectReasonSummaryRows = useMemo(
    () =>
      buildReadOnlyRejectReasonSummaryRows(
        readOnlyRejectReasonSourceRows,
        selectedRejectReasonNameById,
        selectedRejectReasonRepairableById,
        selectedRejectTaskById
      ),
    [readOnlyRejectReasonSourceRows, selectedRejectReasonNameById, selectedRejectReasonRepairableById, selectedRejectTaskById]
  )
  const repairableRejectReasonSummaryRows = useMemo(
    () => readOnlyRejectReasonSummaryRows.filter((item) => item.isRepairable),
    [readOnlyRejectReasonSummaryRows]
  )
  const unrepairableRejectReasonSummaryRows = useMemo(
    () => readOnlyRejectReasonSummaryRows.filter((item) => !item.isRepairable),
    [readOnlyRejectReasonSummaryRows]
  )
  const selectedRejectPreviewSummary = useMemo(() => {
    if (!canEditArklineRejectDetail) {
      return selectedRejectAdjustedBaseSummary
    }

    const draftQtyB = rejectDraftRows
      .filter((item) => String(item.grade || '').toUpperCase() === 'B')
      .reduce((sum, item) => sum + Number(item.qty || 0), 0)
    const draftQtyC = rejectDraftRows
      .filter((item) => String(item.grade || '').toUpperCase() === 'C')
      .reduce((sum, item) => sum + Number(item.qty || 0), 0)
    const hasDraftRejectRows = rejectDraftRows.some((item) => Number(item.qty || 0) > 0)
    const adjustedPreviewTotal =
      selectedRejectAdjustedBaseSummary.qtyA + selectedRejectAdjustedBaseSummary.qtyB + selectedRejectAdjustedBaseSummary.qtyC

    return {
      qtyA: hasDraftRejectRows ? Math.max(0, adjustedPreviewTotal - draftQtyB - draftQtyC) : selectedRejectAdjustedBaseSummary.qtyA,
      qtyB: hasDraftRejectRows ? draftQtyB : selectedRejectAdjustedBaseSummary.qtyB,
      qtyC: hasDraftRejectRows ? draftQtyC : selectedRejectAdjustedBaseSummary.qtyC,
    }
  }, [canEditArklineRejectDetail, rejectDraftRows, selectedRejectAdjustedBaseSummary])
  const selectedRejectPreviewChecked =
    selectedRejectPreviewSummary.qtyA + selectedRejectPreviewSummary.qtyB + selectedRejectPreviewSummary.qtyC
  const selectedRejectSizeOptions = useMemo(() => {
    const poItemIds = new Set(selectedRejectTaskRows.map((item) => item.arkline_po_item_id).filter(Boolean))
    const sizes = arklinePoItemSizes
      .filter((item) => poItemIds.has(item.arkline_po_item_id))
      .map((item) => String(item.size || '').trim())
      .filter(Boolean)

    return Array.from(new Set(sizes)).sort(compareApparelSize)
  }, [arklinePoItemSizes, selectedRejectTaskRows])
  const selectedRejectInspectorRows = useMemo(() => {
    const grouped = new Map()

    selectedRejectTaskRows.forEach((item) => {
      const inspectorKey = String(item.assigned_to || '-').trim().toLowerCase() || '-'
      const current = grouped.get(inspectorKey) || {
        inspectorKey,
        inspector: memberNameMap[inspectorKey] || (inspectorKey === '-' ? 'Unassigned' : String(item.assigned_to || inspectorKey)),
        qtyA: 0,
        qtyB: 0,
        qtyC: 0,
        checked: 0,
      }

      current.qtyA += Number(item.qty_a || 0)
      current.qtyB += Number(item.qty_b || 0)
      current.qtyC += Number(item.qty_c || 0)
      current.checked += getCheckedQty(item)
      grouped.set(inspectorKey, current)
    })

    return Array.from(grouped.values()).sort((a, b) => a.inspector.localeCompare(b.inspector))
  }, [memberNameMap, selectedRejectTaskRows])
  const readOnlyRejectTimelineRows = useMemo(() => {
    const grouped = new Map()

    selectedRejectTaskRows.forEach((item) => {
      const dateKey = getDateOnly(getQcWorkDateValue(item)) || 'unknown'
      const current =
        grouped.get(dateKey) || {
          dateKey,
          qtyA: 0,
          qtyB: 0,
          qtyC: 0,
          checked: 0,
          rows: 0,
        }

      current.qtyA += Number(item.qty_a || 0)
      current.qtyB += Number(item.qty_b || 0)
      current.qtyC += Number(item.qty_c || 0)
      current.checked += getCheckedQty(item)
      current.rows += 1
      grouped.set(dateKey, current)
    })

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.dateKey === 'unknown') return 1
      if (b.dateKey === 'unknown') return -1
      return b.dateKey.localeCompare(a.dateKey)
    })
  }, [selectedRejectTaskRows])
  const inspectorPerformance = useMemo(() => {
    const grouped = new Map()

    activeItems.forEach((item) => {
      if (!shouldIncludePerformanceBreakdownItem(item, qcMode)) return

      const key = item.assigned_to || '-'
      const totalPcs = getCheckedQty(item)
      const tracksTiming = shouldTrackQcTiming(item, qcMode)
      const minutes = tracksTiming ? Number(item.stopwatch_seconds || 0) / 60 : 0
      const startedAtMs = item.started_at ? new Date(item.started_at).getTime() : null
      const liveSeconds =
        tracksTiming && item.status === 'in_progress' && startedAtMs
          ? Number(item.stopwatch_seconds || 0) + Math.max(0, Math.floor((clockTick - startedAtMs) / 1000))
          : 0
      const workDate = String(item.finished_at || item.created_at || '').slice(0, 10)
      const current =
        grouped.get(key) || {
          inspector: key,
          totalPcs: 0,
          timedPcs: 0,
          totalMinutes: 0,
          daySet: new Set(),
          avgPerDay: 0,
          rate: 0,
          nonProductiveSeconds: 0,
          pauseLogs: [],
          completedTaskRows: [],
          activeTaskRows: [],
          activeTaskCount: 0,
          activeAllocatedQty: 0,
          activeLiveSeconds: 0,
          runningTaskCount: 0,
        }

      if (item.status === 'done' || hasQcResult(item)) {
        current.totalPcs += totalPcs
        if (tracksTiming) {
          current.timedPcs += totalPcs
          current.totalMinutes += minutes
        }
        if (workDate) current.daySet.add(workDate)
        current.completedTaskRows.push({
          id: item.id,
          source: qcMode !== 'regular' ? getArklinePoLabel(item) : item.inbound?.grn_number || '-',
          category: qcMode !== 'regular' ? getArklineCategoryLabel(item) : getCategoryLabel(item),
          model: qcMode === 'regular' ? getRegularModelVariantLabel(item) : getTaskModelInfo(item).model,
          qtyA: Number(item.qty_a || 0),
          qtyB: Number(item.qty_b || 0),
          qtyC: Number(item.qty_c || 0),
          checkedQty: totalPcs,
          seconds: tracksTiming ? Number(item.stopwatch_seconds || 0) : null,
          rate: tracksTiming && minutes > 0 ? Math.round((totalPcs / minutes) * 100) / 100 : null,
          status: item.status || '-',
          finishedAt: item.finished_at || item.updated_at || item.created_at || '',
          isSample: isRegularSampleTask(item),
        })
      }

      if (item.status !== 'done') {
        current.activeTaskCount += 1
        current.activeAllocatedQty += Number(item.allocated_qty || 0)
        current.activeLiveSeconds += liveSeconds
        if (tracksTiming && item.status === 'in_progress') current.runningTaskCount += 1
        current.activeTaskRows.push({
          id: item.id,
          source: qcMode !== 'regular' ? getArklinePoLabel(item) : item.inbound?.grn_number || '-',
          category: qcMode !== 'regular' ? getArklineCategoryLabel(item) : getCategoryLabel(item),
          model: qcMode === 'regular' ? getRegularModelVariantLabel(item) : getTaskModelInfo(item).model,
          allocatedQty: Number(item.allocated_qty || 0),
          checkedQty: totalPcs,
          remainingQty: Math.max(0, Number(item.allocated_qty || 0) - Number(item.locked_qty || 0)),
          status: item.status || '-',
          isSample: isRegularSampleTask(item),
        })
      }

      grouped.set(key, current)
    })

    activePauseLogs.forEach((item) => {
      if (qcMode === 'regular' && isRegularSampleTask(item.qc_item || {})) return

      const key = getPauseLogAssignedTo(item)
      const current =
        grouped.get(key) || {
          inspector: key,
          totalPcs: 0,
          timedPcs: 0,
          totalMinutes: 0,
          daySet: new Set(),
          avgPerDay: 0,
          rate: 0,
          nonProductiveSeconds: 0,
          pauseLogs: [],
          taskRows: [],
        }

      current.nonProductiveSeconds += getPauseDurationSeconds(item)
      current.pauseLogs.push(item)
      grouped.set(key, current)
    })

    return Array.from(grouped.values()).map((item) => {
      const dayCount = item.daySet.size || 1
      const inspectorName = memberNameMap[item.inspector] || (item.inspector === '-' ? 'Unassigned' : 'Unknown Inspector')
      return {
        inspector: inspectorName,
        inspectorKey: item.inspector,
        totalPcs: item.totalPcs,
        avgPerDay: Math.round((item.totalPcs / dayCount) * 100) / 100,
          rate: item.totalMinutes > 0 ? Math.round((Number(item.timedPcs || 0) / item.totalMinutes) * 100) / 100 : 0,
          nonProductiveHours: formatMinutes(item.nonProductiveSeconds),
          pauseLogs: [...(item.pauseLogs || [])].sort((a, b) => new Date(b.paused_at || 0).getTime() - new Date(a.paused_at || 0).getTime()),
          completedTaskRows: [...(item.completedTaskRows || [])].sort(
            (a, b) => new Date(b.finishedAt || 0).getTime() - new Date(a.finishedAt || 0).getTime()
          ),
          activeTaskRows: [...(item.activeTaskRows || [])].sort((a, b) => String(a.status || '').localeCompare(String(b.status || ''))),
          activeTaskCount: item.activeTaskCount,
          activeAllocatedQty: item.activeAllocatedQty,
          activeLiveSeconds: item.activeLiveSeconds,
          runningTaskCount: item.runningTaskCount,
        }
      })
  }, [activeItems, activePauseLogs, clockTick, memberNameMap, qcMode])

  const productThroughputRows = useMemo(() => {
    const grouped = new Map()

    activeItems
      .filter(
        (item) =>
          (item.status === 'done' || hasQcResult(item)) &&
          shouldIncludePerformanceBreakdownItem(item, qcMode) &&
          shouldTrackQcTiming(item, qcMode)
      )
      .forEach((item) => {
        const categoryLabel =
          qcMode !== 'regular'
            ? getArklineCategoryLabel(item)
            : item.inbound_unload?.categories?.full_name || item.inbound_unload?.categories?.category_name || 'UNCATEGORIZED'
        const productLabel = qcMode === 'regular' ? getRegularModelVariantLabel(item) || 'UNKNOWN PRODUCT' : getTaskModelInfo(item).model || 'UNKNOWN PRODUCT'
        const key = qcMode === 'regular' ? categoryLabel : `${categoryLabel}|||${productLabel}`
        const checkedQty = getCheckedQty(item)
        const current =
          grouped.get(key) || {
            category: categoryLabel,
            label: qcMode === 'regular' ? categoryLabel : productLabel,
            totalSeconds: 0,
            totalPcs: 0,
          }
        current.totalSeconds += Number(item.stopwatch_seconds || 0)
        current.totalPcs += checkedQty
        grouped.set(key, current)
      })

    const rows = Array.from(grouped.values()).map((item) => ({
      category: item.category,
      label: item.label,
      totalSeconds: item.totalSeconds,
      totalPcs: item.totalPcs,
      secondsPerPcs: item.totalPcs ? Math.round((item.totalSeconds / item.totalPcs) * 100) / 100 : 0,
    }))

    if (qcMode === 'regular') {
      const totalSeconds = rows.reduce((sum, item) => sum + Number(item.totalSeconds || 0), 0)
      const totalPcs = rows.reduce((sum, item) => sum + Number(item.totalPcs || 0), 0)
      const averageSeconds = totalPcs ? Math.round((totalSeconds / totalPcs) * 100) / 100 : 0

      return rows.map((item) => ({
        ...item,
        categoryAverageSeconds: averageSeconds,
      }))
    }

    const categoryAverageMap = new Map()
    rows.forEach((item) => {
      const current = categoryAverageMap.get(item.category) || { totalSecondsPerPcs: 0, count: 0 }
      current.totalSecondsPerPcs += Number(item.secondsPerPcs || 0)
      current.count += 1
      categoryAverageMap.set(item.category, current)
    })

    return rows.map((item) => {
      const categoryAverage = categoryAverageMap.get(item.category)
      return {
        ...item,
        categoryAverageSeconds: categoryAverage?.count ? Math.round((categoryAverage.totalSecondsPerPcs / categoryAverage.count) * 100) / 100 : 0,
      }
    })
  }, [activeItems, qcMode])

  const totalAllocated = activeItems.reduce((sum, item) => sum + Number(item.allocated_qty || 0), 0)
  const totalLocked = activeItems.reduce((sum, item) => sum + Number(item.locked_qty || 0), 0)
  const totalChecked = qcResultSummary.reduce((sum, item) => sum + Number(item.checked || 0), 0)
  const totalGradeA = qcResultSummary.reduce((sum, item) => sum + Number(item.qtyA || 0), 0)
  const totalGradeB = qcResultSummary.reduce((sum, item) => sum + Number(item.qtyB || 0), 0)
  const totalGradeC = qcResultSummary.reduce((sum, item) => sum + Number(item.qtyC || 0), 0)
  const rankedInspectorPerformance = [...inspectorPerformance].sort((a, b) => b.totalPcs - a.totalPcs)
  const rankedProductThroughputRows = productThroughputRows
    .filter((item) => Number(item.secondsPerPcs || 0) > 0)
    .sort((a, b) => Number(a.secondsPerPcs || 0) - Number(b.secondsPerPcs || 0))
  const maxProductThroughputSeconds = rankedProductThroughputRows.reduce((max, item) => Math.max(max, Number(item.secondsPerPcs || 0)), 0)
  const activeSummaryLabel = qcMode === 'regular' ? 'Reguler' : qcMode === 're_qc' ? 'Re-QC' : 'Arkline'
  const showRegularSplitColumn = qcMode === 'regular' && sampleFilter === 'yes'
  const selectedInspectorPerformance = inspectorPerformance.find((item) => item.inspectorKey === pauseDetailInspector)
  const selectedInspectorPauseLogs = selectedInspectorPerformance?.pauseLogs || []
  const selectedInspectorCompletedTaskRows = selectedInspectorPerformance?.completedTaskRows || []
  const selectedInspectorActiveTaskRows = selectedInspectorPerformance?.activeTaskRows || []
  const selectedInspectorCheckedQty = selectedInspectorCompletedTaskRows.reduce((sum, item) => sum + Number(item.checkedQty || 0), 0)
  const totalRemaining = activeItems.reduce(
    (sum, item) => sum + (Number(item.locked_qty || 0) - Number(item.allocated_qty || 0)),
    0
  )
  const allocationGapRows = useMemo(() => {
    const grouped = new Map()

    activeItems.forEach((item) => {
      const gapQty = Number(item.locked_qty || 0) - Number(item.allocated_qty || 0)
      if (!gapQty) return

      const source = qcMode !== 'regular' ? getArklinePoLabel(item) : item.inbound?.grn_number || '-'
      const product = qcMode !== 'regular' ? getArklineProductLabel(item) : getRegularModelVariantLabel(item) || 'UNKNOWN PRODUCT'
      const context = qcMode === 're_qc' ? `Round ${Number(item.qc_round_number || 2)}` : ''
      const key = `${source}|||${product}|||${context}`
      const current =
        grouped.get(key) || {
          source,
          product,
          context,
          qty: 0,
        }

      current.qty += gapQty
      grouped.set(key, current)
    })

    return Array.from(grouped.values())
      .filter((item) => Number(item.qty || 0) !== 0)
      .sort((a, b) => {
        const qtyCompare = Math.abs(Number(b.qty || 0)) - Math.abs(Number(a.qty || 0))
        if (qtyCompare !== 0) return qtyCompare
        const sourceCompare = String(a.source || '').localeCompare(String(b.source || ''), undefined, { numeric: true })
        if (sourceCompare !== 0) return sourceCompare
        return String(a.product || '').localeCompare(String(b.product || ''), undefined, { numeric: true })
      })
  }, [activeItems, qcMode])
  const allocationGapTooltipText = useMemo(() => {
    if (!allocationGapRows.length) {
      return 'No allocation gap for the active filter.'
    }

    const sourceLabel = qcMode === 'regular' ? 'GRN' : 'PO'
    const modeLabel = qcMode === 're_qc' ? 'Re-QC' : qcMode === 'regular' ? 'Reguler' : 'Arkline'
    const visibleRows = allocationGapRows.slice(0, 10)
    const hiddenCount = Math.max(0, allocationGapRows.length - visibleRows.length)
    const lines = visibleRows.map((item) => {
      const signedQty = `${Number(item.qty || 0) > 0 ? '+' : ''}${formatNumber(item.qty)}`
      const context = item.context ? ` | ${item.context}` : ''
      return `${sourceLabel}: ${item.source} | Product: ${item.product}${context} | Qty: ${signedQty}`
    })

    return [
      `${modeLabel} allocation gap detail`,
      'Positive means graded qty is higher than allocation; negative means still below allocation.',
      ...lines,
      hiddenCount ? `+${formatNumber(hiddenCount)} more rows` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }, [allocationGapRows, qcMode])
  const selectedSampleSplitTasks = useMemo(() => {
    if (!sampleSplitSummary) return []

    const sourceId = Number(sampleSplitSummary.sampleSourceId || 0)
    const sourceTaskRows = activeItems.filter((item) => isTemporarySampleTask(item) && Number(item.inbound_unload_id || item.inbound_unload?.id || 0) === sourceId)
    const taskRows = sourceTaskRows.length ? sourceTaskRows : sampleSplitSummary.taskRows || []

    return [...new Map(taskRows.map((item) => [String(item.id), item])).values()]
      .sort((a, b) => String(a.assigned_to || '').localeCompare(String(b.assigned_to || '')))
  }, [activeItems, sampleSplitSummary])
  const selectedSampleSplitBreakdowns = useMemo(() => {
    if (!sampleSplitSummary) return []

    return sampleBreakdownsByUnloadId.get(Number(sampleSplitSummary.sampleSourceId || 0)) || []
  }, [sampleBreakdownsByUnloadId, sampleSplitSummary])
  const sampleSplitDraftTotals = useMemo(
    () =>
      sampleSplitDraftRows.reduce(
        (total, row) => ({
          qtyA: total.qtyA + Number(row.qtyA || 0),
          qtyB: total.qtyB + Number(row.qtyB || 0),
          qtyC: total.qtyC + Number(row.qtyC || 0),
          checked: total.checked + Number(row.qtyA || 0) + Number(row.qtyB || 0) + Number(row.qtyC || 0),
        }),
        { qtyA: 0, qtyB: 0, qtyC: 0, checked: 0 }
      ),
    [sampleSplitDraftRows]
  )
  const sampleSplitSourceTotals = useMemo(
    () =>
      selectedSampleSplitTasks.reduce(
        (total, item) => ({
          qtyA: total.qtyA + Number(item.qty_a || 0),
          qtyB: total.qtyB + Number(item.qty_b || 0),
          qtyC: total.qtyC + Number(item.qty_c || 0),
        }),
        { qtyA: 0, qtyB: 0, qtyC: 0 }
      ),
    [selectedSampleSplitTasks]
  )
  const sampleSplitCheckedTotal = sampleSplitSourceTotals.qtyA + sampleSplitSourceTotals.qtyB + sampleSplitSourceTotals.qtyC
  const sampleSplitSampleQtyTotal = selectedSampleSplitBreakdowns.reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const sampleSplitRemainingTotals = useMemo(
    () => ({
      qtyA: sampleSplitSourceTotals.qtyA - sampleSplitDraftTotals.qtyA,
      qtyB: sampleSplitSourceTotals.qtyB - sampleSplitDraftTotals.qtyB,
      qtyC: sampleSplitSourceTotals.qtyC - sampleSplitDraftTotals.qtyC,
    }),
    [sampleSplitDraftTotals, sampleSplitSourceTotals]
  )

  function openSampleSplitModal(summary) {
    setSampleSplitError('')

    if (!supportsSampleSplit) {
      setError('Run `supabase/inbound_sample_breakdowns.sql` first before splitting sample QC.')
      return
    }

    const sourceId = Number(summary.sampleSourceId || 0)
    const breakdowns = sampleBreakdownsByUnloadId.get(sourceId) || []

    if (!breakdowns.length) {
      setError('Resolve Sample in Inbound first before splitting QC result.')
      return
    }

    const sourceTaskRows = activeItems.filter((item) => isTemporarySampleTask(item) && Number(item.inbound_unload_id || item.inbound_unload?.id || 0) === sourceId)
    const taskRows = sourceTaskRows.length ? sourceTaskRows : summary.taskRows || []

    const uniqueTasks = [...new Map(taskRows.map((item) => [String(item.id), item])).values()]
    const existingSplitRows = uniqueTasks.flatMap((task) => qcSampleSplitsByQcItemId.get(Number(task.id || 0)) || [])
    const rows = breakdowns.map((breakdown) => {
      const existingRows = existingSplitRows.filter((item) => Number(item.sample_breakdown_id || 0) === Number(breakdown.id || 0))
      const qtyA = existingRows.reduce((sum, item) => sum + Number(item.qty_a || 0), 0)
      const qtyB = existingRows.reduce((sum, item) => sum + Number(item.qty_b || 0), 0)
      const qtyC = existingRows.reduce((sum, item) => sum + Number(item.qty_c || 0), 0)

      return {
        id: `breakdown-${breakdown.id}`,
        sampleBreakdownId: breakdown.id,
        modelVariant: getSampleBreakdownLabel(breakdown),
        photoUrl: breakdown.photo_url || '',
        breakdownQty: Number(breakdown.qty || 0),
        qtyA: qtyA ? String(qtyA) : '',
        qtyB: qtyB ? String(qtyB) : '',
        qtyC: qtyC ? String(qtyC) : '',
      }
    })

    setSampleSplitSummary(summary)
    setSampleSplitDraftRows(rows)
    setSampleSplitError('')
    setError('')
    setSuccess('')
  }

  function closeSampleSplitModal() {
    setSampleSplitSummary(null)
    setSampleSplitDraftRows([])
    setSampleSplitError('')
  }

  function updateSampleSplitDraft(rowId, field, value) {
    const normalizedValue = Math.max(0, Number(value || 0))

    setSampleSplitDraftRows((rows) =>
      rows.map((row) => (row.id === rowId ? { ...row, [field]: value === '' ? '' : String(normalizedValue) } : row))
    )
  }

  async function saveSampleSplitRows() {
    if (!sampleSplitSummary) return

    setSampleSplitError('')
    setSuccess('')

    if (!supportsSampleSplit) {
      setSampleSplitError('Run `supabase/inbound_sample_breakdowns.sql` first before splitting sample QC.')
      return
    }

    const normalizedDraftRows = sampleSplitDraftRows.map((row) => ({
      ...row,
      qtyA: Number(row.qtyA || 0),
      qtyB: Number(row.qtyB || 0),
      qtyC: Number(row.qtyC || 0),
      breakdownQty: Number(row.breakdownQty || 0),
    }))

    const overBreakdownRow = normalizedDraftRows.find((row) => row.qtyA + row.qtyB + row.qtyC > row.breakdownQty)
    if (overBreakdownRow) {
      setSampleSplitError(`Split qty for ${overBreakdownRow.modelVariant} cannot exceed sample qty ${formatNumber(overBreakdownRow.breakdownQty)}.`)
      return
    }

    const draftTotals = normalizedDraftRows.reduce(
      (total, row) => ({
        qtyA: total.qtyA + row.qtyA,
        qtyB: total.qtyB + row.qtyB,
        qtyC: total.qtyC + row.qtyC,
      }),
      { qtyA: 0, qtyB: 0, qtyC: 0 }
    )
    const remainingTotals = {
      qtyA: sampleSplitSourceTotals.qtyA - draftTotals.qtyA,
      qtyB: sampleSplitSourceTotals.qtyB - draftTotals.qtyB,
      qtyC: sampleSplitSourceTotals.qtyC - draftTotals.qtyC,
    }

    if (remainingTotals.qtyA || remainingTotals.qtyB || remainingTotals.qtyC) {
      setSampleSplitError(
        `Split must match QC source. Remaining: A ${formatNumber(remainingTotals.qtyA)}, B ${formatNumber(remainingTotals.qtyB)}, C ${formatNumber(remainingTotals.qtyC)}.`
      )
      return
    }

    const sourceTasks = selectedSampleSplitTasks.filter((item) => Number(item.id || 0))
    if (!sourceTasks.length) {
      setSampleSplitError('No QC source found for this sample.')
      return
    }

    const taskCapacityRows = sourceTasks.map((task) => ({
      qcItemId: Number(task.id || 0),
      qtyA: Number(task.qty_a || 0),
      qtyB: Number(task.qty_b || 0),
      qtyC: Number(task.qty_c || 0),
      usedA: 0,
      usedB: 0,
      usedC: 0,
    }))
    const desiredByKey = new Map()
    const addDesiredQty = (qcItemId, sampleBreakdownId, dbField, qty) => {
      const key = `${qcItemId}-${sampleBreakdownId}`
      const current =
        desiredByKey.get(key) || {
          qc_item_id: qcItemId,
          sample_breakdown_id: sampleBreakdownId,
          qty_a: 0,
          qty_b: 0,
          qty_c: 0,
        }

      current[dbField] += qty
      desiredByKey.set(key, current)
    }
    const distributeGradeQty = (row, draftField, capacityField, usedField, dbField, gradeLabel) => {
      let remainingQty = Number(row[draftField] || 0)

      for (const task of taskCapacityRows) {
        if (!remainingQty) break

        const availableQty = Math.max(0, Number(task[capacityField] || 0) - Number(task[usedField] || 0))
        const qtyToTake = Math.min(availableQty, remainingQty)
        if (!qtyToTake) continue

        addDesiredQty(task.qcItemId, row.sampleBreakdownId, dbField, qtyToTake)
        task[usedField] += qtyToTake
        remainingQty -= qtyToTake
      }

      if (remainingQty > 0) {
        throw new Error(`Cannot distribute Grade ${gradeLabel} split for ${row.modelVariant}.`)
      }
    }

    try {
      normalizedDraftRows.forEach((row) => {
        distributeGradeQty(row, 'qtyA', 'qtyA', 'usedA', 'qty_a', 'A')
        distributeGradeQty(row, 'qtyB', 'qtyB', 'usedB', 'qty_b', 'B')
        distributeGradeQty(row, 'qtyC', 'qtyC', 'usedC', 'qty_c', 'C')
      })
    } catch (error) {
      setSampleSplitError(error.message)
      return
    }

    const deleteIds = sourceTasks
      .flatMap((task) => qcSampleSplitsByQcItemId.get(Number(task.id || 0)) || [])
      .map((row) => row.id)
      .filter(Boolean)
    const insertRows = Array.from(desiredByKey.values()).filter((row) => Number(row.qty_a || 0) + Number(row.qty_b || 0) + Number(row.qty_c || 0) > 0)

    setSavingSampleSplit(true)

    if (deleteIds.length) {
      const { error: deleteError } = await supabase
        .from('qc_sample_breakdowns')
        .delete()
        .in('id', deleteIds)

      if (deleteError) {
        setSampleSplitError(deleteError.message)
        setSavingSampleSplit(false)
        return
      }
    }

    if (insertRows.length) {
      const { error: insertError } = await supabase
        .from('qc_sample_breakdowns')
        .insert(insertRows)

      if (insertError) {
        setSampleSplitError(insertError.message)
        setSavingSampleSplit(false)
        return
      }
    }

    await loadDashboard(true)
    setSavingSampleSplit(false)
    closeSampleSplitModal()
    setSuccess('Sample QC split saved.')
  }

  function openRejectDetailModal(summary) {
    const summaryTaskRows = summary.taskRows?.length ? summary.taskRows : activeItems.filter((item) => isTaskInSummary(item, summary))
    const taskIds = new Set(summaryTaskRows.map((item) => String(item.id)))
    const cycleIds = new Set(summaryTaskRows.map((item) => String(item.qc_cycle_id || '')).filter(Boolean))
    const summaryParts = getSummaryTaskKeyParts(summary)
    const summaryKey = getSummaryRejectKey(summary)
    const existingDetails = arklineRejectDetails.filter((item) => {
      const matchesSummary = taskIds.size
        ? taskIds.has(String(item.arkline_qc_id))
        : getRejectDetailSummaryKey(item) === summaryKey
      const matchesDate = taskIds.size
        ? true
        : hasInvalidDateRange || isWithinDateRange(item.created_at || item.updated_at, dateFrom, dateTo)
      return matchesSummary && matchesDate
    })
    const summaryRejectTargetQty = Number(summary.rejectTargetQty ?? getRejectQty(summary))
    const initialRows = existingDetails.length
      ? buildGroupedRejectDraftRows(existingDetails)
      : [
          ...(Number(summary.qtyB || 0) > 0 ? [createRejectDraftRow({ grade: 'B', qty: String(summary.qtyB || '') })] : []),
          ...(Number(summary.qtyC || 0) > 0 ? [createRejectDraftRow({ grade: 'C', qty: String(summary.qtyC || '') })] : []),
          ...(!summaryRejectTargetQty ? [createRejectDraftRow()] : []),
        ]

    setRejectDetailSummary(summary)
    setRejectDetailError('')
    setRejectDraftRows(initialRows.length ? initialRows : [createRejectDraftRow()])
    setExpandedRejectReasonRows({})
    setReadOnlyRejectSections({
      rejectDetail: false,
      adjustment: false,
      timeline: false,
      inspector: false,
    })
    setRejectAdjustmentDraft({
      adjustmentType: 'transfer',
      fromGrade: '',
      toGrade: '',
      affectedGrade: '',
      qty: '',
      notes: '',
    })
  }

  function toggleInspectorDetailSection(sectionKey) {
    setInspectorDetailSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  function toggleRejectReasonSummaryRow(rowKey) {
    setExpandedRejectReasonRows((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }))
  }

  function toggleReadOnlyRejectSection(sectionKey) {
    setReadOnlyRejectSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  function updateRejectDraftRow(rowId, field, value) {
    setRejectDraftRows((rows) =>
      rows.map((row) => {
        if (row.id !== rowId) return row
        const shouldUppercase = field === 'grade' || field === 'newReasonName' || field === 'size'
        const next = { ...row, [field]: shouldUppercase ? String(value).toUpperCase() : value }
        if (field === 'rejectReasonId' && value !== '__new__') {
          next.newReasonName = ''
        }
        return next
      })
    )
  }

  function removeRejectDraftRow(rowId) {
    setRejectDraftRows((rows) => (rows.length > 1 ? rows.filter((row) => row.id !== rowId) : [createRejectDraftRow()]))
  }

  async function resolveRejectReasonId(row) {
    if (row.rejectReasonId && row.rejectReasonId !== '__new__') {
      return row.rejectReasonId
    }

    const reasonName = String(row.newReasonName || '').trim().toUpperCase()
    if (!reasonName) {
      throw new Error('Isi reason baru dulu sebelum save.')
    }

    const existingReason = arklineRejectReasons.find((item) => item.reason_name.toLowerCase() === reasonName.toLowerCase())
    if (existingReason) {
      return existingReason.id
    }

    const { data, error: insertError } = await supabase
      .from('arkline_qc_reject_reasons')
      .insert({ reason_name: reasonName })
      .select('id, reason_name, is_active, is_repairable')
      .single()

    if (insertError) {
      const { data: fallbackReason, error: fallbackError } = await supabase
        .from('arkline_qc_reject_reasons')
        .select('id, reason_name, is_active, is_repairable')
        .eq('reason_name', reasonName)
        .single()

      if (fallbackError) {
        throw new Error(insertError.message)
      }
      setArklineRejectReasons((items) => [...items, fallbackReason].sort((a, b) => a.reason_name.localeCompare(b.reason_name)))
      return fallbackReason.id
    }

    setArklineRejectReasons((items) => [...items, data].sort((a, b) => a.reason_name.localeCompare(b.reason_name)))
    return data.id
  }

  async function handleSubmitRejectAdjustment() {
    if (!rejectDetailSummary) return

    setRejectDetailError('')
    setSuccess('')

    if (!canEditArklineRejectDetail) {
      setRejectDetailError(rejectDetailReadOnlyReason || 'Choose a specific Date From and Date To before submitting Adjustment.')
      return
    }

    const qty = Number(rejectAdjustmentDraft.qty || 0)
    if (qty <= 0) {
      setRejectDetailError('Masukkan qty adjustment terlebih dahulu.')
      return
    }

    const adjustmentType = String(rejectAdjustmentDraft.adjustmentType || '').trim()
    if (!['transfer', 'inspector_data_error'].includes(adjustmentType)) {
      setRejectDetailError('Pilih tipe adjustment terlebih dahulu.')
      return
    }
    const fromGrade = normalizeQcGrade(rejectAdjustmentDraft.fromGrade)
    const toGrade = normalizeQcGrade(rejectAdjustmentDraft.toGrade)
    const affectedGrade = normalizeQcGrade(rejectAdjustmentDraft.affectedGrade)

    if (adjustmentType === 'transfer' && (!fromGrade || !toGrade || fromGrade === toGrade)) {
      setRejectDetailError('Transfer harus memilih grade asal dan tujuan yang berbeda.')
      return
    }

    if (adjustmentType === 'inspector_data_error' && !affectedGrade) {
      setRejectDetailError('Pilih grade yang dikurangi untuk QC Inspector Error.')
      return
    }

    setSavingRejectDetail(true)

    try {
      const poId = rejectDetailSummary.brand === 'NO PO' ? null : rejectDetailSummary.brand
      const skuInduk = rejectDetailSummary.category === 'NO SKU' ? null : rejectDetailSummary.category
      const targetCycleId = selectedRejectTaskRows[0]?.qc_cycle_id || null
      const payload = {
        adjustment_type: adjustmentType,
        qty,
        notes: rejectAdjustmentDraft.notes.trim() || null,
        from_grade: adjustmentType === 'transfer' ? fromGrade : null,
        to_grade: adjustmentType === 'transfer' ? toGrade : null,
        affected_grade: adjustmentType === 'inspector_data_error' ? affectedGrade : null,
        effective_date: dateFrom || null,
        po_id: poId,
        arkline_po_item_id: selectedRejectTaskRows[0]?.arkline_po_item_id || null,
        sku_induk: skuInduk,
        model_name: rejectDetailSummary.model,
        qc_cycle_id: targetCycleId,
      }

      const { error: insertAdjustmentError } = await supabase.from('arkline_qc_reject_adjustments').insert(payload)
      if (insertAdjustmentError) throw new Error(insertAdjustmentError.message)

      const { data: nextAdjustmentRows, error: nextAdjustmentError } = await supabase
        .from('arkline_qc_reject_adjustments')
        .select('*')
        .order('created_at', { ascending: false })

      if (nextAdjustmentError) throw new Error(nextAdjustmentError.message)

      setArklineRejectAdjustments(nextAdjustmentRows || [])
      setRejectAdjustmentDraft({
        adjustmentType: 'transfer',
        fromGrade: '',
        toGrade: '',
        affectedGrade: '',
        qty: '',
        notes: '',
      })
      setSuccess('Arkline adjustment submitted.')
    } catch (submitError) {
      setRejectDetailError(submitError.message || 'Failed to submit Arkline adjustment.')
    } finally {
      setSavingRejectDetail(false)
    }
  }

  async function handleSaveRejectDetail() {
    if (!rejectDetailSummary) return

    setRejectDetailError('')
    setSuccess('')

    if (!canEditArklineRejectDetail) {
      setRejectDetailError(rejectDetailReadOnlyReason || 'Choose a specific Date From and Date To before editing Reject Detail.')
      return
    }

    setSavingRejectDetail(true)

    try {
      if (!rejectDraftRows.length) {
        throw new Error('Tambahkan minimal satu baris reject detail.')
      }

      const validRows = rejectDraftRows.filter((row) => Number(row.qty || 0) > 0)

      if (!validRows.length && selectedRejectExpectedRejectQty > 0) {
        throw new Error('Tambahkan minimal satu baris reject detail.')
      }

      validRows.forEach((row) => {
        if (!['B', 'C'].includes(String(row.grade || '').toUpperCase())) {
          throw new Error('Grade reject hanya bisa B atau C.')
        }
        if (!row.rejectReasonId) {
          throw new Error('Pilih reason untuk setiap baris reject.')
        }
        if (row.rejectReasonId === '__new__' && !String(row.newReasonName || '').trim()) {
          throw new Error('Isi reason baru dulu sebelum save.')
        }
        if (!String(row.size || '').trim()) {
          throw new Error('Pilih size untuk setiap baris reject.')
        }
      })

      if (selectedRejectExpectedRejectQty > 0 && selectedRejectGap !== 0) {
        throw new Error('Total detail + adjustment harus sama dengan total Grade B/C awal.')
      }

      const rowsWithReasons = []
      for (const row of validRows) {
        rowsWithReasons.push({ ...row, rejectReasonId: await resolveRejectReasonId(row) })
      }

      const existingDetailIds = selectedRejectExistingDetails.map((item) => item.id).filter(Boolean)
      const { data: returnLineRows, error: returnLineError } = existingDetailIds.length
        ? await supabase
            .from('arkline_qc_return_batch_lines')
            .select('reject_detail_id, qty')
            .in('reject_detail_id', existingDetailIds)
        : { data: [], error: null }

      if (returnLineError) throw new Error(returnLineError.message)

      const lockedDetailIds = new Set((returnLineRows || []).map((item) => String(item.reject_detail_id)).filter(Boolean))
      const lockedDetails = selectedRejectExistingDetails.filter((item) => lockedDetailIds.has(String(item.id)))
      const unlockedDetailIds = selectedRejectExistingDetails
        .filter((item) => !lockedDetailIds.has(String(item.id)))
        .map((item) => item.id)
        .filter(Boolean)
      const lockedQtyByKey = new Map()
      const lockedQtyByTaskGrade = new Map()

      lockedDetails.forEach((item) => {
        const key = getRejectDraftKey(item)
        lockedQtyByKey.set(key, Number(lockedQtyByKey.get(key) || 0) + Number(item.qty || 0))

        const taskGradeKey = `${item.arkline_qc_id || ''}|||${String(item.grade || '').trim().toUpperCase()}`
        lockedQtyByTaskGrade.set(taskGradeKey, Number(lockedQtyByTaskGrade.get(taskGradeKey) || 0) + Number(item.qty || 0))
      })

      const desiredQtyByKey = new Map()
      rowsWithReasons.forEach((row) => {
        const key = getRejectDraftKey(row)
        desiredQtyByKey.set(key, Number(desiredQtyByKey.get(key) || 0) + Number(row.qty || 0))
      })

      for (const [key, lockedQty] of lockedQtyByKey.entries()) {
        const desiredQty = Number(desiredQtyByKey.get(key) || 0)
        if (desiredQty < Number(lockedQty || 0)) {
          throw new Error('Reject detail yang sudah dipakai return tidak bisa dikurangi atau dihapus.')
        }
      }

      const taskRowsByGrade = {
        B: selectedRejectTaskRows.map((item) => {
          const lockedQty = Number(lockedQtyByTaskGrade.get(`${item.id || ''}|||B`) || 0)
          return { ...item, remainingRejectQty: Math.max(0, Number(item.qty_b || 0) - lockedQty) }
        }),
        C: selectedRejectTaskRows.map((item) => {
          const lockedQty = Number(lockedQtyByTaskGrade.get(`${item.id || ''}|||C`) || 0)
          return { ...item, remainingRejectQty: Math.max(0, Number(item.qty_c || 0) - lockedQty) }
        }),
      }
      const detailPayload = []

      rowsWithReasons.forEach((row) => {
        const key = getRejectDraftKey(row)
        const lockedQty = Number(lockedQtyByKey.get(key) || 0)
        let remaining = Number(row.qty || 0) - lockedQty
        const grade = String(row.grade || 'B').toUpperCase()
        const queue = taskRowsByGrade[grade] || []

        if (remaining < 0) {
          throw new Error('Reject detail yang sudah dipakai return tidak bisa dikurangi atau dihapus.')
        }

        queue.forEach((task) => {
          if (remaining <= 0 || Number(task.remainingRejectQty || 0) <= 0) return
          const qty = Math.min(remaining, Number(task.remainingRejectQty || 0))
          detailPayload.push({
            arkline_qc_id: task.id,
            po_id: task.po_id || null,
            arkline_po_item_id: task.arkline_po_item_id || null,
            sku_induk: task.sku_induk || null,
            model_name: task.model_name || rejectDetailSummary.model,
            grade,
            size: String(row.size || '').trim(),
            reject_reason_id: row.rejectReasonId,
            qty,
          })
          task.remainingRejectQty -= qty
          remaining -= qty
        })

        if (remaining > 0 && selectedRejectTaskRows.length) {
          const fallbackTask = selectedRejectTaskRows[0]
          detailPayload.push({
            arkline_qc_id: fallbackTask.id,
            po_id: fallbackTask.po_id || null,
            arkline_po_item_id: fallbackTask.arkline_po_item_id || null,
            sku_induk: fallbackTask.sku_induk || null,
            model_name: fallbackTask.model_name || rejectDetailSummary.model,
            grade,
            size: String(row.size || '').trim(),
            reject_reason_id: row.rejectReasonId,
            qty: remaining,
          })
          remaining = 0
        }

        if (remaining > 0) {
          throw new Error('Reject detail belum bisa disimpan karena task summary tidak ditemukan.')
        }
      })

      if (unlockedDetailIds.length) {
        const { error: deleteDetailError } = await supabase.from('arkline_qc_reject_details').delete().in('id', unlockedDetailIds)
        if (deleteDetailError) throw new Error(deleteDetailError.message)
      }

      if (detailPayload.length) {
        const { error: insertDetailError } = await supabase.from('arkline_qc_reject_details').insert(detailPayload)
        if (insertDetailError) throw new Error(insertDetailError.message)
      }

      const [
        { data: nextDetailRows, error: nextDetailError },
        { data: nextAdjustmentRows, error: nextAdjustmentError },
      ] = await Promise.all([
        supabase
          .from('arkline_qc_reject_details')
          .select(`
            id,
            arkline_qc_id,
            po_id,
            arkline_po_item_id,
            sku_induk,
            model_name,
            grade,
            size,
            reject_reason_id,
            qty,
            created_at,
            updated_at,
            reason:reject_reason_id (
              id,
              reason_name,
              is_repairable
            )
          `)
          .order('created_at', { ascending: false }),
        supabase.from('arkline_qc_reject_adjustments').select('*').order('created_at', { ascending: false }),
      ])

      if (nextDetailError || nextAdjustmentError) {
        throw new Error(nextDetailError?.message || nextAdjustmentError?.message)
      }

      setArklineRejectDetails(nextDetailRows || [])
      setArklineRejectAdjustments(nextAdjustmentRows || [])
      setRejectDetailSummary(null)
      setRejectDetailError('')
      setRejectDraftRows([])
      setSuccess('Arkline reject detail saved.')
    } catch (saveError) {
      setRejectDetailError(saveError.message || 'Failed to save Arkline reject detail.')
    } finally {
      setSavingRejectDetail(false)
    }
  }

  function renderReadOnlyRejectSummarySectionRows(title, rows, tone = 'neutral') {
    const totalQty = rows.reduce((sum, item) => sum + Number(item.totalQty || 0), 0)
    const sectionStyle = {
      ...styles.rejectSummarySectionRow,
      ...(tone === 'repairable' ? styles.rejectSummarySectionRowRepairable : {}),
      ...(tone === 'unrepairable' ? styles.rejectSummarySectionRowUnrepairable : {}),
    }

    return (
      <>
        <tr>
          <td style={sectionStyle} colSpan={5}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span>{title}</span>
              <span>{formatNumber(totalQty)} qty</span>
            </span>
          </td>
        </tr>
        {rows.length ? (
          rows.map((item) => {
            const expanded = Boolean(expandedRejectReasonRows[item.key])
            return (
              <Fragment key={item.key}>
                <tr>
                  <td style={styles.td}>{item.reason}</td>
                  <td style={{ ...styles.td, ...styles.tdCenter }}>{formatNumber(item.qtyB)}</td>
                  <td style={{ ...styles.td, ...styles.tdCenter }}>{formatNumber(item.qtyC)}</td>
                  <td style={{ ...styles.td, ...styles.tdCenter }}>{formatNumber(item.totalQty)}</td>
                  <td style={{ ...styles.td, ...styles.tdCenter }}>
                    <button
                      type="button"
                      style={styles.rejectSummaryToggle}
                      onClick={() => toggleRejectReasonSummaryRow(item.key)}
                      aria-label={`${expanded ? 'Hide' : 'Show'} reject reason detail`}
                      title={`${expanded ? 'Hide' : 'Show'} size and QC source date detail`}
                    >
                      {expanded ? '-' : '+'}
                    </button>
                  </td>
                </tr>
                {expanded ? (
                  <tr>
                    <td style={styles.rejectSummaryDetailPanel} colSpan={5}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Size</th>
                            <th style={{ ...styles.th, ...styles.thCenter }}>Grade B</th>
                            <th style={{ ...styles.th, ...styles.thCenter }}>Grade C</th>
                            <th style={{ ...styles.th, ...styles.thCenter }}>Total Qty</th>
                            <th style={styles.th}>QC Source Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.sizes.map((sizeRow) => (
                            <tr key={`${item.key}-${sizeRow.size}`}>
                              <td style={styles.td}>{sizeRow.size}</td>
                              <td style={{ ...styles.td, ...styles.tdCenter }}>{formatNumber(sizeRow.qtyB)}</td>
                              <td style={{ ...styles.td, ...styles.tdCenter }}>{formatNumber(sizeRow.qtyC)}</td>
                              <td style={{ ...styles.td, ...styles.tdCenter }}>{formatNumber(sizeRow.totalQty)}</td>
                              <td style={styles.td}>{Array.from(sizeRow.dates || []).sort().join(', ') || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })
        ) : (
          <tr>
            <td style={styles.td} colSpan={5}>
              No {title.toLowerCase()} reject summary.
            </td>
          </tr>
        )}
      </>
    )
  }

  function renderReadOnlyRejectSummaryTable() {
    return (
      <div style={styles.rejectSummarySection}>
        <div style={styles.modalTableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Reject Reason</th>
                <th style={{ ...styles.th, ...styles.thCenter }}>Grade B</th>
                <th style={{ ...styles.th, ...styles.thCenter }}>Grade C</th>
                <th style={{ ...styles.th, ...styles.thCenter }}>Total Qty</th>
                <th style={{ ...styles.th, ...styles.thCenter }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {renderReadOnlyRejectSummarySectionRows('Repairable', repairableRejectReasonSummaryRows, 'repairable')}
              {renderReadOnlyRejectSummarySectionRows('Unrepairable', unrepairableRejectReasonSummaryRows, 'unrepairable')}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderRejectAdjustmentTable() {
    return (
      <div style={styles.modalTableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Adjustment Type</th>
              <th style={styles.th}>Grade</th>
              <th style={styles.th}>Qty</th>
              <th style={styles.th}>Notes</th>
              <th style={styles.th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {selectedRejectExistingAdjustments.length ? (
              selectedRejectExistingAdjustments.map((item) => (
                <tr key={item.id}>
                  <td style={styles.td}>{getArklineAdjustmentLabel(item.adjustment_type)}</td>
                  <td style={styles.td}>{getArklineAdjustmentGradeLabel(item)}</td>
                  <td style={styles.td}>{item.qty}</td>
                  <td style={styles.td}>{item.notes || '-'}</td>
                  <td style={styles.td}>{String(getArklineAdjustmentDateValue(item) || '-').slice(0, 10)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td style={styles.td} colSpan={5}>
                  No saved adjustment yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  function renderSavedRejectDetailTable() {
    return (
      <div style={styles.modalTableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Saved Reason</th>
              <th style={styles.th}>Grade</th>
              <th style={styles.th}>Size</th>
              <th style={styles.th}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {selectedRejectSortedExistingDetails.length ? (
              selectedRejectSortedExistingDetails.map((item, index) => (
                <tr key={`${item.id}-${item.arkline_qc_id || 'reject'}-${index}`}>
                  <td style={styles.td}>{item.reason?.reason_name || '-'}</td>
                  <td style={styles.td}>{item.grade}</td>
                  <td style={styles.td}>{item.size}</td>
                  <td style={styles.td}>{item.qty}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td style={styles.td} colSpan={4}>
                  No saved reject detail yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  function renderReadOnlyRejectTimelineTable() {
    return (
      <div style={styles.modalTableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>QC Date</th>
              <th style={{ ...styles.th, ...styles.thCenter }}>Grade A</th>
              <th style={{ ...styles.th, ...styles.thCenter }}>Grade B</th>
              <th style={{ ...styles.th, ...styles.thCenter }}>Grade C</th>
              <th style={{ ...styles.th, ...styles.thCenter }}>Total Inspected</th>
            </tr>
          </thead>
          <tbody>
            {readOnlyRejectTimelineRows.length ? (
              readOnlyRejectTimelineRows.map((item) => (
                <tr key={item.dateKey}>
                  <td style={styles.td}>{item.dateKey === 'unknown' ? '-' : formatDisplayDateOnly(item.dateKey)}</td>
                  <td style={{ ...styles.td, ...styles.tdCenter }}>{formatNumber(item.qtyA)}</td>
                  <td style={{ ...styles.td, ...styles.tdCenter }}>{formatNumber(item.qtyB)}</td>
                  <td style={{ ...styles.td, ...styles.tdCenter }}>{formatNumber(item.qtyC)}</td>
                  <td style={{ ...styles.td, ...styles.tdCenter }}>{formatNumber(item.checked)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td style={styles.td} colSpan={5}>
                  No QC timeline found for this detail.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  function renderRejectInspectorTable() {
    return (
      <div style={styles.inspectorTableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.inspectorTh }}>Inspector</th>
              <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Grade A</th>
              <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Grade B</th>
              <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Grade C</th>
              <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Checked</th>
            </tr>
          </thead>
          <tbody>
            {selectedRejectInspectorRows.length ? (
              selectedRejectInspectorRows.map((item) => (
                <tr key={item.inspectorKey}>
                  <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.inspector}</td>
                  <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.qtyA}</td>
                  <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.qtyB}</td>
                  <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.qtyC}</td>
                  <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.checked}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td style={{ ...styles.td, ...styles.inspectorTd }} colSpan={5}>
                  No inspector summary found for this detail.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  function renderReadOnlyRejectSection(sectionKey, title, meta, content) {
    const expanded = readOnlyRejectSections[sectionKey] !== false

    return (
      <div style={styles.readOnlyRejectSection}>
        <button type="button" style={styles.readOnlyRejectSectionHeader} onClick={() => toggleReadOnlyRejectSection(sectionKey)}>
          <span>{title}</span>
          <span style={styles.readOnlyRejectSectionMeta}>
            {meta ? `${meta} ` : ''}
            {expanded ? '-' : '+'}
          </span>
        </button>
        {expanded ? <div style={styles.readOnlyRejectSectionBody}>{content}</div> : null}
      </div>
    )
  }

  async function handlePauseAllQc() {
    setError('')
    setSuccess('')
    setPausingAll(true)

    const runningRegularTasks = qcItems.filter((item) => item.status === 'in_progress')
    const runningArklineTasks = arklineQcItems.filter((item) => item.status === 'in_progress')
    const runningTasks = [
      ...runningRegularTasks.map((item) => ({ ...item, qc_table: 'qc_items' })),
      ...runningArklineTasks.map((item) => ({ ...item, qc_table: 'arkline_qc' })),
    ]

    if (!runningTasks.length) {
      setSuccess('There are no running QC tasks to pause right now.')
      setPausingAll(false)
      return
    }

    const updates = runningTasks.map(async (item) => {
      const tracksTiming = item.qc_table !== 'qc_items' || shouldTrackQcTiming(item, 'regular')
      const baseSeconds = Number(item.stopwatch_seconds || 0)
      const startedAtMs = item.started_at ? new Date(item.started_at).getTime() : null
      const liveSeconds = tracksTiming && startedAtMs
        ? baseSeconds + Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
        : tracksTiming ? baseSeconds : 0
      const pausedAt = new Date().toISOString()
      const updateResult = await supabase
        .from(item.qc_table)
        .update({
          status: 'paused',
          stopwatch_seconds: liveSeconds,
          pause_reason: 'COORDINATOR BREAK',
          paused_at: pausedAt,
          started_at: null,
        })
        .eq('id', item.id)

      return { error: updateResult.error || null }
    })

    const results = await Promise.all(updates)
    const failed = results.find((result) => result.error)

    if (failed?.error) {
      setError(failed.error.message)
      setPausingAll(false)
      return
    }

    const pauseTaskInState = (prev) =>
      prev.map((item) => {
        if (item.status !== 'in_progress') return item
        const tracksTiming = shouldTrackQcTiming(item, 'regular')
        const baseSeconds = Number(item.stopwatch_seconds || 0)
        const startedAtMs = item.started_at ? new Date(item.started_at).getTime() : null
        const liveSeconds = tracksTiming && startedAtMs
          ? baseSeconds + Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
          : tracksTiming ? baseSeconds : 0

        return {
          ...item,
          status: 'paused',
          stopwatch_seconds: liveSeconds,
          pause_reason: 'COORDINATOR BREAK',
          paused_at: new Date().toISOString(),
          started_at: null,
        }
      })
    setQcItems(pauseTaskInState)
    setArklineQcItems(pauseTaskInState)
    setSuccess('All running QC stopwatches are now paused.')
    setPausingAll(false)
    setShowPauseConfirm(false)
  }

  if (loading) {
    return <p style={styles.emptyText}>Loading QC summary...</p>
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.flatSection}>
        <div style={styles.summaryHeaderGrid}>
          <div style={styles.summaryHeaderLeft}>
            <div style={styles.headerRow}>
              <div>
                <p style={styles.eyebrow}>Quality Control</p>
                <div style={styles.titleRow}>
                  <h1 style={styles.title}>Summary</h1>
                  <button
                    type="button"
                    onClick={() => setShowPauseConfirm(true)}
                    disabled={pausingAll}
                    style={{
                      ...styles.pauseIconButton,
                      opacity: pausingAll ? 0.6 : 1,
                      cursor: pausingAll ? 'not-allowed' : 'pointer',
                    }}
                    title="Pause All QC"
                    aria-label="Pause All QC"
                  >
                    {pausingAll ? '...' : '⏸'}
                  </button>
                </div>
              </div>
            </div>

            <div style={styles.modeRow}>
              <button
                type="button"
                style={{ ...styles.modeButton, ...(qcMode === 'regular' ? styles.modeButtonActive : {}) }}
                onClick={() => {
                  setQcMode('regular')
                  setPauseDetailInspector('')
                  setPoFilter('')
                  setArklineProductFilter('')
                }}
              >
                Reguler
              </button>
              <button
                type="button"
                style={{ ...styles.modeButton, ...(qcMode === 'arkline' ? styles.modeButtonActive : {}) }}
                onClick={() => {
                  setQcMode('arkline')
                  setPauseDetailInspector('')
                  setGrnFilter('')
                  setBrandFilter('')
                  setCategoryFilter('')
                  setRegularModelVariantFilter('')
                  setRegularGradeFilter('')
                  setSampleFilter('')
                }}
              >
                Arkline
              </button>
              <button
                type="button"
                style={{ ...styles.modeButton, ...(qcMode === 're_qc' ? styles.modeButtonActive : {}) }}
                onClick={() => {
                  setQcMode('re_qc')
                  setPauseDetailInspector('')
                  setGrnFilter('')
                  setPoFilter('')
                  setArklineProductFilter('')
                  setBrandFilter('')
                  setCategoryFilter('')
                  setRegularModelVariantFilter('')
                  setRegularGradeFilter('')
                  setSampleFilter('')
                }}
              >
                Re-QC
              </button>
            </div>
          </div>

          <div style={styles.summaryMetricGrid}>
            <div style={styles.compactMetricCard}>
              <span style={styles.summaryLabel}>Allocation</span>
              <strong style={{ ...styles.summaryValue, ...styles.compactMetricValue }}>{totalAllocated}</strong>
            </div>
            <div style={styles.compactMetricCard}>
              <span style={styles.summaryLabel}>
                Graded Qty
                <InfoHint text="Qty yang sudah di QC oleh Grader." />
              </span>
              <strong style={{ ...styles.summaryValue, ...styles.compactMetricValue }}>{totalLocked}</strong>
            </div>
            <div style={styles.compactMetricCard}>
              <span style={styles.summaryLabel}>
                Allocation Gap
                <InfoHint text={allocationGapTooltipText} />
              </span>
              <strong
                style={{
                  ...styles.summaryValue,
                  ...styles.compactMetricValue,
                  color: totalRemaining > 0 ? '#16a34a' : totalRemaining < 0 ? '#dc2626' : '#111827',
                }}
              >
                {totalRemaining > 0 ? '+' : ''}
                {totalRemaining}
              </strong>
            </div>
          </div>
        </div>

        <div style={styles.filters}>
          <div style={styles.field}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <label style={styles.label}>Date From</label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={allTime}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setAllTime(checked)
                    if (checked) {
                      setDateFrom('')
                      setDateTo('')
                    }
                  }}
                />
                All Time
              </label>
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              style={{ ...styles.input, ...(allTime ? styles.disabledInput : {}) }}
              disabled={allTime}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              style={{ ...styles.input, ...(allTime ? styles.disabledInput : {}) }}
              disabled={allTime}
            />
          </div>

          {qcMode !== 'regular' ? (
            <>
              <div style={styles.field}>
                <label style={styles.label}>PO ID</label>
                <input
                  list="qc-dashboard-po-options"
                  value={poFilter}
                  autoComplete="off"
                  onMouseDown={() => {
                    if (poFilter) setPoFilter('')
                  }}
                  onChange={(event) => setPoFilter(event.target.value)}
                  style={styles.input}
                  placeholder="All PO"
                />
                <datalist id="qc-dashboard-po-options">
                  {poOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Product Arkline</label>
                <input
                  list="qc-dashboard-arkline-product-options"
                  value={arklineProductFilter}
                  autoComplete="off"
                  onMouseDown={() => {
                    if (arklineProductFilter) setArklineProductFilter('')
                  }}
                  onChange={(event) => setArklineProductFilter(event.target.value)}
                  style={styles.input}
                  placeholder={poFilter && poFilter !== 'NO PO' ? 'Product in selected PO' : 'All Arkline product'}
                />
                <datalist id="qc-dashboard-arkline-product-options">
                  {arklineProductOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
            </>
          ) : (
            <>
              <div style={styles.field}>
                <label style={styles.label}>GRN Number</label>
                <input
                  list="qc-dashboard-grn-options"
                  value={grnFilter}
                  autoComplete="off"
                  onMouseDown={() => {
                    if (grnFilter) setGrnFilter('')
                  }}
                  onChange={(event) => setGrnFilter(event.target.value)}
                  style={styles.input}
                  placeholder="All GRN"
                />
                <datalist id="qc-dashboard-grn-options">
                  {grnOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Brand</label>
                <input
                  list="qc-dashboard-brand-options"
                  value={brandFilter}
                  autoComplete="off"
                  onMouseDown={() => {
                    if (brandFilter) setBrandFilter('')
                  }}
                  onChange={(event) => setBrandFilter(event.target.value)}
                  style={styles.input}
                  placeholder="All Brand"
                />
                <datalist id="qc-dashboard-brand-options">
                  {brandOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Category</label>
                <input
                  list="qc-dashboard-category-options"
                  value={categoryFilter}
                  autoComplete="off"
                  onMouseDown={() => {
                    if (categoryFilter) setCategoryFilter('')
                  }}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  style={styles.input}
                  placeholder="All Category"
                />
                <datalist id="qc-dashboard-category-options">
                  {categoryOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              <div style={{ ...styles.field, gridColumn: 'span 2' }}>
                <label style={styles.label}>Model Variant</label>
                <input
                  type="search"
                  value={regularModelVariantFilter}
                  autoComplete="off"
                  onMouseDown={() => {
                    if (regularModelVariantFilter) setRegularModelVariantFilter('')
                  }}
                  onChange={(event) => setRegularModelVariantFilter(event.target.value)}
                  style={styles.input}
                  placeholder="Search model or variant"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Sample</label>
                <select
                  value={sampleFilter}
                  onChange={(event) => setSampleFilter(event.target.value)}
                  style={styles.select}
                >
                  <option value="">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Grade</label>
                <select
                  value={regularGradeFilter}
                  onChange={(event) => setRegularGradeFilter(event.target.value)}
                  style={styles.select}
                >
                  <option value="">All Grade</option>
                  {regularGradeOptions.map((grade) => (
                    <option key={grade} value={grade}>Grade {grade}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {hasInvalidDateRange ? <p style={styles.errorText}>Date From cannot be later than Date To.</p> : null}

        {error ? <p style={styles.errorText}>{error}</p> : null}
        {success ? <p style={styles.successText}>{success}</p> : null}

      </div>

      <div style={styles.summaryTabs}>
        <div style={styles.summaryTabList}>
          <button
            type="button"
            onClick={() => setSummaryTab('result-summary')}
            style={{ ...styles.summaryTabButton, ...(summaryTab === 'result-summary' ? styles.summaryTabButtonActive : {}) }}
          >
            <span style={styles.summaryTabLabel}>Result Summary</span>
            {summaryTab === 'result-summary' ? <span style={styles.summaryTabUnderline} /> : null}
          </button>
          <button
            type="button"
            onClick={() => setSummaryTab('inspector-insights')}
            style={{ ...styles.summaryTabButton, ...(summaryTab === 'inspector-insights' ? styles.summaryTabButtonActive : {}) }}
          >
            <span style={styles.summaryTabLabel}>Performance Breakdown</span>
            {summaryTab === 'inspector-insights' ? <span style={styles.summaryTabUnderline} /> : null}
          </button>
        </div>

      {summaryTab === 'result-summary' ? (
        <div style={styles.summaryTabPanel}>
          <div style={styles.panelHeader}>
            <div>
              <p style={styles.panelEyebrow}>{activeSummaryLabel}</p>
              <h2 style={styles.sectionTitle}>Result Summary</h2>
            </div>
          </div>
        {qcMode === 'regular' && !grnFilter ? <p style={styles.emptyText}>Choose a GRN Number first to see QC result summary for that GRN.</p> : null}
        {(qcMode !== 'regular' || grnFilter) ? (
        <>
        <div style={styles.grid}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Grade A</span>
            <strong style={styles.summaryValue}>{totalGradeA}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Grade B</span>
            <strong style={styles.summaryValue}>{totalGradeB}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Grade C</span>
            <strong style={styles.summaryValue}>{totalGradeC}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Inspected</span>
            <strong style={styles.summaryValue}>{totalChecked}</strong>
          </div>
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {qcMode !== 'regular' ? null : <th style={styles.th}>Photo</th>}
                <th style={styles.th}>{qcMode !== 'regular' ? 'PO' : 'Brand'}</th>
                <th style={styles.th}>{qcMode !== 'regular' ? 'SKU' : 'Category'}</th>
                <th style={styles.th}>Model</th>
                {qcMode === 'regular' ? <th style={styles.th}>Variant</th> : null}
                {qcMode === 're_qc' ? <th style={{ ...styles.th, ...styles.thCenter }}>Round</th> : null}
                <th style={{ ...styles.th, ...styles.thCenter }}>Qty A</th>
                <th style={{ ...styles.th, ...styles.thCenter }}>Qty B</th>
                <th style={{ ...styles.th, ...styles.thCenter }}>Qty C</th>
                <th style={{ ...styles.th, ...styles.thCenter }}>Total Inspected</th>
                {showRegularSplitColumn ? <th style={{ ...styles.th, ...styles.thCenter }}>Split</th> : null}
                {qcMode !== 'regular' ? <th style={{ ...styles.th, ...styles.thCenter }}>Detail</th> : null}
              </tr>
            </thead>
            <tbody>
              {qcResultSummary.length ? (
                qcResultSummary.map((item) => {
                  const rejectTargetQty = Number(item.rejectTargetQty ?? getRejectQty(item))
                  return (
                  <tr key={`${item.brand}-${item.category}-${item.sampleSourceId || 'regular'}-${item.model}-${item.variant || ''}-${item.roundNumber || 'initial'}`}>
                    {qcMode !== 'regular' ? null : <td style={styles.td}>
                      {item.photoUrl ? (
                        <button type="button" style={styles.previewButton} onClick={() => setPreviewPhoto({ url: item.photoUrl, label: item.model })} title="Preview photo">
                          <img src={item.photoUrl} alt={item.model || 'Product photo'} style={styles.previewThumb} />
                          👁
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>}
                    <td style={styles.td}>{qcMode !== 'regular' && String(item.brand || '').trim().toUpperCase() === 'NO PO' ? '-' : item.brand}</td>
                    <td style={styles.td}>{item.category}</td>
                    <td style={styles.td}>{item.model}</td>
                    {qcMode === 'regular' ? <td style={styles.td}>{item.variant || '-'}</td> : null}
                    {qcMode === 're_qc' ? <td style={{ ...styles.td, ...styles.tdCenter }}>Round {item.roundNumber}</td> : null}
                    <td style={{ ...styles.td, ...styles.tdCenter }}>{item.qtyA}</td>
                    <td style={{ ...styles.td, ...styles.tdCenter }}>{item.qtyB}</td>
                    <td style={{ ...styles.td, ...styles.tdCenter }}>{item.qtyC}</td>
                    <td style={{ ...styles.td, ...styles.tdCenter }}>{item.checked}</td>
                    {showRegularSplitColumn ? (
                      <td style={{ ...styles.td, ...styles.tdCenter }}>
                        {item.isTemporarySampleSummary ? (
                          <button
                            type="button"
                            style={styles.detailButton}
                            onClick={() => openSampleSplitModal(item)}
                            title="Split sample QC result"
                          >
                            Split
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                    ) : null}
                    {qcMode !== 'regular' ? (
                      <td style={{ ...styles.td, ...styles.tdCenter }}>
                        <button
                          type="button"
                          style={styles.detailButton}
                          onClick={() => openRejectDetailModal(item)}
                          title={
                            canEditArklineRejectDetail
                              ? rejectTargetQty
                                ? 'Open Arkline reject detail'
                                : 'Open detail for adjustment'
                              : rejectDetailReadOnlyReason
                          }
                        >
                          Detail
                        </button>
                      </td>
                    ) : null}
                  </tr>
                  )
                })
              ) : (
                <tr>
                  <td style={styles.td} colSpan={qcMode === 're_qc' ? 9 : qcMode === 'arkline' ? 8 : showRegularSplitColumn ? 10 : 9}>
                    No QC result found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
        ) : null}
        </div>
      ) : null}

      {summaryTab === 'inspector-insights' ? (
        <div style={styles.summaryTabPanel}>
        <div style={styles.performanceGrid}>
          <div style={styles.performanceColumn}>
            <div>
              <p style={styles.panelEyebrow}>{activeSummaryLabel}</p>
              <h2 style={styles.performanceSubtitle}>Inspector Performance</h2>
            </div>
            {rankedInspectorPerformance.length ? (
              <div style={styles.inspectorCardGrid}>
                {rankedInspectorPerformance.map((item) => (
                  <div key={item.inspectorKey} style={styles.inspectorInsightCard}>
                    <div style={styles.inspectorTitleWrap}>
                      <p style={styles.inspectorCardName}>{item.inspector}</p>
                      <span style={styles.idleBadge}>
                        {item.nonProductiveHours} mins idle
                        {item.runningTaskCount ? ` | ${formatCompactTimer(item.activeLiveSeconds)} running` : ''}
                      </span>
                    </div>

                    <div style={styles.inspectorStatsGrid}>
                      <div style={styles.inspectorStatBox}>
                        <p style={styles.inspectorStatLabel}>Total pcs</p>
                        <p style={styles.inspectorStatValue}>{item.totalPcs.toLocaleString()}</p>
                      </div>
                      <div style={styles.inspectorStatBox}>
                        <p style={styles.inspectorStatLabel}>Avg / day</p>
                        <p style={styles.inspectorStatValue}>{item.avgPerDay}</p>
                      </div>
                      <div style={styles.inspectorStatBox}>
                        <p style={styles.inspectorStatLabel}>Pcs / min</p>
                        <p style={styles.inspectorStatValue}>{Number(item.rate || 0).toFixed(2)}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={() => setPauseDetailInspector(item.inspectorKey)}
                      disabled={!item.pauseLogs.length && !item.completedTaskRows.length && !item.activeTaskRows.length}
                    >
                      Detail
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={styles.emptyText}>No inspector data found for this filter.</p>
            )}
          </div>

          <div style={{ ...styles.performanceColumn, ...styles.performanceColumnDivider }}>
            <div>
              <p style={styles.panelEyebrow}>{activeSummaryLabel}</p>
              <h2 style={styles.performanceSubtitle}>Product Throughput</h2>
            </div>
            {rankedProductThroughputRows.length ? (
              rankedProductThroughputRows.map((item) => {
                const pct = maxProductThroughputSeconds ? Math.max(6, Math.round((Number(item.secondsPerPcs || 0) / maxProductThroughputSeconds) * 100)) : 0
                return (
                  <div key={`${item.category}-${item.label}`} style={styles.barRow}>
                    <span
                      style={styles.barLabel}
                      title={qcMode === 'regular' ? `Overall average: ${item.categoryAverageSeconds}s` : `${item.category} average: ${item.categoryAverageSeconds}s`}
                    >
                      {item.label}
                    </span>
                    <div style={styles.barTrack}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          borderRadius: '999px',
                          background: getThroughputBarColor(item.secondsPerPcs, item.categoryAverageSeconds),
                        }}
                      />
                    </div>
                    <span style={styles.barValue}>{item.secondsPerPcs}s</span>
                  </div>
                )
              })
            ) : (
              <p style={styles.emptyText}>
                {qcMode !== 'regular' ? 'No product timing data found for this filter.' : 'No category timing data found for this filter.'}
              </p>
            )}
          </div>
        </div>
        </div>
      ) : null}
      </div>

      {showPauseConfirm ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div>
              <h2 style={styles.sectionTitle}>Pause All QC?</h2>
              <p style={styles.subtitle}>All running QC stopwatches will be paused first, then each inspector can resume individually later.</p>
            </div>
            <div style={styles.buttonRow}>
              <button type="button" onClick={() => setShowPauseConfirm(false)} style={styles.secondaryButton}>
                Cancel
              </button>
              <button type="button" onClick={handlePauseAllQc} style={styles.dangerButton}>
                {pausingAll ? 'Pausing...' : 'Pause All QC'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewPhoto ? (
        <div style={styles.photoPreviewOverlay}>
          <div style={styles.photoPreviewWrap}>
            <Image
              src={previewPhoto.url}
              alt={previewPhoto.label}
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

      {sampleSplitSummary ? (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, ...styles.wideModal }}>
            <div style={styles.headerRow}>
              <div>
                <h2 style={styles.sectionTitle}>Split Sample</h2>
                <p style={styles.subtitle}>
                  {sampleSplitSummary.brand} / {sampleSplitSummary.category}
                </p>
              </div>
              <div style={styles.buttonRow}>
                <button type="button" onClick={closeSampleSplitModal} style={styles.secondaryButton}>
                  Close
                </button>
                <button
                  type="button"
                  onClick={saveSampleSplitRows}
                  disabled={savingSampleSplit || !supportsSampleSplit}
                  style={{
                    ...styles.primaryButton,
                    ...(savingSampleSplit || !supportsSampleSplit ? { opacity: 0.55, cursor: 'not-allowed' } : {}),
                  }}
                >
                  {savingSampleSplit ? 'Saving...' : 'Save Split'}
                </button>
              </div>
            </div>

            {!supportsSampleSplit ? (
              <div style={styles.warningBox}>Run `supabase/inbound_sample_breakdowns.sql` first before splitting sample QC.</div>
            ) : null}
            {!selectedSampleSplitBreakdowns.length ? (
              <div style={styles.warningBox}>Resolve Sample in Inbound first before splitting QC result.</div>
            ) : null}
            {sampleSplitError ? <p style={styles.errorText}>{sampleSplitError}</p> : null}

            <div style={styles.rejectDetailGrid}>
              <div style={{ ...styles.summaryCard, ...styles.compactSummaryCard }}>
                <span style={styles.summaryLabel}>QC Checked</span>
                <strong style={{ ...styles.summaryValue, ...styles.compactSummaryValue }}>{formatNumber(sampleSplitCheckedTotal)}</strong>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.compactSummaryCard }}>
                <span style={styles.summaryLabel}>Sample Qty</span>
                <strong style={{ ...styles.summaryValue, ...styles.compactSummaryValue }}>{formatNumber(sampleSplitSampleQtyTotal)}</strong>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.compactSummaryCard }}>
                <span style={styles.summaryLabel}>Draft A</span>
                <strong style={{ ...styles.summaryValue, ...styles.compactSummaryValue }}>{formatNumber(sampleSplitDraftTotals.qtyA)}</strong>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.compactSummaryCard }}>
                <span style={styles.summaryLabel}>Draft B</span>
                <strong style={{ ...styles.summaryValue, ...styles.compactSummaryValue }}>{formatNumber(sampleSplitDraftTotals.qtyB)}</strong>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.compactSummaryCard }}>
                <span style={styles.summaryLabel}>Draft C</span>
                <strong style={{ ...styles.summaryValue, ...styles.compactSummaryValue }}>{formatNumber(sampleSplitDraftTotals.qtyC)}</strong>
              </div>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Photo</th>
                    <th style={styles.th}>Model - Variant</th>
                    <th style={{ ...styles.th, ...styles.thCenter }}>A ({formatNumber(sampleSplitRemainingTotals.qtyA)})</th>
                    <th style={{ ...styles.th, ...styles.thCenter }}>B ({formatNumber(sampleSplitRemainingTotals.qtyB)})</th>
                    <th style={{ ...styles.th, ...styles.thCenter }}>C ({formatNumber(sampleSplitRemainingTotals.qtyC)})</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleSplitDraftRows.length ? (
                    sampleSplitDraftRows.map((row) => (
                      <tr key={row.id}>
                        <td style={styles.td}>
                          {row.photoUrl ? (
                            <button
                              type="button"
                              style={styles.previewButton}
                              onClick={() => setPreviewPhoto({ url: row.photoUrl, label: row.modelVariant })}
                              title="Preview photo"
                            >
                              <Image
                                src={row.photoUrl}
                                alt={row.modelVariant}
                                width={46}
                                height={46}
                                unoptimized
                                style={styles.previewThumb}
                              />
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td style={styles.td}>{row.modelVariant}</td>
                        {['qtyA', 'qtyB', 'qtyC'].map((field) => (
                          <td key={field} style={{ ...styles.td, ...styles.tdCenter }}>
                            <input
                              type="number"
                              min="0"
                              value={row[field]}
                              onChange={(event) => updateSampleSplitDraft(row.id, field, event.target.value)}
                              onWheel={(event) => event.currentTarget.blur()}
                              onKeyDown={(event) => {
                                if (['-', '+', 'e', 'E'].includes(event.key)) event.preventDefault()
                              }}
                              style={{ ...styles.input, width: '74px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
                              disabled={savingSampleSplit || !supportsSampleSplit}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td style={styles.td} colSpan={5}>
                        No sample split row available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {rejectDetailSummary ? (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, ...styles.wideModal }}>
            <div style={styles.headerRow}>
              <div>
                <h2 style={styles.sectionTitle}>Detail</h2>
                <p style={styles.subtitle}>
                  {rejectDetailSummary.brand} / {rejectDetailSummary.category} / {rejectDetailSummary.model}
                </p>
              </div>
              <div style={styles.buttonRow}>
                <button type="button" onClick={() => setRejectDetailSummary(null)} style={styles.secondaryButton}>
                  Close
                </button>
                {canEditArklineRejectDetail ? (
                  <button
                    type="button"
                    onClick={handleSaveRejectDetail}
                    disabled={savingRejectDetail}
                    style={{
                      ...styles.primaryButton,
                      ...(savingRejectDetail ? { opacity: 0.55, cursor: 'not-allowed' } : {}),
                    }}
                    title="Save detail"
                  >
                    {savingRejectDetail ? 'Saving...' : 'Save Detail'}
                  </button>
                ) : null}
              </div>
            </div>

            {!canEditArklineRejectDetail ? <div style={styles.warningBox}>{rejectDetailReadOnlyReason}</div> : null}
            {rejectDetailError ? <p style={{ color: '#dc2626', margin: 0 }}>{rejectDetailError}</p> : null}
            {success ? <p style={{ color: '#16a34a', margin: 0 }}>{success}</p> : null}

            <div style={styles.rejectDetailGrid}>
              <div style={{ ...styles.summaryCard, ...styles.compactSummaryCard }}>
                <span style={styles.summaryLabel}>Grade A</span>
                <strong style={{ ...styles.summaryValue, ...styles.compactSummaryValue }}>{selectedRejectPreviewSummary.qtyA}</strong>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.compactSummaryCard }}>
                <span style={styles.summaryLabel}>Grade B</span>
                <strong style={{ ...styles.summaryValue, ...styles.compactSummaryValue }}>{selectedRejectPreviewSummary.qtyB}</strong>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.compactSummaryCard }}>
                <span style={styles.summaryLabel}>Grade C</span>
                <strong style={{ ...styles.summaryValue, ...styles.compactSummaryValue }}>{selectedRejectPreviewSummary.qtyC}</strong>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.compactSummaryCard }}>
                <span style={styles.summaryLabel}>Checked Preview</span>
                <strong style={{ ...styles.summaryValue, ...styles.compactSummaryValue }}>{selectedRejectPreviewChecked}</strong>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.compactSummaryCard }}>
                <span style={styles.summaryLabel}>Gap</span>
                <strong style={{ ...styles.summaryValue, ...styles.compactSummaryValue, color: selectedRejectGap === 0 ? '#111827' : '#dc2626' }}>
                  {selectedRejectGap > 0 ? '+' : ''}
                  {selectedRejectGap}
                </strong>
              </div>
            </div>

            {canEditArklineRejectDetail ? (
              <div style={styles.inspectorSection}>
                <button type="button" style={{ ...styles.inspectorSectionHeader, cursor: 'default' }}>
                  <span style={styles.inspectorSectionTitle}>Detail Summary</span>
                  <span style={styles.inspectorSectionMeta}>{selectedRejectInspectorRows.length} inspectors</span>
                </button>
                <div style={styles.inspectorSectionBody}>
                  {renderRejectInspectorTable()}
                </div>
              </div>
            ) : null}

            {!canEditArklineRejectDetail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {renderReadOnlyRejectSection(
                  'rejectDetail',
                  'Arkline Reject Detail',
                  `${formatNumber(readOnlyRejectReasonSummaryRows.reduce((sum, item) => sum + Number(item.totalQty || 0), 0))} qty`,
                  renderReadOnlyRejectSummaryTable()
                )}
                {renderReadOnlyRejectSection(
                  'adjustment',
                  'Adjustment',
                  `${formatNumber(selectedRejectExistingAdjustments.length)} rows`,
                  renderRejectAdjustmentTable()
                )}
                {renderReadOnlyRejectSection(
                  'timeline',
                  'Grading Timeline',
                  `${formatNumber(readOnlyRejectTimelineRows.length)} dates`,
                  renderReadOnlyRejectTimelineTable()
                )}
                {renderReadOnlyRejectSection(
                  'inspector',
                  'Inspector in Charge',
                  `${formatNumber(selectedRejectInspectorRows.length)} inspectors`,
                  renderRejectInspectorTable()
                )}
              </div>
            ) : (
              <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={styles.headerRow}>
                <div>
                  <h3 style={{ ...styles.sectionTitle, fontSize: '16px' }}>Arkline Reject Detail</h3>
                </div>
              </div>

              <datalist id="arkline-reject-size-options">
                {selectedRejectSizeOptions.map((size) => (
                  <option key={size} value={size} />
                ))}
              </datalist>

              <div style={styles.rejectRowHeader}>
                <span style={styles.label}>Grade</span>
                <span style={styles.label}>Reason</span>
                <span style={styles.label}>Qty</span>
                <span style={styles.label}>Size</span>
                <span style={{ ...styles.label, textAlign: 'right' }}>Action</span>
              </div>

              {displayRejectDraftRows.map((row, index) => (
                <div key={row.id} style={styles.rejectRowGrid}>
                  <div style={styles.field}>
                    <select
                      value={row.grade}
                      onChange={(event) => updateRejectDraftRow(row.id, 'grade', event.target.value)}
                      style={{ ...styles.select, ...(!canEditArklineRejectDetail ? styles.disabledInput : {}) }}
                      disabled={!canEditArklineRejectDetail}
                    >
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                  </div>
                  <div style={styles.field}>
                    <select
                      value={row.rejectReasonId}
                      onChange={(event) => updateRejectDraftRow(row.id, 'rejectReasonId', event.target.value)}
                      style={{ ...styles.select, ...(!canEditArklineRejectDetail ? styles.disabledInput : {}) }}
                      disabled={!canEditArklineRejectDetail}
                    >
                      <option value="">Choose reason</option>
                      {selectedRejectReasonOptions.map((reason) => (
                        <option key={reason.id} value={reason.id}>
                          {reason.reason_name}
                        </option>
                      ))}
                      <option value="__new__">Add new reason</option>
                    </select>
                    {row.rejectReasonId === '__new__' ? (
                      <input
                        value={row.newReasonName}
                        onChange={(event) => updateRejectDraftRow(row.id, 'newReasonName', event.target.value)}
                        style={{ ...styles.input, ...(!canEditArklineRejectDetail ? styles.disabledInput : {}) }}
                        disabled={!canEditArklineRejectDetail}
                        placeholder="New reject reason"
                      />
                    ) : null}
                  </div>
                  <div style={styles.field}>
                    <input
                      type="number"
                      min="0"
                      value={row.qty}
                      onChange={(event) => updateRejectDraftRow(row.id, 'qty', event.target.value)}
                      style={{ ...styles.input, ...(!canEditArklineRejectDetail ? styles.disabledInput : {}) }}
                      disabled={!canEditArklineRejectDetail}
                    />
                  </div>
                  <div style={styles.field}>
                    <input
                      value={row.size}
                      onChange={(event) => updateRejectDraftRow(row.id, 'size', event.target.value)}
                      style={{ ...styles.input, ...(!canEditArklineRejectDetail ? styles.disabledInput : {}) }}
                      disabled={!canEditArklineRejectDetail}
                      list="arkline-reject-size-options"
                      placeholder={selectedRejectSizeOptions.length ? 'Choose size' : 'Size'}
                    />
                  </div>
                  <div style={styles.iconButtonRow}>
                    <button
                      type="button"
                      style={styles.iconSmallButton}
                      onClick={() => setRejectDraftRows((rows) => [...rows, createRejectDraftRow()])}
                      title="Add row"
                      aria-label="Add row"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      style={styles.iconSmallButton}
                      onClick={() => removeRejectDraftRow(row.id)}
                      title={displayRejectDraftRows.length > 1 ? 'Remove row' : 'Clear row'}
                      aria-label={displayRejectDraftRows.length > 1 ? 'Remove row' : 'Clear row'}
                    >
                      X
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <h3 style={{ ...styles.sectionTitle, fontSize: '16px' }}>Adjustment</h3>
                <p style={styles.smallNote}>
                  Submit adjustments one by one so the history stays clear. Transfer moves qty between grades; QC Inspector Error reduces the selected grade.
                </p>
              </div>
              {selectedRejectGap !== 0 ? (
                <div style={styles.warningBox}>
                  Gap is still {selectedRejectGap}. Only adjustments within the active date filter affect this gap.
                </div>
              ) : null}
              <div style={{ ...styles.summaryCard, gap: '10px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(150px, 0.9fr) 88px 88px 100px minmax(240px, 1.5fr) auto',
                    gap: '10px',
                    alignItems: 'end',
                  }}
                >
                  <div style={styles.field}>
                    <label style={styles.label}>Adjustment Type</label>
                    <select
                      value={rejectAdjustmentDraft.adjustmentType}
                      onChange={(event) =>
                        setRejectAdjustmentDraft((draft) => ({
                          ...draft,
                          adjustmentType: event.target.value,
                          fromGrade: '',
                          toGrade: '',
                          affectedGrade: '',
                        }))
                      }
                      style={{ ...styles.select, ...(!canEditArklineRejectDetail ? styles.disabledInput : {}) }}
                      disabled={!canEditArklineRejectDetail}
                    >
                      <option value="transfer">Transfer</option>
                      <option value="inspector_data_error">QC Inspector Error</option>
                    </select>
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>{rejectAdjustmentDraft.adjustmentType === 'transfer' ? 'From' : 'Grade'}</label>
                    <select
                      value={rejectAdjustmentDraft.adjustmentType === 'transfer' ? rejectAdjustmentDraft.fromGrade : rejectAdjustmentDraft.affectedGrade}
                      onChange={(event) =>
                        setRejectAdjustmentDraft((draft) =>
                          draft.adjustmentType === 'transfer'
                            ? { ...draft, fromGrade: event.target.value, toGrade: draft.toGrade === event.target.value ? '' : draft.toGrade }
                            : { ...draft, affectedGrade: event.target.value }
                        )
                      }
                      style={{ ...styles.select, ...(!canEditArklineRejectDetail ? styles.disabledInput : {}) }}
                      disabled={!canEditArklineRejectDetail}
                    >
                      <option value="">Choose</option>
                      {QC_GRADE_OPTIONS.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>To</label>
                    <select
                      value={rejectAdjustmentDraft.toGrade}
                      onChange={(event) => setRejectAdjustmentDraft((draft) => ({ ...draft, toGrade: event.target.value }))}
                      style={{
                        ...styles.select,
                        ...(!canEditArklineRejectDetail ||
                        rejectAdjustmentDraft.adjustmentType !== 'transfer' ||
                        !rejectAdjustmentDraft.fromGrade
                          ? styles.disabledInput
                          : {}),
                      }}
                      disabled={!canEditArklineRejectDetail || rejectAdjustmentDraft.adjustmentType !== 'transfer' || !rejectAdjustmentDraft.fromGrade}
                    >
                      <option value="">{rejectAdjustmentDraft.fromGrade ? 'Choose' : 'Choose From first'}</option>
                      {QC_GRADE_OPTIONS.filter((grade) => grade !== rejectAdjustmentDraft.fromGrade).map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={rejectAdjustmentDraft.qty}
                      onChange={(event) => setRejectAdjustmentDraft((draft) => ({ ...draft, qty: event.target.value }))}
                      style={{ ...styles.input, ...(!canEditArklineRejectDetail ? styles.disabledInput : {}) }}
                      disabled={!canEditArklineRejectDetail}
                      placeholder="Qty"
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Notes</label>
                    <input
                      value={rejectAdjustmentDraft.notes}
                      onChange={(event) => setRejectAdjustmentDraft((draft) => ({ ...draft, notes: event.target.value }))}
                      style={{ ...styles.input, ...(!canEditArklineRejectDetail ? styles.disabledInput : {}) }}
                      disabled={!canEditArklineRejectDetail}
                      placeholder="Notes"
                    />
                  </div>
                  <div style={{ ...styles.iconButtonRow, justifyContent: 'flex-start' }}>
                    <button
                      type="button"
                      onClick={handleSubmitRejectAdjustment}
                      disabled={savingRejectDetail || !canEditArklineRejectDetail}
                      style={{
                        ...styles.primaryButton,
                        ...(!canEditArklineRejectDetail || savingRejectDetail ? { opacity: 0.55, cursor: 'not-allowed' } : {}),
                      }}
                    >
                      Submit Adjustment
                    </button>
                  </div>
                </div>
              </div>

              {renderRejectAdjustmentTable()}
            </div>

            {renderSavedRejectDetailTable()}
              </>
            )}

          </div>
        </div>
      ) : null}

      {pauseDetailInspector ? (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, ...styles.wideModal, ...styles.inspectorModal }}>
            <div style={styles.inspectorModalHeader}>
              <div style={styles.headerRow}>
                <h2 style={styles.sectionTitle}>
                  Inspector Detail -{' '}
                  {memberNameMap[pauseDetailInspector] || (pauseDetailInspector === '-' ? 'Unassigned' : 'Unknown Inspector')}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setPauseDetailInspector('')
                    setInspectorDetailSections({
                      nonProductive: false,
                      finished: false,
                      active: false,
                    })
                  }}
                  style={{ height: '42px', padding: '0 16px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: '#111827', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={styles.inspectorModalContent}>
              <div style={styles.modalGrid}>
                <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Non-Productive Minutes</span>
                  <strong style={styles.summaryValue}>{selectedInspectorPerformance?.nonProductiveHours || 0}</strong>
                </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Qty Checked</span>
                  <strong style={styles.summaryValue}>{selectedInspectorCheckedQty}</strong>
                </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Active Tasks</span>
                  <strong style={styles.summaryValue}>{selectedInspectorPerformance?.activeTaskCount || 0}</strong>
                </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Active Allocated Qty</span>
                  <strong style={styles.summaryValue}>{selectedInspectorPerformance?.activeAllocatedQty || 0}</strong>
                </div>
              </div>

              <div style={styles.inspectorSection}>
                <button type="button" style={styles.inspectorSectionHeader} onClick={() => toggleInspectorDetailSection('nonProductive')}>
                  <span style={styles.inspectorSectionTitle}>Non-Productive Detail</span>
                  <span style={styles.inspectorSectionMeta}>
                    {selectedInspectorPauseLogs.length} rows {inspectorDetailSections.nonProductive ? '▲' : '▼'}
                  </span>
                </button>
                {inspectorDetailSections.nonProductive ? (
                  <div style={styles.inspectorSectionBody}>
                    <div style={styles.inspectorTableWrap}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>Reason</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>Paused At</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>Resumed At</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>Minutes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInspectorPauseLogs.length ? (
                            selectedInspectorPauseLogs.map((item, index) => (
                              <tr key={`${item.id}-${item.paused_at || 'pause'}-${index}`}>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.pause_reason || '-'}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{formatDisplayDate(item.paused_at)}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{formatDisplayDate(item.resumed_at)}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{formatMinutes(getPauseDurationSeconds(item))}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td style={{ ...styles.td, ...styles.inspectorTd }} colSpan={4}>
                                No non-productive activity detail found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={styles.inspectorSection}>
                <button type="button" style={styles.inspectorSectionHeader} onClick={() => toggleInspectorDetailSection('finished')}>
                  <span style={styles.inspectorSectionTitle}>Qty Checked</span>
                  <span style={styles.inspectorSectionMeta}>
                    {selectedInspectorCompletedTaskRows.length} rows {inspectorDetailSections.finished ? '▲' : '▼'}
                  </span>
                </button>
                {inspectorDetailSections.finished ? (
                  <div style={styles.inspectorSectionBody}>
                    <div style={styles.inspectorTableWrap}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>{qcMode !== 'regular' ? 'PO' : 'GRN'}</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>{qcMode !== 'regular' ? 'SKU' : 'Category'}</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>{qcMode === 'regular' ? 'Model-Variant' : 'Model'}</th>
                            <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>A</th>
                            <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>B</th>
                            <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>C</th>
                            <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Checked</th>
                            <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Rate</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>Finished At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInspectorCompletedTaskRows.length ? (
                            selectedInspectorCompletedTaskRows.map((item, index) => (
                              <tr key={`${item.id}-${item.finishedAt || 'done'}-${index}`}>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.source}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.category}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.model}</td>
                                <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.qtyA}</td>
                                <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.qtyB}</td>
                                <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.qtyC}</td>
                                <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.checkedQty}</td>
                                <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.rate ?? '-'}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{formatDisplayDate(item.finishedAt)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td style={{ ...styles.td, ...styles.inspectorTd }} colSpan={9}>
                                No finished QC found for this inspector.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={styles.inspectorSection}>
                <button type="button" style={styles.inspectorSectionHeader} onClick={() => toggleInspectorDetailSection('active')}>
                  <span style={styles.inspectorSectionTitle}>Active Allocation</span>
                  <span style={styles.inspectorSectionMeta}>
                    {selectedInspectorActiveTaskRows.length} rows {inspectorDetailSections.active ? '▲' : '▼'}
                  </span>
                </button>
                {inspectorDetailSections.active ? (
                  <div style={styles.inspectorSectionBody}>
                    <div style={styles.inspectorTableWrap}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>{qcMode !== 'regular' ? 'PO' : 'GRN'}</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>{qcMode !== 'regular' ? 'SKU' : 'Category'}</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>{qcMode === 'regular' ? 'Model-Variant' : 'Model'}</th>
                            <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Allocated</th>
                            <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Checked</th>
                            <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Remaining</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInspectorActiveTaskRows.length ? (
                            selectedInspectorActiveTaskRows.map((item, index) => (
                              <tr key={`${item.id}-${item.status || 'active'}-${index}`}>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.source}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.category}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.model}</td>
                                <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.allocatedQty}</td>
                                <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.checkedQty}</td>
                                <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.remainingQty}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.status}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td style={{ ...styles.td, ...styles.inspectorTd }} colSpan={7}>
                                No active allocation found for this inspector.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
