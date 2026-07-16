'use client'

import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()
const PRODUCT_PHOTOS_BUCKET = 'product-photos'
const PL_RETURN_SOURCE_PHASE = 'Packing List'
const PL_RETURN_SOURCE_PHASES = [PL_RETURN_SOURCE_PHASE, 'packing_list']
const SIZE_CHART_FIELDS = ['weight_value', 'length_value', 'width_value', 'width_afterpull', 'sleeve_length', 'thigh_width']

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  panel: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '22px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  headerMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  editorActionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'nowrap',
    justifyContent: 'flex-end',
  },
  segmentedToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px',
    borderRadius: '999px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    width: 'max-content',
  },
  segmentedButton: {
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
  segmentedButtonActive: {
    background: '#fff',
    color: '#0f172a',
    borderColor: '#cbd5e1',
    boxShadow: '0 6px 14px rgba(15, 23, 42, 0.08)',
  },
  toolIconButton: {
    width: '40px',
    height: '40px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '17px',
    fontWeight: 900,
  },
  toolIconButtonPrimary: {
    background: '#0f766e',
    borderColor: '#99f6e4',
    color: '#fff',
    boxShadow: '0 8px 18px rgba(15, 118, 110, 0.16)',
  },
  toolIconButtonActive: {
    background: '#0f172a',
    borderColor: '#0f172a',
    color: '#fff',
  },
  eyebrow: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#64748b',
  },
  titleLine: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
    flexWrap: 'wrap',
  },
  title: {
    margin: '4px 0 0',
    fontSize: '28px',
    lineHeight: 1.05,
    fontWeight: 900,
    color: '#0f172a',
  },
  grnChip: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '42px',
    padding: '0 16px',
    borderRadius: '14px',
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    color: '#0f172a',
    fontSize: '24px',
    fontWeight: 950,
    letterSpacing: '-0.03em',
    fontVariantNumeric: 'tabular-nums',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#475569',
    fontSize: '13px',
    lineHeight: 1.45,
  },
  iconButton: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    border: '1px solid #fecaca',
    background: '#fff',
    color: '#dc2626',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 900,
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '12px',
  },
  metricPillGrid: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  compactMetricPillGrid: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  metricPill: {
    minHeight: '40px',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    background: '#f8fafc',
    padding: '6px 10px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '2px',
  },
  metricPillLabel: {
    color: '#64748b',
    fontSize: '9px',
    fontWeight: 900,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  metricPillValue: {
    color: '#0f172a',
    fontSize: '16px',
    lineHeight: 1,
    fontWeight: 950,
    fontVariantNumeric: 'tabular-nums',
  },
  metricCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 850,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#0f172a',
    fontSize: '24px',
    fontWeight: 950,
    fontVariantNumeric: 'tabular-nums',
  },
  section: {
    borderTop: '1px solid #e5e7eb',
    paddingTop: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    color: '#111827',
    fontSize: '20px',
    fontWeight: 900,
  },
  sectionSubtitle: {
    margin: '4px 0 0',
    color: '#64748b',
    fontSize: '13px',
  },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    alignItems: 'end',
  },
  multipageTableShell: {
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '18px',
    overflow: 'hidden',
    background: '#fff',
  },
  multipageTabs: {
    display: 'flex',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: '4px',
    minHeight: '46px',
    padding: '4px 8px 0 4px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#e2e8f0',
    background: '#fff',
  },
  multipageTabButton: {
    minHeight: '40px',
    marginBottom: '-1px',
    padding: '0 14px',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: '2px',
    borderLeftWidth: 0,
    borderStyle: 'solid',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRadius: 0,
    background: 'transparent',
    color: '#475569',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'color 140ms ease, border-color 140ms ease',
  },
  filterField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: '0 1 160px',
  },
  filterLabel: {
    color: '#64748b',
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  filterSelect: {
    width: '100%',
    height: '38px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    padding: '0 10px',
    fontSize: '13px',
    fontWeight: 700,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))',
    gap: '10px',
  },
  productCard: {
    position: 'relative',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '14px',
    background: '#fff',
    padding: '4px',
    aspectRatio: '1 / 1',
    display: 'block',
    cursor: 'pointer',
    overflow: 'visible',
    transition: 'box-shadow 160ms ease, border-color 160ms ease',
  },
  productCardActive: {
    borderColor: '#0f766e',
    boxShadow: '0 0 0 3px rgba(15, 118, 110, 0.12)',
  },
  productCardPreview: {
    zIndex: 10,
    boxShadow: '0 12px 24px rgba(15, 23, 42, 0.14)',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '10px',
    background: '#f1f5f9',
    transition: 'transform 160ms ease',
  },
  noPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: '10px',
    background: '#f1f5f9',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 900,
  },
  cardPopover: {
    position: 'absolute',
    left: '50%',
    bottom: 'calc(100% + 10px)',
    transform: 'translateX(-50%)',
    zIndex: 8,
    width: '220px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '14px',
    background: '#fff',
    padding: '10px',
    boxShadow: '0 18px 36px rgba(15, 23, 42, 0.18)',
    pointerEvents: 'none',
  },
  cardPopoverBelow: {
    top: 'calc(100% + 10px)',
    bottom: 'auto',
  },
  cardPopoverEyebrow: {
    display: 'block',
    color: '#64748b',
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  cardTitle: {
    display: 'block',
    marginTop: '3px',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: 900,
    lineHeight: 1.25,
  },
  cardMeta: {
    display: 'block',
    marginTop: '4px',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 750,
    lineHeight: 1.35,
  },
  statusPill: {
    alignSelf: 'flex-start',
    minHeight: '24px',
    padding: '4px 9px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 900,
  },
  statusEmpty: {
    background: '#f1f5f9',
    color: '#64748b',
  },
  statusProgress: {
    background: '#fff7ed',
    color: '#c2410c',
  },
  statusComplete: {
    background: '#ecfdf5',
    color: '#047857',
  },
  editorGrid: {
    display: 'grid',
    gridTemplateColumns: '320px minmax(0, 1fr)',
    gap: '18px',
    alignItems: 'start',
  },
  featureCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    background: '#f8fafc',
  },
  featureMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sourceInline: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '24px',
    padding: '0 8px',
    borderRadius: '999px',
    background: '#e0f2fe',
    color: '#075985',
    fontSize: '11px',
    fontWeight: 900,
    width: 'max-content',
  },
  modelLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  modelNameStrong: {
    color: '#0f172a',
    fontSize: '16px',
    lineHeight: 1.25,
    fontWeight: 950,
  },
  qtyCheckerRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(120px, 0.8fr) minmax(0, 1fr)',
    gap: '10px',
    alignItems: 'end',
  },
  qtyTotalBox: {
    minWidth: '72px',
    minHeight: '40px',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0f172a',
    padding: '0 12px',
    fontSize: '22px',
    lineHeight: 1,
    fontWeight: 950,
    fontVariantNumeric: 'tabular-nums',
  },
  editorQtyGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  editorQtyBox: {
    minWidth: '96px',
    minHeight: '42px',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    background: '#fff',
    padding: '6px 10px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '2px',
  },
  editorQtyLabel: {
    color: '#64748b',
    fontSize: '9px',
    fontWeight: 900,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  editorQtyValue: {
    color: '#0f172a',
    fontSize: '16px',
    lineHeight: 1,
    fontWeight: 950,
    fontVariantNumeric: 'tabular-nums',
  },
  featureImage: {
    width: '100%',
    height: '240px',
    objectFit: 'cover',
    borderRadius: '12px',
    background: '#f1f5f9',
  },
  featureNoPhoto: {
    width: '100%',
    height: '240px',
    borderRadius: '12px',
    background: '#f1f5f9',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 900,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  label: {
    color: '#334155',
    fontSize: '12px',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    height: '40px',
    boxSizing: 'border-box',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '0 10px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '14px',
  },
  textarea: {
    width: '100%',
    minHeight: '82px',
    boxSizing: 'border-box',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '10px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '14px',
    resize: 'vertical',
  },
  readonlyBox: {
    minHeight: '40px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#f8fafc',
    padding: '9px 10px',
    color: '#0f172a',
    fontSize: '14px',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
  },
  plRow: {
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: '#fff',
  },
  plRowHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  plIdBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '28px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#e0f2fe',
    color: '#075985',
    fontSize: '13px',
    fontWeight: 950,
  },
  rowGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '10px',
  },
  sizeRow: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    background: '#fff',
  },
  sizeMainGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(120px, 1fr) minmax(120px, 1fr) 88px',
    gap: '8px',
    alignItems: 'end',
  },
  sizeHeaderGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(110px, 1fr) minmax(100px, 0.8fr) minmax(190px, 1.25fr) 88px',
    gap: '8px',
    alignItems: 'center',
  },
  sizeHeaderCell: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  sizeInputRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(110px, 1fr) minmax(100px, 0.8fr) minmax(190px, 1.25fr) 88px',
    gap: '8px',
    alignItems: 'center',
  },
  checkerPicker: {
    position: 'relative',
  },
  checkerPickerButton: {
    width: '100%',
    minHeight: '40px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '10px',
    background: '#fff',
    padding: '0 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    cursor: 'pointer',
  },
  checkerSummaryText: {
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  checkerPlusText: {
    color: '#0f766e',
    fontSize: '14px',
    fontWeight: 950,
    flexShrink: 0,
  },
  checkerMenu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    zIndex: 20,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '12px',
    background: '#fff',
    boxShadow: '0 16px 32px rgba(15, 23, 42, 0.14)',
    padding: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '220px',
    overflowY: 'auto',
  },
  checkerOption: {
    minHeight: '34px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: '9px',
    background: '#fff',
    color: '#0f172a',
    padding: '0 8px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    textAlign: 'left',
  },
  checkerOptionActive: {
    background: '#ecfeff',
    borderColor: '#67e8f9',
    color: '#155e75',
  },
  checkerRadio: {
    width: '14px',
    height: '14px',
    borderRadius: '999px',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    flexShrink: 0,
  },
  checkerRadioActive: {
    borderColor: '#0f766e',
    boxShadow: 'inset 0 0 0 3px #fff',
    background: '#0f766e',
  },
  measurementPanel: {
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    background: '#f8fafc',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowX: 'auto',
  },
  sizeChartShortcut: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) auto',
    gap: '8px',
    alignItems: 'end',
    minWidth: '520px',
  },
  measurementHeaderGrid: {
    display: 'grid',
    gridTemplateColumns: '90px 70px repeat(6, minmax(120px, 1fr))',
    gap: '8px',
    alignItems: 'center',
    minWidth: '920px',
  },
  measurementInputGrid: {
    display: 'grid',
    gridTemplateColumns: '90px 70px repeat(6, minmax(120px, 1fr))',
    gap: '8px',
    alignItems: 'center',
    minWidth: '920px',
  },
  buttonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  primaryButton: {
    minHeight: '40px',
    padding: '0 14px',
    border: 'none',
    borderRadius: '10px',
    background: '#0f766e',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  saveButton: {
    minWidth: '96px',
    flexShrink: 0,
    textAlign: 'center',
  },
  modeButtonActive: {
    background: '#0f172a',
    color: '#fff',
    borderColor: '#0f172a',
  },
  tableWrap: {
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    overflowX: 'auto',
    background: '#fff',
  },
  embeddedTableWrap: {
    overflowX: 'auto',
    background: '#fff',
  },
  embeddedEmpty: {
    margin: 0,
    padding: '24px 18px',
    background: '#fff',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '760px',
  },
  th: {
    padding: '12px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    color: '#475569',
    fontSize: '11px',
    fontWeight: 900,
    textTransform: 'uppercase',
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  td: {
    padding: '12px',
    borderTop: '1px solid #f1f5f9',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: 800,
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  tablePhoto: {
    width: '54px',
    height: '54px',
    borderRadius: '12px',
    objectFit: 'cover',
    background: '#f1f5f9',
    cursor: 'pointer',
  },
  tableNoPhoto: {
    width: '54px',
    height: '54px',
    borderRadius: '12px',
    background: '#f1f5f9',
    color: '#94a3b8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    fontWeight: 900,
  },
  sizeSummary: {
    display: 'flex',
    justifyContent: 'center',
    gap: '5px',
    flexWrap: 'wrap',
  },
  previewOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.72)',
    zIndex: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px',
  },
  previewFrame: {
    position: 'relative',
    display: 'inline-flex',
    maxWidth: 'min(92vw, 900px)',
    maxHeight: '86vh',
  },
  previewImage: {
    display: 'block',
    width: 'auto',
    height: 'auto',
    maxWidth: 'min(92vw, 900px)',
    maxHeight: '86vh',
    objectFit: 'contain',
  },
  previewClose: {
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
  sizeChip: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '22px',
    padding: '2px 7px',
    borderRadius: '999px',
    background: '#eef2ff',
    color: '#3730a3',
    fontSize: '11px',
    fontWeight: 900,
  },
  secondaryButton: {
    minHeight: '40px',
    padding: '0 14px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  compactResetButton: {
    width: '38px',
    minHeight: '38px',
    padding: 0,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '999px',
    background: '#fff',
    color: '#475569',
    fontSize: '16px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  dangerButton: {
    minHeight: '40px',
    padding: '0 14px',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    background: '#fff',
    color: '#dc2626',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  disabledButton: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  emptyText: {
    margin: 0,
    color: '#64748b',
    fontSize: '14px',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
    fontSize: '13px',
    fontWeight: 800,
  },
  successText: {
    margin: 0,
    color: '#047857',
    fontSize: '13px',
    fontWeight: 800,
  },
  saveFeedback: {
    minHeight: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
  },
  saveFeedbackText: {
    margin: 0,
    fontSize: '12px',
    fontWeight: 900,
    lineHeight: 1.35,
    textAlign: 'right',
  },
  editorFieldset: {
    border: 'none',
    padding: 0,
    margin: 0,
    minWidth: 0,
  },
  lockedArea: {
    opacity: 0.7,
    pointerEvents: 'none',
  },
  thumb: {
    width: '80px',
    height: '80px',
    objectFit: 'cover',
    borderRadius: '10px',
  },
  photoDetailHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  photoAddButton: {
    minHeight: '32px',
    padding: '0 10px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '9px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '12px',
    fontWeight: 900,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  photoThumbWrap: {
    position: 'relative',
    width: '62px',
    height: '62px',
  },
  photoThumbButton: {
    width: '62px',
    height: '62px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '12px',
    padding: 0,
    background: '#fff',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  photoThumbButtonActive: {
    borderColor: '#0f766e',
    boxShadow: '0 0 0 3px rgba(15, 118, 110, 0.14)',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  photoRemoveButton: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    width: '22px',
    height: '22px',
    borderRadius: '999px',
    border: '1px solid #fecaca',
    background: '#fff',
    color: '#dc2626',
    fontSize: '12px',
    fontWeight: 950,
    lineHeight: 1,
    cursor: 'pointer',
  },
  mainPhotoBadge: {
    position: 'absolute',
    left: '4px',
    bottom: '4px',
    minHeight: '17px',
    padding: '0 5px',
    borderRadius: '999px',
    background: 'rgba(15, 118, 110, 0.92)',
    color: '#fff',
    fontSize: '8px',
    fontWeight: 950,
    display: 'inline-flex',
    alignItems: 'center',
  },
  setMainPhotoButton: {
    position: 'absolute',
    left: '4px',
    bottom: '4px',
    minHeight: '17px',
    padding: '0 5px',
    border: 'none',
    borderRadius: '999px',
    background: 'rgba(15, 23, 42, 0.82)',
    color: '#fff',
    fontSize: '8px',
    fontWeight: 950,
    cursor: 'pointer',
  },
  hiddenFileInput: {
    display: 'none',
  },
}

function normalize(value) {
  return String(value || '').trim().toUpperCase()
}

function getModelKey(modelName, catalogName) {
  return `${normalize(modelName)}::${normalize(catalogName)}`
}

function getCatalogName(row = {}) {
  return row.catalogName || row.variant_name || row.variant_label || row.variant_code || row.model_color || ''
}

function getVariantCode(row = {}) {
  return row.sku_code || row.sku || row.source_variant_code || row.variant_code || row.variant_label || ''
}

function normalizePhotoUrls(value, fallback = '') {
  let photos = []
  if (Array.isArray(value)) {
    photos = value
  } else if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      photos = JSON.parse(value)
    } catch {
      photos = []
    }
  } else if (value) {
    photos = [value]
  }

  if (fallback) {
    photos = [fallback, ...photos]
  }

  return Array.from(new Set(photos.map((item) => String(item || '').trim()).filter(Boolean)))
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

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'pl-detail-photo'
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
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

function getProductPhotoStoragePath(photoUrl) {
  const marker = `/storage/v1/object/public/${PRODUCT_PHOTOS_BUCKET}/`
  const index = String(photoUrl || '').indexOf(marker)
  if (index < 0) return ''
  return decodeURIComponent(String(photoUrl).slice(index + marker.length).split('?')[0] || '')
}

function getModelLabel(row = {}) {
  const catalogName = getCatalogName(row)
  return catalogName ? `${row.model_name || '-'} / ${catalogName}` : row.model_name || '-'
}

function getOverviewModelVariantLabel(row = {}) {
  const modelName = String(row.model_name || '').trim()
  const catalogName = String(getCatalogName(row) || '').trim()
  if (!modelName || !catalogName) return ''
  return `${modelName} / ${catalogName}`
}

function getCategoryPath(category = {}, categoryById = new Map()) {
  if (!category) return []

  const path = []
  const visited = new Set()
  let current = category

  while (current?.id && !visited.has(Number(current.id))) {
    visited.add(Number(current.id))
    path.unshift(String(current.category_name || current.name || '').trim())
    current = categoryById.get(Number(current.parent_id || 0))
  }

  const cleanPath = path.filter(Boolean)
  if (cleanPath.length > 1) return cleanPath

  const fullName = String(category.full_name || '').trim()
  if (fullName.includes('>')) {
    return fullName.split('>').map((item) => item.trim()).filter(Boolean)
  }

  return cleanPath.length ? cleanPath : fullName ? [fullName] : []
}

function getCategoryPathLabel(card = {}) {
  return (card.category_path || []).filter(Boolean).join(' > ')
}

function getUniqueOptions(items = []) {
  return [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

function matchesModelFilter(card = {}, filters = {}, excludeKey = '') {
  if (excludeKey !== 'brand' && filters.brand && (card.brand_name || 'UNBRANDED') !== filters.brand) return false
  if (excludeKey !== 'categoryPath' && filters.categoryPath && getCategoryPathLabel(card) !== filters.categoryPath) return false
  if (excludeKey !== 'model' && filters.model && getModelLabel(card) !== filters.model) return false
  return true
}

function createEmptySizeRow(index = 0) {
  return {
    id: `size-${Date.now()}-${index}`,
    breakdown_row_id: null,
    size_label: '',
    qty: '',
    checker_names: [],
    weight_value: '',
    length_value: '',
    width_value: '',
    width_afterpull: '',
    sleeve_length: '',
    thigh_width: '',
  }
}

function createEmptyReturnRow(index = 0) {
  return {
    id: `return-${Date.now()}-${index}`,
    warehouse_return_id: null,
    size_label: 'RETURN',
    qty: '',
    return_reason: '',
  }
}

function createPlRow(card, sequence = null, order = 1) {
  return {
    id: `pl-${Date.now()}-${order}`,
    pl_detail_seq: sequence,
    detail_order: order,
    pl_name: String(getModelLabel(card) || 'PL Item').toUpperCase(),
    pl_notes: '',
    pl_photo_url: '',
    pl_photo_urls: [],
    sizeRows: [createEmptySizeRow()],
    returnRows: [],
  }
}

function getLetterFromIndex(index) {
  const normalizedIndex = Number(index || 0)
  if (normalizedIndex <= 0) return 'A'

  let value = normalizedIndex
  let label = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    label = String.fromCharCode(65 + remainder) + label
    value = Math.floor((value - 1) / 26)
  }
  return label
}

function computePlLabel(card, plRow, rowCount) {
  const base = String(card.model_seq || '')
  const letter = Number(card.model_item_count || 0) > 1 ? card.pl_letter || 'A' : ''
  const hasSplit = rowCount > 1
  const subIndex = Number(plRow.detail_order || plRow.display_order || 0) || Number(plRow.pl_detail_seq || 0) || 1

  if (!hasSplit) return `${base}${letter}`
  return letter ? `${base}${letter}${subIndex}` : `${base}.${subIndex}`
}

function getPlModelIdentity(card = {}) {
  return card.product_model_id ? `model:${card.product_model_id}` : `legacy:${normalize(card.model_name)}`
}

function assignPlIdentities(cards = []) {
  const sequenceCards = cards
    .slice()
    .sort((a, b) => a.firstSort - b.firstSort || getModelLabel(a).localeCompare(getModelLabel(b)))
  const modelSequenceMap = new Map()
  const itemSequenceByModel = new Map()
  const plIdentityMap = new Map()

  sequenceCards.forEach((card) => {
    const modelIdentity = getPlModelIdentity(card)
    if (!modelSequenceMap.has(modelIdentity)) {
      modelSequenceMap.set(modelIdentity, modelSequenceMap.size + 1)
    }

    const nextItemSequence = (itemSequenceByModel.get(modelIdentity) || 0) + 1
    itemSequenceByModel.set(modelIdentity, nextItemSequence)
    plIdentityMap.set(card.key, {
      model_seq: modelSequenceMap.get(modelIdentity),
      pl_letter: getLetterFromIndex(nextItemSequence),
      model_item_count: 0,
    })
  })

  sequenceCards.forEach((card) => {
    const modelIdentity = getPlModelIdentity(card)
    const current = itemSequenceByModel.get(modelIdentity) || 1
    const plIdentity = plIdentityMap.get(card.key)
    if (plIdentity) {
      plIdentity.model_item_count = current
    }
  })

  return cards.map((card) => ({
    ...card,
    ...(plIdentityMap.get(card.key) || { model_seq: 1, pl_letter: 'A', model_item_count: 1 }),
  }))
}

function getShortGrnLabel(grnNumber) {
  const value = String(grnNumber || '').trim()
  return value.split('-')[0] || value || 'GRN'
}

function getMultipageGroupKey(card = {}) {
  return [
    card.brand_id || normalize(card.brand_name) || 'UNBRANDED',
    card.category_id || normalize(getCategoryPathLabel(card)) || 'UNCATEGORIZED',
  ].join('::')
}

function getBreakdownIdentity(row = {}) {
  if (row.product_model_variant_id) return `variant:${row.product_model_variant_id}`
  return `model:${row.product_model_id || 'legacy'}`
}

function getPlRowQty(plRow) {
  return (plRow?.sizeRows || []).reduce((sum, sizeRow) => sum + Number(sizeRow.qty || 0), 0)
}

function getPlRowsBreakdownQty(rows = []) {
  return rows.reduce((sum, row) => sum + getPlRowQty(row), 0)
}

function normalizeSizeLabel(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '')
}

function getSummarySizeLabel(value) {
  const normalized = normalizeSizeLabel(value)
  if (!normalized.includes('X')) return normalized
  return normalized.split('X')[0] || normalized
}

function getSizeSummary(sizeRows = []) {
  const grouped = new Map()
  sizeRows
    .filter((row) => normalizeSizeLabel(row.size_label))
    .forEach((row) => {
      const size = getSummarySizeLabel(row.size_label)
      grouped.set(size, (grouped.get(size) || 0) + Number(row.qty || 0))
    })

  return Array.from(grouped.entries()).map(([size, qty]) => ({ size, qty }))
}

function getDefaultAllocationTargets(rowQty = 0, modelTotalQty = 0) {
  const normalizedQty = Math.max(0, Number(rowQty || 0))
  if (modelTotalQty <= 15) return { mobTargetQty: 0, oiTargetQty: normalizedQty }
  if (modelTotalQty <= 80) return { mobTargetQty: normalizedQty, oiTargetQty: 0 }

  const oiTargetQty = Math.ceil(normalizedQty * 0.15)
  return {
    mobTargetQty: Math.max(0, normalizedQty - oiTargetQty),
    oiTargetQty,
  }
}

function getAllocatedPlRowSizeSummary(plRow = {}, modelTotalQty = 0, qtyMode = 'all') {
  const allSizes = getSizeSummary(plRow.sizeRows || [])
  if (qtyMode === 'all') return allSizes

  const targetField = qtyMode === 'oi' ? 'oi_target_qty' : 'mob_target_qty'
  const hasStoredTargets = (plRow.sizeRows || []).every(
    (row) => row.mob_target_qty !== null && row.mob_target_qty !== undefined && row.oi_target_qty !== null && row.oi_target_qty !== undefined
  )

  if (hasStoredTargets) {
    const grouped = new Map()
    ;(plRow.sizeRows || []).forEach((row) => {
      const size = getSummarySizeLabel(row.size_label)
      if (!size) return
      grouped.set(size, (grouped.get(size) || 0) + Number(row[targetField] || 0))
    })
    return Array.from(grouped.entries())
      .map(([size, qty]) => ({ size, qty }))
      .filter((row) => Number(row.qty || 0) > 0)
  }

  return allSizes
    .map((row) => {
      const sizeQty = Number(row.qty || 0)
      const targets = getDefaultAllocationTargets(sizeQty, modelTotalQty)
      const targetQty = qtyMode === 'oi' ? targets.oiTargetQty : targets.mobTargetQty

      return {
        ...row,
        qty: targetQty,
      }
    })
    .filter((row) => Number(row.qty || 0) > 0)
}

function getSizeChartValues(row = {}) {
  return SIZE_CHART_FIELDS.reduce((result, field) => {
    result[field] = String(row[field] || '').trim()
    return result
  }, {})
}

function hasSizeChartValues(row = {}) {
  return SIZE_CHART_FIELDS.some((field) => String(row[field] || '').trim())
}

function getSizeChartSignature(sizeRows = []) {
  const rows = sizeRows
    .filter((row) => normalizeSizeLabel(row.size_label) && hasSizeChartValues(row))
    .map((row) => {
      const size = normalizeSizeLabel(row.size_label)
      const values = SIZE_CHART_FIELDS.map((field) => String(row[field] || '').trim().toUpperCase())
      return [size, ...values].join('~')
    })
    .sort((a, b) => a.localeCompare(b))

  return rows.join('|')
}

function getSizeChartValueMap(sizeRows = []) {
  return sizeRows.reduce((result, row) => {
    const size = normalizeSizeLabel(row.size_label)
    if (size && hasSizeChartValues(row) && !result.has(size)) {
      result.set(size, getSizeChartValues(row))
    }
    return result
  }, new Map())
}

function getSizeChartSourceLabel(card = {}, plRow = {}, rowCount = 1) {
  const modelLabel = getModelLabel(card)
  const plName = String(plRow.pl_name || '').trim().toUpperCase()

  if (rowCount > 1 && plName && normalize(plName) !== normalize(modelLabel)) {
    return `${modelLabel} - ${plName}`
  }

  return modelLabel
}

function getReturnSummary(returnRows = []) {
  return returnRows
    .filter((row) => Number(row.qty || 0) > 0)
    .map((row) => ({
      size: 'RETURN',
      qty: Number(row.qty || 0),
    }))
}

function isPackingStaffProfile(profile = {}) {
  return normalize(profile.role) === 'PACKING_STAFF'
}

function getProfileDisplayName(profile = {}) {
  const fallback = String(profile.email || '').split('@')[0]
  return String(profile.display_name || profile.name || fallback || '')
    .replace(/[._-]+/g, ' ')
    .trim()
    .toUpperCase()
}

function normalizeCheckerNames(value, fallback = '') {
  let source = value

  if (typeof source === 'string') {
    try {
      source = JSON.parse(source)
    } catch {
      source = source
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }
  }

  const names = Array.isArray(source) ? source : []
  const fallbackNames = String(fallback || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return [...names, ...fallbackNames].reduce((result, item) => {
    const normalized = String(item || '').trim().toUpperCase()
    if (normalized && !result.includes(normalized)) {
      result.push(normalized)
    }
    return result
  }, [])
}

function getCheckerSummary(checkerNames = []) {
  const names = normalizeCheckerNames(checkerNames)
  if (!names.length) return 'Choose checker'
  if (names.length === 1) return names[0]
  return `${names[0]} +${names.length - 1}`
}

function getUserDisplayName(user = {}, profiles = []) {
  const userEmail = normalize(user.email)
  const userId = String(user.id || '')
  const matchedProfile = profiles.find((profile) => normalize(profile.email) === userEmail || String(profile.id || '') === userId)
  const profileName = getProfileDisplayName(matchedProfile)
  const metadataName = String(
    user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      ''
  ).trim()
  const fallbackName = String(user.email || '').split('@')[0]
  return String(profileName || metadataName || fallbackName || '')
    .replace(/[._-]+/g, ' ')
    .trim()
    .toUpperCase()
}

function serializePlRows(rows = []) {
  return JSON.stringify(
    rows.map((row) => ({
      pl_detail_seq: row.pl_detail_seq || null,
      detail_order: Number(row.detail_order || row.display_order || 0),
      pl_name: String(row.pl_name || '').trim().toUpperCase(),
      pl_notes: String(row.pl_notes || '').trim(),
      pl_photo_url: row.pl_photo_url || '',
      pl_photo_urls: normalizePhotoUrls(row.pl_photo_urls),
      returnRows: (row.returnRows || []).map((returnRow) => ({
        qty: String(returnRow.qty ?? '').trim(),
        return_reason: String(returnRow.return_reason || '').trim().toUpperCase(),
      })),
      sizeRows: (row.sizeRows || []).map((sizeRow) => ({
        size_label: normalizeSizeLabel(sizeRow.size_label),
        qty: String(sizeRow.qty ?? '').trim(),
        checker_names: normalizeCheckerNames(sizeRow.checker_names),
        weight_value: String(sizeRow.weight_value || '').trim(),
        length_value: String(sizeRow.length_value || '').trim(),
        width_value: String(sizeRow.width_value || '').trim(),
      })),
    }))
  )
}

export default function PackingListSizeBreakdownPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialGrn = searchParams.get('grn') || ''
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [plReceivingRows, setPlReceivingRows] = useState([])
  const [breakdownRows, setBreakdownRows] = useState([])
  const [packingRows, setPackingRows] = useState([])
  const [plReturnRows, setPlReturnRows] = useState([])
  const [confirmRows, setConfirmRows] = useState([])
  const [productModels, setProductModels] = useState([])
  const [catalogVariants, setCatalogVariants] = useState([])
  const [brands, setBrands] = useState([])
  const [categories, setCategories] = useState([])
  const [packingStaffProfiles, setPackingStaffProfiles] = useState([])
  const [selectedCardKey, setSelectedCardKey] = useState('')
  const [previewCardKey, setPreviewCardKey] = useState('')
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [viewMode, setViewMode] = useState('table')
  const [overviewMode, setOverviewMode] = useState('model')
  const [pageMode, setPageMode] = useState('all')
  const [selectedMultipageKey, setSelectedMultipageKey] = useState('')
  const [qtyMode, setQtyMode] = useState('all')
  const [editSection, setEditSection] = useState('breakdown')
  const [baselineSignature, setBaselineSignature] = useState('')
  const [plRows, setPlRows] = useState([])
  const [openCheckerPickerKey, setOpenCheckerPickerKey] = useState('')
  const [modelFilters, setModelFilters] = useState({
    brand: '',
    categoryPath: '',
    model: '',
  })

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      const [
        { data: receivingData, error: receivingError },
        { data: breakdownData, error: breakdownError },
        { data: packingData, error: packingError },
        { data: returnData, error: returnError },
        { data: confirmData, error: confirmError },
        { data: productModelData, error: productModelError },
        { data: variantData, error: variantError },
        { data: brandData, error: brandError },
        { data: categoryData, error: categoryError },
        { data: userProfileData, error: userProfileError },
      ] = await Promise.all([
        supabase
          .from('pl_receiving')
          .select(`
            id,
            inbound_id,
            source_koli_sequence,
            product_model_id,
            product_model_variant_id,
            source_variant_code,
            model_name,
            model_color:variant_name,
            received_qty,
            qty_diff,
            validated_at,
            inbound:inbound_id (
              id,
              grn_number
            )
          `)
          .order('validated_at', { ascending: true }),
        supabase.from('pl_size_breakdown').select('*').order('detail_order', { ascending: true }).order('id', { ascending: true }),
        supabase.from('pl_packing_items').select('*').order('koli_sequence', { ascending: true }).order('id', { ascending: true }),
        supabase
          .from('warehouse_returns')
          .select('*')
          .in('source_phase', PL_RETURN_SOURCE_PHASES)
          .order('id', { ascending: true }),
        supabase
          .from('qc_confirm')
          .select('inbound_id, model_name, model_color:variant_name, photo_url')
          .order('created_at', { ascending: false }),
        supabase.from('dir_product_models').select('*').order('created_at', { ascending: true }),
        supabase.from('dir_product_model_variants').select('*').order('id', { ascending: true }),
        supabase.from('dir_brands').select('*').order('brand_name', { ascending: true }),
        supabase.from('dir_categories').select('*').order('full_code', { ascending: true }),
        supabase.from('dir_user_profiles').select('*').order('display_name', { ascending: true }),
      ])

      if (receivingError || breakdownError || returnError || confirmError || productModelError || variantError || brandError || categoryError) {
        setError(
          receivingError?.message ||
            breakdownError?.message ||
            returnError?.message ||
            confirmError?.message ||
            productModelError?.message ||
            variantError?.message ||
            brandError?.message ||
            categoryError?.message ||
            'Failed to load size breakdown data.'
        )
        setLoading(false)
        return
      }

      setPlReceivingRows(receivingData || [])
      setBreakdownRows(breakdownData || [])
      setPackingRows(packingError ? [] : packingData || [])
      setPlReturnRows(returnData || [])
      setConfirmRows(confirmData || [])
      setProductModels(productModelData || [])
      setCatalogVariants(variantData || [])
      setBrands(brandData || [])
      setCategories(categoryData || [])
      setPackingStaffProfiles(userProfileError ? [] : (userProfileData || []).filter(isPackingStaffProfile))
      setLoading(false)
    }

    loadData()
  }, [])

  const catalogContext = useMemo(() => {
    const brandById = new Map()
    brands.forEach((brand) => {
      brandById.set(Number(brand.id || 0), brand)
    })

    const categoryById = new Map()
    categories.forEach((category) => {
      categoryById.set(Number(category.id || 0), category)
    })

    const modelById = new Map()
    const modelByName = new Map()
    productModels.forEach((model) => {
      modelById.set(Number(model.id), model)
      modelByName.set(normalize(model.model_name), model)
    })

    const variantById = new Map()
    catalogVariants.forEach((variant) => {
      variantById.set(Number(variant.id), variant)
    })

    const variantByModelAndName = new Map()
    catalogVariants.forEach((variant) => {
      const modelId = Number(variant.product_model_id || 0)
      ;[variant.variant_code, variant.variant_label, variant.variant_name].forEach((value) => {
        const key = `${modelId}::${normalize(value)}`
        if (normalize(value) && !variantByModelAndName.has(key)) {
          variantByModelAndName.set(key, variant)
        }
      })
    })

    return { brandById, categoryById, modelById, modelByName, variantById, variantByModelAndName }
  }, [brands, catalogVariants, categories, productModels])

  const photoMap = useMemo(() => {
    const nextMap = new Map()
    confirmRows.forEach((row) => {
      const key = `${row.inbound_id}::${getModelKey(row.model_name, row.model_color)}`
      if (!nextMap.has(key) && row.photo_url) {
        nextMap.set(key, row.photo_url)
      }
    })
    return nextMap
  }, [confirmRows])

  const cards = useMemo(() => {
    const grouped = new Map()

    plReceivingRows
      .filter((row) => row.inbound?.grn_number === initialGrn)
      .forEach((row) => {
        const fallbackModel = catalogContext.modelByName.get(normalize(row.model_name)) || null
        const productModelId = Number(row.product_model_id || fallbackModel?.id || 0) || null
        const catalogVariant =
          catalogContext.variantById.get(Number(row.product_model_variant_id || 0)) ||
          catalogContext.variantByModelAndName.get(`${Number(productModelId || 0)}::${normalize(row.model_color)}`) ||
          null
        const productModelVariantId = Number(row.product_model_variant_id || catalogVariant?.id || 0) || null
        const catalogModel = catalogContext.modelById.get(Number(productModelId || 0)) || fallbackModel || null
        const brand = catalogContext.brandById.get(Number(catalogModel?.brand_id || row.brand_id || 0)) || null
        const category = catalogContext.categoryById.get(Number(catalogModel?.category_id || row.category_id || 0)) || null
        const categoryPath = getCategoryPath(category, catalogContext.categoryById)
        const sourceVariantCode = getVariantCode(catalogVariant) || row.source_variant_code || ''
        const key = productModelVariantId ? `variant:${productModelVariantId}` : `model:${productModelId || getModelKey(row.model_name, row.model_color)}`
        const photoKey = `${row.inbound_id}::${getModelKey(row.model_name, row.model_color)}`
        const current = grouped.get(key) || {
          key,
          inbound_id: row.inbound_id,
          grn_number: row.inbound?.grn_number || initialGrn,
          product_model_id: productModelId,
          product_model_variant_id: productModelVariantId,
          source_variant_code: sourceVariantCode,
          brand_id: catalogModel?.brand_id || row.brand_id || null,
          category_id: catalogModel?.category_id || row.category_id || null,
          brand_code: brand?.brand_code || '',
          brand_name: brand?.brand_name || brand?.name || 'UNBRANDED',
          category_code: category?.full_code || category?.category_code || '',
          category_name: category?.full_name || category?.category_name || '',
          category_path: categoryPath,
          category_root: categoryPath[0] || '',
          sub_category: categoryPath[1] || '',
          item_type: categoryPath[2] || '',
          model_code: catalogModel?.model_code || '',
          variant_code: getVariantCode(catalogVariant) || sourceVariantCode || '',
          model_name: row.model_name || catalogModel?.model_name || '',
          catalogName: getCatalogName(catalogVariant) || row.model_color || '',
          catalogVariant,
          photo_url: photoMap.get(photoKey) || catalogVariant?.variant_photo_url || '',
          receiving_qty: 0,
          firstSort: new Date(row.validated_at || 0).getTime() || Number(row.id || 0),
          registrationOrder: Number(row.id || 0),
        }

        current.receiving_qty += Number(row.received_qty || 0)
        current.brand_name = current.brand_name || brand?.brand_name || brand?.name || 'UNBRANDED'
        current.brand_code = current.brand_code || brand?.brand_code || ''
        current.category_code = current.category_code || category?.full_code || category?.category_code || ''
        current.category_name = current.category_name || category?.full_name || category?.category_name || ''
        current.category_path = current.category_path?.length ? current.category_path : categoryPath
        current.category_root = current.category_root || categoryPath[0] || ''
        current.sub_category = current.sub_category || categoryPath[1] || ''
        current.item_type = current.item_type || categoryPath[2] || ''
        current.model_code = current.model_code || catalogModel?.model_code || ''
        current.variant_code = current.variant_code || getVariantCode(catalogVariant) || sourceVariantCode || ''
        current.source_variant_code = current.source_variant_code || sourceVariantCode
        current.photo_url = current.photo_url || photoMap.get(photoKey) || catalogVariant?.variant_photo_url || ''
        current.firstSort = Math.min(current.firstSort || Number(row.id || 0), new Date(row.validated_at || 0).getTime() || Number(row.id || 0))
        current.registrationOrder = Math.min(current.registrationOrder || Number(row.id || 0), Number(row.id || 0))
        grouped.set(key, current)
      })

    const breakdownByIdentity = new Map()
    breakdownRows
      .filter((row) => row.inbound_id && plReceivingRows.some((receiving) => receiving.inbound_id === row.inbound_id && receiving.inbound?.grn_number === initialGrn))
      .forEach((row) => {
        const key = getBreakdownIdentity(row)
        breakdownByIdentity.set(key, (breakdownByIdentity.get(key) || 0) + Number(row.qty || 0))
      })

    const sortedCards = Array.from(grouped.values()).sort(
      (a, b) => b.receiving_qty - a.receiving_qty || a.firstSort - b.firstSort || getModelLabel(a).localeCompare(getModelLabel(b))
    )
    const sequenceCards = sortedCards
      .slice()
      .sort((a, b) => a.firstSort - b.firstSort || getModelLabel(a).localeCompare(getModelLabel(b)))
    const modelSequenceMap = new Map()
    const itemSequenceByModel = new Map()
    const plIdentityMap = new Map()

    sequenceCards.forEach((card) => {
      const modelIdentity = card.product_model_id ? `model:${card.product_model_id}` : `legacy:${normalize(card.model_name)}`
      if (!modelSequenceMap.has(modelIdentity)) {
        modelSequenceMap.set(modelIdentity, modelSequenceMap.size + 1)
      }

      const nextItemSequence = (itemSequenceByModel.get(modelIdentity) || 0) + 1
      itemSequenceByModel.set(modelIdentity, nextItemSequence)
      plIdentityMap.set(card.key, {
        model_seq: modelSequenceMap.get(modelIdentity),
        pl_letter: getLetterFromIndex(nextItemSequence),
        model_item_count: 0,
      })
    })

    sequenceCards.forEach((card) => {
      const modelIdentity = card.product_model_id ? `model:${card.product_model_id}` : `legacy:${normalize(card.model_name)}`
      const current = itemSequenceByModel.get(modelIdentity) || 1
      const plIdentity = plIdentityMap.get(card.key)
      if (plIdentity) {
        plIdentity.model_item_count = current
      }
    })

    return sortedCards.map((card) => {
      const plIdentity = plIdentityMap.get(card.key) || { model_seq: 1, pl_letter: 'A', model_item_count: 1 }
      return {
        ...card,
        ...plIdentity,
        breakdown_qty: breakdownByIdentity.get(card.product_model_variant_id ? `variant:${card.product_model_variant_id}` : `model:${card.product_model_id}`) || 0,
      }
    })
  }, [breakdownRows, catalogContext, initialGrn, photoMap, plReceivingRows])

  const selectedCard = cards.find((card) => card.key === selectedCardKey) || null

  const summary = useMemo(() => {
    const plReceivingQty = cards.reduce((sum, card) => sum + Number(card.receiving_qty || 0), 0)
    const breakdownQty = cards.reduce((sum, card) => sum + Number(card.breakdown_qty || 0), 0)
    return {
      availableModels: cards.length,
      plReceivingQty,
      breakdownQty,
      remainingQty: plReceivingQty - breakdownQty,
    }
  }, [cards])

  const multipageGroups = useMemo(() => {
    const grouped = new Map()
    cards.forEach((card) => {
      const key = getMultipageGroupKey(card)
      const current = grouped.get(key) || {
        key,
        brand_name: card.brand_name || 'UNBRANDED',
        category_path_label: getCategoryPathLabel(card),
        firstSort: card.firstSort || 0,
        registrationOrder: card.registrationOrder || Number.MAX_SAFE_INTEGER,
        cards: [],
      }
      current.cards.push(card)
      current.firstSort = Math.min(current.firstSort || card.firstSort || 0, card.firstSort || 0)
      current.registrationOrder = Math.min(
        current.registrationOrder || Number.MAX_SAFE_INTEGER,
        card.registrationOrder || Number.MAX_SAFE_INTEGER
      )
      grouped.set(key, current)
    })

    const shortGrnLabel = getShortGrnLabel(initialGrn)
    return Array.from(grouped.values())
      .sort(
        (a, b) =>
          a.registrationOrder - b.registrationOrder ||
          `${a.brand_name}-${a.category_path_label}`.localeCompare(`${b.brand_name}-${b.category_path_label}`)
      )
      .map((group, index) => ({
        ...group,
        page_label: `${shortGrnLabel}.${getLetterFromIndex(index + 1)}`,
        cards: assignPlIdentities(group.cards),
      }))
  }, [cards, initialGrn])

  const activeMultipageGroup = pageMode === 'multipage'
    ? multipageGroups.find((group) => group.key === selectedMultipageKey) || multipageGroups[0] || null
    : null
  const filterBaseCards = useMemo(
    () => (pageMode === 'multipage' ? activeMultipageGroup?.cards || [] : cards),
    [activeMultipageGroup, cards, pageMode]
  )
  const effectiveModelFilters = useMemo(
    () => (pageMode === 'multipage' ? { ...modelFilters, brand: '', categoryPath: '' } : modelFilters),
    [modelFilters, pageMode]
  )

  const modelFilterOptions = useMemo(() => {
    return {
      brands: getUniqueOptions(filterBaseCards.filter((card) => matchesModelFilter(card, effectiveModelFilters, 'brand')).map((card) => card.brand_name || 'UNBRANDED')),
      categoryPaths: getUniqueOptions(filterBaseCards.filter((card) => matchesModelFilter(card, effectiveModelFilters, 'categoryPath')).map((card) => getCategoryPathLabel(card))),
      models: getUniqueOptions(filterBaseCards.filter((card) => matchesModelFilter(card, effectiveModelFilters, 'model')).map((card) => getModelLabel(card))),
    }
  }, [effectiveModelFilters, filterBaseCards])

  const displayCards = useMemo(
    () => filterBaseCards.filter((card) => matchesModelFilter(card, effectiveModelFilters)),
    [effectiveModelFilters, filterBaseCards]
  )

  function updateModelFilter(key, value) {
    setModelFilters((prev) => {
      return { ...prev, [key]: value }
    })
  }

  function resetModelFilters() {
    setModelFilters({
      brand: '',
      categoryPath: '',
      model: '',
    })
  }

  function buildRowsForCard(card, sourceBreakdownRows = breakdownRows, sourceReturnRows = plReturnRows) {
    if (!card) return []

    const identityRows = sourceBreakdownRows.filter((row) => {
      if (Number(row.inbound_id || 0) !== Number(card.inbound_id || 0)) return false
      if (Number(row.product_model_id || 0) !== Number(card.product_model_id || 0)) return false
      if (card.product_model_variant_id) {
        return Number(row.product_model_variant_id || 0) === Number(card.product_model_variant_id || 0)
      }
      return !row.product_model_variant_id
    })

    if (!identityRows.length) {
      return [createPlRow(card, null, 1)]
    }

    const grouped = new Map()
    identityRows.forEach((row, index) => {
      const groupKey = row.pl_detail_seq ? `seq:${row.pl_detail_seq}` : 'base'
      const current = grouped.get(groupKey) || {
        id: `saved-pl-${groupKey}`,
        pl_detail_seq: row.pl_detail_seq || null,
        detail_order: Number(row.detail_order || row.display_order || index + 1),
        pl_name: String(row.pl_name || row.variant_name || row.model_name || 'PL Item').toUpperCase(),
        pl_notes: row.pl_notes || row.variant_notes || '',
        pl_photo_url: row.pl_photo_url || row.variant_photo_url || card.photo_url || '',
        pl_photo_urls: normalizePhotoUrls(row.pl_photo_urls, row.pl_photo_url || row.variant_photo_url || ''),
        sizeRows: [],
        returnRows: [],
      }

      current.sizeRows.push({
        id: `saved-size-${row.id || index}`,
        breakdown_row_id: row.id || null,
        size_label: row.size_label || '',
        qty: String(row.qty ?? ''),
        mob_target_qty: row.mob_target_qty ?? null,
        oi_target_qty: row.oi_target_qty ?? null,
        allocation_source: row.allocation_source || 'DEFAULT_RULE',
        allocation_reason: row.allocation_reason || '',
        checker_names: normalizeCheckerNames(row.checker_names),
        weight_value: String(row.weight_value || ''),
        length_value: String(row.length_value || ''),
        width_value: String(row.width_value || ''),
        width_afterpull: String(row.width_afterpull || row.extra_value_1 || ''),
        sleeve_length: String(row.sleeve_length || row.extra_value_2 || ''),
        thigh_width: String(row.thigh_width || row.tigh_width || row.extra_value_3 || ''),
      })
      grouped.set(groupKey, current)
    })

    sourceReturnRows
      .filter((row) => {
        if (Number(row.inbound_id || 0) !== Number(card.inbound_id || 0)) return false
        if (Number(row.product_model_id || 0) && Number(row.product_model_id || 0) !== Number(card.product_model_id || 0)) return false
        if (card.product_model_variant_id && Number(row.product_model_variant_id || 0)) {
          return Number(row.product_model_variant_id || 0) === Number(card.product_model_variant_id || 0)
        }
        return normalize(row.model_name) === normalize(card.model_name) && normalize(row.variant_name) === normalize(card.catalogName)
      })
      .forEach((row, index) => {
        const groupKey = row.pl_detail_seq ? `seq:${row.pl_detail_seq}` : 'base'
        const current = grouped.get(groupKey) || {
          id: `saved-pl-return-${groupKey}`,
          pl_detail_seq: row.pl_detail_seq || null,
          detail_order: index + 1,
          pl_name: String(row.pl_name || card.catalogName || card.model_name || 'PL Item').toUpperCase(),
          pl_notes: '',
          pl_photo_url: card.photo_url || '',
          pl_photo_urls: [],
          sizeRows: [createEmptySizeRow()],
          returnRows: [],
        }

      current.returnRows.push({
        id: `saved-return-${row.id || index}`,
        warehouse_return_id: row.id || null,
        size_label: row.size_label || 'RETURN',
        koli_sequence: row.koli_sequence || null,
        qty: String(row.qty ?? ''),
        return_reason: row.return_reason || '',
      })
        grouped.set(groupKey, current)
      })

    return Array.from(grouped.values()).sort((a, b) => Number(a.detail_order || a.display_order || 0) - Number(b.detail_order || b.display_order || 0))
  }

  const sizeChartOptions = (() => {
    const groupedOptions = new Map()

    cards.forEach((card) => {
      if (card.key === selectedCardKey) return

      const sourcePlRows = buildRowsForCard(card)
      sourcePlRows.forEach((sourcePlRow) => {
        const signature = getSizeChartSignature(sourcePlRow.sizeRows)
        if (!signature) return

        const current = groupedOptions.get(signature) || {
          signature,
          productLabels: [],
          sourceSizeRows: sourcePlRow.sizeRows,
        }
        const label = getSizeChartSourceLabel(card, sourcePlRow, sourcePlRows.length)
        if (label && !current.productLabels.includes(label)) {
          current.productLabels.push(label)
        }
        groupedOptions.set(signature, current)
      })
    })

    return Array.from(groupedOptions.values())
      .map((option, index) => ({
        ...option,
        key: `size-chart-${index}`,
        label: `Same as: ${option.productLabels.join(', ')}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  })()

  function hasUnsavedChanges() {
    return viewMode !== 'table' && Boolean(selectedCardKey) && serializePlRows(plRows) !== baselineSignature
  }

  function handleSelectCard(cardKey) {
    const nextCard = cards.find((card) => card.key === cardKey) || null
    if (!nextCard) return

    if (selectedCardKey && selectedCardKey !== cardKey && hasUnsavedChanges()) {
      const shouldSwitch = window.confirm('You have unsaved changes. Switch model and discard them?')
      if (!shouldSwitch) return

      const savedRows = buildRowsForCard(nextCard)
      setSelectedCardKey(cardKey)
      setPlRows(savedRows)
      setBaselineSignature(serializePlRows(savedRows))
      setError('')
      setSuccess('')
      return
    }

    const nextRows = buildRowsForCard(nextCard)
    setSelectedCardKey(cardKey)
    setPlRows(nextRows)
    setBaselineSignature(serializePlRows(nextRows))
    setError('')
    setSuccess('')
  }

  function leaveEditMode() {
    if (hasUnsavedChanges()) {
      const shouldLeave = window.confirm('You have unsaved changes. Leave edit form and discard them?')
      if (!shouldLeave) return
      if (selectedCard) {
        const savedRows = buildRowsForCard(selectedCard)
        setPlRows(savedRows)
        setBaselineSignature(serializePlRows(savedRows))
      }
    }
    setViewMode('table')
    setError('')
    setSuccess('')
  }

  function closePage() {
    if (hasUnsavedChanges()) {
      const shouldLeave = window.confirm('You have unsaved changes. Leave this page and discard them?')
      if (!shouldLeave) return
    }
    router.push('/dashboard/packing-list')
  }

  function openEditForm() {
    if (viewMode !== 'table') {
      leaveEditMode()
      return
    }

    if (!selectedCard && cards[0]) {
      const firstRows = buildRowsForCard(cards[0])
      setSelectedCardKey(cards[0].key)
      setPlRows(firstRows)
      setBaselineSignature(serializePlRows(firstRows))
    }

    setEditSection('breakdown')
    setViewMode('edit')
    setError('')
    setSuccess('')
  }

  function openPackingInput() {
    router.push(`/mobile/packing-list/item-storing?grn=${encodeURIComponent(initialGrn)}`)
  }

  function switchEditSection(nextSection) {
    setEditSection(nextSection)
    setError('')
    setSuccess('')
  }

  function updatePlRow(plRowId, updates) {
    setPlRows((prev) => prev.map((row) => (row.id === plRowId ? { ...row, ...updates } : row)))
  }

  function updateSizeRow(plRowId, sizeRowId, updates) {
    setPlRows((prev) =>
      prev.map((row) =>
        row.id === plRowId
          ? {
              ...row,
              sizeRows: row.sizeRows.map((sizeRow) => (sizeRow.id === sizeRowId ? { ...sizeRow, ...updates } : sizeRow)),
            }
          : row
      )
    )
  }

  function toggleCheckerForSizeRow(plRowId, sizeRowId, checkerName) {
    const normalizedChecker = String(checkerName || '').trim().toUpperCase()
    if (!normalizedChecker) return

    setPlRows((prev) =>
      prev.map((row) =>
        row.id === plRowId
          ? {
              ...row,
              sizeRows: row.sizeRows.map((sizeRow) => {
                if (sizeRow.id !== sizeRowId) return sizeRow
                const checkerNames = normalizeCheckerNames(sizeRow.checker_names)
                const nextCheckerNames = checkerNames.includes(normalizedChecker)
                  ? checkerNames.filter((name) => name !== normalizedChecker)
                  : [...checkerNames, normalizedChecker]
                return {
                  ...sizeRow,
                  checker_names: nextCheckerNames,
                }
              }),
            }
          : row
      )
    )
  }

  function resetCurrentModelRows() {
    if (!selectedCard) return
    const savedRows = buildRowsForCard(selectedCard)
    setPlRows(savedRows)
    setBaselineSignature(serializePlRows(savedRows))
    setOpenCheckerPickerKey('')
    setError('')
    setSuccess('')
  }

  function updateReturnRow(plRowId, returnRowId, updates) {
    setPlRows((prev) =>
      prev.map((row) =>
        row.id === plRowId
          ? {
              ...row,
              returnRows: (row.returnRows || []).map((returnRow) => (returnRow.id === returnRowId ? { ...returnRow, ...updates } : returnRow)),
            }
          : row
      )
    )
  }

  function addPlRow() {
    if (!selectedCard) return
    setPlRows((prev) => {
      const nextRows = prev.map((row, index) => ({
        ...row,
        pl_detail_seq: row.pl_detail_seq || index + 1,
        detail_order: index + 1,
      }))
      return [...nextRows, createPlRow(selectedCard, nextRows.length + 1, nextRows.length + 1)]
    })
  }

  function removePlRow(plRowId) {
    setPlRows((prev) => {
      if (prev.length <= 1) return prev
      return prev
        .filter((row) => row.id !== plRowId)
        .map((row, index, rows) => ({
          ...row,
          pl_detail_seq: rows.length > 1 ? index + 1 : null,
          detail_order: index + 1,
        }))
    })
  }

  function focusLastSizeInput(plRowId) {
    window.setTimeout(() => {
      const inputs = Array.from(document.querySelectorAll('[data-size-field="size"]')).filter(
        (input) => input.dataset.plRowId === plRowId
      )
      inputs[inputs.length - 1]?.focus()
    }, 80)
  }

  function addSizeRow(plRowId, shouldFocus = false) {
    setPlRows((prev) =>
      prev.map((row) =>
        row.id === plRowId
          ? {
              ...row,
              sizeRows: [...row.sizeRows, createEmptySizeRow(row.sizeRows.length)],
            }
          : row
      )
    )
    if (shouldFocus) {
      focusLastSizeInput(plRowId)
    }
  }

  function handleSizeKeyDown(event, plRowId) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    addSizeRow(plRowId, true)
  }

  function removeSizeRow(plRowId, sizeRowId) {
    setPlRows((prev) =>
      prev.map((row) =>
        row.id === plRowId
          ? {
              ...row,
              sizeRows: row.sizeRows.length <= 1 ? row.sizeRows : row.sizeRows.filter((sizeRow) => sizeRow.id !== sizeRowId),
            }
          : row
      )
    )
  }

  function addReturnRow(plRowId) {
    setPlRows((prev) =>
      prev.map((row) =>
        row.id === plRowId
          ? {
              ...row,
              returnRows: [...(row.returnRows || []), createEmptyReturnRow((row.returnRows || []).length)],
            }
          : row
      )
    )
  }

  function removeReturnRow(plRowId, returnRowId) {
    setPlRows((prev) =>
      prev.map((row) =>
        row.id === plRowId
          ? {
              ...row,
              returnRows: (row.returnRows || []).filter((returnRow) => returnRow.id !== returnRowId),
            }
          : row
      )
    )
  }

  function applySizeChartShortcut(plRowId) {
    const targetPlRow = plRows.find((row) => row.id === plRowId) || null
    const selectedOption = sizeChartOptions.find((option) => option.key === targetPlRow?.sizeChartSourceKey) || null

    if (!selectedOption) {
      setError('Choose a product size chart first.')
      setSuccess('')
      return
    }

    const sourceMap = getSizeChartValueMap(selectedOption.sourceSizeRows)
    let updatedCount = 0
    const nextRows = plRows.map((row) => {
      if (row.id !== plRowId) return row

      return {
        ...row,
        sizeRows: row.sizeRows.map((sizeRow) => {
          const sourceValues = sourceMap.get(normalizeSizeLabel(sizeRow.size_label))
          if (!sourceValues) return sizeRow

          updatedCount += 1
          return {
            ...sizeRow,
            ...sourceValues,
          }
        }),
      }
    })

    if (!updatedCount) {
      setError('No matching size found from the selected product size chart.')
      setSuccess('')
      return
    }

    setPlRows(nextRows)
    setError('')
    setSuccess(`Size chart copied from ${selectedOption.productLabels.join(', ')}.`)
  }

  async function handlePhotoChange(plRowId, event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    try {
      setError('')
      const uploadedUrls = []
      const currentPlRow = plRows.find((row) => row.id === plRowId) || null
      const currentPlRowIndex = plRows.findIndex((row) => row.id === plRowId)
      const plDetailSegment = currentPlRow?.pl_detail_seq || currentPlRow?.detail_order || currentPlRow?.display_order || currentPlRowIndex + 1 || 'base'
      const variantSegment =
        selectedCard?.variant_code ||
        selectedCard?.source_variant_code ||
        selectedCard?.catalogName ||
        'variant'

      for (const file of files) {
        const compressedFile = await compressImageFile(file)
        const fileExt = compressedFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`
        const filePath = [
          getSafeStorageSegment(selectedCard?.brand_code || selectedCard?.brand_name, 'brand'),
          getSafeStorageSegment(selectedCard?.category_code || selectedCard?.category_name || selectedCard?.category_id, 'category'),
          getSafeStorageSegment(selectedCard?.model_code || selectedCard?.model_name || selectedCard?.product_model_id, 'model'),
          'variants',
          getSafeStorageSegment(variantSegment, 'variant'),
          'detail',
          getSafeStorageSegment(plDetailSegment, 'pl'),
          fileName,
        ].join('/')

        const { error: uploadError } = await supabase.storage
          .from(PRODUCT_PHOTOS_BUCKET)
          .upload(filePath, compressedFile, { upsert: false })

        if (uploadError) {
          throw new Error(uploadError.message || 'Failed to upload PL photo detail.')
        }

        const { data: publicUrlData } = supabase.storage
          .from(PRODUCT_PHOTOS_BUCKET)
          .getPublicUrl(filePath)

        if (publicUrlData?.publicUrl) {
          uploadedUrls.push(publicUrlData.publicUrl)
        }
      }

      setPlRows((prev) =>
        prev.map((row) => {
          if (row.id !== plRowId) return row
          const nextPhotos = normalizePhotoUrls([...(row.pl_photo_urls || []), ...uploadedUrls])
          return {
            ...row,
            pl_photo_urls: nextPhotos,
          }
        })
      )
    } catch (photoError) {
      setError(photoError.message || 'Failed to upload PL photo detail.')
    } finally {
      event.target.value = ''
    }
  }

  function setMainPhoto(plRowId, photoUrl) {
    setPlRows((prev) =>
      prev.map((row) =>
        row.id === plRowId
          ? {
              ...row,
              pl_photo_url: photoUrl,
              pl_photo_urls: normalizePhotoUrls(row.pl_photo_urls),
            }
          : row
      )
    )
  }

  async function removePlPhoto(plRowId, photoUrl) {
    setPlRows((prev) =>
      prev.map((row) => {
        if (row.id !== plRowId) return row
        const nextPhotos = normalizePhotoUrls(row.pl_photo_urls).filter((item) => item !== photoUrl)
        return {
          ...row,
          pl_photo_urls: nextPhotos,
          pl_photo_url: row.pl_photo_url === photoUrl ? '' : row.pl_photo_url,
        }
      })
    )

    const storagePath = getProductPhotoStoragePath(photoUrl)
    if (!storagePath || !storagePath.includes('/variants/') || !storagePath.includes('/detail/')) return

    const { error: removeError } = await supabase.storage
      .from(PRODUCT_PHOTOS_BUCKET)
      .remove([storagePath])

    if (removeError) {
      setError(`Photo removed from form, but storage cleanup failed: ${removeError.message}`)
    }
  }

  async function saveBreakdown() {
    if (!selectedCard) {
      setError('Choose a model card first.')
      setSuccess('')
      return
    }

    if (!selectedCard.product_model_id) {
      setError('This PL card is missing product_model_id. Please link the catalog model before saving breakdown.')
      setSuccess('')
      return
    }

    const totalQty = plRows.reduce((sum, row) => sum + row.sizeRows.reduce((sizeSum, sizeRow) => sizeSum + Number(sizeRow.qty || 0), 0), 0)
    if (totalQty > Number(selectedCard.receiving_qty || 0)) {
      setError('Breakdown Qty cannot be greater than PL Receiving Qty.')
      setSuccess('')
      return
    }

    const invalidRow = plRows.find((row) => {
      if (!String(row.pl_name || '').trim()) return true
      return row.sizeRows.some(
        (sizeRow) =>
          !String(sizeRow.size_label || '').trim() ||
          !String(sizeRow.qty ?? '').trim() ||
          !normalizeCheckerNames(sizeRow.checker_names).length ||
          Number(sizeRow.qty || 0) < 0
      )
    })

    if (invalidRow) {
      setError('Complete every PL Name, size, qty, and checker name before saving.')
      setSuccess('')
      return
    }

    const invalidReturnRow = plRows.find((row) =>
      (row.returnRows || []).some(
        (returnRow) =>
          !String(returnRow.qty ?? '').trim() ||
          Number(returnRow.qty || 0) <= 0 ||
          !String(returnRow.return_reason || '').trim()
      )
    )

    if (invalidReturnRow) {
      setError('Complete every PL Return qty and return reason before saving.')
      setSuccess('')
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const createdByName = getUserDisplayName(user, packingStaffProfiles)

    const normalizedRows = plRows.map((row, index) => ({
      ...row,
      pl_detail_seq: plRows.length > 1 ? row.pl_detail_seq || index + 1 : null,
      detail_order: index + 1,
    }))
    const modelVariantQty = getPlRowsBreakdownQty(normalizedRows)

    const payload = normalizedRows.flatMap((row) =>
      row.sizeRows.map((sizeRow) => {
        const checkerNames = normalizeCheckerNames(sizeRow.checker_names)
        const rowQty = Number(sizeRow.qty || 0)
        const defaultTargets = getDefaultAllocationTargets(rowQty, modelVariantQty)
        const manualReason = String(sizeRow.allocation_reason || '').trim()
        const manualMobTarget = Number(sizeRow.mob_target_qty)
        const manualOiTarget = Number(sizeRow.oi_target_qty)
        const keepsManualAllocation =
          sizeRow.allocation_source === 'MANUAL_OVERRIDE' &&
          manualReason &&
          Number.isFinite(manualMobTarget) &&
          Number.isFinite(manualOiTarget) &&
          manualMobTarget >= 0 &&
          manualOiTarget >= 0 &&
          manualMobTarget + manualOiTarget === rowQty
        return {
          id: sizeRow.breakdown_row_id || null,
          inbound_id: selectedCard.inbound_id,
          product_model_id: selectedCard.product_model_id,
          product_model_variant_id: selectedCard.product_model_variant_id || null,
          source_variant_code: selectedCard.source_variant_code || null,
          model_name: selectedCard.model_name || null,
          variant_name: selectedCard.catalogName || null,
          pl_detail_seq: row.pl_detail_seq,
          detail_order: row.detail_order,
          pl_name: String(row.pl_name || '').trim().toUpperCase(),
          checker_names: checkerNames,
          pl_notes: String(row.pl_notes || '').trim() || null,
          pl_photo_url: normalizedRows.length > 1 ? row.pl_photo_url || null : null,
          pl_photo_urls: normalizedRows.length > 1 ? normalizePhotoUrls(row.pl_photo_urls) : [],
          size_label: normalizeSizeLabel(sizeRow.size_label),
          qty: rowQty,
          mob_target_qty: keepsManualAllocation ? manualMobTarget : defaultTargets.mobTargetQty,
          oi_target_qty: keepsManualAllocation ? manualOiTarget : defaultTargets.oiTargetQty,
          allocation_source: keepsManualAllocation ? 'MANUAL_OVERRIDE' : 'DEFAULT_RULE',
          allocation_reason: keepsManualAllocation ? manualReason : null,
          weight_value: String(sizeRow.weight_value || '').trim() || null,
          length_value: String(sizeRow.length_value || '').trim() || null,
          width_value: String(sizeRow.width_value || '').trim() || null,
          width_afterpull: String(sizeRow.width_afterpull || '').trim() || null,
          sleeve_length: String(sizeRow.sleeve_length || '').trim() || null,
          thigh_width: String(sizeRow.thigh_width || '').trim() || null,
          created_by: createdByName || null,
        }
      })
    )

    const returnPayload = normalizedRows.flatMap((row) =>
      (row.returnRows || []).map((returnRow) => ({
        id: returnRow.warehouse_return_id || null,
        inbound_id: selectedCard.inbound_id,
        koli_sequence: returnRow.koli_sequence || null,
        brand_id: selectedCard.brand_id || null,
        category_id: selectedCard.category_id || null,
        model_name: selectedCard.model_name || null,
        variant_name: selectedCard.catalogName || null,
        qty: Number(returnRow.qty || 0),
        return_reason: String(returnRow.return_reason || '').trim().toUpperCase(),
        pic_name: createdByName || null,
      }))
    )

    setSaving(true)
    setError('')
    setSuccess('')

    const existingRows = breakdownRows.filter((row) => {
      if (Number(row.inbound_id || 0) !== Number(selectedCard.inbound_id || 0)) return false
      if (Number(row.product_model_id || 0) !== Number(selectedCard.product_model_id || 0)) return false
      if (selectedCard.product_model_variant_id) {
        return Number(row.product_model_variant_id || 0) === Number(selectedCard.product_model_variant_id || 0)
      }
      return !row.product_model_variant_id
    })
    const incomingIds = new Set(payload.map((row) => Number(row.id || 0)).filter(Boolean))
    const staleRows = existingRows.filter((row) => !incomingIds.has(Number(row.id || 0)))
    const existingReturnRows = plReturnRows.filter((row) => {
      if (Number(row.inbound_id || 0) !== Number(selectedCard.inbound_id || 0)) return false
      if (Number(row.product_model_id || 0) && Number(row.product_model_id || 0) !== Number(selectedCard.product_model_id || 0)) return false
      if (selectedCard.product_model_variant_id && Number(row.product_model_variant_id || 0)) {
        return Number(row.product_model_variant_id || 0) === Number(selectedCard.product_model_variant_id || 0)
      }
      return normalize(row.model_name) === normalize(selectedCard.model_name) && normalize(row.variant_name) === normalize(selectedCard.catalogName)
    })
    const incomingReturnIds = new Set(returnPayload.map((row) => Number(row.id || 0)).filter(Boolean))
    const staleReturnRows = existingReturnRows.filter((row) => !incomingReturnIds.has(Number(row.id || 0)))

    for (const row of payload) {
      const breakdownPayload = {
        inbound_id: row.inbound_id,
        product_model_id: row.product_model_id,
        product_model_variant_id: row.product_model_variant_id,
        source_variant_code: row.source_variant_code,
        model_name: row.model_name,
        variant_name: row.variant_name,
        pl_detail_seq: row.pl_detail_seq,
        detail_order: row.detail_order,
        pl_name: row.pl_name,
        checker_names: row.checker_names,
        pl_notes: row.pl_notes,
        pl_photo_url: row.pl_photo_url,
        pl_photo_urls: row.pl_photo_urls,
        size_label: row.size_label,
        qty: row.qty,
        mob_target_qty: row.mob_target_qty,
        oi_target_qty: row.oi_target_qty,
        allocation_source: row.allocation_source,
        allocation_reason: row.allocation_reason,
        weight_value: row.weight_value,
        length_value: row.length_value,
        width_value: row.width_value,
        width_afterpull: row.width_afterpull,
        sleeve_length: row.sleeve_length,
        thigh_width: row.thigh_width,
        created_by: row.created_by,
        updated_at: new Date().toISOString(),
      }

      const query = row.id
        ? supabase.from('pl_size_breakdown').update(breakdownPayload).eq('id', row.id)
        : supabase.from('pl_size_breakdown').insert([breakdownPayload])

      const { error: saveError } = await query
      if (saveError) {
        setSaving(false)
        setError(saveError.message || 'Failed to save PL size breakdown.')
        return
      }
    }

    for (const row of staleRows) {
      const { error: deleteError } = await supabase.from('pl_size_breakdown').delete().eq('id', row.id)
      if (deleteError) {
        setSaving(false)
        setError(deleteError.message || 'Failed to remove deleted PL size row.')
        return
      }
    }

    let nextReturnKoliSequence = 1
    if (returnPayload.some((row) => !row.koli_sequence)) {
      const { data: latestReturnRows, error: sequenceError } = await supabase
        .from('warehouse_returns')
        .select('koli_sequence')
        .eq('inbound_id', selectedCard.inbound_id)

      if (sequenceError) {
        setSaving(false)
        setError(sequenceError.message || 'Failed to assign PL return Koli number.')
        return
      }

      nextReturnKoliSequence =
        (latestReturnRows || []).reduce(
          (max, row) => Math.max(max, Number(row.koli_sequence || 0)),
          0
        ) + 1
    }

    for (const row of returnPayload) {
      const assignedKoliSequence = row.koli_sequence || nextReturnKoliSequence++
      const warehouseReturnPayload = {
        inbound_id: row.inbound_id,
        source_phase: PL_RETURN_SOURCE_PHASE,
        koli_sequence: assignedKoliSequence,
        brand_id: row.brand_id,
        category_id: row.category_id,
        model_name: row.model_name,
        variant_name: row.variant_name,
        qty: row.qty,
        return_reason: row.return_reason,
        pic_name: row.pic_name,
      }

      const query = row.id
        ? supabase.from('warehouse_returns').update(warehouseReturnPayload).eq('id', row.id)
        : supabase.from('warehouse_returns').insert([warehouseReturnPayload])

      const { error: returnSaveError } = await query
      if (returnSaveError) {
        setSaving(false)
        setError(returnSaveError.message || 'Failed to save PL returns.')
        return
      }
    }

    for (const row of staleReturnRows) {
      const { error: returnDeleteError } = await supabase.from('warehouse_returns').delete().eq('id', row.id)
      if (returnDeleteError) {
        setSaving(false)
        setError(returnDeleteError.message || 'Failed to remove deleted PL return row.')
        return
      }
    }

    const [
      { data: refreshedRows, error: refreshError },
      { data: refreshedReturnRows, error: refreshReturnError },
    ] = await Promise.all([
      supabase
        .from('pl_size_breakdown')
        .select('*')
        .eq('inbound_id', selectedCard.inbound_id)
        .order('detail_order', { ascending: true })
        .order('id', { ascending: true }),
      supabase
        .from('warehouse_returns')
        .select('*')
        .eq('inbound_id', selectedCard.inbound_id)
        .in('source_phase', PL_RETURN_SOURCE_PHASES)
        .order('id', { ascending: true }),
    ])

    setSaving(false)
    if (refreshError || refreshReturnError) {
      setError(refreshError?.message || refreshReturnError?.message || 'Saved, but failed to refresh PL size breakdown.')
      return
    }

    const nextBreakdownRows = [
      ...breakdownRows.filter((row) => Number(row.inbound_id || 0) !== Number(selectedCard.inbound_id || 0)),
      ...((refreshedRows || []).filter(Boolean)),
    ]
    const nextReturnRows = [
      ...plReturnRows.filter((row) => Number(row.inbound_id || 0) !== Number(selectedCard.inbound_id || 0)),
      ...((refreshedReturnRows || []).filter(Boolean)),
    ]
    setBreakdownRows(nextBreakdownRows)
    setPlReturnRows(nextReturnRows)
    const savedRows = buildRowsForCard(selectedCard, nextBreakdownRows, nextReturnRows)
    setPlRows(savedRows)
    setBaselineSignature(serializePlRows(savedRows))
    setSuccess('PL size breakdown saved.')
  }

  if (loading) {
    return <p style={styles.emptyText}>Loading size breakdown...</p>
  }

  const overviewRows = displayCards.flatMap((card) => {
    const rows = buildRowsForCard(card)
    const modelTotalQty = getPlRowsBreakdownQty(rows)
    const rowsWithAllPlIds = rows.map((plRow) => ({
      plRow,
      allPlId: computePlLabel(card, plRow, rows.length),
    }))

    return rowsWithAllPlIds
      .map(({ plRow, allPlId }) => {
        const hasSavedBreakdown = plRow.sizeRows.some((sizeRow) => sizeRow.breakdown_row_id)
        const savedPlName = String(plRow.pl_name || '').trim()
        const isDefaultVariantOnlyName = normalize(savedPlName) === normalize(card.catalogName)
        const modelVariantLabel = getOverviewModelVariantLabel(card)
        const itemName = hasSavedBreakdown && savedPlName && !isDefaultVariantOnlyName ? savedPlName : modelVariantLabel
        const sizes = [
          ...getAllocatedPlRowSizeSummary(plRow, modelTotalQty, qtyMode),
          ...(qtyMode === 'all' ? getReturnSummary(plRow.returnRows) : []),
        ]
        const totalQty = sizes.reduce((sum, size) => sum + Number(size.qty || 0), 0)

        return {
          key: `${card.key}-${plRow.id}`,
          cardKey: card.key,
          pl_id: allPlId,
          photo_url: plRow.pl_photo_url || card.photo_url,
          brand_name: card.brand_name || 'UNBRANDED',
          model_variant: modelVariantLabel,
          item_name: itemName,
          breakdown_qty: totalQty,
          sizes,
          total_qty: totalQty,
        }
      })
      .filter((row) => qtyMode === 'all' || Number(row.total_qty || 0) > 0)
  })
  const currentInboundIds = new Set(cards.map((card) => Number(card.inbound_id || 0)).filter(Boolean))
  const breakdownById = new Map(
    breakdownRows
      .filter((row) => currentInboundIds.has(Number(row.inbound_id || 0)))
      .map((row) => [Number(row.id || 0), row])
  )
  const filteredBreakdownIds = new Set(
    displayCards
      .flatMap((card) => buildRowsForCard(card))
      .flatMap((plRow) => plRow.sizeRows || [])
      .map((sizeRow) => Number(sizeRow.breakdown_row_id || 0))
      .filter(Boolean)
  )
  const packingKoliRows = Array.from(
    packingRows
      .filter((row) => {
        const breakdownId = Number(row.pl_size_breakdown_id || 0)
        if (!Number(row.inbound_id || 0) || !breakdownById.has(breakdownId)) return false
        if (filteredBreakdownIds.size && !filteredBreakdownIds.has(breakdownId)) return false
        if (qtyMode !== 'all' && normalize(row.storing_type) !== normalize(qtyMode)) return false
        return true
      })
      .reduce((result, row) => {
        const sourceBreakdown = breakdownById.get(Number(row.pl_size_breakdown_id || 0)) || {}
        const groupKey = row.packing_group_key || `${row.storing_type || 'MOB'}-${row.package_type || 'REGULAR'}-${row.brand_id || 'none'}-${row.koli_label || row.koli_sequence || '-'}`
        const current = result.get(groupKey) || {
          key: groupKey,
          storing_type: row.storing_type || 'MOB',
          package_type: row.package_type || 'REGULAR',
          koli_label: row.koli_label || (row.koli_sequence ? String(row.koli_sequence) : '-'),
          total_qty: 0,
          items: [],
        }
        current.total_qty += Number(row.qty || 0)
        current.items.push({
          id: row.id,
          item_name: row.pl_name || sourceBreakdown.pl_name || sourceBreakdown.variant_name || sourceBreakdown.model_name || 'PL Item',
          size_label: normalizeSizeLabel(row.size_label || sourceBreakdown.size_label),
          qty: Number(row.qty || 0),
          packed_by: row.packed_by || '-',
        })
        result.set(groupKey, current)
        return result
      }, new Map())
      .values()
  ).sort((a, b) => `${a.storing_type}-${a.package_type}-${a.koli_label}`.localeCompare(`${b.storing_type}-${b.package_type}-${b.koli_label}`, undefined, { numeric: true }))
  const editorReceivingQty = Number(selectedCard?.receiving_qty || 0)
  const editorBreakdownQty = getPlRowsBreakdownQty(plRows)
  const editorRemainingQty = editorReceivingQty - editorBreakdownQty
  const saveFeedbackMessage = saving ? 'Saving PL size breakdown...' : error || success
  const saveFeedbackColor = saving ? '#475569' : error ? '#dc2626' : '#047857'
  const hasEditorUnsavedChanges = hasUnsavedChanges()
  const checkerOptions = packingStaffProfiles.reduce((result, profile) => {
    const label = getProfileDisplayName(profile)
    if (label && !result.includes(label)) {
      result.push(label)
    }
    return result
  }, [])

  return (
    <div style={styles.wrapper}>
      <section style={styles.panel}>
        <div style={styles.header}>
          <div style={styles.headerMain}>
            <div>
              <p style={styles.eyebrow}>Packing List</p>
              <div style={styles.titleLine}>
                <h1 style={styles.title}>Size Breakdown</h1>
                <span style={styles.grnChip}>{initialGrn || '-'}</span>
              </div>
              <p style={styles.subtitle}>Split PL receiving quantities into size, measurement, and PL details before storage.</p>
            </div>
            <div style={styles.metricPillGrid}>
              <div style={styles.metricPill}>
                <span style={styles.metricPillLabel}>PL Receiving Qty</span>
                <strong style={styles.metricPillValue}>{summary.plReceivingQty}</strong>
              </div>
              <div style={styles.metricPill}>
                <span style={styles.metricPillLabel}>Breakdown Qty</span>
                <strong style={styles.metricPillValue}>{summary.breakdownQty}</strong>
              </div>
              <div style={styles.metricPill}>
                <span style={styles.metricPillLabel}>Remaining</span>
                <strong style={{ ...styles.metricPillValue, color: summary.remainingQty === 0 ? '#0f172a' : '#dc2626' }}>{summary.remainingQty}</strong>
              </div>
            </div>
          </div>

          <div style={styles.headerActions}>
            <button
              type="button"
              onClick={openEditForm}
              disabled={saving}
              style={{
                ...styles.secondaryButton,
                ...(viewMode !== 'table' ? styles.modeButtonActive : {}),
                ...(viewMode !== 'table' ? { background: '#fff', color: '#dc2626', borderColor: '#fecaca' } : {}),
                ...(saving ? styles.disabledButton : {}),
                fontSize: 0,
              }}
              title={viewMode === 'table' ? 'Edit Form' : 'Back to Overview'}
              aria-label={viewMode === 'table' ? 'Edit Form' : 'Back to Overview'}
            >
              <span style={{ fontSize: '13px' }}>{viewMode === 'table' ? 'Edit' : 'Cancel Edit'}</span>
              ✎
            </button>
            {viewMode === 'table' ? (
              <button
                type="button"
                onClick={openPackingInput}
                disabled={saving || !summary.breakdownQty}
                style={
                  saving || !summary.breakdownQty
                    ? { ...styles.toolIconButton, ...styles.toolIconButtonPrimary, ...styles.disabledButton }
                    : { ...styles.toolIconButton, ...styles.toolIconButtonPrimary }
                }
                title="Open Item Storing"
                aria-label="Open Item Storing"
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
              onClick={() => {}}
              style={{
                display: 'none',
              }}
              title="Measurement Detail"
              aria-label="Measurement Detail"
            >
              ⟷
            </button>
            {viewMode === 'table' ? (
              <button
                type="button"
                onClick={closePage}
                disabled={saving}
                style={saving ? { ...styles.iconButton, ...styles.disabledButton } : styles.iconButton}
                title="Back to Packing List overview"
                aria-label="Back to Packing List overview"
              >
                X
              </button>
            ) : null}
          </div>
        </div>

        {viewMode === 'table' && error ? <p style={styles.errorText}>{error}</p> : null}
        {viewMode === 'table' && success ? <p style={styles.successText}>{success}</p> : null}

        {viewMode === 'table' ? (
          <div style={styles.section}>
            <div style={styles.filterBar}>
              <div style={styles.segmentedToggle} role="tablist" aria-label="Packing List overview mode">
                <button
                  type="button"
                  onClick={() => setOverviewMode('model')}
                  style={{
                    ...styles.segmentedButton,
                    ...(overviewMode === 'model' ? styles.segmentedButtonActive : {}),
                  }}
                >
                  Model
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewMode('koli')}
                  style={{
                    ...styles.segmentedButton,
                    ...(overviewMode === 'koli' ? styles.segmentedButtonActive : {}),
                  }}
                >
                  Koli
                </button>
              </div>
              <div style={styles.segmentedToggle} role="tablist" aria-label="Packing List page layout">
                <button
                  type="button"
                  onClick={() => setPageMode('all')}
                  style={{
                    ...styles.segmentedButton,
                    ...(pageMode === 'all' ? styles.segmentedButtonActive : {}),
                  }}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPageMode('multipage')
                    setSelectedMultipageKey((current) => current || multipageGroups[0]?.key || '')
                    setModelFilters((prev) => ({ ...prev, brand: '', categoryPath: '' }))
                  }}
                  style={{
                    ...styles.segmentedButton,
                    ...(pageMode === 'multipage' ? styles.segmentedButtonActive : {}),
                  }}
                >
                  Multipage
                </button>
              </div>
              <div style={styles.segmentedToggle} role="tablist" aria-label="Qty allocation mode">
                {[
                  ['all', 'All'],
                  ['mob', 'MOB'],
                  ['oi', 'OI'],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setQtyMode(mode)}
                    style={{
                      ...styles.segmentedButton,
                      ...(qtyMode === mode ? styles.segmentedButtonActive : {}),
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {pageMode !== 'multipage' ? (
                <>
                  <label style={styles.filterField}>
                    <select value={modelFilters.brand} onChange={(event) => updateModelFilter('brand', event.target.value)} style={styles.filterSelect}>
                      <option value="">All Brand</option>
                      {modelFilterOptions.brands.map((brandName) => (
                        <option key={`brand-${brandName}`} value={brandName}>
                          {brandName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={styles.filterField}>
                    <select value={modelFilters.categoryPath} onChange={(event) => updateModelFilter('categoryPath', event.target.value)} style={styles.filterSelect}>
                      <option value="">All Category Path</option>
                      {modelFilterOptions.categoryPaths.map((categoryName) => (
                        <option key={`category-path-${categoryName}`} value={categoryName}>
                          {categoryName}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <label style={styles.filterField}>
                <select value={modelFilters.model} onChange={(event) => updateModelFilter('model', event.target.value)} style={styles.filterSelect}>
                  <option value="">All Model</option>
                  {modelFilterOptions.models.map((modelName) => (
                    <option key={`model-${modelName}`} value={modelName}>
                      {modelName}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={resetModelFilters} style={styles.compactResetButton} title="Reset filters" aria-label="Reset filters">
                &#8634;
              </button>
            </div>
            <div style={pageMode === 'multipage' ? styles.multipageTableShell : undefined}>
              {pageMode === 'multipage' && multipageGroups.length ? (
                <div style={styles.multipageTabs} role="tablist" aria-label="Packing List pages">
                  {multipageGroups.map((group) => {
                    const isActive = (activeMultipageGroup?.key || '') === group.key
                    const pageTitle = [group.brand_name, group.category_path_label].filter(Boolean).join(' / ')
                    return (
                      <button
                        key={group.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => {
                          setSelectedMultipageKey(group.key)
                          setModelFilters((prev) => ({ ...prev, brand: '', categoryPath: '' }))
                        }}
                        title={pageTitle}
                        style={{
                          ...styles.multipageTabButton,
                          borderBottomColor: isActive ? '#0f766e' : 'transparent',
                          color: isActive ? '#0f766e' : '#475569',
                        }}
                      >
                        {group.page_label}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            {overviewMode === 'model' ? (
              <>
            {overviewRows.length ? (
              <div style={pageMode === 'multipage' ? styles.embeddedTableWrap : styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>PL ID</th>
                      <th style={styles.th}>Picture</th>
                      <th style={styles.th}>Brand</th>
                      <th style={styles.th}>Item Name</th>
                      <th style={styles.th}>Size / Qty</th>
                      <th style={styles.th}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewRows.map((row) => (
                      <tr key={row.key} onClick={() => handleSelectCard(row.cardKey)} style={{ cursor: 'pointer' }}>
                        <td style={styles.td}>{row.pl_id}</td>
                        <td style={styles.td}>
                          {row.photo_url ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setPreviewPhoto({ src: row.photo_url, alt: row.model_variant })
                              }}
                              style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                            >
                              <Image src={row.photo_url} alt={row.model_variant} width={54} height={54} unoptimized style={styles.tablePhoto} />
                            </button>
                          ) : (
                            <span style={styles.tableNoPhoto}>NO</span>
                          )}
                        </td>
                        <td style={styles.td}>{row.brand_name}</td>
                        <td style={{ ...styles.td, textAlign: 'left' }}>{row.item_name}</td>
                        <td style={styles.td}>
                          {row.sizes.length ? (
                            <span style={styles.sizeSummary}>
                              {row.sizes.map((size) => (
                                <span key={`${row.key}-${size.size}`} style={styles.sizeChip}>
                                  {size.size}: {size.qty}
                                </span>
                              ))}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td style={styles.td}>{row.total_qty || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={pageMode === 'multipage' ? { ...styles.emptyText, ...styles.embeddedEmpty } : styles.emptyText}>
                {cards.length ? 'No model matches the selected filters.' : 'No PL Receiving data is ready for this GRN.'}
              </p>
            )}
              </>
            ) : (
              <>
                {packingKoliRows.length ? (
                  <div style={pageMode === 'multipage' ? styles.embeddedTableWrap : styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Koli</th>
                          <th style={styles.th}>Items</th>
                          <th style={styles.th}>Total Qty</th>
                          <th style={styles.th}>PIC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packingKoliRows.map((row) => (
                          <tr key={row.key}>
                            <td style={styles.td}>{row.storing_type} / {row.package_type === 'PHOTO' ? 'Foto' : `Koli ${row.koli_label}`}</td>
                            <td style={{ ...styles.td, textAlign: 'left' }}>
                              <span style={styles.sizeSummary}>
                                {row.items.map((item) => (
                                  <span key={`${row.key}-${item.id}`} style={styles.sizeChip}>
                                    {item.item_name} / {item.size_label}: {item.qty}
                                  </span>
                                ))}
                              </span>
                            </td>
                            <td style={styles.td}>{row.total_qty}</td>
                            <td style={styles.td}>{row.items[0]?.packed_by || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={pageMode === 'multipage' ? { ...styles.emptyText, ...styles.embeddedEmpty } : styles.emptyText}>
                    No packing koli matches the selected filters.
                  </p>
                )}
              </>
            )}
            </div>
          </div>
        ) : null}

        {viewMode !== 'table' ? (
          <div style={styles.section}>
            {cards.length ? (
              <div style={styles.cardGrid}>
                {cards.map((card, index) => {
                  const isPreviewOpen = previewCardKey === card.key
                  return (
                    <button
                      key={card.key}
                      type="button"
                      disabled={saving}
                      onClick={() => handleSelectCard(card.key)}
                      onMouseEnter={() => setPreviewCardKey(card.key)}
                      onMouseLeave={() => setPreviewCardKey('')}
                      onFocus={() => setPreviewCardKey(card.key)}
                      onBlur={() => setPreviewCardKey('')}
                      aria-label={`Choose ${card.brand_name || 'UNBRANDED'} ${getModelLabel(card)}`}
                      style={{
                        ...styles.productCard,
                        ...(selectedCardKey === card.key ? styles.productCardActive : {}),
                        ...(isPreviewOpen ? styles.productCardPreview : {}),
                        ...(saving ? styles.lockedArea : {}),
                      }}
                    >
                      {card.photo_url ? (
                        <Image src={card.photo_url} alt={getModelLabel(card)} width={320} height={220} unoptimized style={styles.cardImage} />
                      ) : (
                        <div style={styles.noPhoto}>NO PHOTO</div>
                      )}
                      {isPreviewOpen ? (
                        <span style={{ ...styles.cardPopover, ...(index < 8 ? styles.cardPopoverBelow : {}) }}>
                          <span style={styles.cardPopoverEyebrow}>{card.brand_name || 'UNBRANDED'}</span>
                          <span style={styles.cardTitle}>{getModelLabel(card)}</span>
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p style={styles.emptyText}>No PL Receiving data is ready for this GRN.</p>
            )}

            {!selectedCard ? <p style={styles.emptyText}>Choose a model from the table or photo list first.</p> : null}

            {selectedCard ? (
              <>
                {plRows.map((plRow, plRowIndex) => {
                  const isFirstPlRow = plRowIndex === 0
                  const isLastPlRow = plRowIndex === plRows.length - 1
                  return (
                  <div key={plRow.id} style={styles.plRow}>
                    <fieldset disabled={saving} style={saving ? { ...styles.editorFieldset, ...styles.lockedArea } : styles.editorFieldset}>
                    <div style={styles.editorGrid}>
                      <div style={styles.featureCard}>
                        {plRow.pl_photo_url || selectedCard.photo_url ? (
                          <Image src={plRow.pl_photo_url || selectedCard.photo_url} alt={getModelLabel(selectedCard)} width={360} height={320} unoptimized style={styles.featureImage} />
                        ) : (
                          <div style={styles.featureNoPhoto}>NO PHOTO</div>
                        )}
                        <div style={styles.featureMeta}>
                          <div style={styles.modelLine}>
                            <span style={styles.sourceInline}>{selectedCard.source_variant_code || selectedCard.catalogName || '-'}</span>
                            <strong style={styles.modelNameStrong}>{getModelLabel(selectedCard)}</strong>
                          </div>
                          <div style={styles.field}>
                            <label style={styles.label}>PL Name</label>
                            <input value={plRow.pl_name} onChange={(event) => updatePlRow(plRow.id, { pl_name: event.target.value.toUpperCase() })} style={styles.input} />
                          </div>
                          <div style={styles.field}>
                            <label style={styles.label}>PL Notes</label>
                            <textarea value={plRow.pl_notes} onChange={(event) => updatePlRow(plRow.id, { pl_notes: event.target.value })} style={styles.textarea} />
                          </div>
                          {plRows.length > 1 ? (
                            <div style={styles.field}>
                              <div style={styles.photoDetailHeader}>
                                <label style={styles.label}>Photo Detail</label>
                                <label style={styles.photoAddButton}>
                                  + Detail
                                  <input type="file" accept="image/*" multiple onChange={(event) => handlePhotoChange(plRow.id, event)} style={styles.hiddenFileInput} />
                                </label>
                              </div>
                              {normalizePhotoUrls(plRow.pl_photo_urls).length ? (
                                <div style={styles.photoGrid}>
                                  {normalizePhotoUrls(plRow.pl_photo_urls).map((photoUrl) => {
                                    const isMainPhoto = photoUrl === plRow.pl_photo_url
                                    return (
                                      <span key={photoUrl} style={styles.photoThumbWrap}>
                                        <button
                                          type="button"
                                          onClick={() => setPreviewPhoto({ src: photoUrl, alt: `${plRow.pl_name || 'PL'} photo detail` })}
                                          onDoubleClick={() => setMainPhoto(plRow.id, photoUrl)}
                                          style={{
                                            ...styles.photoThumbButton,
                                            ...(isMainPhoto ? styles.photoThumbButtonActive : {}),
                                          }}
                                          title={isMainPhoto ? 'Main photo. Click to preview.' : 'Click to preview. Double click to set as main photo.'}
                                        >
                                          <Image src={photoUrl} alt={`${plRow.pl_name || 'PL'} photo detail`} width={62} height={62} unoptimized style={styles.photoThumbImage} />
                                        </button>
                                        {isMainPhoto ? <span style={styles.mainPhotoBadge}>MAIN</span> : null}
                                        {!isMainPhoto ? (
                                          <button type="button" onClick={() => setMainPhoto(plRow.id, photoUrl)} style={styles.setMainPhotoButton}>
                                            SET
                                          </button>
                                        ) : null}
                                        <button type="button" onClick={() => removePlPhoto(plRow.id, photoUrl)} style={styles.photoRemoveButton} aria-label="Remove photo">
                                          X
                                        </button>
                                      </span>
                                    )
                                  })}
                                </div>
                              ) : (
                                <p style={styles.emptyText}>No photo detail yet.</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {isFirstPlRow ? (
                          <>
                            <div style={{ ...styles.headerActions, justifyContent: 'space-between', width: '100%' }}>
                              <div style={styles.editorQtyGroup}>
                                <div style={styles.editorQtyBox}>
                                  <span style={styles.editorQtyLabel}>PL Receiving</span>
                                  <strong style={styles.editorQtyValue}>{editorReceivingQty}</strong>
                                </div>
                                <div style={styles.editorQtyBox}>
                                  <span style={styles.editorQtyLabel}>Breakdown Qty</span>
                                  <strong style={styles.editorQtyValue}>{editorBreakdownQty}</strong>
                                </div>
                                <div style={styles.editorQtyBox}>
                                  <span style={styles.editorQtyLabel}>Remaining</span>
                                  <strong style={{ ...styles.editorQtyValue, color: editorRemainingQty < 0 ? '#dc2626' : '#0f172a' }}>{editorRemainingQty}</strong>
                                </div>
                              </div>
                              <div style={styles.editorActionGroup}>
                                <div style={styles.segmentedToggle} role="tablist" aria-label="Size edit section">
                                  <button
                                    type="button"
                                    onClick={() => switchEditSection('breakdown')}
                                    disabled={saving}
                                    style={{
                                      ...styles.segmentedButton,
                                      ...(editSection === 'breakdown' ? styles.segmentedButtonActive : {}),
                                      ...(saving ? styles.disabledButton : {}),
                                    }}
                                  >
                                    Size Breakdown
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => switchEditSection('measurement')}
                                    disabled={saving}
                                    style={{
                                      ...styles.segmentedButton,
                                      ...(editSection === 'measurement' ? styles.segmentedButtonActive : {}),
                                      ...(saving ? styles.disabledButton : {}),
                                    }}
                                  >
                                    Size Chart
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={saveBreakdown}
                                  disabled={saving || !selectedCard}
                                  style={
                                    saving || !selectedCard
                                      ? { ...styles.primaryButton, ...styles.saveButton, ...styles.disabledButton }
                                      : { ...styles.primaryButton, ...styles.saveButton }
                                  }
                                >
                                  {saving ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </div>
                            <div style={styles.saveFeedback}>
                              {saveFeedbackMessage ? (
                                <p style={{ ...styles.saveFeedbackText, color: saveFeedbackColor }}>{saveFeedbackMessage}</p>
                              ) : null}
                            </div>
                          </>
                        ) : null}
                        {editSection === 'breakdown' ? (
                          <div style={styles.sizeRow}>
                            <div style={styles.sizeHeaderGrid}>
                              <span style={styles.sizeHeaderCell}>Size</span>
                              <span style={styles.sizeHeaderCell}>Qty</span>
                              <span style={styles.sizeHeaderCell}>Checker</span>
                              <span style={styles.sizeHeaderCell}>Action</span>
                            </div>
                            {plRow.sizeRows.map((sizeRow) => (
                              <div key={sizeRow.id} style={styles.sizeInputRow}>
                                <input
                                  data-size-field="size"
                                  data-pl-row-id={plRow.id}
                                  value={sizeRow.size_label}
                                  onChange={(event) => updateSizeRow(plRow.id, sizeRow.id, { size_label: normalizeSizeLabel(event.target.value) })}
                                  onKeyDown={(event) => handleSizeKeyDown(event, plRow.id)}
                                  style={styles.input}
                                  placeholder="S / M / L"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  value={sizeRow.qty}
                                  onChange={(event) => updateSizeRow(plRow.id, sizeRow.id, { qty: event.target.value })}
                                  onKeyDown={(event) => handleSizeKeyDown(event, plRow.id)}
                                  style={styles.input}
                                />
                                <div style={styles.checkerPicker}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const checkerKey = `${plRow.id}:${sizeRow.id}`
                                      setOpenCheckerPickerKey(openCheckerPickerKey === checkerKey ? '' : checkerKey)
                                    }}
                                    style={styles.checkerPickerButton}
                                  >
                                    <span style={styles.checkerSummaryText}>{getCheckerSummary(sizeRow.checker_names)}</span>
                                    <span style={styles.checkerPlusText}>+</span>
                                  </button>
                                  {openCheckerPickerKey === `${plRow.id}:${sizeRow.id}` ? (
                                    <div style={styles.checkerMenu}>
                                      {checkerOptions.length ? (
                                        checkerOptions.map((checkerName) => {
                                          const isActive = normalizeCheckerNames(sizeRow.checker_names).includes(checkerName)
                                          return (
                                            <button
                                              key={`${sizeRow.id}-checker-${checkerName}`}
                                              type="button"
                                              onClick={() => toggleCheckerForSizeRow(plRow.id, sizeRow.id, checkerName)}
                                              style={{
                                                ...styles.checkerOption,
                                                ...(isActive ? styles.checkerOptionActive : {}),
                                              }}
                                            >
                                              <span style={{ ...styles.checkerRadio, ...(isActive ? styles.checkerRadioActive : {}) }} />
                                              {checkerName}
                                            </button>
                                          )
                                        })
                                      ) : (
                                        <span style={styles.emptyText}>No packing staff.</span>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeSizeRow(plRow.id, sizeRow.id)}
                                  disabled={plRow.sizeRows.length <= 1}
                                  style={plRow.sizeRows.length <= 1 ? { ...styles.dangerButton, ...styles.disabledButton } : styles.dangerButton}
                                >
                                  X
                                </button>
                              </div>
                            ))}
                            {(plRow.returnRows || []).map((returnRow) => (
                              <div key={returnRow.id} style={styles.sizeInputRow}>
                                <div style={{ ...styles.readonlyBox, fontWeight: 950 }}>RETURN</div>
                                <input
                                  type="number"
                                  min="0"
                                  value={returnRow.qty}
                                  onChange={(event) => updateReturnRow(plRow.id, returnRow.id, { qty: event.target.value })}
                                  style={styles.input}
                                />
                                <input
                                  value={returnRow.return_reason || ''}
                                  onChange={(event) => updateReturnRow(plRow.id, returnRow.id, { return_reason: event.target.value.toUpperCase() })}
                                  style={styles.input}
                                  placeholder="RETURN REASON"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeReturnRow(plRow.id, returnRow.id)}
                                  style={styles.dangerButton}
                                >
                                  X
                                </button>
                              </div>
                            ))}
                            <div style={styles.buttonRow}>
                              <button type="button" onClick={() => addSizeRow(plRow.id)} style={styles.secondaryButton}>
                                + Add Size
                              </button>
                              <button type="button" onClick={() => addReturnRow(plRow.id)} style={styles.secondaryButton}>
                                + Add PL Returns
                              </button>
                              {isLastPlRow ? (
                                <button type="button" onClick={addPlRow} style={styles.secondaryButton}>
                                  + Add Model Variations
                                </button>
                              ) : null}
                              {hasEditorUnsavedChanges && isLastPlRow ? (
                                <button type="button" onClick={resetCurrentModelRows} style={styles.secondaryButton}>
                                  Reset
                                </button>
                              ) : null}
                              {plRows.length > 1 ? (
                                <button type="button" onClick={() => removePlRow(plRow.id)} style={styles.dangerButton}>
                                  Remove Model
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <div style={styles.measurementPanel}>
                            <div style={styles.sizeChartShortcut}>
                              <label style={styles.filterField}>
                                <span style={styles.filterLabel}>Copy Size Chart</span>
                                <select
                                  value={plRow.sizeChartSourceKey || ''}
                                  onChange={(event) => updatePlRow(plRow.id, { sizeChartSourceKey: event.target.value })}
                                  disabled={!sizeChartOptions.length}
                                  style={!sizeChartOptions.length ? { ...styles.filterSelect, ...styles.disabledButton } : styles.filterSelect}
                                >
                                  <option value="">{sizeChartOptions.length ? 'Choose product size chart' : 'No saved product size chart yet'}</option>
                                  {sizeChartOptions.map((option) => (
                                    <option key={option.key} value={option.key}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                onClick={() => applySizeChartShortcut(plRow.id)}
                                disabled={!plRow.sizeChartSourceKey || !sizeChartOptions.length}
                                style={!plRow.sizeChartSourceKey || !sizeChartOptions.length ? { ...styles.secondaryButton, ...styles.disabledButton } : styles.secondaryButton}
                              >
                                Apply
                              </button>
                            </div>
                            <div style={styles.measurementHeaderGrid}>
                              <span style={styles.sizeHeaderCell}>Size</span>
                              <span style={styles.sizeHeaderCell}>Qty</span>
                              <span style={styles.sizeHeaderCell}>Weight</span>
                              <span style={styles.sizeHeaderCell}>Length</span>
                              <span style={styles.sizeHeaderCell}>Width</span>
                              <span style={styles.sizeHeaderCell}>Width After Pull</span>
                              <span style={styles.sizeHeaderCell}>Sleeve Length</span>
                              <span style={styles.sizeHeaderCell}>Thigh Width</span>
                            </div>
                            {plRow.sizeRows.map((sizeRow) => (
                              <div key={sizeRow.id} style={styles.measurementInputGrid}>
                                <div style={styles.readonlyBox}>{normalizeSizeLabel(sizeRow.size_label) || 'SIZE'}</div>
                                <div style={styles.readonlyBox}>{Number(sizeRow.qty || 0)}</div>
                                <input value={sizeRow.weight_value} onChange={(event) => updateSizeRow(plRow.id, sizeRow.id, { weight_value: event.target.value })} style={styles.input} />
                                <input value={sizeRow.length_value} onChange={(event) => updateSizeRow(plRow.id, sizeRow.id, { length_value: event.target.value })} style={styles.input} />
                                <input value={sizeRow.width_value} onChange={(event) => updateSizeRow(plRow.id, sizeRow.id, { width_value: event.target.value })} style={styles.input} />
                                <input value={sizeRow.width_afterpull} onChange={(event) => updateSizeRow(plRow.id, sizeRow.id, { width_afterpull: event.target.value })} style={styles.input} />
                                <input value={sizeRow.sleeve_length} onChange={(event) => updateSizeRow(plRow.id, sizeRow.id, { sleeve_length: event.target.value })} style={styles.input} />
                                <input value={sizeRow.thigh_width} onChange={(event) => updateSizeRow(plRow.id, sizeRow.id, { thigh_width: event.target.value })} style={styles.input} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    </fieldset>
                  </div>
                  )
                })}
              </>
            ) : null}
          </div>
        ) : null}
      </section>
      {previewPhoto ? (
        <div style={styles.previewOverlay} onClick={() => setPreviewPhoto(null)}>
          <div style={styles.previewFrame} onClick={(event) => event.stopPropagation()}>
            <Image src={previewPhoto.src} alt={previewPhoto.alt || 'Photo preview'} width={900} height={900} unoptimized style={styles.previewImage} />
            <button type="button" onClick={() => setPreviewPhoto(null)} style={styles.previewClose} aria-label="Close photo preview">
              X
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
